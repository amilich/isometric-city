// Bridge detection and creation logic

import {
  GameState,
  Tile,
  Building,
  BuildingType,
  BridgeType,
  BridgeOrientation,
} from '@/types/game';

/** Maximum width of water a bridge can span */
const MAX_BRIDGE_SPAN = 10;

/** Bridge type thresholds based on span width */
const BRIDGE_TYPE_THRESHOLDS = {
  large: 5,    // 1-5 tiles = truss bridge
  suspension: 10, // 6-10 tiles = suspension bridge
} as const;

/** Get the appropriate bridge type for a given span */
function getBridgeTypeForSpan(span: number): BridgeType {
  // 1-tile bridges are simple bridges without trusses
  if (span === 1) return 'small';
  if (span <= BRIDGE_TYPE_THRESHOLDS.large) return 'large';
  return 'suspension';
}

/** Number of variants per bridge type */
const BRIDGE_VARIANTS: Record<BridgeType, number> = {
  small: 3,
  medium: 3,
  large: 2,
  suspension: 2,
};

/** Generate a deterministic variant based on position */
function getBridgeVariant(x: number, y: number, bridgeType: BridgeType): number {
  const seed = (x * 31 + y * 17) % 100;
  return seed % BRIDGE_VARIANTS[bridgeType];
}

/** Create a bridge building with all metadata */
function createBridgeBuilding(
  bridgeType: BridgeType,
  orientation: BridgeOrientation,
  variant: number,
  position: 'start' | 'middle' | 'end',
  index: number,
  span: number,
  trackType: 'road' | 'rail' = 'road'
): Building {
  return {
    type: 'bridge',
    level: 0,
    population: 0,
    jobs: 0,
    powered: true,
    watered: true,
    onFire: false,
    fireProgress: 0,
    age: 0,
    constructionProgress: 100,
    abandoned: false,
    bridgeType,
    bridgeOrientation: orientation,
    bridgeVariant: variant,
    bridgePosition: position,
    bridgeIndex: index,
    bridgeSpan: span,
    bridgeTrackType: trackType,
  };
}

/** Check if a tile at position is water */
function isWaterTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'water';
}

/** Bridge opportunity data */
interface BridgeOpportunity {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  orientation: BridgeOrientation;
  span: number;
  bridgeType: BridgeType;
  waterTiles: { x: number; y: number }[];
  trackType: 'road' | 'rail'; // What the bridge carries
}

/** Scan for a bridge opportunity in a specific direction */
function scanForBridgeInDirection(
  grid: Tile[][],
  gridSize: number,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  orientation: BridgeOrientation,
  trackType: 'road' | 'rail'
): BridgeOpportunity | null {
  const waterTiles: { x: number; y: number }[] = [];
  let x = startX + dx;
  let y = startY + dy;
  
  // Count consecutive water tiles
  while (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
    const tile = grid[y][x];
    
    if (tile.building.type === 'water') {
      waterTiles.push({ x, y });
      
      // Check if we've exceeded max bridge span
      if (waterTiles.length > MAX_BRIDGE_SPAN) {
        return null; // Too wide to bridge
      }
    } else if (tile.building.type === trackType) {
      // Found the same track type on the other side - valid bridge opportunity!
      // Note: We only connect to the same track type, NOT to bridges
      // This prevents creating spurious bridges when placing tracks near existing bridges
      if (waterTiles.length > 0) {
        const span = waterTiles.length;
        const bridgeType = getBridgeTypeForSpan(span);
        
        return {
          startX,
          startY,
          endX: x,
          endY: y,
          orientation,
          span,
          bridgeType,
          waterTiles,
          trackType,
        };
      }
      return null;
    } else if (tile.building.type === 'bridge') {
      // Found a bridge - don't create another bridge connecting to it
      return null;
    } else {
      // Found land that's not the same track type - no bridge possible in this direction
      break;
    }
    
    x += dx;
    y += dy;
  }
  
  return null;
}

/** Detect if placing a road or rail creates a bridge opportunity from this tile */
function detectBridgeOpportunity(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number,
  trackType: 'road' | 'rail'
): BridgeOpportunity | null {
  const tile = grid[y]?.[x];
  if (!tile) return null;
  
  // Only check from the specified track type tiles, not bridges
  // Bridges should only be created when dragging across water to another tile of the same type
  if (tile.building.type !== trackType) {
    return null;
  }
  
  // Check each direction for water followed by same track type
  // North (x-1, y stays same in grid coords)
  const northOpp = scanForBridgeInDirection(grid, gridSize, x, y, -1, 0, 'ns', trackType);
  if (northOpp) return northOpp;
  
  // South (x+1, y stays same)
  const southOpp = scanForBridgeInDirection(grid, gridSize, x, y, 1, 0, 'ns', trackType);
  if (southOpp) return southOpp;
  
  // East (x stays, y-1)
  const eastOpp = scanForBridgeInDirection(grid, gridSize, x, y, 0, -1, 'ew', trackType);
  if (eastOpp) return eastOpp;
  
  // West (x stays, y+1)
  const westOpp = scanForBridgeInDirection(grid, gridSize, x, y, 0, 1, 'ew', trackType);
  if (westOpp) return westOpp;
  
  return null;
}

