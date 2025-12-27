// Competitive RTS Game Context
'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  CompetitiveGameState,
  Player,
  PlayerId,
  MilitaryUnit,
  MilitaryUnitType,
  FogOfWar,
  FogState,
  BuildingOwnership,
  MILITARY_UNIT_STATS,
  PLAYER_COLORS,
  COMPETITIVE_STARTING_MONEY,
  COMPETITIVE_MAP_SIZE,
  VISION_RANGE,
  BUILDING_VISION_RANGE,
  BUILDING_HEALTH,
  DEFAULT_BUILDING_HEALTH,
  SCORE_WEIGHTS,
} from '@/types/competitive';
import { Tile, Building, BuildingType, BUILDING_STATS } from '@/types/game';
import { generateCityName } from '@/lib/names';

// Create initial competitive game state
function createCompetitiveGameState(gridSize: number = COMPETITIVE_MAP_SIZE): CompetitiveGameState {
  const grid: Tile[][] = [];
  
  // Initialize grid with grass
  for (let y = 0; y < gridSize; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < gridSize; x++) {
      row.push({
        x,
        y,
        zone: 'none',
        building: createBuilding('grass'),
        landValue: 50,
        pollution: 0,
        crime: 0,
        traffic: 0,
        hasSubway: false,
      });
    }
    grid.push(row);
  }
  
  // Generate terrain with water features and some trees
  generateCompetitiveTerrain(grid, gridSize);
  
  // Create players - 1 human + 2-3 AI
  const numAIPlayers = 2 + Math.floor(Math.random() * 2); // 2 or 3 AI players
  const players: Player[] = [];
  
  // Calculate spawn positions (spread around the map)
  const spawnPositions = calculateSpawnPositions(gridSize, numAIPlayers + 1);
  
  // Create human player
  players.push({
    id: 'player',
    name: 'You',
    color: PLAYER_COLORS[0].primary,
    colorSecondary: PLAYER_COLORS[0].secondary,
    money: COMPETITIVE_STARTING_MONEY,
    score: 0,
    isHuman: true,
    isEliminated: false,
    cityX: spawnPositions[0].x,
    cityY: spawnPositions[0].y,
    incomePerTick: 10,
    unitCount: 0,
    buildingsDestroyed: 0,
    unitsLost: 0,
    unitsKilled: 0,
  });
  
  // Create AI players
  const aiIds: PlayerId[] = ['ai1', 'ai2', 'ai3'];
  for (let i = 0; i < numAIPlayers; i++) {
    const aiName = generateCityName();
    players.push({
      id: aiIds[i],
      name: aiName,
      color: PLAYER_COLORS[i + 1].primary,
      colorSecondary: PLAYER_COLORS[i + 1].secondary,
      money: COMPETITIVE_STARTING_MONEY,
      score: 0,
      isHuman: false,
      isEliminated: false,
      cityX: spawnPositions[i + 1].x,
      cityY: spawnPositions[i + 1].y,
      incomePerTick: 10,
      unitCount: 0,
      buildingsDestroyed: 0,
      unitsLost: 0,
      unitsKilled: 0,
    });
  }
  
  // Initialize fog of war for each player
  const fogOfWar: Record<PlayerId, FogOfWar> = {} as Record<PlayerId, FogOfWar>;
  for (const player of players) {
    const fog: FogState[][] = [];
    const lastSeen: number[][] = [];
    for (let y = 0; y < gridSize; y++) {
      fog.push(new Array(gridSize).fill('unexplored'));
      lastSeen.push(new Array(gridSize).fill(0));
    }
    fogOfWar[player.id] = { tiles: fog, lastSeen };
  }
  
  // Initialize building ownership and place starting cities
  const buildingOwnership: BuildingOwnership[] = [];
  
  for (const player of players) {
    // Place starting city for each player
    placeStartingCity(grid, player.cityX, player.cityY, player.id, buildingOwnership, gridSize);
    
    // Reveal area around starting city
    revealArea(fogOfWar[player.id], player.cityX, player.cityY, BUILDING_VISION_RANGE + 5, gridSize);
  }
  
  // Initialize production queues
  const productionQueues: Record<PlayerId, { type: MilitaryUnitType; progress: number; buildTime: number }[]> = {
    player: [],
    ai1: [],
    ai2: [],
    ai3: [],
  };
  
  return {
    grid,
    gridSize,
    tick: 0,
    speed: 1,
    gameMode: 'competitive',
    players,
    currentPlayer: 'player',
    militaryUnits: [],
    nextUnitId: 1,
    productionQueues,
    buildingOwnership,
    fogOfWar,
    gameStarted: true,
    gameOver: false,
    winner: null,
    gameDuration: 0,
    selectedUnits: [],
    selectionBox: null,
    activePanel: 'none',
  };
}

