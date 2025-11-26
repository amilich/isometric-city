// Simulation engine for IsoCity

import {
  GameState,
  Tile,
  Building,
  BuildingType,
  ZoneType,
  Stats,
  Budget,
  ServiceCoverage,
  Achievement,
  AdvisorMessage,
  HistoryPoint,
  Notification,
  BUILDING_STATS,
  RESIDENTIAL_BUILDINGS,
  COMMERCIAL_BUILDINGS,
  INDUSTRIAL_BUILDINGS,
} from '@/types/game';

// Perlin-like noise for terrain generation
function noise2D(x: number, y: number, seed: number = 42): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const corners = (noise2D(x - 1, y - 1, seed) + noise2D(x + 1, y - 1, seed) +
    noise2D(x - 1, y + 1, seed) + noise2D(x + 1, y + 1, seed)) / 16;
  const sides = (noise2D(x - 1, y, seed) + noise2D(x + 1, y, seed) +
    noise2D(x, y - 1, seed) + noise2D(x, y + 1, seed)) / 8;
  const center = noise2D(x, y, seed) / 4;
  return corners + sides + center;
}

function interpolatedNoise(x: number, y: number, seed: number): number {
  const intX = Math.floor(x);
  const fracX = x - intX;
  const intY = Math.floor(y);
  const fracY = y - intY;

  const v1 = smoothNoise(intX, intY, seed);
  const v2 = smoothNoise(intX + 1, intY, seed);
  const v3 = smoothNoise(intX, intY + 1, seed);
  const v4 = smoothNoise(intX + 1, intY + 1, seed);

  const i1 = v1 * (1 - fracX) + v2 * fracX;
  const i2 = v3 * (1 - fracX) + v4 * fracX;

  return i1 * (1 - fracY) + i2 * fracY;
}

function perlinNoise(x: number, y: number, seed: number, octaves: number = 4): number {
  let total = 0;
  let frequency = 0.05;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += interpolatedNoise(x * frequency, y * frequency, seed + i * 100) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / maxValue;
}

// Generate 2-3 large, round lakes
function generateLakes(grid: Tile[][], size: number, seed: number): void {
  // Use noise to find potential lake centers - look for low points
  const lakeNoise = (x: number, y: number) => perlinNoise(x, y, seed + 1000, 3);
  
  // Find lake seed points (local minimums in noise)
  const lakeCenters: { x: number; y: number; noise: number }[] = [];
  const minDistFromEdge = 8;
  const minDistBetweenLakes = size * 0.25; // Keep lakes well separated
  
  // Collect all potential lake centers
  for (let y = minDistFromEdge; y < size - minDistFromEdge; y++) {
    for (let x = minDistFromEdge; x < size - minDistFromEdge; x++) {
      const noiseVal = lakeNoise(x, y);
      
      // Check if this is a good lake center (low noise value)
      if (noiseVal < 0.3) {
        // Check distance from other lake centers
        let tooClose = false;
        for (const center of lakeCenters) {
          const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
          if (dist < minDistBetweenLakes) {
            tooClose = true;
            break;
          }
        }
        
        if (!tooClose) {
          lakeCenters.push({ x, y, noise: noiseVal });
        }
      }
    }
  }
  
  // Sort by noise value (lowest first) and pick 2-3 best candidates
  lakeCenters.sort((a, b) => a.noise - b.noise);
  const numLakes = 2 + Math.floor(Math.random() * 2); // 2 or 3 lakes
  const selectedCenters = lakeCenters.slice(0, Math.min(numLakes, lakeCenters.length));
  
  // Grow lakes from each center using radial expansion for rounder shapes
  for (const center of selectedCenters) {
    // Target size: 15-30 tiles for bigger lakes
    const targetSize = 15 + Math.floor(Math.random() * 16);
    const lakeTiles: { x: number; y: number }[] = [{ x: center.x, y: center.y }];
    const candidates: { x: number; y: number; dist: number; noise: number }[] = [];
    
    // Add initial neighbors as candidates
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dx, dy] of directions) {
      const nx = center.x + dx;
      const ny = center.y + dy;
      if (nx >= minDistFromEdge && nx < size - minDistFromEdge && 
          ny >= minDistFromEdge && ny < size - minDistFromEdge) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const noise = lakeNoise(nx, ny);
        candidates.push({ x: nx, y: ny, dist, noise });
      }
    }
    
    // Grow lake by adding adjacent tiles, prioritizing:
    // 1. Closer to center (for rounder shape)
    // 2. Lower noise values (for organic shape)
    while (lakeTiles.length < targetSize && candidates.length > 0) {
      // Sort by distance from center first, then noise
      candidates.sort((a, b) => {
        if (Math.abs(a.dist - b.dist) < 0.5) {
          return a.noise - b.noise; // If similar distance, prefer lower noise
        }
        return a.dist - b.dist; // Prefer closer tiles for rounder shape
      });
      
      // Pick from top candidates (closest/lowest noise)
      const pickIndex = Math.floor(Math.random() * Math.min(5, candidates.length));
      const picked = candidates.splice(pickIndex, 1)[0];
      
      // Check if already in lake
      if (lakeTiles.some(t => t.x === picked.x && t.y === picked.y)) continue;
      
      // Check if tile is valid (not already water from another lake)
      if (grid[picked.y][picked.x].building.type === 'water') continue;
      
      lakeTiles.push({ x: picked.x, y: picked.y });
      
      // Add new neighbors as candidates
      for (const [dx, dy] of directions) {
        const nx = picked.x + dx;
        const ny = picked.y + dy;
        if (nx >= minDistFromEdge && nx < size - minDistFromEdge && 
            ny >= minDistFromEdge && ny < size - minDistFromEdge &&
            !lakeTiles.some(t => t.x === nx && t.y === ny) &&
            !candidates.some(c => c.x === nx && c.y === ny)) {
          const dist = Math.sqrt((nx - center.x) ** 2 + (ny - center.y) ** 2);
          const noise = lakeNoise(nx, ny);
          candidates.push({ x: nx, y: ny, dist, noise });
        }
      }
    }
    
    // Apply lake tiles to grid
    for (const tile of lakeTiles) {
      grid[tile.y][tile.x].building = createBuilding('water');
      grid[tile.y][tile.x].landValue = 60; // Water increases nearby land value
    }
  }
}

