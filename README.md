<div align="center">

# 🏙️ IsoCity


<img src="public/og-image.png" alt="IsoCity — A thriving metropolis with skyscrapers, trains, and waterfront" width="800" />

<br />

**A love letter to SimCity 2000 — rebuilt for the modern web. Sure, it's grand.**

Build roads. Zone districts. Watch your city breathe (or burn, if you're not careful).  
60+ buildings • Day/night cycles • Full economic simulation  
Pedestrians, cars, boats, trains, planes, helicopters, and emergencies — because what's a city without a bit of chaos?

**No downloads. No installs. Just build. It's not rocket science, but it's close enough.**

[**🎮 Play Now**](https://iso-city.com) · [**💻 GitHub**](https://github.com/amilich/isometric-city) · [**🐦 @milichab**](https://x.com/milichab)

</div>

---

## ✨ What You Can Build

<table>
<tr>
<td width="33%" valign="top">

### 🏗️ 60+ Building Types
Residential evolves from houses to high-rises (if you're lucky). Commercial grows from shops to malls. Watch construction scaffolding rise, or buildings fall to abandonment — depends on how well you manage things, doesn't it?

</td>
<td width="33%" valign="top">

### 🚗 Living Transportation
Cars and trucks navigate roads. Trains run on dedicated rails. Boats dock at marinas. Barges deliver cargo for trade revenue.

</td>
<td width="33%" valign="top">

### ✈️ Air & Sea
Airports spawn planes and helicopters. Seaplane docks bring flying boats. Sailboats cruise the waterfront.

</td>
</tr>
<tr>
<td valign="top">

### 🌙 Day/Night Cycle
Watch the sun set over your skyline. Lights flicker on in buildings. The city transforms after dark.

</td>
<td valign="top">

### 💰 Full Economy
Set tax rates. Balance budgets. Manage demand curves across residential, commercial, and industrial zones.

</td>
<td valign="top">

### 🔥 Emergencies
Fires spread between buildings (because of course they do). Police fight crime. Fire trucks respond. Neglect your services at your peril — or don't, and learn the hard way like the rest of us.

</td>
</tr>
<tr>
<td valign="top">

### 🗺️ Overlays & MiniMap
Visualize power grids, crime hotspots, land value, pollution, and traffic density. Navigate with the interactive minimap.

</td>
<td valign="top">

### 💾 Save & Share
Auto-save to browser. Save multiple cities. Share your creation via compressed URL — anyone can load your city.

</td>
<td valign="top">

### 🎨 Multiple Themes
Switch between sprite packs: Classic, Modern, Dense, and more. Same city, different visual personality.

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Play Instantly
**👉 [iso-city.com](https://iso-city.com)** — works on desktop and mobile.

### Run Locally
```bash
git clone https://github.com/amilich/isometric-city.git
cd isometric-city
npm install
npm run dev
# → http://localhost:3000
```

### Load an Example City
Click "Load Example" on the landing page to explore a pre-built metropolis, or dive into the 9 example cities in `src/resources/`. They're not perfect, but sure look, they work grand.

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Next.js 16 + React 19                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────┐   ┌─────────────────┐   ┌───────────────────────────┐  │
│  │  GameContext  │◄─►│   Simulation    │◄─►│    Service Coverage       │  │
│  │  (State Mgmt) │   │   Engine        │   │  (Power/Water/Fire/Police)│  │
│  └───────┬───────┘   └────────┬────────┘   └───────────────────────────┘  │
│          │                    │                                             │
│          ▼                    ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                     Canvas Rendering Pipeline                          │ │
│  │                                                                        │ │
│  │   Terrain    Buildings    Vehicles    Pedestrians    Aircraft/Boats   │ │
│  │   + Water    + Sprites    + Paths     + Wandering    + Effects        │ │
│  │                                                                        │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Systems

| System | What It Does |
|--------|--------------|
| **Simulation Loop** | Tick-based city updates (50–750ms). Calculates demand, evolves buildings, spreads fires — you know, the usual. |
| **Rendering Engine** | Canvas-based isometric projection. Depth-sorted sprites. Dynamic day/night lighting. It's not magic, but it's close enough. |
| **Traffic System** | Vehicles spawn, pathfind along roads, despawn. Trains follow rail networks. Sometimes they even go where you want them to. |
| **Pedestrian System** | Citizens walk between buildings. React to parks, transit, services. They're not the brightest, but they try their best. |
| **Economic Model** | Tax revenue, service costs, budget allocation, demand curves for RCI zones. It's complicated, but sure look, it works. |
| **Multi-Save** | UUID-based city saves. lz-string compression for URL sharing. Because why make it simple when you can make it work? |

---

## 📁 Project Structure

```
src/
├── app/                          # Next.js app directory
│   └── page.tsx                  # Landing page with sprite gallery
│
├── components/
│   ├── Game.tsx                  # Main game orchestrator
│   ├── game/
│   │   ├── CanvasIsometricGrid.tsx   # Core rendering engine
│   │   ├── Sidebar.tsx               # Desktop tool palette
│   │   ├── TopBar.tsx                # Stats display
│   │   ├── MiniMap.tsx               # Viewport navigation
│   │   ├── panels/                   # Budget, Stats, Advisors, Settings
│   │   │
│   │   ├── trafficSystem.ts          # Vehicle spawning & pathfinding
│   │   ├── pedestrianSystem.ts       # Citizen movement
│   │   ├── trainSystem.ts            # Rail network vehicles
│   │   ├── boatSystem.ts             # Watercraft & sailboats
│   │   ├── bargeSystem.ts            # Cargo ships & trade
│   │   ├── aircraftSystems.ts        # Planes & helicopters
│   │   └── seaplaneSystem.ts         # Flying boats
│   │
│   ├── mobile/                   # Touch-optimized UI
│   └── ui/                       # Radix-based components
│
├── context/
│   └── GameContext.tsx           # Global state, actions, persistence
│
├── lib/
│   ├── simulation.ts             # City simulation logic (1000+ lines — God knows how it all works)
│   ├── renderConfig.ts           # Sprite pack definitions
│   └── shareState.ts             # URL compression for sharing (because why not?)
│
├── resources/
│   └── example_state_*.json      # 9 pre-built example cities
│
└── types/
    └── game.ts                   # TypeScript definitions (60+ building types)
```

---

## 🎨 Sprite Packs

IsoCity supports multiple visual themes. Each pack includes:
- Main building sprites
- Construction variants (scaffolding)
- Abandoned variants (derelict buildings)
- Dense/modern variants for evolved buildings

| Pack | Aesthetic |
|------|-----------|
| **sprites4** | Rich detail, varied architecture |
| **harry** | Alternative building designs |
| **dense** | High-density urban variants |
| **modern** | Contemporary glass towers |

Switch themes in **Settings → Sprite Pack**.

---

## 🤝 Contributing

**Pull requests are warmly welcome.** This project is intentionally open to evolution — or whatever it becomes, really. We're not picky.

### Where You Could Make an Impact

| Area | Ideas |
|------|-------|
| **New Buildings** | Landmarks, wonders, themed districts |
| **Simulation** | Smarter traffic, realistic economics, events |
| **Multiplayer** | Shared cities, spectator mode, collaborative building |
| **Persistence** | Cloud saves, user accounts, city galleries |
| **Mobile** | Gesture improvements, tablet layouts |
| **Performance** | WebGL rendering, worker-based simulation |
| **Modding** | Custom sprite packs, scenario editor |

### The Bigger Dreams 💭

This foundation could become something much larger:

- **Infinite shared world** — One persistent server, endless map, cities that grow together
- **Civilizations** — Multiple players building neighboring cities that can trade or compete
- **Diplomacy & Trade** — Road connections trigger trade routes, treaties, or... wars?
- **Living history** — Cities that persist, evolve, and tell stories over time

The architecture is ready (or as ready as it'll ever be). The door is open. What would *you* build? Fair play to you if you can figure it out.

---

## 🎮 Controls & Tips

### Desktop
| Action | Control |
|--------|---------|
| Pan | Click + drag, or arrow keys |
| Zoom | Scroll wheel |
| Bulldoze | `B` key |
| Pause/Resume | `P` key |
| Cancel | `Escape` |
| Quick access | `⌘K` / `Ctrl+K` command menu |

### Mobile
- **Pan**: Touch + drag
- **Zoom**: Pinch gesture
- **Build**: Tap tool, tap tile
- **Menu**: Bottom toolbar

### Pro Tips (or "Things We Learned the Hard Way")
- Connect roads to map edges to discover neighboring cities — because apparently that's how it works
- Place power plants first — buildings need electricity to grow (who knew?)
- Parks boost land value and happiness — sure, why not
- Watch the demand bars (R/C/I) to know what to zone next — or don't, and see what happens
- Fire stations have limited range — spread them out, or watch your city burn. Your choice, really.

---

## 🎮 Easter Eggs

<details>
<summary>For the SimCity veterans... 👀</summary>

- **↑ ↑ ↓ ↓ ← → ← → B A** — Retro bonus ($50,000). Because why not?
- Type **`motherlode`** — Treasury boost ($50,000). The notification says $1M but the code says otherwise — sure look, it's grand.
- Type **`vinnie`** — A shady character offers you a deal. Accept $100k or decline for $10k. No pressure.
- Type **`fund`** — Quick cash injection ($10,000). For when you're feeling a bit broke.

</details>

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Development server (Turbopack)
npm run dev

# Production build
npm run build

# Serve production build
npm run start

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

### Adding New Buildings

See **[skills/adding-asset-sheets.md](skills/adding-asset-sheets.md)** for a complete guide to adding new sprite sheets and building types. It's not the worst documentation in the world, honest.

**Quick checklist (because we're helpful like that):**
1. Add sprite PNG to `/public/assets/`
2. Add `BuildingType` to `src/types/game.ts`
3. Add `Tool` entry with cost/description
4. Configure sprite in `src/lib/renderConfig.ts` (this is where it gets fun)
5. Add to `toolBuildingMap` in `GameContext.tsx`
6. Add building size to `simulation.ts` if multi-tile
7. Pray it works (optional, but recommended)

---

## 📜 License

[MIT](LICENSE) © 2025 [Andrew Milich](https://github.com/amilich)

Free to use, modify, and distribute. Attribution appreciated but not required.

---

## 🙏 Acknowledgments

- Inspired by **SimCity 2000** and the golden age of city builders (may they rest in peace)
- Built with [Next.js](https://nextjs.org), [React](https://react.dev), [Radix UI](https://radix-ui.com), and [Tailwind CSS](https://tailwindcss.com) — because why make it easy?
- Sprites crafted with care for the isometric aesthetic (or at least we tried)

---

<div align="center">

### 🌆 Build something beautiful. Or don't. We're not your boss.

**[Play Now](https://iso-city.com)** · **[Star on GitHub](https://github.com/amilich/isometric-city)** · **[Follow @milichab](https://x.com/milichab)**

<br />

*Made with ❤️ and an unhealthy obsession with isometric pixel art.*

<br />

---

*README created by [@podjamz](https://github.com/podjamz) so he could understand how this game was built and start to contribute — cheers lads 🍻*

</div>
