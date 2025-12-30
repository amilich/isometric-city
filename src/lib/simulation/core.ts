import { GameState, Tile, BuildingType, ZoneType } from '@/types/game';
import { DEFAULT_GRID_SIZE, BUILDING_STATS, RESIDENTIAL_BUILDINGS, COMMERCIAL_BUILDINGS, INDUSTRIAL_BUILDINGS, NO_CONSTRUCTION_TYPES, getBuildingSize } from './constants';
import { generateUUID, createBuilding, createInitialBudget, createInitialStats, createTile } from './factories';
import { generateTerrain, generateAdjacentCities } from './terrain';
import { createServiceCoverage, calculateServiceCoverage } from './services';
import { updateBudgetCosts, calculateStats } from './economy';
import { generateAdvisorMessages } from './advisors';
import { 
  getConstructionSpeed, 
  findBuildingOrigin, 
  hasRoadAccess, 
  canSpawnMultiTileBuilding, 
  applyBuildingFootprint, 
  evolveBuilding 
} from './buildings';
import { isStarterBuilding } from './utils';

export function createInitialGameState(size: number = DEFAULT_GRID_SIZE, cityName: string = 'New City', gameMode: 'sandbox' | 'scenario' = 'sandbox'): GameState {
  const { grid, waterBodies } = generateTerrain(size);
  const adjacentCities = generateAdjacentCities();

  return {
    id: generateUUID(),
    gameMode,
    grid,
    gridSize: size,
    cityName,
    year: 2024,
    month: 1,
    day: 1,
    hour: 12,
    tick: 0,
    speed: 1,
    selectedTool: 'select',
    taxRate: 9,
    effectiveTaxRate: 9,
    stats: createInitialStats(),
    budget: createInitialBudget(),
    services: createServiceCoverage(size),
    notifications: [],
    advisorMessages: [],
    history: [],
    activePanel: 'none',
    disastersEnabled: true,
    adjacentCities,
    waterBodies,
    gameVersion: 0,
  };
}

