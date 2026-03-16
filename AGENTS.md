# AGENTS.md

## Commands
- `npm run dev` - Start development server
- `npm run build` - Production build (also type-checks)
- `npm run lint` - Run ESLint
- No test framework configured

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

## Cursor Cloud specific instructions

### Overview

This repository contains two isometric simulation games served as a single Next.js app:
- **IsoCity** (`/`) — City builder with traffic, pedestrians, and economy simulation
- **IsoCoaster** (`/coaster`) — Theme park builder with rides and guests

**Frontend-only**: No database, Docker, or backend services required. All game state uses `localStorage`.

### Running

- `npm run dev` starts Turbopack dev server on port 3000 (~700ms ready)
- Both games are accessible from the same server: `/` and `/coaster`
- Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) are optional — only needed for Co-op multiplayer

### Lint

- `npm run lint` exits non-zero due to pre-existing React Hooks warnings (`react-hooks/set-state-in-effect`, `react-hooks/exhaustive-deps`, `react-hooks/refs`). These are intentional patterns in the game systems (31 problems: 19 errors, 12 warnings). Do not attempt to fix these.
