/**
 * Rise of Nations - Unit Drawing
 * 
 * Renders units with pedestrian-like sprites and task-based activities.
 * Inspired by IsoCity's pedestrian system but simplified for RTS units.
 */

import { Unit, UnitTask, UNIT_STATS } from '../types/units';
import { TILE_WIDTH, TILE_HEIGHT, gridToScreen } from '@/components/game/shared';

// Skin tone colors (similar to IsoCity)
const SKIN_TONES = ['#f5d0c5', '#e8beac', '#d4a574', '#c68642', '#8d5524', '#5c3317'];

// Clothing colors for civilians
const CIVILIAN_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Hair colors
const HAIR_COLORS = ['#2c1810', '#4a3728', '#8b4513', '#d4a574', '#f5deb3', '#1a1a1a'];

// Tool colors for different tasks
const TOOL_COLORS: Record<string, string> = {
  gather_wood: '#8b4513',   // Brown axe
  gather_metal: '#6b7280',  // Grey pickaxe
  gather_food: '#f59e0b',   // Golden scythe
  gather_gold: '#fbbf24',   // Gold pan
  gather_oil: '#1f2937',    // Dark oil tool
  build: '#a16207',         // Hammer
};

/**
 * Get a numeric hash from a unit ID for animation and appearance
 */
function getUnitIdHash(unitId: string): number {
  let hash = 0;
  for (let i = 0; i < unitId.length; i++) {
    hash = ((hash << 5) - hash) + unitId.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Get deterministic values based on unit ID for consistent appearance
 */
function getUnitAppearance(unitId: string): {
  skinTone: string;
  clothingColor: string;
  hairColor: string;
  hasTool: boolean;
} {
  // Simple hash from unit ID
  const absHash = getUnitIdHash(unitId);
  
  return {
    skinTone: SKIN_TONES[absHash % SKIN_TONES.length],
    clothingColor: CIVILIAN_COLORS[(absHash >> 4) % CIVILIAN_COLORS.length],
    hairColor: HAIR_COLORS[(absHash >> 8) % HAIR_COLORS.length],
    hasTool: true,
  };
}

/**
 * Draw a citizen/worker unit with activity-based animation
 */
function drawCitizenUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  zoom: number,
  tick: number,
  playerColor: string
): void {
  const appearance = getUnitAppearance(unit.id);
  // Use player color for clothing instead of random color
  const clothingColor = playerColor;
  // Canvas is already scaled by zoom, so just use a fixed scale
  // Increased by 50% for better visibility
  const scale = 0.75;
  
  // Animation based on task and movement
  const isWorking = unit.task && unit.task.startsWith('gather_') && !unit.isMoving;
  const animPhase = (tick * 0.1 + getUnitIdHash(unit.id)) % (Math.PI * 2);
  
  // Body dimensions
  const bodyHeight = 10 * scale;
  const bodyWidth = 5 * scale;
  const headRadius = 3 * scale;
  const legLength = 4 * scale;
  
  // Walking animation
  let legOffset = 0;
  let armSwing = 0;
  if (unit.isMoving) {
    legOffset = Math.sin(animPhase * 3) * 2 * scale;
    armSwing = Math.sin(animPhase * 3) * 0.3;
  }
  
  // Working animation (tool swinging)
  let toolAngle = 0;
  let bodyLean = 0;
  if (isWorking) {
    toolAngle = Math.sin(animPhase * 2) * 0.5;
    bodyLean = Math.sin(animPhase * 2) * 0.1;
  }
  
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(bodyLean);
  
  // Draw legs
  ctx.strokeStyle = clothingColor;
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = 'round';
  
  // Left leg
  ctx.beginPath();
  ctx.moveTo(-bodyWidth * 0.3, 0);
  ctx.lineTo(-bodyWidth * 0.3 + legOffset * 0.5, legLength);
  ctx.stroke();
  
  // Right leg
  ctx.beginPath();
  ctx.moveTo(bodyWidth * 0.3, 0);
  ctx.lineTo(bodyWidth * 0.3 - legOffset * 0.5, legLength);
  ctx.stroke();
  
  // Draw body (torso)
  ctx.fillStyle = clothingColor;
  ctx.beginPath();
  ctx.ellipse(0, -bodyHeight * 0.4, bodyWidth * 0.6, bodyHeight * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw arms
  ctx.strokeStyle = appearance.skinTone;
  ctx.lineWidth = 2 * scale;
  
  // Left arm
  ctx.beginPath();
  ctx.moveTo(-bodyWidth * 0.5, -bodyHeight * 0.5);
  ctx.lineTo(-bodyWidth * 0.8, -bodyHeight * 0.2 + Math.sin(armSwing) * 3 * scale);
  ctx.stroke();
  
  // Right arm (with tool if working)
  ctx.beginPath();
  ctx.moveTo(bodyWidth * 0.5, -bodyHeight * 0.5);
  if (isWorking && unit.task) {
    // Arm holding tool
    const toolEndX = bodyWidth * 0.8 + Math.sin(toolAngle) * 6 * scale;
    const toolEndY = -bodyHeight * 0.2 + Math.cos(toolAngle) * 6 * scale;
    ctx.lineTo(toolEndX, toolEndY);
    ctx.stroke();
    
    // Draw tool
    const toolColor = TOOL_COLORS[unit.task] || '#6b7280';
    ctx.strokeStyle = toolColor;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(toolEndX, toolEndY);
    ctx.lineTo(toolEndX + Math.sin(toolAngle + 0.5) * 5 * scale, toolEndY - 4 * scale);
    ctx.stroke();
    
    // Tool head
    ctx.fillStyle = toolColor;
    ctx.beginPath();
    ctx.arc(toolEndX + Math.sin(toolAngle + 0.5) * 5 * scale, toolEndY - 5 * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.lineTo(bodyWidth * 0.8, -bodyHeight * 0.2 - Math.sin(armSwing) * 3 * scale);
    ctx.stroke();
  }
  
  // Draw head
  ctx.fillStyle = appearance.skinTone;
  ctx.beginPath();
  ctx.arc(0, -bodyHeight - headRadius, headRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw hair
  ctx.fillStyle = appearance.hairColor;
  ctx.beginPath();
  ctx.arc(0, -bodyHeight - headRadius - headRadius * 0.3, headRadius * 0.9, Math.PI, 0);
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw a military unit with detailed appearance based on unit type
 */
function drawMilitaryUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  zoom: number,
  tick: number
): void {
  const stats = UNIT_STATS[unit.type];
  // Naval units largest, cavalry/tanks medium-large, air smaller (they circle so look bigger), infantry smaller
  // All scales increased by 50% for better visibility
  const isTankOrVehicle = unit.type.includes('tank') || unit.type.includes('armored');
  const baseScale = stats.category === 'naval' ? 1.5 :
                    stats.category === 'air' ? 0.7 :  // Smaller aircraft with larger circles
                    stats.category === 'cavalry' ? (isTankOrVehicle ? 1.5 : 1.05) :
                    stats.category === 'siege' ? 1.2 : 0.75;
  const scale = baseScale;
  const animPhase = (tick * 0.1 + getUnitIdHash(unit.id)) % (Math.PI * 2);

  // Darken color for shadows
  const darkerColor = shadeColor(color, -30);
  const lighterColor = shadeColor(color, 30);
  
  if (stats.category === 'cavalry') {
    // Draw horse/mount with rider
    drawCavalryUnit(ctx, centerX, centerY, unit, color, darkerColor, lighterColor, scale, animPhase);
  } else if (stats.category === 'siege') {
    // Draw siege weapon (catapult, cannon, etc.)
    drawSiegeUnit(ctx, centerX, centerY, unit, color, darkerColor, scale, animPhase);
  } else if (stats.category === 'ranged') {
    // Draw ranged soldier with bow/gun
    drawRangedUnit(ctx, centerX, centerY, unit, color, darkerColor, scale, animPhase);
  } else if (stats.category === 'naval') {
    // Draw ship/boat
    drawNavalUnit(ctx, centerX, centerY, unit, color, darkerColor, lighterColor, scale, animPhase);
  } else if (stats.category === 'air') {
    // Draw aircraft
    drawAirUnit(ctx, centerX, centerY, unit, color, darkerColor, lighterColor, scale, animPhase);
  } else {
    // Infantry - draw soldier with weapon and shield
    drawInfantryUnit(ctx, centerX, centerY, unit, color, darkerColor, scale, animPhase);
  }
}

/**
 * Shade a hex color lighter or darker
 */
function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + 
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 + 
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 + 
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

/**
 * Draw infantry soldier with unique appearance per unit type
 */
function drawInfantryUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  darkerColor: string,
  scale: number,
  animPhase: number
): void {
  // Dispatch to specific infantry drawing function
  switch (unit.type) {
    case 'militia':
      drawMilitia(ctx, centerX, centerY, color, darkerColor, scale, animPhase, unit.isMoving);
      break;
    case 'hoplite':
      drawHoplite(ctx, centerX, centerY, color, darkerColor, scale, animPhase, unit.isMoving);
      break;
    case 'pikeman':
      drawPikeman(ctx, centerX, centerY, color, darkerColor, scale, animPhase, unit.isMoving);
      break;
    case 'swordsman':
      drawSwordsman(ctx, centerX, centerY, color, darkerColor, scale, animPhase, unit.isMoving);
      break;
    case 'musketeer':
      drawMusketeer(ctx, centerX, centerY, color, darkerColor, scale, animPhase, unit.isMoving);
      break;
    case 'rifleman':
      drawRifleman(ctx, centerX, centerY, color, darkerColor, scale, animPhase, unit.isMoving);
      break;
    case 'assault_infantry':
      drawAssaultInfantry(ctx, centerX, centerY, color, darkerColor, scale, animPhase, unit.isMoving);
      break;
    default:
      drawGenericInfantry(ctx, centerX, centerY, color, darkerColor, scale, animPhase, unit.isMoving);
  }
}

// ============ INFANTRY UNIT SPRITES ============

function drawGenericInfantry(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, phase: number, moving: boolean): void {
  const bodyHeight = 10 * s;
  const bodyWidth = 5 * s;
  const headRadius = 2.5 * s;
  const legLength = 4 * s;
  const legOffset = moving ? Math.sin(phase * 3) * 2 * s : 0;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + legLength + 1, bodyWidth * 0.8, bodyWidth * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.strokeStyle = '#3d3d3d';
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - bodyWidth * 0.25, cy);
  ctx.lineTo(cx - bodyWidth * 0.25 + legOffset * 0.4, cy + legLength);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + bodyWidth * 0.25, cy);
  ctx.lineTo(cx + bodyWidth * 0.25 - legOffset * 0.4, cy + legLength);
  ctx.stroke();

  // Boots
  ctx.fillStyle = '#2d2d2d';
  ctx.beginPath();
  ctx.arc(cx - bodyWidth * 0.25 + legOffset * 0.4, cy + legLength, 1.2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + bodyWidth * 0.25 - legOffset * 0.4, cy + legLength, 1.2 * s, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - bodyWidth * 0.5, cy - bodyHeight * 0.7, bodyWidth, bodyHeight * 0.8, 1 * s);
  ctx.fill();

  // Head
  ctx.fillStyle = '#e8d4b8';
  ctx.beginPath();
  ctx.arc(cx, cy - bodyHeight * 0.7 - headRadius * 0.5, headRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawMilitia(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, phase: number, moving: boolean): void {
  const legOffset = moving ? Math.sin(phase * 3) * 2 * s : 0;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5 * s, 4 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (use darker team color)
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 1.5 * s, cy);
  ctx.lineTo(cx - 1.5 * s + legOffset * 0.3, cy + 4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 1.5 * s, cy);
  ctx.lineTo(cx + 1.5 * s - legOffset * 0.3, cy + 4 * s);
  ctx.stroke();

  // Body (team color tunic)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - 3 * s, cy - 6 * s, 6 * s, 7 * s, 1 * s);
  ctx.fill();

  // Head
  ctx.fillStyle = '#e8d4b8';
  ctx.beginPath();
  ctx.arc(cx, cy - 8 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // Pitchfork/club
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(cx + 4 * s, cy - 10 * s);
  ctx.lineTo(cx + 4 * s, cy + 2 * s);
  ctx.stroke();
  // Prongs
  ctx.beginPath();
  ctx.moveTo(cx + 3 * s, cy - 10 * s);
  ctx.lineTo(cx + 4 * s, cy - 8 * s);
  ctx.lineTo(cx + 5 * s, cy - 10 * s);
  ctx.stroke();
}

function drawHoplite(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, phase: number, moving: boolean): void {
  const legOffset = moving ? Math.sin(phase * 3) * 2 * s : 0;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5 * s, 5 * s, 2 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (bronze greaves)
  ctx.strokeStyle = '#cd853f';
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 1.5 * s, cy);
  ctx.lineTo(cx - 1.5 * s + legOffset * 0.3, cy + 4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 1.5 * s, cy);
  ctx.lineTo(cx + 1.5 * s - legOffset * 0.3, cy + 4 * s);
  ctx.stroke();

  // Large round shield (aspis) - use team color
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx - 3 * s, cy - 3 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  // Shield rim
  ctx.strokeStyle = '#cd853f';
  ctx.lineWidth = 1 * s;
  ctx.stroke();
  // Lambda symbol
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 5 * s, cy - 6 * s);
  ctx.lineTo(cx - 3 * s, cy);
  ctx.lineTo(cx - 1 * s, cy - 6 * s);
  ctx.stroke();

  // Body (bronze cuirass)
  ctx.fillStyle = '#cd853f';
  ctx.beginPath();
  ctx.roundRect(cx - 2.5 * s, cy - 7 * s, 5 * s, 7 * s, 1 * s);
  ctx.fill();

  // Head with corinthian helmet
  ctx.fillStyle = '#cd853f';
  ctx.beginPath();
  ctx.arc(cx, cy - 9 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  // Helmet crest (team color plume)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 12 * s, 1 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Face slit
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - 1 * s, cy - 10 * s, 2 * s, 2 * s);

  // Spear (dory)
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(cx + 4 * s, cy - 14 * s);
  ctx.lineTo(cx + 4 * s, cy + 3 * s);
  ctx.stroke();
  // Spear point
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.moveTo(cx + 4 * s, cy - 14 * s);
  ctx.lineTo(cx + 3 * s, cy - 12 * s);
  ctx.lineTo(cx + 5 * s, cy - 12 * s);
  ctx.closePath();
  ctx.fill();
}

function drawPikeman(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, phase: number, moving: boolean): void {
  const legOffset = moving ? Math.sin(phase * 3) * 2 * s : 0;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5 * s, 4 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.strokeStyle = '#4a4a4a';
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 1.5 * s, cy);
  ctx.lineTo(cx - 1.5 * s + legOffset * 0.3, cy + 4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 1.5 * s, cy);
  ctx.lineTo(cx + 1.5 * s - legOffset * 0.3, cy + 4 * s);
  ctx.stroke();

  // Body (padded armor)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - 3 * s, cy - 6 * s, 6 * s, 7 * s, 1 * s);
  ctx.fill();
  // Quilted pattern
  ctx.strokeStyle = dark;
  ctx.lineWidth = 0.5 * s;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 3 * s, cy - 4 * s + i * 2 * s);
    ctx.lineTo(cx + 3 * s, cy - 4 * s + i * 2 * s);
    ctx.stroke();
  }

  // Head with kettle helmet
  ctx.fillStyle = '#808080';
  ctx.beginPath();
  ctx.arc(cx, cy - 8 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();
  // Brim
  ctx.beginPath();
  ctx.ellipse(cx, cy - 6 * s, 3.5 * s, 1 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Very long pike
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(cx + 3 * s, cy - 18 * s);
  ctx.lineTo(cx + 3 * s, cy + 4 * s);
  ctx.stroke();
  // Pike head
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.moveTo(cx + 3 * s, cy - 18 * s);
  ctx.lineTo(cx + 2 * s, cy - 15 * s);
  ctx.lineTo(cx + 4 * s, cy - 15 * s);
  ctx.closePath();
  ctx.fill();
}

function drawSwordsman(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, phase: number, moving: boolean): void {
  const legOffset = moving ? Math.sin(phase * 3) * 2 * s : 0;
  const swordSwing = Math.sin(phase * 4) * 0.3;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5 * s, 4 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (chainmail leggings)
  ctx.strokeStyle = '#6b6b6b';
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 1.5 * s, cy);
  ctx.lineTo(cx - 1.5 * s + legOffset * 0.3, cy + 4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 1.5 * s, cy);
  ctx.lineTo(cx + 1.5 * s - legOffset * 0.3, cy + 4 * s);
  ctx.stroke();

  // Body (chainmail hauberk)
  ctx.fillStyle = '#808080';
  ctx.beginPath();
  ctx.roundRect(cx - 3 * s, cy - 7 * s, 6 * s, 8 * s, 1 * s);
  ctx.fill();
  // Surcoat
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - 2.5 * s, cy - 5 * s);
  ctx.lineTo(cx + 2.5 * s, cy - 5 * s);
  ctx.lineTo(cx + 2.5 * s, cy + 2 * s);
  ctx.lineTo(cx - 2.5 * s, cy + 2 * s);
  ctx.closePath();
  ctx.fill();

  // Head with great helm
  ctx.fillStyle = '#a0a0a0';
  ctx.beginPath();
  ctx.roundRect(cx - 2.5 * s, cy - 11 * s, 5 * s, 5 * s, 0.5 * s);
  ctx.fill();
  // Eye slits
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - 2 * s, cy - 9 * s, 4 * s, 0.8 * s);
  // Cross on helm
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 10 * s);
  ctx.lineTo(cx, cy - 7 * s);
  ctx.moveTo(cx - 1.5 * s, cy - 8.5 * s);
  ctx.lineTo(cx + 1.5 * s, cy - 8.5 * s);
  ctx.stroke();

  // Sword
  ctx.save();
  ctx.translate(cx + 4 * s, cy - 4 * s);
  ctx.rotate(swordSwing);
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(-0.8 * s, -8 * s, 1.6 * s, 10 * s);
  // Crossguard
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(-2.5 * s, 1 * s, 5 * s, 1.5 * s);
  // Handle
  ctx.fillStyle = '#5c4033';
  ctx.fillRect(-0.6 * s, 2 * s, 1.2 * s, 3 * s);
  ctx.restore();

  // Shield
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - 5 * s, cy - 6 * s);
  ctx.lineTo(cx - 5 * s, cy + 1 * s);
  ctx.lineTo(cx - 2 * s, cy + 3 * s);
  ctx.lineTo(cx - 2 * s, cy - 6 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#808080';
  ctx.lineWidth = 0.5 * s;
  ctx.stroke();
}

