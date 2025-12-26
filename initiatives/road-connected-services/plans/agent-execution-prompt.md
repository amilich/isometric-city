# Agent Execution Prompt: Road-Connected Services Implementation

## Mission

You are tasked with implementing the road-connected services feature for the isometric-city project. This feature requires public service buildings (health, education, security, power) to be connected to roads for functionality, preventing "cheating" by placing them randomly.

## Your Objectives

1. **Create a feature branch** for this work
2. **Break down the implementation plan** into small, focused tasks
3. **Write tests first** (TDD approach) - do not move to the next task until all tests pass
4. **Commit after every task** with clear, descriptive commit messages

## Context Documents

Before starting, review these documents for full context:

1. **Research Document**: `initiatives/road-connected-services/research/road-and-utilities-implementation.md`
   - Explains current implementation of roads and utilities
   - Identifies gaps and requirements
   - Provides technical context

2. **Action Plan**: `initiatives/road-connected-services/plans/implementation-action-plan.md`
   - Detailed step-by-step implementation guide
   - Code examples and file locations
   - Validation criteria for each task

## Requirements Summary

**Road Connectivity Rules:**
- **Power plants**: Must be within 1 tile of a road (can be 1 tile away, not just adjacent)
- **All other service buildings** (water_tower, police_station, fire_station, hospital, school, university): Must be directly adjacent (touching) a road
- **Multi-tile buildings**: Considered connected if any tile of the building is adjacent to a road

**Key Features:**
- Service buildings without road connectivity should not provide service coverage
- Placement validation should prevent placing service buildings without road access
- Visual feedback in tile info panel showing road connectivity status
- Cached connectivity status, invalidated when roads change
- Backward compatibility: Grandfather existing service buildings in saved games

## Execution Workflow

### Step 1: Setup

1. Create a feature branch:
   ```bash
   git checkout -b feature/road-connected-services
   ```

2. Review the action plan and research documents thoroughly
3. Understand the codebase structure, especially:
   - `src/lib/simulation.ts` - Core simulation logic
   - `src/components/game/panels/TileInfoPanel.tsx` - UI for tile information
   - `src/context/GameContext.tsx` - State management
   - `src/types/game.ts` - Type definitions

### Step 2: Task Breakdown

Break down the action plan into small, focused tasks. Each task should:
- Be completable in a reasonable time (aim for 30-60 minutes per task)
- Have clear, testable outcomes
- Build incrementally on previous tasks
- Be independently verifiable

**Suggested Task Breakdown** (you may adjust based on complexity):

1. Create `isServiceBuildingRoadConnected` function with tests
2. Create road connectivity cache system with tests
3. Update `calculateServiceCoverage` to use road connectivity with tests
4. Add placement validation to `placeBuilding` with tests
5. Add user feedback (notifications) for placement failure with tests
6. Add road connectivity status to TileInfoPanel with tests
7. Implement cache invalidation on road placement with tests
8. Implement cache invalidation on road bulldozing with tests
9. Add grandfather flag to Building type
10. Update connectivity checks to honor grandfather flag with tests
11. Create migration function for existing saves with tests
12. Integration testing and edge case validation

### Step 3: Test-Driven Development Process

For **each task**, follow this strict process:

#### 3.1: Write Tests First

Before writing any implementation code:
1. Identify what needs to be tested
2. Write comprehensive test cases covering:
   - Happy path (expected behavior)
   - Edge cases (boundary conditions)
   - Error cases (invalid inputs)
   - Integration points (how it interacts with other code)

3. Run tests - they should fail (red)
4. Document test cases in comments or test descriptions

**Example Test Structure:**
```typescript
describe('isServiceBuildingRoadConnected', () => {
  it('should return true for power plant adjacent to road', () => {
    // Arrange: Set up grid with power plant next to road
    // Act: Call function
    // Assert: Should return true
  });
  
  it('should return true for power plant 1 tile away from road', () => {
    // Test power plant at distance 1
  });
  
  it('should return false for power plant 2 tiles away from road', () => {
    // Test power plant at distance 2
  });
  
  it('should return true for hospital adjacent to road', () => {
    // Test other service building adjacent
  });
  
  it('should return false for hospital 1 tile away from road', () => {
    // Test other service building at distance 1 (should fail)
  });
  
  it('should return true for multi-tile building where one tile is adjacent', () => {
    // Test multi-tile building
  });
  
  // ... more edge cases
});
```

