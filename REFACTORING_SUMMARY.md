# CanvasIsometricGrid Refactoring Summary

## File Size
- Original: 5741 lines
- Target: Break into ~6-8 smaller files

## Extraction Plan

### 1. Entity Management (`hooks/useEntityManagement.ts`) - ~2000 lines
- All update/spawn functions for entities
- Cars, Pedestrians, Emergency Vehicles, Airplanes, Helicopters, Boats, Fireworks, Smog
- Crime incident management

### 2. Drawing Utilities (`utils/drawEntities.ts`) - ~1000 lines  
- All draw functions for entities
- drawCars, drawPedestrians, drawEmergencyVehicles, drawIncidentIndicators
- drawAirplanes, drawHelicopters, drawBoats, drawFireworks, drawSmog

### 3. Event Handlers (`hooks/useCanvasEvents.ts`) - ~500 lines
- Mouse handlers (down, move, up, wheel)
- Touch handlers (start, move, end)
- Keyboard panning

### 4. Grid Rendering (`utils/renderers/gridRenderer.ts`) - ~1500 lines
- Main grid rendering useEffect
- Tile rendering logic
- Building rendering logic
- Water/road rendering

### 5. Lighting Rendering (`utils/renderers/lightingRenderer.ts`) - ~300 lines
- Day/night cycle rendering
- Light cutouts and glows

### 6. Grid Helpers (`utils/gridHelpers.ts`) - ~200 lines
- findBuildingOrigin
- isPartOfMultiTileBuilding
- isPartOfParkBuilding
- getMapBounds, clampOffset

## Remaining in Main Component (~1200 lines)
- Component structure and state
- Refs and state management
- useEffect hooks for coordination
- JSX rendering

