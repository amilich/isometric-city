Untitled Page 85
================

Overview
========

This document defines rules for generating graphics for the `isometric-city` game. It provides technical guidelines so that an LLM code-generation tool can create new world sprites, UI graphics, and effects that match the engine’s geometry, rendering, and UI systems. The conventions in the `isometric-city` repository—such as tile geometry, projection formulas, and image processing parameters—serve as the source of truth for the assets.

Asset categories covered include:

* World sprites and tiles (buildings, zones, roads, rails, water, trees, overlays, base tiles)
    
* UI graphics (icons, controls, SVG icon stroke specifications)
    
* Effects and dynamic entities (particles, vehicles, pedestrians, aircraft, boats, trains, traffic, minimap rendering)
    

Expected outputs and deliverables for generated graphics:

1.  Sprite sheets delivered as PNG files placed under `/public/assets/` with background filtering applied.
    
2.  An update to the `SpritePack` configuration in `isometric-city/src/lib/renderConfig.ts` including keys, offsets, and variant sources.
    
3.  Updated type definitions in `isometric-city/src/types/game.ts` covering building and tool taxonomies.
    
4.  Confirmation that state naming, variant selection, and UI labels align with rendering requirements.
    
5.  SVG icons and additional UI graphics that follow the specified stroke and size guidelines.
    
6.  Integration changes in the game code (for example, pack loading in `Game.tsx` and context updates).
    
7.  Verified geometry compliance and UI rendering via test panels and sprite galleries.
    
8.  A QA checklist that confirms coordinate, offset, z-order, and caching requirements.
    

Visual Style Principles
=======================

The visual style is based on an isometric urban theme with clear, consistent graphics across different asset types. Graphics must remain legible at multiple zoom levels and use consistent line work, color, and geometry.

Key style principles:

* Align assets to a fixed isometric grid using shared metrics.
    
* Maintain consistent draw order to support predictable occlusion.
    
* Configure sprites with uniform pack layouts and offset values.
    
* Control visual detail using level-of-detail thresholds based on zoom and device pixel ratio.
    
* Use a shared color palette and zone colors in world and UI assets.
    
* Apply consistent line widths, strokes, and dashes.
    
* Preserve clear silhouettes and accurate aspect ratios.
    
* Limit visual noise by culling off-screen and small elements.
    
* Apply shared transforms, caching, and image processing rules.
    
* Render roads, rails, vehicles, and pedestrians with consistent priority and detail.
    
* Keep overlays and minimap elements minimal and readable.
    

|     |     |     |
| --- | --- | --- |
| Principle | Rationale | Practical Checks |
| Isometric grid alignment | Ensure correct spatial placement and predictable height | Use `TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO` (e.g. `38.4` for `TILE_WIDTH = 64` with ratio `0.60`); confirm grid transformation via `gridToScreen` and `screenToGrid`; verify using defined constants in `types.ts` and drawing utilities such as `getDiamondCorners`. |
| Depth-ordered layering | Correct occlusion and layering effects | Use canvas layers from `CanvasIsometricGrid.tsx` (e.g. `buildingsCanvasRef`, `carsCanvasRef`); sort using functions such as `insertionSortByDepth`; validate occlusion using `isEntityBehindBuilding` with exceptions for defined non-occluding types; confirm building, rail, and vehicle order in render queues. |
| Uniform sprite pack configuration | Consistent sprite sourcing and positioning | Configure `SpritePack` with required fields (`cols`, `rows`, `layout`, `spriteOrder`, `buildingToSprite`) as documented in `renderConfig.ts`; check that per-sprite offsets (e.g. `verticalOffsets`, `horizontalOffsets`) are applied consistently; verify that ordering across variants and test panels matches the specifications in `adding-asset-sheets.md`. |
| Zoom-driven LOD and DPR scaling | Maintain legibility and optimize performance | Use defined thresholds in constants (such as `ZOOM_MIN`, `ZOOM_MAX`, `CAR_MIN_ZOOM`, etc.); verify that object detail (pedestrians, trains, roads) updates with zoom levels; ensure that canvas scaling uses `ctx.scale(dpr, dpr)` and that image smoothing is disabled to maintain pixel art fidelity. |
| Controlled palette and zone colors | Consistent color meaning across world and UI | Verify that Tailwind theme tokens from `globals.css` and `tailwind.config.js` are used; ensure that color constants such as `ZONE_COLORS`, `FOUNDATION_COLORS`, and `CAR_COLORS` are applied; check that UI elements use the prescribed Tailwind classes (e.g. `bg-primary/10`, `border-primary/30`). |
| Consistent line work and geometry | Ensure a unified visual structure across elements | Confirm that drawing functions (e.g. `drawIsometricDiamond` from `drawing.ts`) apply the same stroke width and dash patterns; inspect SVG icons to ensure they use `baseStroke` values (e.g. `strokeWidth: 1.8`); check that placeholder elements use standard edge lines and that lane markings and rail components adhere to documented stroke specifications. |
| Readable silhouettes and aspect | Maintain clarity and correct proportions | Validate that sprite dimensions and offsets (from `getSpriteCoords` and `getSpriteOffsets` in `renderConfig.ts`) align sprites correctly on the grid; ensure that background filtering removes unwanted backgrounds; test visibility at low zoom using components like `SpriteTestPanel.tsx`. |
| Limit visual noise | Avoid clutter by reducing extraneous details | Verify that elements below the `SKIP_SMALL_ELEMENTS_ZOOM_THRESHOLD` are culled by functions in `constants.ts`; check that particle systems in `effectsSystems.ts` properly limit spawn rates; confirm that separate canvases are used for moving and hover layers in `CanvasIsometricGrid.tsx`. |
| Cross-asset consistency | Avoid discrepancies between different asset types | Ensure that all assets use shared transform functions (`gridToScreen`, `screenToGrid`) and constants (`TILE_WIDTH`, `TILE_HEIGHT`); check that UI icons and world sprites use consistent scaling and spacing; review the use of shared Tailwind classes for comparable text and icon sizes in both UI and overlay components. |
| Image processing and caching | Preserve crisp edges and reduce load times | Confirm that loading functions in `imageLoader.ts` (e.g. `loadSpriteImage`) remove the red background key using `BACKGROUND_COLOR` and `COLOR_THRESHOLD`; verify that images are cached via `imageCache` and that callbacks with `onImageLoaded` trigger correctly; test that filtered images are stored with the expected cache keys. |
| Roads and rails layering | Maintain clear transport visuals across zoom levels | Check that road drawing functions (from `trafficSystem.ts` and `railSystem.ts`) use the specified colors and layering order; ensure that dashed lines, arrows, and track details appear only when zoom conditions are met; verify that tie sizes and ballast details adjust with zoom, as documented. |
| Legible vehicles, aircraft, boats, pedestrians | Ensure moving entities remain easily recognizable | Inspect vehicles, aircraft, boats, and pedestrians to ensure they use polygonal or simple shapes and that rotations are applied via `DIRECTION_META`; verify that LOD functions (e.g. in `drawPedestrians.ts`) switch to simpler representations at low zoom; confirm that these elements use consistent opacity and shadow rules; test that different variants render with adequate clarity. |
| Tiles, terrain, and placeholders | Align ground assets consistently across the game | Verify that tiles use the same fixed dimensions (`TILE_WIDTH`, `TILE_HEIGHT`) and that placeholder drawings follow the same layout; check that zone fills and foundation plots are drawn per the constants in `drawing.ts`; confirm that isometric diamond functions (e.g. `getDiamondCorners`) produce predictable coordinates for each tile edge. |
| Overlays, UI, and minimap simplicity | Keep UI elements clear without obscuring essential content | Ensure that overlays and minimap items are drawn with minimal fill and stroke styles; check that overlay icons use the sizes specified (e.g. `14` for buttons in `OverlayModeToggle.tsx`); verify that the minimap uses solid cells and that the viewport rectangle is drawn as a semi-transparent overlay; test that UI panels present with consistent spacing and minimal distractions. |
| Performance and rendering setup | Optimize asset drawing to meet frame budgets | Confirm that viewport culling functions (such as `calculateViewportBounds` in `renderHelpers.ts`) limit off-screen drawing; validate that Level of Detail (LOD) settings adjust the rendering detail according to zoom; check that device pixel ratio and zoom are applied via `ctx.scale` in `setupCanvasContext`; test that caching and splitting of draw queues reduce per-frame computation. |

Isometric Rendering Principles
==============================

The renderer uses a diamond isometric projection. It converts grid coordinates to screen coordinates using the formulas that use `TILE_WIDTH` and `TILE_HEIGHT` (with `TILE_HEIGHT` defined as `TILE_WIDTH * HEIGHT_RATIO`). The camera applies scale and translation for device pixel ratio and zoom. The draw order is determined from back to front by summing the grid coordinates (`x + y`). Occlusion results from this draw order and from the use of separate canvas layers.

Key rendering rules and procedures:

