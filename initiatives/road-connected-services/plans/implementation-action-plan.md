# Road-Connected Services Implementation Action Plan

## Overview

This action plan provides a step-by-step guide to implement road connectivity requirements for service buildings. The plan is organized into phases with specific, executable tasks that an agent can follow.

**Requirements Summary:**
- Power plants: Must be within 1 tile of a road
- All other service buildings: Must be directly adjacent (touching) a road
- Multi-tile buildings: Connected if any tile is adjacent to a road
- Cached connectivity status, invalidated when roads change
- Visual feedback in tile info panel
- Grandfather existing buildings in saved games

---

## Phase 1: Core Road Connectivity Functions

### Task 1.1: Create Road Connectivity Check Function

**File**: `src/lib/simulation.ts`

**Objective**: Create a function to check if a service building has road connectivity according to the rules.

**Implementation Steps**:

1. Add a new function `isServiceBuildingRoadConnected` after the `hasRoadAccess` function (around line 1065):

```typescript
/**
 * Check if a service building has road connectivity.
 * 
 * Rules:
 * - Power plants: Must be within 1 tile of a road (can be 1 tile away)
 * - All other service buildings: Must be directly adjacent (touching) a road
 * - Multi-tile buildings: Connected if any tile is adjacent to a road
 * 
 * @param grid - The game grid
 * @param x - X coordinate of building origin
 * @param y - Y coordinate of building origin
 * @param buildingType - Type of service building
 * @param gridSize - Size of the grid
 * @returns true if building has road connectivity, false otherwise
 */
export function isServiceBuildingRoadConnected(
  grid: Tile[][],
  x: number,
  y: number,
  buildingType: BuildingType,
  gridSize: number
): boolean {
  // Check if this is a service building
  if (!SERVICE_BUILDING_TYPES.has(buildingType)) {
    return true; // Non-service buildings don't need road connectivity
  }

  const size = getBuildingSize(buildingType);
  const isPowerPlant = buildingType === 'power_plant';
  
  // For power plants, check within 1 tile distance (8 neighbors: 4 cardinal + 4 diagonal)
  // For others, check only direct adjacency (4 cardinal neighbors)
  const checkDistance = isPowerPlant ? 1 : 0;
  
  // Check all tiles in the building footprint
  for (let dy = 0; dy < size.height; dy++) {
    for (let dx = 0; dx < size.width; dx++) {
      const checkX = x + dx;
      const checkY = y + dy;
      
      if (checkX < 0 || checkX >= gridSize || checkY < 0 || checkY >= gridSize) {
        continue;
      }
      
      // Check neighbors based on distance requirement
      if (checkDistance === 0) {
        // Direct adjacency: check 4 cardinal directions
        const neighbors = [
          [checkX - 1, checkY],  // north
          [checkX + 1, checkY],  // south
          [checkX, checkY - 1],  // east
          [checkX, checkY + 1],  // west
        ];
        
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
            if (grid[ny][nx].building.type === 'road') {
              return true;
            }
          }
        }
      } else {
        // Distance 1: check 8 neighbors (4 cardinal + 4 diagonal)
        for (let offsetY = -1; offsetY <= 1; offsetY++) {
          for (let offsetX = -1; offsetX <= 1; offsetX++) {
            if (offsetX === 0 && offsetY === 0) continue; // Skip self
            
            const nx = checkX + offsetX;
            const ny = checkY + offsetY;
            
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
              if (grid[ny][nx].building.type === 'road') {
                return true;
              }
            }
          }
        }
      }
    }
  }
  
  return false;
}
```

2. Export this function so it can be used in other modules.

**Validation**:
- Test with power plant at distance 0 (adjacent) - should return true
- Test with power plant at distance 1 - should return true
- Test with power plant at distance 2 - should return false
- Test with other service building adjacent - should return true
- Test with other service building 1 tile away - should return false
- Test with multi-tile building where one tile is adjacent - should return true

---

### Task 1.2: Create Road Connectivity Cache System

**File**: `src/lib/simulation.ts`

**Objective**: Create a caching system to track road connectivity for service buildings, invalidated when roads change.

**Implementation Steps**:

