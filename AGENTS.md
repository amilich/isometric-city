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

## Cloud-specific instructions

### Overview
Two isometric simulation games: **IsoCity** (`/`) city builder and **IsoCoaster** (`/coaster`) theme park builder. Frontend-only — no database or backend needed for single-player.

### Running
- `npm run dev` starts Turbopack dev server on port 3000 (ready in ~700ms)
- `npm run build` runs image compression (`scripts/compress-images.mjs`) then `next build` with type-checking
- `npm run lint` exits with code 1 due to pre-existing React Hooks warnings (`react-hooks/set-state-in-effect`, `react-hooks/exhaustive-deps`, `react-hooks/refs`); these are intentional patterns and do not indicate regressions

### Routes
- `/` — IsoCity main game
- `/coaster` — IsoCoaster theme park builder
- `/coop/[roomCode]` and `/coaster/coop/[roomCode]` — multiplayer (requires Supabase env vars, optional)

### Notes
- State is stored in `localStorage`; no backend required for core flows
- Supabase is only needed for Co-op multiplayer (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- No test framework is configured; validation is lint + build + manual testing
- The `npm run build` image compression step generates WebP files alongside PNGs; these are gitignored and recreated each build
