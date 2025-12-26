# Amusement Park Features - Implementation Plan

## Document Purpose

This plan provides a high-level roadmap for implementing amusement park and roller coaster features in isometric-city. It is structured for an agent to break down into executable tasks, but does not contain the tasks themselves. The plan synthesizes research findings, codebase analysis, and architectural decisions.

## Architecture Overview

### Core Components

The implementation will introduce five major subsystems:

1. **Ride Vehicle System** - Manages animated vehicles on tracks (roller coaster cars, ferris wheel gondolas, etc.)
2. **Track Definition System** - Stores and manages bezier curve track segments for rides
3. **Queue Simulation System** - Simulates waiting lines and passenger flow
4. **Ride Economics System** - Handles revenue, maintenance, and operational costs
5. **Ride UI System** - Panels and tools for managing rides

### Data Flow

```
Building Placement → Track Definition → Vehicle Spawning → Simulation Loop → Rendering
                                                              ↓
                                                         Queue Updates
                                                              ↓
                                                         Revenue Calculation
```

## Phase 1: Foundation & Data Structures

### 1.1 Extend Building Type System

**Objective:** Add ride-specific metadata to building structures without breaking existing systems.

**Changes Required:**
- Extend `Building` interface in `src/types/game.ts` to include optional `rideData` property
- Create `RideBuildingData` interface for ride-specific properties
- Ensure backward compatibility with existing save/load system
- Add migration logic in `GameContext.tsx` for existing buildings

**Key Interfaces:**
```typescript
interface RideBuildingData {
  state: 'operational' | 'maintenance' | 'broken' | 'closed';
  popularity: number; // 0-1, affects queue growth
  capacity: number; // Max passengers per vehicle
  vehiclesPerCycle: number; // Number of vehicles on track
  cycleTime: number; // Seconds per complete ride cycle
  revenuePerPassenger: number;
  maintenanceCost: number; // Per hour
  breakdownChance: number; // Probability per hour
  lastMaintenance: number; // Timestamp
  totalRevenue: number; // Lifetime revenue
  totalMaintenanceCost: number; // Lifetime maintenance
  queueGrowthRate: number; // People per second joining queue
  maxQueueLength: number;
}

interface RideTrack {
  rideId: string; // Building ID reference
  segments: BezierCurveSegment[];
  totalLength: number; // Cached sum of segment lengths
  stationPosition: number; // Position along track (0-1) where loading occurs
  isLoop: boolean; // True for closed loops (roller coasters), false for linear
  entryPoint: { x: number; y: number }; // Grid coordinates
  exitPoint: { x: number; y: number }; // Grid coordinates
}
```

**Reference Patterns:**
- Follow existing `Building` extension pattern (see `constructionProgress`, `abandoned` properties)
- Use optional properties to maintain backward compatibility
- Store ride data in building metadata, not separate structures

### 1.2 Create Ride Vehicle Entity System

**Objective:** Define vehicle entities that move along tracks, similar to train system but adapted for rides.

**New File:** `src/components/game/rideSystem.ts`

**Key Interfaces:**
```typescript
interface RideVehicle {
  id: number;
  rideId: string; // Reference to building
  type: 'roller_coaster' | 'ferris_wheel' | 'carousel' | 'swing';
  position: number; // Progress along track (0-1, wraps for loops)
  speed: number; // Units per second along track
  frame: number; // Animation frame for sprite
  angle: number; // Rotation for rendering (radians)
  state: 'loading' | 'running' | 'unloading' | 'maintenance';
  passengers: number;
  maxPassengers: number;
  age: number; // Time since spawn
  maxAge: number; // Time before despawn (for testing/debugging)
}

interface BezierCurveSegment {
  from: { x: number; y: number };
  to: { x: number; y: number };
  control1: { x: number; y: number };
  control2: { x: number; y: number };
  length: number; // Cached length calculation
}
```

**Core Functions to Implement:**
- `createRideVehicle(rideId, type, track)`: Spawn new vehicle
- `updateRideVehicle(vehicle, delta, track, rideData)`: Update position and state
- `getPointOnTrack(track, position)`: Calculate screen position from track progress
- `getDirectionOnTrack(track, position)`: Calculate angle from track tangent

**Reference Implementation:**
- Adapt `trainSystem.ts` bezier curve functions (`bezierPositionAndAngle`, `getCurveGeometry`)
- Use similar progress tracking as `TrainCarriage.progress`
- Follow sprite lifecycle pattern from `SpriteManager.moveObjects()`

