export type GlitchGameKey = 'isocity' | 'coaster';

export interface GlitchTitleRuntimeConfig {
  gameKey: GlitchGameKey;
  titleId: string;
  titleName: string;
  runtimeTitleToken: string | null;
  progression: {
    leaderboardKeys: string[];
    statKeys: string[];
  };
}

export const GLITCH_API_BASE_URL = process.env.NEXT_PUBLIC_GLITCH_API_URL || 'https://api.glitch.fun/api';
export const GLITCH_PUBLIC_ORIGIN = (process.env.NEXT_PUBLIC_GLITCH_PUBLIC_ORIGIN || 'https://www.glitch.fun').replace(/\/+$/, '');
export const GLITCH_MMO_PRESENCE_ENABLED =
  process.env.NEXT_PUBLIC_GLITCH_MMO_PRESENCE_ENABLED === '1' ||
  process.env.NEXT_PUBLIC_GLITCH_MMO_PRESENCE_ENABLED === 'true';

export const GLITCH_ENABLED =
  process.env.NEXT_PUBLIC_GLITCH_ENABLED === '1' ||
  process.env.NEXT_PUBLIC_GLITCH_ENABLED === 'true';

export const GLITCH_DEFAULT_GAME_KEY = normalizeGameKey(process.env.NEXT_PUBLIC_GLITCH_GAME_KEY) ?? 'isocity';

const TITLE_CONFIGS: Record<GlitchGameKey, GlitchTitleRuntimeConfig> = {
  isocity: {
    gameKey: 'isocity',
    titleId: process.env.NEXT_PUBLIC_GLITCH_ISOCITY_TITLE_ID || 'ed2b4375-3918-4916-8736-aae299226363',
    titleName: 'IsoCity',
    runtimeTitleToken: process.env.NEXT_PUBLIC_GLITCH_ISOCITY_TITLE_TOKEN || null,
    progression: {
      leaderboardKeys: parseKeyList(process.env.NEXT_PUBLIC_GLITCH_ISOCITY_LEADERBOARD_KEYS),
      statKeys: parseKeyList(process.env.NEXT_PUBLIC_GLITCH_ISOCITY_STAT_KEYS),
    },
  },
  coaster: {
    gameKey: 'coaster',
    titleId: process.env.NEXT_PUBLIC_GLITCH_COASTER_TITLE_ID || 'e51bcfd1-ffda-4038-b124-b4cb090fb8a7',
    titleName: 'IsoCoaster',
    runtimeTitleToken: process.env.NEXT_PUBLIC_GLITCH_COASTER_TITLE_TOKEN || null,
    progression: {
      leaderboardKeys: parseKeyList(process.env.NEXT_PUBLIC_GLITCH_COASTER_LEADERBOARD_KEYS),
      statKeys: parseKeyList(process.env.NEXT_PUBLIC_GLITCH_COASTER_STAT_KEYS),
    },
  },
};

export function getGlitchTitleConfig(gameKey: GlitchGameKey): GlitchTitleRuntimeConfig {
  return TITLE_CONFIGS[gameKey];
}

export function detectGlitchGameKeyFromPath(pathname?: string): GlitchGameKey {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  if (path.startsWith('/coaster')) return 'coaster';
  return GLITCH_DEFAULT_GAME_KEY;
}

export function normalizeGameKey(value: string | undefined | null): GlitchGameKey | null {
  if (value === 'isocity' || value === 'city') return 'isocity';
  if (value === 'coaster' || value === 'isocoaster' || value === 'rollercoaster') return 'coaster';
  return null;
}

function parseKeyList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