function drawMusketeer(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, phase: number, moving: boolean): void {
  const legOffset = moving ? Math.sin(phase * 3) * 2 * s : 0;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5 * s, 4 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (breeches - team color)
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 1.5 * s, cy);
  ctx.lineTo(cx - 1.5 * s + legOffset * 0.3, cy + 4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 1.5 * s, cy);
  ctx.lineTo(cx + 1.5 * s - legOffset * 0.3, cy + 4 * s);
  ctx.stroke();

  // Boots with cuffs
  ctx.fillStyle = '#2d2d2d';
  ctx.beginPath();
  ctx.arc(cx - 1.5 * s + legOffset * 0.3, cy + 4 * s, 1.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 1.5 * s - legOffset * 0.3, cy + 4 * s, 1.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // Body (team color doublet with sash)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - 3 * s, cy - 7 * s, 6 * s, 8 * s, 1 * s);
  ctx.fill();
  // Sash (light accent)
  ctx.fillStyle = '#f5f5dc';
  ctx.beginPath();
  ctx.moveTo(cx - 3 * s, cy - 5 * s);
  ctx.lineTo(cx + 3 * s, cy - 2 * s);
  ctx.lineTo(cx + 3 * s, cy - 1 * s);
  ctx.lineTo(cx - 3 * s, cy - 4 * s);
  ctx.closePath();
  ctx.fill();

  // Head with wide-brimmed hat
  ctx.fillStyle = '#e8d4b8';
  ctx.beginPath();
  ctx.arc(cx, cy - 9 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  // Hat (team color)
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 10 * s, 4 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy - 11 * s, 2 * s, Math.PI, 0);
  ctx.fill();
  // Feather (team color)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx + 2 * s, cy - 13 * s, 0.8 * s, 3 * s, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Musket
  ctx.fillStyle = '#5c4033';
  ctx.fillRect(cx + 3 * s, cy - 8 * s, 1.5 * s, 12 * s);
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(cx + 3.2 * s, cy - 8 * s, 1.1 * s, 8 * s);
}