### 1.3 Create Track Definition System

**Objective:** Store and manage track geometry for rides, supporting both predefined and user-placed tracks.

**Storage Strategy:**
- For `roller_coaster_small`: Generate default track based on building footprint
- For `amusement_park`: Support multiple rides with individual tracks
- Store tracks in `GameState` as separate array: `rideTracks: RideTrack[]`
- Link tracks to buildings via `rideId` matching building coordinates

**Track Generation:**
- Default roller coaster: Create closed loop using building corners as control points
- Use cubic bezier curves (4 control points) for smooth paths
- Calculate track length by sampling curve points (similar to `Curve.length` in 3d.city)

**Reference Patterns:**
- Track storage similar to `waterBodies` array in `GameState`
- Track lookup by building coordinates (similar to `findRailStations` in `trainSystem.ts`)

## Phase 2: Rendering System

### 2.1 Vehicle Rendering Pipeline

**Objective:** Render ride vehicles on canvas with proper depth sorting and animation.

**New Functions in `rideSystem.ts`:**
- `drawRideVehicle(ctx, vehicle, track, zoom, visualHour)`: Draw single vehicle
- `drawRideVehicles(ctx, vehicles, tracks, offset, zoom, canvasSize, grid, gridSize, visualHour)`: Draw all vehicles

**Rendering Requirements:**
- Use viewport culling (similar to `drawTrains` in `trainSystem.ts`)
- Depth sorting by tile position (x + y)
- Support frame-based animation for different vehicle types
- Handle rotation based on track direction
- Scale based on zoom level

**Integration Point:**
- Add to `CanvasIsometricGrid.tsx` render loop
- Render after buildings but before UI overlays
- Use same canvas layer as trains (or separate layer for clarity)

**Reference Implementation:**
- Adapt `drawCarriage()` from `trainSystem.ts` for vehicle rendering
- Use `gridToScreen()` utility for coordinate conversion
- Follow depth sorting pattern from `drawTrains()`

### 2.2 Track Visualization

**Objective:** Optionally render track paths for debugging and visual feedback.

**Implementation:**
- Add track rendering toggle in settings
- Draw bezier curves as debug overlay
- Use thin lines with track color
- Only render when ride panel is open or debug mode enabled

**Reference:**
- Track rendering similar to rail rendering in `railSystem.ts`
- Use canvas path drawing for bezier curves

### 2.3 Queue Visualization

**Objective:** Show waiting passengers as visual queue lines near rides.

**Integration:**
- Connect to pedestrian system for visual representation
- Render queue path as line of waiting pedestrians
- Update queue visualization based on `RideQueue.waiting` count

**Reference:**
- Use pedestrian rendering patterns from `pedestrianSystem.ts`
- Queue path similar to pedestrian paths but static

## Phase 3: Simulation Logic

### 3.1 Ride Building Updates

**Objective:** Add ride-specific simulation logic to building update cycle.

**New Function in `src/lib/simulation.ts`:**
- `updateRideBuilding(building, rideData, delta, grid, gridSize)`: Update ride state each tick

**Update Logic:**
1. **State Machine:**
   - `operational`: Normal operation, check for breakdowns
   - `maintenance`: Countdown to repair completion
   - `broken`: Requires manual repair (player action or auto-repair after time)
   - `closed`: Player-toggled closed state

2. **Breakdown System:**
   - Roll for breakdown based on `breakdownChance * delta / 3600`
   - Set state to `broken` on breakdown
   - Trigger maintenance requirement

3. **Popularity Updates:**
   - Calculate based on nearby attractions (other rides, parks)
   - Factor in city happiness and population
   - Update `queueGrowthRate` based on popularity

4. **Revenue Calculation:**
   - Calculate passengers served per cycle
   - Revenue = passengers * `revenuePerPassenger`
   - Add to building's `totalRevenue`

**Integration:**
- Call from `simulateTick()` when building type is ride
- Similar to how other building types are updated
- Update `Stats.money` with ride revenue

**Reference:**
- Follow pattern from building update functions in `simulation.ts`
- Breakdown logic similar to disaster system but building-specific

### 3.2 Vehicle Movement System

**Objective:** Update vehicle positions along tracks each simulation tick.

**New Function in `rideSystem.ts`:**
- `updateRideVehicles(vehicles, delta, speedMultiplier, tracks, rideDataMap)`: Update all vehicles

