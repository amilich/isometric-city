# Road and Utilities Implementation Research

## Executive Summary

This document provides a comprehensive analysis of how roads and utilities (health, education, security, power, water) are currently implemented in the isometric-city codebase. The research identifies existing infrastructure, service coverage mechanisms, road connectivity checks, and overlay visualization systems. This foundation will inform the implementation of road-connected-services requirements.

---

## 1. Road System Implementation

### 1.1 Road Data Structure

Roads are represented as a building type in the game grid:

- **Type**: `BuildingType = 'road'` (defined in `src/types/game.ts`)
- **Storage**: Roads are stored in the `Tile.building.type` field, same as other buildings
- **Grid Position**: Each road occupies a single tile in the isometric grid
- **Cost**: 25 credits (defined in `TOOL_INFO` in `src/types/game.ts`)

### 1.2 Road Placement Logic

Road placement is handled in `src/lib/simulation.ts` in the `placeBuilding` function:

```632:678:src/lib/simulation.ts
export function getRoadAdjacency(
  grid: Tile[][],
  x: number,
  y: number,
  width: number,
  height: number,
  gridSize: number
): { hasRoad: boolean; shouldFlip: boolean } {
  // In isometric view (looking from SE toward NW):
  // - The default sprite faces toward the "front" (south-east in world coords)
  // - To face the opposite direction, we flip horizontally
  
  // Check all four edges and track which sides have roads
  let roadOnSouthOrEast = false; // "Front" sides - no flip needed
  let roadOnNorthOrWest = false; // "Back" sides - flip needed
  
  // Check south edge (y + height) - front-right in isometric view
  for (let dx = 0; dx < width; dx++) {
    const checkX = x + dx;
    const checkY = y + height;
    if (checkY < gridSize && grid[checkY]?.[checkX]?.building.type === 'road') {
      roadOnSouthOrEast = true;
      break;
    }
  }
  
  // Check east edge (x + width) - front-left in isometric view
  if (!roadOnSouthOrEast) {
    for (let dy = 0; dy < height; dy++) {
      const checkX = x + width;
      const checkY = y + dy;
      if (checkX < gridSize && grid[checkY]?.[checkX]?.building.type === 'road') {
        roadOnSouthOrEast = true;
        break;
      }
    }
  }
  
  // Check north edge (y - 1) - back-left in isometric view
  for (let dx = 0; dx < width; dx++) {
    const checkX = x + dx;
    const checkY = y - 1;
    if (checkY >= 0 && grid[checkY]?.[checkX]?.building.type === 'road') {
      roadOnNorthOrWest = true;
      break;
    }
  }
  
  // Check west edge (x - 1) - back-right in isometric view
  if (!roadOnNorthOrWest) {
```

**Key Placement Rules:**
- Roads can be placed on: `grass`, `tree`, `road` (upgrade), or `rail` (creates combined tile)
- Roads cannot be placed on existing buildings (except the above types)
- Roads can be combined with rails (creates `hasRailOverlay` flag)
- No special validation for road connectivity during placement

### 1.3 Road Adjacency Detection

The system tracks which directions have connected roads for rendering purposes:

**Location**: `src/components/game/trafficSystem.ts`

```109:121:src/components/game/trafficSystem.ts
export function getAdjacentRoads(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): { north: boolean; east: boolean; south: boolean; west: boolean } {
  return {
    north: isRoad(grid, gridSize, x - 1, y),
    east: isRoad(grid, gridSize, x, y - 1),
    south: isRoad(grid, gridSize, x + 1, y),
    west: isRoad(grid, gridSize, x, y + 1),
  };
}
```

**Note**: The coordinate system uses isometric mapping:
- `north` = `x - 1, y` (top-left in isometric view)
- `east` = `x, y - 1` (top-right in isometric view)
- `south` = `x + 1, y` (bottom-right in isometric view)
- `west` = `x, y + 1` (bottom-left in isometric view)

### 1.4 Road Rendering

Roads are rendered with adaptive visual connections:

**Location**: `src/components/buildings/IsometricBuildings.tsx`

- Roads adapt their visual appearance based on adjacent roads
- Uses `RoadAdjacency` interface to determine which edges to draw
- Roads render as diamond-shaped tiles with connecting segments
- Supports merged roads (avenues/highways) with multiple lanes

**Location**: `src/components/game/CanvasIsometricGrid.tsx`

```2740:2763:src/components/game/CanvasIsometricGrid.tsx
    // Draw roads (above water, needs full redraw including base tile)
    insertionSortByDepth(roadQueue);
    // PERF: Use for loop instead of forEach
    for (let i = 0; i < roadQueue.length; i++) {
      const { tile, screenX, screenY } = roadQueue[i];
      // Draw road base tile first (grey diamond)
      ctx.fillStyle = '#4a4a4a';
      ctx.beginPath();
      ctx.moveTo(screenX + halfTileWidth, screenY);
      ctx.lineTo(screenX + tileWidth, screenY + halfTileHeight);
      ctx.lineTo(screenX + halfTileWidth, screenY + tileHeight);
      ctx.lineTo(screenX, screenY + halfTileHeight);
      ctx.closePath();
      ctx.fill();
      
      // Draw road markings and sidewalks
      drawBuilding(ctx, screenX, screenY, tile);
      
      // If this road has a rail overlay, draw just the rail tracks (ties and rails, no ballast)
      // Crossing signals/gates are drawn later (after rail tiles) to avoid z-order issues
      if (tile.hasRailOverlay) {
        drawRailTracksOnly(ctx, screenX, screenY, tile.x, tile.y, grid, gridSize, zoom);
      }
    }
```

