# Plan: UI Navigation and Keyboard Shortcut Discoverability

## Phase 1: Mode Indication & Core Navigation [checkpoint: f218a9c]

- [x] Task: Create `ShortcutTooltip` component and integrate with existing UI buttons [bfef1b0]
    - [ ] Write tests for `ShortcutTooltip` to ensure it renders shortcut labels correctly
    - [ ] Implement `ShortcutTooltip` in `src/components/ui/tooltip.tsx` or as a wrapper
    - [ ] Update `Sidebar.tsx` and `TopBar.tsx` buttons to include shortcut information
- [x] Task: Implement dynamic Mode Indicator in TopBar [7f11cae]
    - [ ] Write tests for `ModeIndicator` to ensure it reflects `GameContext` mode state
    - [ ] Implement `ModeIndicator` component
    - [ ] Integrate `ModeIndicator` into `src/components/game/TopBar.tsx`
- [x] Task: Refine 'Escape' key behavior for mode resetting [068416d]
    - [ ] Write tests in `GameContext` or `useKeyboard` hook for Escape key logic
    - [ ] Implement robust Escape key handling to reset building/tool modes
- [x] Task: Conductor - User Manual Verification 'Phase 1: Mode Indication & Core Navigation' (Protocol in workflow.md) [f218a9c]

## Phase 2: Keyboard Shortcut Help Panel [checkpoint: cd1e589]

- [x] Task: Design and implement `ShortcutsHelpPanel` component [6b5e8b3]
    - [ ] Write tests for `ShortcutsHelpPanel` rendering and visibility toggling
    - [ ] Create `ShortcutsHelpPanel.tsx` using `radix-ui` dialog or sheet
    - [ ] List shortcuts from `src/components/game/constants.ts` or a new config file
- [x] Task: Add global '?' key listener and UI button to trigger help panel [6103598]
    - [ ] Write tests for the keyboard listener and button click handler
    - [ ] Implement '?' key listener in `Game.tsx` or a dedicated hook
    - [ ] Add '?' help icon to `TopBar.tsx`
- [x] Task: Conductor - User Manual Verification 'Phase 2: Keyboard Shortcut Help Panel' (Protocol in workflow.md) [cd1e589]

## Phase 3: Polish & Mobile Optimization [checkpoint: da5ba79]

- [x] Task: Improve cursor/ghost visual feedback for active tools [6dd8b58]
    - [ ] Write tests for ghost tile rendering logic
    - [ ] Enhance `CanvasIsometricGrid.tsx` or `drawing.ts` to provide clearer mode-specific feedback
- [x] Task: Mobile Shortcut/Help accessibility [6dd8b58]
    - [ ] Ensure the Help panel is easily accessible via the Mobile toolbar
    - [ ] Audit touch targets for help buttons on mobile
- [x] Task: Conductor - User Manual Verification 'Phase 3: Polish & Mobile Optimization' (Protocol in workflow.md) [da5ba79]

## Phase 4: Comprehensive Shortcuts [checkpoint: 3b10ff3]

- [x] Task: Implement remaining top-level tool shortcuts [057f4de]
    - [ ] Update `shortcuts.ts` with Rail (L), Subway (M), Dezone (4)
    - [ ] Implement handling in `useGameKeyboard`
    - [ ] Add tests for new shortcuts
- [x] Task: Implement Category Cycling logic [9e303d1]
    - [ ] Define category mappings in `shortcuts.ts` or a new config
    - [ ] Implement logic in `useGameKeyboard` to cycle tools within a category
    - [ ] Add tests for category cycling behavior
- [x] Task: Update Help Panel and Tooltips [54a80e1]
    - [ ] Update `ShortcutsHelpPanel` to list new category shortcuts
    - [ ] Update Sidebar tooltips to show the cycling shortcut (e.g., "Police Station (S)")
- [x] Task: Conductor - User Manual Verification 'Phase 4: Comprehensive Shortcuts' (Protocol in workflow.md) [3b10ff3]