// Helper to create a building
function createBuilding(type: BuildingType): Building {
  return {
    type,
    level: 1,
    population: 0,
    jobs: 0,
    powered: true,
    watered: true,
    onFire: false,
    fireProgress: 0,
    age: 0,
    constructionProgress: 100,
    abandoned: false,
  };
}

// Calculate spawn positions spread around the map
function calculateSpawnPositions(gridSize: number, numPlayers: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const margin = Math.floor(gridSize * 0.15);
  const usableSize = gridSize - margin * 2;
  
  if (numPlayers === 2) {
    positions.push({ x: margin + 5, y: margin + 5 });
    positions.push({ x: gridSize - margin - 5, y: gridSize - margin - 5 });
  } else if (numPlayers === 3) {
    positions.push({ x: margin + 5, y: margin + 5 });
    positions.push({ x: gridSize - margin - 5, y: margin + 5 });
    positions.push({ x: gridSize / 2, y: gridSize - margin - 5 });
  } else {
    // 4 players - corners
    positions.push({ x: margin + 5, y: margin + 5 });
    positions.push({ x: gridSize - margin - 5, y: margin + 5 });
    positions.push({ x: margin + 5, y: gridSize - margin - 5 });
    positions.push({ x: gridSize - margin - 5, y: gridSize - margin - 5 });
  }
  
  return positions;
}

// Place starting city for a player
function placeStartingCity(
  grid: Tile[][],
  centerX: number,
  centerY: number,
  owner: PlayerId,
  buildingOwnership: BuildingOwnership[],
  gridSize: number
): void {
  // Place city hall at center
  placeBuildingForPlayer(grid, centerX, centerY, 'city_hall', owner, buildingOwnership, gridSize, 2);
  
  // Place some starting buildings around it
  const startingBuildings: { dx: number; dy: number; type: BuildingType; size: number }[] = [
    { dx: -3, dy: 0, type: 'house_small', size: 1 },
    { dx: -3, dy: -1, type: 'house_small', size: 1 },
    { dx: -3, dy: 1, type: 'house_small', size: 1 },
    { dx: 3, dy: 0, type: 'factory_small', size: 1 },
    { dx: 3, dy: 1, type: 'factory_small', size: 1 },
    { dx: 0, dy: -3, type: 'shop_small', size: 1 },
    { dx: 1, dy: -3, type: 'shop_small', size: 1 },
    { dx: 0, dy: 3, type: 'power_plant', size: 2 },
    { dx: -2, dy: 3, type: 'water_tower', size: 1 },
  ];
  
  for (const building of startingBuildings) {
    const x = centerX + building.dx;
    const y = centerY + building.dy;
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      placeBuildingForPlayer(grid, x, y, building.type, owner, buildingOwnership, gridSize, building.size);
    }
  }
  
  // Add roads connecting buildings
  const roadPositions = [
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY },
    { x: centerX + 2, y: centerY },
    { x: centerX, y: centerY - 1 },
    { x: centerX, y: centerY - 2 },
    { x: centerX, y: centerY + 2 },
    { x: centerX - 2, y: centerY - 1 },
    { x: centerX - 2, y: centerY + 1 },
    { x: centerX + 2, y: centerY + 1 },
    { x: centerX + 1, y: centerY - 2 },
    { x: centerX - 1, y: centerY + 2 },
  ];
  
  for (const pos of roadPositions) {
    if (pos.x >= 0 && pos.x < gridSize && pos.y >= 0 && pos.y < gridSize) {
      const tile = grid[pos.y][pos.x];
      if (tile.building.type === 'grass') {
        tile.building = createBuilding('road');
      }
    }
  }
}

