Top 5 User Requests
===================

Purpose and Approach
====================

This document cross-references six user requests for the `isometric-city` project against six related codebases. It identifies which codebase implements each request best, what modules or files can be reused in `isometric-city`, and where gaps exist that require new development. The evaluation uses file and symbol references (for example, `Main.initWorker`, `EventEmitter.emitEvent`, `findPerimeterRoad`, `MapGenerator.doRivers`, `heightmap.create`, `OVERLAY_CONFIG`, `compressGameState`, and `isMobile`) to trace functionality and design patterns. The approach compares simulation, tools and placement, terrain and water, traffic and connectivity, overlays and UI, input, import and export, and scheduling.

* Codebases considered:
    
    * `isometric-city`
        
    * `MicropolisJS`
        
    * `OpenSC2K`
        
    * `Cytopia`
        
    * `3d.city`
        
    * `Lincity-NG`
        

Evaluation criteria:

1.  Identify the technical needs for each user request.
    
2.  Inspect each codebase by responsibility area.
    
3.  List candidate modules and functions that address the need.
    
4.  Verify overlay and visibility support from simulation through rendering.
    
5.  Check road connectivity and service-coverage enforcement.
    
6.  Assess terrain editing and water features.
    
7.  Evaluate multiplayer patterns including message passing, determinism, and serialization.
    
8.  Evaluate mobile input, gestures, and responsive rendering.
    
9.  Assess scalability, dynamic tiling, and procedural expansion.
    
10. Document leverage points with concrete file and symbol references and record explicit gaps.
    

Cross-Reference Summary Matrix
==============================

|     |     |     |     |
| --- | --- | --- | --- |
| User request | Best-supporting codebase(s) | Key modules/files to leverage | Primary gaps |
| Multiplayer Support | `3d.city`; `Lincity-NG`; `OpenSC2K` | `3d.city/src/Main.js` (worker messaging with `post`/`message`), `3d.city/src/micro/CityGame.js` (sends commands via `postMessage` and uses a message bridge), `Lincity-NG` (modules in `Game.cpp`, `main.cpp`, `world.hpp`, and `simulate.cpp` for serialization and command execution), `OpenSC2K/src/simulation/index.js` (tick-based updates)  <br>Schema reference: `isometric-city/src/resources/example_state_6.json` showing grid properties | Lack of networking transport, session control, and client synchrony. Delta-sync and conflict resolution need addition. |
| Amusement Park/Roller Coaster Features | `3d.city`; `Lincity-NG`; `OpenSC2K`; `Cytopia` | `3d.city/src/micro/tool/ParkTool.js` and `BuildingTool.js` (for park tile placement), `3d.city/src/micro/sprite/SpriteManager.js` (for ride sprites), `3d.city/src/traffic/core/Trajectory.js` (for curve and path sampling)  <br>`Lincity-NG` (modules in `parkland.hpp`, `parkland.cpp`),  <br>`OpenSC2K` (files in `cell/tiles/building.js` and `city/map.js`),  <br>Data from `Cytopia/data/resources/data` (for tile definitions)  <br>Schema reference in `example_state_6.json` for building types | No simulation for ride throughput, queue management, dispatch logic, or maintenance and interaction states. |
| Road-Connected Services and Visibility | `3d.city`; `Lincity-NG`; `OpenSC2K`; `Cytopia` | Connectivity tools: `3d.city/src/micro/tool/RoadTool.js` and `BaseToolConnector.js` (with functions such as `layRoad`, `checkZoneConnections`),  <br>Overlays: `isometric-city/src/components/game/overlays.ts` (using `OVERLAY_CONFIG`), `TileInfoPanel.tsx`, `MiniMap.tsx`  <br>References: `Lincity-NG` modules (`firestation.cpp`, `health_centre.cpp`, and related XML help files),  <br>OpenSC2K uses layer toggling in `city/layers/layer.js` and pointer event mapping in `cell/tiles/road.js` | No service activation gating by road connectivity. Overlay pipelines do not show the “inactive due to no road” state. |
| Terraforming and Water Features | `3d.city`; `Lincity-NG`; `OpenSC2K`; `Cytopia` | Terrain generation: `3d.city/src/micro/map/MapGenerator.js` (functions like `makeLakes`, `doRivers`),  <br>Height and water render: `3d.city/src/city3d/View.js`, `3d.city/src/jsm/math/ImprovedNoise.js`,  <br>LinCity-NG and OpenSC2K modules for water flags in `port.cpp` and `tiles/water.js`,  <br>Cytopia terrain tools using Perlin noise and JSON configuration  <br>Schema reference in `example_state_6.json` (with `building.type` = `water`) | Missing interactive terrain editing, dynamic water connectivity (rivers to oceans), and integration for port/fishing rules. |
| Mobile Optimization | `3d.city`; `OpenSC2K`; `Lincity-NG`; `Cytopia` | Mobile-specific code in `isometric-city/src/hooks/useMobile.ts` for device detection,  <br>Mobile UI files: `MobileTopBar.tsx` and `MobileToolbar.tsx`,  <br>Adjustments in `globals.css` and `layout.tsx`,  <br>Pointer events in OpenSC2K (`cell/cell.js`) and responsiveness in Lincity-NG (SDL window and GUI modules),  <br>Data and UI references in `Cytopia/data/resources/data` | Requires unified gesture handling, better tap target sizing, safe area compliance and performance tuning for low-end devices across components. |
| Earth-Scale or Procedural Expansion | `3d.city`; `Lincity-NG`; `OpenSC2K`; `Cytopia` | Procedural terrain: `3d.city/src/micro/map/MapGenerator.js` (procedural construction functions),  <br>Noise generation: `3d.city/src/jsm/math/ImprovedNoise.js`,  <br>Fixed grid and procedural parameters in Lincity-NG and OpenSC2K (via `constants.js` and `cell/position.js`),  <br>Schema reference in `isometric-city/src/resources/example_state_6.json` extended with elevation data | No DEM ingestion (for example, ETOPO1), no chunk streaming or paging, and no planet-scale coordinate system or LOD support. |

