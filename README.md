# IsoCity, IsoCoaster & IsoTower Defense

Open-source isometric simulation games built with **Next.js**, **TypeScript**, and **HTML5 Canvas**.

<table>
<tr>
<td width="50%" align="center"><strong>IsoCity</strong></td>
<td width="50%" align="center"><strong>IsoCoaster</strong></td>
</tr>
<tr>
<td><img src="public/readme-image.png" width="100%"></td>
<td><img src="public/readme-coaster.png" width="100%"></td>
</tr>
<tr>
<td align="center">City builder with trains, planes, cars, and pedestrians<br><a href="https://iso-city.com">iso-city.com</a></td>
<td align="center">Build theme parks with roller coasters, rides, and guests<br><a href="https://iso-coaster.com">iso-coaster.com</a></td>
</tr>
</table>

Made with [Cursor](https://cursor.com)

## Features

-   **Three games, one codebase**:
    -   **IsoCity** (`/`) — city builder with traffic + economy simulation
    -   **IsoCoaster** (`/coaster`) — theme park builder with rides + guests
    -   **IsoTower Defense** (`/tower`) — isometric tower defense with waves, towers, and local saves
-   **Isometric Rendering Engine**: Custom-built rendering system using HTML5 Canvas (`CanvasIsometricGrid`) capable of handling complex depth sorting, layer management, and both image and drawn sprites.
-   **Dynamic Simulation**:
    -   **Traffic System**: Autonomous vehicles including cars, trains, planes, and seaplanes.
    -   **Pedestrian System**: Pathfinding and crowd simulation for city inhabitants.
    -   **Economy & Resources**: Resource management, zoning (Residential, Commercial, Industrial), and city growth logic.
-   **Interactive Grid**: Tile-based placement system for buildings, roads, parks, and utilities.
-   **State Management**: Local save/load for cities, parks, and tower defense runs.
-   **Responsive Design**: Mobile-friendly interface with specialized touch controls and toolbars.

## Tech Stack

-   **Framework**: [Next.js 16](https://nextjs.org/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Graphics**: HTML5 Canvas API (No external game engine libraries; pure native implementation).
-   **Icons**: Lucide React.

## Getting Started

### Prerequisites

-   Node.js (v18 or higher)
-   npm

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

4.  **Open the games:**
    -   IsoCity: [http://localhost:3000](http://localhost:3000)
    -   IsoCoaster: [http://localhost:3000/coaster](http://localhost:3000/coaster)
    -   IsoTower Defense: [http://localhost:3000/tower](http://localhost:3000/tower)

### Useful commands

```bash
# Type-check + production build
npm run build

# ESLint
npm run lint

# Headless smoke test (requires Chrome/Chromium installed)
npm run e2e:tower
```

### Tower Defense headless simulation

IsoTower Defense also includes a lightweight headless simulation endpoint you can hit while developing:

- `GET /api/tower-smoke` — runs a short simulation and returns JSON stats
- Supports query params like `wave=6` (flyers), `waves=20` (simulate until victory), `noTowers=1` (force leaks/game over)

## Contributing

Contributions are welcome! Whether it's reporting a bug, proposing a new feature, or submitting a pull request, your input is valued.

Please ensure your code follows the existing style and conventions.

## License

Distributed under the MIT License. See `LICENSE` for more information.