// Place a building for a player
function placeBuildingForPlayer(
  grid: Tile[][],
  x: number,
  y: number,
  type: BuildingType,
  owner: PlayerId,
  buildingOwnership: BuildingOwnership[],
  gridSize: number,
  size: number = 1
): void {
  // Check bounds
  if (x < 0 || x + size > gridSize || y < 0 || y + size > gridSize) return;
  
  // Check if tiles are available
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      if (grid[y + dy][x + dx].building.type !== 'grass') return;
    }
  }
  
  // Place building
  grid[y][x].building = createBuilding(type);
  
  // Mark secondary tiles for multi-tile buildings
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      if (dx === 0 && dy === 0) continue;
      grid[y + dy][x + dx].building = createBuilding('empty'); // Mark as occupied
    }
  }
  
  // Add ownership
  const maxHealth = BUILDING_HEALTH[type] || DEFAULT_BUILDING_HEALTH;
  buildingOwnership.push({
    tileX: x,
    tileY: y,
    owner,
    health: maxHealth,
    maxHealth,
  });
  
  // Set population/jobs if applicable
  const stats = BUILDING_STATS[type];
  if (stats) {
    grid[y][x].building.population = stats.maxPop;
    grid[y][x].building.jobs = stats.maxJobs;
  }
}

// Generate terrain for competitive map
function generateCompetitiveTerrain(grid: Tile[][], gridSize: number): void {
  const seed = Math.random() * 10000;
  
  // Simple noise function
  const noise = (x: number, y: number) => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
    return n - Math.floor(n);
  };
  
  // Add some water features (lakes)
  const numLakes = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numLakes; i++) {
    const lakeX = Math.floor(gridSize * 0.2 + Math.random() * gridSize * 0.6);
    const lakeY = Math.floor(gridSize * 0.2 + Math.random() * gridSize * 0.6);
    const lakeSize = 3 + Math.floor(Math.random() * 5);
    
    for (let dy = -lakeSize; dy <= lakeSize; dy++) {
      for (let dx = -lakeSize; dx <= lakeSize; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= lakeSize + noise(lakeX + dx, lakeY + dy) * 2) {
          const x = lakeX + dx;
          const y = lakeY + dy;
          if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            grid[y][x].building = createBuilding('water');
          }
        }
      }
    }
  }
  
  // Add trees scattered around
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x].building.type === 'grass' && noise(x, y) > 0.85) {
        grid[y][x].building = createBuilding('tree');
      }
    }
  }
}

// Reveal area around a point
function revealArea(fog: FogOfWar, centerX: number, centerY: number, range: number, gridSize: number): void {
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= range) {
          fog.tiles[y][x] = 'visible';
          fog.lastSeen[y][x] = Date.now();
        }
      }
    }
  }
}

// Context type
type CompetitiveGameContextValue = {
  state: CompetitiveGameState;
  // Game actions
  startGame: () => void;
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  setActivePanel: (panel: CompetitiveGameState['activePanel']) => void;
  // Military actions
  trainUnit: (type: MilitaryUnitType) => void;
  selectUnits: (unitIds: number[]) => void;
  selectUnitsInBox: (startX: number, startY: number, endX: number, endY: number) => void;
  clearSelection: () => void;
  moveSelectedUnits: (targetX: number, targetY: number) => void;
  attackWithSelectedUnits: (targetTileX: number, targetTileY: number) => void;
  setSelectionBox: (box: CompetitiveGameState['selectionBox']) => void;
  // Utility
  getPlayerFog: () => FogOfWar;
  getBuildingOwner: (tileX: number, tileY: number) => PlayerId | null;
  isVisible: (tileX: number, tileY: number) => boolean;
};

const CompetitiveGameContext = createContext<CompetitiveGameContextValue | null>(null);