Feature-by-Feature Analysis
===========================

This section explains the detailed evaluation for each feature requested by users. It describes the modules and functions in the reference codebases that can be reused or serve as a guideline, notes the gaps that require new development, and offers recommended integration steps.

Multiplayer Support
-------------------

Users request cooperative or competitive multiplayer with shared city building and MMO-style interactions such as trade and warfare. The evaluation focuses on reusing state management, event, and messaging patterns from existing modules and adapting them to a command-based synchronization scheme. Missing is a network layer, authoritative server logic, and conflict resolution mechanisms.

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
| Codebase | Relevant modules/files | Strength for this feature | Leverage for isometric-city | Gaps/new work |
| isometric-city | `src/context/GameContext.tsx`, `src/app/page.tsx`, `src/components/Game.tsx`, `src/components/TopBar.tsx`, `src/lib/shareState.ts` | Centralized React state and mutation functions; snapshot and share utilities (for example, `compressGameState`) | Use `GameContext.tsx` as the centralized command entry point. Use `shareState.ts` for state snapshots and recovery. Keep UI components for user action binding. | Add networking transport and server authority. |
| OpenSC2K | `src/world/events.js`, `shareState.ts` | Input event registration; clear command boundaries for state changes | Map pointer and key events into command objects before updating the state. Use a shared-state boundary pattern to isolate networking code. | No networking or server logic. Conflict resolution needed. |
| Cytopia | `src/engine/MessageQueue.hxx`, `src/engine/EventManager.hxx`, `src/util/SignalMediator.hxx`, `src/Game.cxx` | Message queue for command batching and signal handling with topic-based events | Implement a TypeScript version of the command queue with similar API. Add a signal layer to dispatch tool actions and map changes to React components. | No networking and no server for authoritative control. |
| 3d.city | `src/micro/CityGame.js`, `src/Main.js`, `src/micro/MessageManager.js`, `src/micro/Micro.js` | Worker/main-thread message bridging; clear message passing between engine modules | Use the worker bridge pattern to transfer the output of `MessageManager.getMessages()` into a command queue in React. Convert message objects into commands for state updates. | No networking transport or conflict reconciliation mechanisms. |

Recommended integration steps:

* Introduce a client-side command queue that wraps state mutators (for example, `setTool`, `connectToCity`).
    
