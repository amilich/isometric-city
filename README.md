# Isometric City

A cozy, browser-based isometric city builder with zoning, services, utilities, transit, disasters, stats, advisors, and lots of quality-of-life tooling.

## Quick start

```bash
npm install
npm run dev
```

Then open the local dev URL printed in your terminal.

### Production build

```bash
npm run build
npm run start
```

## Gameplay highlights

- **Drag-to-build tools**: roads, rail, subway, bulldoze, and zoning support click-drag for fast layout.
- **Zoning & growth**: residential / commercial / industrial areas grow over time based on conditions and demand.
- **Utilities & services**: power, water, education, safety, health, and recreation all influence your city.
- **Transit**: rail and subway networks plus stations.
- **Disasters**: optional challenges you can toggle in settings.
- **Statistics**: charts and city metrics for planning and debugging your economy.
- **Sharing & saves**: export/import saves and share cities via link.

## Controls

### Mouse / trackpad
- **Left click**: place / interact (depending on tool)
- **Click-drag**: zone areas, build roads/rail/subways, bulldoze
- **Middle mouse drag** (or **Alt + drag**): pan camera
- **Wheel / pinch**: zoom

### Keyboard shortcuts
- **Ctrl/⌘ + K**: open command menu
- **Ctrl/⌘ + S**: quick-save snapshot
- **Ctrl/⌘ + Z**: undo
- **Ctrl/⌘ + Shift + Z** or **Ctrl + Y**: redo
- **Space** (or **P**): pause / resume simulation
- **O**: cycle overlay modes (**Shift+O** cycles backwards)
- **[ / ]**: slower / faster simulation speed
- **?** (or **F1**): open the in-game Help panel
- **Esc**: close panels / clear selection / return to Select tool

#### Tool hotkeys
- **1** Select
- **2** Road
- **3** Rail
- **4** Subway
- **B** Bulldoze
- **T** Tree
- **R** Residential zone
- **C** Commercial zone
- **I** Industrial zone
- **D** De-zone

### Road/rail “corner mode”
When dragging **Road**, **Rail**, or **Subway**:
- Hold **Shift** while dragging to draw an **L-shaped** path (corner turn) instead of a straight snapped line.

## In-game Help
Use the sidebar **Info** button, the command menu (search “Help”), or press **?** to open an in-game Help & Shortcuts panel.

## Exporting images
From **Settings**, you can download a **PNG preview** of your city (useful for sharing in chats/Discord/GitHub issues).

---

If you add new sprites or sheets, check the docs in the `skills/` folder for the project workflow.