1. Add cache structure near the top of the file (after other constants, around line 990):

```typescript
// Road connectivity cache for service buildings
// Maps building position (y * gridSize + x) to connectivity status
// Invalidate when roads are added/removed
let serviceBuildingRoadCache: Map<number, boolean> = new Map();
let serviceBuildingRoadCacheVersion: number = 0;
```

2. Create a function to get cached connectivity or compute it:

```typescript
/**
 * Get road connectivity for a service building (cached).
 * 
 * @param grid - The game grid
 * @param x - X coordinate of building origin
 * @param y - Y coordinate of building origin
 * @param buildingType - Type of service building
 * @param gridSize - Size of the grid
 * @param cacheVersion - Current cache version (increment to invalidate)
 * @returns true if building has road connectivity
 */
function getServiceBuildingRoadConnectivity(
  grid: Tile[][],
  x: number,
  y: number,
  buildingType: BuildingType,
  gridSize: number,
  cacheVersion: number
): boolean {
  // Check if this is a service building
  if (!SERVICE_BUILDING_TYPES.has(buildingType)) {
    return true; // Non-service buildings don't need road connectivity
  }
  
  const cacheKey = y * gridSize + x;
  
  // Check cache (only if version matches)
  if (serviceBuildingRoadCacheVersion === cacheVersion) {
    const cached = serviceBuildingRoadCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
  } else {
    // Cache version mismatch - clear cache
    serviceBuildingRoadCache.clear();
    serviceBuildingRoadCacheVersion = cacheVersion;
  }
  
  // Compute connectivity
  const connected = isServiceBuildingRoadConnected(grid, x, y, buildingType, gridSize);
  
  // Cache result
  serviceBuildingRoadCache.set(cacheKey, connected);
  
  return connected;
}
```

3. Create a function to invalidate the cache (call when roads change):

```typescript
/**
 * Invalidate the road connectivity cache.
 * Call this when roads are added or removed.
 */
export function invalidateServiceBuildingRoadCache(): void {
  serviceBuildingRoadCacheVersion++;
}
```

**Validation**:
- Cache should return correct value on first call
- Cache should return cached value on subsequent calls
- Cache should invalidate when version changes
- Cache should work correctly after invalidation

---

## Phase 2: Modify Service Coverage Calculation

### Task 2.1: Update calculateServiceCoverage to Check Road Connectivity

**File**: `src/lib/simulation.ts`

**Objective**: Modify `calculateServiceCoverage` to only include service buildings with road connectivity.

**Implementation Steps**:

1. Locate the `calculateServiceCoverage` function (around line 862).

2. Add a cache version parameter to track when roads change. Modify function signature:

```typescript
function calculateServiceCoverage(
  grid: Tile[][], 
  size: number,
  roadCacheVersion: number = 0
): ServiceCoverage {
```

3. In the first pass (where service buildings are collected), add road connectivity check:

```typescript
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
      
      // NEW: Check road connectivity - only include connected buildings
      const hasRoadConnectivity = getServiceBuildingRoadConnectivity(
        grid,
        x,
        y,
        buildingType,
        size,
        roadCacheVersion
      );
      
      if (!hasRoadConnectivity) {
        continue; // Skip disconnected service buildings
      }
      
      serviceBuildings.push({ x, y, type: buildingType });
    }
  }
```

4. Update all calls to `calculateServiceCoverage` to pass the cache version. Find where it's called:
   - In `simulateTick` (around line 644)
   - In `createInitialGameState` (around line 2800)
   - Any other locations

5. For `simulateTick`, add a cache version to GameState or use a module-level variable:

```typescript
// At module level, add:
let currentRoadCacheVersion = 0;

// In simulateTick, before calculateServiceCoverage:
const services = calculateServiceCoverage(newGrid, size, currentRoadCacheVersion);
```

**Validation**:
- Service buildings without road connectivity should not provide coverage
- Service buildings with road connectivity should provide coverage normally
- Coverage should update when roads are added/removed
- Performance should not degrade significantly

---

## Phase 3: Placement Validation

### Task 3.1: Add Road Connectivity Validation to placeBuilding

