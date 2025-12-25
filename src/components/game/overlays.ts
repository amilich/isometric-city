/**
 * Overlay mode utilities and configuration.
 * Handles visualization overlays for power, water, services, etc.
 */

import { Tile } from '@/types/game';
import {
  TileServicesAt,
  clamp,
  computeCrimeIndex,
  computeLandValueIndex,
  computeTrafficIndex,
} from '@/lib/tileMetrics';
import { OverlayMode } from './types';

// ============================================================================
// Types
// ============================================================================

/** Service coverage data for a tile (plus optional utility flags) */
export type ServiceCoverage = TileServicesAt;

/** Configuration for an overlay mode */
export type OverlayConfig = {
  /** Display label */
  label: string;
  /** Tooltip/title text */
  title: string;
  /** Button background color when active */
  activeColor: string;
  /** Button hover color when active */
  hoverColor: string;
};

// ============================================================================
// Overlay Configuration
// ============================================================================

/** Configuration for each overlay mode */
export const OVERLAY_CONFIG: Record<OverlayMode, OverlayConfig> = {
  none: {
    label: 'None',
    title: 'No Overlay',
    activeColor: '',
    hoverColor: '',
  },
  power: {
    label: 'Power',
    title: 'Power Grid',
    activeColor: 'bg-amber-500',
    hoverColor: 'hover:bg-amber-600',
  },
  water: {
    label: 'Water',
    title: 'Water System',
    activeColor: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-600',
  },
  fire: {
    label: 'Fire',
    title: 'Fire Coverage',
    activeColor: 'bg-red-500',
    hoverColor: 'hover:bg-red-600',
  },
  police: {
    label: 'Police',
    title: 'Police Coverage',
    activeColor: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
  },
  health: {
    label: 'Health',
    title: 'Health Coverage',
    activeColor: 'bg-green-500',
    hoverColor: 'hover:bg-green-600',
  },
  education: {
    label: 'Education',
    title: 'Education Coverage',
    activeColor: 'bg-purple-500',
    hoverColor: 'hover:bg-purple-600',
  },
  subway: {
    label: 'Subway',
    title: 'Subway Coverage',
    activeColor: 'bg-yellow-500',
    hoverColor: 'hover:bg-yellow-600',
  },
  traffic: {
    label: 'Traffic',
    title: 'Traffic Flow',
    activeColor: 'bg-orange-500',
    hoverColor: 'hover:bg-orange-600',
  },
  pollution: {
    label: 'Pollution',
    title: 'Pollution Levels',
    activeColor: 'bg-zinc-500',
    hoverColor: 'hover:bg-zinc-600',
  },
  landValue: {
    label: 'Land Value',
    title: 'Land Value',
    activeColor: 'bg-emerald-600',
    hoverColor: 'hover:bg-emerald-700',
  },
  crime: {
    label: 'Crime',
    title: 'Crime Risk',
    activeColor: 'bg-fuchsia-600',
    hoverColor: 'hover:bg-fuchsia-700',
  },
};

/** Map of building tools to their corresponding overlay mode */
export const TOOL_TO_OVERLAY_MAP: Record<string, OverlayMode> = {
  power_plant: 'power',
  water_tower: 'water',
  fire_station: 'fire',
  police_station: 'police',
  hospital: 'health',
  school: 'education',
  university: 'education',
  subway_station: 'subway',
  subway: 'subway',
  road: 'traffic',
};

/** Get the button class name for an overlay button */
export function getOverlayButtonClass(mode: OverlayMode, isActive: boolean): string {
  if (!isActive || mode === 'none') return '';
  const config = OVERLAY_CONFIG[mode];
  return `${config.activeColor} ${config.hoverColor}`;
}

// ============================================================================
// Overlay Fill Style Calculation
// ============================================================================

/** Color configuration for coverage-based overlays */
const COVERAGE_COLORS = {
  fire: {
    baseR: 239, baseG: 68, baseB: 68,
    intensityG: 100, intensityB: 100,
    baseAlpha: 0.3, intensityAlpha: 0.4,
  },
  police: {
    baseR: 59, baseG: 130, baseB: 246,
    intensityR: 100, intensityG: 100, intensityB: -50,
    baseAlpha: 0.3, intensityAlpha: 0.4,
  },
  health: {
    baseR: 34, baseG: 197, baseB: 94,
    intensityR: 100, intensityG: -50, intensityB: 50,
    baseAlpha: 0.3, intensityAlpha: 0.4,
  },
  education: {
    baseR: 147, baseG: 51, baseB: 234,
    intensityR: 50, intensityG: 100, intensityB: -50,
    baseAlpha: 0.3, intensityAlpha: 0.4,
  },
} as const;

// Simple 3-stop color ramps for "heatmap" overlays.
const HEATMAP_GOOD_LOW: [number, number, number] = [34, 197, 94]; // green-ish
const HEATMAP_MID: [number, number, number] = [234, 179, 8];
const HEATMAP_BAD_HIGH: [number, number, number] = [239, 68, 68];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function triColor(
  t: number,
  low: [number, number, number],
  mid: [number, number, number],
  high: [number, number, number],
): [number, number, number] {
  const ct = clamp(t, 0, 1);
  if (ct <= 0.5) return lerpColor(low, mid, ct / 0.5);
  return lerpColor(mid, high, (ct - 0.5) / 0.5);
}

