# Plan: Visualize Simulation Mechanics

## Phase 1: Shortcuts & Overlay Infrastructure

- [x] Task: Remap Sports category shortcut to 'A' in `src/game/shortcuts.ts` (or relevant file). 92f316a
- [x] Task: Implement `O` key handler to cycle overlays in `Game.tsx` or `useGameKeyboard.ts`. 92f316a
- [x] Task: Ensure current overlays (Traffic, etc.) respond to the new cycling mechanism. 92f316a
- [x] Task: Conductor - Phase 1 Verification 92f316a

## Phase 2: Target Level Overlay Implementation

- [x] Task: Create `TargetLevel` calculation helper (extracting logic from `simulation.ts` if needed to be shared). 44c8e26
- [x] Task: Implement `TargetLevelOverlay` renderer in `src/components/game/overlays.ts`. 44c8e26
- [x] Task: Integrate new overlay into the `Game.tsx` rendering loop and the 'O' cycle. 44c8e26
- [x] Task: Conductor - Phase 2 Verification 44c8e26

## Phase 3: Final Verification

- [x] Task: Manual Verification - Test shortcuts and visual accuracy of the overlay. 25f8336
- [x] Task: Automated Tests - Ensure shortcut logic is covered. 25f8336
- [x] Task: Conductor - Final Verification 25f8336
