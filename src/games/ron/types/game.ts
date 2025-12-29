/**
 * Rise of Nations - Game State Types
 */

import { Age } from './ages';
import { Resources, ResourceRates, OIL_DEPOSIT_CHANCE } from './resources';
import { RoNBuilding, RoNBuildingType } from './buildings';
import { Unit, UnitType } from './units';

export type RoNPlayerType = 'human' | 'ai';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface RoNPlayer {
  id: string;
  name: string;
  type: RoNPlayerType;
  difficulty?: AIDifficulty;    // Only for AI players
  color: string;
  age: Age;
  resources: Resources;
  resourceRates: ResourceRates;
  storageLimits: Resources;
  population: number;
  populationCap: number;
  isDefeated: boolean;
  hasWon: boolean;
  // Research/tech progress
  researchProgress: number;     // Progress toward next age
  // Visibility
  exploredTiles: boolean[][];   // Has this player explored this tile?
  visibleTiles: boolean[][];    // Can this player currently see this tile?
}

export interface RoNTile {
  x: number;
  y: number;
  terrain: 'grass' | 'water' | 'mountain' | 'forest';
  building: RoNBuilding | null;
  ownerId: string | null;       // Who controls this tile
  hasOilDeposit: boolean;       // Oil can be extracted here (industrial+)
  hasMetalDeposit: boolean;     // Metal can be mined here
  forestDensity: number;        // 0-100, how much wood is here
}

export interface RoNGameState {
  // Identification
  id: string;
  gameName: string;
  
  // Time
  tick: number;
  gameSpeed: 0 | 1 | 2 | 3;     // 0 = paused
  
  // Map
  grid: RoNTile[][];
  gridSize: number;
  
  // Players
  players: RoNPlayer[];
  currentPlayerId: string;      // Current player (for turn-based or just tracking human)
  
  // Units
  units: Unit[];
  
  // Selection state
  selectedUnitIds: string[];
  selectedBuildingPos: { x: number; y: number } | null;
  isSelectingArea: boolean;
  selectionStart: { x: number; y: number } | null;
  selectionEnd: { x: number; y: number } | null;
  
  // UI state
  selectedTool: RoNTool;
  activePanel: 'none' | 'research' | 'military' | 'economy' | 'diplomacy' | 'settings';
  
  // Camera
  cameraOffset: { x: number; y: number };
  zoom: number;
  
  // Game result
  gameOver: boolean;
  winnerId: string | null;
  
  // Wonders (only one of each per game)
  builtWonders: string[];
}

export type RoNTool =
  | 'select'
  | 'move'
  | 'attack'
  | 'build_city_center'
  | 'build_farm'
  | 'build_woodcutters_camp'
  | 'build_granary'
  | 'build_lumber_mill'
  | 'build_mine'
  | 'build_smelter'
  | 'build_market'
  | 'build_oil_well'
  | 'build_refinery'
  | 'build_library'
  | 'build_university'
  | 'build_temple'
  | 'build_senate'
  | 'build_barracks'
  | 'build_stable'
  | 'build_siege_factory'
  | 'build_dock'
  | 'build_auto_plant'
  | 'build_factory'
  | 'build_airbase'
  | 'build_tower'
  | 'build_fort'
  | 'build_fortress'
  | 'build_castle'
  | 'build_bunker'
  | 'build_road';

export interface RoNToolInfo {
  name: string;
  buildingType?: RoNBuildingType;
  description: string;
  hotkey?: string;
}