// Generate terrain - grass with scattered trees and lakes
function generateTerrain(size: number): Tile[][] {
  const grid: Tile[][] = [];
  const seed = Math.random() * 1000;

  // First pass: create base terrain with grass
  for (let y = 0; y < size; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < size; x++) {
      row.push(createTile(x, y, 'grass'));
    }
    grid.push(row);
  }
  
  // Second pass: add lakes (small contiguous water regions)
  generateLakes(grid, size, seed);
  
  // Third pass: add scattered trees (avoiding water)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x].building.type === 'water') continue; // Don't place trees on water
      
      const treeNoise = perlinNoise(x * 2, y * 2, seed + 500, 2);
      const isTree = treeNoise > 0.72 && Math.random() > 0.65;
      
      // Also add some trees near water for visual appeal
      const nearWater = isNearWater(grid, x, y, size);
      const isTreeNearWater = nearWater && Math.random() > 0.7;

      if (isTree || isTreeNearWater) {
        grid[y][x].building = createBuilding('tree');
      }
    }
  }

  return grid;
}

// Check if a tile is near water
function isNearWater(grid: Tile[][], x: number, y: number, size: number): boolean {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        if (grid[ny][nx].building.type === 'water') {
          return true;
        }
      }
    }
  }
  return false;
}

function createTile(x: number, y: number, buildingType: BuildingType = 'grass'): Tile {
  return {
    x,
    y,
    zone: 'none',
    building: createBuilding(buildingType),
    landValue: 50,
    pollution: 0,
    crime: 0,
    traffic: 0,
  };
}

function createBuilding(type: BuildingType): Building {
  return {
    type,
    level: type === 'grass' || type === 'empty' || type === 'water' ? 0 : 1,
    population: 0,
    jobs: 0,
    powered: false,
    watered: false,
    onFire: false,
    fireProgress: 0,
    age: 0,
  };
}

function createInitialBudget(): Budget {
  return {
    police: { name: 'Police', funding: 100, cost: 0 },
    fire: { name: 'Fire', funding: 100, cost: 0 },
    health: { name: 'Health', funding: 100, cost: 0 },
    education: { name: 'Education', funding: 100, cost: 0 },
    transportation: { name: 'Transportation', funding: 100, cost: 0 },
    parks: { name: 'Parks', funding: 100, cost: 0 },
    power: { name: 'Power', funding: 100, cost: 0 },
    water: { name: 'Water', funding: 100, cost: 0 },
  };
}