function rgba(color: [number, number, number], alpha: number): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

/**
 * Calculate the fill style color for an overlay tile.
 * 
 * @param mode - The current overlay mode
 * @param tile - The tile being rendered
 * @param coverage - Service coverage values for the tile
 * @returns CSS color string for the overlay fill
 */
export function getOverlayFillStyle(
  mode: OverlayMode,
  tile: Tile,
  servicesAt: ServiceCoverage,
  grid: Tile[][],
  gridSize: number,
): string {
  switch (mode) {
    case 'power': {
      const powered = servicesAt.power ?? tile.building.powered;
      return powered
        ? 'rgba(34, 197, 94, 0.4)' // green
        : 'rgba(239, 68, 68, 0.4)'; // red
    }

    case 'water': {
      const watered = servicesAt.water ?? tile.building.watered;
      return watered
        ? 'rgba(34, 197, 94, 0.4)' // green
        : 'rgba(239, 68, 68, 0.4)'; // red
    }

    case 'fire': {
      const intensity = clamp((servicesAt.fire ?? 0) / 100, 0, 1);
      const colors = COVERAGE_COLORS.fire;
      return `rgba(${colors.baseR}, ${colors.baseG + Math.floor(intensity * colors.intensityG)}, ${colors.baseB + Math.floor(intensity * colors.intensityB)}, ${colors.baseAlpha + intensity * colors.intensityAlpha})`;
    }

    case 'police': {
      const intensity = clamp((servicesAt.police ?? 0) / 100, 0, 1);
      const colors = COVERAGE_COLORS.police;
      return `rgba(${colors.baseR + Math.floor(intensity * colors.intensityR)}, ${colors.baseG + Math.floor(intensity * colors.intensityG)}, ${colors.baseB + Math.floor(intensity * colors.intensityB)}, ${colors.baseAlpha + intensity * colors.intensityAlpha})`;
    }

    case 'health': {
      const intensity = clamp((servicesAt.health ?? 0) / 100, 0, 1);
      const colors = COVERAGE_COLORS.health;
      return `rgba(${colors.baseR + Math.floor(intensity * colors.intensityR)}, ${colors.baseG + Math.floor(intensity * colors.intensityG)}, ${colors.baseB + Math.floor(intensity * colors.intensityB)}, ${colors.baseAlpha + intensity * colors.intensityAlpha})`;
    }

    case 'education': {
      const intensity = clamp((servicesAt.education ?? 0) / 100, 0, 1);
      const colors = COVERAGE_COLORS.education;
      return `rgba(${colors.baseR + Math.floor(intensity * colors.intensityR)}, ${colors.baseG + Math.floor(intensity * colors.intensityG)}, ${colors.baseB + Math.floor(intensity * colors.intensityB)}, ${colors.baseAlpha + intensity * colors.intensityAlpha})`;
    }

    case 'traffic': {
      const traffic = computeTrafficIndex(grid, tile.x, tile.y, gridSize);
      const t = clamp(traffic / 100, 0, 1);
      const color = triColor(t, HEATMAP_GOOD_LOW, HEATMAP_MID, HEATMAP_BAD_HIGH);
      return rgba(color, 0.12 + t * 0.55);
    }

    case 'pollution': {
      const t = clamp((tile.pollution ?? 0) / 100, 0, 1);
      const color = triColor(t, HEATMAP_GOOD_LOW, HEATMAP_MID, HEATMAP_BAD_HIGH);
      return rgba(color, 0.12 + t * 0.55);
    }

    case 'crime': {
      const crime = computeCrimeIndex(tile, servicesAt, grid, tile.x, tile.y, gridSize);
      const t = clamp(crime / 100, 0, 1);
      const color = triColor(t, HEATMAP_GOOD_LOW, HEATMAP_MID, HEATMAP_BAD_HIGH);
      return rgba(color, 0.12 + t * 0.55);
    }

    case 'landValue': {
      const landValue = computeLandValueIndex(tile, servicesAt, grid, tile.x, tile.y, gridSize);
      const t = clamp(landValue / 100, 0, 1);
      // For land value: low = bad (red), high = good (green)
      const color = triColor(t, HEATMAP_BAD_HIGH, HEATMAP_MID, HEATMAP_GOOD_LOW);
      return rgba(color, 0.12 + t * 0.55);
    }

    case 'subway':
      return tile.hasSubway
        ? 'rgba(245, 158, 11, 0.7)'
        : 'rgba(40, 30, 20, 0.4)';

    case 'none':
    default:
      return 'rgba(128, 128, 128, 0.4)';
  }
}

/**
 * Get the overlay mode that should be shown for a given tool.
 * Returns 'none' if the tool doesn't have an associated overlay.
 */
export function getOverlayForTool(tool: string): OverlayMode {
  return TOOL_TO_OVERLAY_MAP[tool] ?? 'none';
}

/** List of all overlay modes (for iteration) */
export const OVERLAY_MODES: OverlayMode[] = [
  'none',
  'power',
  'water',
  'fire',
  'police',
  'health',
  'education',
  'subway',
  // City metrics
  'traffic',
  'pollution',
  'landValue',
  'crime',
];