* **Projection and coordinate systems:**
    
    * Tile metrics from `types.ts`:
        
        * `TILE_WIDTH = 64`
            
        * `HEIGHT_RATIO = 0.60`
            
        * `TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO`
            
    * Grid to screen conversion used in `CanvasIsometricGrid.tsx` and `utils.ts`:
        
        * Without viewport:  
            `screenX = (gridX - gridY) * (TILE_WIDTH / 2)`  
            `screenY = (gridX + gridY) * (TILE_HEIGHT / 2)`
            
        * With viewport:  
            `screenX = (x - y) * (TILE_WIDTH / 2) + offsetX`  
            `screenY = (x + y) * (TILE_HEIGHT / 2) + offsetY`
            
    * Screen to grid conversion in `utils.ts` uses an inversion of these transforms and rounding with `Math.round`.
        
    * Diamond geometry is computed using helper functions such as `getDiamondCorners` in `drawing.ts`.
        
* **Tile and sprite alignment:**
    
    * Sprites are centered on the tile by adding half-tile offsets after using `gridToScreen` (as in `drawPedestrians.ts`).
        
    * For grounded sprites, anchor to the bottom corner of the diamond.
        
    * Example tile layouts and adjustments are defined in `SpriteTestPanel.tsx`.
        
* **Depth ordering and draw queues:**
    
    * Tiles and entities are drawn in diagonal bands by iterating over `x + y` sums sorted from the farthest (lowest sum) to the nearest (highest sum).
        
    * The depth key (commonly `tileX + tileY`) is used to enforce painter’s algorithm for occlusion.
        
    * Sorting is performed using functions such as `insertionSortByDepth`.
        
* **Occlusion handling:**
    
    * Natural occlusion results from drawing order and is verified by helper functions (e.g. `isVehicleBehindBuilding`).
        
    * These functions make exceptions for non-occluding types such as `road`, `grass`, `empty`, `water`, and `tree`.
        
* **Camera and transforms:**
    
    * The canvas transform is set in the following order: reset, then `scale(dpr * zoom)`, then `translate(offset.x / zoom, offset.y / zoom)`. This ensures high-DPI and zoom scaling.
        
    * Hit-testing uses the same projection functions as rendering.
        
* **Layering and rendering surfaces:**
    
    * Multiple canvas layers are used for base maps, buildings, vehicles, and overlays.
        
    * In the SVG view for buildings, elements are drawn in a specific order: base polygons first, building faces next, and overlays last.
        
* **Viewport bounds and culling:**
    
    * The function `calculateViewportBounds` (in `renderHelpers.ts`) computes the visible area based on canvas size, offset, zoom, and padding.
        
    * This is used to skip drawing items that are outside the viewport to reduce overdraw.
        
* **Supporting utilities:**
    
    * Functions such as `gridToScreen`, `screenToGrid`, `clearCanvas`, and helpers in `CanvasIsometricGrid.tsx`, `drawing.ts`, and `renderHelpers.ts` provide consistent functionality for isometric rendering.
        

Below is a Mermaid diagram that illustrates the tile axes, camera behavior, and draw order:

    flowchart LR
      cam(Camera)
      subgraph Axes
        xAxis["Tile axis X +: east; screen uses x - y"]
        yAxis["Tile axis Y +: south; screen uses x + y"]
      end
      subgraph DrawOrder["Diagonal bands sorted by x + y"]
        b0["Band 0: x + y = 0 far"]
        b1["Band 1: x + y = 1"]
        b2["Band 2: x + y = 2"]
        bN["... near"]
      end
      cam --> b0
      xAxis --> b0
      yAxis --> b0
      b0 --> b1 --> b2 --> bN

![Mermaid Diagram](data:image/png;base64,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)

Grid and Tile Geometry
----------------------

The renderer uses a diamond isometric grid. Each world tile has a pixel width defined by `TILE_WIDTH` and a pixel height computed as `TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO`. The grid basis is defined by two vectors:

* For the +x axis: `(TILE_WIDTH / 2, TILE_HEIGHT / 2)`
    
* For the +y axis: `(-TILE_WIDTH / 2, TILE_HEIGHT / 2)`
    

Forward mapping from world to screen uses the formula with terms `(x - y)` and `(x + y)`. Inverse mapping is provided with functions (such as `screenToGrid`) that account for world offset and zoom. Depth ordering is determined by the sum `tileX + tileY`. Note that for building sprites in `IsometricBuildings.tsx`, a height ratio of `0.65` is used instead of `0.60`.

|     |     |     |     |
| --- | --- | --- | --- |
| Metric | Purpose | Source File | Example Value |
| `TILE_WIDTH` | Base tile pixel width | `isometric-city/src/components/game/types.ts` | `64` |
| `HEIGHT_RATIO` (game) | Tile height ratio for game systems | `isometric-city/src/components/game/types.ts`, `SpriteTestPanel.tsx` | `0.60` |
| `TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO` (game) | Derived tile height | `isometric-city/src/components/game/types.ts` | `38.4` (when `TILE_WIDTH = 64`) |
| `HEIGHT_RATIO` (buildings) | Tile height ratio for building SVGs | `isometric-city/src/components/buildings/IsometricBuildings.tsx` | `0.65` |
| `TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO` (buildings) | Derived tile height for buildings | `isometric-city/src/components/buildings/IsometricBuildings.tsx` | `41.6` (when `TILE_WIDTH = 64`) |
| Grid x-basis `(TILE_WIDTH/2, TILE_HEIGHT/2)` | Screen delta for one step in the +x direction | `isometric-city/src/components/game/CanvasIsometricGrid.tsx` | `(32, 19.2)` (with game values) |
| Grid y-basis `(-TILE_WIDTH/2, TILE_HEIGHT/2)` | Screen delta for one step in the +y direction | `isometric-city/src/components/game/CanvasIsometricGrid.tsx` | `(-32, 19.2)` (with game values) |
| `gridToScreen` | World-to-screen coordinate conversion | `isometric-city/src/components/game/utils.ts`, `CanvasIsometricGrid.tsx` | `screenX = (x - y) * 32 + offsetX; screenY = (x + y) * 19.2 + offsetY` |
| Tile center offset | Center point of a tile based on `gridToScreen` | Various systems | `(+32, +19.2)` (with game values) |
| `screenToGrid` (offset aware) | Inverse mapping with world offset | `isometric-city/src/components/game/utils.ts` | Example formula using adjustedX and adjustedY |
| `screenToGridForMinimap` (zoom+offset) | Inverse mapping for minimap rendering | `isometric-city/src/components/game/MiniMap.tsx` | Uses adjusted coordinates with zoom |
| Inline inverse transformation | Inverse mapping in canvas space without offset/zoom | `isometric-city/src/components/game/gridFinders.ts` | Derived using floor functions |
| Canvas transform order | Order of applying device pixel ratio, zoom, and offset | `isometric-city/src/components/game/renderHelpers.ts` | reset → scale(dpr\*zoom) → translate(offset/zoom) |
| Grid origin | Top-left grid coordinate | `isometric-city/src/components/game/CanvasIsometricGrid.tsx` | `(0, 0)` |
| Tile origin (screen) | Top-left corner of a tile from `gridToScreen` | Various systems | N/A |
| Depth key `tileX + tileY` | Used for sorting draw order and occlusion tests | `isometric-city/src/components/game/renderHelpers.ts`, `vehicleSystems.ts` | Example: for (1,2), depth = 3 |
| Diamond corners | Computed tile corners for isometric diamond shapes | `isometric-city/src/components/game/drawing.ts` | E.g.: `top(x+32,y)`, `right(x+64,y+19.2)`, etc. |
| `DIRECTION_META` vectors | Screen deltas per direction | `isometric-city/src/components/game/constants.ts` | E.g.: north: `(-32, -19.2)` |
| `createDirectionMeta.normal` | Perpendicular unit normal computation | `isometric-city/src/components/game/constants.ts` | Computed using vector math |
| Rail edges at fixed ratios | Positioning anchors for rail tracks | `isometric-city/src/components/game/railSystem.ts` | Eg.: `northEdge(x+16, y+9.6)` |
| `ISO_NS`, `ISO_EW` | Normalized axes for rail offsets | `isometric-city/src/components/game/railSystem.ts` | `{x:0.894427, y:0.447214}`, etc. |
| `offsetPoint` | Helper function for applying perpendicular offsets | `isometric-city/src/components/game/railSystem.ts` | Example: offset by `perp.x*amount` |
| Sprite cell size | Dimensions of each cell in a sprite sheet | `isometric-city/src/lib/renderConfig.ts` | Computed as floor(sheetW/cols) |
| Sprite indexing | Mapping of index to grid cell position | `isometric-city/src/lib/renderConfig.ts` | E.g., row = floor(index/cols), col = index mod cols |
| Sprite cell origin | Top-left origin in a sprite sheet cell | `isometric-city/src/lib/renderConfig.ts` | N/A |