function createInitialStats(): Stats {
  return {
    population: 0,
    jobs: 0,
    money: 20000,
    income: 0,
    expenses: 0,
    happiness: 50,
    health: 50,
    education: 50,
    safety: 50,
    environment: 75,
    demand: {
      residential: 50,
      commercial: 30,
      industrial: 40,
    },
  };
}

function createServiceCoverage(size: number): ServiceCoverage {
  const createGrid = () => Array(size).fill(null).map(() => Array(size).fill(0));
  const createBoolGrid = () => Array(size).fill(null).map(() => Array(size).fill(false));

  return {
    police: createGrid(),
    fire: createGrid(),
    health: createGrid(),
    education: createGrid(),
    power: createBoolGrid(),
    water: createBoolGrid(),
  };
}

function createAchievements(): Achievement[] {
  return [
    { id: 'first_zone', name: 'City Planner', description: 'Place your first zone', requirement: 'Zone 1 tile', unlocked: false },
    { id: 'pop_100', name: 'Village', description: 'Reach 100 population', requirement: '100 population', unlocked: false, progress: 0, target: 100 },
    { id: 'pop_1000', name: 'Town', description: 'Reach 1,000 population', requirement: '1,000 population', unlocked: false, progress: 0, target: 1000 },
    { id: 'pop_10000', name: 'City', description: 'Reach 10,000 population', requirement: '10,000 population', unlocked: false, progress: 0, target: 10000 },
    { id: 'pop_100000', name: 'Metropolis', description: 'Reach 100,000 population', requirement: '100,000 population', unlocked: false, progress: 0, target: 100000 },
    { id: 'money_100k', name: 'Wealthy City', description: 'Accumulate $100,000', requirement: '$100,000 treasury', unlocked: false, progress: 0, target: 100000 },
    { id: 'happy_90', name: 'Paradise', description: 'Achieve 90% happiness', requirement: '90% happiness', unlocked: false },
    { id: 'services_all', name: 'Full Service', description: 'Build all service types', requirement: 'Build police, fire, hospital, school', unlocked: false },
    { id: 'eco_city', name: 'Eco City', description: 'Reach 90% environment rating', requirement: '90% environment', unlocked: false },
    { id: 'year_50', name: 'Half Century', description: 'Play for 50 years', requirement: 'Play 50 years', unlocked: false },
  ];
}

export function createInitialGameState(size: number = 120, cityName: string = 'New City'): GameState {
  const grid = generateTerrain(size);

  return {
    grid,
    gridSize: size,
    cityName,
    year: 2024,
    month: 1,
    day: 1,
    tick: 0,
    speed: 1,
    selectedTool: 'select',
    taxRate: 9,
    stats: createInitialStats(),
    budget: createInitialBudget(),
    services: createServiceCoverage(size),
    notifications: [],
    achievements: createAchievements(),
    advisorMessages: [],
    history: [],
    activePanel: 'none',
    disastersEnabled: true,
  };
}

// Calculate service coverage from service buildings
function calculateServiceCoverage(grid: Tile[][], size: number): ServiceCoverage {
  const services = createServiceCoverage(size);
  
  // Define service ranges
  const serviceRanges: Record<string, { building: BuildingType; range: number; type: keyof ServiceCoverage }[]> = {
    coverage: [
      { building: 'police_station', range: 10, type: 'police' },
      { building: 'fire_station', range: 8, type: 'fire' },
      { building: 'hospital', range: 12, type: 'health' },
      { building: 'school', range: 8, type: 'education' },
      { building: 'university', range: 15, type: 'education' },
    ],
  };

  // Calculate coverage for each service building
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = grid[y][x];
      
      for (const service of serviceRanges.coverage) {
        if (tile.building.type === service.building) {
          // Apply coverage in a radius
          for (let dy = -service.range; dy <= service.range; dy++) {
            for (let dx = -service.range; dx <= service.range; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= service.range) {
                  const coverage = Math.max(0, (1 - distance / service.range) * 100);
                  const currentCoverage = services[service.type] as number[][];
                  currentCoverage[ny][nx] = Math.min(100, currentCoverage[ny][nx] + coverage);
                }
              }
            }
          }
        }
      }

      // Power coverage from power plants (using flood fill approach)
      if (tile.building.type === 'power_plant') {
        const powerRange = 15;
        for (let dy = -powerRange; dy <= powerRange; dy++) {
          for (let dx = -powerRange; dx <= powerRange; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance <= powerRange) {
                services.power[ny][nx] = true;
              }
            }
          }
        }
      }

      // Water coverage from water towers
      if (tile.building.type === 'water_tower') {
        const waterRange = 12;
        for (let dy = -waterRange; dy <= waterRange; dy++) {
          for (let dx = -waterRange; dx <= waterRange; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance <= waterRange) {
                services.water[ny][nx] = true;
              }
            }
          }
        }
      }
    }
  }

  return services;
}

