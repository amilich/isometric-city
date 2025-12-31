/**
 * Rise of Nations - Enhanced Unit Rendering
 * 
 * Improved unit sprites with:
 * - Realistic military color palettes (muted, era-appropriate)
 * - Proper shadows and depth
 * - Water wakes for naval units
 * - Exhaust/propeller effects for vehicles/aircraft
 * - Better silhouettes and readability
 */

import { Unit, UnitType, UNIT_STATS } from '../types/units';
import { Age } from '../types/ages';
import { TILE_WIDTH, TILE_HEIGHT, gridToScreen } from '@/components/game/shared';

// ============================================================================
// ENHANCED COLOR PALETTES
// ============================================================================

// Realistic player colors (less saturated, more military)
export const ENHANCED_PLAYER_COLORS = [
  { primary: '#2a5a8a', secondary: '#1a3a5a', accent: '#4a7aaa' }, // Blue (NATO-like)
  { primary: '#8a3a2a', secondary: '#5a1a1a', accent: '#aa5a4a' }, // Red (Soviet-like)
  { primary: '#3a6a3a', secondary: '#1a4a1a', accent: '#5a8a5a' }, // Green (woodland)
  { primary: '#8a6a2a', secondary: '#5a4a1a', accent: '#aa8a4a' }, // Tan/khaki
  { primary: '#5a3a6a', secondary: '#3a1a4a', accent: '#7a5a8a' }, // Purple
  { primary: '#2a6a6a', secondary: '#1a4a4a', accent: '#4a8a8a' }, // Teal
  { primary: '#6a4a4a', secondary: '#4a2a2a', accent: '#8a6a6a' }, // Brown/maroon
  { primary: '#5a5a5a', secondary: '#3a3a3a', accent: '#7a7a7a' }, // Gray
];

// Get enhanced player colors from index
export function getEnhancedPlayerColor(playerIndex: number): { primary: string; secondary: string; accent: string } {
  return ENHANCED_PLAYER_COLORS[playerIndex % ENHANCED_PLAYER_COLORS.length];
}

// Skin tone variations (more realistic range)
const SKIN_TONES = [
  '#f5d0c0', // Very light
  '#e8c4b0', // Light
  '#d4a080', // Medium light
  '#c08060', // Medium
  '#a06040', // Medium dark
  '#804830', // Dark
];

// Hair colors
const HAIR_COLORS = [
  '#1a1412', // Black
  '#3a2820', // Dark brown
  '#5a4030', // Brown
  '#7a5a40', // Light brown
  '#a08060', // Blonde
  '#c0a080', // Light blonde
];

// Metal/equipment colors by era
const ERA_METAL_COLORS: Record<Age, { metal: string; wood: string; leather: string }> = {
  classical: { metal: '#b08050', wood: '#6a4a30', leather: '#8a6a4a' }, // Bronze age
  medieval: { metal: '#808080', wood: '#5a4030', leather: '#6a4a3a' }, // Iron/steel
  enlightenment: { metal: '#909090', wood: '#4a3a28', leather: '#5a4a3a' },
  industrial: { metal: '#606060', wood: '#3a2a20', leather: '#4a3a2a' }, // Dark steel
  modern: { metal: '#404040', wood: '#2a2020', leather: '#3a3030' }, // Modern alloys
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Hash unit ID for deterministic variation
function hashUnitId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Get appearance from unit ID
function getUnitAppearance(unitId: string): { skinTone: string; hairColor: string } {
  const hash = hashUnitId(unitId);
  return {
    skinTone: SKIN_TONES[hash % SKIN_TONES.length],
    hairColor: HAIR_COLORS[(hash >> 4) % HAIR_COLORS.length],
  };
}

// Shade a color
function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, (num >> 8 & 0xFF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0xFF) + amt));
  return '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
}

// Parse hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// ============================================================================
// SHADOW RENDERING
// ============================================================================

/**
 * Draw ground shadow for a unit
 */
