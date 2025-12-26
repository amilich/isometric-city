# Plan: Visualize Simulation Mechanics

## Phase 1: Shortcuts & Overlay Infrastructure

- [x] Task: Remap Sports category shortcut to 'A' in `src/game/shortcuts.ts` (or relevant file).
- [x] Task: Implement `O` key handler to cycle overlays in `Game.tsx` or `useGameKeyboard.ts`.
- [x] Task: Ensure current overlays (Traffic, etc.) respond to the new cycling mechanism.
- [ ] Task: Conductor - Phase 1 Verification

## Phase 2: Target Level Overlay Implementation

- [ ] Task: Create `TargetLevel` calculation helper (extracting logic from `simulation.ts` if needed to be shared).
- [ ] Task: Implement `TargetLevelOverlay` renderer in `src/components/game/overlays.ts`.
- [ ] Task: Integrate new overlay into the `Game.tsx` rendering loop and the 'O' cycle.
- [ ] Task: Conductor - Phase 2 Verification

## Phase 3: Final Verification

- [ ] Task: Manual Verification - Test shortcuts and visual accuracy of the overlay.
- [ ] Task: Automated Tests - Ensure shortcut logic is covered.
- [ ] Task: Conductor - Final Verification