function drawRifleman(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, phase: number, moving: boolean): void {
  const legOffset = moving ? Math.sin(phase * 3) * 2 * s : 0;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5 * s, 4 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (team color trousers)
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 1.5 * s, cy);
  ctx.lineTo(cx - 1.5 * s + legOffset * 0.3, cy + 4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 1.5 * s, cy);
  ctx.lineTo(cx + 1.5 * s - legOffset * 0.3, cy + 4 * s);
  ctx.stroke();

  // Body (team color military tunic)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - 3 * s, cy - 7 * s, 6 * s, 8 * s, 1 * s);
  ctx.fill();
  // Belt with ammo pouches
  ctx.fillStyle = '#5c4033';
  ctx.fillRect(cx - 3 * s, cy - 1 * s, 6 * s, 1.5 * s);
  // Pouch
  ctx.fillRect(cx - 2 * s, cy - 0.5 * s, 1.5 * s, 2 * s);
  ctx.fillRect(cx + 0.5 * s, cy - 0.5 * s, 1.5 * s, 2 * s);

  // Head with peaked cap/brodie helmet
  ctx.fillStyle = '#e8d4b8';
  ctx.beginPath();
  ctx.arc(cx, cy - 9 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  // Helmet (team color)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - 10 * s, 2.5 * s, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8.5 * s, 3 * s, 0.8 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rifle
  ctx.fillStyle = '#5c4033';
  ctx.fillRect(cx + 2.5 * s, cy - 10 * s, 1.2 * s, 14 * s);
  ctx.fillStyle = '#3d3d3d';
  ctx.fillRect(cx + 2.7 * s, cy - 10 * s, 0.8 * s, 10 * s);
  // Bayonet
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.moveTo(cx + 3.1 * s, cy - 10 * s);
  ctx.lineTo(cx + 2.5 * s, cy - 12 * s);
  ctx.lineTo(cx + 3.7 * s, cy - 12 * s);
  ctx.closePath();
  ctx.fill();
}

function drawAssaultInfantry(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, phase: number, moving: boolean): void {
  const legOffset = moving ? Math.sin(phase * 3) * 2 * s : 0;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5 * s, 4 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (team color)
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 1.5 * s, cy);
  ctx.lineTo(cx - 1.5 * s + legOffset * 0.3, cy + 4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 1.5 * s, cy);
  ctx.lineTo(cx + 1.5 * s - legOffset * 0.3, cy + 4 * s);
  ctx.stroke();

  // Combat boots
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(cx - 1.5 * s + legOffset * 0.3, cy + 4 * s, 1.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 1.5 * s - legOffset * 0.3, cy + 4 * s, 1.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // Body (team color uniform)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - 3 * s, cy - 7 * s, 6 * s, 8 * s, 1 * s);
  ctx.fill();
  // Vest (darker team color)
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.roundRect(cx - 2.5 * s, cy - 6 * s, 5 * s, 6 * s, 0.5 * s);
  ctx.fill();
  // Pouches
  ctx.fillStyle = '#2d2d2d';
  ctx.fillRect(cx - 2 * s, cy - 4 * s, 1.2 * s, 2 * s);
  ctx.fillRect(cx - 0.5 * s, cy - 4 * s, 1.2 * s, 2 * s);
  ctx.fillRect(cx + 1 * s, cy - 4 * s, 1.2 * s, 2 * s);

  // Head with modern helmet + NVG mount
  ctx.fillStyle = '#e8d4b8';
  ctx.beginPath();
  ctx.arc(cx, cy - 9 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  // Helmet (team color)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - 10 * s, 2.8 * s, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy - 10 * s, 2.5 * s, Math.PI * 0.8, Math.PI * 0.2);
  ctx.fill();
  // NVG mount
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - 0.8 * s, cy - 12 * s, 1.6 * s, 2 * s);

  // Assault rifle
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx + 2 * s, cy - 6 * s, 1.5 * s, 8 * s);
  // Magazine
  ctx.fillRect(cx + 1.5 * s, cy - 2 * s, 1 * s, 3 * s);
  // Stock
  ctx.fillRect(cx + 2.2 * s, cy + 1 * s, 1 * s, 3 * s);
  // Barrel
  ctx.fillRect(cx + 2.3 * s, cy - 8 * s, 0.9 * s, 3 * s);
  // Suppressor
  ctx.fillStyle = '#2d2d2d';
  ctx.beginPath();
  ctx.roundRect(cx + 2.1 * s, cy - 10 * s, 1.3 * s, 3 * s, 0.3 * s);
  ctx.fill();
}

/**
 * Draw ranged unit with unique appearance per unit type
 */
function drawRangedUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  darkerColor: string,
  scale: number,
  animPhase: number
): void {
  // Dispatch to specific ranged unit drawing function
  switch (unit.type) {
    case 'archer':
      drawArcher(ctx, centerX, centerY, color, darkerColor, scale, animPhase, unit.isMoving);
      break;
    case 'crossbowman':
      drawCrossbowman(ctx, centerX, centerY, color, darkerColor, scale, animPhase, unit.isMoving);
      break;
    default:
      drawGenericRanged(ctx, centerX, centerY, color, darkerColor, scale, animPhase, unit.isMoving);
  }
}

// ============ RANGED UNIT SPRITES ============

function drawGenericRanged(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, phase: number, moving: boolean): void {
  const legOffset = moving ? Math.sin(phase * 3) * 2 * s : 0;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5 * s, 4 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (team color)
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 1.5 * s, cy);
  ctx.lineTo(cx - 1.5 * s + legOffset * 0.3, cy + 4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 1.5 * s, cy);
  ctx.lineTo(cx + 1.5 * s - legOffset * 0.3, cy + 4 * s);
  ctx.stroke();

  // Body (team color)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - 2.5 * s, cy - 7 * s, 5 * s, 8 * s, 1 * s);
  ctx.fill();

  // Head
  ctx.fillStyle = '#e8d4b8';
  ctx.beginPath();
  ctx.arc(cx, cy - 9 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();

  // Bow
  ctx.strokeStyle = '#8b4513';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(cx + 4 * s, cy - 3 * s, 5 * s, -Math.PI * 0.4, Math.PI * 0.4);
  ctx.stroke();
}

function drawArcher(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, phase: number, moving: boolean): void {
  const legOffset = moving ? Math.sin(phase * 3) * 2 * s : 0;
  const drawPhase = Math.sin(phase * 2) * 0.2; // Slight draw animation
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5 * s, 4 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (team color)
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 1.5 * s, cy);
  ctx.lineTo(cx - 1.5 * s + legOffset * 0.3, cy + 4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 1.5 * s, cy);
  ctx.lineTo(cx + 1.5 * s - legOffset * 0.3, cy + 4 * s);
  ctx.stroke();

  // Quiver on back
  ctx.fillStyle = '#5c4033';
  ctx.fillRect(cx - 4 * s, cy - 6 * s, 2 * s, 7 * s);
  // Arrow feathers showing (team color)
  ctx.fillStyle = color;
  ctx.fillRect(cx - 3.8 * s, cy - 7 * s, 0.5 * s, 1.5 * s);
  ctx.fillRect(cx - 3 * s, cy - 7 * s, 0.5 * s, 1.5 * s);
  ctx.fillRect(cx - 2.2 * s, cy - 7 * s, 0.5 * s, 1.5 * s);

  // Body (team color jerkin)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - 2.5 * s, cy - 6 * s, 5 * s, 7 * s, 1 * s);
  ctx.fill();
  // Darker hood/cloak
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(cx - 2 * s, cy - 6 * s);
  ctx.lineTo(cx + 2 * s, cy - 6 * s);
  ctx.lineTo(cx + 1 * s, cy - 3 * s);
  ctx.lineTo(cx - 1 * s, cy - 3 * s);
  ctx.closePath();
  ctx.fill();

  // Head with hood
  ctx.fillStyle = '#e8d4b8';
  ctx.beginPath();
  ctx.arc(cx, cy - 8 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  // Hood over head (team color)
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx, cy - 9 * s, 2.5 * s, Math.PI, 0);
  ctx.fill();

  // Longbow (large curved)
  ctx.strokeStyle = '#8b4513';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(cx + 4 * s, cy - 2 * s, 6 * s, -Math.PI * 0.45, Math.PI * 0.45);
  ctx.stroke();
  // Bowstring
  ctx.strokeStyle = '#d4a574';
  ctx.lineWidth = 0.5 * s;
  const bowR = 6 * s;
  ctx.beginPath();
  ctx.moveTo(cx + 4 * s + Math.cos(-Math.PI * 0.45) * bowR, cy - 2 * s + Math.sin(-Math.PI * 0.45) * bowR);
  ctx.lineTo(cx + 4 * s - drawPhase * 2 * s, cy - 2 * s);
  ctx.lineTo(cx + 4 * s + Math.cos(Math.PI * 0.45) * bowR, cy - 2 * s + Math.sin(Math.PI * 0.45) * bowR);
  ctx.stroke();

  // Arrow being held
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.moveTo(cx + 4 * s - drawPhase * 2 * s, cy - 2 * s);
  ctx.lineTo(cx + 9 * s, cy - 3 * s);
  ctx.stroke();
  // Arrowhead
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.moveTo(cx + 9 * s, cy - 3 * s);
  ctx.lineTo(cx + 10 * s, cy - 2.5 * s);
  ctx.lineTo(cx + 10 * s, cy - 3.5 * s);
  ctx.closePath();
  ctx.fill();
}