**File**: `src/lib/simulation.ts`

**Objective**: Validate road connectivity when placing service buildings.

**Implementation Steps**:

1. Locate the `placeBuilding` function (around line 2235).

2. After the water adjacency check (around line 2326), add road connectivity validation for service buildings:

```typescript
    // Check water adjacency requirement for waterfront buildings (marina, pier)
    let shouldFlip = false;
    if (requiresWaterAdjacency(buildingType)) {
      const waterCheck = getWaterAdjacency(newGrid, x, y, size.width, size.height, state.gridSize);
      if (!waterCheck.hasWater) {
        return state; // Waterfront buildings must be placed next to water
      }
      shouldFlip = waterCheck.shouldFlip;
    }
    
    // NEW: Check road connectivity requirement for service buildings
    if (SERVICE_BUILDING_TYPES.has(buildingType)) {
      const hasRoadConnectivity = isServiceBuildingRoadConnected(
        newGrid,
        x,
        y,
        buildingType,
        state.gridSize
      );
      
      if (!hasRoadConnectivity) {
        // Return state unchanged - placement blocked
        // Note: We could also allow placement but mark as inactive, but for now we block it
        return state;
      }
    }
```

3. After successful placement, invalidate the road cache:

```typescript
  // After successful placement, invalidate road cache if a service building was placed
  if (buildingType && SERVICE_BUILDING_TYPES.has(buildingType)) {
    invalidateServiceBuildingRoadCache();
  }
  
  return { ...state, grid: newGrid };
```

**Validation**:
- Attempting to place service building without road should fail silently (return unchanged state)
- Attempting to place service building with road should succeed
- Power plant at distance 1 should succeed
- Other services at distance 1 should fail
- Multi-tile buildings should check all tiles

---

### Task 3.2: Add User Feedback for Placement Failure

**File**: `src/context/GameContext.tsx`

**Objective**: Provide user feedback when service building placement fails due to road requirement.

**Implementation Steps**:

1. Locate the `placeAtTile` function (around line 668).

2. Before calling `placeBuilding`, check if it's a service building and validate road connectivity:

```typescript
  const placeAtTile = useCallback((x: number, y: number) => {
    setState((prev) => {
      const tool = prev.selectedTool;
      if (tool === 'select') return prev;

      const info = TOOL_INFO[tool];
      const cost = info?.cost ?? 0;
      const tile = prev.grid[y]?.[x];

      if (!tile) return prev;
      if (cost > 0 && prev.stats.money < cost) return prev;

      // Prevent wasted spend if nothing would change
      if (tool === 'bulldoze' && tile.building.type === 'grass' && tile.zone === 'none') {
        return prev;
      }

      const building = toolBuildingMap[tool];
      const zone = toolZoneMap[tool];

      if (zone && tile.zone === zone) return prev;
      if (building && tile.building.type === building) return prev;
      
      // NEW: Check road connectivity for service buildings before placement
      if (building && SERVICE_BUILDING_TYPES.has(building)) {
        const hasRoadConnectivity = isServiceBuildingRoadConnected(
          prev.grid,
          x,
          y,
          building,
          prev.gridSize
        );
        
        if (!hasRoadConnectivity) {
          // Add notification about placement failure
          const buildingName = TOOL_INFO[tool]?.name || building;
          const nextState = {
            ...prev,
            notifications: [
              ...prev.notifications,
              {
                id: `road-required-${Date.now()}`,
                title: 'Road Required',
                description: `${buildingName} must be placed next to a road${building === 'power_plant' ? ' (within 1 tile)' : ''}.`,
                icon: 'road',
                timestamp: Date.now(),
              },
            ],
          };
          return nextState;
        }
      }
      
      // ... rest of existing code ...
```

3. Import `isServiceBuildingRoadConnected` and `SERVICE_BUILDING_TYPES` at the top of the file:

```typescript
import { 
  isServiceBuildingRoadConnected,
  SERVICE_BUILDING_TYPES 
} from '@/lib/simulation';
```

**Note**: You'll need to export `SERVICE_BUILDING_TYPES` from `simulation.ts` if it's not already exported.