export function CompetitiveGameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CompetitiveGameState>(() => createCompetitiveGameState());
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  
  // Game loop
  useEffect(() => {
    if (state.speed === 0 || state.gameOver) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }
    
    const tickInterval = state.speed === 1 ? 500 : state.speed === 2 ? 250 : 100;
    
    gameLoopRef.current = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      
      setState(prev => simulateCompetitiveTick(prev, delta));
    }, tickInterval);
    
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [state.speed, state.gameOver]);
  
  const startGame = useCallback(() => {
    setState(createCompetitiveGameState());
  }, []);
  
  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    setState(prev => ({ ...prev, speed }));
  }, []);
  
  const setActivePanel = useCallback((panel: CompetitiveGameState['activePanel']) => {
    setState(prev => ({ ...prev, activePanel: panel }));
  }, []);
  
  const trainUnit = useCallback((type: MilitaryUnitType) => {
    setState(prev => {
      const player = prev.players.find(p => p.id === 'player');
      if (!player) return prev;
      
      const stats = MILITARY_UNIT_STATS[type];
      if (player.money < stats.cost) return prev;
      
      // Find the player's city hall for spawn location
      const cityHall = prev.buildingOwnership.find(
        b => prev.grid[b.tileY]?.[b.tileX]?.building.type === 'city_hall' && b.owner === 'player'
      );
      if (!cityHall) return prev;
      
      // Deduct money
      const updatedPlayers = prev.players.map(p =>
        p.id === 'player' ? { ...p, money: p.money - stats.cost } : p
      );
      
      // Add to production queue
      const updatedQueues = {
        ...prev.productionQueues,
        player: [
          ...prev.productionQueues.player,
          { type, progress: 0, buildTime: stats.buildTime },
        ],
      };
      
      return {
        ...prev,
        players: updatedPlayers,
        productionQueues: updatedQueues,
      };
    });
  }, []);
  
  const selectUnits = useCallback((unitIds: number[]) => {
    setState(prev => {
      const units = prev.militaryUnits.map(u => ({
        ...u,
        selected: unitIds.includes(u.id) && u.owner === 'player',
      }));
      return {
        ...prev,
        militaryUnits: units,
        selectedUnits: unitIds.filter(id =>
          prev.militaryUnits.some(u => u.id === id && u.owner === 'player')
        ),
      };
    });
  }, []);
  
  const selectUnitsInBox = useCallback((startX: number, startY: number, endX: number, endY: number) => {
    setState(prev => {
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);
      
      const selectedIds: number[] = [];
      const units = prev.militaryUnits.map(u => {
        const inBox = u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY;
        const isPlayerUnit = u.owner === 'player';
        const shouldSelect = inBox && isPlayerUnit;
        if (shouldSelect) {
          selectedIds.push(u.id);
        }
        return { ...u, selected: shouldSelect };
      });
      
      return {
        ...prev,
        militaryUnits: units,
        selectedUnits: selectedIds,
      };
    });
  }, []);
  
  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      militaryUnits: prev.militaryUnits.map(u => ({ ...u, selected: false })),
      selectedUnits: [],
      selectionBox: null,
    }));
  }, []);
  
  const moveSelectedUnits = useCallback((targetX: number, targetY: number) => {
    setState(prev => {
      const targetTileX = Math.floor(targetX);
      const targetTileY = Math.floor(targetY);
      
      const units = prev.militaryUnits.map(u => {
        if (!u.selected || u.owner !== 'player') return u;
        
        return {
          ...u,
          targetX: targetTileX,
          targetY: targetTileY,
          attackTarget: null,
          state: 'moving' as const,
        };
      });
      
      return { ...prev, militaryUnits: units };
    });
  }, []);
  
  const attackWithSelectedUnits = useCallback((targetTileX: number, targetTileY: number) => {
    setState(prev => {
      // Check if there's an enemy building or unit at target
      const targetBuilding = prev.buildingOwnership.find(
        b => b.tileX === targetTileX && b.tileY === targetTileY && b.owner !== 'player'
      );
      
      const targetUnit = prev.militaryUnits.find(
        u => u.tileX === targetTileX && u.tileY === targetTileY && u.owner !== 'player'
      );
      
      const units = prev.militaryUnits.map(u => {
        if (!u.selected || u.owner !== 'player') return u;
        
        if (targetUnit) {
          return {
            ...u,
            attackTarget: { type: 'unit' as const, id: targetUnit.id },
            targetX: targetTileX,
            targetY: targetTileY,
            state: 'moving' as const,
          };
        } else if (targetBuilding) {
          return {
            ...u,
            attackTarget: { type: 'building' as const, id: 0, tileX: targetTileX, tileY: targetTileY },
            targetX: targetTileX,
            targetY: targetTileY,
            state: 'moving' as const,
          };
        }
        
        return u;
      });
      
      return { ...prev, militaryUnits: units };
    });
  }, []);
  
  const setSelectionBox = useCallback((box: CompetitiveGameState['selectionBox']) => {
    setState(prev => ({ ...prev, selectionBox: box }));
  }, []);
  
  const getPlayerFog = useCallback(() => {
    return state.fogOfWar.player;
  }, [state.fogOfWar]);
  
  const getBuildingOwner = useCallback((tileX: number, tileY: number): PlayerId | null => {
    const ownership = state.buildingOwnership.find(b => b.tileX === tileX && b.tileY === tileY);
    return ownership?.owner || null;
  }, [state.buildingOwnership]);
  
  const isVisible = useCallback((tileX: number, tileY: number): boolean => {
    const fog = state.fogOfWar.player;
    if (!fog || tileX < 0 || tileY < 0 || tileY >= fog.tiles.length || tileX >= fog.tiles[0].length) {
      return false;
    }
    return fog.tiles[tileY][tileX] === 'visible';
  }, [state.fogOfWar]);
  
  const value: CompetitiveGameContextValue = {
    state,
    startGame,
    setSpeed,
    setActivePanel,
    trainUnit,
    selectUnits,
    selectUnitsInBox,
    clearSelection,
    moveSelectedUnits,
    attackWithSelectedUnits,
    setSelectionBox,
    getPlayerFog,
    getBuildingOwner,
    isVisible,
  };
  
  return (
    <CompetitiveGameContext.Provider value={value}>
      {children}
    </CompetitiveGameContext.Provider>
  );
}