Below is a simplified example demonstrating coordinate transformations and tile-to-pixel calculations:

    // Tile metrics for game systems
    const TILE_WIDTH = 64;
    const HEIGHT_RATIO = 0.60;
    const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO; // 38.4
    
    // Basis vectors for screen deltas per tile step
    const BASIS_X = { dx: TILE_WIDTH / 2, dy: TILE_HEIGHT / 2 };   // (32, 19.2)
    const BASIS_Y = { dx: -TILE_WIDTH / 2, dy: TILE_HEIGHT / 2 };  // (-32, 19.2)
    
    // World to Screen conversion
    function gridToScreen(x: number, y: number, offsetX = 0, offsetY = 0) {
      const screenX = (x - y) * (TILE_WIDTH / 2) + offsetX;
      const screenY = (x + y) * (TILE_HEIGHT / 2) + offsetY;
      return { screenX, screenY };
    }
    
    // Tile rectangle and center in screen space
    function tileRectForGrid(x: number, y: number, offsetX = 0, offsetY = 0) {
      const { screenX, screenY } = gridToScreen(x, y, offsetX, offsetY);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      return { x: screenX, y: screenY, centerX, centerY, w: TILE_WIDTH, h: TILE_HEIGHT };
    }
    
    // Screen to World conversion (offset aware)
    function screenToGrid(screenX: number, screenY: number, offsetX = 0, offsetY = 0) {
      const adjustedX = screenX - offsetX - TILE_WIDTH / 2;
      const adjustedY = screenY - offsetY - TILE_HEIGHT / 2;
      const gx = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
      const gy = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
      return { x: gx, y: gy };
    }

Layout and Offsets
------------------

Offsets are used to anchor sprites onto the isometric grid and ensure proper ground contact. The function `gridToScreen` computes base screen coordinates from grid values. The anchor may be the tile center (for moving entities) or the diamond’s bottom corner (for grounded sprites). Pack-specific horizontal and vertical offsets are applied from configuration fields in `renderConfig.ts` using helper functions like `getSpriteOffsets`. Additional offsets may be applied by systems (e.g. for lane or pedestrian activity adjustments). The camera offset is applied as a translation by dividing by `zoom` in the canvas context.

|     |     |     |     |
| --- | --- | --- | --- |
| Field | Meaning | Typical Range | Notes |
| `TILE_WIDTH`, `TILE_HEIGHT`, `HEIGHT_RATIO` | Tile pixel size and height ratio | `tileW = 64`, `tileH = 0.6 * tileW` | Use these to determine sprite scales and offsets. |
| `gridToScreen(x, y, offsetX, offsetY)` | Convert grid coordinates to screen coordinates | n/a | Formula: `screenX = (x - y) * (TILE_WIDTH / 2) + offsetX`, `screenY = (x + y) * (TILE_HEIGHT / 2) + offsetY`. |
| `screenToGrid(screenX, screenY, offsetX, offsetY)` | Inverse of `gridToScreen` | n/a | Adjusts coordinates by subtracting offsets and half tile dimensions. |
| `centerX`, `centerY` | Tile center anchor position | n/a | Computed as `centerX = screenX + TILE_WIDTH / 2`, `centerY = screenY + TILE_HEIGHT / 2`. |
| `getDiamondCorners` | Returns the four corners of the isometric diamond | n/a | Bottom corner is `{ x: x + TILE_WIDTH / 2, y: y + TILE_HEIGHT }`; used for anchoring grounded sprites. |
| `offset.x`, `offset.y` | World (camera) offset in pixels | Any positive or negative | Used in context translation via `ctx.translate(offset.x / zoom, offset.y / zoom)`. |
| `zoom` | Scaling factor for view | Positive values only | Applied to screen space; offsets are divided by this value. |
| `horizontalOffsets[spriteKey]` | Horizontal offset per sprite key | Multiples of `TILE_WIDTH` (e.g. `-0.4`) | Resolved by `getSpriteOffsets`, defaulting to `0` if unspecified. |
| `verticalOffsets[spriteKey]` | Vertical offset per sprite key | Multiples of `TILE_HEIGHT` (e.g. `-0.4`) | Resolved by `getSpriteOffsets`, defaulting to `0` if unspecified. |
| `buildingVerticalOffsets[type]` | Override vertical offset per building type | Multiples of `TILE_HEIGHT` | Overrides common offsets when a sprite is shared. |
| `getSpriteOffsets(spriteKey)` | Returns an object specifying per-sprite offsets | n/a | Reads values from configured offset objects and applies defaults. |

The code below demonstrates how to compute the top-left drawing position for a sprite, considering various offsets and camera translation:

    type Offsets = { horizontal: number; vertical: number };
    type Vec2 = { x: number; y: number };
    
    function gridToScreen(x: number, y: number, tileW: number, tileH: number, offsetX = 0, offsetY = 0): Vec2 {
      const screenX = (x - y) * (tileW / 2) + offsetX;
      const screenY = (x + y) * (tileH / 2) + offsetY;
      return { x: screenX, y: screenY };
    }
    
    function resolvePackOffsets(spriteKey: string): Offsets {
      const offs = getSpriteOffsets(spriteKey); // { horizontal: number, vertical: number }
      return offs ?? { horizontal: 0, vertical: 0 };
    }
    
    interface DrawParams {
      tileX: number;
      tileY: number;
      tileW: number;
      tileH: number;
      spriteKey: string;
      destW: number; // destination width in pixels
      destH: number; // destination height in pixels
      anchor: 'center' | 'bottom';
      worldOffset: Vec2;
      zoom: number;
      extra?: Vec2;
    }
    
    function computeDrawPosition(p: DrawParams): Vec2 {
      // 1) Base tile position without camera offset.
      const base = gridToScreen(p.tileX, p.tileY, p.tileW, p.tileH);
    
      // 2) Choose the anchor point.
      const anchorX = base.x + p.tileW / 2;
      const anchorY = p.anchor === 'bottom' ? base.y + p.tileH : base.y + p.tileH / 2;
    
      // 3) Resolve per-sprite pack offsets.
      const pack = resolvePackOffsets(p.spriteKey);
      const packX = pack.horizontal * p.tileW;
      const packY = pack.vertical * p.tileH;
    
      // 4) Apply optional extra offsets.
      const exX = p.extra?.x ?? 0;
      const exY = p.extra?.y ?? 0;
    
      // 5) Convert anchor to top-left draw position.
      const topLeftX = anchorX + packX + exX - p.destW / 2;
      const topLeftY = (p.anchor === 'bottom' ? anchorY - p.destH : anchorY - p.destH / 2) + packY + exY;
    
      // 6) Apply camera translation.
      const camX = topLeftX + p.worldOffset.x / p.zoom;
      const camY = topLeftY + p.worldOffset.y / p.zoom;
    
      return { x: camX, y: camY };
    }

Sprite Pack Configurations
==========================

A sprite pack is a TypeScript object that conforms to the `SpritePack` interface defined in `src/lib/renderConfig.ts`. Each pack specifies the main sprite sheet grid, the order of sprite keys, mappings from building types to sprite keys, and per-sprite offsets. Optional fields allow for variant sheets and specialized mapping. Sprite packs must be registered in `SPRITE_PACKS` and can be read using functions such as `getSpritePack` and `setActiveSpritePack`. All asset paths are absolute (beginning with `/assets/`).

|     |     |     |     |
| --- | --- | --- | --- |
| Config Field | Type | Required | Description |
| `id` | `string` | Yes | Unique identifier for the sprite pack. Used for selection and persistence. |
| `name` | `string` | Yes | Display name for the pack in the UI. |
| `src` | `string` | Yes | Path to the main sprite sheet (e.g. `'/assets/sprites.png'`). Must be under `/public/assets/`. |
| `cols` | `number` | Yes | Number of columns in the main sprite sheet grid. |
| `rows` | `number` | Yes | Number of rows in the main sprite sheet grid. |
| `layout` | `'row' \| 'column'` | Yes | Grid addressing order. Use `'row'` for row-major, `'column'` for column-major. |
| `spriteOrder` | `readonly string[]` | Yes | Array of sprite keys in the order they appear on the sheet. Must include all keys used by `buildingToSprite`. |
| `verticalOffsets` | `Record<string, number>` | Yes | Vertical pixel offsets for each sprite key in the main sheet. |
| `horizontalOffsets` | `Record<string, number>` | Yes | Horizontal pixel offsets for each sprite key in the main sheet. |
| `buildingToSprite` | `Record<string, string>` | Yes | Mapping from building type to a sprite key from `spriteOrder`. |
| `constructionSrc` | `string` | No  | Path to the construction variant sheet. |
| `abandonedSrc` | `string` | No  | Path to the abandoned variant sheet. |
| `denseSrc` | `string` | No  | Path to the dense variant sheet. |
| `modernSrc` | `string` | No  | Path to the modern variant sheet. |
| `parksSrc` | `string` | No  | Path to the parks sheet (required if using parks sheets). |
| `parksConstructionSrc` | `string` | No  | Path to the parks construction variant sheet. |
| `farmsSrc` | `string` | No  | Path to the farms category sheet. |
| `shopsSrc` | `string` | No  | Path to the shops category sheet. |
| `stationsSrc` | `string` | No  | Path to the stations category sheet. |
| `denseVariants` | `Record<string, Array<{ row: number; col: number }>>` | No  | Mapping from building type to an array of variant cell coordinates for dense mode. |
| `modernVariants` | `Record<string, Array<{ row: number; col: number }>>` | No  | Mapping from building type to an array of variant cell coordinates for modern mode. |
| `parksBuildings` | `Record<string, { row: number; col: number }>` | No  | Mapping from building type to cell coordinates for the parks sheet (required if using parks sheets). |
| `parksCols` | `number` | No  | Number of columns in the parks sheet grid (required if using parks sheets). |
| `parksRows` | `number` | No  | Number of rows in the parks sheet grid (required if using parks sheets). |
| `buildingVerticalOffsets` | `Record<string, number>` | No  | Vertical offsets per building type for the main sprite sheet. |