### 1.5 Road Access Checking

**Critical Function**: `hasRoadAccess` in `src/lib/simulation.ts`

This function checks if a tile has road access using BFS (Breadth-First Search):

```994:1065:src/lib/simulation.ts
function hasRoadAccess(
  grid: Tile[][],
  x: number,
  y: number,
  size: number,
  maxDistance: number = 8
): boolean {
  const startZone = grid[y][x].zone;
  if (startZone === 'none') {
    return false;
  }

  // PERF: Use typed array for visited flags instead of Set<string>
  // Clear only the area we'll actually use (maxDistance radius)
  const minClearX = Math.max(0, x - maxDistance);
  const maxClearX = Math.min(size - 1, x + maxDistance);
  const minClearY = Math.max(0, y - maxDistance);
  const maxClearY = Math.min(size - 1, y + maxDistance);
  for (let cy = minClearY; cy <= maxClearY; cy++) {
    for (let cx = minClearX; cx <= maxClearX; cx++) {
      roadAccessVisited[cy * size + cx] = 0;
    }
  }

  // BFS using flat queue array [x0, y0, dist0, x1, y1, dist1, ...]
  let queueHead = 0;
  let queueTail = 3;
  roadAccessQueue[0] = x;
  roadAccessQueue[1] = y;
  roadAccessQueue[2] = 0;
  roadAccessVisited[y * size + x] = 1;

  while (queueHead < queueTail) {
    const cx = roadAccessQueue[queueHead];
    const cy = roadAccessQueue[queueHead + 1];
    const dist = roadAccessQueue[queueHead + 2];
    queueHead += 3;
    
    if (dist >= maxDistance) {
      continue;
    }

    // Check all 4 directions: [-1,0], [1,0], [0,-1], [0,1]
    const neighbors = [
      [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]
    ];
    
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

      const idx = ny * size + nx;
      if (roadAccessVisited[idx]) continue;
      roadAccessVisited[idx] = 1;

      const neighbor = grid[ny][nx];

      if (neighbor.building.type === 'road') {
        return true;
      }

      const isPassableZone = neighbor.zone === startZone && neighbor.building.type !== 'water';
      if (isPassableZone && queueTail < roadAccessQueue.length - 3) {
        roadAccessQueue[queueTail] = nx;
        roadAccessQueue[queueTail + 1] = ny;
        roadAccessQueue[queueTail + 2] = dist + 1;
        queueTail += 3;
      }
    }
  }

  return false;
}
```

**Key Characteristics:**
- Uses BFS to find roads within `maxDistance` (default: 8 tiles)
- Only searches through tiles in the same zone
- Returns `true` if any road is found within the search radius
- Currently used for **zoned building development** (residential/commercial/industrial)
- **NOT currently used for service building validation**

### 1.6 Road Pathfinding

For vehicle systems, there's a more sophisticated pathfinding system:

**Location**: `src/components/game/utils.ts`

```169:278:src/components/game/utils.ts
// BFS pathfinding on road network - finds path from start to a tile adjacent to target
// PERF: Uses pre-allocated typed arrays to avoid GC pressure from path copying
export function findPathOnRoads(
  gridData: Tile[][],
  gridSizeValue: number,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number
): { x: number; y: number }[] | null {
  // Find the nearest road tile to the target (since buildings aren't on roads)
  const targetRoad = findNearestRoadToBuilding(gridData, gridSizeValue, targetX, targetY);
  if (!targetRoad) return null;
  
  // Find the nearest road tile to the start (station)
  const startRoad = findNearestRoadToBuilding(gridData, gridSizeValue, startX, startY);
  if (!startRoad) return null;
  
  // If start and target roads are the same, return a simple path
  if (startRoad.x === startRoad.x && startRoad.y === startRoad.y) {
    return [{ x: startRoad.x, y: startRoad.y }];
  }
  
  // PERF: Clear visited array only for the area we need (faster than full clear)
  // Using numeric keys: index = y * gridSize + x
  const maxIdx = gridSizeValue * gridSizeValue;
  if (maxIdx > BFS_VISITED.length) {
    // Fallback to old method for very large grids
    return findPathOnRoadsLegacy(gridData, gridSizeValue, startRoad, targetRoad);
  }
  
  // Clear visited (only the portion we'll use)
  for (let i = 0; i < maxIdx; i++) {
    BFS_VISITED[i] = 0;
  }
  
  // BFS using pre-allocated arrays
  let queueHead = 0;
  let queueTail = 1;
  BFS_QUEUE_X[0] = startRoad.x;
  BFS_QUEUE_Y[0] = startRoad.y;
  BFS_PARENT_X[0] = -1; // -1 indicates start node
  BFS_PARENT_Y[0] = -1;
  BFS_VISITED[startRoad.y * gridSizeValue + startRoad.x] = 1;
  
  // Direction offsets
  const DX = [-1, 1, 0, 0];
  const DY = [0, 0, -1, 1];
  
  let foundIdx = -1;
  
  while (queueHead < queueTail && queueTail < MAX_PATH_LENGTH) {
```

