import { GLITCH_ENABLED, GLITCH_PUBLIC_ORIGIN, detectGlitchGameKeyFromPath, getGlitchTitleConfig } from './config';

export function buildInviteUrl(roomCode: string, localPath: string): string {
  const code = roomCode.trim().toUpperCase();
  if (!code) return '';

  if (GLITCH_ENABLED) {
    const gameKey = detectGlitchGameKeyFromPath();
    const titleId = getGlitchTitleConfig(gameKey).titleId;
    const url = new URL(`/games/${titleId}/play`, GLITCH_PUBLIC_ORIGIN);
    url.searchParams.set('room', code);
    return url.toString();
  }

  if (typeof window === 'undefined') return '';
  const normalizedPath = localPath.startsWith('/') ? localPath.slice(1) : localPath;
  return `${window.location.origin}/${normalizedPath}/${code}`;
}