Below is an example of a complete sprite pack configuration:

    import type { SpritePack } from '@/lib/renderConfig';
    
    export const SPRITE_PACK_SPRITES4_CUSTOM: SpritePack = {
      id: 'sprites4_custom',
      name: 'Sprites 4 Custom',
      src: '/assets/sprites_red_water_new.png',
      cols: 10,
      rows: 8,
      layout: 'row',
    
      // Sprite keys in sheet order
      spriteOrder: [
        'house',
        'factory',
        'road',
        'water',
        'park_bench',
        'farm',
        'shop',
        'station',
      ] as const,
    
      // Main sheet offsets per sprite key
      verticalOffsets: {
        house: -6,
        factory: -8,
        road: 0,
        water: 0,
        park_bench: -4,
        farm: -2,
        shop: -6,
        station: -10,
      },
      horizontalOffsets: {
        house: 0,
        factory: 0,
        road: 0,
        water: 0,
        park_bench: 0,
        farm: 0,
        shop: 0,
        station: 0,
      },
    
      // Map building types to sprite keys
      buildingToSprite: {
        residential: 'house',
        industrial: 'factory',
        road: 'road',
        water: 'water',
        park: 'park_bench',
        farm: 'farm',
        shop: 'shop',
        station: 'station',
      },
    
      // Optional variant sheets
      constructionSrc: '/assets/sprites_red_water_new_construction.png',
      abandonedSrc: '/assets/sprites_red_water_new_abandoned.png',
      denseSrc: '/assets/sprites_red_water_new_dense.png',
      modernSrc: '/assets/sprites_red_water_new_modern.png',
      parksSrc: '/assets/sprites_red_water_new_parks.png',
      parksConstructionSrc: '/assets/sprites_red_water_new_parks_construction.png',
      farmsSrc: '/assets/sprites_red_water_new_farms.png',
      shopsSrc: '/assets/sprites_red_water_new_shops.png',
      stationsSrc: '/assets/sprites_red_water_new_stations.png',
    
      // Optional variant mappings
      denseVariants: {
        residential: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
        industrial: [{ row: 1, col: 0 }],
      },
      modernVariants: {
        shop: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
      },
    
      // Parks sheet grid and mapping
      parksCols: 5,
      parksRows: 6,
      parksBuildings: {
        park: { row: 2, col: 3 },
      },
    
      // Optional offset and scale overrides
      buildingVerticalOffsets: {
        residential: -7,
        industrial: -9,
      },
      constructionVerticalOffsets: {
        residential: -5,
        industrial: -7,
        park: -3,
      },
      constructionScales: {
        residential: 1.0,
        industrial: 1.05,
      },
      parksVerticalOffsets: {
        park: -4,
      },
      parksHorizontalOffsets: {
        park: 0,
      },
      parksScales: {
        park: 1.0,
      },
    };

Variants and Styling
--------------------

Variants provide alternative sprites or drawing rules for the same entity. At runtime, the renderer selects a variant based on parameters such as the sprite pack, building state, time-of-day, adjacency, and zoom level. When a variant is not available, a fallback is used.

Common variant categories include:

* Theme variants from different `SpritePack` entries.
    
* State variants for construction, abandoned, dense, or modern states.
    
* Time-of-day variants using `dayNightMode` and `visualHour`.
    
* Environmental adjustments such as flipping via `getWaterAdjacency` or `getRoadAdjacency`.
    
* Variants for specific actor types (aircraft, trains, pedestrians).
    

|     |     |     |     |
| --- | --- | --- | --- |
| Variant Type | Purpose | Selection Trigger | Fallback |
| Sprite pack (thematic) | Change full art theme | User selection via `SettingsPanel` using `setSpritePack` | First available pack in `SPRITE_PACKS` |
| Grouped sheet variants | Use group-specific art (parks, farms, etc.) | Presence in a mapping such as `parksBuildings` | Base sheet from the active sprite pack |
| Construction | Indicate building construction stages | When `constructionProgress < 100` (with additional thresholds) | Base sheet when construction sheet is missing |
| Abandoned | Show damaged or abandoned state | When `isAbandoned` is true and an abandoned sheet exists | Base sheet |
| Dense/Modern | Add visual variety (dense or modern layout) | Deterministic seeding based on tile coordinates | Use standard sprite coordinates |
| Flip (mirror) | Adjust orientation against roads/water | When `getRoadAdjacency` or `Building.flipped` is true | Do not flip |
| Time-of-day lights | Add navigation headlights or similar | When `visualHour` indicates night | Draw without lights |
| Aircraft type/direction | Determine plane sprite row/col | Using `getPlaneSprite` based on type and direction | Fallback drawing function |
| Train carriages | Determine carriage appearance | Based on partitioning and random consistency in `trainSystem.ts` | Minimal representation for missing parts |
| Boat variant | Adjust boat sprite scaling and colors | When a specific boat size or color variant applies | Default boat sprite with current scale |
| Pedestrian LOD/activity | Simplify pedestrian drawing at low zoom | Zoom thresholds from `LOD_SIMPLE_ZOOM` and `LOD_MEDIUM_ZOOM` | Use simplified pedestrian sprite |
| Image filtered variant | Use a sprite with background removal applied | When image loader is invoked with filtering enabled | Cached standard image without filtering |
| Placeholder building | Draw when asset is missing | When sprite cannot be loaded | Use placeholder colors and `drawPlaceholderBuilding` |

Below is an example function for variant selection:

    export const variantPolicy = {
      defaultPackId: 'sprites4',
      groups: ['parks', 'farms', 'shops', 'stations'] as const,
      order: ['groupConstruction', 'construction', 'abandoned', 'groupMain', 'dense', 'modern', 'base'] as const,
      denseGate: { a: 31, b: 17, mod: 100, threshold: 30 },
      modernGate: { a: 17, b: 31, mod: 100, threshold: 20 },
      lightsStartHour: 20,
      lightsEndHour: 6
    };
    
    type VariantPick = {
      sheet: HTMLImageElement | null;
      row: number;
      col: number;
      flip: boolean;
    };
    
    function seeded(tileX: number, tileY: number, a: number, b: number, mod: number): number {
      return ((tileX * a + tileY * b) % mod + mod) % mod;
    }
    
    export function selectBuildingVariant(ctx: {
      buildingType: string;
      constructionProgress: number;
      isAbandoned: boolean;
      tileX: number;
      tileY: number;
      flipped?: boolean;
      activePackId?: string;
      visualHour: number;
    }): VariantPick {
      const pack =
        getSpritePack(ctx.activePackId) ??
        getSpritePack(variantPolicy.defaultPackId) ??
        SPRITE_PACKS[0];
    
      const inParks = !!pack.parksBuildings?.[ctx.buildingType];
      const group = inParks ? 'parks' :
        (pack.farmsVariants && pack.farmsVariants[ctx.buildingType] ? 'farms' :
        (pack.shopsVariants && pack.shopsVariants[ctx.buildingType] ? 'shops' :
        (pack.stationsVariants && pack.stationsVariants[ctx.buildingType] ? 'stations' : null)));
    
      if (ctx.constructionProgress < 40) {
        return { sheet: null, row: -1, col: -1, flip: false };
      }
      if (ctx.constructionProgress < 100) {
        const sheet =
          (group === 'parks' && pack.parksConstructionSrc && getCachedImage(pack.parksConstructionSrc)) ||
          (pack.constructionSrc && getCachedImage(pack.constructionSrc)) ||
          (pack.src && getCachedImage(pack.src)) ||
          null;
        const coords = getSpriteCoords(ctx.buildingType, pack) ?? { row: 0, col: 0 };
        return { sheet, row: coords.row, col: coords.col, flip: !!ctx.flipped };
      }
      if (ctx.isAbandoned && pack.abandonedSrc) {
        const sheet = getCachedImage(pack.abandonedSrc);
        const coords = getSpriteCoords(ctx.buildingType, pack) ?? { row: 0, col: 0 };
        return { sheet, row: coords.row, col: coords.col, flip: !!ctx.flipped };
      }
      const dSeed = seeded(ctx.tileX, ctx.tileY, variantPolicy.denseGate.a, variantPolicy.denseGate.b, variantPolicy.denseGate.mod);
      const mSeed = seeded(ctx.tileX, ctx.tileY, variantPolicy.modernGate.a, variantPolicy.modernGate.b, variantPolicy.modernGate.mod);
      if (group === 'parks' && pack.parksSrc) {
        const sheet = getCachedImage(pack.parksSrc);
        const coords = getSpriteCoords(ctx.buildingType, pack) ?? { row: 0, col: 0 };
        return { sheet, row: coords.row, col: coords.col, flip: !!ctx.flipped };
      }
      if (pack.denseSrc && dSeed < variantPolicy.denseGate.threshold) {
        const dv = pack.denseVariants?.[ctx.buildingType];
        if (dv) {
          const sheet = getCachedImage(pack.denseSrc);
          return { sheet, row: dv[0].row, col: dv[0].col, flip: !!ctx.flipped };
        }
      }
      if (pack.modernSrc && mSeed < variantPolicy.modernGate.threshold) {
        const mv = pack.modernVariants?.[ctx.buildingType];
        if (mv) {
          const sheet = getCachedImage(pack.modernSrc);
          return { sheet, row: mv[0].row, col: mv[0].col, flip: !!ctx.flipped };
        }
      }
      const baseSheet = getCachedImage(pack.src);
      const baseCoords = getSpriteCoords(ctx.buildingType, pack);
      if (baseSheet && baseCoords) {
        return { sheet: baseSheet, row: baseCoords.row, col: baseCoords.col, flip: !!ctx.flipped };
      }
      return { sheet: null, row: -1, col: -1, flip: false };
    }