export function useCompetitiveGame() {
  const ctx = useContext(CompetitiveGameContext);
  if (!ctx) {
    throw new Error('useCompetitiveGame must be used within a CompetitiveGameProvider');
  }
  return ctx;
}

// Simulation tick for competitive mode
function simulateCompetitiveTick(state: CompetitiveGameState, delta: number): CompetitiveGameState {
  if (state.gameOver) return state;
  
  let newState = { ...state };
  newState.tick += 1;
  newState.gameDuration += delta;
  
  // Update each player
  newState = updatePlayers(newState, delta);
  
  // Update production queues
  newState = updateProductionQueues(newState, delta);
  
  // Update military units
  newState = updateMilitaryUnits(newState, delta);
  
  // Update fog of war
  newState = updateFogOfWar(newState);
  
  // Update AI
  newState = updateAI(newState, delta);
  
  // Check for victory/defeat
  newState = checkGameOver(newState);
  
  // Update scores
  newState = updateScores(newState);
  
  return newState;
}

// Update player resources
function updatePlayers(state: CompetitiveGameState, delta: number): CompetitiveGameState {
  const players = state.players.map(player => {
    if (player.isEliminated) return player;
    
    // Calculate income from owned buildings
    let income = 0;
    for (const ownership of state.buildingOwnership) {
      if (ownership.owner !== player.id) continue;
      const tile = state.grid[ownership.tileY]?.[ownership.tileX];
      if (!tile) continue;
      
      // Income based on building type
      const buildingType = tile.building.type;
      if (buildingType === 'factory_small' || buildingType === 'factory_medium' || buildingType === 'factory_large') {
        income += 5;
      } else if (buildingType === 'shop_small' || buildingType === 'shop_medium' || buildingType === 'mall') {
        income += 3;
      } else if (buildingType === 'office_low' || buildingType === 'office_high') {
        income += 4;
      }
    }
    
    // Every 5 ticks, add income
    if (state.tick % 5 === 0) {
      return {
        ...player,
        money: player.money + income + player.incomePerTick,
      };
    }
    
    return player;
  });
  
  return { ...state, players };
}

// Update production queues
function updateProductionQueues(state: CompetitiveGameState, delta: number): CompetitiveGameState {
  const productionQueues = { ...state.productionQueues };
  let militaryUnits = [...state.militaryUnits];
  let nextUnitId = state.nextUnitId;
  const players = [...state.players];
  
  for (const playerId of Object.keys(productionQueues) as PlayerId[]) {
    const queue = productionQueues[playerId];
    if (queue.length === 0) continue;
    
    // Update first item in queue
    const item = { ...queue[0] };
    item.progress += delta;
    
    if (item.progress >= item.buildTime) {
      // Unit complete - spawn it
      const player = players.find(p => p.id === playerId);
      if (player) {
        const cityHall = state.buildingOwnership.find(
          b => state.grid[b.tileY]?.[b.tileX]?.building.type === 'city_hall' && b.owner === playerId
        );
        
        if (cityHall) {
          const stats = MILITARY_UNIT_STATS[item.type];
          const spawnOffset = militaryUnits.filter(u => u.owner === playerId).length % 4;
          const offsetX = (spawnOffset % 2) * 2 - 1;
          const offsetY = Math.floor(spawnOffset / 2) * 2 - 1;
          
          const newUnit: MilitaryUnit = {
            id: nextUnitId++,
            type: item.type,
            owner: playerId,
            x: (cityHall.tileX + offsetX) * 64,
            y: (cityHall.tileY + offsetY) * 64,
            tileX: cityHall.tileX + offsetX,
            tileY: cityHall.tileY + offsetY,
            targetX: null,
            targetY: null,
            path: null,
            pathIndex: 0,
            progress: 0,
            speed: stats.speed,
            direction: 'south',
            state: 'idle',
            health: stats.health,
            maxHealth: stats.health,
            attackPower: stats.attackPower,
            attackRange: stats.attackRange,
            attackCooldown: 0,
            attackCooldownMax: stats.attackCooldown,
            attackTarget: null,
            selected: false,
            animTimer: 0,
            flashTimer: 0,
          };
          
          militaryUnits.push(newUnit);
          
          // Update player unit count
          const playerIndex = players.findIndex(p => p.id === playerId);
          if (playerIndex >= 0) {
            players[playerIndex] = {
              ...players[playerIndex],
              unitCount: players[playerIndex].unitCount + 1,
            };
          }
        }
      }
      
      // Remove from queue
      productionQueues[playerId] = queue.slice(1);
    } else {
      productionQueues[playerId] = [item, ...queue.slice(1)];
    }
  }
  
  return { ...state, productionQueues, militaryUnits, nextUnitId, players };
}