* Add a signal layer with defined topics (for example, `signalSetTileID`, `signalNewGame`) to route tool actions.
    
* Centralize pointer and key input events and translate them into command objects.
    
* Use snapshot utilities (`compressGameState` and `decompressGameState`) to handle join and recovery.
    
* Develop a networking layer that sends and receives batched commands and snapshots.
    
* Implement an authoritative server that validates, sequences, and dispatches client commands.
    
* Define a message schema with versioning to support deterministic command ordering.
    

Amusement Park and Roller Coaster Features
------------------------------------------

Users request the addition of theme parks and ride attractions. The analysis focuses on reusing rendering, placement, path sampling, and panel design for ride sprites, track curves, and queue visuals. It also identifies missing simulation components for ride scheduling, vehicle entities, and maintenance logic.

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
| Codebase | Relevant modules/files | Strength for this feature | Leverage for isometric-city | Gaps/new work |
| isometric-city | `IsometricBuildings.tsx`, `SpriteTestPanel.tsx`, `trainSystem.ts`, `simulation.ts`, `GameContext.tsx`, `Sidebar.tsx`, `CommandMenu.tsx` | Has building entries for `amusement_park` and `roller_coaster_small`; supports SVG/canvas rendering; includes basic path helpers | Reuse existing building and tool placement modules. Use `renderConfig.ts` for ride asset offsets and sprite sheet definitions. Adapt helpers such as `trainSystem.ts` for bezier-based car rendering. Use `SpriteTestPanel.tsx` as a basis for a ride panel that shows live status and queue details. | Missing ride vehicle entity system, queue simulation, and ride economic/maintenance logic. |
| 3d.city | `src/micro/sprite/TrainSprite.js`, `src/micro/sprite/SpriteManager.js`, `src/traffic/geom/Curve.js`, `src/city3d/View.js` | Provides smooth sprite movement, curve sampling with `Curve.getPoint()` and `Curve.getDirection()`, and a tick-loop for sprite updates | Port the ride sprite movement and curve sampling logic (for example, `TrainSprite.move` and algorithms from `Curve.js`) to compute positions and orientations in an isometric context. Use the 3d.city model for detecting station/queue zones from existing transport patterns. | Needs TypeScript adaptation and integration with isometric-city render loop; new simulation logic for ride operations. |
| MicropolisJS | `src/trainSprite.js`, `src/spriteManager.js`, `src/animationManager.js`, `src/monsterTV.js` | Implements sprite management and simple cyclic animations for vehicles and panels | Reuse the sprite update loop from `spriteManager.js` and the animation registration in `animationManager.js` as a model to build a ride vehicle tick loop and panel view. | Lacks ride-specific pathing using curves and simulation for ride queues and dispatch. |

Recommended integration steps:

* Retain ride building definitions in `simulation.ts` and use existing UI components (`Sidebar.tsx`, `CommandMenu.tsx`) to expose ride tools.
    
* Define track segments as bezier curves and use helpers similar to `trainSystem.ts` and `Curve.js` to compute positions.
    
* Implement a ride vehicle entity with attributes such as progress (`t` parameter), speed, and frame.
    
* Create a tick loop modeled on `SpriteManager.moveObjects` to update ride vehicles.
    
* Develop a ride panel (based on `SpriteTestPanel.tsx`) that displays queue length, current vehicle states, and dispatch timing.
    
* Add simulation rules for ride capacity, dispatch timing, maintenance, and breakdown probabilities.
    
* Port rendering helpers from 3d.city and MicropolisJS to compute frame rectangles and perform transforms (using `ctx.drawImage` or SVG transforms).
    

Road-Connected Services and Coverage Visibility
-----------------------------------------------