Sprite Sheets Preparation and Configuration
-------------------------------------------

Prepare sprite sheets so that the engine can load and draw them using functions such as those in `imageLoader.ts`. Follow these steps:

1.  **Asset location and naming:**
    
    * Place PNG files in `/public/assets/`.
        
    * Use the same grid layout for the main sheet and all variants.
        
    * Example names: `sprites_red_water_new_parks.png`, `sprites_red_water_new_parks_construction.png`.
        
2.  **Background color and filtering:**
    
    * Use a uniform background color on each sheet.
        
    * The image pipeline removes the background with color `BACKGROUND_COLOR` (`{ r: 255, g: 0, b: 0 }`) using a threshold `COLOR_THRESHOLD` (`155`).
        
    * Save images as PNGs to preserve transparency.
        
    * To apply filtering, call `loadSpriteImage` with filtering enabled.
        
3.  **Grid alignment and layout:**
    
    * Define the grid layout by setting `cols` and `rows` in the sprite pack.
        
    * Set the `layout` field to `'row'` or `'column'` to control sequencing.
        
    * The function `getSpriteCoords` divides the image dimensions by `cols` and `rows` to determine the source rectangle.
        
    * For group sheets (e.g. parks), specify grid properties like `parksCols` and `parksRows` in `renderConfig.ts`.
        
4.  **Frame ordering:**
    
    * Maintain sequential order across the sheet.
        
    * Use `spriteOrder` in the sprite pack to define the sequence.
        
    * Map game building types to sprite keys using `buildingToSprite`.
        
    * Ensure that parks and other grouped variants use 0-indexed coordinates in their mapping objects.
        
5.  **Offsets, trimming, and padding:**
    
    * Do not trim images in a way that alters frame order.
        
    * If padding is added, apply it uniformly.
        
    * Use configured offsets (`verticalOffsets`, `horizontalOffsets`) to align sprites to the tile grid.
        
    * In certain packs (such as `sprites4`), `getSpriteCoords` applies small row-based adjustments.
        
6.  **Required metadata structures:**
    
    * The sprite pack object must include fields such as `id`, `name`, `src`, and optional variant sources.
        
    * It must also contain grid definitions (`cols`, `rows`, `layout`) and ordering (`spriteOrder`, `buildingToSprite`).
        
    * Additional variant mappings (e.g. `denseVariants`, `modernVariants`) should be provided as needed.
        
7.  **Loading sequence and priority:**
    
    * Load the main sprite sheet with filtering enabled.
        
    * Load water textures, then secondary sheets (construction, abandoned, dense, parks, etc.) after a short delay.
        
    * Load airplane sheets without filtering.
        
    * Use caching functions such as `getCachedImage` for performance.
        
8.  **Integration notes:**
    
    * Follow the guidelines in `adding-asset-sheets.md` to match grid dimensions and mappings.
        
    * Ensure there are no extra margins – if needed, compensate via offset configuration.
        

Below is an excerpt from a configuration file demonstrating sprite sheet metadata and loader configuration:

    // renderConfig.ts — sprite sheet metadata
    export type SpritePack = {
      id: string;
      name: string;
      src: string;
      constructionSrc?: string;
      abandonedSrc?: string;
      denseSrc?: string;
      parksSrc?: string;
      parksConstructionSrc?: string;
      modernSrc?: string;
      farmsSrc?: string;
      shopsSrc?: string;
      stationsSrc?: string;
      cols: number;
      rows: number;
      layout: 'row' | 'column';
      spriteOrder: string[];
      buildingToSprite: Record<string, string>;
      verticalOffsets?: Record<string, number>;
      horizontalOffsets?: Record<string, number>;
      buildingVerticalOffsets?: Record<string, number>;
    };
    
    export const currentSpritePack: SpritePack = {
      id: 'sprites4',
      name: 'Red Water',
      src: '/assets/sprites_red_water_main.png',
      constructionSrc: '/assets/sprites_red_water_construction.png',
      abandonedSrc: '/assets/sprites_red_water_abandoned.png',
      denseSrc: '/assets/sprites_red_water_dense.png',
      parksSrc: '/assets/sprites_red_water_new_parks.png',
      parksConstructionSrc: '/assets/sprites_red_water_new_parks_construction.png',
      modernSrc: '/assets/sprites_red_water_modern.png',
      farmsSrc: '/assets/sprites_red_water_farms.png',
      shopsSrc: '/assets/sprites_red_water_shops.png',
      stationsSrc: '/assets/sprites_red_water_stations.png',
      cols: 12,
      rows: 8,
      layout: 'row',
      spriteOrder: ['residential', 'commercial', 'space_program' /* ... */],
      buildingToSprite: {
        // mapping from building types to sprite keys
      },
      verticalOffsets: { /* key: px */ },
      horizontalOffsets: { /* key: px */ },
      buildingVerticalOffsets: { /* building type: px */ },
    };
    
    // In imageLoader.ts
    export const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
    export const COLOR_THRESHOLD = 155;
    
    export async function loadSpriteImage(src: string, applyFilter: boolean): Promise<HTMLImageElement> {
      const cacheKey = `${src}::filter=${applyFilter ? 1 : 0}`;
      const cached = imageCache.get(cacheKey);
      if (cached) return cached;
    
      const img = await loadImage(src);
      const finalImg = applyFilter ? await filterBackground(img, BACKGROUND_COLOR, COLOR_THRESHOLD) : img;
      imageCache.set(cacheKey, finalImg);
      return finalImg;
    }

Domain-Specific Sprite Guidelines
=================================

Asset-specific guidelines ensure that sprites for buildings, aircraft, vehicles, and pedestrians integrate seamlessly with the engine’s logic. Each domain has defined scales, orientations, ground-contact rules, animation cadences, and selection boundaries. Reference modules such as `IsometricBuildings.tsx`, `drawAircraft.ts`, and `drawPedestrians.ts` to implement these guidelines.