This is used for vehicle routing, not for service building validation.

---

## 2. Utilities Implementation

### 2.1 Service Building Types

Service buildings are defined in `src/lib/simulation.ts`:

```844:860:src/lib/simulation.ts
// Service building configuration - defined once, reused across calls
// Exported so overlay rendering can access radii
export const SERVICE_CONFIG = {
  police_station: { range: 13, rangeSquared: 169, type: 'police' as const },
  fire_station: { range: 18, rangeSquared: 324, type: 'fire' as const },
  hospital: { range: 12, rangeSquared: 144, type: 'health' as const },
  school: { range: 11, rangeSquared: 121, type: 'education' as const },
  university: { range: 19, rangeSquared: 361, type: 'education' as const },
  power_plant: { range: 15, rangeSquared: 225 },
  water_tower: { range: 12, rangeSquared: 144 },
} as const;

// Building types that provide services
const SERVICE_BUILDING_TYPES = new Set([
  'police_station', 'fire_station', 'hospital', 'school', 'university',
  'power_plant', 'water_tower'
]);
```

**Service Categories:**
1. **Power**: `power_plant` (range: 15 tiles)
2. **Water**: `water_tower` (range: 12 tiles)
3. **Security**: `police_station` (range: 13 tiles)
4. **Fire Safety**: `fire_station` (range: 18 tiles)
5. **Health**: `hospital` (range: 12 tiles)
6. **Education**: `school` (range: 11 tiles), `university` (range: 19 tiles)

### 2.2 Service Coverage Calculation

**Location**: `src/lib/simulation.ts` - `calculateServiceCoverage` function

```862:951:src/lib/simulation.ts
// Calculate service coverage from service buildings - optimized version
function calculateServiceCoverage(grid: Tile[][], size: number): ServiceCoverage {
  const services = createServiceCoverage(size);
  
  // First pass: collect all service building positions (much faster than checking every tile)
  const serviceBuildings: Array<{ x: number; y: number; type: BuildingType }> = [];
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = grid[y][x];
      const buildingType = tile.building.type;
      
      // Quick check if this is a service building
      if (!SERVICE_BUILDING_TYPES.has(buildingType)) continue;
      
      // Skip buildings under construction
      if (tile.building.constructionProgress !== undefined && tile.building.constructionProgress < 100) {
        continue;
      }
      
      // Skip abandoned buildings
      if (tile.building.abandoned) {
        continue;
      }
      
      serviceBuildings.push({ x, y, type: buildingType });
    }
  }
  
  // Second pass: apply coverage for each service building
  for (const building of serviceBuildings) {
    const { x, y, type } = building;
    const config = SERVICE_CONFIG[type as keyof typeof SERVICE_CONFIG];
    if (!config) continue;
    
    const range = config.range;
    const rangeSquared = config.rangeSquared;
    
    // Calculate bounds to avoid checking tiles outside the grid
    const minY = Math.max(0, y - range);
    const maxY = Math.min(size - 1, y + range);
    const minX = Math.max(0, x - range);
    const maxX = Math.min(size - 1, x + range);
    
    // Handle power and water (boolean coverage)
    if (type === 'power_plant') {
      for (let ny = minY; ny <= maxY; ny++) {
        for (let nx = minX; nx <= maxX; nx++) {
          const dx = nx - x;
          const dy = ny - y;
          // Use squared distance comparison (avoid Math.sqrt)
          if (dx * dx + dy * dy <= rangeSquared) {
            services.power[ny][nx] = true;
          }
        }
      }
    } else if (type === 'water_tower') {
      for (let ny = minY; ny <= maxY; ny++) {
        for (let nx = minX; nx <= maxX; nx++) {
          const dx = nx - x;
          const dy = ny - y;
          if (dx * dx + dy * dy <= rangeSquared) {
            services.water[ny][nx] = true;
          }
        }
      }
    } else {
      // Handle percentage-based coverage (police, fire, health, education)
      const serviceType = (config as { type: 'police' | 'fire' | 'health' | 'education' }).type;
      const currentCoverage = services[serviceType] as number[][];
      
      for (let ny = minY; ny <= maxY; ny++) {
        for (let nx = minX; nx <= maxX; nx++) {
          const dx = nx - x;
          const dy = ny - y;
          const distSquared = dx * dx + dy * dy;
          
          if (distSquared <= rangeSquared) {
            // Only compute sqrt when we need the actual distance for coverage falloff
            const distance = Math.sqrt(distSquared);
            const coverage = Math.max(0, (1 - distance / range) * 100);
            currentCoverage[ny][nx] = Math.min(100, currentCoverage[ny][nx] + coverage);
          }
        }
      }
    }
  }

  return services;
}
```

