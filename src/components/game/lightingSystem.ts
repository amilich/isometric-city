import { useEffect } from 'react';
import { Tile, BuildingType } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT, WorldRenderState } from './types';
import {
  NON_LIT_BUILDING_TYPES,
  RESIDENTIAL_BUILDING_TYPES,
  COMMERCIAL_BUILDING_TYPES,
} from './constants';
import { gridToScreen } from './utils';

// ============================================================================
// LIGHTING UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate darkness level based on hour of day (0-23)
 * Dawn: 5-7, Day: 7-18, Dusk: 18-20, Night: 20-5
 * @returns Value from 0 (full daylight) to 1 (full night)
 */
export function getDarkness(hour: number): number {
  if (hour >= 7 && hour < 18) return 0; // Full daylight
  if (hour >= 5 && hour < 7) return 1 - (hour - 5) / 2; // Dawn transition
  if (hour >= 18 && hour < 20) return (hour - 18) / 2; // Dusk transition
  return 1; // Night
}

/**
 * Get ambient color based on time of day
 * Returns RGB values for the ambient lighting overlay
 */
export function getAmbientColor(hour: number): { r: number; g: number; b: number } {
  if (hour >= 7 && hour < 18) return { r: 255, g: 255, b: 255 };
  if (hour >= 5 && hour < 7) {
    const t = (hour - 5) / 2;
    return { 
      r: Math.round(60 + 40 * t), 
      g: Math.round(40 + 30 * t), 
      b: Math.round(70 + 20 * t) 
    };
  }
  if (hour >= 18 && hour < 20) {
    const t = (hour - 18) / 2;
    return { 
      r: Math.round(100 - 40 * t), 
      g: Math.round(70 - 30 * t), 
      b: Math.round(90 - 20 * t) 
    };
  }
  return { r: 20, g: 30, b: 60 }; // Night
}

/**
 * Deterministic pseudo-random function for consistent window lighting patterns
 * @param seed - Base seed (typically derived from tile position)
 * @param n - Additional variation factor
 * @returns Value between 0 and 1
 */
