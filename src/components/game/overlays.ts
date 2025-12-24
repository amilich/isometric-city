/**
 * Overlay mode utilities and configuration.
 * Handles visualization overlays for power, water, services, etc.
 */

import { Tile } from '@/types/game';
import { OverlayMode } from './types';

// ============================================================================
// Types
// ============================================================================

/** Service coverage data for a tile */
export type ServiceCoverage = {
  fire: number;
  police: number;
  health: number;
  education: number;
};

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
    label: 'Yok',
    title: 'Kaplama Yok',
    activeColor: '',
    hoverColor: '',
  },
  power: {
    label: 'Elektrik',
    title: 'Elektrik Şebekesi',
    activeColor: 'bg-amber-500',
    hoverColor: 'hover:bg-amber-600',
  },
  water: {
    label: 'Su',
    title: 'Su Sistemi',
    activeColor: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-600',
  },
  fire: {
    label: 'İtfaiye',
    title: 'İtfaiye Kapsamı',
    activeColor: 'bg-red-500',
    hoverColor: 'hover:bg-red-600',
  },
  police: {
    label: 'Polis',
    title: 'Polis Kapsamı',
    activeColor: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
  },
  health: {
    label: 'Sağlık',
    title: 'Sağlık Kapsamı',
    activeColor: 'bg-green-500',
    hoverColor: 'hover:bg-green-600',
  },
  education: {
    label: 'Eğitim',
    title: 'Eğitim Kapsamı',
    activeColor: 'bg-purple-500',
    hoverColor: 'hover:bg-purple-600',
  },
  subway: {
    label: 'Metro',
    title: 'Metro Kapsamı',
    activeColor: 'bg-yellow-500',
    hoverColor: 'hover:bg-yellow-600',
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
  coverage: ServiceCoverage
): string {
  switch (mode) {
    case 'power':
      return tile.building.powered
        ? 'rgba(34, 197, 94, 0.4)'  // Green for powered
        : 'rgba(239, 68, 68, 0.4)'; // Red for unpowered

    case 'water':
      return tile.building.watered
        ? 'rgba(34, 197, 94, 0.4)'  // Green for watered
        : 'rgba(239, 68, 68, 0.4)'; // Red for not watered

    case 'fire': {
      const intensity = coverage.fire / 100;
      const colors = COVERAGE_COLORS.fire;
      return `rgba(${colors.baseR}, ${colors.baseG + Math.floor(intensity * colors.intensityG)}, ${colors.baseB + Math.floor(intensity * colors.intensityB)}, ${colors.baseAlpha + intensity * colors.intensityAlpha})`;
    }

    case 'police': {
      const intensity = coverage.police / 100;
      const colors = COVERAGE_COLORS.police;
      return `rgba(${colors.baseR + Math.floor(intensity * colors.intensityR)}, ${colors.baseG + Math.floor(intensity * colors.intensityG)}, ${colors.baseB + Math.floor(intensity * colors.intensityB)}, ${colors.baseAlpha + intensity * colors.intensityAlpha})`;
    }

    case 'health': {
      const intensity = coverage.health / 100;
      const colors = COVERAGE_COLORS.health;
      return `rgba(${colors.baseR + Math.floor(intensity * colors.intensityR)}, ${colors.baseG + Math.floor(intensity * colors.intensityG)}, ${colors.baseB + Math.floor(intensity * colors.intensityB)}, ${colors.baseAlpha + intensity * colors.intensityAlpha})`;
    }

    case 'education': {
      const intensity = coverage.education / 100;
      const colors = COVERAGE_COLORS.education;
      return `rgba(${colors.baseR + Math.floor(intensity * colors.intensityR)}, ${colors.baseG + Math.floor(intensity * colors.intensityG)}, ${colors.baseB + Math.floor(intensity * colors.intensityB)}, ${colors.baseAlpha + intensity * colors.intensityAlpha})`;
    }

    case 'subway':
      // Underground view overlay
      return tile.hasSubway
        ? 'rgba(245, 158, 11, 0.7)'  // Bright amber for existing subway
        : 'rgba(40, 30, 20, 0.4)';   // Dark brown tint for "underground" view

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
  'none', 'power', 'water', 'fire', 'police', 'health', 'education', 'subway'
];
