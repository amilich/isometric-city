# Implementation Plan: Building Upgrades

This plan outlines the steps to implement a modular building upgrade system, allowing players to enhance service buildings with increased range, efficiency, and reduced pollution.

## Phase 1: Foundation & Configuration [checkpoint: 5b67754]
Establish the data structures and configuration that will drive the upgrade system.

- [x] Task: Update `Building` type in `src/types/game.ts` to include optional `isUpgraded?: boolean`.
- [x] Task: Create `src/config/buildingUpgrades.ts` with the schema and initial data for Power Plant, Water Tower, Police Station, Fire Station, School, University, and Hospital.
- [x] Task: Create a utility `getBuildingStats` in a new file `src/lib/upgradeUtils.ts` to handle stat lookups (base vs. upgraded) to keep core simulation code clean.
- [x] Task: Write unit tests to verify that `getBuildingStats` returns correct values for both normal and upgraded buildings.
- [x] Task: Conductor - User Manual Verification 'Foundation & Configuration' (Protocol in workflow.md)

## Phase 2: Simulation Integration (TDD) [checkpoint: 7eafc4d]
Integrate the upgrade logic into the core simulation loops using the new utility.

- [x] Task: Update `calculateServiceCoverage` in `src/lib/simulation.ts` to use dynamic ranges from `upgradeUtils`.
- [x] Task: Update `updateBudgetCosts` in `src/lib/simulation.ts` to account for increased maintenance of upgraded buildings.
- [x] Task: Update `calculateStats` to apply the `effectMagnitude` and `pollutionFactor` for upgraded buildings.
- [x] Task: Write failing tests in `src/lib/__tests__/simulation.upgrades.test.ts` that verify coverage and budget changes when buildings are upgraded.
- [x] Task: Implement simulation changes to pass the new tests.
- [x] Task: Conductor - User Manual Verification 'Simulation Integration' (Protocol in workflow.md)

## Phase 3: UI - Selection Modal & Upgrade Logic [checkpoint: bbb381e]
Implement the user interface for upgrading buildings and the logic for processing the upgrade.

- [x] Task: Create `UpgradeSection` component in `src/components/game/BuildingUpgradeUI.tsx`. [7eb6acc]
- [x] Task: Integrate `UpgradeSection` into the building selection modal (likely in `src/components/Game.tsx` or a dedicated modal component). [7eb6acc]
- [x] Task: Implement the `upgradeBuilding` action in `GameContext` (or relevant state manager) to handle the transaction and state update. [7eb6acc]
- [x] Task: Add stat comparison display (Current vs. Next) in the upgrade UI. [7eb6acc]
- [x] Task: Write tests for the upgrade action, ensuring funds are deducted and the `isUpgraded` flag is set correctly. [7eb6acc]
- [x] Task: Conductor - User Manual Verification 'UI & Upgrade Logic' (Protocol in workflow.md) [bbb381e]

## Phase 4: Visuals & Feedback [checkpoint: 73de7df]
Connect the upgraded state to the rendering engine and provide visual feedback to the player.

- [x] Task: Update `src/components/buildings/IsometricBuildings.tsx` (or the main renderer) to use the `sprites_red_water_upgrade_buildings` sprite sheet when `isUpgraded` is true.
- [x] Task: Implement visual feedback: floating text for cost deduction and a brief "flash" effect.
- [x] Task: Implement the "auto-overlay" trigger that toggles the range overlay for 3 seconds after an upgrade.
- [x] Task: Verify that the sprite sheet switch works correctly for all 4 initial buildings.
- [x] Task: Conductor - User Manual Verification 'Visuals & Feedback' (Protocol in workflow.md)

## Phase 5: Final Polish & Compatibility
Ensure the system is robust and compatible with existing saves.

- [~] Task: Verify backward compatibility by loading a pre-feature save file and ensuring no crashes occur. [e80b77b]
- [ ] Task: Run full project linting and type checking (`npm run check`).
- [ ] Task: Perform a final manual walkthrough of the upgrade flow for all 7 building types.
- [ ] Task: Conductor - User Manual Verification 'Final Polish & Compatibility' (Protocol in workflow.md)