export function pseudoRandom(seed: number, n: number): number {
  const s = Math.sin(seed + n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

// ============================================================================
// TYPES
// ============================================================================

export interface LightCutout {
  x: number;
  y: number;
  type: 'road' | 'building';
  buildingType?: string;
  seed?: number;
}

export interface ColoredGlow {
  x: number;
  y: number;
  type: string;
}

export interface LightingSystemConfig {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  visualHour: number;
  offset: { x: number; y: number };
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
  isMobile: boolean;
  isPanningRef: React.MutableRefObject<boolean>;
  isPinchZoomingRef: React.MutableRefObject<boolean>;
  /** Ref to track desktop wheel zooming state */
  isWheelZoomingRef: React.MutableRefObject<boolean>;
  /** Boolean state value to trigger re-render when panning stops */
  isPanning: boolean;
  /** Boolean state value to trigger re-render when wheel zooming stops */
  isWheelZooming: boolean;
}

// ============================================================================
// LIGHT COLLECTION
// ============================================================================

/**
 * Collect light sources from visible tiles
 * Returns arrays of light cutouts (for darkness removal) and colored glows (for atmospheric effects)
 */
export function collectLightSources(
  grid: Tile[][],
  gridSize: number,
  visibleMinSum: number,
  visibleMaxSum: number,
  viewLeft: number,
  viewRight: number,
  viewTop: number,
  viewBottom: number,
  isMobile: boolean
): { lightCutouts: LightCutout[]; coloredGlows: ColoredGlow[] } {
  const lightCutouts: LightCutout[] = [];
  const coloredGlows: ColoredGlow[] = [];
  
  // PERF: On mobile, sample fewer lights to reduce gradient count
  const roadSampleRate = isMobile ? 3 : 1; // Every 3rd road on mobile
  let roadCounter = 0;
  
  // PERF: Only iterate through diagonal bands that intersect the visible viewport
  for (let sum = visibleMinSum; sum <= visibleMaxSum; sum++) {
    for (let x = Math.max(0, sum - gridSize + 1); x <= Math.min(sum, gridSize - 1); x++) {
      const y = sum - x;
      if (y < 0 || y >= gridSize) continue;
      
      const { screenX, screenY } = gridToScreen(x, y, 0, 0);
      
      // Viewport culling for horizontal bounds
      if (screenX + TILE_WIDTH < viewLeft || screenX > viewRight ||
          screenY + TILE_HEIGHT * 3 < viewTop || screenY > viewBottom) {
        continue;
      }
      
      const tile = grid[y][x];
      const buildingType = tile.building.type;
      
      if (buildingType === 'road' || buildingType === 'bridge') {
        roadCounter++;
        // PERF: On mobile, only include every Nth road light
        if (roadCounter % roadSampleRate === 0) {
          lightCutouts.push({ x, y, type: 'road' });
          if (!isMobile) {
            coloredGlows.push({ x, y, type: 'road' });
          }
        }
      } else if (!NON_LIT_BUILDING_TYPES.has(buildingType) && tile.building.powered) {
        lightCutouts.push({ x, y, type: 'building', buildingType, seed: x * 1000 + y });
        
        // Check for special colored glows (skip on mobile for performance)
        if (!isMobile && (buildingType === 'hospital' || buildingType === 'fire_station' || 
            buildingType === 'police_station' || buildingType === 'power_plant')) {
          coloredGlows.push({ x, y, type: buildingType });
        }
      }
    }
  }
  
  return { lightCutouts, coloredGlows };
}

// ============================================================================
// RENDERING FUNCTIONS
// ============================================================================

/**
 * Draw light cutouts to remove darkness around light sources
 */
export function drawLightCutouts(
  ctx: CanvasRenderingContext2D,
  lightCutouts: LightCutout[],
  lightIntensity: number,
  isMobile: boolean
): void {
  for (const light of lightCutouts) {
    const { screenX, screenY } = gridToScreen(light.x, light.y, 0, 0);
    const tileCenterX = screenX + TILE_WIDTH / 2;
    const tileCenterY = screenY + TILE_HEIGHT / 2;
    
    if (light.type === 'road') {
      const lightRadius = 28;
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY, 0, tileCenterX, tileCenterY, lightRadius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${0.75 * lightIntensity})`);
      gradient.addColorStop(0.4, `rgba(255, 255, 255, ${0.4 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY, lightRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (light.type === 'building' && light.buildingType && light.seed !== undefined) {
      const buildingType = light.buildingType;
      const isResidential = RESIDENTIAL_BUILDING_TYPES.has(buildingType);
      const isCommercial = COMMERCIAL_BUILDING_TYPES.has(buildingType);
      const glowStrength = isCommercial ? 0.9 : isResidential ? 0.65 : 0.75;
      
      // PERF: On mobile, skip individual window lights - just use ground glow
      if (!isMobile) {
        // Draw window lights
        let numWindows = 2;
        if (buildingType.includes('medium') || buildingType.includes('low')) numWindows = 3;
        if (buildingType.includes('high') || buildingType === 'mall') numWindows = 5;
        if (buildingType === 'mansion' || buildingType === 'office_high') numWindows = 4;
        
        const windowSize = 5;
        const buildingHeight = -18;
        
        for (let i = 0; i < numWindows; i++) {
          const isLit = pseudoRandom(light.seed, i) < (isResidential ? 0.55 : 0.75);
          if (!isLit) continue;
          
          const wx = tileCenterX + (pseudoRandom(light.seed, i + 10) - 0.5) * 22;
          const wy = tileCenterY + buildingHeight + (pseudoRandom(light.seed, i + 20) - 0.5) * 16;
          
          const gradient = ctx.createRadialGradient(wx, wy, 0, wx, wy, windowSize * 2.5);
          gradient.addColorStop(0, `rgba(255, 255, 255, ${glowStrength * lightIntensity})`);
          gradient.addColorStop(0.5, `rgba(255, 255, 255, ${glowStrength * 0.4 * lightIntensity})`);
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(wx, wy, windowSize * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // Ground glow (on mobile, use a simpler/stronger single gradient)
      const groundGlowRadius = isMobile ? TILE_WIDTH * 0.5 : TILE_WIDTH * 0.6;
      const groundGlowAlpha = isMobile ? 0.4 : 0.28;
      const groundGlow = ctx.createRadialGradient(
        tileCenterX, tileCenterY + TILE_HEIGHT / 4, 0,
        tileCenterX, tileCenterY + TILE_HEIGHT / 4, groundGlowRadius
      );
      groundGlow.addColorStop(0, `rgba(255, 255, 255, ${groundGlowAlpha * lightIntensity})`);
      groundGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = groundGlow;
      ctx.beginPath();
      ctx.ellipse(tileCenterX, tileCenterY + TILE_HEIGHT / 4, groundGlowRadius, TILE_HEIGHT / 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draw colored glows for special buildings (hospitals, fire stations, etc.)
 */
export function drawColoredGlows(
  ctx: CanvasRenderingContext2D,
  coloredGlows: ColoredGlow[],
  lightIntensity: number
): void {
  for (const glow of coloredGlows) {
    const { screenX, screenY } = gridToScreen(glow.x, glow.y, 0, 0);
    const tileCenterX = screenX + TILE_WIDTH / 2;
    const tileCenterY = screenY + TILE_HEIGHT / 2;
    
    if (glow.type === 'road') {
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY, 0, tileCenterX, tileCenterY, 20);
      gradient.addColorStop(0, `rgba(255, 210, 130, ${0.3 * lightIntensity})`);
      gradient.addColorStop(0.5, `rgba(255, 190, 100, ${0.15 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY, 20, 0, Math.PI * 2);
      ctx.fill();
    } else {
      let glowColor: { r: number; g: number; b: number } | null = null;
      let glowRadius = 20;
      
      if (glow.type === 'hospital') {
        glowColor = { r: 255, g: 80, b: 80 };
        glowRadius = 25;
      } else if (glow.type === 'fire_station') {
        glowColor = { r: 255, g: 100, b: 50 };
        glowRadius = 22;
      } else if (glow.type === 'police_station') {
        glowColor = { r: 60, g: 140, b: 255 };
        glowRadius = 22;
      } else if (glow.type === 'power_plant') {
        glowColor = { r: 255, g: 200, b: 50 };
        glowRadius = 30;
      }
      
      if (glowColor) {
        const gradient = ctx.createRadialGradient(
          tileCenterX, tileCenterY - 15, 0,
          tileCenterX, tileCenterY - 15, glowRadius
        );
        gradient.addColorStop(0, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.55 * lightIntensity})`);
        gradient.addColorStop(0.5, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.25 * lightIntensity})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(tileCenterX, tileCenterY - 15, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Hook for rendering day/night lighting effects
 * Renders darkness overlay with light cutouts for buildings and roads
 */
export function useLightingSystem(config: LightingSystemConfig): void {
  const {
    canvasRef,
    worldStateRef,
    visualHour,
    offset,
    zoom,
    canvasWidth,
    canvasHeight,
    isMobile,
    isPanningRef,
    isPinchZoomingRef,
    isWheelZoomingRef,
    isPanning,
    isWheelZooming,
  } = config;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // PERF: Hide lighting during panning/zooming for better performance
    // This prevents ugly light sampling artifacts and improves pan smoothness
    // On desktop, also hide during wheel zoom (isWheelZoomingRef)
    if (isPanningRef.current || isPinchZoomingRef.current || isWheelZoomingRef.current) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    const darkness = getDarkness(visualHour);
    
    // Clear canvas first
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If it's full daylight, just clear and return (early exit)
    if (darkness <= 0.01) return;
    
    const ambient = getAmbientColor(visualHour);
    
    // Apply darkness overlay
    const alpha = darkness * 0.6;
    ctx.fillStyle = `rgba(${ambient.r}, ${ambient.g}, ${ambient.b}, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate viewport bounds once
    const viewWidth = canvas.width / (dpr * zoom);
    const viewHeight = canvas.height / (dpr * zoom);
    const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
    const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
    const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
    const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;
    
    // PERF: Pre-compute visible diagonal range to skip entire rows of tiles
    // PERF: Read grid/gridSize from ref to avoid triggering re-render on every simulation tick
    const currentGrid = worldStateRef.current.grid;
    const currentGridSize = worldStateRef.current.gridSize;
    const visibleMinSum = Math.max(0, Math.floor((viewTop - TILE_HEIGHT * 6) * 2 / TILE_HEIGHT));
    const visibleMaxSum = Math.min(currentGridSize * 2 - 2, Math.ceil((viewBottom + TILE_HEIGHT) * 2 / TILE_HEIGHT));
    
    const lightIntensity = Math.min(1, darkness * 1.3);
    
    // Collect light sources in a single pass through visible tiles
    const { lightCutouts, coloredGlows } = collectLightSources(
      currentGrid,
      currentGridSize,
      visibleMinSum,
      visibleMaxSum,
      viewLeft,
      viewRight,
      viewTop,
      viewBottom,
      isMobile
    );
    
    // Draw light cutouts (destination-out)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    
    drawLightCutouts(ctx, lightCutouts, lightIntensity, isMobile);
    
    ctx.restore();
    
    // Draw colored glows (source-over)
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    
    drawColoredGlows(ctx, coloredGlows, lightIntensity);
    
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    
  // PERF: Use worldStateRef instead of grid/gridSize in deps to avoid re-running on every simulation tick
  // Lighting only needs to update when visualHour changes or viewport moves, not every time grid state changes
  // Note: isPanning/isWheelZooming (boolean states) are in deps so the effect re-runs when panning/zooming stops; refs alone don't trigger re-renders
  }, [canvasRef, worldStateRef, visualHour, offset, zoom, canvasWidth, canvasHeight, isMobile, isPanningRef, isPinchZoomingRef, isWheelZoomingRef, isPanning, isWheelZooming]);
}