|     |     |     |     |
| --- | --- | --- | --- |
| Domain | Key Constraints | Source Modules | Notes |
| All Domains | Base tile width as `TILE_WIDTH = 64`, tile height derived from a ratio; use `getSpriteCoords`; apply pack offsets and clamped frame deltas. | `renderConfig.ts`, `CanvasIsometricGrid.tsx`, `SpriteTestPanel.tsx` | Use the standard `SPRITE_PACK_SPRITES4` for preview; test panel sizes are for visualization only. |
| Buildings | Multi-tile footprints defined by `BUILDING_SIZES` and `TOOL_INFO`; use `getDiamondCorners` for isometric diamond anchors; support horizontal flip using adjacency functions; vertical offsets applied for bases. | `IsometricBuildings.tsx`, `buildingHelpers.ts`, `drawing.ts`, `placeholders.ts`, `renderConfig.ts` | Use specific scale factors from configuration (e.g. `constructionScales`, `modernScales`); placeholders use `drawPlaceholderBuilding` for missing sprites. |
| Aircraft | Scale based on `PLANE_SCALES` with altitude adjustments; determine direction via `angleToDirection` and `PLANE_DIRECTION_COLS`; draw shadows and contrails based on altitude; require water checks for seaplanes. | `drawAircraft.ts`, `aircraftSystems.ts`, `seaplaneSystem.ts`, `constants.ts` | Apply rotation offsets from `getRotationOffset`; use fallback drawing functions (`drawFallbackAirplane`/`drawFallbackSeaplane`) when assets are missing. |
| Vehicles | Scale factors for road vehicles, emergency vehicles, trains, boats, and barges; use `DIRECTION_META` for orientation; lane offsets applied for vehicles; group train carriages and lanes by grid. | `vehicleSystems.ts`, `trainSystem.ts`, `railSystem.ts`, `boatSystem.ts`, `bargeSystem.ts` | Road vehicles are drawn only when on designated roads; trains use spatial indices for pathing; vehicles use defined color constants (`CAR_COLORS`) and lane offset rules. |
| Pedestrians | Typical scale around 0.30 for walking pedestrians; use `LOD_SIMPLE_ZOOM` and `LOD_MEDIUM_ZOOM` for detail adjustment; position based on tile center plus activity offsets. | `drawPedestrians.ts`, `pedestrianSystem.ts`, `CanvasIsometricGrid.tsx` | Random activity offsets (`activityOffsetX`, `activityOffsetY`) applied; pedestrian drawing simplified when zoom is low; selection hits based on tile extents adjusted for activity. |

Below is an example asset definition for a building:

    type DomainSpriteAsset = {
      domain: 'building' | 'aircraft' | 'vehicle' | 'pedestrian'
      id: string
      tiles?: { w: number; h: number }
      sheet: {
        pack: string
        layout?: 'row' | 'column'
        cols?: number
        rows?: number
        spriteKey?: string
      }
      scale?: {
        basePack?: number
        categoryKey?: string
        base?: number
      }
      offsets?: {
        vertical?: { table?: string; proxy?: string; value?: number }
        horizontal?: { proxy?: string; value?: number }
      }
      placement?: {
        anchor: 'originTileBottom' | 'tileCenter' | 'track' | 'water'
        originFn?: string
        diamondFn?: string
      }
      orientation?: {
        flip?: 'auto' | 'none'
        flipRules?: string[]
        overrideFlag?: string
        directionMap?: string
        angleFn?: string
      }
      animation?: {
        overlay?: string
        enabledFlag?: string
        particles?: { spawnInterval?: number; maxAge?: number }
      }
      selection?: { mode: 'tileFootprint' | 'diamond' | 'position' }
    }
    
    const hospitalAsset: DomainSpriteAsset = {
      domain: 'building',
      id: 'hospital',
      tiles: { w: 2, h: 2 },
      sheet: {
        pack: 'SPRITE_PACK_SPRITES4',
        layout: 'row',
        cols: 5,
        rows: 6,
        spriteKey: 'hospital'
      },
      scale: {
        basePack: 0.8,
        categoryKey: 'modernScales'
      },
      offsets: {
        vertical: { table: 'buildingVerticalOffsets', proxy: 'SPRITE_VERTICAL_OFFSETS', value: 0 },
        horizontal: { proxy: 'SPRITE_HORIZONTAL_OFFSETS', value: 0 }
      },
      placement: {
        anchor: 'originTileBottom',
        originFn: 'findBuildingOrigin',
        diamondFn: 'getTilePoints'
      },
      orientation: {
        flip: 'auto',
        flipRules: ['getRoadAdjacency', 'getWaterAdjacency'],
        overrideFlag: 'Building.flipped'
      },
      animation: {
        overlay: 'FireOverlay',
        enabledFlag: 'onFire'
      },
      selection: { mode: 'tileFootprint' }
    }

Color, Lighting, and Image Processing
=====================================

The game uses a consistent color and lighting system to achieve an urban, isometric aesthetic. World materials rely on fixed hex palettes, while UI elements use Tailwind theme tokens. Lighting is applied using ambient overlays and localized glows. Image processing removes a red key background to preserve pixel-art clarity.

Key points:

* **Palette tokens:**  
    Defined in `tailwind.config.js` and mapped via CSS variables in `globals.css` (e.g. `--background`, `--primary`), then applied using Tailwind classes such as `bg-primary` or `text-muted-foreground`.
    
* **World materials:**  
    Colors for tiles and building faces come from constants such as `ZONE_COLORS`, `GREY_TILE_COLORS`, and `FOUNDATION_COLORS`, and these values are used in drawing functions (e.g. in `drawing.ts`).
    
* **MiniMap palette:**  
    Uses fixed colors defined in `MiniMap.tsx` and draws the viewport with a semi-transparent stroke.
    
* **Entity color arrays:**  
    Vehicle, pedestrian, and aircraft color arrays are defined in `constants.ts` (e.g. `CAR_COLORS`, `AIRPLANE_COLORS`).
    
* **Image filtering:**  
    The loader, via `filterBackgroundColor` in `imageLoader.ts`, computes the Euclidean distance from each pixel’s color to the `BACKGROUND_COLOR` (`{ r: 255, g: 0, b: 0 }`) and sets alpha to 0 when the distance is below `COLOR_THRESHOLD` (`155`).
    
* **Lighting effects:**  
    The ambient darkness is computed in `getDarkness` in `CanvasIsometricGrid.tsx` based on the current hour (`visualHour`). Local glows, such as those for aircraft navigation lights or train smoke, are drawn with canvas gradients and shadow settings.
    

Below is an example code snippet for the background filtering:

    const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
    const COLOR_THRESHOLD = 155;
    
    export function filterBackgroundColor(src: HTMLImageElement): HTMLCanvasElement {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = src.naturalWidth;
      canvas.height = src.naturalHeight;
    
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0);
    
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = img.data;
    
      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - BACKGROUND_COLOR.r;
        const dg = data[i + 1] - BACKGROUND_COLOR.g;
        const db = data[i + 2] - BACKGROUND_COLOR.b;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist <= COLOR_THRESHOLD) {
          data[i + 3] = 0;
        }
      }
    
      ctx.putImageData(img, 0, 0);
      return canvas;
    }

Interface Graphics: Panels and Mobile
=====================================

UI graphics must integrate with the isometric game design. Panels and mobile UI elements follow consistent spacing, typography, and iconography rules. This ensures that desktop and mobile interfaces appear uniform and legible.

Key guidelines:

* **Panel layout:**  
    Panels such as `AdvisorsPanel`, `BudgetPanel`, `SettingsPanel`, and `StatisticsPanel` use standard components (`Dialog`, `Card`) with defined max widths, heights, and spacing (e.g. `max-w-[500px]`, `space-y-6`).
    
* **AdvisorsPanel:**  
    Displays advisor messages, using a rating card with a badge (e.g. `w-16 h-16`, text size `text-3xl`) and scrollable message lists.
    
* **BudgetPanel:**  
    Uses a grid layout (`grid grid-cols-3 gap-4`) and defines numeric styles (`font-mono`, income in `text-green-400`, expenses in `text-red-400`).
    
* **SettingsPanel:**  
    Uses a scrollable dialog with small text (`text-[10px]`, `text-xs`) and sprite icons rendered with pixelated scaling.
    
* **StatisticsPanel:**  
    Displays stats in card layouts with responsive text sizes and graphs drawn on canvases with specified background and grid colors.
    
* **Sidebar and CommandMenu:**  
    Tools are represented as icons in grids; icons are drawn from `@/components/ui/Icons` with sizes such as `16` and proper active/inactive states.
    
* **Mobile interface:**  
    Mobile top bars and toolbars are implemented with fixed position `Card` components, with safe area adjustments using CSS variables from `globals.css`. Icons and quick tools have defined sizes and spacing rules.
    

The following table summarizes component requirements:

|     |     |     |     |
| --- | --- | --- | --- |
| Component | Purpose | Visual Requirements | Interaction Considerations |
| `AdvisorsPanel` | Show city rating and advisor messages | Dialog with `max-w-[500px]`, rating card with `bg-primary/10` and grade badge sized `w-16 h-16` | Always open; icons from `ADVISOR_ICON_MAP` with fallback `InfoIcon` |
| `BudgetPanel` | Display income, expenses, and net | Dialog with `max-w-[500px]`; grid layout `grid grid-cols-3 gap-4`; numeric text using `font-mono` | Controls with `flex items-center`, labels with fixed width |
| `SettingsPanel` | Configure game options and asset selection | Dialog with `max-w-[400px]`, scrollable content, headings in uppercase and minimal text size | Buttons use variants and small text; sprite icons rendered pixelated |
| `StatisticsPanel` | Present stats, history graphs, and tabs | Dialog with `max-w-[600px]`; cards with responsive padding; graph canvas with defined background colors | Tabs for dataset switching; responsive typography using `sm:` prefixes |
| `TileInfoPanel` | Display detailed tile information | Card layout, close icon (`CloseIcon size={14}`); desktop as a small floating panel, mobile as full-width | Mobile panel offsets respect safe areas; uses separators for clarity |
| `Sidebar` | Quick access to panels/tools | Grid layout for button icons from `@/components/ui/Icons` (e.g. `size={16}`) | Toggle panels based on active state with onClick handlers |
| `CommandMenu` | Desktop command palette for panels | List items with ids `panel-[panel]`; rendered only on desktop | Does not render on mobile |
| `TopBar` | Display mini stats and time-of-day | Fixed height bar (`h-14`), contains a `StatsPanel` with mini icons (`size={12}`) and numeric text styles | Static display; uses `TimeOfDayIcon` with day color indications |
| `MobileTopBar` | Mobile status bar with key metrics | Fixed at top, with lower text sizes (`text-xs`, `text-[9px]`), icons (`w-3 h-3`) | Speed buttons and exit buttons with hover and active states |
| `MobileToolbar` | Mobile quick tool access and panel toggling | Fixed at bottom, with button icons (`h-11 w-11`), arranged in a flex grid with gap and padding | Toggles expanded menu overlay; uses state maps for quick tool icons |

