# Amusement Park Features - Research Document

## Overview

This document provides comprehensive research for implementing amusement park and roller coaster features in the isometric-city game. It synthesizes findings from the cross-reference analysis document and deep exploration of relevant open-source codebases using Driver MCP tools.

## Current State in isometric-city

### Existing Building Types
- `amusement_park`: 4x4 building, cost 12000, major boost to commercial demand
- `roller_coaster_small`: 2x2 building, cost 3000, thrill ride

### Existing Systems That Can Be Leveraged
1. **Train System** (`src/components/game/trainSystem.ts`)
   - Bezier curve interpolation for smooth movement
   - Multi-carriage vehicle system
   - Path following with progress tracking
   - Curve geometry calculation (`getCurveGeometry`, `bezierPositionAndAngle`)
   - Sprite rendering with rotation and scaling

2. **Sprite Management**
   - `SpriteTestPanel.tsx` - Can be adapted for ride status panels
   - `renderConfig.ts` - Sprite pack configuration system
   - Building rendering pipeline in `IsometricBuildings.tsx`

3. **Simulation Infrastructure**
   - `simulation.ts` - Core game loop and building management
   - `GameContext.tsx` - State management
   - `Sidebar.tsx` and `CommandMenu.tsx` - UI for tool selection

## Reference Codebase Analysis

### 3d.city Implementation

#### Park Tool (`src/micro/tool/ParkTool.js`)
- Extends `BaseTool` class
- Places park tiles (fountains, woods) with random selection
- Cost: 10 per tile
- Checks for `Tile.DIRT` before placement
- Sets tile flags: `BURNBIT`, `BULLBIT`, `ANIMBIT` (for fountains)

**Key Methods:**
- `doTool(x, y, blockMaps)`: Processes tile placement
  - Validates tile is dirt
  - Randomly selects park feature (fountain or woods variant)
  - Updates tile value and flags
  - Adds cost to operation

#### Sprite Management (`src/micro/sprite/SpriteManager.js`)
- Manages lifecycle of all sprites in the game
- Maintains `spriteList` array
- Key methods:
  - `moveObjects(simData)`: Updates all sprites each tick
  - `makeSprite(type, x, y)`: Creates new sprites dynamically
  - `getSpritesInView(startX, startY, lastX, lastY)`: Viewport culling
  - `pruneDeadSprites()`: Removes inactive sprites (frame === 0)

**Pattern for Ride Vehicles:**
- Each sprite has a `frame` property (0 = inactive/dead)
- Sprites have `move(spriteCycle, messageManager, disasterManager, blockMaps)` method
- Sprite cycle increments each update
- Sprites can be filtered by type

#### Train Sprite (`src/micro/sprite/TrainSprite.js`)
- Extends `BaseSprite`
- 32x32 pixel sprite with offsets
- Movement logic:
  - Updates position based on direction deltas
  - Checks for valid rail tiles in 4 directions
  - Reverses direction at dead ends
  - Updates frame based on direction (NORTHSOUTH, EASTWEST, NWSE, NESW)
- Has `explodeSprite()` for crashes

**Key Properties:**
- `tileDeltaX`, `tileDeltaY`: Movement deltas per direction
- `xDelta`, `yDelta`: Pixel movement deltas
- `TrainPic2`: Frame mapping for directions
- Direction constants: NORTH, EAST, SOUTH, WEST, CANTMOVE

#### Curve System (`src/traffic/geom/Curve.js`)
- Defines curves using 4 control points: A, B, O, Q
- Creates 4 segments: AB, AO, OQ, QB
- Key methods:
  - `length`: Calculates curve length by sampling points
  - `getPoint(a)`: Returns point on curve at parameter `a` (0-1)
  - `getDirection(a)`: Returns direction/tangent at parameter `a`
- Uses linear interpolation between segments
- Caches length calculation

**Implementation Pattern:**
```javascript
// Curve defined by 4 points
const curve = new Curve(pointA, pointB, pointO, pointQ);

// Get position at 50% along curve
const position = curve.getPoint(0.5);

// Get direction at that point
const direction = curve.getDirection(0.5);
```

#### Trajectory System (`src/traffic/core/Trajectory.js`)
- Manages car movement on roads with lane changes
- Uses `Curve` objects for smooth lane transitions
- Key concepts:
  - `current`, `next`, `temp` lane positions
  - `isChangingLanes` flag
  - `moveForward(distance)`: Updates position along trajectory
  - `changeLane(nextLane)`: Initiates lane change with curve
  - `_getAdjacentLaneChangeCurve()`: Creates bezier curve for lane change

**Lane Change Pattern:**
- Calculates control points based on current and next lane positions
- Uses 30% of distance for control point offset
- Creates `Curve` object from current position to target position

### MicropolisJS Implementation

#### Train Sprite (`src/trainSprite.js`)
- Similar structure to 3d.city's TrainSprite
- Extends `BaseSprite`
- Movement based on rail tile detection
- Frame-based animation system
- Direction constants and delta arrays