export function drawEnhancedShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  isFlying: boolean = false
): void {
  const offsetY = isFlying ? 15 : 3;
  const alpha = isFlying ? 0.15 : 0.3;
  const scaleY = isFlying ? 0.3 : 0.4;
  
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y + offsetY, width * 0.5, height * scaleY, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// INFANTRY RENDERING
// ============================================================================

/**
 * Draw enhanced infantry unit
 */
export function drawEnhancedInfantry(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: Unit,
  colors: { primary: string; secondary: string; accent: string },
  scale: number,
  animPhase: number
): void {
  const age = unit.createdAtAge || 'classical';
  const appearance = getUnitAppearance(unit.id);
  const metalColors = ERA_METAL_COLORS[age];
  const isMoving = unit.isMoving;
  const legOffset = isMoving ? Math.sin(animPhase * 4) * 2 * scale : 0;
  
  // Shadow
  drawEnhancedShadow(ctx, x, y, 10 * scale, 6 * scale);
  
  ctx.save();
  ctx.translate(x, y);
  
  // Legs
  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 2.5 * scale;
  ctx.lineCap = 'round';
  
  ctx.beginPath();
  ctx.moveTo(-2 * scale, 0);
  ctx.lineTo(-2 * scale + legOffset * 0.4, 5 * scale);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(2 * scale, 0);
  ctx.lineTo(2 * scale - legOffset * 0.4, 5 * scale);
  ctx.stroke();
  
  // Boots
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.ellipse(-2 * scale + legOffset * 0.4, 5.5 * scale, 1.5 * scale, 1 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(2 * scale - legOffset * 0.4, 5.5 * scale, 1.5 * scale, 1 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Body/uniform
  const bodyGradient = ctx.createLinearGradient(-4 * scale, -8 * scale, 4 * scale, 0);
  bodyGradient.addColorStop(0, colors.primary);
  bodyGradient.addColorStop(0.5, shadeColor(colors.primary, 10));
  bodyGradient.addColorStop(1, colors.secondary);
  
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.roundRect(-3.5 * scale, -8 * scale, 7 * scale, 9 * scale, 1 * scale);
  ctx.fill();
  
  // Equipment based on era
  if (age === 'modern' || age === 'industrial') {
    // Tactical vest
    ctx.fillStyle = shadeColor(colors.primary, -20);
    ctx.beginPath();
    ctx.roundRect(-3 * scale, -6 * scale, 6 * scale, 5 * scale, 0.5 * scale);
    ctx.fill();
    
    // Pouches
    ctx.fillStyle = '#3a3a3a';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-2.5 * scale + i * 2 * scale, -4 * scale, 1.5 * scale, 2 * scale);
    }
  }
  
  // Belt
  ctx.fillStyle = metalColors.leather;
  ctx.fillRect(-3.5 * scale, -1 * scale, 7 * scale, 1.2 * scale);
  
  // Arms
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2 * scale;
  
  // Left arm
  ctx.beginPath();
  ctx.moveTo(-3.5 * scale, -6 * scale);
  ctx.lineTo(-5 * scale, -3 * scale);
  ctx.stroke();
  
  // Right arm (holding weapon)
  ctx.beginPath();
  ctx.moveTo(3.5 * scale, -6 * scale);
  ctx.lineTo(5 * scale, -4 * scale);
  ctx.stroke();
  
  // Hands
  ctx.fillStyle = appearance.skinTone;
  ctx.beginPath();
  ctx.arc(-5 * scale, -3 * scale, 1.2 * scale, 0, Math.PI * 2);
  ctx.arc(5 * scale, -4 * scale, 1.2 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Head
  ctx.fillStyle = appearance.skinTone;
  ctx.beginPath();
  ctx.arc(0, -11 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Helmet/headgear based on era
  if (age === 'classical') {
    // Simple cap/helmet
    ctx.fillStyle = metalColors.metal;
    ctx.beginPath();
    ctx.arc(0, -12 * scale, 3.2 * scale, Math.PI, 0);
    ctx.fill();
  } else if (age === 'medieval') {
    // Kettle helm
    ctx.fillStyle = metalColors.metal;
    ctx.beginPath();
    ctx.arc(0, -12 * scale, 3.2 * scale, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -9.5 * scale, 4 * scale, 1 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (age === 'enlightenment') {
    // Tricorn hat
    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    ctx.moveTo(-4 * scale, -10 * scale);
    ctx.lineTo(0, -15 * scale);
    ctx.lineTo(4 * scale, -10 * scale);
    ctx.closePath();
    ctx.fill();
  } else {
    // Modern helmet
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.arc(0, -12 * scale, 3.5 * scale, Math.PI * 0.8, Math.PI * 0.2);
    ctx.fill();
  }
  
  // Weapon based on era
  drawInfantryWeapon(ctx, age, metalColors, scale);
  
  ctx.restore();
}

/**
 * Draw infantry weapon based on era
 */
function drawInfantryWeapon(
  ctx: CanvasRenderingContext2D,
  age: Age,
  metalColors: { metal: string; wood: string },
  scale: number
): void {
  if (age === 'classical' || age === 'medieval') {
    // Spear/pike
    ctx.strokeStyle = metalColors.wood;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(5 * scale, -4 * scale);
    ctx.lineTo(6 * scale, -18 * scale);
    ctx.stroke();
    
    // Spear point
    ctx.fillStyle = metalColors.metal;
    ctx.beginPath();
    ctx.moveTo(6 * scale, -18 * scale);
    ctx.lineTo(5 * scale, -15 * scale);
    ctx.lineTo(7 * scale, -15 * scale);
    ctx.closePath();
    ctx.fill();
  } else if (age === 'enlightenment') {
    // Musket
    ctx.fillStyle = metalColors.wood;
    ctx.fillRect(4.5 * scale, -12 * scale, 1.5 * scale, 12 * scale);
    ctx.fillStyle = metalColors.metal;
    ctx.fillRect(4.7 * scale, -12 * scale, 1.1 * scale, 8 * scale);
    
    // Bayonet
    ctx.fillStyle = metalColors.metal;
    ctx.beginPath();
    ctx.moveTo(5.3 * scale, -12 * scale);
    ctx.lineTo(4.5 * scale, -15 * scale);
    ctx.lineTo(6.1 * scale, -15 * scale);
    ctx.closePath();
    ctx.fill();
  } else {
    // Modern rifle
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(4 * scale, -10 * scale, 2 * scale, 10 * scale);
    // Magazine
    ctx.fillRect(3.5 * scale, -5 * scale, 1.2 * scale, 3 * scale);
    // Stock
    ctx.fillRect(4.5 * scale, -1 * scale, 1.2 * scale, 4 * scale);
    // Barrel
    ctx.fillRect(4.5 * scale, -13 * scale, 1 * scale, 4 * scale);
  }
}

// ============================================================================
// CAVALRY/VEHICLE RENDERING
// ============================================================================

/**
 * Draw enhanced cavalry or vehicle unit
 */
export function drawEnhancedCavalry(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: Unit,
  colors: { primary: string; secondary: string; accent: string },
  scale: number,
  animPhase: number
): void {
  const age = unit.createdAtAge || 'classical';
  const isTank = age === 'industrial' || age === 'modern';
  
  if (isTank) {
    drawEnhancedTank(ctx, x, y, colors, scale, animPhase);
  } else {
    drawEnhancedHorse(ctx, x, y, unit, colors, scale, animPhase);
  }
}

/**
 * Draw enhanced tank/armored vehicle
 */
function drawEnhancedTank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colors: { primary: string; secondary: string },
  scale: number,
  animPhase: number
): void {
  const width = 16 * scale;
  const height = 10 * scale;
  
  // Shadow
  drawEnhancedShadow(ctx, x, y, width * 0.6, height * 0.3);
  
  ctx.save();
  ctx.translate(x, y);
  
  // Tracks
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.roundRect(-width * 0.55, -height * 0.15, width * 1.1, height * 0.35, 2 * scale);
  ctx.fill();
  
  // Track details (wheels)
  ctx.fillStyle = '#1a1a1a';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(-width * 0.4 + i * width * 0.2, 0, height * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Hull with gradient
  const hullGradient = ctx.createLinearGradient(-width * 0.5, -height * 0.5, width * 0.5, 0);
  hullGradient.addColorStop(0, colors.secondary);
  hullGradient.addColorStop(0.5, colors.primary);
  hullGradient.addColorStop(1, colors.secondary);
  
  ctx.fillStyle = hullGradient;
  ctx.beginPath();
  ctx.moveTo(-width * 0.5, -height * 0.15);
  ctx.lineTo(-width * 0.4, -height * 0.45);
  ctx.lineTo(width * 0.4, -height * 0.45);
  ctx.lineTo(width * 0.5, -height * 0.15);
  ctx.closePath();
  ctx.fill();
  
  // Turret
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.ellipse(0, -height * 0.5, width * 0.25, height * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Main gun
  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 3 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(width * 0.1, -height * 0.5);
  ctx.lineTo(width * 0.55, -height * 0.55);
  ctx.stroke();
  
  // Highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.ellipse(-width * 0.1, -height * 0.55, width * 0.12, height * 0.08, -0.3, 0, Math.PI * 2);
  ctx.fill();
  
  // Exhaust smoke when moving
  if (animPhase !== 0) {
    for (let i = 0; i < 3; i++) {
      const smokePhase = (animPhase + i * 0.3) % 1;
      const alpha = 0.3 - smokePhase * 0.3;
      const size = 2 + smokePhase * 4;
      
      ctx.fillStyle = `rgba(100, 100, 100, ${alpha})`;
      ctx.beginPath();
      ctx.arc(-width * 0.5 - smokePhase * 8, -height * 0.3 - smokePhase * 5, size * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}

/**
 * Draw enhanced horse with rider
 */
function drawEnhancedHorse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: Unit,
  colors: { primary: string; secondary: string },
  scale: number,
  animPhase: number
): void {
  const isMoving = unit.isMoving;
  const legOffset = isMoving ? Math.sin(animPhase * 5) * 3 * scale : 0;
  
  // Shadow
  drawEnhancedShadow(ctx, x, y, 14 * scale, 5 * scale);
  
  ctx.save();
  ctx.translate(x, y);
  
  // Horse body (brown)
  const horseColor = '#8a5a3a';
  const horseDark = '#5a3a2a';
  
  // Legs (animated)
  ctx.strokeStyle = horseColor;
  ctx.lineWidth = 2.5 * scale;
  ctx.lineCap = 'round';
  
  // Back legs
  ctx.beginPath();
  ctx.moveTo(-6 * scale, -2 * scale);
  ctx.lineTo(-7 * scale - legOffset * 0.4, 5 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4 * scale, -2 * scale);
  ctx.lineTo(-3 * scale + legOffset * 0.4, 5 * scale);
  ctx.stroke();
  
  // Front legs
  ctx.beginPath();
  ctx.moveTo(4 * scale, -2 * scale);
  ctx.lineTo(3 * scale + legOffset * 0.4, 5 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6 * scale, -2 * scale);
  ctx.lineTo(7 * scale - legOffset * 0.4, 5 * scale);
  ctx.stroke();
  
  // Horse body
  ctx.fillStyle = horseColor;
  ctx.beginPath();
  ctx.ellipse(0, -4 * scale, 10 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Darker underside
  ctx.fillStyle = horseDark;
  ctx.beginPath();
  ctx.ellipse(0, -3 * scale, 9 * scale, 3 * scale, 0, 0.3, Math.PI - 0.3);
  ctx.fill();
  
  // Horse head
  ctx.fillStyle = horseColor;
  ctx.beginPath();
  ctx.ellipse(10 * scale, -7 * scale, 4 * scale, 3 * scale, 0.4, 0, Math.PI * 2);
  ctx.fill();
  
  // Ears
  ctx.beginPath();
  ctx.moveTo(10 * scale, -10 * scale);
  ctx.lineTo(9 * scale, -12 * scale);
  ctx.lineTo(11 * scale, -11 * scale);
  ctx.closePath();
  ctx.fill();
  
  // Tail
  ctx.strokeStyle = horseDark;
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(-10 * scale, -4 * scale);
  ctx.quadraticCurveTo(-13 * scale, -2 * scale, -12 * scale, 2 * scale);
  ctx.stroke();
  
  // Saddle/blanket (player color)
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.ellipse(-1 * scale, -6 * scale, 5 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Rider body
  const appearance = getUnitAppearance(unit.id);
  
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.ellipse(-1 * scale, -12 * scale, 3 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Rider head
  ctx.fillStyle = appearance.skinTone;
  ctx.beginPath();
  ctx.arc(-1 * scale, -19 * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Helmet (player color)
  ctx.fillStyle = colors.secondary;
  ctx.beginPath();
  ctx.arc(-1 * scale, -20 * scale, 3 * scale, Math.PI, 0);
  ctx.fill();
  
  // Lance/weapon
  ctx.strokeStyle = '#5a4030';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(3 * scale, -10 * scale);
  ctx.lineTo(12 * scale, -25 * scale);
  ctx.stroke();
  
  // Lance tip
  ctx.fillStyle = '#a0a0a0';
  ctx.beginPath();
  ctx.moveTo(12 * scale, -25 * scale);
  ctx.lineTo(11 * scale, -22 * scale);
  ctx.lineTo(13 * scale, -22 * scale);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

// ============================================================================
// NAVAL UNIT RENDERING
// ============================================================================

/**
 * Draw enhanced naval unit with wake effects
 */
export function drawEnhancedNaval(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: Unit,
  colors: { primary: string; secondary: string; accent: string },
  scale: number,
  animPhase: number
): void {
  const age = unit.createdAtAge || 'classical';
  const bob = Math.sin(animPhase * 2) * 2 * scale;
  
  // Wake effect
  drawWakeEffect(ctx, x, y, scale, animPhase, unit.isMoving);
  
  ctx.save();
  ctx.translate(x, y + bob);
  
  if (age === 'modern' || age === 'industrial') {
    drawModernShip(ctx, colors, scale, age === 'modern');
  } else {
    drawSailingShip(ctx, colors, scale, age);
  }
  
  ctx.restore();
}

/**
 * Draw wake effect behind ship
 */
function drawWakeEffect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  animPhase: number,
  isMoving: boolean
): void {
  if (!isMoving) return;
  
  const wakeWidth = 25 * scale;
  
  // V-shaped wake
  ctx.fillStyle = 'rgba(200, 230, 255, 0.4)';
  ctx.beginPath();
  ctx.moveTo(x - wakeWidth, y + 8 * scale);
  ctx.lineTo(x + 5 * scale, y);
  ctx.lineTo(x - wakeWidth, y + 15 * scale);
  ctx.closePath();
  ctx.fill();
  
  // Foam bubbles
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  for (let i = 0; i < 5; i++) {
    const phase = (animPhase * 3 + i * 0.5) % 2;
    const bx = x - phase * 12 * scale - i * 3 * scale;
    const by = y + 5 * scale + (i % 2) * 4 * scale;
    const size = (1 + Math.sin(animPhase * 4 + i) * 0.3) * 2 * scale;
    
    ctx.beginPath();
    ctx.arc(bx, by, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw modern warship (destroyer/battleship)
 */
function drawModernShip(
  ctx: CanvasRenderingContext2D,
  colors: { primary: string; secondary: string },
  scale: number,
  isModern: boolean
): void {
  const width = 28 * scale;
  const height = 12 * scale;
  
  // Hull
  const hullGradient = ctx.createLinearGradient(-width * 0.4, 0, width * 0.4, 0);
  hullGradient.addColorStop(0, '#4a5568');
  hullGradient.addColorStop(0.5, '#6a7588');
  hullGradient.addColorStop(1, '#4a5568');
  
  ctx.fillStyle = hullGradient;
  ctx.beginPath();
  ctx.moveTo(-width * 0.4, 0);
  ctx.lineTo(width * 0.5, -height * 0.1);
  ctx.lineTo(width * 0.48, -height * 0.35);
  ctx.lineTo(-width * 0.38, -height * 0.35);
  ctx.closePath();
  ctx.fill();
  
  // Deck stripe (player color)
  ctx.fillStyle = colors.primary;
  ctx.fillRect(-width * 0.35, -height * 0.38, width * 0.7, height * 0.05);
  
  // Superstructure
  ctx.fillStyle = '#6a7585';
  ctx.fillRect(-width * 0.15, -height * 0.6, width * 0.3, height * 0.25);
  
  // Bridge
  ctx.fillStyle = '#7a8594';
  ctx.fillRect(-width * 0.08, -height * 0.75, width * 0.16, height * 0.18);
  
  // Forward gun turret
  ctx.fillStyle = colors.secondary;
  ctx.beginPath();
  ctx.arc(width * 0.25, -height * 0.45, width * 0.06, 0, Math.PI * 2);
  ctx.fill();
  
  // Gun barrel
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(width * 0.28, -height * 0.48);
  ctx.lineTo(width * 0.42, -height * 0.52);
  ctx.stroke();
  
  // Radar mast
  ctx.strokeStyle = '#4a4a4a';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(0, -height * 0.75);
  ctx.lineTo(0, -height * 1.0);
  ctx.stroke();
  
  // Flag (player color)
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.moveTo(0, -height * 1.0);
  ctx.lineTo(width * 0.1, -height * 0.9);
  ctx.lineTo(0, -height * 0.8);
  ctx.fill();
}

/**
 * Draw sailing ship
 */
function drawSailingShip(
  ctx: CanvasRenderingContext2D,
  colors: { primary: string; secondary: string },
  scale: number,
  age: Age
): void {
  const width = 22 * scale;
  const height = 12 * scale;
  
  // Hull
  ctx.fillStyle = '#5a4030';
  ctx.beginPath();
  ctx.moveTo(-width * 0.4, 0);
  ctx.quadraticCurveTo(0, height * 0.3, width * 0.45, 0);
  ctx.lineTo(width * 0.4, -height * 0.25);
  ctx.lineTo(-width * 0.35, -height * 0.25);
  ctx.closePath();
  ctx.fill();
  
  // Hull stripes
  ctx.strokeStyle = '#4a3020';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-width * 0.35, -height * 0.1);
  ctx.lineTo(width * 0.4, -height * 0.1);
  ctx.stroke();
  
  // Mast
  ctx.strokeStyle = '#4a3020';
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(0, -height * 0.25);
  ctx.lineTo(0, -height * 1.2);
  ctx.stroke();
  
  // Sail (player color)
  ctx.fillStyle = '#f5f5f0';
  ctx.beginPath();
  ctx.moveTo(0, -height * 0.3);
  ctx.quadraticCurveTo(width * 0.25, -height * 0.7, 0, -height * 1.1);
  ctx.quadraticCurveTo(-width * 0.15, -height * 0.7, 0, -height * 0.3);
  ctx.fill();
  
  // Cross on sail (player color)
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(0, -height * 0.9);
  ctx.lineTo(0, -height * 0.5);
  ctx.moveTo(-width * 0.1, -height * 0.7);
  ctx.lineTo(width * 0.1, -height * 0.7);
  ctx.stroke();
  
  // Flag
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.moveTo(0, -height * 1.2);
  ctx.lineTo(width * 0.1, -height * 1.1);
  ctx.lineTo(0, -height * 1.0);
  ctx.fill();
}

// ============================================================================
// AIRCRAFT RENDERING
// ============================================================================

/**
 * Draw enhanced aircraft with circling animation
 */
export function drawEnhancedAircraft(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: Unit,
  colors: { primary: string; secondary: string; accent: string },
  scale: number,
  animPhase: number
): void {
  const age = unit.createdAtAge || 'industrial';
  
  // Circling animation
  const circleRadius = 25 * scale;
  const circleSpeed = 0.5;
  const circleX = Math.cos(animPhase * circleSpeed) * circleRadius;
  const circleY = Math.sin(animPhase * circleSpeed) * circleRadius * 0.4;
  const altitude = -20 * scale;
  
  const drawX = x + circleX;
  const drawY = y + circleY + altitude;
  const heading = animPhase * circleSpeed + Math.PI / 2;
  
  // Ground shadow
  drawEnhancedShadow(ctx, x + circleX, y + circleY, 12 * scale, 4 * scale, true);
  
  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.rotate(heading);
  
  if (age === 'industrial') {
    drawBiplane(ctx, colors, scale);
  } else {
    drawJetFighter(ctx, colors, scale);
  }
  
  ctx.restore();
  
  // Exhaust/contrail
  if (age === 'modern') {
    drawContrail(ctx, drawX, drawY, heading, scale, animPhase);
  }
}

/**
 * Draw biplane
 */
function drawBiplane(
  ctx: CanvasRenderingContext2D,
  colors: { primary: string; secondary: string },
  scale: number
): void {
  const size = 18 * scale;
  
  // Fuselage
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.4, size * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Upper wing
  ctx.fillStyle = colors.secondary;
  ctx.fillRect(-size * 0.12, -size * 0.3, size * 0.24, size * 0.06);
  
  // Lower wing
  ctx.fillRect(-size * 0.1, -size * 0.1, size * 0.2, size * 0.05);
  
  // Wing struts
  ctx.strokeStyle = '#5a4030';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-size * 0.08, -size * 0.1);
  ctx.lineTo(-size * 0.1, -size * 0.3);
  ctx.moveTo(size * 0.08, -size * 0.1);
  ctx.lineTo(size * 0.1, -size * 0.3);
  ctx.stroke();
  
  // Propeller blur
  ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
  ctx.beginPath();
  ctx.ellipse(size * 0.4, 0, size * 0.03, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Tail
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.moveTo(-size * 0.35, 0);
  ctx.lineTo(-size * 0.45, -size * 0.12);
  ctx.lineTo(-size * 0.45, size * 0.12);
  ctx.closePath();
  ctx.fill();
  
  // Cockpit
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.ellipse(size * 0.15, -size * 0.05, size * 0.06, size * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw jet fighter
 */
function drawJetFighter(
  ctx: CanvasRenderingContext2D,
  colors: { primary: string; secondary: string },
  scale: number
): void {
  const size = 22 * scale;
  
  // Fuselage
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.moveTo(size * 0.45, 0);
  ctx.lineTo(size * 0.25, -size * 0.06);
  ctx.lineTo(-size * 0.35, -size * 0.08);
  ctx.lineTo(-size * 0.4, 0);
  ctx.lineTo(-size * 0.35, size * 0.08);
  ctx.lineTo(size * 0.25, size * 0.06);
  ctx.closePath();
  ctx.fill();
  
  // Delta wings
  ctx.fillStyle = colors.secondary;
  ctx.beginPath();
  ctx.moveTo(size * 0.08, 0);
  ctx.lineTo(-size * 0.15, -size * 0.35);
  ctx.lineTo(-size * 0.28, -size * 0.35);
  ctx.lineTo(-size * 0.12, 0);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(size * 0.08, 0);
  ctx.lineTo(-size * 0.15, size * 0.35);
  ctx.lineTo(-size * 0.28, size * 0.35);
  ctx.lineTo(-size * 0.12, 0);
  ctx.closePath();
  ctx.fill();
  
  // Tail fins
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.moveTo(-size * 0.32, 0);
  ctx.lineTo(-size * 0.4, -size * 0.15);
  ctx.lineTo(-size * 0.36, 0);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(-size * 0.32, 0);
  ctx.lineTo(-size * 0.4, size * 0.15);
  ctx.lineTo(-size * 0.36, 0);
  ctx.closePath();
  ctx.fill();
  
  // Cockpit
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.ellipse(size * 0.2, 0, size * 0.1, size * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Engine glow
  ctx.fillStyle = 'rgba(255, 150, 50, 0.7)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.42, 0, size * 0.04, size * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Missiles
  ctx.fillStyle = '#606060';
  ctx.fillRect(-size * 0.08, -size * 0.28, size * 0.12, size * 0.025);
  ctx.fillRect(-size * 0.08, size * 0.255, size * 0.12, size * 0.025);
}

/**
 * Draw contrail behind jet
 */
function drawContrail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  heading: number,
  scale: number,
  animPhase: number
): void {
  const dx = -Math.cos(heading);
  const dy = -Math.sin(heading);
  
  for (let i = 0; i < 8; i++) {
    const alpha = 0.3 - i * 0.035;
    if (alpha <= 0) continue;
    
    const dist = (i + 1) * 4 * scale;
    const px = x + dx * dist;
    const py = y + dy * dist * 0.4;
    const size = (1 + i * 0.3) * scale;
    
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// MAIN DRAWING FUNCTION
// ============================================================================

/**
 * Draw an enhanced unit with all improvements
 */
export function drawEnhancedUnit(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  offsetX: number,
  offsetY: number,
  zoom: number,
  playerIndex: number,
  tick: number
): void {
  const { screenX, screenY } = gridToScreen(unit.x, unit.y, offsetX, offsetY);
  const centerX = screenX + TILE_WIDTH / 2;
  const centerY = screenY + TILE_HEIGHT * 0.3;
  
  const colors = getEnhancedPlayerColor(playerIndex);
  const stats = UNIT_STATS[unit.type];
  const scale = 0.8;
  const animPhase = tick * 0.1;
  
  // Draw based on unit category
  if (stats.category === 'infantry' || stats.category === 'ranged') {
    drawEnhancedInfantry(ctx, centerX, centerY, unit, colors, scale, animPhase);
  } else if (stats.category === 'cavalry') {
    drawEnhancedCavalry(ctx, centerX, centerY, unit, colors, scale * 1.3, animPhase);
  } else if (stats.category === 'naval') {
    drawEnhancedNaval(ctx, centerX, centerY, unit, colors, scale * 1.5, animPhase);
  } else if (stats.category === 'air') {
    drawEnhancedAircraft(ctx, centerX, centerY, unit, colors, scale * 0.8, animPhase);
  } else if (stats.category === 'siege') {
    drawEnhancedSiege(ctx, centerX, centerY, unit, colors, scale * 1.2, animPhase);
  } else {
    // Civilian - use simpler rendering
    drawEnhancedCivilian(ctx, centerX, centerY, unit, colors, scale, animPhase);
  }
  
  // Selection indicator
  if (unit.isSelected) {
    drawSelectionRing(ctx, centerX, centerY, scale);
  }
  
  // Health bar
  const healthPercent = unit.health / unit.maxHealth;
  if (stats.category !== 'civilian' || healthPercent < 1) {
    drawEnhancedHealthBar(ctx, centerX, centerY, healthPercent, scale);
  }
}

/**
 * Draw siege unit
 */
function drawEnhancedSiege(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: Unit,
  colors: { primary: string; secondary: string },
  scale: number,
  animPhase: number
): void {
  const age = unit.createdAtAge || 'classical';
  
  drawEnhancedShadow(ctx, x, y, 16 * scale, 6 * scale);
  
  ctx.save();
  ctx.translate(x, y);
  
  if (age === 'modern' || age === 'industrial') {
    // Artillery
    const width = 16 * scale;
    const height = 10 * scale;
    
    // Wheels
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.arc(-width * 0.3, 0, height * 0.2, 0, Math.PI * 2);
    ctx.arc(width * 0.3, 0, height * 0.2, 0, Math.PI * 2);
    ctx.fill();
    
    // Carriage
    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    ctx.roundRect(-width * 0.35, -height * 0.3, width * 0.7, height * 0.25, 1 * scale);
    ctx.fill();
    
    // Barrel
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath();
    ctx.roundRect(-width * 0.1, -height * 0.35, width * 0.6, height * 0.15, 2 * scale);
    ctx.fill();
  } else {
    // Catapult/trebuchet
    const width = 14 * scale;
    const height = 10 * scale;
    
    // Frame
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(-width * 0.4, -height * 0.15, width * 0.8, height * 0.25);
    
    // Wheels
    ctx.fillStyle = '#3a2820';
    ctx.beginPath();
    ctx.arc(-width * 0.35, height * 0.1, height * 0.15, 0, Math.PI * 2);
    ctx.arc(width * 0.35, height * 0.1, height * 0.15, 0, Math.PI * 2);
    ctx.fill();
    
    // Throwing arm
    ctx.strokeStyle = '#5a4030';
    ctx.lineWidth = 3 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -height * 0.1);
    ctx.lineTo(width * 0.4, -height * 0.6);
    ctx.stroke();
    
    // Boulder
    ctx.fillStyle = '#6a6a6a';
    ctx.beginPath();
    ctx.arc(width * 0.45, -height * 0.55, height * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Draw civilian worker
 */
function drawEnhancedCivilian(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: Unit,
  colors: { primary: string; secondary: string },
  scale: number,
  animPhase: number
): void {
  const appearance = getUnitAppearance(unit.id);
  const isMoving = unit.isMoving;
  const legOffset = isMoving ? Math.sin(animPhase * 4) * 2 * scale : 0;
  
  drawEnhancedShadow(ctx, x, y, 8 * scale, 4 * scale);
  
  ctx.save();
  ctx.translate(x, y);
  
  // Legs
  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = 'round';
  
  ctx.beginPath();
  ctx.moveTo(-1.5 * scale, 0);
  ctx.lineTo(-1.5 * scale + legOffset * 0.4, 4 * scale);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(1.5 * scale, 0);
  ctx.lineTo(1.5 * scale - legOffset * 0.4, 4 * scale);
  ctx.stroke();
  
  // Body
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.roundRect(-3 * scale, -6 * scale, 6 * scale, 7 * scale, 1 * scale);
  ctx.fill();
  
  // Head
  ctx.fillStyle = appearance.skinTone;
  ctx.beginPath();
  ctx.arc(0, -8.5 * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Hair
  ctx.fillStyle = appearance.hairColor;
  ctx.beginPath();
  ctx.arc(0, -9 * scale, 2.5 * scale, Math.PI * 1.1, Math.PI * 1.9);
  ctx.fill();
  
  // Tool based on task
  if (unit.task?.startsWith('gather_')) {
    const toolColor = unit.task === 'gather_wood' ? '#5a4030' : '#6a6a6a';
    ctx.strokeStyle = toolColor;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(4 * scale, -4 * scale);
    ctx.lineTo(6 * scale, -10 * scale);
    ctx.stroke();
    
    // Tool head
    ctx.fillStyle = toolColor;
    ctx.beginPath();
    ctx.arc(6 * scale, -10 * scale, 1.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Draw selection ring around unit
 */
function drawSelectionRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number
): void {
  const radius = 8 * scale;
  
  // White ring
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Green glow
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Draw enhanced health bar
 */
function drawEnhancedHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  healthPercent: number,
  scale: number
): void {
  const barWidth = 16 * scale;
  const barHeight = 3;
  const barX = x - barWidth / 2;
  const barY = y - 16 * scale;
  
  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
  
  // Health fill
  const healthColor = healthPercent > 0.6 ? '#22c55e' : healthPercent > 0.3 ? '#f59e0b' : '#ef4444';
  ctx.fillStyle = healthColor;
  ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
  
  // Border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
}
