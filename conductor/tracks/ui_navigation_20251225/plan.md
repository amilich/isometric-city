# Plan: UI Navigation and Keyboard Shortcut Discoverability

## Phase 1: Mode Indication & Core Navigation

- [ ] Task: Create `ShortcutTooltip` component and integrate with existing UI buttons
    - [ ] Write tests for `ShortcutTooltip` to ensure it renders shortcut labels correctly
    - [ ] Implement `ShortcutTooltip` in `src/components/ui/tooltip.tsx` or as a wrapper
    - [ ] Update `Sidebar.tsx` and `TopBar.tsx` buttons to include shortcut information
- [ ] Task: Implement dynamic Mode Indicator in TopBar
    - [ ] Write tests for `ModeIndicator` to ensure it reflects `GameContext` mode state
    - [ ] Implement `ModeIndicator` component
    - [ ] Integrate `ModeIndicator` into `src/components/game/TopBar.tsx`
- [ ] Task: Refine 'Escape' key behavior for mode resetting
    - [ ] Write tests in `GameContext` or `useKeyboard` hook for Escape key logic
    - [ ] Implement robust Escape key handling to reset building/tool modes
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Mode Indication & Core Navigation' (Protocol in workflow.md)

## Phase 2: Keyboard Shortcut Help Panel

- [ ] Task: Design and implement `ShortcutsHelpPanel` component
    - [ ] Write tests for `ShortcutsHelpPanel` rendering and visibility toggling
    - [ ] Create `ShortcutsHelpPanel.tsx` using `radix-ui` dialog or sheet
    - [ ] List shortcuts from `src/components/game/constants.ts` or a new config file
- [ ] Task: Add global 'H' key listener and UI button to trigger help panel
    - [ ] Write tests for the keyboard listener and button click handler
    - [ ] Implement 'H' key listener in `Game.tsx` or a dedicated hook
    - [ ] Add '?' help icon to `TopBar.tsx`
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Keyboard Shortcut Help Panel' (Protocol in workflow.md)

## Phase 3: Polish & Mobile Optimization

- [ ] Task: Improve cursor/ghost visual feedback for active tools
    - [ ] Write tests for ghost tile rendering logic
    - [ ] Enhance `CanvasIsometricGrid.tsx` or `drawing.ts` to provide clearer mode-specific feedback
- [ ] Task: Mobile Shortcut/Help accessibility
    - [ ] Ensure the Help panel is easily accessible via the Mobile toolbar
    - [ ] Audit touch targets for help buttons on mobile
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Polish & Mobile Optimization' (Protocol in workflow.md)