// Check if a tile has road access
function hasRoadAccess(grid: Tile[][], x: number, y: number, size: number): boolean {
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
      if (grid[ny][nx].building.type === 'road') {
        return true;
      }
    }
  }
  return false;
}

// Evolve buildings based on conditions
function evolveBuilding(tile: Tile, services: ServiceCoverage, stats: Stats): Building {
  const building = { ...tile.building };
  const { zone } = tile;
  
  // Only evolve zoned tiles with buildings
  if (zone === 'none' || building.type === 'grass' || building.type === 'water' || building.type === 'road') {
    return building;
  }

  // Check utility connections
  building.powered = services.power[tile.y][tile.x];
  building.watered = services.water[tile.y][tile.x];

  // Calculate growth potential
  const hasPower = building.powered;
  const hasWater = building.watered;
  const landValue = tile.landValue;
  
  // Don't grow without utilities
  if (!hasPower || !hasWater) {
    return building;
  }

  building.age++;

  // Determine target building based on zone and conditions
  const buildingList = zone === 'residential' ? RESIDENTIAL_BUILDINGS :
    zone === 'commercial' ? COMMERCIAL_BUILDINGS :
    zone === 'industrial' ? INDUSTRIAL_BUILDINGS : [];

  // Calculate level based on land value and services
  const serviceCoverage = (
    services.police[tile.y][tile.x] +
    services.fire[tile.y][tile.x] +
    services.health[tile.y][tile.x] +
    services.education[tile.y][tile.x]
  ) / 4;

  const targetLevel = Math.min(5, Math.max(1, Math.floor(
    (landValue / 25) + (serviceCoverage / 30) + (building.age / 100)
  )));

  // Upgrade building if conditions are met
  if (building.age > 20 && targetLevel > building.level && Math.random() < 0.1) {
    const newIndex = Math.min(buildingList.length - 1, targetLevel - 1);
    building.type = buildingList[newIndex];
    building.level = targetLevel;
  }

  // Calculate population/jobs based on building type and level
  const buildingStats = BUILDING_STATS[building.type];
  const efficiency = (hasPower ? 0.5 : 0) + (hasWater ? 0.5 : 0);
  
  if (buildingStats.maxPop > 0) {
    building.population = Math.floor(buildingStats.maxPop * building.level * efficiency * 0.8);
  }
  if (buildingStats.maxJobs > 0) {
    building.jobs = Math.floor(buildingStats.maxJobs * building.level * efficiency * 0.8);
  }

  return building;
}

