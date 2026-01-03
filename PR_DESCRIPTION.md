# Network-Based Power and Water Utilities

## Overview

This PR implements network-based utility coverage for power and water, replacing the previous radius-based system. Utilities now flow along the road network with distance limits, creating a more realistic and strategic city-building experience.

## Key Features

### Network-Based Coverage
- **Power plants** provide power along roads up to **50 tiles** away
- **Water towers** provide water along roads up to **25 tiles** away
- Utilities propagate using BFS (Breadth-First Search) along the road network
- Only buildings adjacent to powered roads receive utilities

### Multi-Tile Building Support
- Multi-tile buildings (2x2, 3x3, 4x4, etc.) are fully supported
- If **any edge tile** of a multi-tile building is adjacent to a powered road, the **entire building** receives utilities
- Prevents edge cases where only part of a large building would be powered

### Bug Fixes
- **Fixed chain effect bug**: Power no longer cascades through chains of buildings
  - Previously, buildings could incorrectly receive power from adjacent buildings instead of roads
  - Now strictly verifies neighbors are infrastructure (roads/bridges/subways/sources) before powering
- Ensures utilities only flow through the intended network infrastructure

### Code Quality Improvements
- **Supabase optional configuration**: Multiplayer provider now gracefully handles missing Supabase environment variables
  - Allows the app to run in single-player mode without Supabase configuration
  - Prevents runtime errors when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are not set
  - Adds proper null checks throughout the multiplayer provider
- **Function parameter safety**: Refactored `calculateNetworkUtilityCoverage()` to use options object pattern
  - Prevents accidental argument transposition between `gridSize` and `maxDistance` parameters
  - Both parameters are `number` type, making them easy to swap by mistake
  - Now uses named properties in an options object for type safety

## Technical Implementation

### New Functions
- `findUtilitySources()`: Locates all active power plants and water towers
- `calculateNetworkUtilityCoverage()`: BFS-based utility propagation along roads
  - First pass: Propagates utilities along road network with distance limits
  - Second pass: Powers buildings adjacent to powered roads
  - Includes helper `findBuildingAnchor()` for multi-tile building detection

### Changes to Existing Code
- `calculateServiceCoverage()`: Now uses network-based coverage for power/water
- Removed radius-based power/water coverage logic
- Maintains backward compatibility with other services (police, fire, health, education)

## Testing Considerations

- Verify power/water coverage respects road network connectivity
- Test with disconnected road networks (utilities should not cross gaps)
- Verify multi-tile buildings (2x2, 3x3, 4x4) receive utilities correctly
- Confirm chain effect is fixed (buildings don't power each other)
- Test edge cases: buildings at grid boundaries, buildings with only partial road access

## Breaking Changes

None - this is a feature enhancement that improves gameplay mechanics without breaking existing functionality.

