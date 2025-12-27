# IsoCity

IsoCity is a open-source isometric city-building simulation game built with **Next.js**, **TypeScript**, and **Tailwind CSS**. It leverages the HTML5 Canvas API for high-performance rendering of isometric graphics, featuring complex systems for economic simulation, trains, planes, seaplanes, helicopters, cars, pedestrians, and more.

![IsoCity Banner](public/readme-image.png)

## Features

-   **Isometric Rendering Engine**: Custom-built rendering system using HTML5 Canvas (`CanvasIsometricGrid`) capable of handling complex depth sorting and layer management.
-   **Dynamic Simulation**:
    -   **Traffic System**: Autonomous vehicles including cars, trains, and aircraft (planes/seaplanes).
    -   **Pedestrian System**: Pathfinding and crowd simulation for city inhabitants.
    -   **Economy & Resources**: Resource management, zoning (Residential, Commercial, Industrial), and city growth logic.
-   **Interactive Grid**: Tile-based placement system for buildings, roads, parks, and utilities.
-   **State Management**: Save/Load functionality for multiple cities.
-   **Responsive Design**: Mobile-friendly interface with specialized touch controls and toolbars.

## Tech Stack

-   **Framework**: [Next.js 14+](https://nextjs.org/) (App Router)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/) components.
-   **Graphics**: HTML5 Canvas API (No external game engine libraries; pure native implementation).
-   **Icons**: Lucide React.

## Getting Started

### Prerequisites

-   Node.js (v18 or higher)
-   npm or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/amilich/isometric-city.git
    cd isometric-city
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

4.  **Open the game:**
    Visit [http://localhost:3000](http://localhost:3000) in your browser.


## Procedural Sprite Packs (Experimental)

This project includes an **experimental procedural sprite pack** that generates sprite sheets at runtime using the Canvas 2D API (no `.webp` / `.png` required for that pack).

- **Generator**: `src/lib/proceduralSpriteSheets.ts` (entrypoint: `generateProceduralSpriteSheetForKind(...)`)
- **Pack config**: `SPRITE_PACK_PROCEDURAL_BASIC` in `src/lib/renderConfig.ts`
- **Loading / registration**: `src/components/game/spriteSheetProvider.ts`

The generator can now procedurally create **all** sheet kinds the renderer knows about (main / construction / abandoned / dense / modern / parks / farms / shops / stations) as long as your pack provides the corresponding mappings (variants, parksBuildings, etc.).

To create your own procedural pack:

1. Copy `SPRITE_PACK_PROCEDURAL_BASIC` and change the `id` + `procedural.seed`.
2. Point the sheet sources at cache keys (for example `procedural:my-pack:main`).
3. Extend `styleForSpriteKey(...)` / `drawProceduralSpriteTile(...)` in `src/lib/proceduralSpriteSheets.ts` to add new sprite keys or new park/farm/shop/station visuals.

Tip: the generator uses lightweight prefixes internally (ex: `dense:apartment_high`, `park:basketball_courts`) to differentiate which kind of procedural art to draw.

If you want to add *your own* procedural sprites without modifying the core generator, use the extension registry:

- `src/lib/proceduralSpriteExtensions.ts` → `registerProceduralPrefixRenderer('my', ...)`
- Then reference sprites as `my:your_sprite_key` from a SpritePack.

- Or override an existing key directly (no prefix required): `registerProceduralSpriteRenderer('house_small', ...)`
- A convenient place to register project-specific sprites is `src/lib/proceduralUserAssets.ts` (called once from `src/components/Game.tsx`)



## Contributing

Contributions are welcome! Whether it's reporting a bug, proposing a new feature, or submitting a pull request, your input is valued.

Please ensure your code follows the existing style and conventions.

## License

Distributed under the MIT License. See `LICENSE` for more information.
