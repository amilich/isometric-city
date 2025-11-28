# CanvasIsometricGrid Refactoring Plan

## Current State
- File: `src/components/game/CanvasIsometricGrid.tsx`
- Size: ~5741 lines
- Main component with all logic inline

## Refactoring Strategy

### 1. Entity Management Hooks (`hooks/useEntityManagement.ts`)
Extract all entity update/spawn logic:
- Cars: spawnRandomCar, updateCars
- Pedestrians: spawnPedestrian, updatePedestrians
- Emergency Vehicles: dispatchEmergencyVehicle, updateEmergencyDispatch, updateEmergencyVehicles
- Airplanes: updateAirplanes
- Helicopters: updateHelicopters
- Boats: updateBoats
- Fireworks: updateFireworks
- Smog: updateSmog
- Crime Incidents: spawnCrimeIncidents, updateCrimeIncidents, findCrimeIncidents

### 2. Drawing Utilities (`utils/drawEntities.ts`)
Extract all drawing functions:
- drawCars
- drawPedestrians (already uses utility)
- drawEmergencyVehicles
- drawIncidentIndicators
- drawAirplanes (already uses utility)
- drawHelicopters (already uses utility)
- drawBoats
- drawFireworks
- drawSmog

### 3. Event Handlers (`hooks/useCanvasEvents.ts`)
Extract all event handling:
- handleMouseDown
- handleMouseMove
- handleMouseUp
- handleWheel
- handleTouchStart
- handleTouchMove
- handleTouchEnd
- Keyboard panning useEffect

### 4. Grid Rendering (`utils/renderers/gridRenderer.ts`)
Extract main grid rendering logic:
- The large useEffect starting at line 3272
- All helper functions for rendering tiles, buildings, water, roads, etc.

### 5. Lighting Rendering (`utils/renderers/lightingRenderer.ts`)
Extract lighting rendering logic:
- The useEffect starting at line 4873
- Day/night cycle logic

### 6. Helper Functions (`utils/gridHelpers.ts`)
Extract utility functions:
- findBuildingOrigin
- isPartOfMultiTileBuilding
- isPartOfParkBuilding
- getMapBounds
- clampOffset

## Performance Improvements
- Add React.memo where appropriate
- Memoize expensive calculations
- Optimize callback dependencies
- Use useMemo for computed values

## Files to Create
1. `src/components/game/hooks/useEntityManagement.ts`
2. `src/components/game/hooks/useCanvasEvents.ts`
3. `src/components/game/utils/drawEntities.ts`
4. `src/components/game/utils/renderers/gridRenderer.ts`
5. `src/components/game/utils/renderers/lightingRenderer.ts`
6. `src/components/game/utils/gridHelpers.ts`

## Files to Modify
1. `src/components/game/CanvasIsometricGrid.tsx` - Refactor to use extracted utilities
