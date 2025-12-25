# Tech Stack - IsoCity

## Core Technologies
- **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Framework:** [Next.js 16+](https://nextjs.org/) (App Router)
- **UI & Styling:**
    - [Tailwind CSS](https://tailwindcss.com/)
    - [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives)
    - [Lucide React](https://lucide.dev/) (Icons)

## Game Engine & Rendering
- **Graphics:** HTML5 Canvas API (Native implementation, no external game engine)
- **State Management:** React Context API (`GameContext`) for global game state and simulation loop.

## Backend & Persistence
- **Cloud Infrastructure:** [Firebase](https://firebase.google.com/)
    - **Authentication:** Firebase Auth for user accounts.
    - **Database/Storage:** Firestore or Firebase Storage for city state persistence.
- **Deployment:** [Vercel](https://vercel.com/)

## Development Tools
- **Linting:** ESLint
- **Formatting:** Prettier (via standard Tailwind/ESLint integrations)
- **Scripts:** Custom bash scripts for asset processing (e.g., `scripts/crop-screenshots.sh`)
