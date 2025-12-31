/**
 * Rise of Nations - Game State Types
 */

import { Age } from './ages';
import { Resources, ResourceRates, OIL_DEPOSIT_CHANCE } from './resources';
import { RoNBuilding, RoNBuildingType } from './buildings';
import { Unit, UnitType } from './units';

export type RoNPlayerType = 'human' | 'ai';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

/** Configuration for creating a player */
export interface PlayerConfig {
  name: string;
  type: RoNPlayerType;
  difficulty?: AIDifficulty;
  color: string;
}

// ============================================================================
// GAME CONFIGURATION CONSTANTS
// ============================================================================

/** Number of AI players to include in new games */
export const NUM_AI_PLAYERS = 1;

/** Number of citizens each player starts with */
export const STARTING_CITIZENS = 1;

// AI player color palette
const AI_COLORS = [
  { name: 'AI Red', color: '#ef4444' },
  { name: 'AI Green', color: '#22c55e' },
  { name: 'AI Purple', color: '#a855f7' },
  { name: 'AI Orange', color: '#f97316' },
];

/** Generate default player configs (1 human + NUM_AI_PLAYERS AIs) */
export function generateDefaultPlayerConfigs(): PlayerConfig[] {
  const configs: PlayerConfig[] = [
    { name: 'Player', type: 'human', color: '#3b82f6' },
  ];
  for (let i = 0; i < NUM_AI_PLAYERS && i < AI_COLORS.length; i++) {
    configs.push({
      name: AI_COLORS[i].name,
      type: 'ai',
      difficulty: 'medium',
      color: AI_COLORS[i].color,
    });
  }
  return configs;
}

