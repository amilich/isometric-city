/**
 * Dynamic Lighting System
 * 
 * Provides realistic lighting effects:
 * - Time-of-day ambient lighting
 * - Entity shadows (buildings, units)
 * - Light sources (torches, buildings, explosions)
 * - Global illumination overlay
 */

import { createNoise2D } from 'simplex-noise';

const lightNoise = createNoise2D();

// ============================================================================
// TIME OF DAY CONFIGURATION
// ============================================================================

export interface LightingState {
  sunAngle: number;        // 0 = sunrise, 90 = noon, 180 = sunset
  sunIntensity: number;    // 0-1
  ambientColor: string;
  shadowColor: string;
  shadowLength: number;
  shadowOpacity: number;
  fogColor: string;
  fogIntensity: number;
}

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night';

const LIGHTING_PRESETS: Record<TimeOfDay, LightingState> = {
  dawn: {
    sunAngle: 15,
    sunIntensity: 0.4,
    ambientColor: 'rgba(255, 180, 120, 0.15)',
    shadowColor: 'rgba(80, 50, 120, 0.4)',
    shadowLength: 3.0,
    shadowOpacity: 0.3,
    fogColor: 'rgba(255, 200, 150, 0.1)',
    fogIntensity: 0.15,
  },
  morning: {
    sunAngle: 45,
    sunIntensity: 0.7,
    ambientColor: 'rgba(255, 250, 220, 0.08)',
    shadowColor: 'rgba(50, 70, 100, 0.35)',
    shadowLength: 1.8,
    shadowOpacity: 0.35,
    fogColor: 'rgba(255, 255, 255, 0.05)',
    fogIntensity: 0.05,
  },
  noon: {
    sunAngle: 90,
    sunIntensity: 1.0,
    ambientColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: 'rgba(40, 60, 90, 0.4)',
    shadowLength: 0.5,
    shadowOpacity: 0.4,
    fogColor: 'rgba(255, 255, 255, 0)',
    fogIntensity: 0,
  },
  afternoon: {
    sunAngle: 135,
    sunIntensity: 0.85,
    ambientColor: 'rgba(255, 240, 200, 0.08)',
    shadowColor: 'rgba(60, 60, 100, 0.35)',
    shadowLength: 1.5,
    shadowOpacity: 0.35,
    fogColor: 'rgba(255, 240, 200, 0.05)',
    fogIntensity: 0.05,
  },
  dusk: {
    sunAngle: 165,
    sunIntensity: 0.45,
    ambientColor: 'rgba(255, 100, 50, 0.2)',
    shadowColor: 'rgba(80, 40, 100, 0.45)',
    shadowLength: 2.5,
    shadowOpacity: 0.35,
    fogColor: 'rgba(255, 120, 80, 0.12)',
    fogIntensity: 0.1,
  },
  night: {
    sunAngle: 270,
    sunIntensity: 0.1,
    ambientColor: 'rgba(30, 50, 100, 0.35)',
    shadowColor: 'rgba(0, 0, 0, 0.6)',
    shadowLength: 0.3,
    shadowOpacity: 0.5,
    fogColor: 'rgba(20, 30, 60, 0.2)',
    fogIntensity: 0.2,
  },
};

/**
 * Get lighting state for a given time (0-24 hours)
 */
export function getLightingForTime(hourOfDay: number): LightingState {
  // Map hours to presets
  if (hourOfDay >= 5 && hourOfDay < 7) return LIGHTING_PRESETS.dawn;
  if (hourOfDay >= 7 && hourOfDay < 11) return LIGHTING_PRESETS.morning;
  if (hourOfDay >= 11 && hourOfDay < 14) return LIGHTING_PRESETS.noon;
  if (hourOfDay >= 14 && hourOfDay < 17) return LIGHTING_PRESETS.afternoon;
  if (hourOfDay >= 17 && hourOfDay < 20) return LIGHTING_PRESETS.dusk;
  return LIGHTING_PRESETS.night;
}