function drawCrossbowman(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, phase: number, moving: boolean): void {
  const legOffset = moving ? Math.sin(phase * 3) * 2 * s : 0;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5 * s, 4 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (team color)
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 1.5 * s, cy);
  ctx.lineTo(cx - 1.5 * s + legOffset * 0.3, cy + 4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 1.5 * s, cy);
  ctx.lineTo(cx + 1.5 * s - legOffset * 0.3, cy + 4 * s);
  ctx.stroke();

  // Body (padded gambeson - team color)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - 3 * s, cy - 6 * s, 6 * s, 7 * s, 1 * s);
  ctx.fill();
  // Quilted lines
  ctx.strokeStyle = dark;
  ctx.lineWidth = 0.5 * s;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 3 * s, cy - 5 * s + i * 1.5 * s);
    ctx.lineTo(cx + 3 * s, cy - 5 * s + i * 1.5 * s);
    ctx.stroke();
  }

  // Head with simple cap
  ctx.fillStyle = '#e8d4b8';
  ctx.beginPath();
  ctx.arc(cx, cy - 8 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  // Cap (team color)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - 9 * s, 2.2 * s, Math.PI, 0);
  ctx.fill();

  // Crossbow (horizontal)
  // Stock
  ctx.fillStyle = '#5c4033';
  ctx.fillRect(cx + 1 * s, cy - 4 * s, 7 * s, 2 * s);
  // Bow limbs (metal)
  ctx.strokeStyle = '#808080';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(cx + 7 * s, cy - 6 * s);
  ctx.lineTo(cx + 5 * s, cy - 3 * s);
  ctx.lineTo(cx + 7 * s, cy);
  ctx.stroke();
  // String
  ctx.strokeStyle = '#d4a574';
  ctx.lineWidth = 0.5 * s;
  ctx.beginPath();
  ctx.moveTo(cx + 7 * s, cy - 6 * s);
  ctx.lineTo(cx + 2 * s, cy - 3 * s);
  ctx.lineTo(cx + 7 * s, cy);
  ctx.stroke();
  // Bolt
  ctx.fillStyle = '#3d3d3d';
  ctx.fillRect(cx + 2 * s, cy - 3.5 * s, 5 * s, 1 * s);
  // Bolt head
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.moveTo(cx + 7 * s, cy - 3 * s);
  ctx.lineTo(cx + 8 * s, cy - 2.5 * s);
  ctx.lineTo(cx + 8 * s, cy - 3.5 * s);
  ctx.closePath();
  ctx.fill();

  // Pavise shield on back (team color)
  ctx.fillStyle = color;
  ctx.fillRect(cx - 5 * s, cy - 7 * s, 2.5 * s, 8 * s);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 0.5 * s;
  ctx.strokeRect(cx - 5 * s, cy - 7 * s, 2.5 * s, 8 * s);
}

/**
 * Draw cavalry unit (horse + rider)
 */
function drawCavalryUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  darkerColor: string,
  lighterColor: string,
  scale: number,
  animPhase: number
): void {
  const isTank = unit.type.includes('tank') || unit.type.includes('armored');
  
  if (isTank) {
    // Draw tank/armored vehicle
    const width = 14 * scale;
    const height = 8 * scale;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 2, width * 0.6, height * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Tracks
    ctx.fillStyle = '#2d2d2d';
    ctx.beginPath();
    ctx.roundRect(centerX - width * 0.55, centerY - height * 0.2, width * 1.1, height * 0.4, 2 * scale);
    ctx.fill();
    
    // Track wheels
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(centerX - width * 0.4 + i * width * 0.27, centerY, height * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Hull
    ctx.fillStyle = darkerColor;
    ctx.beginPath();
    ctx.moveTo(centerX - width * 0.5, centerY - height * 0.2);
    ctx.lineTo(centerX - width * 0.35, centerY - height * 0.5);
    ctx.lineTo(centerX + width * 0.35, centerY - height * 0.5);
    ctx.lineTo(centerX + width * 0.5, centerY - height * 0.2);
    ctx.closePath();
    ctx.fill();
    
    // Turret
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - height * 0.55, width * 0.3, height * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Cannon
    ctx.strokeStyle = darkerColor;
    ctx.lineWidth = 2.5 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - height * 0.55);
    ctx.lineTo(centerX + width * 0.6, centerY - height * 0.65);
    ctx.stroke();
    
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(centerX - width * 0.1, centerY - height * 0.65, width * 0.15, height * 0.1, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Draw horse + rider
    const horseLength = 12 * scale;
    const horseHeight = 7 * scale;
    
    // Animate legs
    const legAnim = unit.isMoving ? Math.sin(animPhase * 4) * 2 * scale : 0;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 3, horseLength * 0.5, horseHeight * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Horse legs (back)
    ctx.strokeStyle = '#5c4033';
    ctx.lineWidth = 2 * scale;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(centerX - horseLength * 0.3, centerY - horseHeight * 0.1);
    ctx.lineTo(centerX - horseLength * 0.35 - legAnim * 0.3, centerY + horseHeight * 0.4);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX + horseLength * 0.25, centerY - horseHeight * 0.1);
    ctx.lineTo(centerX + horseLength * 0.2 + legAnim * 0.3, centerY + horseHeight * 0.4);
    ctx.stroke();
    
    // Horse body
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - horseHeight * 0.3, horseLength * 0.45, horseHeight * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Horse legs (front)
    ctx.strokeStyle = '#6b3a1a';
    ctx.beginPath();
    ctx.moveTo(centerX - horseLength * 0.25, centerY - horseHeight * 0.1);
    ctx.lineTo(centerX - horseLength * 0.3 + legAnim * 0.3, centerY + horseHeight * 0.4);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX + horseLength * 0.3, centerY - horseHeight * 0.1);
    ctx.lineTo(centerX + horseLength * 0.35 - legAnim * 0.3, centerY + horseHeight * 0.4);
    ctx.stroke();
    
    // Horse head
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.ellipse(centerX + horseLength * 0.5, centerY - horseHeight * 0.5, horseLength * 0.15, horseHeight * 0.25, 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    // Ears
    ctx.beginPath();
    ctx.moveTo(centerX + horseLength * 0.5, centerY - horseHeight * 0.75);
    ctx.lineTo(centerX + horseLength * 0.45, centerY - horseHeight * 0.9);
    ctx.lineTo(centerX + horseLength * 0.55, centerY - horseHeight * 0.9);
    ctx.closePath();
    ctx.fill();
    
    // Tail
    ctx.strokeStyle = '#3d2817';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(centerX - horseLength * 0.45, centerY - horseHeight * 0.3);
    ctx.quadraticCurveTo(centerX - horseLength * 0.6, centerY - horseHeight * 0.1, 
                         centerX - horseLength * 0.55, centerY + horseHeight * 0.1);
    ctx.stroke();
    
    // Rider body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - horseHeight * 0.7, horseLength * 0.15, horseHeight * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Rider head
    ctx.fillStyle = '#e8beac';
    ctx.beginPath();
    ctx.arc(centerX, centerY - horseHeight * 1.1, horseHeight * 0.18, 0, Math.PI * 2);
    ctx.fill();
    
    // Rider helmet
    ctx.fillStyle = darkerColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY - horseHeight * 1.15, horseHeight * 0.2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();
    
    // Lance/spear
    ctx.strokeStyle = '#5c4033';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(centerX + horseLength * 0.2, centerY - horseHeight * 0.5);
    ctx.lineTo(centerX + horseLength * 0.7, centerY - horseHeight * 1.3);
    ctx.stroke();
    
    // Lance tip
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath();
    ctx.moveTo(centerX + horseLength * 0.7 - 1 * scale, centerY - horseHeight * 1.3);
    ctx.lineTo(centerX + horseLength * 0.7, centerY - horseHeight * 1.5);
    ctx.lineTo(centerX + horseLength * 0.7 + 1 * scale, centerY - horseHeight * 1.3);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Draw siege unit (catapult, cannon, etc.)
 */
function drawSiegeUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  darkerColor: string,
  scale: number,
  animPhase: number
): void {
  const isModern = unit.type.includes('cannon') || unit.type.includes('howitzer');
  const width = 14 * scale;
  const height = 10 * scale;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + 2, width * 0.5, height * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  
  if (isModern) {
    // Cannon/artillery
    // Wheels
    ctx.fillStyle = '#3d3d3d';
    ctx.beginPath();
    ctx.arc(centerX - width * 0.3, centerY, height * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + width * 0.3, centerY, height * 0.25, 0, Math.PI * 2);
    ctx.fill();
    
    // Wheel spokes
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 1 * scale;
    for (let w = -1; w <= 1; w += 2) {
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(centerX + w * width * 0.3, centerY);
        ctx.lineTo(centerX + w * width * 0.3 + Math.cos(angle) * height * 0.2,
                   centerY + Math.sin(angle) * height * 0.2);
        ctx.stroke();
      }
    }
    
    // Carriage
    ctx.fillStyle = darkerColor;
    ctx.beginPath();
    ctx.roundRect(centerX - width * 0.35, centerY - height * 0.35, width * 0.7, height * 0.3, 1 * scale);
    ctx.fill();
    
    // Barrel
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath();
    ctx.roundRect(centerX - width * 0.1, centerY - height * 0.4, width * 0.7, height * 0.2, 2 * scale);
    ctx.fill();
    
    // Barrel highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(centerX - width * 0.05, centerY - height * 0.38, width * 0.5, height * 0.06, 1 * scale);
    ctx.fill();
  } else {
    // Catapult/trebuchet
    // Base/frame
    ctx.fillStyle = '#5c4033';
    ctx.beginPath();
    ctx.roundRect(centerX - width * 0.4, centerY - height * 0.15, width * 0.8, height * 0.25, 1 * scale);
    ctx.fill();
    
    // Wheels
    ctx.fillStyle = '#3d2817';
    ctx.beginPath();
    ctx.arc(centerX - width * 0.35, centerY + height * 0.1, height * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + width * 0.35, centerY + height * 0.1, height * 0.18, 0, Math.PI * 2);
    ctx.fill();
    
    // Throwing arm
    ctx.strokeStyle = '#5c4033';
    ctx.lineWidth = 3 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - height * 0.1);
    ctx.lineTo(centerX + width * 0.5, centerY - height * 0.7);
    ctx.stroke();
    
    // Sling/bucket
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(centerX + width * 0.5, centerY - height * 0.7);
    ctx.quadraticCurveTo(centerX + width * 0.6, centerY - height * 0.5,
                         centerX + width * 0.55, centerY - height * 0.4);
    ctx.stroke();
    
    // Boulder
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.arc(centerX + width * 0.55, centerY - height * 0.35, height * 0.12, 0, Math.PI * 2);
    ctx.fill();
    
    // Support frame
    ctx.strokeStyle = '#4a3728';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(centerX - width * 0.15, centerY - height * 0.1);
    ctx.lineTo(centerX, centerY - height * 0.5);
    ctx.lineTo(centerX + width * 0.15, centerY - height * 0.1);
    ctx.stroke();
  }
}

/**
 * Draw naval unit (ship/boat)
 */
function drawNavalUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  darkerColor: string,
  lighterColor: string,
  scale: number,
  animPhase: number
): void {
  const bob = Math.sin(animPhase * 2) * 1 * scale;
  
  // Draw based on specific ship type
  switch (unit.type) {
    case 'fishing_boat':
      drawFishingBoat(ctx, centerX, centerY, color, darkerColor, scale, bob);
      break;
    case 'galley':
      drawGalley(ctx, centerX, centerY, color, darkerColor, scale, bob, animPhase);
      break;
    case 'trireme':
      drawTrireme(ctx, centerX, centerY, color, darkerColor, scale, bob, animPhase);
      break;
    case 'carrack':
    case 'galleass':
      drawCarrack(ctx, centerX, centerY, color, darkerColor, scale, bob);
      break;
    case 'frigate':
    case 'ship_of_the_line':
      drawFrigate(ctx, centerX, centerY, color, darkerColor, lighterColor, scale, bob);
      break;
    case 'ironclad':
      drawIronclad(ctx, centerX, centerY, color, darkerColor, scale, bob);
      break;
    case 'battleship':
      drawBattleship(ctx, centerX, centerY, color, darkerColor, lighterColor, scale, bob);
      break;
    case 'destroyer':
      drawDestroyer(ctx, centerX, centerY, color, darkerColor, scale, bob);
      break;
    case 'cruiser':
      drawCruiser(ctx, centerX, centerY, color, darkerColor, lighterColor, scale, bob);
      break;
    case 'aircraft_carrier':
      drawAircraftCarrier(ctx, centerX, centerY, color, darkerColor, lighterColor, scale, bob);
      break;
    case 'submarine':
      drawSubmarine(ctx, centerX, centerY, color, darkerColor, scale, bob, animPhase);
      break;
    default:
      // Generic sailboat fallback
      drawGenericSailboat(ctx, centerX, centerY, color, darkerColor, scale, bob);
  }
}

// ============ NAVAL UNIT SPRITES ============

function drawFishingBoat(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, bob: number): void {
  const w = 18 * s, h = 10 * s;
  
  // Shadow on water
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, w * 0.5, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Wake/ripples
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.3, cy + bob + 4, w * 0.4, h * 0.12, 0.2, 0, Math.PI * 2);
  ctx.fill();
  
  // Wooden hull - larger and more detailed
  ctx.fillStyle = '#8b5a2b';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.45, cy + bob);
  ctx.quadraticCurveTo(cx - w * 0.2, cy + bob + h * 0.35, cx + w * 0.1, cy + bob + h * 0.3);
  ctx.quadraticCurveTo(cx + w * 0.4, cy + bob + h * 0.2, cx + w * 0.5, cy + bob);
  ctx.lineTo(cx + w * 0.4, cy + bob - h * 0.25);
  ctx.lineTo(cx - w * 0.4, cy + bob - h * 0.25);
  ctx.closePath();
  ctx.fill();
  
  // Hull outline
  ctx.strokeStyle = '#5c3d1e';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Hull planks
  ctx.strokeStyle = '#6b4423';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.35, cy + bob - h * 0.1);
  ctx.lineTo(cx + w * 0.35, cy + bob - h * 0.05);
  ctx.moveTo(cx - w * 0.3, cy + bob + h * 0.1);
  ctx.lineTo(cx + w * 0.35, cy + bob + h * 0.12);
  ctx.stroke();
  
  // Bow (front) point
  ctx.fillStyle = '#6b4423';
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.45, cy + bob - h * 0.1);
  ctx.lineTo(cx + w * 0.55, cy + bob);
  ctx.lineTo(cx + w * 0.45, cy + bob + h * 0.1);
  ctx.closePath();
  ctx.fill();
  
  // Fishing nets in boat
  ctx.fillStyle = '#a08060';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.15, cy + bob - h * 0.1, w * 0.12, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Net texture
  ctx.strokeStyle = '#8a7050';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    ctx.moveTo(cx - w * 0.15 + i * 1.5, cy + bob - h * 0.18);
    ctx.lineTo(cx - w * 0.15 + i * 1.5, cy + bob - h * 0.02);
  }
  ctx.stroke();
  
  // Fisherman body (team color)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.1, cy + bob - h * 0.35, 3 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Fisherman head
  ctx.fillStyle = '#f5d0c5';
  ctx.beginPath();
  ctx.arc(cx + w * 0.1, cy + bob - h * 0.55, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();
  
  // Hat
  ctx.fillStyle = '#d4a574';
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.1, cy + bob - h * 0.6, 3.5 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c49464';
  ctx.beginPath();
  ctx.arc(cx + w * 0.1, cy + bob - h * 0.65, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  
  // Fishing rod
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.15, cy + bob - h * 0.4);
  ctx.quadraticCurveTo(cx + w * 0.5, cy + bob - h * 0.9, cx + w * 0.6, cy + bob - h * 0.3);
  ctx.stroke();
  
  // Fishing line
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.6, cy + bob - h * 0.3);
  ctx.lineTo(cx + w * 0.55, cy + bob + h * 0.5);
  ctx.stroke();
  
  // Float/bobber
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(cx + w * 0.55, cy + bob + h * 0.5, 1.5 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawGalley(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, bob: number, anim: number): void {
  const w = 18 * s, h = 7 * s;
  // Wake
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + bob + 2, w * 0.5, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // Long narrow hull
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.55, cy + bob);
  ctx.quadraticCurveTo(cx, cy + bob + h * 0.35, cx + w * 0.55, cy + bob);
  ctx.lineTo(cx + w * 0.5, cy + bob - h * 0.25);
  ctx.lineTo(cx - w * 0.5, cy + bob - h * 0.25);
  ctx.closePath();
  ctx.fill();
  // Oars (animated)
  ctx.strokeStyle = '#8b5a2b';
  ctx.lineWidth = 1.5 * s;
  const oarAngle = Math.sin(anim * 3) * 0.3;
  for (let i = -2; i <= 2; i++) {
    const ox = cx + i * w * 0.15;
    ctx.beginPath();
    ctx.moveTo(ox, cy + bob);
    ctx.lineTo(ox + Math.cos(oarAngle) * w * 0.15, cy + bob + h * 0.4);
    ctx.stroke();
  }
  // Ram at front
  ctx.fillStyle = '#4a4a4a';
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.55, cy + bob);
  ctx.lineTo(cx + w * 0.65, cy + bob + h * 0.1);
  ctx.lineTo(cx + w * 0.55, cy + bob + h * 0.15);
  ctx.closePath();
  ctx.fill();
}

function drawTrireme(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, bob: number, anim: number): void {
  const w = 22 * s, h = 8 * s;
  // Wake
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + bob + 3, w * 0.5, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Triple-deck hull
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, cy + bob);
  ctx.quadraticCurveTo(cx, cy + bob + h * 0.4, cx + w * 0.55, cy + bob);
  ctx.lineTo(cx + w * 0.5, cy + bob - h * 0.35);
  ctx.lineTo(cx - w * 0.45, cy + bob - h * 0.35);
  ctx.closePath();
  ctx.fill();
  // Three rows of oars
  ctx.strokeStyle = '#8b5a2b';
  ctx.lineWidth = 1 * s;
  const oarAngle = Math.sin(anim * 4) * 0.25;
  for (let row = 0; row < 3; row++) {
    const rowY = cy + bob - h * 0.1 + row * h * 0.12;
    for (let i = -3; i <= 3; i++) {
      const ox = cx + i * w * 0.1;
      ctx.beginPath();
      ctx.moveTo(ox, rowY);
      ctx.lineTo(ox + Math.cos(oarAngle + row * 0.3) * w * 0.12, rowY + h * 0.35);
      ctx.stroke();
    }
  }
  // Bronze ram
  ctx.fillStyle = '#cd7f32';
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.55, cy + bob);
  ctx.lineTo(cx + w * 0.7, cy + bob + h * 0.05);
  ctx.lineTo(cx + w * 0.55, cy + bob + h * 0.15);
  ctx.closePath();
  ctx.fill();
  // Small mast with banner
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(cx, cy + bob - h * 0.3);
  ctx.lineTo(cx, cy + bob - h * 0.9);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(cx, cy + bob - h * 0.9, w * 0.12, h * 0.2);
}

function drawCarrack(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, bob: number): void {
  const w = 20 * s, h = 10 * s;
  // Wake
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + bob + 3, w * 0.45, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rounded hull
  ctx.fillStyle = '#5c4033';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.4, cy + bob);
  ctx.quadraticCurveTo(cx, cy + bob + h * 0.4, cx + w * 0.45, cy + bob);
  ctx.lineTo(cx + w * 0.4, cy + bob - h * 0.4);
  ctx.lineTo(cx - w * 0.35, cy + bob - h * 0.4);
  ctx.closePath();
  ctx.fill();
  // Forecastle and aftcastle
  ctx.fillStyle = dark;
  ctx.fillRect(cx - w * 0.35, cy + bob - h * 0.6, w * 0.25, h * 0.25);
  ctx.fillRect(cx + w * 0.15, cy + bob - h * 0.55, w * 0.2, h * 0.2);
  // Main mast
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(cx, cy + bob - h * 0.4);
  ctx.lineTo(cx, cy + bob - h * 1.3);
  ctx.stroke();
  // Large square sail
  ctx.fillStyle = '#f5f5dc';
  ctx.fillRect(cx - w * 0.2, cy + bob - h * 1.2, w * 0.4, h * 0.6);
  // Cross on sail
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(cx, cy + bob - h * 1.15);
  ctx.lineTo(cx, cy + bob - h * 0.7);
  ctx.moveTo(cx - w * 0.12, cy + bob - h * 0.95);
  ctx.lineTo(cx + w * 0.12, cy + bob - h * 0.95);
  ctx.stroke();
}

function drawFrigate(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, light: string, s: number, bob: number): void {
  const w = 24 * s, h = 10 * s;
  // Wake
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + bob + 3, w * 0.5, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // Sleek hull
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.45, cy + bob);
  ctx.quadraticCurveTo(cx, cy + bob + h * 0.35, cx + w * 0.5, cy + bob - h * 0.1);
  ctx.lineTo(cx + w * 0.45, cy + bob - h * 0.35);
  ctx.lineTo(cx - w * 0.4, cy + bob - h * 0.35);
  ctx.closePath();
  ctx.fill();
  // Gun ports (two rows)
  ctx.fillStyle = '#1a1a1a';
  for (let row = 0; row < 2; row++) {
    for (let i = -3; i <= 2; i++) {
      ctx.fillRect(cx + i * w * 0.1, cy + bob - h * 0.25 + row * h * 0.12, 2 * s, 2 * s);
    }
  }
  // Three masts
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 2 * s;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * w * 0.18, cy + bob - h * 0.35);
    ctx.lineTo(cx + i * w * 0.18, cy + bob - h * 1.4);
    ctx.stroke();
  }
  // Sails on each mast
  ctx.fillStyle = '#f5f5f4';
  for (let i = -1; i <= 1; i++) {
    const mx = cx + i * w * 0.18;
    ctx.fillRect(mx - w * 0.08, cy + bob - h * 1.3, w * 0.16, h * 0.5);
    ctx.fillRect(mx - w * 0.06, cy + bob - h * 0.75, w * 0.12, h * 0.3);
  }
  // Flag
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + bob - h * 1.4);
  ctx.lineTo(cx + w * 0.1, cy + bob - h * 1.3);
  ctx.lineTo(cx, cy + bob - h * 1.2);
  ctx.fill();
}