**Key Characteristics:**
- **Two-pass algorithm**: First collects service buildings, then applies coverage
- **Power/Water**: Boolean coverage (true/false)
- **Other Services**: Percentage-based coverage (0-100%) with distance falloff
- **Distance Calculation**: Uses Euclidean distance with squared comparisons for performance
- **Coverage Falloff**: Linear falloff from 100% at building to 0% at range edge
- **Multiple Buildings**: Coverage values are additive (capped at 100%)
- **Construction State**: Buildings under construction don't provide coverage
- **Abandoned Buildings**: Abandoned buildings don't provide coverage

**Current Limitations:**
- **No road connectivity check**: Service buildings provide coverage regardless of road connection
- **No validation on placement**: Service buildings can be placed anywhere (except water)
- **No inactive state**: Service buildings always provide coverage if not under construction/abandoned

### 2.3 Service Coverage Data Structure

**Location**: `src/lib/simulation.ts`

Service coverage is stored in a `ServiceCoverage` object:

```typescript
interface ServiceCoverage {
  power: boolean[][];      // Grid of power coverage
  water: boolean[][];      // Grid of water coverage
  fire: number[][];        // Grid of fire coverage (0-100%)
  police: number[][];      // Grid of police coverage (0-100%)
  health: number[][];      // Grid of health coverage (0-100%)
  education: number[][];   // Grid of education coverage (0-100%)
}
```

This is recalculated every simulation tick in `simulateTick`.

### 2.4 Service Building Placement

**Location**: `src/lib/simulation.ts` - `placeBuilding` function

Service buildings are placed like any other building:

```2234:2378:src/lib/simulation.ts
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

  // Can't place roads on existing buildings (only allow on grass, tree, existing roads, or rail - rail+road creates combined tile)
  // Note: 'empty' tiles are part of multi-tile building footprints, so roads can't be placed there either
  if (buildingType === 'road') {
    const allowedTypes: BuildingType[] = ['grass', 'tree', 'road', 'rail'];
    if (!allowedTypes.includes(tile.building.type)) {
      return state; // Can't place road on existing building
    }
  }

  // Can't place rail on existing buildings (only allow on grass, tree, existing rail, or road - rail+road creates combined tile)
  if (buildingType === 'rail') {
    const allowedTypes: BuildingType[] = ['grass', 'tree', 'rail', 'road'];
    if (!allowedTypes.includes(tile.building.type)) {
      return state; // Can't place rail on existing building
    }
  }

  // Roads and rail can be combined, but other buildings require clearing first
  if (buildingType && buildingType !== 'road' && buildingType !== 'rail' && tile.building.type === 'road') {
    return state;
  }
  if (buildingType && buildingType !== 'road' && buildingType !== 'rail' && tile.building.type === 'rail') {
    return state;
  }

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));

  if (zone !== null) {
    // De-zoning (zone === 'none') can work on any zoned tile/building
    // Regular zoning can only be applied to grass, tree, or road tiles
    if (zone === 'none') {
      // Check if this tile is part of a multi-tile building (handles both origin and 'empty' tiles)
      const origin = findBuildingOrigin(newGrid, x, y, state.gridSize);
      
      if (origin) {
        // Dezone the entire multi-tile building
        const size = getBuildingSize(origin.buildingType);
        for (let dy = 0; dy < size.height; dy++) {
          for (let dx = 0; dx < size.width; dx++) {
            const clearX = origin.originX + dx;
            const clearY = origin.originY + dy;
            if (clearX < state.gridSize && clearY < state.gridSize) {
              newGrid[clearY][clearX].building = createBuilding('grass');
              newGrid[clearY][clearX].zone = 'none';
            }
          }
        }
      } else {
        // Single tile - can only dezone tiles that actually have a zone
        if (tile.zone === 'none') {
          return state;
        }
        // De-zoning resets to grass
        newGrid[y][x].zone = 'none';
        newGrid[y][x].building = createBuilding('grass');
      }
    } else {
      // Can't zone over existing buildings (only allow zoning on grass, tree, or road)
      // NOTE: 'empty' tiles are part of multi-tile buildings, so we can't zone them either
      const allowedTypesForZoning: BuildingType[] = ['grass', 'tree', 'road'];
      if (!allowedTypesForZoning.includes(tile.building.type)) {
        return state; // Can't zone over existing building or part of multi-tile building
      }
      // Setting zone
      newGrid[y][x].zone = zone;
    }
  } else if (buildingType) {
    const size = getBuildingSize(buildingType);
    
    // Check water adjacency requirement for waterfront buildings (marina, pier)
    let shouldFlip = false;
    if (requiresWaterAdjacency(buildingType)) {
      const waterCheck = getWaterAdjacency(newGrid, x, y, size.width, size.height, state.gridSize);
      if (!waterCheck.hasWater) {
        return state; // Waterfront buildings must be placed next to water
      }
      shouldFlip = waterCheck.shouldFlip;
    }
    
    if (size.width > 1 || size.height > 1) {
      // Multi-tile building - check if we can place it
      if (!canPlaceMultiTileBuilding(newGrid, x, y, size.width, size.height, state.gridSize)) {
        return state; // Can't place here
      }
      applyBuildingFootprint(newGrid, x, y, buildingType, 'none', 1);
      // Set flip for waterfront buildings to face the water
      if (shouldFlip) {
        newGrid[y][x].building.flipped = true;
      }
    } else {
      // Single tile building - check if tile is available
      // Can't place on water, existing buildings, or 'empty' tiles (part of multi-tile buildings)
      // Note: 'road' and 'rail' are included here so they can extend over existing roads/rails,
      // but non-road/rail buildings are already blocked from roads/rails by the checks above
      const allowedTypes: BuildingType[] = ['grass', 'tree', 'road', 'rail'];
      if (!allowedTypes.includes(tile.building.type)) {
        return state; // Can't place on existing building or part of multi-tile building
      }
      
      // Handle combined rail+road tiles
      if (buildingType === 'rail' && tile.building.type === 'road') {
        // Placing rail on road: keep as road with rail overlay
        newGrid[y][x].hasRailOverlay = true;
        // Don't change the building type - it stays as road
      } else if (buildingType === 'road' && tile.building.type === 'rail') {
        // Placing road on rail: convert to road with rail overlay
        newGrid[y][x].building = createBuilding('road');
        newGrid[y][x].hasRailOverlay = true;
        newGrid[y][x].zone = 'none';
      } else if (buildingType === 'rail' && tile.hasRailOverlay) {
        // Already has rail overlay, do nothing
      } else if (buildingType === 'road' && tile.hasRailOverlay) {
        // Already has road with rail overlay, do nothing
      } else {
        // Normal placement
        newGrid[y][x].building = createBuilding(buildingType);
        newGrid[y][x].zone = 'none';
        // Clear rail overlay if placing non-combined building
        if (buildingType !== 'road') {
          newGrid[y][x].hasRailOverlay = false;
        }
      }
      // Set flip for waterfront buildings to face the water
      if (shouldFlip) {
        newGrid[y][x].building.flipped = true;
      }
    }
  }

  return { ...state, grid: newGrid };
}
```

