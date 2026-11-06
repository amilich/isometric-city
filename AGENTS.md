# AGENTS.md

## Commands
- `npm run dev` - Start development server
- `npm run build` - Production build (also type-checks)
- `npm run lint` - Run ESLint
- No test framework configured
- Dev server: `http://localhost:3000` (IsoCity), `/coaster` for IsoCoaster

## Architecture
Next.js 16 + React 19 isometric city-builder game with canvas rendering.
- `src/app/` - Next.js App Router pages
- `src/components/` - React components (Game.tsx is main entry, `game/` for game UI, `buildings/` for building renderers, `ui/` for shadcn components)
- `src/context/` - React context (GameContext for global state)
- `src/hooks/` - Custom hooks (useMobile, useCheatCodes)
- `src/lib/` - Utilities (simulation.ts for game logic, renderConfig.ts for canvas)
- `src/types/game.ts` - TypeScript types

## Code Style
- TypeScript with strict mode; use `@/*` path alias for imports
- React functional components with 'use client' directive
- shadcn/ui + Radix UI + Tailwind CSS for styling
- ESLint with eslint-config-next
