# Specification: Building Upgrades (Phase 1)

## Overview
This track introduces a building upgrade system for core service buildings. Players can enhance the efficiency and range of their infrastructure through a one-time investment, providing a late-game gold sink and strategic depth.

## Functional Requirements

### 1. Upgrade Configuration
- **Target Buildings:** Power Plant, Water Tower, Police Station, Fire Station, School, University, Hospital.
- **Data Structure:**
    - Definitions will be stored in a new, separate configuration file (`src/config/buildingUpgrades.ts`).
    - **Schema:** The configuration must support arbitrary overrides per building type (not hardcoded formulas), including:
        - `cost`: Absolute value or multiplier.
        - `maintenanceCost`: Absolute value or multiplier.
        - `range`: Absolute value or multiplier.
        - `effectMagnitude`: Absolute value or multiplier.
        - `pollutionFactor`: Multiplier.
        - `newSpriteIndex` (optional, if we need to map to specific indices).
- **Initial Data (for Phase 1):**
    - **Cost:** 5x base cost.
    - **Maintenance:** 2x base maintenance.
    - **Range:** 1.5x base radius.
    - **Effectiveness:** 1.5x base positive effect.
    - **Pollution:** 0.8x (20% reduction) for pollution producers.

### 2. UI/UX: Selection Modal
- **Upgrade Section:** A dedicated area at the bottom of the building selection modal.
- **Stat Comparison:** Clearly display specific stat changes defined in the config (e.g., "Range: 13 → 20").
- **Upgrade Button:** 
    - Deducts the upgrade cost from city funds.
    - Becomes greyed out if funds are insufficient or if the building is already upgraded.
- **Status Indicator:** An "Upgraded" badge or label next to the building's name in the modal.

### 3. Simulation & Rendering
- **Dynamic Calculation:** The simulation engine will check for an `isUpgraded` flag on building objects. If present, it will look up the specific bonuses from `src/config/buildingUpgrades.ts` and apply them during service coverage and economy calculations.
- **Visuals:** Use the `sprites_red_water_upgrade_buildings` sprite sheet. Upgraded buildings will switch their rendering source to this new sheet.
- **Overlays:** Range overlays in the game world will dynamically reflect the new range values from the config.
- **Save Compatibility:**
    - The game state loader must handle legacy save files where the `isUpgraded` flag is missing (treating it as `false`).
    - The `Building` type definition must make `isUpgraded` optional (`isUpgraded?: boolean`).

### 4. Visual Feedback
- **Sparkle/Flash:** A brief particle or visual flash on the building tile upon successful upgrade.
- **Floating Text:** Display the cost deduction (e.g., "-$2,500") above the building.
- **Auto-Overlay:** The range overlay will toggle on momentarily after upgrading to visualize the expanded coverage.

## Non-Functional Requirements
- **Modularity:** The upgrade logic must be data-driven. The core simulation should not assume "all upgrades are 2x cost"; it must read the specific values for the current building type.
- **Robustness:** Implementation should be separated from core files where possible to facilitate future upstream merges.
- **Backward Compatibility:** Legacy save files must load without errors.

## Acceptance Criteria
- [ ] Upgrade option appears only for supported buildings (defined in config).
- [ ] Clicking "Upgrade" deducts the specific cost defined in the config.
- [ ] Upgraded buildings use the specific stats defined in the config (range, maintenance, etc.).
- [ ] Visuals update to the new sprite sheet.
- [ ] Simulation correctly calculates coverage and expenses based on the upgraded stats.
- [ ] Loading a save file from before this feature works correctly (no crashes, buildings treated as not upgraded).

## Out of Scope
- Multiple upgrade levels (only one level supported for now).
- Upgrades for residential, commercial, or industrial zones.
- Undo functionality for upgrades.