// Update military units
function updateMilitaryUnits(state: CompetitiveGameState, delta: number): CompetitiveGameState {
  let militaryUnits = [...state.militaryUnits];
  let buildingOwnership = [...state.buildingOwnership];
  const grid = state.grid.map(row => row.map(tile => ({ ...tile })));
  let players = [...state.players];
  
  for (let i = 0; i < militaryUnits.length; i++) {
    let unit = { ...militaryUnits[i] };
    
    // Skip dead units
    if (unit.state === 'dead' || unit.health <= 0) {
      continue;
    }
    
    // Update animation timer
    unit.animTimer += delta * 4;
    
    // Update attack cooldown
    if (unit.attackCooldown > 0) {
      unit.attackCooldown -= delta;
    }
    
    // Handle movement
    if (unit.targetX !== null && unit.targetY !== null) {
      const dx = unit.targetX - unit.tileX;
      const dy = unit.targetY - unit.tileY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 0.5) {
        // Move toward target
        const moveSpeed = unit.speed * delta * 10;
        const moveX = (dx / dist) * moveSpeed;
        const moveY = (dy / dist) * moveSpeed;
        
        unit.tileX += moveX;
        unit.tileY += moveY;
        unit.x = unit.tileX * 64;
        unit.y = unit.tileY * 64;
        
        // Update direction
        if (Math.abs(dx) > Math.abs(dy)) {
          unit.direction = dx > 0 ? 'east' : 'west';
        } else {
          unit.direction = dy > 0 ? 'south' : 'north';
        }
        
        unit.state = 'moving';
      } else {
        // Arrived at target
        unit.tileX = Math.round(unit.tileX);
        unit.tileY = Math.round(unit.tileY);
        unit.targetX = null;
        unit.targetY = null;
        unit.state = 'idle';
      }
    }
    
    // Handle attacking
    if (unit.attackTarget && unit.attackCooldown <= 0) {
      if (unit.attackTarget.type === 'unit') {
        // Attack enemy unit
        const targetIndex = militaryUnits.findIndex(u => u.id === unit.attackTarget!.id);
        if (targetIndex >= 0) {
          const target = militaryUnits[targetIndex];
          const dist = Math.sqrt(
            Math.pow(target.tileX - unit.tileX, 2) + Math.pow(target.tileY - unit.tileY, 2)
          );
          
          if (dist <= unit.attackRange) {
            // Deal damage
            militaryUnits[targetIndex] = {
              ...target,
              health: target.health - unit.attackPower,
              flashTimer: 0.5,
            };
            
            unit.attackCooldown = unit.attackCooldownMax;
            unit.state = 'attacking';
            
            // Check if target died
            if (militaryUnits[targetIndex].health <= 0) {
              militaryUnits[targetIndex].state = 'dead';
              unit.attackTarget = null;
              
              // Update kill count
              const attackerPlayer = players.findIndex(p => p.id === unit.owner);
              const targetPlayer = players.findIndex(p => p.id === target.owner);
              if (attackerPlayer >= 0) {
                players[attackerPlayer] = {
                  ...players[attackerPlayer],
                  unitsKilled: players[attackerPlayer].unitsKilled + 1,
                };
              }
              if (targetPlayer >= 0) {
                players[targetPlayer] = {
                  ...players[targetPlayer],
                  unitsLost: players[targetPlayer].unitsLost + 1,
                  unitCount: players[targetPlayer].unitCount - 1,
                };
              }
            }
          } else {
            // Move closer
            unit.targetX = target.tileX;
            unit.targetY = target.tileY;
          }
        } else {
          unit.attackTarget = null;
        }
      } else if (unit.attackTarget.type === 'building') {
        // Attack enemy building
        const targetX = unit.attackTarget.tileX!;
        const targetY = unit.attackTarget.tileY!;
        const dist = Math.sqrt(
          Math.pow(targetX - unit.tileX, 2) + Math.pow(targetY - unit.tileY, 2)
        );
        
        if (dist <= unit.attackRange) {
          // Find building ownership
          const ownershipIndex = buildingOwnership.findIndex(
            b => b.tileX === targetX && b.tileY === targetY
          );
          
          if (ownershipIndex >= 0) {
            const ownership = buildingOwnership[ownershipIndex];
            
            // Deal damage to building
            buildingOwnership[ownershipIndex] = {
              ...ownership,
              health: ownership.health - unit.attackPower,
            };
            
            // Set building on fire when damaged
            if (grid[targetY]?.[targetX]) {
              grid[targetY][targetX].building = {
                ...grid[targetY][targetX].building,
                onFire: true,
                fireProgress: Math.min(100, (grid[targetY][targetX].building.fireProgress || 0) + 20),
              };
            }
            
            unit.attackCooldown = unit.attackCooldownMax;
            unit.state = 'attacking';
            
            // Check if building destroyed
            if (buildingOwnership[ownershipIndex].health <= 0) {
              // Destroy building
              if (grid[targetY]?.[targetX]) {
                grid[targetY][targetX].building = createBuilding('grass');
                grid[targetY][targetX].building.onFire = false;
              }
              
              // Update destroy count
              const attackerPlayer = players.findIndex(p => p.id === unit.owner);
              if (attackerPlayer >= 0) {
                players[attackerPlayer] = {
                  ...players[attackerPlayer],
                  buildingsDestroyed: players[attackerPlayer].buildingsDestroyed + 1,
                };
              }
              
              // Remove ownership
              buildingOwnership.splice(ownershipIndex, 1);
              unit.attackTarget = null;
            }
          } else {
            unit.attackTarget = null;
          }
        } else {
          // Move closer
          unit.targetX = targetX;
          unit.targetY = targetY;
        }
      }
    }
    
    // Update flash timer
    if (unit.flashTimer > 0) {
      unit.flashTimer -= delta;
    }
    
    militaryUnits[i] = unit;
  }
  
  // Remove dead units after a delay
  militaryUnits = militaryUnits.filter(u => u.state !== 'dead' || u.flashTimer > -2);
  
  return { ...state, militaryUnits, buildingOwnership, grid, players };
}