#### 3.2: Implement Functionality

1. Write the minimum code needed to make tests pass
2. Follow existing code patterns and style
3. Add comments for complex logic
4. Ensure code is readable and maintainable

#### 3.3: Verify Tests Pass

1. Run all tests related to the current task
2. Ensure all tests pass (green)
3. Check for any linting errors
4. Verify no regressions in existing functionality

#### 3.4: Refactor if Needed

1. If code works but could be cleaner, refactor
2. Ensure tests still pass after refactoring
3. Maintain code quality standards

### Step 4: Commit After Each Task

After completing each task (tests passing, code implemented):

1. Stage relevant files:
   ```bash
   git add <modified-files>
   ```

2. Commit with a clear, descriptive message:
   ```bash
   git commit -m "feat: [Task description]

   - What was implemented
   - Key changes made
   - Tests added/updated
   
   Related to: [Phase X, Task X.X from action plan]"
   ```

**Commit Message Examples:**
```bash
git commit -m "feat: Add isServiceBuildingRoadConnected function

- Implement road connectivity check for service buildings
- Power plants can be 1 tile away, others must be adjacent
- Support multi-tile building footprint checking
- Add comprehensive test suite

Related to: Phase 1, Task 1.1"
```

```bash
git commit -m "feat: Add road connectivity cache system

- Implement caching for service building road connectivity
- Add cache invalidation mechanism
- Add tests for cache behavior and invalidation

Related to: Phase 1, Task 1.2"
```

### Step 5: Quality Standards

**Code Quality:**
- Follow existing TypeScript/React patterns in the codebase
- Use existing utility functions where possible
- Maintain performance (cache system is critical)
- Add JSDoc comments for public functions
- Keep functions focused and single-purpose

**Test Quality:**
- Tests should be independent and isolated
- Use descriptive test names
- Test both positive and negative cases
- Test edge cases (map boundaries, multi-tile buildings, etc.)
- Ensure tests are fast and don't require external dependencies

**Documentation:**
- Update code comments where logic is complex
- Document any deviations from the plan
- Note any assumptions or design decisions

## Testing Strategy

### Unit Tests

Test individual functions in isolation:
- `isServiceBuildingRoadConnected` - various scenarios
- Cache functions - hit, miss, invalidation
- Coverage calculation - with/without road connectivity

### Integration Tests

Test how components work together:
- Placement validation → notification system
- Coverage calculation → service building filtering
- Cache invalidation → coverage recalculation

### Manual Testing Checklist

After implementation, manually verify:
- [ ] Power plant placement at distance 0, 1, 2
- [ ] Other service building placement adjacent vs. 1 tile away
- [ ] Multi-tile building placement scenarios
- [ ] Service coverage with/without road connectivity
- [ ] Tile info panel shows correct status
- [ ] Notifications appear on invalid placement
- [ ] Cache invalidates when roads change
- [ ] Existing saved games load correctly (grandfathered)

## Important Notes

1. **Don't Skip Tests**: Every task must have tests before moving on
2. **Don't Break Existing Functionality**: Ensure existing tests still pass
3. **Follow the Plan**: The action plan has detailed steps - follow them closely
4. **Ask for Clarification**: If something is unclear, document it and continue with best judgment
5. **Performance Matters**: The cache system is critical for performance - test it thoroughly
6. **Backward Compatibility**: Grandfathering is important - don't break existing saves

## Success Criteria

The implementation is complete when:

✅ All service buildings require road connectivity according to rules
✅ Service coverage only comes from connected buildings
✅ Placement validation prevents invalid placements
✅ Visual feedback works in tile info panel
✅ Cache system works efficiently
✅ All tests pass
✅ No regressions in existing functionality
✅ Existing saved games continue to work (grandfathered)
✅ Code follows project standards
✅ All commits are clear and descriptive

## Getting Started

1. Read the research document and action plan completely
2. Create the feature branch
3. Start with Phase 1, Task 1.1
4. Write tests first
5. Implement
6. Verify
7. Commit
8. Move to next task

Good luck! Follow the plan methodically, test thoroughly, and commit frequently.