export function simulateTick(state: GameState): GameState {
  const size = state.gridSize;
  
  const services = calculateServiceCoverage(state.grid, size);
  
  const modifiedRows = new Set<number>();
  const newGrid: Tile[][] = new Array(size);
  
  for (let y = 0; y < size; y++) {
    newGrid[y] = state.grid[y];
  }
  
  const getModifiableTile = (x: number, y: number): Tile => {
    if (!modifiedRows.has(y)) {
      newGrid[y] = state.grid[y].map(t => ({ ...t, building: { ...t.building } }));
      modifiedRows.add(y);
    }
    return newGrid[y][x];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const originalTile = state.grid[y][x];
      const originalBuilding = originalTile.building;
      
      if (originalBuilding.type === 'water') {
        continue;
      }
      
      const newPowered = services.power[y][x];
      const newWatered = services.water[y][x];
      const needsPowerWaterUpdate = originalBuilding.powered !== newPowered ||
                                    originalBuilding.watered !== newWatered;
      
      if (originalBuilding.type === 'road' && !needsPowerWaterUpdate) {
        continue;
      }
      
      if (originalTile.zone === 'none' && 
          (originalBuilding.type === 'grass' || originalBuilding.type === 'tree') &&
          !needsPowerWaterUpdate &&
          originalTile.pollution < 0.01 &&
          (BUILDING_STATS[originalBuilding.type]?.pollution || 0) === 0) {
        continue;
      }
      
      const isCompletedServiceBuilding = originalTile.zone === 'none' && 
          originalBuilding.constructionProgress === 100 &&
          !originalBuilding.onFire &&
          originalBuilding.type !== 'grass' && 
          originalBuilding.type !== 'tree' &&
          originalBuilding.type !== 'empty';
      if (isCompletedServiceBuilding && !needsPowerWaterUpdate && originalTile.pollution < 0.01) {
        continue;
      }
      
      const tile = getModifiableTile(x, y);
      
      tile.building.powered = newPowered;
      tile.building.watered = newWatered;

      if (tile.zone === 'none' &&
          tile.building.constructionProgress !== undefined &&
          tile.building.constructionProgress < 100 &&
          !NO_CONSTRUCTION_TYPES.includes(tile.building.type)) {
        const isUtilityBuilding = tile.building.type === 'power_plant' || tile.building.type === 'water_tower';
        const canConstruct = isUtilityBuilding || (tile.building.powered && tile.building.watered);
        
        if (canConstruct) {
          const constructionSpeed = getConstructionSpeed(tile.building.type);
          tile.building.constructionProgress = Math.min(100, tile.building.constructionProgress + constructionSpeed);
        }
      }

      if (tile.building.type === 'empty') {
        const origin = findBuildingOrigin(newGrid, x, y, size);
        if (!origin) {
          tile.building = createBuilding('grass');
          tile.building.powered = newPowered;
          tile.building.watered = newWatered;
        }
      }

      if (tile.zone !== 'none' && tile.building.type === 'grass') {
        const roadAccess = hasRoadAccess(newGrid, x, y, size);
        const hasPower = newPowered;
        const hasWater = newWatered;

        const zoneDemandForSpawn = state.stats.demand ? (
          tile.zone === 'residential' ? state.stats.demand.residential :
          tile.zone === 'commercial' ? state.stats.demand.commercial :
          tile.zone === 'industrial' ? state.stats.demand.industrial : 0
        ) : 0;
        
        const baseSpawnChance = 0.05;
        const demandFactor = Math.max(0, Math.min(1, (zoneDemandForSpawn + 30) / 80));
        const spawnChance = baseSpawnChance * demandFactor;

        const buildingList = tile.zone === 'residential' ? RESIDENTIAL_BUILDINGS :
          tile.zone === 'commercial' ? COMMERCIAL_BUILDINGS : INDUSTRIAL_BUILDINGS;
        const candidate = buildingList[0];
        const wouldBeStarter = isStarterBuilding(x, y, candidate);
        const hasUtilities = hasPower && hasWater;
        
        if (roadAccess && (hasUtilities || wouldBeStarter) && Math.random() < spawnChance) {
          const candidateSize = getBuildingSize(candidate);
          if (canSpawnMultiTileBuilding(newGrid, x, y, candidateSize.width, candidateSize.height, tile.zone, size)) {
            for (let dy = 0; dy < candidateSize.height && y + dy < size; dy++) {
              if (!modifiedRows.has(y + dy)) {
                newGrid[y + dy] = state.grid[y + dy].map(t => ({ ...t, building: { ...t.building } }));
                modifiedRows.add(y + dy);
              }
            }
            applyBuildingFootprint(newGrid, x, y, candidate, tile.zone, 1, services);
          }
        }
      } else if (tile.zone !== 'none' && tile.building.type !== 'grass') {
        newGrid[y][x].building = evolveBuilding(newGrid, x, y, services, state.stats.demand);
      }

      const buildingStats = BUILDING_STATS[tile.building.type];
      tile.pollution = Math.max(0, tile.pollution * 0.95 + (buildingStats?.pollution || 0));

      if (state.disastersEnabled && tile.building.onFire) {
        const fireCoverage = services.fire[y][x];
        const fightingChance = fireCoverage / 300;
        
        if (Math.random() < fightingChance) {
          tile.building.onFire = false;
          tile.building.fireProgress = 0;
        } else {
          tile.building.fireProgress += 2/3; 
          if (tile.building.fireProgress >= 100) {
            tile.building = createBuilding('grass');
            tile.zone = 'none';
          }
        }
      }

      if (state.disastersEnabled && !tile.building.onFire && 
          tile.building.type !== 'grass' && tile.building.type !== 'water' && 
          tile.building.type !== 'road' && tile.building.type !== 'tree' &&
          tile.building.type !== 'empty' &&
          Math.random() < 0.00003) {
        tile.building.onFire = true;
        tile.building.fireProgress = 0;
      }
    }
  }

  const newBudget = updateBudgetCosts(newGrid, state.budget);

  const taxRateDiff = state.taxRate - state.effectiveTaxRate;
  const newEffectiveTaxRate = state.effectiveTaxRate + taxRateDiff * 0.03;

  const newStats = calculateStats(newGrid, size, newBudget, state.taxRate, newEffectiveTaxRate, services);
  newStats.money = state.stats.money;

  let newYear = state.year;
  let newMonth = state.month;
  let newDay = state.day;
  let newTick = state.tick + 1;
  
  const totalTicks = ((state.year - 2024) * 12 * 30 * 30) + ((state.month - 1) * 30 * 30) + ((state.day - 1) * 30) + newTick;
  const cycleLength = 450;
  const newHour = Math.floor((totalTicks % cycleLength) / cycleLength * 24);

  if (newTick >= 30) {
    newTick = 0;
    newDay++;
    if (newDay % 7 === 0) {
      newStats.money += Math.floor((newStats.income - newStats.expenses) / 4);
    }
  }

  if (newDay > 30) {
    newDay = 1;
    newMonth++;
  }

  if (newMonth > 12) {
    newMonth = 1;
    newYear++;
  }

  const advisorMessages = generateAdvisorMessages(newStats, services, newGrid);

  const newNotifications = [...state.notifications];

  while (newNotifications.length > 10) {
    newNotifications.pop();
  }

  const history = [...state.history];
  if (newMonth % 3 === 0 && newDay === 1 && newTick === 0) {
    history.push({
      year: newYear,
      month: newMonth,
      population: newStats.population,
      money: newStats.money,
      happiness: newStats.happiness,
    });
    while (history.length > 100) {
      history.shift();
    }
  }

  return {
    ...state,
    grid: newGrid,
    year: newYear,
    month: newMonth,
    day: newDay,
    hour: newHour,
    tick: newTick,
    effectiveTaxRate: newEffectiveTaxRate,
    stats: newStats,
    budget: newBudget,
    services,
    advisorMessages,
    notifications: newNotifications,
    history,
  };
}