// Calculate city stats
function calculateStats(grid: Tile[][], size: number, budget: Budget, taxRate: number, services: ServiceCoverage): Stats {
  let population = 0;
  let jobs = 0;
  let totalPollution = 0;
  let residentialZones = 0;
  let commercialZones = 0;
  let industrialZones = 0;
  let developedResidential = 0;
  let developedCommercial = 0;
  let developedIndustrial = 0;
  let totalLandValue = 0;
  let treeCount = 0;
  let waterCount = 0;
  let parkCount = 0;

  // Count everything
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = grid[y][x];
      const building = tile.building;

      population += building.population;
      jobs += building.jobs;
      totalPollution += tile.pollution;
      totalLandValue += tile.landValue;

      if (tile.zone === 'residential') {
        residentialZones++;
        if (building.type !== 'grass') developedResidential++;
      } else if (tile.zone === 'commercial') {
        commercialZones++;
        if (building.type !== 'grass') developedCommercial++;
      } else if (tile.zone === 'industrial') {
        industrialZones++;
        if (building.type !== 'grass') developedIndustrial++;
      }

      if (building.type === 'tree') treeCount++;
      if (building.type === 'water') waterCount++;
      if (building.type === 'park') parkCount++;
    }
  }

  // Calculate demand
  const jobsRatio = jobs > 0 ? population / jobs : 2;
  const residentialDemand = Math.min(100, Math.max(-100, (jobs - population * 0.7) / 10));
  const commercialDemand = Math.min(100, Math.max(-100, (population * 0.3 - jobs * 0.3) / 5));
  const industrialDemand = Math.min(100, Math.max(-100, (population * 0.2 - jobs * 0.4) / 5));

  // Calculate income and expenses
  const income = Math.floor(population * taxRate * 0.1 + jobs * taxRate * 0.05);
  
  let expenses = 0;
  expenses += Math.floor(budget.police.cost * budget.police.funding / 100);
  expenses += Math.floor(budget.fire.cost * budget.fire.funding / 100);
  expenses += Math.floor(budget.health.cost * budget.health.funding / 100);
  expenses += Math.floor(budget.education.cost * budget.education.funding / 100);
  expenses += Math.floor(budget.transportation.cost * budget.transportation.funding / 100);
  expenses += Math.floor(budget.parks.cost * budget.parks.funding / 100);
  expenses += Math.floor(budget.power.cost * budget.power.funding / 100);
  expenses += Math.floor(budget.water.cost * budget.water.funding / 100);

  // Calculate ratings
  const avgPoliceCoverage = calculateAverageCoverage(services.police);
  const avgFireCoverage = calculateAverageCoverage(services.fire);
  const avgHealthCoverage = calculateAverageCoverage(services.health);
  const avgEducationCoverage = calculateAverageCoverage(services.education);

  const safety = Math.min(100, avgPoliceCoverage * 0.7 + avgFireCoverage * 0.3);
  const health = Math.min(100, avgHealthCoverage * 0.8 + (100 - totalPollution / (size * size)) * 0.2);
  const education = Math.min(100, avgEducationCoverage);
  
  const greenRatio = (treeCount + waterCount + parkCount) / (size * size);
  const pollutionRatio = totalPollution / (size * size * 100);
  const environment = Math.min(100, Math.max(0, greenRatio * 200 - pollutionRatio * 100 + 50));

  const jobSatisfaction = jobs >= population ? 100 : (jobs / (population || 1)) * 100;
  const happiness = Math.min(100, (
    safety * 0.15 +
    health * 0.2 +
    education * 0.15 +
    environment * 0.15 +
    jobSatisfaction * 0.2 +
    (100 - taxRate * 3) * 0.15
  ));

  return {
    population,
    jobs,
    money: 0, // Will be updated from previous state
    income,
    expenses,
    happiness,
    health,
    education,
    safety,
    environment,
    demand: {
      residential: residentialDemand,
      commercial: commercialDemand,
      industrial: industrialDemand,
    },
  };
}

