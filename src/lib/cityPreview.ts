/*
  Lightweight city preview generator.

  This intentionally mirrors the minimap color logic but produces a small
  data URL that can be stored alongside SavedCity metadata.

  - No external deps
  - Safe to call client-side only
*/

'use client';

import type { Tile } from '@/types/game';

// Service buildings for preview color mapping
const SERVICE_BUILDINGS = new Set<string>([
  'police_station',
  'fire_station',
  'hospital',
  'school',
  'university',
]);

// Park / leisure buildings for preview color mapping
const PARK_BUILDINGS = new Set<string>([
  'park',
  'park_large',
  'tennis',
  'basketball_courts',
  'playground_small',
  'playground_large',
  'baseball_field_small',
  'soccer_field_small',
  'football_field',
  'baseball_stadium',
  'community_center',
  'swimming_pool',
  'skate_park',
  'mini_golf_course',
  'bleachers_field',
  'go_kart_track',
  'amphitheater',
  'greenhouse_garden',
  'animal_pens_farm',
  'cabin_house',
  'campground',
  'marina_docks_small',
  'pier_large',
  'roller_coaster_small',
  'community_garden',
  'pond_park',
  'park_gate',
  'mountain_lodge',
  'mountain_trailhead',
]);

export type CityPreviewOptions = {
  /** Output size in pixels (square). */
  size?: number;
};

function getTileColor(tile: Tile): string {
  const buildingType = tile.building.type;

  // Base terrain
  if (buildingType === 'water') return '#0ea5e9';
  if (buildingType === 'road') return '#6b7280';
  if (buildingType === 'rail') return '#94a3b8';
  if (buildingType === 'tree') return '#166534';
  if (tile.building.onFire) return '#ef4444';

  // Zoning
  if (tile.zone === 'residential' && buildingType !== 'grass') return '#22c55e';
  if (tile.zone === 'residential') return '#14532d';
  if (tile.zone === 'commercial' && buildingType !== 'grass') return '#38bdf8';
  if (tile.zone === 'commercial') return '#1d4ed8';
  if (tile.zone === 'industrial' && buildingType !== 'grass') return '#f59e0b';
  if (tile.zone === 'industrial') return '#b45309';

  // Services / utilities
  if (SERVICE_BUILDINGS.has(buildingType)) return '#c084fc';
  if (buildingType === 'power_plant') return '#f97316';
  if (buildingType === 'water_tower') return '#06b6d4';

  // Parks / leisure
  if (PARK_BUILDINGS.has(buildingType)) return '#84cc16';

  // Default land
  return '#2d5a3d';
}

/**
 * Generate a small preview image (data URL) for a city.
 *
 * Returns null if canvas is not available.
 */
export function generateCityPreviewDataUrl(
  grid: Tile[][],
  gridSize: number,
  options: CityPreviewOptions = {},
): string | null {
  if (typeof window === 'undefined') return null;

  const size = options.size ?? 160;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#0b1723';
    ctx.fillRect(0, 0, size, size);

    const scale = size / gridSize;

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = grid[y]?.[x];
        if (!tile) continue;

        ctx.fillStyle = getTileColor(tile);
        // ceil avoids gaps on fractional scales
        ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }

    // PNG is broadly supported and stable for storage
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