export function generateRandomAdvancedCity(size: number = DEFAULT_GRID_SIZE, cityName: string = 'Metropolis'): GameState {
  const baseState = createInitialGameState(size, cityName);
  const grid = baseState.grid;
  
  const isRegionClear = (x: number, y: number, w: number, h: number): boolean => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tile = grid[y + dy]?.[x + dx];
        if (!tile || tile.building.type === 'water') return false;
      }
    }
    return true;
  };
  
  const createAdvancedBuilding = (type: BuildingType) => {
    const building = createBuilding(type);
    building.level = type === 'grass' || type === 'empty' || type === 'water' || type === 'road' ? 0 : Math.floor(Math.random() * 3) + 3;
    building.powered = true;
    building.watered = true;
    building.age = Math.floor(Math.random() * 100) + 50;
    building.constructionProgress = 100;
    return building;
  };

  const placeRoad = (x: number, y: number): void => {
    const tile = grid[y]?.[x];
    if (tile && tile.building.type !== 'water') {
      tile.building = createAdvancedBuilding('road');
      tile.zone = 'none';
    }
  };
  
  const placeZonedBuilding = (x: number, y: number, zone: ZoneType, buildingType: BuildingType): void => {
    const tile = grid[y]?.[x];
    if (tile && tile.building.type !== 'water' && tile.building.type !== 'road') {
      tile.zone = zone;
      tile.building = createAdvancedBuilding(buildingType);
      tile.building.level = Math.floor(Math.random() * 3) + 3;
      const stats = BUILDING_STATS[buildingType];
      if (stats) {
        tile.building.population = Math.floor(stats.maxPop * tile.building.level * 0.7);
        tile.building.jobs = Math.floor(stats.maxJobs * tile.building.level * 0.7);
      }
    }
  };
  
  const placeMultiTileBuilding = (x: number, y: number, type: BuildingType, zone: ZoneType = 'none'): boolean => {
    const buildingSize = getBuildingSize(type);
    if (!isRegionClear(x, y, buildingSize.width, buildingSize.height)) return false;
    if (x + buildingSize.width > size || y + buildingSize.height > size) return false;
    
    for (let dy = 0; dy < buildingSize.height; dy++) {
      for (let dx = 0; dx < buildingSize.width; dx++) {
        if (grid[y + dy][x + dx].building.type === 'road') return false;
      }
    }
    
    for (let dy = 0; dy < buildingSize.height; dy++) {
      for (let dx = 0; dx < buildingSize.width; dx++) {
        const tile = grid[y + dy][x + dx];
        tile.zone = zone;
        if (dx === 0 && dy === 0) {
          tile.building = createAdvancedBuilding(type);
          const stats = BUILDING_STATS[type];
          if (stats) {
            tile.building.population = Math.floor(stats.maxPop * tile.building.level * 0.8);
            tile.building.jobs = Math.floor(stats.maxJobs * tile.building.level * 0.8);
          }
        } else {
          tile.building = createAdvancedBuilding('empty');
          tile.building.level = 0;
        }
      }
    }
    return true;
  };
  
  const centerX = Math.floor(size / 2);
  const centerY = Math.floor(size / 2);
  const cityRadius = Math.floor(size * 0.35);
  
  const roadSpacing = 6 + Math.floor(Math.random() * 3);
  
  for (let roadY = centerY - cityRadius; roadY <= centerY + cityRadius; roadY += roadSpacing) {
    if (roadY < 2 || roadY >= size - 2) continue;
    for (let x = Math.max(2, centerX - cityRadius); x <= Math.min(size - 3, centerX + cityRadius); x++) {
      placeRoad(x, roadY);
    }
  }
  
  for (let roadX = centerX - cityRadius; roadX <= centerX + cityRadius; roadX += roadSpacing) {
    if (roadX < 2 || roadX >= size - 2) continue;
    for (let y = Math.max(2, centerY - cityRadius); y <= Math.min(size - 3, centerY + cityRadius); y++) {
      placeRoad(roadX, y);
    }
  }
  
  const ringRadius = cityRadius - 5;
  for (let angle = 0; angle < Math.PI * 2; angle += 0.08) {
    const rx = Math.round(centerX + Math.cos(angle) * ringRadius);
    const ry = Math.round(centerY + Math.sin(angle) * ringRadius);
    if (rx >= 2 && rx < size - 2 && ry >= 2 && ry < size - 2) {
      placeRoad(rx, ry);
    }
  }
  
  const serviceBuildings: Array<{ type: BuildingType; count: number }> = [
    { type: 'power_plant', count: 4 + Math.floor(Math.random() * 3) },
    { type: 'water_tower', count: 8 + Math.floor(Math.random() * 4) },
    { type: 'police_station', count: 6 + Math.floor(Math.random() * 4) },
    { type: 'fire_station', count: 6 + Math.floor(Math.random() * 4) },
    { type: 'hospital', count: 3 + Math.floor(Math.random() * 2) },
    { type: 'school', count: 5 + Math.floor(Math.random() * 3) },
    { type: 'university', count: 2 + Math.floor(Math.random() * 2) },
  ];
  
  for (const service of serviceBuildings) {
    let placed = 0;
    let attempts = 0;
    while (placed < service.count && attempts < 500) {
      const x = centerX - cityRadius + Math.floor(Math.random() * cityRadius * 2);
      const y = centerY - cityRadius + Math.floor(Math.random() * cityRadius * 2);
      if (placeMultiTileBuilding(x, y, service.type)) {
        placed++;
      }
      attempts++;
    }
  }
  
  const specialBuildings: BuildingType[] = [
    'city_hall', 'stadium', 'museum', 'airport', 'space_program', 'amusement_park',
    'baseball_stadium', 'amphitheater', 'community_center'
  ];
  
  for (const building of specialBuildings) {
    let attempts = 0;
    while (attempts < 200) {
      const x = centerX - cityRadius + Math.floor(Math.random() * cityRadius * 2);
      const y = centerY - cityRadius + Math.floor(Math.random() * cityRadius * 2);
      if (placeMultiTileBuilding(x, y, building)) break;
      attempts++;
    }
  }
  
  const parkBuildings: BuildingType[] = [
    'park', 'park_large', 'tennis', 'basketball_courts', 'playground_small', 
    'playground_large', 'swimming_pool', 'skate_park', 'community_garden', 'pond_park'
  ];
  
  for (let i = 0; i < 25 + Math.floor(Math.random() * 15); i++) {
    const parkType = parkBuildings[Math.floor(Math.random() * parkBuildings.length)];
    let attempts = 0;
    while (attempts < 100) {
      const x = centerX - cityRadius + Math.floor(Math.random() * cityRadius * 2);
      const y = centerY - cityRadius + Math.floor(Math.random() * cityRadius * 2);
      if (placeMultiTileBuilding(x, y, parkType)) break;
      attempts++;
    }
  }
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = grid[y][x];
      if (tile.building.type !== 'grass' && tile.building.type !== 'tree') continue;
      
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (dist > cityRadius) continue;
      
      let nearRoad = false;
      for (let dy = -2; dy <= 2 && !nearRoad; dy++) {
        for (let dx = -2; dx <= 2 && !nearRoad; dx++) {
          const checkTile = grid[y + dy]?.[x + dx];
          if (checkTile?.building.type === 'road') nearRoad = true;
        }
      }
      if (!nearRoad) continue;
      
      const normalizedDist = dist / cityRadius;
      let zone: ZoneType;
      let buildingType: BuildingType;
      
      const rand = Math.random();
      
      if (normalizedDist < 0.3) {
        if (rand < 0.6) {
          zone = 'commercial';
          const commercialTypes: BuildingType[] = ['shop_small', 'shop_medium', 'office_low', 'office_high', 'mall'];
          buildingType = commercialTypes[Math.floor(Math.random() * commercialTypes.length)];
        } else {
          zone = 'residential';
          const residentialTypes: BuildingType[] = ['apartment_low', 'apartment_high'];
          buildingType = residentialTypes[Math.floor(Math.random() * residentialTypes.length)];
        }
      } else if (normalizedDist < 0.6) {
        if (rand < 0.5) {
          zone = 'residential';
          const residentialTypes: BuildingType[] = ['house_medium', 'mansion', 'apartment_low'];
          buildingType = residentialTypes[Math.floor(Math.random() * residentialTypes.length)];
        } else if (rand < 0.8) {
          zone = 'commercial';
          const commercialTypes: BuildingType[] = ['shop_small', 'shop_medium', 'office_low'];
          buildingType = commercialTypes[Math.floor(Math.random() * commercialTypes.length)];
        } else {
          zone = 'industrial';
          buildingType = 'factory_small';
        }
      } else {
        if (rand < 0.5) {
          zone = 'residential';
          const residentialTypes: BuildingType[] = ['house_small', 'house_medium'];
          buildingType = residentialTypes[Math.floor(Math.random() * residentialTypes.length)];
        } else if (rand < 0.7) {
          zone = 'industrial';
          const industrialTypes: BuildingType[] = ['factory_small', 'factory_medium', 'warehouse'];
          buildingType = industrialTypes[Math.floor(Math.random() * industrialTypes.length)];
        } else {
          zone = 'commercial';
          buildingType = 'shop_small';
        }
      }
      
      const bSize = getBuildingSize(buildingType);
      if (bSize.width > 1 || bSize.height > 1) {
        placeMultiTileBuilding(x, y, buildingType, zone);
      } else {
        placeZonedBuilding(x, y, zone, buildingType);
      }
    }
  }
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = grid[y][x];
      if (tile.building.type === 'grass' && Math.random() < 0.15) {
        tile.building = createAdvancedBuilding('tree');
      }
    }
  }
  
  for (let y = centerY - Math.floor(cityRadius * 0.6); y <= centerY + Math.floor(cityRadius * 0.6); y++) {
    for (let x = centerX - Math.floor(cityRadius * 0.6); x <= centerX + Math.floor(cityRadius * 0.6); x++) {
      const tile = grid[y]?.[x];
      if (tile && tile.building.type !== 'water') {
        const onMainRoad = (x % roadSpacing === centerX % roadSpacing) || (y % roadSpacing === centerY % roadSpacing);
        if (onMainRoad && Math.random() < 0.7) {
          tile.hasSubway = true;
        }
      }
    }
  }
  
  const subwayStationSpacing = roadSpacing * 2;
  for (let y = centerY - cityRadius; y <= centerY + cityRadius; y += subwayStationSpacing) {
    for (let x = centerX - cityRadius; x <= centerX + cityRadius; x += subwayStationSpacing) {
      const tile = grid[y]?.[x];
      if (tile && tile.building.type === 'grass' && tile.zone === 'none') {
        tile.building = createAdvancedBuilding('subway_station');
        tile.hasSubway = true;
      }
    }
  }
  
  const services = calculateServiceCoverage(grid, size);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      grid[y][x].building.powered = services.power[y][x];
      grid[y][x].building.watered = services.water[y][x];
    }
  }
  
  let totalPopulation = 0;
  let totalJobs = 0;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const building = grid[y][x].building;
      totalPopulation += building.population;
      totalJobs += building.jobs;
    }
  }
  
  return {
    ...baseState,
    grid,
    cityName,
    year: 2024 + Math.floor(Math.random() * 50),
    month: Math.floor(Math.random() * 12) + 1,
    day: Math.floor(Math.random() * 28) + 1,
    hour: 12,
    tick: 0,
    speed: 1,
    selectedTool: 'select',
    taxRate: 7 + Math.floor(Math.random() * 4),
    effectiveTaxRate: 8,
    stats: {
      population: totalPopulation,
      jobs: totalJobs,
      money: 500000 + Math.floor(Math.random() * 1000000),
      income: Math.floor(totalPopulation * 0.8 + totalJobs * 0.4),
      expenses: Math.floor((totalPopulation + totalJobs) * 0.3),
      happiness: 65 + Math.floor(Math.random() * 20),
      health: 60 + Math.floor(Math.random() * 25),
      education: 55 + Math.floor(Math.random() * 30),
      safety: 60 + Math.floor(Math.random() * 25),
      environment: 50 + Math.floor(Math.random() * 30),
      demand: {
        residential: 20 + Math.floor(Math.random() * 40),
        commercial: 15 + Math.floor(Math.random() * 35),
        industrial: 10 + Math.floor(Math.random() * 30),
      },
    },
    services,
    notifications: [],
    advisorMessages: [],
    history: [],
    activePanel: 'none',
    disastersEnabled: true,
  };
}