Screenshot Cropping for Mobile
------------------------------

To prepare screenshots for iPhone display, the top and bottom parts of the image are cropped to focus on the central area. A Bash script is used with ImageMagick to perform this fixed cropping.

Steps:

1.  Start the process by running `npm run crop-screenshots` or `bash scripts/crop-screenshots.sh`.
    
2.  Set the input directory variable `GAMES_DIR` to `public/games`.
    
3.  Validate the directory exists; if not, output an error message and exit.
    
4.  Enumerate all PNG/PNG files in the directory, verifying each exists.
    
5.  Validate each image is tall enough (i.e. height ≥ 1150px) to allow cropping.
    
6.  For each image, crop:
    
    * Remove the top `450px` using `-gravity North -chop 0x450`.
        
    * Remove the bottom `700px` using `-gravity South -chop 0x700`.
        
7.  Log each successful crop by printing `Cropped: <image_path>`.
    
8.  Finish by reporting the total number of processed images; if none were found, print a message accordingly.
    

The following code snippet illustrates the cropping command:

    # Run the cropping script
    npm run crop-screenshots
    # or
    bash scripts/crop-screenshots.sh
    
    # Internal crop command per image:
    magick "$img" -gravity North -chop 0x450 -gravity South -chop 0x700 "$img"

Special Effects and Overlays
============================

Effects and overlays are defined with a clear update/draw cycle, a fixed layer order, and consistent blending rules. They share the same world transformations as base sprites and are implemented in modules such as `effectsSystems.ts` and `overlays.ts`.

Key rules:

* **Layering and draw order:**
    
    * Global effects (fireworks, smog) are updated and drawn each frame in `CanvasIsometricGrid.tsx`.
        
    * Overlays are drawn after base tiles and building sprites; they are accumulated in an overlay queue.
        
    * In entity drawing (aircraft, trains), particles and shadows are drawn first, followed by the main sprite and then overlay elements (like navigation lights).
        
* **Blending and opacity:**
    
    * Fireworks use linear gradients (from a base color to transparent) with opacity diminishing according to particle age.
        
    * Smog is rendered with soft, semi-transparent circles and inner glows, with opacity adjusted based on zoom.
        
    * Train smoke uses `ctx.globalAlpha` to control fade-in and fade-out.
        
    * Aircraft navigation lights use solid colors with additional strobe layers for flashing effects.
        
* **Effect systems and constants:**
    
    * Firework effect timing and particle counts are defined in constants (e.g. `FIREWORK_PARTICLE_SPEED`, `FIREWORK_SHOW_DURATION`).
        
    * Smog drift and rise are controlled via constants (e.g. `SMOG_DRIFT_SPEED`, `SMOG_RISE_SPEED`), with different values for mobile versus desktop.
        
    * Railway smoke is updated with drag factors and maximum particle counts.
        

Below is an example table summarizing effects:

|     |     |     |     |
| --- | --- | --- | --- |
| Effect/Overlay | Layer Order | Blend/Style | Interaction Notes |
| Fireworks | On top of vehicles/pedestrians in the air layer | Launch trail with linear gradient from firework color to transparent; particles fade with age | Updated via `updateFireworks`; spawns based on show duration and chance |
| Smog | Above buildings but below UI overlays | Soft circles with base `rgba(100,100,110,alpha)` and inner glow `rgba(140,140,150,alpha*0.5)`; fades with zoom | Spawns from factories; resets on grid version |
| Train Smoke | Above the train carriages | Uses `globalAlpha` for fade-in/out; larger particles may have a highlight circle for depth | Only for certain train types; uses viewport culling in `drawTrainSmoke` |
| Aircraft Shadows | Below aircraft sprite but above particle systems | Drawn as translated/scaled ellipses with opacity scaled by altitude | Always drawn; no interaction |
| Aircraft Navigation Lights | On top of aircraft sprite | Solid red (`#ff3333`) with shadow (`#ff0000`); strobe effect draws additional white layer with blur | Only rendered during night conditions; uses `navLightFlashTimer` for strobe timing |
| Seaplane Contrails | Above base grid and aircraft, before navigation lights | Drawn with `rgba(255,255,255,opacity)`; opacity decreases with age | Spawned when altitude is high; adjusted for mobile device performance |
| Seaplane Wakes | Above water tiles, below aircraft lights | Drawn with `rgba(200,220,255,opacity)`; fade-out function as age approaches maximum | Spawned during taxiing or splashdown; mobile versions use shorter lifetimes |
| Service Coverage Overlays | After base tiles/buildings, using the overlay queue | Covered mode renders with `NO_OVERLAY`; uncovered mode uses `UNCOVERED_WARNING` (`rgba(239,68,68,0.45)`) | Mode controlled by `overlayMode` and tool selection |
| Building FireOverlay | Drawn last in building renderer | Uses an SVG radial gradient (`fireGlow`) with animated stops (e.g. `stopOpacity` from 0.8 to 0) | Activated by the building fire state; non-interactive |

Rendering and Performance Considerations
========================================

Graphics rendering must meet frame budgets by reducing unnecessary draw calls, allocations, and per-frame computations. Strategies include viewport culling, level-of-detail (LOD) adjustments, aggressive caching, and optimized canvas transforms, ensuring smooth performance on both desktop and mobile devices.

Key points:

* **Viewport culling:**  
    Only tiles and entities that are within or near the visible bounds (computed by `calculateViewportBounds`) are drawn. Margins are added to avoid abrupt popping.
    
* **Level of Detail (LOD):**  
    Different zoom levels trigger different rendering styles. For example, lane markings, pedestrian details, and vehicle decorations are skipped or simplified at low zoom levels (controlled by constants such as `LOD_SIMPLE_ZOOM`).
    
* **Caching strategies:**  
    Functions (e.g. in `imageLoader.ts`) cache loaded images, and precomputed grid data is reused to avoid redundant computation. Depth sorting uses efficient algorithms like insertion sort when the order is nearly sorted.
    
* **Canvas and high-DPI setup:**  
    Canvas contexts are set up using `setupCanvasContext` which applies transformations in the order: reset → scale by `dpr * zoom` → translate by offset. Image smoothing is disabled for pixel art quality.
    
* **Occlusion and depth sorting:**  
    Objects are sorted by a computed depth (often `x+y`) to ensure proper occlusion and prevent overdraw.
    

Below is an example configuration and usage snippet:

    export const LOD = {
      roads: {
        laneMarkings: 0.6,
        medianPlants: 0.9,
        dashedBorder: 0.95,
      },
      pedestrians: {
        simple: 0.55,
        medium: 0.75,
      },
      traffic: {
        lights: 0.6,
        arrows: 0.8,
        crosswalks: 0.75,
      },
      boats: {
        min: 0.55,
        wakeMinMobile: 0.7,
      },
      barges: {
        min: 0.5,
      },
      seaplanes: {
        min: 0.6,
      },
      drawing: {
        skipSmallElements: 0.7,
        constructionDots: 0.8,
      },
      smog: {
        maxZoom: 0.6,
        fadeZoom: 0.9,
      },
    } as const;
    
    export function drawRoadLayer(ctx: CanvasRenderingContext2D, zoom: number) {
      if (zoom >= LOD.roads.laneMarkings) {
        drawLaneMarkings(ctx);
      }
      if (zoom >= LOD.roads.medianPlants) {
        drawMedianPlants(ctx);
      }
      if (zoom >= LOD.roads.dashedBorder) {
        drawDashedBorders(ctx);
      }
    }

Integration Workflow and Testing
================================

The following end-to-end workflow outlines the steps to add new assets and verify them in the game.

1.  **Prepare sprite sheets:**
    
    * Place PNG files in `/public/assets/` according to guidelines in `adding-asset-sheets.md`.
        
    * Ensure the sheet uses a consistent grid layout across variants and apply any necessary corrections (e.g. aircraft cropping).
        
2.  **Define types and tools:**
    
    * Update type definitions in `src/types/game.ts` (including `BuildingType` and `Tool`).
        
    * Update metadata in `TOOL_INFO` and `BUILDING_STATS`.
        