**Current Validation for Service Buildings:**
- ✅ Can't build on water
- ✅ Can't build on existing buildings
- ✅ Can check water adjacency (for waterfront buildings)
- ❌ **No road connectivity check**
- ❌ **No validation that service building is connected to road network**

### 2.5 Service Building Usage in Simulation

Service coverage is recalculated every tick and applied to buildings:

**Location**: `src/lib/simulation.ts` - `simulateTick` function

```1701:1882:src/lib/simulation.ts
// Main simulation tick
export function simulateTick(state: GameState): GameState {
  // Optimized: shallow clone rows, deep clone tiles only when modified
  const size = state.gridSize;
  const newGrid = state.grid.map(row => [...row]);
  
  // Recalculate service coverage
  const services = calculateServiceCoverage(newGrid, size);
  
  // Helper to get modifiable tile (copy-on-write)
  const getModifiableTile = (x: number, y: number): Tile => {
    if (!modifiedRows.has(y)) {
      newGrid[y] = newGrid[y].map(t => ({ ...t, building: { ...t.building } }));
      modifiedRows.add(y);
    }
    return newGrid[y][x];
  };

  // Process all tiles
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const originalTile = state.grid[y][x];
      const originalBuilding = originalTile.building;
      
      // Fast path: skip tiles that definitely won't change
      // Water tiles are completely static
      if (originalBuilding.type === 'water') {
        continue;
      }
      
      // Check what updates this tile needs
      const newPowered = services.power[y][x];
      const newWatered = services.water[y][x];
      const needsPowerWaterUpdate = originalBuilding.powered !== newPowered ||
                                    originalBuilding.watered !== newWatered;
      
      // PERF: Roads are static unless bulldozed - skip if no utility update needed
      if (originalBuilding.type === 'road' && !needsPowerWaterUpdate) {
        continue;
      }
      
      // Unzoned grass/trees with no pollution change - skip
      if (originalTile.zone === 'none' && 
          (originalBuilding.type === 'grass' || originalBuilding.type === 'tree') &&
          !needsPowerWaterUpdate &&
          originalTile.pollution < 0.01 &&
          (BUILDING_STATS[originalBuilding.type]?.pollution || 0) === 0) {
        continue;
      }
      
      // PERF: Completed service/park buildings with no state changes can skip heavy processing
      // They only need utility updates and pollution decay
      const isCompletedServiceBuilding = originalTile.zone === 'none' && 
          originalBuilding.constructionProgress === 100 &&
          !originalBuilding.onFire &&
          originalBuilding.type !== 'grass' && 
          originalBuilding.type !== 'tree' &&
          originalBuilding.type !== 'empty';
      if (isCompletedServiceBuilding && !needsPowerWaterUpdate && originalTile.pollution < 0.01) {
        continue;
      }
      
      // Get modifiable tile for this position
      const tile = getModifiableTile(x, y);
      
      // Update utilities
      tile.building.powered = newPowered;
      tile.building.watered = newWatered;
```

**Key Points:**
- Service coverage is recalculated every tick
- Power and water are applied to all buildings
- Service buildings themselves are updated with utility status
- **No check for road connectivity before applying coverage**

---

## 3. Overlay System

### 3.1 Overlay Modes