// Update fog of war based on unit positions
function updateFogOfWar(state: CompetitiveGameState): CompetitiveGameState {
  const fogOfWar = { ...state.fogOfWar };
  
  for (const player of state.players) {
    if (player.isEliminated) continue;
    
    const fog = {
      tiles: fogOfWar[player.id].tiles.map(row => [...row]),
      lastSeen: fogOfWar[player.id].lastSeen.map(row => [...row]),
    };
    
    // Reset visible tiles to explored (fog returns)
    for (let y = 0; y < state.gridSize; y++) {
      for (let x = 0; x < state.gridSize; x++) {
        if (fog.tiles[y][x] === 'visible') {
          fog.tiles[y][x] = 'explored';
        }
      }
    }
    
    // Reveal around owned buildings
    for (const ownership of state.buildingOwnership) {
      if (ownership.owner !== player.id) continue;
      revealArea(fog, ownership.tileX, ownership.tileY, BUILDING_VISION_RANGE, state.gridSize);
    }
    
    // Reveal around units
    for (const unit of state.militaryUnits) {
      if (unit.owner !== player.id || unit.state === 'dead') continue;
      const visionRange = VISION_RANGE[unit.type];
      revealArea(fog, Math.round(unit.tileX), Math.round(unit.tileY), visionRange, state.gridSize);
    }
    
    fogOfWar[player.id] = fog;
  }
  
  return { ...state, fogOfWar };
}