3.  **Configure the sprite pack:**
    
    * Add a new `SpritePack` entry in `src/lib/renderConfig.ts` with fields such as `src`, `cols`, `rows`, and mappings (`buildingToSprite`).
        
    * Configure variant offsets and grid mappings if applicable.
        
4.  **Update rendering and loading:**
    
    * Include the new sheets in the image loader (e.g. via `loadSpriteImage` in `CanvasIsometricGrid.tsx`).
        
    * Verify that selection logic (e.g. for construction or abandoned variants) is updated.
        
5.  **Register and select the active pack:**
    
    * Add the new pack to `SPRITE_PACKS` and set it as active using `setActiveSpritePack` or `getActiveSpritePack`.
        
6.  **UI registration and placement:**
    
    * Update tool categories in `Game.tsx` and mobile toolbars in `MobileToolbar.tsx` as required.
        
    * Map tools to building types in `GameContext.tsx`.
        
7.  **Simulation configuration:**
    
    * Update building sizes in `BUILDING_SIZES` so that multi-tile buildings function correctly.
        
8.  **In-game verification:**
    
    * Use `SpriteTestPanel.tsx` to load and preview sprite sheets across different tabs (main, construction, abandoned, etc.).
        
    * Verify that `CanvasIsometricGrid` renders tiles and buildings correctly, with proper depth ordering and offsets.
        
    * Check the `SpriteGallery` and network requests to ensure that images are loaded and cached.
        
    * Validate specialized assets (aircraft, vehicles, pedestrians) for proper rendering and LOD behavior.
        
9.  **Testing methods and checks:**
    
    * Validate coordinates and offsets using functions such as `getSpriteCoords` and `getSpriteOffsets`.
        
    * Check pixel snapping and ground alignment in preview panels.
        
    * Confirm proper occlusion by reviewing depth-sorted queues and overlay rendering.
        
    * Use the browser’s Network panel to ensure all assets from `/public/assets/` are requested properly.
        
    * Run `npx tsc --noEmit` to validate all type definitions and build configurations.
        
10. **Update documentation:**
    
    * Update the `adding-asset-sheets.md` document with any new configuration keys or adjustments.
        
    * Ensure that `src/lib/renderConfig.ts` reflects all changes.
        

Below is a QA checklist template for testing:

    QA CHECKLIST TEMPLATE
    
    [ ] Assets
        [ ] All PNGs are placed under `/public/assets/` as documented.
        [ ] All sprite variants use the same grid (matching `cols` and `rows`).
        [ ] Required category sheets are present: main, construction, abandoned, dense, modern, parks, parksConstruction.
        [ ] Background filtering is applied where required via `filterBackgroundColor`.
    
    [ ] Coordinates and Offsets
        [ ] `getSpriteCoords` returns the expected source rectangle for each sprite.
        [ ] `getSpriteOffsets` applies the correct per-sprite offsets.
        [ ] Overlapping-row adjustments are correct for sprite packs using that logic.
    
    [ ] Pixel Snapping and Rendering
        [ ] The test panel sets `ctx.imageSmoothingEnabled = false`.
        [ ] Draw coordinates use `Math.round` to ensure pixel-perfect placement.
        [ ] `gridToScreen` produces integer pixel positions where needed.
    
    [ ] Ground Alignment
        [ ] Sprite bases align correctly with the ground plane in the test panel.
        [ ] Vertical and horizontal offsets are correctly applied.
        [ ] Drawing functions in `CanvasIsometricGrid` use the pre-computed offsets.
    
    [ ] Z-order and Occlusion
        [ ] Draw order follows the defined sprite order and building mappings.
        [ ] Render queues (buildingQueue, waterQueue, roadQueue) are depth-sorted.
        [ ] Overlays are drawn last using the appropriate functions.
        [ ] Vehicles are occluded correctly by buildings using `isVehicleBehindBuilding`.
        [ ] Off-screen drawing is minimized by view bounds checks.
    
    [ ] Variant Switching
        [ ] Building variants (dense, modern, etc.) are selected correctly based on seed values.
        [ ] Construction states use the correct variant sheet.
        [ ] Aircraft use `angleToDirection`, and the proper sprite is chosen.
        [ ] Vehicles and pedestrians render at the correct zoom thresholds.
    
    [ ] Loader and Cache
        [ ] All sprite sheets load via `loadSpriteImage`.
        [ ] Images are cached correctly with `getCachedImage`.
        [ ] Network requests confirm the correct asset paths are used.
    
    [ ] Simulation and Sizes
        [ ] `BUILDING_SIZES` is updated for multi-tile plazas.
        [ ] Multi-tile buildings span the correct number of grid cells.
    
    [ ] Specialized Assets
        [ ] Aircraft rendering functions work correctly and do not trigger fallbacks unexpectedly.
        [ ] Aircraft shadows and contrails are rendered correctly.
        [ ] Vehicle and pedestrian rendering follows zoom thresholds.
    
    [ ] Types and Build
        [ ] Updated `BuildingType` and `Tool` in `src/types/game.ts`.
        [ ] `TOOL_INFO` and `BUILDING_STATS` compile without errors.
        [ ] `npx tsc --noEmit` passes with no errors.
    
    [ ] Documentation
        [ ] Documentation in `adding-asset-sheets.md` is updated with new keys and examples.
        [ ] Comments in `src/lib/renderConfig.ts` accurately reflect the new configurations.

Asset Packaging and Naming
==========================

Asset packaging must result in stable, predictable paths and names that the game code can reference without ambiguity. All runtime-delivered images are placed in `public` so they can be referenced using absolute paths (e.g. `/assets/...`). File names should be lower-case with hyphens, without version numbers, and clearly indicate state or theme variants.

Key guidelines:

* **Folder placement:**
    
    * Place sprite sheet PNG files in `public/assets/`.
        
    * Open Graph images are placed directly in `public/`.
        
    * Screenshots for cropping are in `public/games/`.
        
    * Configuration files remain in `src/`.
        
* **General naming:**
    
    * Use lower-case letters with hyphens (e.g. `sprites_red_water_new.png`).
        
    * Do not include version numbers in file names; manage versioning in the repository.
        
* **Sprite pack identification:**
    
    * Each sprite pack requires a unique `id` (e.g. `sprites4`, `sprites4-harry`).
        
    * Asset paths in the sprite pack configuration must match the file names exactly.
        
* **Sprite sheet naming and variant suffixes:**
    
    * Use a descriptive base name (e.g. `sprites_red_water_new.png`).
        
    * Append suffixes such as `_construction` or `_abandoned` to indicate variants.
        
    * Ensure the grid dimensions remain consistent across the main and variant sheets.
        
* **UI and icon naming:**
    
    * Icon components are placed in `src/components/ui/Icons.tsx` and use PascalCase with the `Icon` suffix (e.g. `SelectIcon`).
        
    * Components are added to a tool icon mapping with lower-case keys.
        
* **Image loader cache keys:**
    
    * When filtering is applied, cache keys append `_filtered` (e.g. `sprites_red_water_new.png_filtered`).
        

The table below provides examples of key naming conventions:

|     |     |     |
| --- | --- | --- |
| Path Pattern | Example Name | Notes |
| `public/assets/<base>.png` | `public/assets/sprites_red_water_new.png` | Referenced in the sprite pack via `/assets/sprites_red_water_new.png` in `renderConfig.ts`. |
| `public/assets/<base>_construction.png` | `public/assets/sprites_red_water_new_construction.png` | Used for construction state via `constructionSrc`. |
| `public/assets/<base>_abandoned.png` | `public/assets/sprites_red_water_new_abandoned.png` | Used for abandoned state via `abandonedSrc`. |
| `public/assets/<base>_parks.png` | `public/assets/sprites_red_water_new_parks.png` | Referenced via `parksSrc` for grouped parks assets. |
| `public/assets/<base>_parks_construction.png` | `public/assets/sprites_red_water_new_parks_construction.png` | Used for parks construction via `parksConstructionSrc`. |
| `public/assets/buildings/<name>.png` | `public/assets/buildings/residential.png` | Referenced at runtime for standalone building images. |
| `public/og-image.png` | `public/og-image.png` | Served as the Open Graph image with MIME type `image/png`. |
| `public/games/*.png` | `public/games/city-001.png` | Processed by the cropping script (`crop-screenshots.sh`). |
| `src/components/ui/*Icon.tsx` | `src/components/ui/BulldozeIcon.tsx` | Icon component naming using PascalCase and the `Icon` suffix; added to `ToolIcons` mapping. |
| Cache key (in-memory) | `sprites_red_water_new.png_filtered` | Created in the loader when filtering is active, referenced by `getCachedImage`. |

This document provides the consolidated technical style guide for graphics in the `isometric-city` game. All instructions adhere to the simplified technical English guidelines and are designed for engineers and code-generation utilities to follow precisely.

Made with ❤️ by [Driver](https://www.driver.ai/) in 10 minutes