#### Sprite Manager (`src/spriteManager.js`)
- Event emitter pattern
- Maintains sprite list
- `moveObjects()` updates all sprites
- Type-based sprite creation using constructor mapping
- Viewport culling support

#### Animation Manager (`src/animationManager.js`)
- Manages tile animations and power blinks
- `registerAnimations()`: Defines animation sequences
- `getTiles()`: Updates tile values based on animation state
- Supports animation periods and blink effects
- Useful pattern for ride vehicle animations

## Implementation Recommendations

### 1. Ride Vehicle Entity System

**Create: `src/components/game/rideSystem.ts`**

Based on `trainSystem.ts` but adapted for rides:

```typescript
interface RideVehicle {
  id: number;
  rideId: string; // Reference to building
  type: 'roller_coaster' | 'ferris_wheel' | 'carousel' | 'swing';
  position: number; // Progress along track (0-1)
  speed: number;
  frame: number; // Animation frame
  angle: number; // Rotation for rendering
  state: 'loading' | 'running' | 'unloading' | 'maintenance';
  passengers: number;
  maxPassengers: number;
}

interface RideTrack {
  rideId: string;
  segments: BezierCurveSegment[];
  totalLength: number;
  stationPosition: number; // Where vehicles load/unload
}
```

**Key Functions:**
- `spawnRideVehicle(rideId, type)`: Create vehicle for a ride
- `updateRideVehicle(vehicle, delta, track)`: Update position along curve
- `drawRideVehicle(ctx, vehicle, zoom)`: Render vehicle sprite

### 2. Bezier Curve Track System

**Adapt from `trainSystem.ts` curve functions:**

```typescript
interface BezierCurveSegment {
  from: { x: number; y: number };
  to: { x: number; y: number };
  control1: { x: number; y: number };
  control2: { x: number; y: number };
  length: number; // Cached
}

function getPointOnCurve(
  segment: BezierCurveSegment,
  t: number // 0-1
): { x: number; y: number; angle: number } {
  // Cubic bezier interpolation
  const u = 1 - t;
  const x = u*u*u * segment.from.x + 
            3*u*u*t * segment.control1.x + 
            3*u*t*t * segment.control2.x + 
            t*t*t * segment.to.x;
  // Similar for y
  // Calculate tangent for angle
}
```

**Track Definition:**
- Roller coasters: Closed loop with multiple segments
- Ferris wheels: Circular path (can use bezier approximation)
- Carousels: Circular path with fixed center
- Swings: Pendulum motion (different physics)

### 3. Queue Simulation

**Create: `src/components/game/queueSystem.ts`**

```typescript
interface RideQueue {
  rideId: string;
  waiting: number; // Number of people waiting
  maxQueueLength: number;
  queuePosition: { x: number; y: number }[]; // Visual queue path
  averageWaitTime: number;
}

function updateQueue(queue: RideQueue, delta: number, ride: Ride): void {
  // Add people to queue based on ride popularity
  // Remove people when vehicle loads
  // Calculate wait times
}
```

**Integration Points:**
- Connect to pedestrian system for visual queue rendering
- Update based on ride capacity and dispatch timing
- Show queue length in ride panel

### 4. Ride Panel UI

**Create: `src/components/game/panels/RidePanel.tsx`**

Based on `SpriteTestPanel.tsx` structure:

```typescript
export function RidePanel({ rideId, onClose }: { rideId: string; onClose: () => void }) {
  const { gameState } = useGame();
  const ride = findRide(gameState, rideId);
  const vehicles = getRideVehicles(rideId);
  const queue = getRideQueue(rideId);
  
  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>{ride.name}</DialogTitle>
      </DialogHeader>
      <div>
        <h3>Status</h3>
        <p>State: {ride.state}</p>
        <p>Queue: {queue.waiting} people</p>
        <p>Wait Time: {queue.averageWaitTime.toFixed(1)}s</p>
        
        <h3>Vehicles</h3>
        {vehicles.map(v => (
          <div key={v.id}>
            Vehicle {v.id}: {v.state} ({v.passengers}/{v.maxPassengers})
          </div>
        ))}
        
        <h3>Economics</h3>
        <p>Revenue: ${ride.revenue}/hour</p>
        <p>Maintenance: ${ride.maintenanceCost}/hour</p>
        <p>Profit: ${ride.revenue - ride.maintenanceCost}/hour</p>
      </div>
    </Dialog>
  );
}
```

### 5. Ride Simulation Logic

**Add to `src/lib/simulation.ts`:**