/** Build bridges by converting water tiles to bridge tiles */
function buildBridges(
  grid: Tile[][],
  opportunity: BridgeOpportunity
): void {
  const variant = getBridgeVariant(
    opportunity.waterTiles[0].x,
    opportunity.waterTiles[0].y,
    opportunity.bridgeType
  );
  
  // Sort waterTiles consistently to ensure same result regardless of scan direction
  // For NS orientation (bridges going NW-SE on screen): sort by x first (grid row), then by y
  // For EW orientation (bridges going NE-SW on screen): sort by y first (grid column), then by x
  // This ensures 'start' is always at the NW/NE end and 'end' at the SE/SW end
  const sortedTiles = [...opportunity.waterTiles].sort((a, b) => {
    if (opportunity.orientation === 'ns') {
      // NS bridges: sort by x first (lower x = more NW on screen)
      return a.x !== b.x ? a.x - b.x : a.y - b.y;
    } else {
      // EW bridges: sort by y first (lower y = more NE on screen)
      return a.y !== b.y ? a.y - b.y : a.x - b.x;
    }
  });
  
  const span = sortedTiles.length;
  sortedTiles.forEach((pos, index) => {
    let position: 'start' | 'middle' | 'end';
    if (index === 0) {
      position = 'start';
    } else if (index === sortedTiles.length - 1) {
      position = 'end';
    } else {
      position = 'middle';
    }
    
    grid[pos.y][pos.x].building = createBridgeBuilding(
      opportunity.bridgeType,
      opportunity.orientation,
      variant,
      position,
      index,
      span,
      opportunity.trackType
    );
    // Keep the tile as having no zone
    grid[pos.y][pos.x].zone = 'none';
  });
}

/** Check and create bridges after road or rail placement */
export function checkAndCreateBridges(
  grid: Tile[][],
  gridSize: number,
  placedX: number,
  placedY: number,
  trackType: 'road' | 'rail'
): void {
  // Check for bridge opportunities from the placed tile
  const opportunity = detectBridgeOpportunity(grid, gridSize, placedX, placedY, trackType);
  if (opportunity) {
    buildBridges(grid, opportunity);
  }
}

/**
 * Create bridges along a road or rail drag path.
 * This is called after a road/rail drag operation completes to create bridges
 * for any valid water crossings in the path.
 * 
 * IMPORTANT: Bridges are only created if the drag path actually crosses water.
 * This prevents auto-creating bridges when placing individual tiles on
 * opposite sides of water.
 * 
 * @param state - Current game state
 * @param pathTiles - Array of {x, y} coordinates that were part of the drag
 * @param trackType - Whether this is a 'road' or 'rail' bridge
 * @returns Updated game state with bridges created
 */
export function createBridgesOnPath(
  state: GameState,
  pathTiles: { x: number; y: number }[],
  trackType: 'road' | 'rail' = 'road'
): GameState {
  if (pathTiles.length === 0) return state;
  
  // Check if the drag path includes any water tiles
  // This ensures bridges are only created when actually dragging ACROSS water
  const hasWaterInPath = pathTiles.some(tile => {
    const t = state.grid[tile.y]?.[tile.x];
    return t && t.building.type === 'water';
  });
  
  // If no water tiles were crossed, don't create any bridges
  if (!hasWaterInPath) {
    return state;
  }
  
  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  
  // Check each tile of the specified track type in the path for bridge opportunities
  for (const tile of pathTiles) {
    // Only check from actual track type tiles (not water or other types)
    if (newGrid[tile.y]?.[tile.x]?.building.type === trackType) {
      checkAndCreateBridges(newGrid, state.gridSize, tile.x, tile.y, trackType);
    }
  }
  
  return { ...state, grid: newGrid };
}

/**
 * Find all bridge tiles that are part of the same bridge as the tile at (x, y).
 * Bridges are connected along their orientation axis (ns or ew).
 */
export function findConnectedBridgeTiles(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): { x: number; y: number }[] {
  const tile = grid[y]?.[x];
  if (!tile || tile.building.type !== 'bridge') return [];
  
  const orientation = tile.building.bridgeOrientation || 'ns';
  const bridgeTiles: { x: number; y: number }[] = [{ x, y }];
  
  // Direction vectors based on orientation
  // NS bridges run along the x-axis (grid rows)
  // EW bridges run along the y-axis (grid columns)
  const dx = orientation === 'ns' ? 1 : 0;
  const dy = orientation === 'ns' ? 0 : 1;
  
  // Scan in positive direction
  let cx = x + dx;
  let cy = y + dy;
  while (cx >= 0 && cx < gridSize && cy >= 0 && cy < gridSize) {
    const t = grid[cy][cx];
    if (t.building.type === 'bridge' && t.building.bridgeOrientation === orientation) {
      bridgeTiles.push({ x: cx, y: cy });
      cx += dx;
      cy += dy;
    } else {
      break;
    }
  }
  
  // Scan in negative direction
  cx = x - dx;
  cy = y - dy;
  while (cx >= 0 && cx < gridSize && cy >= 0 && cy < gridSize) {
    const t = grid[cy][cx];
    if (t.building.type === 'bridge' && t.building.bridgeOrientation === orientation) {
      bridgeTiles.push({ x: cx, y: cy });
      cx -= dx;
      cy -= dy;
    } else {
      break;
    }
  }
  
  return bridgeTiles;
}

/**
 * Check if a road tile at (x, y) is adjacent to a bridge start/end tile.
 * If so, return all the bridge tiles that should be deleted.
 */
export function findAdjacentBridgeTiles(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): { x: number; y: number }[] {
  const directions = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];
  
  for (const { dx, dy } of directions) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
      const neighbor = grid[ny][nx];
      if (neighbor.building.type === 'bridge') {
        const position = neighbor.building.bridgePosition;
        // Check if this bridge tile is a start or end connected to our road
        if (position === 'start' || position === 'end') {
          return findConnectedBridgeTiles(grid, gridSize, nx, ny);
        }
      }
    }
  }
  
  return [];
}