**Update Logic:**
1. **Position Updates:**
   - Increment `position` by `speed * delta * speedMultiplier`
   - Wrap position for loop tracks (modulo 1.0)
   - Handle state transitions (loading → running → unloading)

2. **State Transitions:**
   - `loading`: Wait at station, load passengers from queue
   - `running`: Move along track at normal speed
   - `unloading`: Wait at station, unload passengers, calculate revenue
   - `maintenance`: Stationary, no passengers

3. **Station Logic:**
   - Check if vehicle is near `stationPosition` on track
   - Transition to loading/unloading states
   - Transfer passengers to/from queue

**Integration:**
- Call from simulation loop (similar to `updateTrain()` calls)
- Update vehicles array in game state
- Remove expired vehicles (for testing)

**Reference:**
- Adapt `updateTrain()` logic from `trainSystem.ts`
- Use similar progress tracking and state management

### 3.3 Queue Simulation System

**Objective:** Simulate waiting lines with growth, decay, and wait time calculations.

**New File:** `src/components/game/queueSystem.ts`

**Key Interfaces:**
```typescript
interface RideQueue {
  rideId: string;
  waiting: number; // Current queue length
  maxQueueLength: number;
  averageWaitTime: number; // Calculated based on capacity and cycle time
  queuePath: { x: number; y: number }[]; // Visual queue positions
  lastUpdate: number; // Timestamp for growth calculations
}
```

**Core Functions:**
- `createRideQueue(rideId, maxLength)`: Initialize queue
- `updateRideQueue(queue, delta, rideData, vehicles)`: Update queue state
- `addToQueue(queue, count)`: Add passengers
- `removeFromQueue(queue, count)`: Remove passengers (when vehicle loads)

**Queue Growth Logic:**
- Growth rate = `rideData.popularity * baseGrowthRate * cityPopulationFactor`
- Add passengers: `queue.waiting += growthRate * delta`
- Cap at `maxQueueLength`

**Queue Decay Logic:**
- Remove passengers when vehicle enters loading state
- Remove count = `min(vehicle.maxPassengers, queue.waiting)`
- Calculate wait time: `queue.waiting / (rideData.capacity * rideData.vehiclesPerCycle / rideData.cycleTime)`

**Integration:**
- Store queues in `GameState.rideQueues: RideQueue[]`
- Update in simulation loop
- Link to vehicles for passenger transfer

**Reference:**
- Queue growth similar to population growth in residential zones
- Wait time calculation similar to service coverage calculations

## Phase 4: User Interface

### 4.1 Ride Panel Component

**Objective:** Create detailed panel for viewing and managing individual rides.

**New File:** `src/components/game/panels/RidePanel.tsx`

**Panel Sections:**
1. **Status Display:**
   - Current state (operational/maintenance/broken/closed)
   - Queue length and average wait time
   - Current revenue and maintenance costs
   - Popularity indicator

2. **Vehicle Status:**
   - List of active vehicles
   - Current state and passenger count for each
   - Position along track (visual indicator)

3. **Economics:**
   - Revenue per hour
   - Maintenance cost per hour
   - Net profit
   - Total lifetime revenue

4. **Controls:**
   - Toggle open/closed
   - Trigger maintenance (if broken)
   - Upgrade options (future)

**UI Structure:**
- Use `Dialog` component (similar to `SpriteTestPanel.tsx`)
- Tabs for different sections (Status, Vehicles, Economics)
- Real-time updates from game state

**Integration:**
- Add to panel system in `Sidebar.tsx`
- Open when clicking on ride building
- Similar to how `TileInfoPanel` works

**Reference:**
- Structure from `SpriteTestPanel.tsx`
- Data display patterns from `StatisticsPanel.tsx`
- Control patterns from `BudgetPanel.tsx`

### 4.2 Ride Tool Integration

**Objective:** Add ride management to tool system.

**Changes Required:**
- Add ride panel trigger to building click handler
- Show ride status indicator on building hover
- Add ride statistics to `StatisticsPanel.tsx`

**Integration Points:**
- `Sidebar.tsx`: Add ride panel to panel system
- `CanvasIsometricGrid.tsx`: Handle ride building clicks
- `TileInfoPanel.tsx`: Show ride data when ride building selected

### 4.3 Track Placement Tool (Future Phase)

**Objective:** Allow players to design custom tracks for rides.