Users request that public services function only when connected to roads and that overlays clearly show service coverage status. This analysis reviews simulation checks for road connectivity, tools for repairing road connections, and overlay rendering techniques.

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
| Codebase | Relevant modules/files | Strength for this feature | Leverage for isometric-city | Gaps/new work |
| 3d.city | `src/micro/game/Traffic.js` (functions such as `findPerimeterRoad`, `tryDrive`), `src/micro/zone/EmergencyServices.js`, `src/micro/tool/BaseToolConnector.js`, `src/micro/tool/RoadTool.js` | Implements simulation checks that degrade service effects when no road is detected; supports road revalidation after edits | Port functions such as `findPerimeterRoad` and adopt the method of reducing service effect when a road is missing. Use connectivity helpers to trigger a re-scan after road edits. | No per-tile overlay that indicates “inactive due to missing road”. |
| isometric-city | `simulation.ts` (with helpers such as `hasRoadAccess` and `getRoadAdjacency`), `trafficSystem.ts`, `overlays.ts` (with `OVERLAY_CONFIG` and `getOverlayFillStyle`), `TileInfoPanel.tsx`, `MiniMap.tsx` | Has an existing overlay pipeline and grid analysis via functions such as `hasRoadAccess` | Retain the overlay pipeline while adding computed connectivity flags. Update state in `simulation.ts` when `hasRoadAccess` is false so UI panels (such as `TileInfoPanel.tsx`) can show a proper status. | Service activation does not currently check for road connectivity; UI must indicate inactive services. |
| OpenSC2K | `src/world/tools/roads.js`, `src/cell/tiles/road.js`, and layer control in `src/city/layers/layer.js` | Offers interactive path highlighting and layer toggling buttons | Adapt the hover path highlighting for road connectivity checks. Reuse layer toggle patterns to allow users to switch overlay views. | Does not include logic to gate service activation by road connection. |
| Lincity-NG | Documentation and XML help files such as `road.xml`, `msb-fire.xml`, and `msb-health.xml` | Provides reference data for service range and decay when not connected to roads | Use the provided references to define `SERVICE_CONFIG` thresholds and decay rates in isometric-city, so that overlays and simulation rules mimic the referenced behavior. | Only documentation; rules must be implemented in code. |

Recommended integration steps:

* Create a new function `isServiceRoadConnected(building)` (or similar) that uses existing road connectivity helpers.
    
* On placement or periodic tick, re-evaluate a service building’s connectivity and update its `serviceActive` flag.
    
* In the overlay computation (for example, in `overlays.ts`), add a distinct fill or marker when a service exists but is inactive due to missing road.
    
* Connect tool actions to the overlay using an index like `TOOL_TO_OVERLAY_MAP` so that overlays react promptly to changes.
    
* Invalidate and recompute road merge caches after road edits to update all affected service states.
    
* Optionally, add a hover path highlight in the road tool using patterns from OpenSC2K.
    

Terraforming and Water Features
-------------------------------

Users request tools for terrain editing and water connectivity. They want to add or connect water bodies, enabling dynamic map behavior such as ports or fishing. The evaluation centers on procedural generation, hydrological connectivity, rendering, and persistent tile editing.

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
| Codebase | Relevant modules/files | Strength for this feature | Leverage for isometric-city | Gaps/new work |
| 3d.city | `src/micro/map/MapGenerator.js` (with functions such as `makeLakes`, `doRivers`, `smoothWater`), `src/jsm/math/ImprovedNoise.js`, `src/city3d/View.js` | Supports creation of lakes and rivers, edge smoothing using noise, and buffered tile edits | Port the water generation routines (for example, `makeLakes`, `doRivers`, `smoothWater`) as part of the simulation update in `simulation.ts`. Use `ImprovedNoise` for noise-based height and water threshold sampling. | No interactive terrain editor; port/fishing functionality and water connectivity hooks are missing. |
| isometric-city | `lib/simulation.ts` (with existing procedural generation and lake/ocean functions), `CanvasIsometricGrid.tsx` (for water tile rendering), `drawing.ts` (for rendering shoreline details), `boatSystem.ts`, `bargeSystem.ts`, `seaplaneSystem.ts` | Has water connectivity functions that compute “connected water tiles” and overlays for drawing water edges | Retain the water connectivity pipeline (for example, `findConnectedWaterTiles` and `findBays`) and integrate new procedural generators from 3d.city into `simulation.ts`. Update drawing routines when water boundaries change after user edits. | No interactive editing tool for terrain; the hydrology recomputation pipeline on edits needs to be built. |
| Cytopia | `src/engine/map/TerrainGenerator.*`, `src/engine/map/MapFunctions.*`, `src/engine/basics/mapEdit.*` | Offers interactive height editing and shoreline bitmask recomputation in C++ | Port the height editing API patterns (for example, `changeHeight`, `levelHeight`) to enable interactive modifications in the JavaScript/TypeScript domain. | No full water flow or hydrological solver; integration with the tile system is required. |
| Lincity-NG | `src/lincity/init_game.cpp`, `src/lincity/world.hpp`, `src/lincity/modules/port.cpp` | Shows river/lake connectivity utilities and port placement rules that tie closely to water tile adjacency | Adapt the rule checking (for example, verifying a span of river tiles) when placing port-type buildings. Use the concept of `is_river()` for water connectivity checks. | Code is in C++ and only generates at startup rather than interactively; fishing integration is not present. |
| OpenSC2K | `src/city/layers/water.js`, `src/cell/tiles/water.js`, `src/cell/tiles/edge.js`, `src/import/sc2.js` | Provides water layer toggles, animated water tiles, and persistency for water flags | Use the concept of a water layer toggle and a persistent `waterLevel` parameter. Reuse animated water tile techniques from OpenSC2K in the rendering pipelines. | Lacks any interactive terrain editing or real-time hydrological re-computation based on user edits. |