function calculateAverageCoverage(coverage: number[][]): number {
  let total = 0;
  let count = 0;
  for (const row of coverage) {
    for (const value of row) {
      total += value;
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

// Update budget costs based on buildings
function updateBudgetCosts(grid: Tile[][], budget: Budget): Budget {
  const newBudget = { ...budget };
  
  let policeCount = 0;
  let fireCount = 0;
  let hospitalCount = 0;
  let schoolCount = 0;
  let universityCount = 0;
  let parkCount = 0;
  let powerCount = 0;
  let waterCount = 0;
  let roadCount = 0;

  for (const row of grid) {
    for (const tile of row) {
      switch (tile.building.type) {
        case 'police_station': policeCount++; break;
        case 'fire_station': fireCount++; break;
        case 'hospital': hospitalCount++; break;
        case 'school': schoolCount++; break;
        case 'university': universityCount++; break;
        case 'park': parkCount++; break;
        case 'power_plant': powerCount++; break;
        case 'water_tower': waterCount++; break;
        case 'road': roadCount++; break;
      }
    }
  }

  newBudget.police.cost = policeCount * 50;
  newBudget.fire.cost = fireCount * 50;
  newBudget.health.cost = hospitalCount * 100;
  newBudget.education.cost = schoolCount * 30 + universityCount * 100;
  newBudget.transportation.cost = roadCount * 2;
  newBudget.parks.cost = parkCount * 10;
  newBudget.power.cost = powerCount * 150;
  newBudget.water.cost = waterCount * 75;

  return newBudget;
}

// Generate advisor messages
function generateAdvisorMessages(stats: Stats, services: ServiceCoverage, grid: Tile[][]): AdvisorMessage[] {
  const messages: AdvisorMessage[] = [];

  // Power advisor
  let unpoweredBuildings = 0;
  for (const row of grid) {
    for (const tile of row) {
      if (tile.zone !== 'none' && tile.building.type !== 'grass' && !tile.building.powered) {
        unpoweredBuildings++;
      }
    }
  }
  if (unpoweredBuildings > 0) {
    messages.push({
      name: 'Power Advisor',
      icon: 'power',
      messages: [`${unpoweredBuildings} buildings lack power. Build more power plants!`],
      priority: unpoweredBuildings > 10 ? 'high' : 'medium',
    });
  }

  // Water advisor
  let unwateredBuildings = 0;
  for (const row of grid) {
    for (const tile of row) {
      if (tile.zone !== 'none' && tile.building.type !== 'grass' && !tile.building.watered) {
        unwateredBuildings++;
      }
    }
  }
  if (unwateredBuildings > 0) {
    messages.push({
      name: 'Water Advisor',
      icon: 'water',
      messages: [`${unwateredBuildings} buildings lack water. Build water towers!`],
      priority: unwateredBuildings > 10 ? 'high' : 'medium',
    });
  }

  // Finance advisor
  const netIncome = stats.income - stats.expenses;
  if (netIncome < 0) {
    messages.push({
      name: 'Finance Advisor',
      icon: 'cash',
      messages: [`City is running a deficit of $${Math.abs(netIncome)}/month. Consider raising taxes or cutting services.`],
      priority: netIncome < -500 ? 'critical' : 'high',
    });
  }

  // Safety advisor
  if (stats.safety < 40) {
    messages.push({
      name: 'Safety Advisor',
      icon: 'shield',
      messages: ['Crime is on the rise. Build more police stations to protect citizens.'],
      priority: stats.safety < 20 ? 'critical' : 'high',
    });
  }

  // Health advisor
  if (stats.health < 50) {
    messages.push({
      name: 'Health Advisor',
      icon: 'hospital',
      messages: ['Health services are lacking. Build hospitals to improve citizen health.'],
      priority: stats.health < 30 ? 'high' : 'medium',
    });
  }

  // Education advisor
  if (stats.education < 50) {
    messages.push({
      name: 'Education Advisor',
      icon: 'education',
      messages: ['Education levels are low. Build schools and universities.'],
      priority: stats.education < 30 ? 'high' : 'medium',
    });
  }

  // Environment advisor
  if (stats.environment < 40) {
    messages.push({
      name: 'Environment Advisor',
      icon: 'environment',
      messages: ['Pollution is high. Plant trees and build parks to improve air quality.'],
      priority: stats.environment < 20 ? 'high' : 'medium',
    });
  }

  // Jobs advisor
  const jobRatio = stats.jobs / (stats.population || 1);
  if (stats.population > 100 && jobRatio < 0.8) {
    messages.push({
      name: 'Employment Advisor',
      icon: 'jobs',
      messages: [`Unemployment is high. Zone more commercial and industrial areas.`],
      priority: jobRatio < 0.5 ? 'high' : 'medium',
    });
  }

  return messages;
}

// Check and update achievements
function checkAchievements(achievements: Achievement[], stats: Stats, grid: Tile[][], year: number): { achievements: Achievement[]; newUnlocks: string[] } {
  const newAchievements = [...achievements];
  const newUnlocks: string[] = [];

  for (const achievement of newAchievements) {
    if (achievement.unlocked) continue;

    let shouldUnlock = false;

    switch (achievement.id) {
      case 'first_zone':
        for (const row of grid) {
          for (const tile of row) {
            if (tile.zone !== 'none') shouldUnlock = true;
          }
        }
        break;
      case 'pop_100':
        achievement.progress = stats.population;
        shouldUnlock = stats.population >= 100;
        break;
      case 'pop_1000':
        achievement.progress = stats.population;
        shouldUnlock = stats.population >= 1000;
        break;
      case 'pop_10000':
        achievement.progress = stats.population;
        shouldUnlock = stats.population >= 10000;
        break;
      case 'pop_100000':
        achievement.progress = stats.population;
        shouldUnlock = stats.population >= 100000;
        break;
      case 'money_100k':
        achievement.progress = stats.money;
        shouldUnlock = stats.money >= 100000;
        break;
      case 'happy_90':
        shouldUnlock = stats.happiness >= 90;
        break;
      case 'eco_city':
        shouldUnlock = stats.environment >= 90;
        break;
      case 'year_50':
        shouldUnlock = year >= 2074;
        break;
      case 'services_all': {
        let hasPolice = false, hasFire = false, hasHospital = false, hasSchool = false;
        for (const row of grid) {
          for (const tile of row) {
            if (tile.building.type === 'police_station') hasPolice = true;
            if (tile.building.type === 'fire_station') hasFire = true;
            if (tile.building.type === 'hospital') hasHospital = true;
            if (tile.building.type === 'school') hasSchool = true;
          }
        }
        shouldUnlock = hasPolice && hasFire && hasHospital && hasSchool;
        break;
      }
    }

    if (shouldUnlock && !achievement.unlocked) {
      achievement.unlocked = true;
      newUnlocks.push(achievement.name);
    }
  }

  return { achievements: newAchievements, newUnlocks };
}

// Main simulation tick
export function simulateTick(state: GameState): GameState {
  const newGrid = state.grid.map(row => row.map(tile => ({ ...tile, building: { ...tile.building } })));
  const size = state.gridSize;

  // Update service coverage
  const services = calculateServiceCoverage(newGrid, size);

  // Evolve buildings
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = newGrid[y][x];
      
      // Update utilities
      tile.building.powered = services.power[y][x];
      tile.building.watered = services.water[y][x];

      // Check for road access and grow buildings in zones
      if (tile.zone !== 'none' && tile.building.type === 'grass') {
        const roadAccess = hasRoadAccess(newGrid, x, y, size);
        const hasPower = services.power[y][x];
        const hasWater = services.water[y][x];

        if (roadAccess && hasPower && hasWater && Math.random() < 0.05) {
          // Spawn a new building
          const buildingList = tile.zone === 'residential' ? RESIDENTIAL_BUILDINGS :
            tile.zone === 'commercial' ? COMMERCIAL_BUILDINGS : INDUSTRIAL_BUILDINGS;
          tile.building.type = buildingList[0];
          tile.building.level = 1;
          tile.building.age = 0;
        }
      } else if (tile.zone !== 'none' && tile.building.type !== 'grass') {
        // Evolve existing building
        newGrid[y][x].building = evolveBuilding(tile, services, state.stats);
      }

      // Update pollution from buildings
      const buildingStats = BUILDING_STATS[tile.building.type];
      tile.pollution = Math.max(0, tile.pollution * 0.95 + buildingStats.pollution);

      // Fire simulation
      if (state.disastersEnabled && tile.building.onFire) {
        const fireCoverage = services.fire[y][x];
        const fightingChance = fireCoverage / 200;
        
        if (Math.random() < fightingChance) {
          tile.building.onFire = false;
          tile.building.fireProgress = 0;
        } else {
          tile.building.fireProgress += 5;
          if (tile.building.fireProgress >= 100) {
            // Building destroyed
            tile.building = createBuilding('grass');
            tile.zone = 'none';
          }
        }
      }

      // Random fire start
      if (state.disastersEnabled && !tile.building.onFire && 
          tile.building.type !== 'grass' && tile.building.type !== 'water' && 
          tile.building.type !== 'road' && tile.building.type !== 'tree' &&
          Math.random() < 0.0001) {
        tile.building.onFire = true;
        tile.building.fireProgress = 0;
      }
    }
  }

  // Update budget costs
  const newBudget = updateBudgetCosts(newGrid, state.budget);

  // Calculate stats
  const newStats = calculateStats(newGrid, size, newBudget, state.taxRate, services);
  newStats.money = state.stats.money;

  // Update money on month change
  let newYear = state.year;
  let newMonth = state.month;
  let newDay = state.day;
  let newTick = state.tick + 1;

  if (newTick >= 30) {
    newTick = 0;
    newDay++;
  }

  if (newDay > 30) {
    newDay = 1;
    newMonth++;
    // Monthly income/expense
    newStats.money += newStats.income - newStats.expenses;
  }

  if (newMonth > 12) {
    newMonth = 1;
    newYear++;
  }

  // Generate advisor messages
  const advisorMessages = generateAdvisorMessages(newStats, services, newGrid);

  // Check achievements
  const { achievements, newUnlocks } = checkAchievements(state.achievements, newStats, newGrid, newYear);

  // Create notifications for new achievements
  const newNotifications = [...state.notifications];
  for (const unlock of newUnlocks) {
    newNotifications.unshift({
      id: `achievement-${Date.now()}`,
      title: 'Achievement Unlocked!',
      description: unlock,
      icon: 'trophy',
      timestamp: Date.now(),
    });
  }

  // Keep only recent notifications
  while (newNotifications.length > 10) {
    newNotifications.pop();
  }

  // Update history quarterly
  const history = [...state.history];
  if (newMonth % 3 === 0 && newDay === 1 && newTick === 0) {
    history.push({
      year: newYear,
      month: newMonth,
      population: newStats.population,
      money: newStats.money,
      happiness: newStats.happiness,
    });
    // Keep last 100 entries
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
    tick: newTick,
    stats: newStats,
    budget: newBudget,
    services,
    advisorMessages,
    achievements,
    notifications: newNotifications,
    history,
  };
}

// Building sizes for multi-tile buildings (width x height)
const BUILDING_SIZES: Partial<Record<BuildingType, { width: number; height: number }>> = {
  power_plant: { width: 2, height: 2 },
  stadium: { width: 3, height: 3 },
  university: { width: 3, height: 2 },
  airport: { width: 4, height: 4 },
};

// Get the size of a building (how many tiles it spans)
export function getBuildingSize(buildingType: BuildingType): { width: number; height: number } {
  return BUILDING_SIZES[buildingType] || { width: 1, height: 1 };
}

// Check if a multi-tile building can be placed at the given position
function canPlaceMultiTileBuilding(
  grid: Tile[][],
  x: number,
  y: number,
  width: number,
  height: number,
  gridSize: number
): boolean {
  // Check bounds
  if (x + width > gridSize || y + height > gridSize) {
    return false;
  }
  
  // Check all tiles are available (grass or empty, not water)
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const tile = grid[y + dy]?.[x + dx];
      if (!tile) return false;
      if (tile.building.type === 'water') return false;
      // Can't build on existing buildings (except grass/trees)
      if (tile.building.type !== 'grass' && tile.building.type !== 'tree' && tile.building.type !== 'empty') {
        return false;
      }
    }
  }
  
  return true;
}