export const RON_TOOL_INFO: Record<RoNTool, RoNToolInfo> = {
  select: { name: 'Select', description: 'Select units and buildings' },
  move: { name: 'Move', description: 'Move selected units', hotkey: 'M' },
  attack: { name: 'Attack', description: 'Attack target', hotkey: 'A' },
  build_city_center: { name: 'City Center', buildingType: 'city_center', description: 'Place city center - spawns citizens' },
  build_farm: { name: 'Farm', buildingType: 'farm', description: 'Build farm for food production' },
  build_woodcutters_camp: { name: 'Woodcutter', buildingType: 'woodcutters_camp', description: 'Build camp for wood gathering' },
  build_granary: { name: 'Granary', buildingType: 'granary', description: 'Store extra food' },
  build_lumber_mill: { name: 'Lumber Mill', buildingType: 'lumber_mill', description: 'Process wood faster' },
  build_mine: { name: 'Mine', buildingType: 'mine', description: 'Extract metal ore' },
  build_smelter: { name: 'Smelter', buildingType: 'smelter', description: 'Process metal ore' },
  build_market: { name: 'Market', buildingType: 'market', description: 'Generate gold through trade' },
  build_oil_well: { name: 'Oil Well', buildingType: 'oil_well', description: 'Extract oil (requires deposit)' },
  build_refinery: { name: 'Refinery', buildingType: 'refinery', description: 'Process oil' },
  build_library: { name: 'Library', buildingType: 'library', description: 'Research and advance ages' },
  build_university: { name: 'University', buildingType: 'university', description: 'Advanced research' },
  build_temple: { name: 'Temple', buildingType: 'temple', description: 'Cultural bonuses' },
  build_senate: { name: 'Senate', buildingType: 'senate', description: 'Government bonuses' },
  build_barracks: { name: 'Barracks', buildingType: 'barracks', description: 'Train infantry' },
  build_stable: { name: 'Stable', buildingType: 'stable', description: 'Train cavalry' },
  build_siege_factory: { name: 'Siege Factory', buildingType: 'siege_factory', description: 'Build siege weapons' },
  build_dock: { name: 'Dock', buildingType: 'dock', description: 'Build ships' },
  build_auto_plant: { name: 'Auto Plant', buildingType: 'auto_plant', description: 'Build vehicles' },
  build_factory: { name: 'Factory', buildingType: 'factory', description: 'Industrial production' },
  build_airbase: { name: 'Airbase', buildingType: 'airbase', description: 'Build aircraft' },
  build_tower: { name: 'Tower', buildingType: 'tower', description: 'Defensive tower' },
  build_fort: { name: 'Fort', buildingType: 'fort', description: 'Defensive fortification' },
  build_fortress: { name: 'Fortress', buildingType: 'fortress', description: 'Large fortress' },
  build_castle: { name: 'Castle', buildingType: 'castle', description: 'Medieval stronghold' },
  build_bunker: { name: 'Bunker', buildingType: 'bunker', description: 'Modern defense' },
  build_road: { name: 'Road', buildingType: 'road', description: 'Build roads for faster movement' },
};