**Validation**:
- Notification should appear when trying to place service building without road
- Notification should have correct message for power plants vs. other services
- Placement should still be blocked
- Notification should not appear when road requirement is met

---

### Task 3.3: Add Visual Feedback During Hover (Optional Enhancement)

**File**: `src/components/game/CanvasIsometricGrid.tsx`

**Objective**: Show visual feedback when hovering over invalid placement location for service buildings.

**Implementation Steps**:

1. Locate the hover feedback section (around line 4107).

2. Add road connectivity check similar to water adjacency check:

```typescript
      {hoveredTile && selectedTool !== 'select' && TOOL_INFO[selectedTool] && (() => {
        // Check if this is a waterfront building tool and if placement is valid
        const buildingType = (selectedTool as string) as BuildingType;
        const isWaterfrontTool = requiresWaterAdjacency(buildingType);
        let isWaterfrontPlacementInvalid = false;
        
        // NEW: Check road connectivity for service buildings
        let isRoadPlacementInvalid = false;
        if (SERVICE_BUILDING_TYPES.has(buildingType)) {
          isRoadPlacementInvalid = !isServiceBuildingRoadConnected(
            grid,
            hoveredTile.x,
            hoveredTile.y,
            buildingType,
            gridSize
          );
        }
        
        if (isWaterfrontTool && hoveredTile) {
          const size = getBuildingSize(buildingType);
          const waterCheck = getWaterAdjacency(grid, hoveredTile.x, hoveredTile.y, size.width, size.height, gridSize);
          isWaterfrontPlacementInvalid = !waterCheck.hasWater;
        }
        
        return (
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md text-sm ${
            isWaterfrontPlacementInvalid || isRoadPlacementInvalid
              ? 'bg-destructive/90 border border-destructive-foreground/30 text-destructive-foreground' 
              : 'bg-card/90 border border-border'
          }`}>
            {isDragging && dragStartTile && dragEndTile && showsDragGrid ? (
              <>
                {TOOL_INFO[selectedTool].name} - {Math.abs(dragEndTile.x - dragStartTile.x) + 1}x{Math.abs(dragEndTile.y - dragStartTile.y) + 1} area
                {TOOL_INFO[selectedTool].cost > 0 && ` - $${TOOL_INFO[selectedTool].cost * (Math.abs(dragEndTile.x - dragStartTile.x) + 1) * (Math.abs(dragEndTile.y - dragEndTile.y) + 1)}`}
              </>
            ) : isWaterfrontPlacementInvalid ? (
              <>
                {TOOL_INFO[selectedTool].name} must be placed next to water
              </>
            ) : isRoadPlacementInvalid ? (
              <>
                {TOOL_INFO[selectedTool].name} must be placed next to a road{selectedTool === 'power_plant' ? ' (within 1 tile)' : ''}
              </>
            ) : (
              <>
                {TOOL_INFO[selectedTool].name} at ({hoveredTile.x}, {hoveredTile.y})
                {TOOL_INFO[selectedTool].cost > 0 && ` - $${TOOL_INFO[selectedTool].cost}`}
                {showsDragGrid && ' - Drag to zone area'}
                {supportsDragPlace && !showsDragGrid && ' - Drag to place'}
              </>
            )}
          </div>
        );
      })()}
