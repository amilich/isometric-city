import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import type { GameState } from '@/games/tower/types';

export const TOWER_AUTOSAVE_KEY = 'isotower-autosave';
export const TOWER_SAVED_RUNS_INDEX_KEY = 'isotower-saved-runs-index';
export const TOWER_SAVED_RUN_PREFIX = 'isotower-run-';

export type SavedRunMeta = {
  id: string;
  name: string;
  wave: number;
  money: number;
  lives: number;
  gridSize: number;
  savedAt: number;
};

export function buildSavedRunMeta(state: GameState, savedAt: number = Date.now()): SavedRunMeta {
  return {
    id: state.id,
    name: state.settings.name || 'Unnamed Run',
    wave: state.stats.wave,
    money: state.money,
    lives: state.lives,
    gridSize: state.gridSize,
    savedAt,
  };
}

export function readSavedRunsIndex(): SavedRunMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(TOWER_SAVED_RUNS_INDEX_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? (parsed as SavedRunMeta[]) : [];
  } catch {
    return [];
  }
}

export function writeSavedRunsIndex(runs: SavedRunMeta[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOWER_SAVED_RUNS_INDEX_KEY, JSON.stringify(runs));
  } catch {
    // ignore
  }
}

export function upsertSavedRunMeta(meta: SavedRunMeta, runs?: SavedRunMeta[]): SavedRunMeta[] {
  const list = runs ? [...runs] : readSavedRunsIndex();
  const idx = list.findIndex((r) => r.id === meta.id);
  if (idx >= 0) list[idx] = meta;
  else list.push(meta);
  list.sort((a, b) => b.savedAt - a.savedAt);
  return list;
}

export function removeSavedRunMeta(id: string, runs?: SavedRunMeta[]): SavedRunMeta[] {
  const list = runs ? [...runs] : readSavedRunsIndex();
  return list.filter((r) => r.id !== id);
}

export function saveRunToIndex(state: GameState, savedAt: number = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    const meta = buildSavedRunMeta(state, savedAt);
    const updated = upsertSavedRunMeta(meta, readSavedRunsIndex());
    writeSavedRunsIndex(updated);
  } catch (e) {
    console.error('Failed to save run to index:', e);
  }
}

export function loadTowerStateFromStorage(key: string): GameState | null {
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
    if (parsed?.grid && parsed?.gridSize && parsed?.stats) {
      return parsed as GameState;
    }
  } catch {
    return null;
  }
  return null;
}

export function saveTowerStateToStorage(key: string, state: GameState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const compressed = compressToUTF16(JSON.stringify(state));
    localStorage.setItem(key, compressed);
    return true;
  } catch {
    return false;
  }
}

export function deleteTowerStateFromStorage(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