// Initial game state factory
export function createInitialRoNGameState(
  gridSize: number,
  playerConfigs: Array<{
    name: string;
    type: RoNPlayerType;
    difficulty?: AIDifficulty;
    color: string;
  }>,
  gameName: string = 'Rise of Nations'
): RoNGameState {
  const generateUUID = () => crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

  // Create players
  const players: RoNPlayer[] = playerConfigs.map((config, index) => {
    const exploredTiles: boolean[][] = [];
    const visibleTiles: boolean[][] = [];
    for (let y = 0; y < gridSize; y++) {
      exploredTiles.push(new Array(gridSize).fill(false));
      visibleTiles.push(new Array(gridSize).fill(false));
    }
    
    return {
      id: `player-${index}`,
      name: config.name,
      type: config.type,
      difficulty: config.difficulty,
      color: config.color,
      age: 'ancient' as Age,
      resources: { food: 200, wood: 200, metal: 0, gold: 150, knowledge: 0, oil: 0 },
      resourceRates: { food: 0, wood: 0, metal: 0, gold: 0, knowledge: 0, oil: 0 },
      storageLimits: { food: 500, wood: 500, metal: 300, gold: 1000, knowledge: 500, oil: 200 },
      population: 0,
      populationCap: 10,
      isDefeated: false,
      hasWon: false,
      researchProgress: 0,
      exploredTiles,
      visibleTiles,
    };
  });

  // Create grid with terrain - first pass: all grass
  const grid: RoNTile[][] = [];
  for (let y = 0; y < gridSize; y++) {
    const row: RoNTile[] = [];
    for (let x = 0; x < gridSize; x++) {
      row.push({
        x,
        y,
        terrain: 'grass',
        building: null,
        ownerId: null,
        hasOilDeposit: false,
        hasMetalDeposit: false,
        forestDensity: 0,
      });
    }
    grid.push(row);
  }
  
  // Generate 2-4 lakes using flood-fill growth
  const numLakes = 2 + Math.floor(Math.random() * 3);
  const lakeCenters: { x: number; y: number }[] = [];
  const minDistFromEdge = Math.floor(gridSize * 0.15);
  const minDistBetweenLakes = Math.floor(gridSize * 0.25);
  
  // Find lake centers
  for (let i = 0; i < numLakes; i++) {
    let attempts = 0;
    while (attempts < 50) {
      const x = minDistFromEdge + Math.floor(Math.random() * (gridSize - 2 * minDistFromEdge));
      const y = minDistFromEdge + Math.floor(Math.random() * (gridSize - 2 * minDistFromEdge));
      
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
        lakeCenters.push({ x, y });
        break;
      }
      attempts++;
    }
  }
  
  // Grow each lake using flood-fill
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  
  for (const center of lakeCenters) {
    const targetSize = 15 + Math.floor(Math.random() * 30); // 15-45 tiles per lake
    const lakeTiles: { x: number; y: number }[] = [{ x: center.x, y: center.y }];
    const candidates: { x: number; y: number; dist: number }[] = [];
    
    // Add initial neighbors
    for (const [dx, dy] of directions) {
      const nx = center.x + dx;
      const ny = center.y + dy;
      if (nx >= minDistFromEdge && nx < gridSize - minDistFromEdge &&
          ny >= minDistFromEdge && ny < gridSize - minDistFromEdge) {
        candidates.push({ x: nx, y: ny, dist: Math.sqrt(dx * dx + dy * dy) });
      }
    }
    
    // Grow lake
    while (lakeTiles.length < targetSize && candidates.length > 0) {
      // Sort by distance from center (prefer closer tiles for rounder lakes)
      candidates.sort((a, b) => {
        const distA = Math.sqrt((a.x - center.x) ** 2 + (a.y - center.y) ** 2);
        const distB = Math.sqrt((b.x - center.x) ** 2 + (b.y - center.y) ** 2);
        return distA - distB;
      });
      
      // Pick from top candidates with some randomness
      const pickIndex = Math.floor(Math.random() * Math.min(3, candidates.length));
      const picked = candidates.splice(pickIndex, 1)[0];
      
      // Check if already in lake or already water
      if (lakeTiles.some(t => t.x === picked.x && t.y === picked.y)) continue;
      if (grid[picked.y][picked.x].terrain === 'water') continue;
      
      lakeTiles.push({ x: picked.x, y: picked.y });
      
      // Add new neighbors
      for (const [dx, dy] of directions) {
        const nx = picked.x + dx;
        const ny = picked.y + dy;
        if (nx >= minDistFromEdge && nx < gridSize - minDistFromEdge &&
            ny >= minDistFromEdge && ny < gridSize - minDistFromEdge &&
            !lakeTiles.some(t => t.x === nx && t.y === ny) &&
            !candidates.some(c => c.x === nx && c.y === ny)) {
          candidates.push({ x: nx, y: ny, dist: Math.sqrt((nx - center.x) ** 2 + (ny - center.y) ** 2) });
        }
      }
    }
    
    // Apply lake tiles
    for (const tile of lakeTiles) {
      grid[tile.y][tile.x].terrain = 'water';
    }
  }
  
  // Add forests in clumps (not scattered random tiles)
  const numForests = 5 + Math.floor(Math.random() * 5);
  for (let i = 0; i < numForests; i++) {
    const fx = Math.floor(gridSize * 0.1) + Math.floor(Math.random() * (gridSize * 0.8));
    const fy = Math.floor(gridSize * 0.1) + Math.floor(Math.random() * (gridSize * 0.8));
    const forestSize = 8 + Math.floor(Math.random() * 12); // 8-20 tiles per forest
    
    // Grow forest clump
    const forestTiles: { x: number; y: number }[] = [{ x: fx, y: fy }];
    for (let j = 0; j < forestSize; j++) {
      if (forestTiles.length === 0) break;
      const base = forestTiles[Math.floor(Math.random() * forestTiles.length)];
      const dir = directions[Math.floor(Math.random() * directions.length)];
      const nx = base.x + dir[0];
      const ny = base.y + dir[1];
      
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize &&
          grid[ny][nx].terrain === 'grass' &&
          !forestTiles.some(t => t.x === nx && t.y === ny)) {
        forestTiles.push({ x: nx, y: ny });
        grid[ny][nx].forestDensity = 40 + Math.random() * 60;
      }
    }
  }
  
  // Add oil and metal deposits (only on grass, not in forests)
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      if (tile.terrain === 'grass' && tile.forestDensity === 0) {
        tile.hasOilDeposit = Math.random() < OIL_DEPOSIT_CHANCE;
        tile.hasMetalDeposit = Math.random() < 0.02;
      }
    }
  }

  // Place starting positions for each player
  const startPositions = [
    { x: Math.floor(gridSize * 0.2), y: Math.floor(gridSize * 0.2) },
    { x: Math.floor(gridSize * 0.8), y: Math.floor(gridSize * 0.8) },
    { x: Math.floor(gridSize * 0.2), y: Math.floor(gridSize * 0.8) },
    { x: Math.floor(gridSize * 0.8), y: Math.floor(gridSize * 0.2) },
  ];

  const units: Unit[] = [];

  players.forEach((player, index) => {
    if (index < startPositions.length) {
      const pos = startPositions[index];
      
      // Clear terrain for starting area
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const tx = pos.x + dx;
          const ty = pos.y + dy;
          if (tx >= 0 && tx < gridSize && ty >= 0 && ty < gridSize) {
            grid[ty][tx].terrain = 'grass';
            grid[ty][tx].forestDensity = 0;
            // Reveal starting area
            player.exploredTiles[ty][tx] = true;
            player.visibleTiles[ty][tx] = true;
          }
        }
      }

      // Place starting city center
      grid[pos.y][pos.x].building = {
        type: 'city_center',
        level: 1,
        ownerId: player.id,
        health: 2000,
        maxHealth: 2000,
        constructionProgress: 100,
        queuedUnits: [],
        productionProgress: 0,
        garrisonedUnits: [],
      };
      grid[pos.y][pos.x].ownerId = player.id;
      
      // Place a starting farm near city center
      const farmX = pos.x + 2;
      const farmY = pos.y;
      if (farmX < gridSize && farmY < gridSize) {
        grid[farmY][farmX].building = {
          type: 'farm',
          level: 1,
          ownerId: player.id,
          health: 500,
          maxHealth: 500,
          constructionProgress: 100,
          queuedUnits: [],
          productionProgress: 0,
          garrisonedUnits: [],
        };
        grid[farmY][farmX].ownerId = player.id;
      }

      // Give starting citizens
      for (let i = 0; i < 3; i++) {
        units.push({
          id: `${player.id}-citizen-${i}`,
          type: 'citizen',
          ownerId: player.id,
          x: pos.x + (i - 1) * 0.5,
          y: pos.y + 1,
          health: 30,
          maxHealth: 30,
          isSelected: false,
          isMoving: false,
          task: 'idle',
          attackCooldown: 0,
          lastAttackTime: 0,
        });
      }
      player.population = 3;
    }
  });

  return {
    id: generateUUID(),
    gameName,
    tick: 0,
    gameSpeed: 1,
    grid,
    gridSize,
    players,
    currentPlayerId: players[0]?.id || '',
    units,
    selectedUnitIds: [],
    selectedBuildingPos: null,
    isSelectingArea: false,
    selectionStart: null,
    selectionEnd: null,
    selectedTool: 'select',
    activePanel: 'none',
    cameraOffset: { x: 0, y: 0 },
    zoom: 1,
    gameOver: false,
    winnerId: null,
    builtWonders: [],
  };
}