**Location**: `src/components/game/overlays.ts`

The overlay system provides visual feedback for service coverage:

```38:87:src/components/game/overlays.ts
/** Configuration for each overlay mode */
export const OVERLAY_CONFIG: Record<OverlayMode, OverlayConfig> = {
  none: {
    label: 'None',
    title: 'No Overlay',
    activeColor: '',
    hoverColor: '',
  },
  power: {
    label: 'Power',
    title: 'Power Grid',
    activeColor: 'bg-amber-500',
    hoverColor: 'hover:bg-amber-600',
  },
  water: {
    label: 'Water',
    title: 'Water System',
    activeColor: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-600',
  },
  fire: {
    label: 'Fire',
    title: 'Fire Coverage',
    activeColor: 'bg-red-500',
    hoverColor: 'hover:bg-red-600',
  },
  police: {
    label: 'Police',
    title: 'Police Coverage',
    activeColor: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
  },
  health: {
    label: 'Health',
    title: 'Health Coverage',
    activeColor: 'bg-green-500',
    hoverColor: 'hover:bg-green-600',
  },
  education: {
    label: 'Education',
    title: 'Education Coverage',
    activeColor: 'bg-purple-500',
    hoverColor: 'hover:bg-purple-600',
  },
  subway: {
    label: 'Subway',
    title: 'Subway Coverage',
    activeColor: 'bg-yellow-500',
    hoverColor: 'hover:bg-yellow-600',
  },
};
```

### 3.2 Overlay Rendering

**Location**: `src/components/game/CanvasIsometricGrid.tsx`

Overlays are rendered on top of buildings:

```2896:2918:src/components/game/CanvasIsometricGrid.tsx
        // Draw overlays on the buildings canvas so they appear ON TOP of buildings
        // (The buildings canvas is layered above the main canvas, so overlays must be drawn here)
        // PERF: Use for loop instead of forEach
        for (let i = 0; i < overlayQueue.length; i++) {
          const { tile, screenX, screenY } = overlayQueue[i];
          // Get service coverage for this tile
          const coverage = {
            fire: state.services.fire[tile.y][tile.x],
            police: state.services.police[tile.y][tile.x],
            health: state.services.health[tile.y][tile.x],
            education: state.services.education[tile.y][tile.x],
          };
          
          const fillStyle = getOverlayFillStyle(overlayMode, tile, coverage);
          // Only draw if there's actually a color to show
          if (fillStyle !== 'rgba(0, 0, 0, 0)') {
            buildingsCtx.fillStyle = fillStyle;
            buildingsCtx.beginPath();
            buildingsCtx.moveTo(screenX + halfTileWidth, screenY);
            buildingsCtx.lineTo(screenX + tileWidth, screenY + halfTileHeight);
            buildingsCtx.lineTo(screenX + halfTileWidth, screenY + tileHeight);
            buildingsCtx.lineTo(screenX, screenY + halfTileHeight);
            buildingsCtx.closePath();
            buildingsCtx.fill();
          }
        }
```

### 3.3 Overlay Fill Style Logic

**Location**: `src/components/game/overlays.ts`

```142:191:src/components/game/overlays.ts
export function getOverlayFillStyle(
  mode: OverlayMode,
  tile: Tile,
  coverage: ServiceCoverage
): string {
  // Only show warning on tiles that have buildings needing coverage
  const needsCoverage = tileNeedsCoverage(tile);
  
  switch (mode) {
    case 'power':
      // Red warning only on unpowered buildings
      if (!needsCoverage) return NO_OVERLAY;
      return tile.building.powered ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'water':
      // Red warning only on buildings without water
      if (!needsCoverage) return NO_OVERLAY;
      return tile.building.watered ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'fire':
      // Red warning only on buildings outside fire coverage
      if (!needsCoverage) return NO_OVERLAY;
      return coverage.fire > 0 ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'police':
      // Red warning only on buildings outside police coverage
      if (!needsCoverage) return NO_OVERLAY;
      return coverage.police > 0 ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'health':
      // Red warning only on buildings outside health coverage
      if (!needsCoverage) return NO_OVERLAY;
      return coverage.health > 0 ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'education':
      // Red warning only on buildings outside education coverage
      if (!needsCoverage) return NO_OVERLAY;
      return coverage.education > 0 ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'subway':
      // Underground view overlay - keep existing behavior
      return tile.hasSubway
        ? 'rgba(245, 158, 11, 0.7)'  // Bright amber for existing subway
        : 'rgba(40, 30, 20, 0.4)';   // Dark brown tint for "underground" view

    case 'none':
    default:
      return NO_OVERLAY;
  }
}
```

**Current Behavior:**
- Shows red warning (`UNCOVERED_WARNING = 'rgba(239, 68, 68, 0.45)'`) on buildings without coverage
- Transparent (`NO_OVERLAY`) for covered buildings or non-building tiles
- **No indication of inactive service buildings** (buildings not connected to roads)

### 3.4 Service Radius Circles

The overlay system also draws radius circles around service buildings:

**Location**: `src/components/game/CanvasIsometricGrid.tsx`