**Note:** This is a complex feature that should be deferred to a later phase. Initial implementation will use auto-generated tracks.

**Future Implementation:**
- Interactive track editor
- Bezier curve control point manipulation
- Track validation (closed loops, proper connections)
- Save/load custom tracks

## Phase 5: Economics & Gameplay

### 5.1 Revenue System

**Objective:** Calculate and apply ride revenue to city budget.

**Revenue Calculation:**
- Per cycle: `passengersServed * revenuePerPassenger`
- Per hour: `(passengersServed * revenuePerPassenger) / (cycleTime / 3600)`
- Add to `Stats.money` in simulation loop

**Passenger Calculation:**
- Based on queue length and vehicle capacity
- Limited by vehicle dispatch rate
- Formula: `min(queueLength, vehicleCapacity * vehiclesPerCycle / cycleTime)`

**Integration:**
- Update in `updateRideBuilding()` function
- Add revenue to `Stats.income`
- Display in ride panel and statistics

**Reference:**
- Revenue patterns from commercial zone income
- Budget integration similar to tax revenue

### 5.2 Maintenance System

**Objective:** Implement maintenance costs and breakdown mechanics.

**Maintenance Costs:**
- Fixed hourly cost: `rideData.maintenanceCost`
- Deduct from `Stats.money` each hour
- Add to `Stats.expenses`

**Breakdown Mechanics:**
- Random chance based on `breakdownChance`
- Higher chance if maintenance cost not paid (low budget)
- Breakdown sets state to `broken`
- Broken rides generate no revenue

**Repair System:**
- Manual repair: Player action in ride panel
- Auto-repair: After time delay (if budget allows)
- Repair cost: `maintenanceCost * repairTimeHours`

**Integration:**
- Update in `updateRideBuilding()`
- Check budget before auto-repair
- Show breakdown notifications

**Reference:**
- Breakdown logic similar to building abandonment
- Maintenance similar to service building upkeep

### 5.3 Popularity System

**Objective:** Calculate ride popularity based on city conditions.

**Popularity Factors:**
1. **Nearby Attractions:**
   - Other rides within radius
   - Parks and recreational areas
   - Commercial zones (shopping)

2. **City Conditions:**
   - Overall happiness
   - Population density
   - Tourism level (future)

3. **Ride Characteristics:**
   - Base popularity by ride type
   - Age factor (newer = more popular)
   - Maintenance state (broken = 0 popularity)

**Calculation:**
- Base popularity from ride type
- Apply multipliers from factors
- Clamp to 0-1 range
- Update `rideData.popularity`

**Integration:**
- Calculate in `updateRideBuilding()`
- Use for queue growth rate
- Display in ride panel

**Reference:**
- Similar to land value calculations
- Factor aggregation like service coverage

## Technical Specifications

### Performance Considerations

**Vehicle Limits:**
- Maximum vehicles per ride: Based on ride type (2-4 for roller coasters)
- Maximum total vehicles: 50 (similar to train limit)
- Viewport culling: Only render vehicles in view

**Optimization Strategies:**
- Cache curve calculations (length, control points)
- Batch vehicle updates
- Reduce particle effects on mobile
- Use object pooling for vehicles (future)

**Reference:**
- Performance patterns from `trainSystem.ts`
- Mobile optimizations from existing systems

### State Management

**Storage:**
- Ride data: In `Building.rideData` (optional property)
- Tracks: In `GameState.rideTracks[]`
- Vehicles: In `GameState.rideVehicles[]`
- Queues: In `GameState.rideQueues[]`

**Persistence:**
- Include in save/load system
- Handle migrations for new properties
- Compress in share state (URL sharing)

**Reference:**
- State patterns from `GameContext.tsx`
- Save/load from `shareState.ts`
- Migration patterns from existing building properties

### Isometric Adaptation

**Coordinate Conversion:**
- Use existing `gridToScreen()` utilities
- Convert bezier control points to screen coordinates
- Maintain depth sorting (x + y)

**Curve Rendering:**
- Adapt 3d.city's 3D curve system to 2D isometric
- Use quadratic bezier for simpler curves (roller coaster segments)
- Calculate angles from curve tangents

**Reference:**
- Coordinate conversion from `trainSystem.ts`
- Isometric rendering from `drawing.ts`

## Dependencies & Integration Points

### Existing Systems to Leverage

1. **Train System** (`trainSystem.ts`)
   - Bezier curve mathematics
   - Vehicle movement patterns
   - Rendering pipeline

