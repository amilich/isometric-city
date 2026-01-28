import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { GameState } from '@/games/coaster/types';
import { serializeAndCompressAsync } from '@/lib/saveWorkerManager';
import { msg } from 'gt-next';

export const COASTER_AUTOSAVE_KEY = 'coaster-tycoon-state';
export const COASTER_SAVED_PARKS_INDEX_KEY = 'coaster-saved-parks-index';
export const COASTER_SAVED_PARK_PREFIX = 'coaster-park-';

export type SavedParkMeta = {
  id: string;
  name: string;
  cash: number;
  guests: number;
  rating: number;
  gridSize: number;
  year: number;
  month: number;
  day: number;
  savedAt: number;
  roomCode?: string;
};

export function buildSavedParkMeta(state: GameState, savedAt: number = Date.now(), roomCode?: string): SavedParkMeta {
  return {
    id: state.id,
    name: state.settings?.name ?? msg('Unnamed Park'),
    cash: state.finances?.cash ?? 0,
    guests: state.stats?.guestsInPark ?? 0,
    rating: state.stats?.parkRating ?? 0,
    gridSize: state.gridSize ?? 0,
    year: state.year ?? 1,
    month: state.month ?? 1,
    day: state.day ?? 1,
    savedAt,
    roomCode,
  };
}

export function readSavedParksIndex(): SavedParkMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(COASTER_SAVED_PARKS_INDEX_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? (parsed as SavedParkMeta[]) : [];
  } catch {
    return [];
  }
}

export function writeSavedParksIndex(parks: SavedParkMeta[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COASTER_SAVED_PARKS_INDEX_KEY, JSON.stringify(parks));
  } catch {
    // Ignore storage failures (quota, privacy mode, etc.)
  }
}

export function saveParkToIndex(state: GameState, roomCode?: string, savedAt: number = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    const meta = buildSavedParkMeta(state, savedAt, roomCode);
    const updated = upsertSavedParkMeta(meta, readSavedParksIndex());
    writeSavedParksIndex(updated);
  } catch (e) {
    console.error('Failed to save park to index:', e);
  }
}

export function upsertSavedParkMeta(meta: SavedParkMeta, parks?: SavedParkMeta[]): SavedParkMeta[] {
  const list = parks ? [...parks] : readSavedParksIndex();
  const existingIndex = list.findIndex((park) => park.id === meta.id || (meta.roomCode && park.roomCode === meta.roomCode));
  if (existingIndex >= 0) {
    const existing = list[existingIndex];
    list[existingIndex] = {
      ...meta,
      roomCode: meta.roomCode ?? existing.roomCode,
    };
  } else {
    list.push(meta);
  }
  list.sort((a, b) => b.savedAt - a.savedAt);
  return list;
}

export function removeSavedParkMeta(id: string, parks?: SavedParkMeta[]): SavedParkMeta[] {
  const list = parks ? [...parks] : readSavedParksIndex();
  return list.filter((park) => park.id !== id);
}

export function loadCoasterStateFromStorage(key: string): GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    let jsonString = decompressFromUTF16(saved);
    if (!jsonString || !jsonString.startsWith('{')) {
      if (saved.startsWith('{')) {
        jsonString = saved;
      } else {
        return null;
      }
    }
    const parsed = JSON.parse(jsonString);
    if (parsed?.grid && parsed?.gridSize) {
      return parsed as GameState;
    }
  } catch {
    return null;
  }
  return null;
}

export function saveCoasterStateToStorage(key: string, state: GameState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const compressed = compressToUTF16(JSON.stringify(state));
    localStorage.setItem(key, compressed);
    return true;
  } catch {
    return false;
  }
}

/**
 * Async version of saveCoasterStateToStorage that uses a Web Worker
 * for serialization and compression to avoid blocking the main thread.
 */
export async function saveCoasterStateToStorageAsync(key: string, state: GameState): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const compressed = await serializeAndCompressAsync(state);
    localStorage.setItem(key, compressed);
    return true;
  } catch {
    return false;
  }
}

export function deleteCoasterStateFromStorage(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures
  }
}