Service buildings are highlighted with colored circles showing their coverage radius. The circles use colors from `OVERLAY_CIRCLE_COLORS` and `OVERLAY_CIRCLE_FILL_COLORS` in `overlays.ts`.

**Current Behavior:**
- Radius circles are always drawn for active service buildings
- **No visual distinction for inactive service buildings** (not connected to roads)

---

## 4. Current Road Connectivity Usage

### 4.1 Where Road Connectivity is Currently Checked

1. **Zoned Building Development** (`src/lib/simulation.ts` - `simulateTick`):
   - Uses `hasRoadAccess` to determine if zoned tiles can develop buildings
   - Residential/commercial/industrial buildings require road access within 8 tiles
   - This is checked during building evolution, not placement

2. **Development Blocker Diagnostics** (`src/lib/simulation.ts` - `getDevelopmentBlockers`):
   - Used to explain why zoned tiles aren't developing
   - Shows "No road access" as a blocker reason

```2893:2900:src/lib/simulation.ts
  // Check road access
  const roadAccess = hasRoadAccess(state.grid, x, y, state.gridSize);
  if (!roadAccess) {
    blockers.push({
      reason: 'No road access',
      details: 'Tile must be within 8 tiles of a road (through same-zone tiles)'
    });
  }
```

### 4.2 Where Road Connectivity is NOT Checked

1. **Service Building Placement**: No validation during placement
2. **Service Coverage Calculation**: Service buildings provide coverage regardless of road connection
3. **Service Building Status**: No "inactive" state for disconnected service buildings
4. **Overlay Visualization**: No indication of inactive service buildings

---

## 5. Key Findings and Gaps

### 5.1 Existing Infrastructure (Strengths)

✅ **Road System:**
- Well-implemented road placement and rendering
- Road adjacency detection for visual connections
- BFS-based road access checking (`hasRoadAccess`)
- Pathfinding system for vehicles

✅ **Service System:**
- Comprehensive service coverage calculation
- Efficient two-pass algorithm
- Support for both boolean (power/water) and percentage-based (other services) coverage
- Distance-based falloff for percentage services

✅ **Overlay System:**
- Visual feedback for service coverage
- Radius circles for service buildings
- Warning colors for uncovered buildings

### 5.2 Missing Functionality (Gaps)

❌ **Road Connectivity for Services:**
- No validation that service buildings are connected to roads during placement
- No check in `calculateServiceCoverage` for road connectivity
- Service buildings always provide coverage regardless of road connection

❌ **Service Building Status:**
- No "inactive" or "disconnected" state for service buildings
- No way to track which service buildings are functional vs. non-functional

❌ **Visual Feedback:**
- Overlays don't show inactive service buildings
- No visual distinction between active and inactive service buildings
- Radius circles always shown, even for inactive buildings

❌ **User Feedback:**
- No error message when trying to place service building without road access
- No indication in UI that a service building is inactive

---

## 6. Implementation Recommendations

### 6.1 Road Connectivity Check for Service Buildings

**Add validation in `placeBuilding` function:**
- Before placing a service building, check if it has road access
- Use existing `hasRoadAccess` function or create a service-specific version
- Return early with appropriate error if no road access

**Modify `calculateServiceCoverage` function:**
- Add road connectivity check before applying coverage from each service building
- Only include service buildings that have road access
- This ensures disconnected buildings don't provide coverage

### 6.2 Service Building Status Tracking

**Add status field to Building type:**
- Consider adding `isActive: boolean` or `hasRoadAccess: boolean` to Building interface
- Update this status when roads are built/destroyed near service buildings
- Or compute on-the-fly during coverage calculation

### 6.3 Enhanced Overlay Visualization

**Modify overlay rendering:**
- Show inactive service buildings with different visual style (e.g., grayed out, different color)
- Draw radius circles differently for inactive buildings (dashed, dimmed)
- Add visual indicator on service building itself (e.g., warning icon)

**Update `getOverlayFillStyle`:**
- Consider showing inactive service buildings in overlay mode
- Add new overlay state for "inactive service buildings"

### 6.4 User Feedback

**Placement validation:**
- Show error message when trying to place service building without road access
- Use existing notification system or advisor messages

**Tile info panel:**
- Show road connectivity status for service buildings
- Display "Inactive - No road access" for disconnected service buildings

---

## 7. Technical Considerations

### 7.1 Performance

- `hasRoadAccess` uses BFS with pre-allocated arrays for performance
- Road connectivity check should be cached or computed efficiently
- Consider caching road connectivity status per service building
- Recalculate only when roads are added/removed near service buildings

### 7.2 Coordinate System

- Isometric coordinate system requires careful handling
- Road adjacency uses: north (x-1,y), east (x,y-1), south (x+1,y), west (x,y+1)
- Ensure road connectivity checks use correct coordinate mapping

### 7.3 State Management

- Service coverage is recalculated every tick
- Road connectivity status should be integrated into this calculation
- Consider adding road connectivity to `ServiceCoverage` structure or separate tracking

### 7.4 Backward Compatibility

- Existing saved games may have service buildings without road access
- Need migration or graceful handling of existing states
- Consider making road requirement optional via settings

---

## 8. Follow-Up Questions and Answers