// ============================================================================

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
  // Elimination timer - tick when player lost their last city (null if they have cities)
  noCitySinceTick: number | null;
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
  hasFishingSpot: boolean;      // Fish can be caught here (water only)
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
  | 'none'
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
  none: { name: 'None', description: 'Default mode - drag to select, right-click to command' },
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
      age: 'classical' as Age,
      resources: { food: 200, wood: 500, metal: 0, gold: 150, knowledge: 0, oil: 0 },
      resourceRates: { food: 0, wood: 0, metal: 0, gold: 0, knowledge: 0, oil: 0 },
      storageLimits: { food: 20000, wood: 15000, metal: 15000, gold: 25000, knowledge: 15000, oil: 10000 },
      population: 0,
      populationCap: 10,
      isDefeated: false,
      hasWon: false,
      noCitySinceTick: null,
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
        hasFishingSpot: false,
      });
    }
    grid.push(row);
  }
  
  // Generate 8-14 lakes using flood-fill growth (lots of water for RoN style maps)
  const numLakes = 8 + Math.floor(Math.random() * 7);
  const lakeCenters: { x: number; y: number }[] = [];
  const minDistFromEdge = Math.floor(gridSize * 0.08);
  const minDistBetweenLakes = Math.floor(gridSize * 0.12);
  
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
    const targetSize = 30 + Math.floor(Math.random() * 50); // 30-80 tiles per lake (larger lakes)
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

  // Generate rivers/streams (winding water paths across the map)
  const numRivers = 4 + Math.floor(Math.random() * 4); // 4-7 rivers
  
  for (let r = 0; r < numRivers; r++) {
    // Rivers can start from edge or from a lake
    const startFromLake = lakeCenters.length > 0 && Math.random() < 0.4;
    let startX: number, startY: number;
    let direction: number; // 0-7 for 8 directions
    
    if (startFromLake) {
      // Start from near a lake
      const lake = lakeCenters[Math.floor(Math.random() * lakeCenters.length)];
      const angle = Math.random() * Math.PI * 2;
      startX = Math.floor(lake.x + Math.cos(angle) * 8);
      startY = Math.floor(lake.y + Math.sin(angle) * 8);
      direction = Math.floor(Math.random() * 8);
    } else {
      // Start from edge
      const edge = Math.floor(Math.random() * 4);
      switch (edge) {
        case 0: // Top edge, flow down
          startX = minDistFromEdge + Math.floor(Math.random() * (gridSize - 2 * minDistFromEdge));
          startY = minDistFromEdge;
          direction = 5 + Math.floor(Math.random() * 3) - 1; // SE, S, SW
          break;
        case 1: // Bottom edge, flow up
          startX = minDistFromEdge + Math.floor(Math.random() * (gridSize - 2 * minDistFromEdge));
          startY = gridSize - minDistFromEdge - 1;
          direction = 1 + Math.floor(Math.random() * 3) - 1; // NE, N, NW
          break;
        case 2: // Left edge, flow right
          startX = minDistFromEdge;
          startY = minDistFromEdge + Math.floor(Math.random() * (gridSize - 2 * minDistFromEdge));
          direction = 2 + Math.floor(Math.random() * 3) - 1; // E variants
          break;
        default: // Right edge, flow left
          startX = gridSize - minDistFromEdge - 1;
          startY = minDistFromEdge + Math.floor(Math.random() * (gridSize - 2 * minDistFromEdge));
          direction = 6 + Math.floor(Math.random() * 3) - 1; // W variants
      }
    }
    
    // Clamp start position
    startX = Math.max(minDistFromEdge, Math.min(gridSize - minDistFromEdge - 1, startX));
    startY = Math.max(minDistFromEdge, Math.min(gridSize - minDistFromEdge - 1, startY));
    
    // River length (20-50 tiles)
    const riverLength = 20 + Math.floor(Math.random() * 31);
    const riverWidth = 2 + Math.floor(Math.random() * 2); // 2-3 tiles wide
    
    // Direction vectors (8 directions)
    const dirVectors = [
      { dx: 0, dy: -1 },  // 0: N
      { dx: 1, dy: -1 },  // 1: NE
      { dx: 1, dy: 0 },   // 2: E
      { dx: 1, dy: 1 },   // 3: SE
      { dx: 0, dy: 1 },   // 4: S
      { dx: -1, dy: 1 },  // 5: SW
      { dx: -1, dy: 0 },  // 6: W
      { dx: -1, dy: -1 }, // 7: NW
    ];
    
    let x = startX;
    let y = startY;
    
    let prevX = startX;
    let prevY = startY;
    
    for (let step = 0; step < riverLength; step++) {
      // Mark current tile and width as water
      for (let w = 0; w < riverWidth; w++) {
        // Perpendicular offset for river width
        const perpDir = (direction + 2) % 8;
        const perpVec = dirVectors[perpDir];
        const wx = x + perpVec.dx * w;
        const wy = y + perpVec.dy * w;
        
        if (wx >= 0 && wx < gridSize && wy >= 0 && wy < gridSize) {
          grid[wy][wx].terrain = 'water';
          grid[wy][wx].forestDensity = 0;
          grid[wy][wx].hasMetalDeposit = false;
          grid[wy][wx].hasOilDeposit = false;
        }
      }
      
      // Fill in diagonal gaps to ensure river connectivity
      if (step > 0 && prevX !== x && prevY !== y) {
        // Diagonal move - fill the two adjacent tiles to prevent gaps
        if (x >= 0 && x < gridSize && prevY >= 0 && prevY < gridSize) {
          grid[prevY][x].terrain = 'water';
          grid[prevY][x].forestDensity = 0;
        }
        if (prevX >= 0 && prevX < gridSize && y >= 0 && y < gridSize) {
          grid[y][prevX].terrain = 'water';
          grid[y][prevX].forestDensity = 0;
        }
      }
      
      prevX = x;
      prevY = y;
      
      // Move in current direction
      const vec = dirVectors[direction];
      x += vec.dx;
      y += vec.dy;
      
      // Check bounds
      if (x < minDistFromEdge || x >= gridSize - minDistFromEdge ||
          y < minDistFromEdge || y >= gridSize - minDistFromEdge) {
        break;
      }
      
      // Randomly meander (change direction slightly)
      if (Math.random() < 0.3) {
        // Turn left or right by 1 step
        direction = (direction + (Math.random() < 0.5 ? 1 : 7)) % 8;
      }
      
      // Occasionally widen at bends
      if (Math.random() < 0.1 && riverWidth < 3) {
        // Add a pool/widening
        for (let poolDx = -1; poolDx <= 1; poolDx++) {
          for (let poolDy = -1; poolDy <= 1; poolDy++) {
            const px = x + poolDx;
            const py = y + poolDy;
            if (px >= 0 && px < gridSize && py >= 0 && py < gridSize && Math.random() < 0.6) {
              grid[py][px].terrain = 'water';
              grid[py][px].forestDensity = 0;
            }
          }
        }
      }
      
      // Stop if we hit an existing lake
      if (grid[y]?.[x]?.terrain === 'water') {
        // Continue a bit into the lake for natural connection
        for (let extra = 0; extra < 3; extra++) {
          x += vec.dx;
          y += vec.dy;
          if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            grid[y][x].terrain = 'water';
          }
        }
        break;
      }
    }
  }

  // Add forests in clumps (not scattered random tiles) - lots of forests for RoN style maps
  const numForests = 36 + Math.floor(Math.random() * 20); // 36-56 forest clumps (2x more)
  for (let i = 0; i < numForests; i++) {
    const fx = Math.floor(gridSize * 0.05) + Math.floor(Math.random() * (gridSize * 0.90));
    const fy = Math.floor(gridSize * 0.05) + Math.floor(Math.random() * (gridSize * 0.90));
    const forestSize = 15 + Math.floor(Math.random() * 25); // 15-40 tiles per forest
    
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
  
  // Generate 15-25 metal deposit clusters (mountain ranges) - lots of mountains for RoN style maps
  const numMetalClusters = 15 + Math.floor(Math.random() * 11); // 50% more metal
  for (let c = 0; c < numMetalClusters; c++) {
    // Find a valid starting point for metal cluster
    let attempts = 0;
    let startX = -1, startY = -1;

    while (attempts < 50) {
      const x = minDistFromEdge + Math.floor(Math.random() * (gridSize - 2 * minDistFromEdge));
      const y = minDistFromEdge + Math.floor(Math.random() * (gridSize - 2 * minDistFromEdge));
      
      // Check if valid (grass, no forest, not too close to lake centers or other features)
      if (grid[y][x].terrain === 'grass' && 
          grid[y][x].forestDensity === 0 &&
          !lakeCenters.some(lc => Math.abs(lc.x - x) + Math.abs(lc.y - y) < 5)) {
        startX = x;
        startY = y;
        break;
      }
      attempts++;
    }
    
    if (startX === -1) continue;
    
    // Grow the metal cluster (8-20 tiles) - larger mountain ranges
    const clusterTiles: { x: number; y: number }[] = [{ x: startX, y: startY }];
    const clusterSize = 8 + Math.floor(Math.random() * 13);
    
    for (let i = 1; i < clusterSize; i++) {
      if (clusterTiles.length === 0) break;
      const base = clusterTiles[Math.floor(Math.random() * clusterTiles.length)];
      const dir = directions[Math.floor(Math.random() * directions.length)];
      const nx = base.x + dir[0];
      const ny = base.y + dir[1];
      
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize &&
          grid[ny][nx].terrain === 'grass' &&
          grid[ny][nx].forestDensity === 0 &&
          !clusterTiles.some(t => t.x === nx && t.y === ny)) {
        clusterTiles.push({ x: nx, y: ny });
      }
    }
    
    // Mark all cluster tiles as having metal deposits
    for (const tile of clusterTiles) {
      grid[tile.y][tile.x].hasMetalDeposit = true;
    }
  }
  
  // Add oil deposits (scattered, only on grass without forests or metal)
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      if (tile.terrain === 'grass' && tile.forestDensity === 0 && !tile.hasMetalDeposit) {
        tile.hasOilDeposit = Math.random() < OIL_DEPOSIT_CHANCE;
      }
    }
  }

  // Add fishing spots in water (clustered near shores and in open water)
  const FISHING_SPOT_CHANCE = 0.08; // 8% of water tiles have fishing spots
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      if (tile.terrain === 'water') {
        // Higher chance near shore (adjacent to land)
        let isNearShore = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
              if (grid[ny][nx].terrain !== 'water') {
                isNearShore = true;
                break;
              }
            }
          }
          if (isNearShore) break;
        }
        // 15% chance near shore, 5% in open water
        const chance = isNearShore ? 0.15 : 0.05;
        tile.hasFishingSpot = Math.random() < chance;
      }
    }
  }

  // Place starting positions for each player (supports up to 5 players)
  // Positions are set so territory radius (24 tiles) doesn't clip at map edges
  // With radius 24, positions should be at least 25 tiles from edges
  // margin = 0.18 on a 160 map = ~29 tiles from edge, positions ~100 tiles apart
  const margin = 0.18; // Spread players out more
  const startPositions = [
    { x: Math.floor(gridSize * margin), y: Math.floor(gridSize * margin) },           // Top-left
    { x: Math.floor(gridSize * (1 - margin)), y: Math.floor(gridSize * (1 - margin)) }, // Bottom-right
    { x: Math.floor(gridSize * margin), y: Math.floor(gridSize * (1 - margin)) },       // Bottom-left
    { x: Math.floor(gridSize * (1 - margin)), y: Math.floor(gridSize * margin) },       // Top-right
    { x: Math.floor(gridSize * 0.5), y: Math.floor(gridSize * 0.5) },                   // Center
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
      
      // Place a starting farm near city center - find valid grass tile
      // Try several offsets to find a valid location
      const farmOffsets = [
        { dx: 4, dy: 0 },
        { dx: 4, dy: 1 },
        { dx: 4, dy: -1 },
        { dx: 3, dy: 2 },
        { dx: 3, dy: -2 },
        { dx: 0, dy: 4 },
        { dx: 1, dy: 4 },
        { dx: -1, dy: 4 },
      ];
      
      for (const offset of farmOffsets) {
        const farmX = pos.x + offset.dx;
        const farmY = pos.y + offset.dy;
        
        // Check bounds and valid terrain (grass, no water, no forest, no metal, no existing building)
        if (farmX >= 0 && farmX < gridSize && farmY >= 0 && farmY < gridSize) {
          const farmTile = grid[farmY][farmX];
          if (farmTile.terrain === 'grass' && 
              !farmTile.building && 
              farmTile.forestDensity === 0 && 
              !farmTile.hasMetalDeposit) {
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
            break; // Found valid spot, stop searching
          }
        }
      }

      // GUARANTEE resources near each starting position so all players have equal opportunity
      // Place a small forest cluster nearby
      const forestOffsets = [
        { dx: -6, dy: -4 }, { dx: -5, dy: -4 }, { dx: -6, dy: -3 },
        { dx: -5, dy: -3 }, { dx: -4, dy: -3 },
      ];
      for (const offset of forestOffsets) {
        const fx = pos.x + offset.dx;
        const fy = pos.y + offset.dy;
        if (fx >= 0 && fx < gridSize && fy >= 0 && fy < gridSize) {
          const tile = grid[fy][fx];
          if (tile.terrain === 'grass' && !tile.building && !tile.hasMetalDeposit) {
            tile.forestDensity = 60 + Math.random() * 40;
          }
        }
      }
      
      // Place a metal deposit nearby
      const metalOffsets = [
        { dx: 6, dy: -4 }, { dx: 7, dy: -4 }, { dx: 6, dy: -3 },
      ];
      for (const offset of metalOffsets) {
        const mx = pos.x + offset.dx;
        const my = pos.y + offset.dy;
        if (mx >= 0 && mx < gridSize && my >= 0 && my < gridSize) {
          const tile = grid[my][mx];
          if (tile.terrain === 'grass' && !tile.building && tile.forestDensity === 0) {
            tile.hasMetalDeposit = true;
          }
        }
      }

      // Give starting citizens
      for (let i = 0; i < STARTING_CITIZENS; i++) {
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
          attackCooldown: 10, // Initial cooldown before first attack
          lastAttackTime: 0,
          isAttacking: false,
        });
      }
      player.population = STARTING_CITIZENS;
    }
  });

  return {
    id: generateUUID(),
    gameName,
    tick: 0,
    gameSpeed: 3,
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
    selectedTool: 'none',
    activePanel: 'none',
    cameraOffset: { x: 0, y: 0 },
    zoom: 1,
    gameOver: false,
    winnerId: null,
    builtWonders: [],
  };
}