```typescript
interface RideBuilding extends Building {
  type: 'amusement_park' | 'roller_coaster_small';
  rideData: {
    state: 'operational' | 'maintenance' | 'broken';
    popularity: number; // 0-1, affects queue growth
    capacity: number; // Max passengers per cycle
    cycleTime: number; // Seconds per ride cycle
    revenuePerPassenger: number;
    maintenanceCost: number;
    breakdownChance: number; // Per hour
    lastMaintenance: number; // Timestamp
  };
}

function updateRideBuilding(
  building: RideBuilding,
  delta: number,
  grid: Tile[][],
  gridSize: number
): void {
  const ride = building.rideData;
  
  // Check for breakdown
  if (ride.state === 'operational') {
    const breakdownRoll = Math.random();
    if (breakdownRoll < ride.breakdownChance * delta / 3600) {
      ride.state = 'broken';
      // Trigger maintenance requirement
    }
  }
  
  // Update popularity based on nearby attractions
  // Update queue based on popularity
  // Calculate revenue
}
```

### 6. Track Placement Tool

**Create: `src/components/game/tools/RideTrackTool.tsx`**

Based on `ParkTool.js` pattern:

```typescript
class RideTrackTool extends BaseTool {
  constructor(map) {
    super();
    this.init(cost, map, autoBulldoze);
  }
  
  doTool(x, y, blockMaps) {
    // Check if tile is valid for track
    // Place track segment
    // Connect to existing track if adjacent
    // Update ride track definition
  }
}
```

## Integration Steps

### Phase 1: Foundation
1. ✅ Building types already exist (`amusement_park`, `roller_coaster_small`)
2. Create `rideSystem.ts` with vehicle entity structure
3. Port bezier curve functions from `trainSystem.ts`
4. Create basic ride track data structure

### Phase 2: Rendering
1. Create `drawRideVehicles()` function similar to `drawTrains()`
2. Implement vehicle sprites (reuse train rendering patterns)
3. Add ride vehicles to render loop in `CanvasIsometricGrid.tsx`
4. Create visual queue rendering (use pedestrian system patterns)

### Phase 3: Simulation
1. Add ride building data to `Building` type
2. Implement `updateRideBuilding()` in simulation loop
3. Create queue system with growth/decay logic
4. Implement vehicle dispatch timing
5. Add breakdown and maintenance mechanics

### Phase 4: UI
1. Create `RidePanel.tsx` component
2. Add ride tool to `Sidebar.tsx` and `CommandMenu.tsx`
3. Implement track placement tool
4. Add ride status indicators on buildings
5. Create ride statistics in `StatisticsPanel.tsx`

### Phase 5: Economics
1. Implement revenue calculation
2. Add maintenance costs
3. Connect to budget system
4. Add ride popularity factors
5. Implement upgrade system

## Technical Considerations

### Performance
- Limit active ride vehicles (similar to train limit)
- Use viewport culling for off-screen vehicles
- Cache curve calculations
- Reduce particle effects on mobile

### Isometric Adaptation
- Convert 3d.city's 3D curve system to 2D isometric
- Use existing `gridToScreen()` utilities
- Maintain depth sorting for proper rendering order
- Handle curve rendering in isometric projection

### State Management
- Store ride data in building metadata
- Track vehicles in separate array (like trains)
- Persist ride state in save/load system
- Handle ride removal/upgrade gracefully

## Code References

### isometric-city Files
- `src/components/game/trainSystem.ts` - Bezier curves, vehicle movement
- `src/components/game/railSystem.ts` - Track rendering patterns
- `src/components/game/panels/SpriteTestPanel.tsx` - Panel UI structure
- `src/lib/simulation.ts` - Building update logic
- `src/types/game.ts` - Type definitions

### 3d.city Files (via Driver MCP)
- `src/micro/tool/ParkTool.js` - Tool placement pattern
- `src/micro/sprite/SpriteManager.js` - Sprite lifecycle management
- `src/micro/sprite/TrainSprite.js` - Vehicle movement logic
- `src/traffic/geom/Curve.js` - Curve mathematics
- `src/traffic/core/Trajectory.js` - Path following system

### MicropolisJS Files (via Driver MCP)
- `src/trainSprite.js` - Alternative sprite implementation
- `src/spriteManager.js` - Sprite management patterns
- `src/animationManager.js` - Animation system

## Gaps and New Development Required

1. **Ride Vehicle Entity System** - New development
   - Vehicle spawning and lifecycle
   - State machine (loading, running, unloading, maintenance)
   - Passenger capacity tracking

2. **Queue Simulation** - New development
   - Queue growth/decay algorithms
   - Wait time calculations
   - Visual queue rendering

3. **Ride Economic Logic** - New development
   - Revenue calculation
   - Maintenance cost system
   - Popularity factors
   - Upgrade mechanics

4. **Track Placement System** - New development
   - Interactive track editor
   - Track validation
   - Connection management

5. **Breakdown and Maintenance** - New development
   - Random breakdown events
   - Maintenance scheduling
   - Repair costs and time

## Next Steps

1. Review this research document with the team
2. Create detailed task breakdown in `tasks/` folder
3. Develop implementation plan in `plans/` folder
4. Begin with Phase 1: Foundation (ride system structure)