/**
 * Interpolate between two lighting states
 */
export function interpolateLighting(a: LightingState, b: LightingState, t: number): LightingState {
  const lerp = (v1: number, v2: number) => v1 + (v2 - v1) * t;
  
  return {
    sunAngle: lerp(a.sunAngle, b.sunAngle),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity),
    ambientColor: a.ambientColor, // Keep discrete for now
    shadowColor: a.shadowColor,
    shadowLength: lerp(a.shadowLength, b.shadowLength),
    shadowOpacity: lerp(a.shadowOpacity, b.shadowOpacity),
    fogColor: a.fogColor,
    fogIntensity: lerp(a.fogIntensity, b.fogIntensity),
  };
}

// ============================================================================
// SHADOW RENDERING
// ============================================================================

/**
 * Draw an isometric shadow for a building or structure
 */
export function drawBuildingShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  buildingHeight: number,
  lighting: LightingState
): void {
  if (lighting.shadowOpacity <= 0) return;
  
  const shadowAngle = (lighting.sunAngle * Math.PI) / 180;
  const shadowDirX = Math.cos(shadowAngle) * lighting.shadowLength;
  const shadowDirY = Math.sin(shadowAngle) * lighting.shadowLength * 0.5; // Flatten for isometric
  
  const shadowOffsetX = shadowDirX * buildingHeight * 0.3;
  const shadowOffsetY = shadowDirY * buildingHeight * 0.3;
  
  ctx.save();
  ctx.fillStyle = lighting.shadowColor;
  ctx.globalAlpha = lighting.shadowOpacity * 0.7;
  
  // Draw elongated shadow shape
  ctx.beginPath();
  
  // Base of building
  ctx.moveTo(x - width * 0.5, y);
  ctx.lineTo(x, y + height * 0.25);
  ctx.lineTo(x + width * 0.5, y);
  ctx.lineTo(x, y - height * 0.25);
  ctx.closePath();
  
  // Shadow projection
  ctx.moveTo(x - width * 0.5 + shadowOffsetX, y + shadowOffsetY);
  ctx.lineTo(x + shadowOffsetX, y + height * 0.25 + shadowOffsetY);
  ctx.lineTo(x + width * 0.5 + shadowOffsetX, y + shadowOffsetY);
  ctx.lineTo(x + shadowOffsetX, y - height * 0.25 + shadowOffsetY);
  ctx.closePath();
  
  ctx.fill();
  ctx.restore();
}

/**
 * Draw shadow for a unit
 */
export function drawUnitShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unitWidth: number,
  unitHeight: number,
  lighting: LightingState
): void {
  if (lighting.shadowOpacity <= 0) return;
  
  const shadowScale = 0.8 + (1 - lighting.sunIntensity) * 0.3;
  
  ctx.save();
  ctx.fillStyle = lighting.shadowColor;
  ctx.globalAlpha = lighting.shadowOpacity * 0.5;
  
  // Simple ellipse shadow
  ctx.beginPath();
  ctx.ellipse(
    x + lighting.shadowLength * 3,
    y + 2,
    unitWidth * shadowScale * 0.5,
    unitHeight * shadowScale * 0.25,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
}

// ============================================================================
// LIGHT SOURCES
// ============================================================================

interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
  flicker: boolean;
  flickerPhase: number;
}

const lightSources: LightSource[] = [];

/**
 * Add a light source (torch, building light, etc.)
 */
export function addLightSource(
  x: number,
  y: number,
  radius: number,
  color: string = 'rgba(255, 200, 100, 0.8)',
  intensity: number = 1,
  flicker: boolean = true
): number {
  const id = lightSources.length;
  lightSources.push({
    x,
    y,
    radius,
    color,
    intensity,
    flicker,
    flickerPhase: Math.random() * Math.PI * 2,
  });
  return id;
}

/**
 * Update light source position
 */
export function updateLightSource(id: number, x: number, y: number): void {
  if (lightSources[id]) {
    lightSources[id].x = x;
    lightSources[id].y = y;
  }
}