function drawIronclad(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, bob: number): void {
  const w = 22 * s, h = 9 * s;
  // Wake with smoke
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.1, cy + bob + 3, w * 0.5, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // Armored hull
  ctx.fillStyle = '#4a4a4a';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.45, cy + bob);
  ctx.lineTo(cx + w * 0.5, cy + bob);
  ctx.lineTo(cx + w * 0.45, cy + bob - h * 0.35);
  ctx.lineTo(cx - w * 0.4, cy + bob - h * 0.35);
  ctx.closePath();
  ctx.fill();
  // Armor plates pattern
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 0.5;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * w * 0.1, cy + bob);
    ctx.lineTo(cx + i * w * 0.1, cy + bob - h * 0.35);
    ctx.stroke();
  }
  // Gun turret
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx, cy + bob - h * 0.45, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // Gun barrel
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(cx + w * 0.08, cy + bob - h * 0.48, w * 0.15, h * 0.08);
  // Smokestack
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - w * 0.15, cy + bob - h * 0.8, w * 0.08, h * 0.35);
  // Smoke
  ctx.fillStyle = 'rgba(80,80,80,0.5)';
  ctx.beginPath();
  ctx.arc(cx - w * 0.11, cy + bob - h * 0.95, w * 0.05, 0, Math.PI * 2);
  ctx.arc(cx - w * 0.08, cy + bob - h * 1.05, w * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

function drawBattleship(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, light: string, s: number, bob: number): void {
  const w = 28 * s, h = 11 * s;
  // Large wake
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.1, cy + bob + 4, w * 0.55, h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Massive armored hull
  ctx.fillStyle = '#4a5568';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.45, cy + bob + h * 0.1);
  ctx.lineTo(cx + w * 0.5, cy + bob - h * 0.05);
  ctx.lineTo(cx + w * 0.48, cy + bob - h * 0.4);
  ctx.lineTo(cx - w * 0.42, cy + bob - h * 0.4);
  ctx.closePath();
  ctx.fill();
  // Superstructure
  ctx.fillStyle = '#5a6577';
  ctx.fillRect(cx - w * 0.15, cy + bob - h * 0.65, w * 0.3, h * 0.3);
  // Bridge tower
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(cx - w * 0.05, cy + bob - h * 0.85, w * 0.1, h * 0.25);
  // Forward turrets (2 big guns)
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx + w * 0.25, cy + bob - h * 0.45, w * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + w * 0.38, cy + bob - h * 0.42, w * 0.07, 0, Math.PI * 2);
  ctx.fill();
  // Big gun barrels
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(cx + w * 0.3, cy + bob - h * 0.5, w * 0.18, h * 0.05);
  ctx.fillRect(cx + w * 0.3, cy + bob - h * 0.42, w * 0.18, h * 0.05);
  ctx.fillRect(cx + w * 0.42, cy + bob - h * 0.46, w * 0.12, h * 0.04);
  // Rear turret
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx - w * 0.28, cy + bob - h * 0.45, w * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(cx - w * 0.35, cy + bob - h * 0.48, w * 0.12, h * 0.04);
  // Smokestacks
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - w * 0.08, cy + bob - h * 0.95, w * 0.06, h * 0.35);
  ctx.fillRect(cx + w * 0.02, cy + bob - h * 0.92, w * 0.05, h * 0.3);
  // Flag
  ctx.fillStyle = color;
  ctx.fillRect(cx - w * 0.04, cy + bob - h * 1.0, w * 0.08, h * 0.12);
}

function drawDestroyer(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, bob: number): void {
  const w = 24 * s, h = 9 * s; // Larger size (was 20x7)
  
  // Fast wake (V-shaped, more prominent)
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.55, cy + bob + 4);
  ctx.lineTo(cx + w * 0.15, cy + bob + 1);
  ctx.lineTo(cx - w * 0.55, cy + bob + 7);
  ctx.closePath();
  ctx.fill();
  
  // Hull shadow/depth
  ctx.fillStyle = '#3a4555';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.42, cy + bob + h * 0.2);
  ctx.lineTo(cx + w * 0.52, cy + bob - h * 0.05);
  ctx.lineTo(cx + w * 0.48, cy + bob - h * 0.35);
  ctx.lineTo(cx - w * 0.38, cy + bob - h * 0.35);
  ctx.closePath();
  ctx.fill();
  
  // Main hull - sleek destroyer shape with player color accent
  ctx.fillStyle = '#5a6270';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.4, cy + bob + h * 0.15);
  ctx.lineTo(cx + w * 0.5, cy + bob - h * 0.1);
  ctx.lineTo(cx + w * 0.46, cy + bob - h * 0.4);
  ctx.lineTo(cx - w * 0.36, cy + bob - h * 0.4);
  ctx.closePath();
  ctx.fill();
  
  // Deck stripe with player color
  ctx.fillStyle = color;
  ctx.fillRect(cx - w * 0.32, cy + bob - h * 0.42, w * 0.64, h * 0.06);
  
  // Superstructure
  ctx.fillStyle = '#6b7585';
  ctx.fillRect(cx - w * 0.12, cy + bob - h * 0.68, w * 0.24, h * 0.3);
  
  // Bridge
  ctx.fillStyle = '#7c8594';
  ctx.fillRect(cx - w * 0.06, cy + bob - h * 0.82, w * 0.12, h * 0.18);
  
  // Forward gun turret
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx + w * 0.28, cy + bob - h * 0.48, w * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(cx + w * 0.32, cy + bob - h * 0.52, w * 0.14, h * 0.07);
  
  // Rear gun turret
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx - w * 0.24, cy + bob - h * 0.48, w * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(cx - w * 0.32, cy + bob - h * 0.51, w * 0.1, h * 0.06);
  
  // Torpedo tubes (visible on deck)
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(cx + w * 0.02, cy + bob - h * 0.52, w * 0.1, h * 0.08);
  
  // Radar mast
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(cx, cy + bob - h * 0.82);
  ctx.lineTo(cx, cy + bob - h * 1.15);
  ctx.stroke();
  
  // Radar dish
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(cx - w * 0.05, cy + bob - h * 1.18, w * 0.1, h * 0.1);
  
  // Smokestack
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(cx + w * 0.08, cy + bob - h * 0.92, w * 0.06, h * 0.28);
  
  // Flag with player color (more prominent)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + bob - h * 1.15);
  ctx.lineTo(cx + w * 0.12, cy + bob - h * 1.02);
  ctx.lineTo(cx, cy + bob - h * 0.9);
  ctx.fill();
}

function drawCruiser(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, light: string, s: number, bob: number): void {
  const w = 24 * s, h = 9 * s;
  // Wake
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.1, cy + bob + 3, w * 0.5, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hull
  ctx.fillStyle = '#5a6577';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.42, cy + bob + h * 0.1);
  ctx.lineTo(cx + w * 0.48, cy + bob - h * 0.05);
  ctx.lineTo(cx + w * 0.45, cy + bob - h * 0.38);
  ctx.lineTo(cx - w * 0.38, cy + bob - h * 0.38);
  ctx.closePath();
  ctx.fill();
  // Superstructure
  ctx.fillStyle = '#6b7585';
  ctx.fillRect(cx - w * 0.12, cy + bob - h * 0.6, w * 0.24, h * 0.25);
  // Bridge
  ctx.fillStyle = '#7c8594';
  ctx.fillRect(cx - w * 0.06, cy + bob - h * 0.78, w * 0.12, h * 0.2);
  // Forward gun turret
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx + w * 0.28, cy + bob - h * 0.42, w * 0.065, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(cx + w * 0.32, cy + bob - h * 0.46, w * 0.14, h * 0.06);
  // Rear gun turret
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx - w * 0.25, cy + bob - h * 0.42, w * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(cx - w * 0.32, cy + bob - h * 0.45, w * 0.1, h * 0.05);
  // Missile launchers
  ctx.fillStyle = '#4a5058';
  ctx.fillRect(cx + w * 0.05, cy + bob - h * 0.52, w * 0.1, h * 0.12);
  // Radar mast
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(cx, cy + bob - h * 0.78);
  ctx.lineTo(cx, cy + bob - h * 1.1);
  ctx.stroke();
  // Flag
  ctx.fillStyle = color;
  ctx.fillRect(cx - w * 0.03, cy + bob - h * 1.15, w * 0.06, h * 0.1);
}

function drawAircraftCarrier(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, light: string, s: number, bob: number): void {
  const w = 32 * s, h = 12 * s;
  // Large wake
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.15, cy + bob + 4, w * 0.55, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // Massive flat deck
  ctx.fillStyle = '#5a6577';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.45, cy + bob + h * 0.05);
  ctx.lineTo(cx + w * 0.48, cy + bob - h * 0.1);
  ctx.lineTo(cx + w * 0.45, cy + bob - h * 0.35);
  ctx.lineTo(cx - w * 0.42, cy + bob - h * 0.35);
  ctx.closePath();
  ctx.fill();
  // Flight deck (flat top)
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(cx - w * 0.42, cy + bob - h * 0.38, w * 0.85, h * 0.05);
  // Runway markings
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1 * s;
  ctx.setLineDash([4 * s, 3 * s]);
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.35, cy + bob - h * 0.36);
  ctx.lineTo(cx + w * 0.4, cy + bob - h * 0.36);
  ctx.stroke();
  ctx.setLineDash([]);
  // Island superstructure (offset to side)
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(cx - w * 0.35, cy + bob - h * 0.7, w * 0.15, h * 0.35);
  // Radar tower
  ctx.fillStyle = '#5a6270';
  ctx.fillRect(cx - w * 0.32, cy + bob - h * 0.9, w * 0.08, h * 0.22);
  // Aircraft on deck (small triangles)
  ctx.fillStyle = '#9ca3af';
  for (let i = 0; i < 3; i++) {
    const ax = cx + w * 0.1 + i * w * 0.12;
    ctx.beginPath();
    ctx.moveTo(ax, cy + bob - h * 0.42);
    ctx.lineTo(ax - w * 0.025, cy + bob - h * 0.38);
    ctx.lineTo(ax + w * 0.025, cy + bob - h * 0.38);
    ctx.closePath();
    ctx.fill();
  }
  // Flag
  ctx.fillStyle = color;
  ctx.fillRect(cx - w * 0.3, cy + bob - h * 0.98, w * 0.06, h * 0.1);
}

