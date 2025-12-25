# Patch notes

This ZIP contains only the files that were added/changed.

## Added
- `src/components/game/panels/HelpPanel.tsx` — in‑game Help & Shortcuts panel.

## Upgraded / improved
- **Keyboard shortcuts**
  - `Ctrl/⌘+S` quick save snapshot
  - `Space` toggles pause/resume (and resumes to previous speed)
  - Tool hotkeys: `1/2/3/4`, `B`, `T`, `R`, `C`, `I`, `D`
  - `?` or `F1` opens Help panel
- **Road/Rail/Subway drag “corner mode”**
  - Hold **Shift** while dragging to place an **L‑shaped** path.
- **Command menu**
  - New **Navigate** results:
    - `10,15` / `go 10 15` jumps to tile
    - search `city hall`, `airport`, `hospital`, `fire`, etc.
- **Settings**
  - Download **PNG city preview** (high‑res mini‑map export)
- **Tile Info**
  - Copy selected tile coordinates to clipboard
- **Sidebar**
  - Added an Info button to open Help

## Files in this patch
- README.md
- src/types/game.ts
- src/components/Game.tsx
- src/components/ui/CommandMenu.tsx
- src/components/game/CanvasIsometricGrid.tsx
- src/components/game/Sidebar.tsx
- src/components/game/panels/index.ts
- src/components/game/panels/HelpPanel.tsx
- src/components/game/panels/SettingsPanel.tsx
- src/components/game/panels/TileInfoPanel.tsx