// Simple AI logic
function updateAI(state: CompetitiveGameState, delta: number): CompetitiveGameState {
  let newState = { ...state };
  
  for (const player of newState.players) {
    if (player.isHuman || player.isEliminated) continue;
    
    // AI decision making every ~5 seconds (100 ticks at speed 1)
    if (state.tick % 100 !== Math.floor(Math.random() * 10)) continue;
    
    // Train units if has money
    const canAffordInfantry = player.money >= MILITARY_UNIT_STATS.infantry.cost;
    const canAffordTank = player.money >= MILITARY_UNIT_STATS.tank.cost;
    const queueLength = newState.productionQueues[player.id].length;
    
    if (queueLength < 3) {
      if (canAffordTank && Math.random() < 0.3) {
        // Train tank
        newState = {
          ...newState,
          players: newState.players.map(p =>
            p.id === player.id ? { ...p, money: p.money - MILITARY_UNIT_STATS.tank.cost } : p
          ),
          productionQueues: {
            ...newState.productionQueues,
            [player.id]: [
              ...newState.productionQueues[player.id],
              { type: 'tank' as MilitaryUnitType, progress: 0, buildTime: MILITARY_UNIT_STATS.tank.buildTime },
            ],
          },
        };
      } else if (canAffordInfantry) {
        // Train infantry
        newState = {
          ...newState,
          players: newState.players.map(p =>
            p.id === player.id ? { ...p, money: p.money - MILITARY_UNIT_STATS.infantry.cost } : p
          ),
          productionQueues: {
            ...newState.productionQueues,
            [player.id]: [
              ...newState.productionQueues[player.id],
              { type: 'infantry' as MilitaryUnitType, progress: 0, buildTime: MILITARY_UNIT_STATS.infantry.buildTime },
            ],
          },
        };
      }
    }
    
    // Command idle units to attack
    const idleUnits = newState.militaryUnits.filter(
      u => u.owner === player.id && u.state === 'idle' && !u.attackTarget
    );
    
    if (idleUnits.length >= 3 && Math.random() < 0.5) {
      // Find an enemy building to attack
      const enemyBuildings = newState.buildingOwnership.filter(b => b.owner !== player.id);
      if (enemyBuildings.length > 0) {
        const target = enemyBuildings[Math.floor(Math.random() * enemyBuildings.length)];
        
        newState = {
          ...newState,
          militaryUnits: newState.militaryUnits.map(u => {
            if (idleUnits.some(idle => idle.id === u.id)) {
              return {
                ...u,
                attackTarget: { type: 'building' as const, id: 0, tileX: target.tileX, tileY: target.tileY },
                targetX: target.tileX,
                targetY: target.tileY,
                state: 'moving' as const,
              };
            }
            return u;
          }),
        };
      }
    }
  }
  
  return newState;
}

// Check for victory/defeat conditions
function checkGameOver(state: CompetitiveGameState): CompetitiveGameState {
  const players = state.players.map(player => {
    if (player.isEliminated) return player;
    
    // Check if player still has a city hall
    const hasCityHall = state.buildingOwnership.some(
      b => b.owner === player.id && state.grid[b.tileY]?.[b.tileX]?.building.type === 'city_hall'
    );
    
    if (!hasCityHall) {
      return { ...player, isEliminated: true };
    }
    
    return player;
  });
  
  // Check if game is over
  const activePlayers = players.filter(p => !p.isEliminated);
  
  if (activePlayers.length === 1) {
    return {
      ...state,
      players,
      gameOver: true,
      winner: activePlayers[0].id,
    };
  }
  
  // Check if human player is eliminated
  const humanPlayer = players.find(p => p.isHuman);
  if (humanPlayer?.isEliminated) {
    return {
      ...state,
      players,
      gameOver: true,
      winner: activePlayers[0]?.id || null,
    };
  }
  
  return { ...state, players };
}

// Update player scores
function updateScores(state: CompetitiveGameState): CompetitiveGameState {
  const players = state.players.map(player => {
    // Calculate score
    const buildingCount = state.buildingOwnership.filter(b => b.owner === player.id).length;
    const population = state.buildingOwnership
      .filter(b => b.owner === player.id)
      .reduce((sum, b) => {
        const tile = state.grid[b.tileY]?.[b.tileX];
        return sum + (tile?.building.population || 0);
      }, 0);
    
    const score =
      Math.floor(player.money * SCORE_WEIGHTS.money / 100) +
      population * SCORE_WEIGHTS.population +
      buildingCount * SCORE_WEIGHTS.buildings +
      player.unitsKilled * SCORE_WEIGHTS.unitsKilled +
      player.buildingsDestroyed * SCORE_WEIGHTS.buildingsDestroyed;
    
    return { ...player, score };
  });
  
  return { ...state, players };
}