function drawSubmarine(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, bob: number, anim: number): void {
  const w = 18 * s, h = 6 * s;
  const submerge = Math.sin(anim) * 1.5 * s;
  // Bubbles
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 3; i++) {
    const bx = cx - w * 0.2 + i * w * 0.15;
    const by = cy + bob - h * 0.2 + Math.sin(anim * 3 + i) * h * 0.3;
    ctx.beginPath();
    ctx.arc(bx, by, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dark hull (cigar shape)
  ctx.fillStyle = '#2d3748';
  ctx.beginPath();
  ctx.ellipse(cx, cy + bob + submerge, w * 0.45, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  // Conning tower
  ctx.fillStyle = '#1a202c';
  ctx.fillRect(cx - w * 0.08, cy + bob + submerge - h * 0.55, w * 0.16, h * 0.4);
  // Periscope
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(cx, cy + bob + submerge - h * 0.55);
  ctx.lineTo(cx, cy + bob - h * 0.9);
  ctx.stroke();
  // Propeller wake (at back)
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.5, cy + bob + submerge, w * 0.08, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // Color stripe
  ctx.fillStyle = color;
  ctx.fillRect(cx - w * 0.35, cy + bob + submerge - h * 0.08, w * 0.7, h * 0.08);
}

function drawGenericSailboat(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, dark: string, s: number, bob: number): void {
  const w = 16 * s, h = 8 * s;
  // Wake
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + bob + 2, w * 0.5, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hull
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.45, cy + bob);
  ctx.quadraticCurveTo(cx, cy + bob + h * 0.35, cx + w * 0.5, cy + bob);
  ctx.lineTo(cx + w * 0.45, cy + bob - h * 0.25);
  ctx.lineTo(cx - w * 0.4, cy + bob - h * 0.25);
  ctx.closePath();
  ctx.fill();
  // Mast
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(cx, cy + bob - h * 0.25);
  ctx.lineTo(cx, cy + bob - h * 1.0);
  ctx.stroke();
  // Sail
  ctx.fillStyle = '#f5f5f4';
  ctx.beginPath();
  ctx.moveTo(cx, cy + bob - h * 0.35);
  ctx.quadraticCurveTo(cx + w * 0.3, cy + bob - h * 0.6, cx, cy + bob - h * 0.9);
  ctx.fill();
  // Flag
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + bob - h * 1.0);
  ctx.lineTo(cx + w * 0.12, cy + bob - h * 0.9);
  ctx.lineTo(cx, cy + bob - h * 0.8);
  ctx.fill();
}

/**
 * Draw air unit (plane/helicopter) - dispatches to specific aircraft type
 */
function drawAirUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  darkerColor: string,
  lighterColor: string,
  scale: number,
  animPhase: number
): void {
  // Circling animation - aircraft circle around their position
  const circleRadius = 20 * scale;  // Larger circles for visible flight pattern
  const circleSpeed = 0.6;  // Slower, more graceful circling
  const circleX = Math.cos(animPhase * circleSpeed) * circleRadius;
  const circleY = Math.sin(animPhase * circleSpeed) * circleRadius * 0.4; // Flattened for isometric
  
  // Calculate heading based on circle direction
  const heading = animPhase * circleSpeed + Math.PI / 2;
  
  // Altitude offset (aircraft fly above ground)
  const altitude = -15 * scale;  // Slightly higher
  
  const drawX = centerX + circleX;
  const drawY = centerY + circleY + altitude;
  
  // Draw shadow on ground (at base position)
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(centerX + circleX, centerY + circleY + 10, 8 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Dispatch to specific aircraft type
  switch (unit.type) {
    case 'biplane':
      drawBiplane(ctx, drawX, drawY, color, darkerColor, scale, heading);
      break;
    case 'bomber_early':
      drawBomberEarly(ctx, drawX, drawY, color, darkerColor, scale, heading);
      break;
    case 'fighter':
      drawFighter(ctx, drawX, drawY, color, darkerColor, lighterColor, scale, heading);
      break;
    case 'bomber':
      drawBomber(ctx, drawX, drawY, color, darkerColor, scale, heading);
      break;
    case 'helicopter':
      drawHelicopter(ctx, drawX, drawY, color, darkerColor, scale, animPhase);
      break;
    case 'stealth_bomber':
      drawStealthBomber(ctx, drawX, drawY, color, darkerColor, scale, heading);
      break;
    default:
      drawGenericAircraft(ctx, drawX, drawY, color, darkerColor, scale, heading);
  }
}

/**
 * Draw WWI-era biplane
 */
function drawBiplane(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  darkerColor: string,
  scale: number,
  heading: number
): void {
  const size = 20 * scale;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  
  // Fuselage (wood/canvas body)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.5, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = darkerColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Upper wing
  ctx.fillStyle = darkerColor;
  ctx.fillRect(-size * 0.15, -size * 0.4, size * 0.3, size * 0.08);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(-size * 0.15, -size * 0.4, size * 0.3, size * 0.08);
  
  // Lower wing
  ctx.fillRect(-size * 0.12, -size * 0.15, size * 0.24, size * 0.06);
  ctx.strokeRect(-size * 0.12, -size * 0.15, size * 0.24, size * 0.06);
  
  // Wing struts
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, -size * 0.15);
  ctx.lineTo(-size * 0.12, -size * 0.4);
  ctx.moveTo(size * 0.1, -size * 0.15);
  ctx.lineTo(size * 0.12, -size * 0.4);
  ctx.stroke();
  
  // Propeller (spinning blur)
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.ellipse(size * 0.5, 0, size * 0.04, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Tail
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.45, 0);
  ctx.lineTo(-size * 0.55, -size * 0.15);
  ctx.lineTo(-size * 0.55, size * 0.15);
  ctx.closePath();
  ctx.fill();
  
  // Vertical stabilizer
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.moveTo(-size * 0.5, 0);
  ctx.lineTo(-size * 0.55, -size * 0.2);
  ctx.lineTo(-size * 0.45, 0);
  ctx.closePath();
  ctx.fill();
  
  // Cockpit
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.ellipse(size * 0.15, -size * 0.08, size * 0.08, size * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw early bomber (WWI/WWII era heavy bomber)
 */
function drawBomberEarly(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  darkerColor: string,
  scale: number,
  heading: number
): void {
  const size = 28 * scale;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  
  // Large fuselage
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.5, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = darkerColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Wings (wide span)
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, 0);
  ctx.lineTo(-size * 0.2, -size * 0.55);
  ctx.lineTo(size * 0.15, -size * 0.55);
  ctx.lineTo(size * 0.1, 0);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, 0);
  ctx.lineTo(-size * 0.2, size * 0.55);
  ctx.lineTo(size * 0.15, size * 0.55);
  ctx.lineTo(size * 0.1, 0);
  ctx.closePath();
  ctx.fill();
  
  // Twin engines on wings
  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.3, size * 0.08, size * 0.05, 0, 0, Math.PI * 2);
  ctx.ellipse(0, size * 0.3, size * 0.08, size * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Propellers
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.ellipse(size * 0.08, -size * 0.3, size * 0.02, size * 0.1, 0, 0, Math.PI * 2);
  ctx.ellipse(size * 0.08, size * 0.3, size * 0.02, size * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Tail section
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.45, 0);
  ctx.lineTo(-size * 0.55, -size * 0.2);
  ctx.lineTo(-size * 0.55, size * 0.2);
  ctx.closePath();
  ctx.fill();
  
  // Vertical stabilizer
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.moveTo(-size * 0.5, 0);
  ctx.lineTo(-size * 0.55, -size * 0.25);
  ctx.lineTo(-size * 0.45, 0);
  ctx.closePath();
  ctx.fill();
  
  // Nose gunner position
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.arc(size * 0.4, 0, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  
  // Bomb bay (darker underside)
  ctx.fillStyle = '#333';
  ctx.fillRect(-size * 0.15, -size * 0.05, size * 0.3, size * 0.1);
  
  ctx.restore();
}

/**
 * Draw modern jet fighter
 */
function drawFighter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  darkerColor: string,
  lighterColor: string,
  scale: number,
  heading: number
): void {
  const size = 24 * scale;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  
  // Sleek fuselage
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size * 0.55, 0);
  ctx.lineTo(size * 0.3, -size * 0.08);
  ctx.lineTo(-size * 0.4, -size * 0.1);
  ctx.lineTo(-size * 0.5, 0);
  ctx.lineTo(-size * 0.4, size * 0.1);
  ctx.lineTo(size * 0.3, size * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = darkerColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Delta wings
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.moveTo(size * 0.1, 0);
  ctx.lineTo(-size * 0.2, -size * 0.45);
  ctx.lineTo(-size * 0.35, -size * 0.45);
  ctx.lineTo(-size * 0.15, 0);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(size * 0.1, 0);
  ctx.lineTo(-size * 0.2, size * 0.45);
  ctx.lineTo(-size * 0.35, size * 0.45);
  ctx.lineTo(-size * 0.15, 0);
  ctx.closePath();
  ctx.fill();
  
  // Tail fins
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.4, 0);
  ctx.lineTo(-size * 0.5, -size * 0.2);
  ctx.lineTo(-size * 0.45, 0);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(-size * 0.4, 0);
  ctx.lineTo(-size * 0.5, size * 0.2);
  ctx.lineTo(-size * 0.45, 0);
  ctx.closePath();
  ctx.fill();
  
  // Cockpit
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.ellipse(size * 0.25, 0, size * 0.12, size * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  
  // Engine exhaust
  ctx.fillStyle = 'rgba(255, 120, 50, 0.7)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.55, 0, size * 0.06, size * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Missiles on wings
  ctx.fillStyle = '#666';
  ctx.fillRect(-size * 0.1, -size * 0.35, size * 0.15, size * 0.03);
  ctx.fillRect(-size * 0.1, size * 0.32, size * 0.15, size * 0.03);
  
  ctx.restore();
}