2. **Building System** (`simulation.ts`, `types/game.ts`)
   - Building update cycle
   - Type definitions
   - State management

3. **UI System** (`panels/`, `Sidebar.tsx`)
   - Panel structure
   - Dialog components
   - Tool integration

4. **Rendering System** (`CanvasIsometricGrid.tsx`, `drawing.ts`)
   - Canvas rendering
   - Depth sorting
   - Viewport culling

5. **Pedestrian System** (`pedestrianSystem.ts`)
   - Queue visualization
   - Path rendering

### New Dependencies

- No external libraries required
- All functionality uses existing game systems
- Bezier math implemented in-house (from train system)

## Implementation Order

### Recommended Sequence

1. **Phase 1.1** - Extend building types (foundation)
2. **Phase 1.2** - Create vehicle entity system (core logic)
3. **Phase 1.3** - Create track definition system (data structures)
4. **Phase 2.1** - Vehicle rendering (visual feedback)
5. **Phase 3.1** - Ride building updates (simulation)
6. **Phase 3.2** - Vehicle movement (animation)
7. **Phase 3.3** - Queue simulation (gameplay)
8. **Phase 4.1** - Ride panel (UI)
9. **Phase 4.2** - Tool integration (UX)
10. **Phase 5.1** - Revenue system (economics)
11. **Phase 5.2** - Maintenance system (gameplay)
12. **Phase 5.3** - Popularity system (balance)

### Critical Path

The critical path for basic functionality:
1. Building type extension → Vehicle system → Rendering → Simulation

Each phase builds on the previous, with UI and economics as enhancements.

## Testing Strategy

### Unit Testing Areas

1. **Bezier Curve Math:**
   - Position calculation accuracy
   - Direction/angle calculation
   - Length calculation

2. **Vehicle Movement:**
   - Position updates
   - State transitions
   - Loop wrapping

3. **Queue Simulation:**
   - Growth/decay calculations
   - Wait time accuracy
   - Passenger transfer

### Integration Testing

1. **Rendering:**
   - Vehicles appear on tracks
   - Depth sorting correct
   - Performance acceptable

2. **Simulation:**
   - Revenue adds to budget
   - Maintenance costs deducted
   - Breakdowns occur appropriately

3. **UI:**
   - Panel displays correct data
   - Controls function properly
   - Real-time updates work

### Manual Testing Scenarios

1. Place roller coaster building
2. Verify vehicle spawns and moves
3. Check queue grows over time
4. Verify revenue appears in budget
5. Trigger breakdown (or wait)
6. Test maintenance repair
7. Verify save/load preserves ride state

## Future Enhancements (Out of Scope)

These features are identified but not part of initial implementation:

1. **Custom Track Editor** - Player-designed tracks
2. **Multiple Ride Types** - Ferris wheel, carousel, swings
3. **Ride Upgrades** - Capacity, speed, popularity boosts
4. **Themed Areas** - Multiple rides in amusement park building
5. **Special Events** - Seasonal popularity boosts
6. **Ride Statistics** - Historical data and charts
7. **Multi-tile Rides** - Larger roller coasters spanning multiple buildings

## Success Criteria

### Minimum Viable Implementation

- Roller coaster building spawns vehicles
- Vehicles move along auto-generated track
- Queue system simulates waiting passengers
- Revenue adds to city budget
- Basic ride panel shows status
- Save/load preserves ride state

### Quality Metrics

- Performance: 60 FPS with 10 active rides
- Stability: No crashes during 1-hour play session
- Usability: Ride panel opens and displays data correctly
- Balance: Revenue covers maintenance with profit margin

## References

### Research Document
- `initiatives/amusement-park-features/research/amusement-park-research.md`

### Code References
- `src/components/game/trainSystem.ts` - Bezier curves, vehicle movement
- `src/components/game/railSystem.ts` - Track rendering
- `src/lib/simulation.ts` - Building updates
- `src/types/game.ts` - Type definitions
- `src/context/GameContext.tsx` - State management

### External Codebases (via Driver MCP)
- `3d.city/src/micro/sprite/SpriteManager.js` - Sprite lifecycle
- `3d.city/src/traffic/geom/Curve.js` - Curve mathematics
- `3d.city/src/micro/tool/ParkTool.js` - Tool patterns
- `micropolisJS/src/spriteManager.js` - Alternative sprite patterns