```

3. Import required functions at the top:

```typescript
import { 
  isServiceBuildingRoadConnected,
  SERVICE_BUILDING_TYPES 
} from '@/lib/simulation';
```

**Validation**:
- Red warning should appear when hovering over invalid location
- Message should be correct for power plants vs. other services
- Warning should disappear when hovering over valid location

---

## Phase 4: Tile Info Panel Display

### Task 4.1: Add Road Connectivity Status to TileInfoPanel

**File**: `src/components/game/panels/TileInfoPanel.tsx`

**Objective**: Display road connectivity status for service buildings in the tile info panel.

**Implementation Steps**:

1. Import required functions at the top:

```typescript
import { 
  isServiceBuildingRoadConnected,
  SERVICE_BUILDING_TYPES 
} from '@/lib/simulation';
import { GameState } from '@/types/game';
```

2. Add `grid` and `gridSize` to props (or pass full state):

```typescript
interface TileInfoPanelProps {
  tile: Tile;
  services: {
    police: number[][];
    fire: number[][];
    health: number[][];
    education: number[][];
    power: boolean[][];
    water: boolean[][];
  };
  grid: Tile[][];  // NEW
  gridSize: number;  // NEW
  onClose: () => void;
  isMobile?: boolean;
}
```

3. Add road connectivity status display after the service coverage section:

```typescript
        <Separator />
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Service Coverage</div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Police</span>
            <span>{Math.round(services.police[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fire</span>
            <span>{Math.round(services.fire[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Health</span>
            <span>{Math.round(services.health[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Education</span>
            <span>{Math.round(services.education[y][x])}%</span>
          </div>
        </div>
        
        {/* NEW: Road Connectivity Status for Service Buildings */}
        {SERVICE_BUILDING_TYPES.has(tile.building.type) && (
          <>
            <Separator />
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Road Connectivity</div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              {(() => {
                const isConnected = isServiceBuildingRoadConnected(
                  grid,
                  tile.x,
                  tile.y,
                  tile.building.type,
                  gridSize
                );
                return (
                  <Badge 
                    variant={isConnected ? 'default' : 'destructive'}
                    className={isConnected ? 'bg-green-500/20 text-green-400' : ''}
                  >
                    {isConnected ? 'Connected' : 'No Road Access'}
                  </Badge>
                );
              })()}
            </div>
            {(() => {
              const isConnected = isServiceBuildingRoadConnected(
                grid,
                tile.x,
                tile.y,
                tile.building.type,
                gridSize
              );
              if (!isConnected) {
                return (
                  <div className="text-xs text-muted-foreground mt-1">
                    This building is inactive. Connect it to a road to enable service coverage.
                    {tile.building.type === 'power_plant' && ' (Power plants can be up to 1 tile away from a road.)'}
                  </div>
                );
              }
              return null;
            })()}
          </>
        )}
```

4. Update all places where `TileInfoPanel` is used to pass `grid` and `gridSize`:
   - Find where `TileInfoPanel` is rendered (likely in `CanvasIsometricGrid.tsx`)
   - Pass `grid` and `gridSize` from state

**Validation**:
- Road connectivity status should appear for service buildings
- Status should show "Connected" when building has road access
- Status should show "No Road Access" when building doesn't have road access
- Help text should appear for disconnected buildings
- Status should update when roads are added/removed near the building

---

## Phase 5: Cache Invalidation on Road Changes

### Task 5.1: Invalidate Cache When Roads Are Placed

**File**: `src/lib/simulation.ts`

**Objective**: Invalidate road connectivity cache when roads are added.

**Implementation Steps**:

1. In the `placeBuilding` function, after placing a road, invalidate the cache:

```typescript
  } else if (buildingType) {
    // ... existing placement logic ...
    
    // After successful placement
    if (buildingType === 'road') {
      // Road was placed - invalidate service building road cache
      invalidateServiceBuildingRoadCache();
    }
    
    // ... rest of placement logic ...
  }
```

**Validation**:
- Cache should invalidate when road is placed
- Service coverage should recalculate on next tick
- Connectivity status should update correctly

---

### Task 5.2: Invalidate Cache When Roads Are Bulldozed

**File**: `src/lib/simulation.ts`

**Objective**: Invalidate road connectivity cache when roads are removed.

**Implementation Steps**:

1. Find the `bulldozeTile` function (search for it in the file).

2. After removing a road, invalidate the cache:

```typescript
export function bulldozeTile(state: GameState, x: number, y: number): GameState {
  // ... existing bulldoze logic ...
  
  const tile = state.grid[y][x];
  const wasRoad = tile.building.type === 'road';
  
  // ... existing bulldoze logic that removes the building ...
  
  // After successful bulldozing
  if (wasRoad) {
    // Road was removed - invalidate service building road cache
    invalidateServiceBuildingRoadCache();
  }
  
  return { ...state, grid: newGrid };
}
```

**Validation**:
- Cache should invalidate when road is bulldozed
- Service buildings that lose road access should stop providing coverage
- Connectivity status should update correctly

---

## Phase 6: Backward Compatibility (Grandfathering)

### Task 6.1: Add Grandfather Flag to Building Type

**File**: `src/types/game.ts`

**Objective**: Add a flag to track if a building was grandfathered in (exempt from road requirement).

**Implementation Steps**:

1. Add optional field to `Building` interface (around line 204):

```typescript
export interface Building {
  type: BuildingType;
  level: number;
  population: number;
  jobs: number;
  powered: boolean;
  watered: boolean;
  onFire: boolean;
  fireProgress: number;
  age: number;
  constructionProgress: number;
  abandoned: boolean;
  flipped?: boolean;
  grandfatheredRoadAccess?: boolean; // NEW: Exempt from road connectivity requirement
}
```

**Note**: This is optional, so existing buildings won't have it (undefined = false).

---

### Task 6.2: Update Road Connectivity Check to Honor Grandfather Flag

**File**: `src/lib/simulation.ts`

**Objective**: Allow grandfathered buildings to provide coverage even without road access.

**Implementation Steps**:

1. Update `isServiceBuildingRoadConnected` to check grandfather flag:

```typescript
export function isServiceBuildingRoadConnected(
  grid: Tile[][],
  x: number,
  y: number,
  buildingType: BuildingType,
  gridSize: number
): boolean {
  // Check if this is a service building
  if (!SERVICE_BUILDING_TYPES.has(buildingType)) {
    return true; // Non-service buildings don't need road connectivity
  }

  const tile = grid[y][x];
  
  // NEW: Check if building is grandfathered (exempt from road requirement)
  if (tile.building.grandfatheredRoadAccess) {
    return true; // Grandfathered buildings are always considered connected
  }
  
  // ... rest of existing logic ...
}
```

2. Update `getServiceBuildingRoadConnectivity` similarly:

```typescript
function getServiceBuildingRoadConnectivity(
  grid: Tile[][],
  x: number,
  y: number,
  buildingType: BuildingType,
  gridSize: number,
  cacheVersion: number
): boolean {
  // Check if this is a service building
  if (!SERVICE_BUILDING_TYPES.has(buildingType)) {
    return true;
  }
  
  const tile = grid[y][x];
  
  // NEW: Check if building is grandfathered
  if (tile.building.grandfatheredRoadAccess) {
    return true;
  }
  
  // ... rest of existing logic ...
}
```

---

### Task 6.3: Mark Existing Service Buildings as Grandfathered

**File**: `src/lib/simulation.ts`

**Objective**: When loading existing game states, mark service buildings without road access as grandfathered.

**Implementation Steps**:

1. Create a migration function to be called when loading game state:

```typescript
/**
 * Migrate existing game state to mark service buildings without road access as grandfathered.
 * This ensures backward compatibility with saved games.
 */
export function migrateServiceBuildingRoadAccess(state: GameState): GameState {
  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  let modified = false;
  
  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      const tile = newGrid[y][x];
      const buildingType = tile.building.type;
      
      // Check if this is a service building
      if (!SERVICE_BUILDING_TYPES.has(buildingType)) continue;
      
      // Skip if already grandfathered
      if (tile.building.grandfatheredRoadAccess) continue;
      
      // Check if building has road connectivity
      const hasRoadConnectivity = isServiceBuildingRoadConnected(
        newGrid,
        x,
        y,
        buildingType,
        state.gridSize
      );
      
      // If no road connectivity, mark as grandfathered
      if (!hasRoadConnectivity) {
        tile.building.grandfatheredRoadAccess = true;
        modified = true;
      }
    }
  }
  
  if (!modified) {
    return state; // No changes needed
  }
  
  return { ...state, grid: newGrid };
}
```

2. Call this migration function when loading game state:
   - In `GameContext.tsx`, in the `loadGameState` function
   - Or in `createInitialGameState` if loading from JSON
   - Check game version to only run migration once

**Validation**:
- Existing saved games should load without errors
- Service buildings without road access should continue to work
- New service buildings should still require road access
- Grandfathered flag should persist in saved games

---

## Phase 7: Testing and Validation

### Task 7.1: Test Road Connectivity Rules

**Test Cases**:

1. **Power Plant Placement**:
   - Place power plant adjacent to road → should succeed
   - Place power plant 1 tile away from road → should succeed
   - Place power plant 2 tiles away from road → should fail

2. **Other Service Buildings**:
   - Place hospital adjacent to road → should succeed
   - Place hospital 1 tile away from road → should fail
   - Place police station adjacent to road → should succeed

3. **Multi-Tile Buildings**:
   - Place multi-tile service building where one tile is adjacent → should succeed
   - Place multi-tile service building where no tiles are adjacent → should fail

4. **Service Coverage**:
   - Place service building without road → should not provide coverage
   - Place service building with road → should provide coverage
   - Remove road from service building → should stop providing coverage
   - Add road to disconnected service building → should start providing coverage

5. **Cache Performance**:
   - Verify cache is used on subsequent calls
   - Verify cache invalidates when roads change
   - Verify performance doesn't degrade significantly

6. **Backward Compatibility**:
   - Load existing saved game with service buildings
   - Verify grandfathered buildings continue to work
   - Verify new buildings require road access

---

### Task 7.2: Test UI Feedback

**Test Cases**:

1. **Placement Feedback**:
   - Hover over invalid location → should show red warning
   - Hover over valid location → should show normal feedback
   - Try to place without road → should show notification

2. **Tile Info Panel**:
   - Select service building with road → should show "Connected"
   - Select service building without road → should show "No Road Access"
   - Select non-service building → should not show road connectivity section

---

## Phase 8: Export Required Functions

### Task 8.1: Export Functions for External Use

**File**: `src/lib/simulation.ts`

**Objective**: Ensure all new functions are properly exported.

**Exports Needed**:

1. `isServiceBuildingRoadConnected` - Already exported in Task 1.1
2. `invalidateServiceBuildingRoadCache` - Already exported in Task 1.2
3. `SERVICE_BUILDING_TYPES` - Need to export if not already:

```typescript
// Change from:
const SERVICE_BUILDING_TYPES = new Set([...]);

// To:
export const SERVICE_BUILDING_TYPES = new Set([...]);
```

**Validation**:
- All functions should be importable from other modules
- TypeScript should not show import errors
- Functions should work correctly when imported

---

## Implementation Order Summary

1. **Phase 1**: Core connectivity functions (Tasks 1.1, 1.2)
2. **Phase 2**: Service coverage integration (Task 2.1)
3. **Phase 3**: Placement validation (Tasks 3.1, 3.2, 3.3)
4. **Phase 4**: Tile info panel (Task 4.1)
5. **Phase 5**: Cache invalidation (Tasks 5.1, 5.2)
6. **Phase 6**: Backward compatibility (Tasks 6.1, 6.2, 6.3)
7. **Phase 7**: Testing (Tasks 7.1, 7.2)
8. **Phase 8**: Exports (Task 8.1)

---

## Notes and Considerations

1. **Performance**: The cache system should prevent performance degradation. Monitor tick times after implementation.

2. **Coordinate System**: Remember the isometric coordinate mapping:
   - north = (x-1, y)
   - east = (x, y-1)
   - south = (x+1, y)
   - west = (x, y+1)

3. **Multi-Tile Buildings**: The `getBuildingSize` function returns width and height. Use this to iterate through all tiles in the footprint.

4. **Grandfathering**: The grandfather flag is optional, so existing buildings without it are treated as requiring road access. Only buildings loaded from old saves without road access should be grandfathered.

5. **Placement Behavior**: Currently, placement is blocked if road requirement is not met. This could be changed to allow placement with inactive status if desired.

6. **Testing**: Test thoroughly with various scenarios, especially edge cases like buildings at map edges, multi-tile buildings, and existing saved games.

---

## Success Criteria

✅ Service buildings require road connectivity according to rules
✅ Power plants can be 1 tile away from road
✅ Other service buildings must be adjacent to road
✅ Multi-tile buildings check all tiles
✅ Service coverage only from connected buildings
✅ Cache system works efficiently
✅ Visual feedback in tile info panel
✅ Placement validation with user feedback
✅ Backward compatibility with existing saves
✅ No performance degradation