/**
 * Remove a light source
 */
export function removeLightSource(id: number): void {
  if (lightSources[id]) {
    lightSources[id].intensity = 0;
  }
}

/**
 * Clear all light sources
 */
export function clearLightSources(): void {
  lightSources.length = 0;
}

/**
 * Draw light glow effect
 */
function drawLightGlow(
  ctx: CanvasRenderingContext2D,
  light: LightSource,
  time: number,
  screenX: number,
  screenY: number
): void {
  let intensity = light.intensity;
  
  if (light.flicker) {
    const flicker1 = Math.sin(time * 10 + light.flickerPhase) * 0.1;
    const flicker2 = lightNoise(time * 5, light.flickerPhase) * 0.1;
    intensity *= 0.9 + flicker1 + flicker2;
  }
  
  const gradient = ctx.createRadialGradient(
    screenX, screenY, 0,
    screenX, screenY, light.radius
  );
  
  // Parse color to add alpha
  const baseColor = light.color;
  gradient.addColorStop(0, baseColor.replace(/[\d.]+\)$/, `${intensity * 0.8})`));
  gradient.addColorStop(0.3, baseColor.replace(/[\d.]+\)$/, `${intensity * 0.4})`));
  gradient.addColorStop(0.7, baseColor.replace(/[\d.]+\)$/, `${intensity * 0.1})`));
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(screenX, screenY, light.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw all light sources
 */
export function drawLightSources(
  ctx: CanvasRenderingContext2D,
  gridToScreen: (x: number, y: number) => { screenX: number; screenY: number },
  viewBounds: { left: number; right: number; top: number; bottom: number },
  time: number,
  lighting: LightingState
): void {
  // Only draw lights when it's dark enough
  if (lighting.sunIntensity > 0.6) return;
  
  for (const light of lightSources) {
    if (light.intensity <= 0) continue;
    
    const { screenX, screenY } = gridToScreen(light.x, light.y);
    
    // Cull off-screen
    if (screenX < viewBounds.left - light.radius || screenX > viewBounds.right + light.radius ||
        screenY < viewBounds.top - light.radius || screenY > viewBounds.bottom + light.radius) {
      continue;
    }
    
    drawLightGlow(ctx, light, time, screenX, screenY);
  }
}

// ============================================================================
// GLOBAL LIGHTING OVERLAY
// ============================================================================

/**
 * Apply ambient lighting overlay to entire canvas
 */
export function applyAmbientLighting(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  lighting: LightingState
): void {
  // Ambient color overlay
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = lighting.ambientColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Fog overlay
  if (lighting.fogIntensity > 0) {
    ctx.fillStyle = lighting.fogColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
  
  ctx.restore();
}

/**
 * Apply vignette effect
 */
export function applyVignette(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  intensity: number = 0.3
): void {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const radius = Math.max(canvasWidth, canvasHeight) * 0.7;
  
  const gradient = ctx.createRadialGradient(
    centerX, centerY, radius * 0.5,
    centerX, centerY, radius
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);
  
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.restore();
}

// ============================================================================
// SPECIAL EFFECTS
// ============================================================================

interface Explosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

const explosions: Explosion[] = [];

/**
 * Trigger an explosion effect
 */
export function createExplosion(x: number, y: number, radius: number = 60): void {
  explosions.push({
    x,
    y,
    radius: 0,
    maxRadius: radius,
    life: 1,
    maxLife: 0.5,
  });
  
  // Add temporary light source
  addLightSource(x, y, radius * 2, 'rgba(255, 150, 50, 0.9)', 1.5, true);
}

/**
 * Update explosions
 */
export function updateExplosions(deltaTime: number): void {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const exp = explosions[i];
    exp.life -= deltaTime / exp.maxLife;
    exp.radius = exp.maxRadius * (1 - exp.life);
    
    if (exp.life <= 0) {
      explosions.splice(i, 1);
    }
  }
}

/**
 * Draw explosions
 */
export function drawExplosions(
  ctx: CanvasRenderingContext2D,
  gridToScreen: (x: number, y: number) => { screenX: number; screenY: number },
  viewBounds: { left: number; right: number; top: number; bottom: number }
): void {
  for (const exp of explosions) {
    const { screenX, screenY } = gridToScreen(exp.x, exp.y);
    
    // Cull off-screen
    if (screenX < viewBounds.left - exp.maxRadius || screenX > viewBounds.right + exp.maxRadius ||
        screenY < viewBounds.top - exp.maxRadius || screenY > viewBounds.bottom + exp.maxRadius) {
      continue;
    }
    
    const progress = 1 - exp.life;
    
    // Outer glow
    const gradient = ctx.createRadialGradient(
      screenX, screenY, 0,
      screenX, screenY, exp.radius
    );
    
    if (progress < 0.3) {
      // Initial flash
      gradient.addColorStop(0, `rgba(255, 255, 200, ${exp.life * 0.8})`);
      gradient.addColorStop(0.3, `rgba(255, 200, 100, ${exp.life * 0.6})`);
      gradient.addColorStop(0.6, `rgba(255, 100, 0, ${exp.life * 0.3})`);
      gradient.addColorStop(1, 'rgba(100, 50, 0, 0)');
    } else {
      // Smoke phase
      gradient.addColorStop(0, `rgba(100, 80, 60, ${exp.life * 0.5})`);
      gradient.addColorStop(0.5, `rgba(60, 50, 40, ${exp.life * 0.3})`);
      gradient.addColorStop(1, 'rgba(40, 40, 40, 0)');
    }
    
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, exp.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ============================================================================
// MUZZLE FLASH
// ============================================================================

interface MuzzleFlash {
  x: number;
  y: number;
  angle: number;
  life: number;
}

const muzzleFlashes: MuzzleFlash[] = [];

/**
 * Create a muzzle flash effect
 */
export function createMuzzleFlash(x: number, y: number, angle: number): void {
  muzzleFlashes.push({
    x,
    y,
    angle,
    life: 0.05,
  });
}

/**
 * Update muzzle flashes
 */
export function updateMuzzleFlashes(deltaTime: number): void {
  for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
    muzzleFlashes[i].life -= deltaTime;
    if (muzzleFlashes[i].life <= 0) {
      muzzleFlashes.splice(i, 1);
    }
  }
}

/**
 * Draw muzzle flashes
 */
export function drawMuzzleFlashes(
  ctx: CanvasRenderingContext2D,
  gridToScreen: (x: number, y: number) => { screenX: number; screenY: number }
): void {
  for (const flash of muzzleFlashes) {
    const { screenX, screenY } = gridToScreen(flash.x, flash.y);
    const alpha = flash.life / 0.05;
    
    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(flash.angle);
    
    // Flash cone
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
    gradient.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
    gradient.addColorStop(0.3, `rgba(255, 200, 100, ${alpha * 0.6})`);
    gradient.addColorStop(1, 'rgba(255, 150, 50, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(15, 0);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }
}

// ============================================================================
// MAIN EXPORTS
// ============================================================================

/**
 * Update all lighting effects
 */
export function updateLightingEffects(deltaTime: number): void {
  updateExplosions(deltaTime);
  updateMuzzleFlashes(deltaTime);
}

/**
 * Draw all lighting effects (call after world, before UI)
 */
export function drawLightingEffects(
  ctx: CanvasRenderingContext2D,
  gridToScreen: (x: number, y: number) => { screenX: number; screenY: number },
  viewBounds: { left: number; right: number; top: number; bottom: number },
  time: number,
  lighting: LightingState
): void {
  drawExplosions(ctx, gridToScreen, viewBounds);
  drawMuzzleFlashes(ctx, gridToScreen);
  drawLightSources(ctx, gridToScreen, viewBounds, time, lighting);
}

export { LIGHTING_PRESETS };
