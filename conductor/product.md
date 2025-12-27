# Initial Concept
IsoCity is an open-source isometric city-building simulation game built with Next.js, TypeScript, and Tailwind CSS. It features a custom rendering engine using HTML5 Canvas and complex simulation systems for traffic, pedestrians, and economy.

# Product Guide - IsoCity

## Product Vision
IsoCity is an open-source isometric city-building simulation designed to be accessible and relaxing for casual players while offering the complexity and depth desired by simulation enthusiasts. It serves as a high-performance demonstration of HTML5 Canvas capabilities within a modern Next.js environment, encouraging open-source contribution through a clean and modular architecture.

## Target Audience
- **Casual Gamers:** Seeking a "zen" city-building experience with intuitive controls.
- **Simulation Enthusiasts:** Players who enjoy mastering economic systems and complex infrastructure.
- **Open-Source Contributors:** Developers interested in game engine architecture and isometric rendering.

## Core Objectives
1. **Enhanced Usability:** Prioritize navigation and discoverability. Players should easily understand the current state of the game (active mode, selected tools) and discover advanced controls (keyboard shortcuts).
2. **Cloud Persistence:** Transition from local-only storage to cloud-synced state using Firebase, allowing players to access their cities across devices.
3. **Robust Simulation:** Maintain and eventually deepen the autonomous simulation systems (traffic, pedestrians, economy) to create a living, breathing city.

## High-Level Roadmap

### Phase 1: UX & Navigation (Completed)
- **Shortcut Discoverability:** Implemented contextual tooltips and a centralized Keyboard Shortcuts Help Panel.
- **Comprehensive Shortcuts:** Added shortcuts for all top-level tools and implemented **Category Cycling** (e.g., 'S' cycles through Services).
- **Mode Indication:** Added a persistent Mode Indicator in the TopBar and dynamic cursor highlights (Green/Red) for placement feedback.
- **Navigation Flow:** Refined 'Escape' key behavior and focus management.

### Phase 2: Cloud Integration
- **Authentication:** Integrate Firebase Authentication for user accounts.
- **Persistence:** Implement city state syncing to Firestore or Firebase Storage to enable cloud saves.

### Phase 3: Simulation Depth (Future)

- **Documentation Foundation (Completed):** Established a comprehensive `PLAYER_GUIDE.md` detailing the core simulation mechanics (Demand, Levels, Economy) to improve transparency for players and developers.

- **Simulation Visualization (Completed):** Implemented a dynamic "Target Level" overlay and improved data visualization shortcuts ('O' to cycle overlays) to help players master city growth mechanics.

- **Deepening Simulation:** Further simulation enhancements (Economy, Utilities, AI) to be defined based on community feedback and project growth.



### Phase 4: Strategic Depth (Completed)

- **Building Upgrades:** Implemented a modular building upgrade system for core service buildings (Power, Water, Police, Fire, Education, Health).

- **Advanced Simulation:** Integrated upgrade effects (range, efficiency, pollution reduction) into the core simulation engine.