// Place a building or zone
export function placeBuilding(
  state: GameState,
  x: number,
  y: number,
  buildingType: BuildingType | null,
  zone: ZoneType | null
): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;

  // Can't build on water
  if (tile.building.type === 'water') return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));

  if (zone !== null) {
    // Setting zone
    newGrid[y][x].zone = zone;
    if (zone === 'none') {
      // De-zoning resets to grass
      newGrid[y][x].building = createBuilding('grass');
    }
  } else if (buildingType) {
    const size = getBuildingSize(buildingType);
    
    if (size.width > 1 || size.height > 1) {
      // Multi-tile building - check if we can place it
      if (!canPlaceMultiTileBuilding(newGrid, x, y, size.width, size.height, state.gridSize)) {
        return state; // Can't place here
      }
      
      // Place the main building on the origin tile
      newGrid[y][x].building = createBuilding(buildingType);
      newGrid[y][x].zone = 'none';
      
      // Mark other tiles as part of this building (using a special marker)
      // We'll use '_part' suffix conceptually - store reference to origin
      for (let dy = 0; dy < size.height; dy++) {
        for (let dx = 0; dx < size.width; dx++) {
          if (dx === 0 && dy === 0) continue; // Skip origin
          // Clear these tiles but don't place a visible building
          // They are "occupied" by the main building
          newGrid[y + dy][x + dx].building = createBuilding('grass');
          newGrid[y + dy][x + dx].building.type = 'empty'; // Mark as empty but occupied
          newGrid[y + dy][x + dx].zone = 'none';
        }
      }
    } else {
      // Single tile building
      newGrid[y][x].building = createBuilding(buildingType);
      newGrid[y][x].zone = 'none';
    }
  }

  return { ...state, grid: newGrid };
}

// Bulldoze a tile
export function bulldozeTile(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  if (tile.building.type === 'water') return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  newGrid[y][x].building = createBuilding('grass');
  newGrid[y][x].zone = 'none';

  return { ...state, grid: newGrid };
}