/**
 * Draw modern heavy bomber
 */
function drawBomber(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  darkerColor: string,
  scale: number,
  heading: number
): void {
  const size = 32 * scale;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  
  // Large fuselage
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.5, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = darkerColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Swept wings (wide)
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.moveTo(size * 0.1, 0);
  ctx.lineTo(-size * 0.1, -size * 0.6);
  ctx.lineTo(-size * 0.3, -size * 0.6);
  ctx.lineTo(-size * 0.2, 0);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(size * 0.1, 0);
  ctx.lineTo(-size * 0.1, size * 0.6);
  ctx.lineTo(-size * 0.3, size * 0.6);
  ctx.lineTo(-size * 0.2, 0);
  ctx.closePath();
  ctx.fill();
  
  // 4 jet engines under wings
  ctx.fillStyle = '#444';
  for (const yOff of [-size * 0.25, -size * 0.45, size * 0.25, size * 0.45]) {
    ctx.beginPath();
    ctx.ellipse(-size * 0.05, yOff, size * 0.06, size * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // T-tail
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.45, 0);
  ctx.lineTo(-size * 0.55, -size * 0.25);
  ctx.lineTo(-size * 0.5, 0);
  ctx.closePath();
  ctx.fill();
  
  // Horizontal stabilizer on top of tail
  ctx.fillStyle = darkerColor;
  ctx.fillRect(-size * 0.55, -size * 0.26, size * 0.08, size * 0.15);
  
  // Nose cone
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.ellipse(size * 0.48, 0, size * 0.06, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Cockpit windows
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.ellipse(size * 0.35, -size * 0.05, size * 0.08, size * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Bomb bay doors
  ctx.fillStyle = '#222';
  ctx.fillRect(-size * 0.2, -size * 0.05, size * 0.35, size * 0.1);
  
  ctx.restore();
}

/**
 * Draw helicopter
 */
function drawHelicopter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  darkerColor: string,
  scale: number,
  animPhase: number
): void {
  const size = 20 * scale;
  
  // Helicopters hover and bob slightly (don't circle as much)
  const bob = Math.sin(animPhase * 4) * 2 * scale;
  
  ctx.save();
  ctx.translate(x, y + bob);
  
  // Main body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.35, size * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = darkerColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Nose
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.ellipse(size * 0.3, size * 0.05, size * 0.12, size * 0.1, 0.3, 0, Math.PI * 2);
  ctx.fill();
  
  // Cockpit glass
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.ellipse(size * 0.2, -size * 0.02, size * 0.12, size * 0.08, 0, Math.PI * 1.2, Math.PI * 1.8);
  ctx.fill();
  
  // Tail boom
  ctx.fillStyle = color;
  ctx.fillRect(-size * 0.55, -size * 0.04, size * 0.35, size * 0.08);
  
  // Tail rotor
  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.ellipse(-size * 0.55, 0, size * 0.03, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Main rotor (spinning blur)
  ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.15, size * 0.5, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Rotor hub
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(0, -size * 0.15, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
  
  // Skids
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-size * 0.2, size * 0.2);
  ctx.lineTo(size * 0.25, size * 0.2);
  ctx.moveTo(-size * 0.2, size * 0.22);
  ctx.lineTo(size * 0.25, size * 0.22);
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Draw stealth bomber (B-2 style flying wing)
 */
function drawStealthBomber(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  darkerColor: string,
  scale: number,
  heading: number
): void {
  const size = 36 * scale;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  
  // Flying wing shape (no distinct fuselage)
  ctx.fillStyle = '#1a1a2e'; // Dark stealth color
  ctx.beginPath();
  ctx.moveTo(size * 0.4, 0);
  ctx.lineTo(size * 0.1, -size * 0.15);
  ctx.lineTo(-size * 0.35, -size * 0.55);
  ctx.lineTo(-size * 0.4, -size * 0.45);
  ctx.lineTo(-size * 0.25, 0);
  ctx.lineTo(-size * 0.4, size * 0.45);
  ctx.lineTo(-size * 0.35, size * 0.55);
  ctx.lineTo(size * 0.1, size * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2a2a4e';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Cockpit (subtle)
  ctx.fillStyle = '#2a3a5e';
  ctx.beginPath();
  ctx.ellipse(size * 0.2, 0, size * 0.1, size * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Engine intakes (top surface)
  ctx.fillStyle = '#0a0a1e';
  ctx.beginPath();
  ctx.ellipse(-size * 0.1, -size * 0.15, size * 0.04, size * 0.02, 0.3, 0, Math.PI * 2);
  ctx.ellipse(-size * 0.1, size * 0.15, size * 0.04, size * 0.02, -0.3, 0, Math.PI * 2);
  ctx.fill();
  
  // Subtle panel lines
  ctx.strokeStyle = '#2a2a3e';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(size * 0.3, 0);
  ctx.lineTo(-size * 0.2, 0);
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Draw generic aircraft (fallback)
 */
function drawGenericAircraft(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  darkerColor: string,
  scale: number,
  heading: number
): void {
  const size = 18 * scale;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  
  // Fuselage
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.45, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Wings
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, 0);
  ctx.lineTo(-size * 0.15, -size * 0.4);
  ctx.lineTo(size * 0.15, -size * 0.4);
  ctx.lineTo(size * 0.1, 0);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, 0);
  ctx.lineTo(-size * 0.15, size * 0.4);
  ctx.lineTo(size * 0.15, size * 0.4);
  ctx.lineTo(size * 0.1, 0);
  ctx.closePath();
  ctx.fill();
  
  // Tail
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.4, 0);
  ctx.lineTo(-size * 0.5, -size * 0.2);
  ctx.lineTo(-size * 0.35, 0);
  ctx.closePath();
  ctx.fill();
  
  // Cockpit
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.ellipse(size * 0.2, -size * 0.05, size * 0.1, size * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw a RoN unit with pedestrian-like appearance and task activities
 */
export function drawRoNUnit(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  offsetX: number,
  offsetY: number,
  zoom: number,
  playerColor: string,
  tick: number
): void {
  const { screenX, screenY } = gridToScreen(unit.x, unit.y, offsetX, offsetY);
  
  // Unit center position (adjusted for tile)
  // Note: Canvas context is already scaled, so we don't multiply by zoom here
  const centerX = screenX + TILE_WIDTH / 2;
  const centerY = screenY + TILE_HEIGHT * 0.3;
  
  const stats = UNIT_STATS[unit.type];
  
  // Draw unit based on type
  if (stats.category === 'civilian') {
    drawCitizenUnit(ctx, centerX, centerY, unit, zoom, tick, playerColor);
  } else {
    drawMilitaryUnit(ctx, centerX, centerY, unit, playerColor, zoom, tick);
  }
  
  // Attack animation effect
  if (unit.isAttacking) {
    const attackAnimPhase = (tick * 0.3) % (Math.PI * 2);
    
    if (stats.category === 'ranged' || stats.category === 'siege') {
      // Ranged/siege units: draw projectile/muzzle flash
      ctx.save();
      
      // Muzzle flash
      const flashSize = 4 + Math.sin(attackAnimPhase) * 2;
      const flashGradient = ctx.createRadialGradient(
        centerX + 3, centerY - 3, 0,
        centerX + 3, centerY - 3, flashSize
      );
      flashGradient.addColorStop(0, 'rgba(255, 255, 200, 0.9)');
      flashGradient.addColorStop(0.3, 'rgba(255, 200, 50, 0.7)');
      flashGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.fillStyle = flashGradient;
      ctx.beginPath();
      ctx.arc(centerX + 3, centerY - 3, flashSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Projectile trail (for siege)
      if (stats.category === 'siege' && unit.taskTarget && typeof unit.taskTarget === 'object') {
        const target = unit.taskTarget as { x: number; y: number };
        const dx = target.x - unit.x;
        const dy = target.y - unit.y;
        const angle = Math.atan2(dy, dx);
        const trailLength = 8;
        
        ctx.strokeStyle = 'rgba(255, 150, 50, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 4);
        ctx.lineTo(
          centerX + Math.cos(angle) * trailLength,
          centerY - 4 + Math.sin(angle) * trailLength * 0.5
        );
        ctx.stroke();
      }
      
      ctx.restore();
    } else {
      // Melee units: draw attack spark/slash
      ctx.save();
      
      const sparkAngle = attackAnimPhase * 2;
      const sparkRadius = 5;
      
      // Slash effect
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(centerX + 2, centerY - 2, sparkRadius, sparkAngle - 0.5, sparkAngle + 0.5);
      ctx.stroke();
      
      // Impact sparks
      ctx.fillStyle = 'rgba(255, 220, 100, 0.7)';
      for (let i = 0; i < 3; i++) {
        const particleAngle = sparkAngle + i * 0.4;
        const px = centerX + 2 + Math.cos(particleAngle) * (sparkRadius + 2);
        const py = centerY - 2 + Math.sin(particleAngle) * (sparkRadius + 2) * 0.5;
        ctx.beginPath();
        ctx.arc(px, py, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    }
  }
  
  // Selection ring
  if (unit.isSelected) {
    const ringRadius = 5;
    
    // White ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Green glow
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius + 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Health bar - always visible for military units, only when damaged for civilians
  const healthPercent = unit.health / unit.maxHealth;
  const isMilitary = stats?.category !== 'civilian';
  const showHealthBar = isMilitary || healthPercent < 1;
  
  if (showHealthBar) {
    const barWidth = 14;
    const barHeight = 3;
    const barX = centerX - barWidth / 2;
    const barY = centerY - 14;
    
    // Background (dark)
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
    
    // Health fill - green/yellow/red based on health
    ctx.fillStyle = healthPercent > 0.6 ? '#22c55e' : healthPercent > 0.3 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    
    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
  }
}

/**
 * Get the screen position of a unit for hit testing
 */
export function getUnitScreenPosition(
  unit: Unit,
  offsetX: number,
  offsetY: number,
  zoom: number
): { centerX: number; centerY: number; radius: number } {
  const { screenX, screenY } = gridToScreen(unit.x, unit.y, offsetX, offsetY);
  
  return {
    centerX: (screenX + TILE_WIDTH / 2) * zoom,
    centerY: (screenY + TILE_HEIGHT * 0.3) * zoom,
    radius: 10 * zoom,
  };
}
