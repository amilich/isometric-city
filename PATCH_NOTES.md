# Patch notes

This ZIP contains only the files that were added/changed.

## Added
- **Water Terraform tool (`zone_water`)**
  - Paint water tiles onto the map (clears existing building/zoning on the tile/footprint).
- **Undo / Redo (core gameplay actions)**
  - Undo/redo now works for building placement, zoning, bulldozing, subway/water placement, and tax/budget tweaks.

## Upgraded / improved
- **City previews**
  - Saving a city snapshot now stores a lightweight mini‑map preview thumbnail.
  - Settings: **Download City Preview (PNG)** (high‑res mini‑map export).
  - Home page & Settings saved‑city list show preview thumbnails when available.
- **Tile Info**
  - Copy selected tile coordinates to clipboard (with feedback).
- **Mobile UI / Sidebar / Command Menu**
  - `Tree` and `Water` tools are now visible in the tool menus (not just via hotkeys).
- **Bug fixes**
  - Removed duplicate Help panel render on mobile layout.
  - Fixed missing `placeWaterTerraform` export (previously referenced but not implemented).

## Files in this patch
- PATCH_NOTES.md
- src/types/game.ts
- src/lib/simulation.ts
- src/context/GameContext.tsx
- src/components/Game.tsx
- src/components/ui/CommandMenu.tsx
- src/components/game/Sidebar.tsx
- src/components/mobile/MobileToolbar.tsx
- src/components/game/panels/SettingsPanel.tsx
- src/components/game/panels/TileInfoPanel.tsx
- src/app/page.tsx