Recommended integration steps:

* Add a `waterLevel` property to game state and persist it with saving and loading.
    
* Port lake and river functions from `MapGenerator.js` (for example, `makeLakes`, `doRivers`, `smoothWater`) into the simulation pipeline.
    
* After any terrain edit, re-run a connectivity pass using the current algorithms (for example, `findConnectedWaterTiles` and `findBays`).
    
* Implement an edit buffer patterned on `micropolisJS/src/worldEffects.js` to allow transactional tile updates.
    
* Introduce interactive height editing by porting suitable functions from Cytopia.
    
* Enforce port placement rules by requiring contiguous water tile regions.
    
* Update overlays and agent systems (boat, barge, seaplane) to react to changes in water connectivity.
    
* Add renderer options to toggle water layers and animate water frames based on OpenSC2K techniques.
    

Mobile Optimization
-------------------

Users require better touch controls and responsiveness on phones and tablets. The evaluation covers device detection, mobile UI panels, responsive CSS, canvas touch handling, simulation throttling, and scroll behavior. External references include mobile detection and toggling in 3d.city, gesture handling patterns in Cytopia, and viewport settings in OpenSC2K.

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
| Codebase | Relevant modules/files | Strength for this feature | Leverage for isometric-city | Gaps/new work |
| isometric-city | `src/hooks/useMobile.ts`, `src/components/mobile/MobileTopBar.tsx`, `src/components/mobile/MobileToolbar.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `src/components/game/CanvasIsometricGrid.tsx`, `src/components/ui/scroll-area.tsx` | Provides device detection, mobile UI layout, safe area adjustments, and basic touch event hooks | Retain `useMobile` and mobile UI components. Continue handling touch events in `CanvasIsometricGrid.tsx` and use CSS media queries in `globals.css` for responsive design. | Add a unified gesture hook; ensure all touch targets are at least 44px; tighten safe-area compliance. |
| 3d.city | `View.js`, `Main.js`, `index_low.html` | Has integrated mouse and touch handlers and mobile DPI adjustments | Add feature-toggle flags for low-end devices. Unify mouse and touch event handling in the canvas component using patterns from 3d.city. | Port handlers from plain JavaScript into React and TypeScript; add safe-area CSS changes. |
| Cytopia | `Camera.hxx`, `Settings.cxx`, `cmake/conan/android_profile` | Implements central pinch zoom and larger button support on Android | Derive a central camera pinch API (for example, a method such as `setPinchDistance`) and apply it to React components when detecting touch devices. | Convert C++ gesture patterns into React code; replace compile-time flags with runtime detection. |
| micropolisJS | `touchWarnWindow.js`, `css/style.css` | Uses basic touch handling and responsive style breakpoints successfully | Apply similar responsive breakpoints and focus management techniques in mobile overlays. | Replace jQuery-based handlers with React events and refs. |
| OpenSC2K | `index.html` (with viewport meta configuration) | Provides a baseline viewport setup via meta tags | Ensure the viewport meta in `layout.tsx` contains `width=device-width`, `initial-scale=1`, `user-scalable=no`, and `viewport-fit=cover`. | Lacks advanced gesture handling; no safe-area handling; requires additional touch pattern logic. |

Recommended integration steps:

* Develop a unified gesture hook (for example, `useGestures`) to publish pinch, pan, tap, and long-press events from pointer and touch events.
    
* Create a central camera pinch API (for example, a `setPinchDistance` method) and link it with gesture events.
    
* Audit mobile UI components to enforce a minimum tap target size of 44px and add safe-area CSS classes.
    
* In the rendering system, for mobile devices force a canvas pixel ratio of 1 and reduce effect complexity.
    
* Use scrollable panels with `-webkit-overflow-scrolling: touch` and proper overscroll behavior.
    
* Verify that viewport settings in `layout.tsx` match best practices for mobile web apps.
    
* Test on multiple devices to ensure gesture accuracy and performance.
    

Earth-Scale or Procedural Expansion
-----------------------------------

Users request expanding the map from fixed grids to planet-scale or procedurally generated maps using real elevation data (for example, ETOPO1). This section evaluates noise functions, tiling, chunk addressing, streaming and paging, and simulation scheduling for a larger, scalable map.

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
| Codebase | Relevant modules/files | Strength for this feature | Leverage for isometric-city | Gaps/new work |
| 3d.city | `src/jsm/math/ImprovedNoise.js`, `src/micro/map/MapGenerator.js`, `src/micro/map/GameMap.js`, `src/micro/game/BlockMap.js`, `src/micro/Simulation.js`, `src/micro/map/MapUtils.js` | Provides global noise sampling, tile-based terrain generation, and block-level addressing with a phased simulation scan | Use `ImprovedNoise` as the base noise function. Adapt methods from `MapGenerator.js`, `BlockMap.js`, and `MapUtils.js` for procedural painting and chunk addressing. | No DEM ingestion from external sources; no chunk streaming; fixed-size assumptions; no LOD management. |
| isometric-city | `src/components/game/CanvasIsometricGrid.tsx`, `src/components/game/utils.ts`, `src/lib/simulation.ts` | Contains an isometric renderer with grid transforms and preallocated BFS arrays, but limited by fixed buffer sizes | Retain the isometric renderer. Replace the internal noise function with `ImprovedNoise`. Adapt BFS helpers and grid transforms to work per chunk so that the simulation can process a variable number of tiles. | No facility for DEM ingestion; fixed grid size; no streaming and paging of chunks; no planet-scale scheduling and coordinate handling. |
| OpenSC2K | `src/world/viewport.js`, `src/city/map.js`, `src/constants.js`, `src/cell/position.js`, `src/cell/tiles/heightmap.js`, `src/import/segmentHandlers/XTRF.js` | Implements view-rectangle culling over a fixed grid with heightmap layers and color mapping | Reuse culling and grid resize patterns for rendering visible chunks. Leverage height color mapping ideas for elevation overlays. | Does not provide external elevation ingestion, chunk streaming, or procedural expansion beyond a fixed grid. |

Recommended integration steps:

* Define a chunking system and indexing similar to `BlockMap.js` so that each chunk is managed individually.
    
* Develop a DEM ingestion module (for example, `dem/ingest.ts`) that reads and interpolates external elevation data such as ETOPO1 and maps it to game coordinates.
    
* Blend procedural noise (via `ImprovedNoise.js`) with DEM data to generate base elevation and add details.
    
* Implement chunk streaming by computing view bounds in `CanvasIsometricGrid.tsx` and loading or unloading chunks asynchronously.
    
* Adjust simulation scheduling to operate on a per-chunk work queue rather than a single fixed-size grid.
    
* If moving to 3D, optionally generate tiled meshes by merging geometry with utilities from `BufferGeometryUtils.js`; otherwise, adapt isometric drawing to display elevation contours.
    
* Define a per-chunk save format based on patterns in `GameMap.js` and test performance under large area simulations.
    

* * *

This document outlines the technical evaluation and integration paths for the major user-requested features of the `isometric-city` project. Each section identifies the reusable modules in referenced codebases and specifies the gaps that require new development. The integration recommendations provide step-by-step approaches to utilize existing code patterns while extending functionality to meet user requirements.

Made with ❤️ by [Driver](https://www.driver.ai/) in 20 minutes