### Questions and Responses

1. **Road Access Distance**: 
   - **Answer**: Power plants must be connected to a road and cannot be more than one square away from the road (1 tile distance allowed).
   - **Other services**: Directly adjacent to a road (touching, 0 tiles away).

2. **Road Connection Definition**: 
   - **Answer**: Direct adjacency to a road (touching) for all service buildings except power plants.
   - Power plants: Within 1 tile of a road.

3. **Power and Water**: 
   - **Answer**: Yes - power plants and water towers should also require road connectivity.

4. **Visual Feedback Priority**: 
   - **Answer**: Tile info panel status is the priority for visual feedback.

5. **Placement Behavior**: 
   - **Answer**: (Not specified - to be determined during implementation)

6. **Existing Cities**: 
   - **Answer**: Grandfather in existing service buildings (allow existing service buildings without road access to continue working in saved games).

7. **Multi-Tile Service Buildings**: 
   - **Answer**: Road adjacent to any tile of the building (if any tile of a multi-tile building is adjacent to a road, the building is considered connected).

8. **Performance vs. Accuracy**: 
   - **Answer**: Cached and invalidated when roads change (better performance, recalculate only when road network changes).

### Implementation Requirements Summary

Based on the answers above, the implementation must:

1. **Road Connectivity Rules**:
   - Power plants: Must be within 1 tile of a road
   - All other service buildings (water_tower, police_station, fire_station, hospital, school, university): Must be directly adjacent (touching) a road
   - Multi-tile buildings: Connected if any tile is adjacent to a road

2. **Validation**:
   - Check road connectivity during service building placement
   - Prevent placement if road requirement not met (or allow with inactive status - TBD)

3. **Service Coverage**:
   - Only service buildings with road connectivity should provide coverage
   - Disconnected service buildings should be inactive

4. **Visual Feedback**:
   - Primary: Show road connectivity status in tile info panel
   - Indicate inactive service buildings clearly

5. **Performance**:
   - Cache road connectivity status for service buildings
   - Invalidate cache when roads are added/removed
   - Recalculate service coverage when connectivity changes

6. **Backward Compatibility**:
   - Grandfather existing service buildings in saved games
   - Existing buildings without road access continue to function

---

## 9. Implementation Requirements Summary

### Core Requirements

1. **Road Connectivity Validation**:
   - **Power plants**: Must be within 1 tile of a road (can be 1 tile away, not just adjacent)
   - **All other service buildings** (water_tower, police_station, fire_station, hospital, school, university): Must be directly adjacent (touching) a road
   - **Multi-tile buildings**: Considered connected if any tile of the building is adjacent to a road

2. **Service Coverage Logic**:
   - Only service buildings with valid road connectivity should provide coverage
   - Disconnected service buildings should be marked as inactive
   - Inactive service buildings should not contribute to service coverage calculations

3. **Placement Validation**:
   - Validate road connectivity when placing service buildings
   - Provide clear feedback if placement fails due to road requirement
   - (Placement behavior TBD: block placement vs. allow with inactive status)

4. **Visual Feedback**:
   - **Primary**: Display road connectivity status in tile info panel
   - Show inactive status for disconnected service buildings
   - Consider additional visual indicators (e.g., dimmed radius circles, warning icons)

5. **Performance Optimization**:
   - Cache road connectivity status for service buildings
   - Invalidate cache when roads are added or removed
   - Recalculate service coverage when connectivity status changes
   - Use efficient adjacency checking (direct neighbor check, not full BFS)

6. **Backward Compatibility**:
   - Grandfather existing service buildings in saved games
   - Existing service buildings without road access should continue to function
   - No breaking changes to existing game states

### Technical Implementation Points

- **Road Adjacency Check**: Use `getAdjacentRoads` from `trafficSystem.ts` or create service-specific check
- **Distance Check for Power Plants**: Check neighbors at distance 1 (4 cardinal + 4 diagonal = 8 neighbors)
- **Multi-Tile Building Check**: Iterate through all tiles in building footprint, check if any is adjacent to road
- **Cache Structure**: Track road connectivity per service building, invalidate on road placement/bulldozing
- **Service Coverage Integration**: Modify `calculateServiceCoverage` to skip inactive service buildings
- **Tile Info Panel**: Add road connectivity status display for service buildings

### Files to Modify

1. **`src/lib/simulation.ts`**:
   - Add road connectivity check function for service buildings
   - Modify `calculateServiceCoverage` to check road connectivity
   - Add placement validation in `placeBuilding` (or separate validation function)
   - Implement caching mechanism for road connectivity

2. **`src/components/game/panels/TileInfoPanel.tsx`**:
   - Add road connectivity status display for service buildings
   - Show inactive status when building is not connected to road

3. **`src/context/GameContext.tsx`**:
   - Handle road connectivity validation during placement
   - Invalidate connectivity cache when roads change

4. **`src/components/game/overlays.ts`** (optional):
   - Consider visual indicators for inactive service buildings
   - Modify radius circle rendering for inactive buildings

### Open Questions

- **Placement Behavior** (Question 5): Should placement be blocked entirely, or allowed with inactive status? This decision will affect user experience and implementation approach.

