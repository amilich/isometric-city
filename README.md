# IsoCity

Try for free at [iso-city.com](https://iso-city.com).

IsoCity is a open-source isometric city-building simulation game built with **Next.js**, **TypeScript**, and **Tailwind CSS**. It leverages the HTML5 Canvas API for high-performance rendering of isometric graphics, featuring complex systems for economic simulation, trains, planes, seaplanes, helicopters, cars, pedestrians, and more.

![IsoCity Banner](public/readme-image.png)

Made with [Cursor](https://cursor.com)

## Features

-   **Isometric Rendering Engine**: Custom-built rendering system using HTML5 Canvas (`CanvasIsometricGrid`) capable of handling complex depth sorting, layer management, and both image and drawn sprites.
-   **Dynamic Simulation**:
    -   **Traffic System**: Autonomous vehicles including cars, trains, and aircraft (planes/seaplanes).
    -   **Pedestrian System**: Pathfinding and crowd simulation for city inhabitants.
    -   **Economy & Resources**: Resource management, zoning (Residential, Commercial, Industrial), and city growth logic.
-   **Interactive Grid**: Tile-based placement system for buildings, roads, parks, and utilities.
-   **State Management**: Save/Load functionality for multiple cities.
-   **Responsive Design**: Mobile-friendly interface with specialized touch controls and toolbars.

## Tech Stack

-   **Framework**: [Next.js 16](https://nextjs.org/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
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

## Custom Building Generation

IsoCity includes an experimental feature to generate custom buildings using AI, powered by [fal.ai](https://fal.ai).

**How it works:**
1. Describe any building (e.g., "Hogwarts Castle")
2. AI selects the optimal aspect ratio based on your description (portrait for towers, landscape for warehouses, etc.)
3. [Nano Banana Pro](https://fal.ai/models/fal-ai/nano-banana-pro) generates an isometric sprite
4. [Bria RMBG](https://fal.ai/models/fal-ai/bria/background/remove) removes the background
5. [Gemini 2.5 Flash](https://fal.ai/models/openrouter/router) analyzes the image to suggest game stats

**To enable:**
1. Get a free API key from [fal.ai](https://fal.ai)
2. Create `.env.local` in the project root:
   ```
   FAL_KEY=your_fal_api_key_here
   ```
3. Restart the dev server and look for the "Custom" panel in the sidebar

## Contributing

Contributions are welcome! Whether it's reporting a bug, proposing a new feature, or submitting a pull request, your input is valued.

Please ensure your code follows the existing style and conventions.

## License

Distributed under the MIT License. See `LICENSE` for more information.
