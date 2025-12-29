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
 * Get deterministic values based on unit ID for consistent appearance
 */
function getUnitAppearance(unitId: string): {
  skinTone: string;
  clothingColor: string;
  hairColor: string;
  hasTool: boolean;
} {
  // Simple hash from unit ID
  let hash = 0;
  for (let i = 0; i < unitId.length; i++) {
    hash = ((hash << 5) - hash) + unitId.charCodeAt(i);
    hash = hash & hash;
  }
  const absHash = Math.abs(hash);
  
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
  tick: number
): void {
  const appearance = getUnitAppearance(unit.id);
  // Canvas is already scaled by zoom, so just use a fixed scale
  const scale = 0.5;
  
  // Animation based on task and movement
  const isWorking = unit.task && unit.task.startsWith('gather_') && !unit.isMoving;
  const animPhase = (tick * 0.1 + parseInt(unit.id.slice(-4), 16)) % (Math.PI * 2);
  
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
  ctx.strokeStyle = appearance.clothingColor;
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
  ctx.fillStyle = appearance.clothingColor;
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
 * Draw a military unit (simplified compared to civilian)
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
  // Canvas is already scaled by zoom, so just use a fixed scale
  const scale = 0.5;
  const animPhase = (tick * 0.1 + parseInt(unit.id.slice(-4), 16)) % (Math.PI * 2);
  
  // Different rendering based on category
  if (stats.category === 'cavalry' || stats.category === 'siege') {
    // Draw as a small vehicle/mount shape
    const width = 12 * scale;
    const height = 8 * scale;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(centerX - width * 0.15, centerY - height * 0.6, width * 0.2, height * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Infantry/ranged - draw as pedestrian soldier
    const bodyHeight = 10 * scale;
    const bodyWidth = 5 * scale;
    const headRadius = 3 * scale;
    const legLength = 4 * scale;
    
    let legOffset = 0;
    if (unit.isMoving) {
      legOffset = Math.sin(animPhase * 3) * 2 * scale;
    }
    
    // Draw legs
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2 * scale;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(centerX - bodyWidth * 0.3, centerY);
    ctx.lineTo(centerX - bodyWidth * 0.3 + legOffset * 0.5, centerY + legLength);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX + bodyWidth * 0.3, centerY);
    ctx.lineTo(centerX + bodyWidth * 0.3 - legOffset * 0.5, centerY + legLength);
    ctx.stroke();
    
    // Draw body (uniform color)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - bodyHeight * 0.4, bodyWidth * 0.6, bodyHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw head with helmet
    ctx.fillStyle = '#f5d0c5';
    ctx.beginPath();
    ctx.arc(centerX, centerY - bodyHeight - headRadius, headRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Helmet
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY - bodyHeight - headRadius - headRadius * 0.3, headRadius * 0.95, Math.PI, 0);
    ctx.fill();
    
    // Weapon (for ranged/infantry)
    if (stats.category === 'ranged' || stats.category === 'infantry') {
      ctx.strokeStyle = '#5c4033';
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.moveTo(centerX + bodyWidth * 0.5, centerY - bodyHeight * 0.3);
      ctx.lineTo(centerX + bodyWidth * 1.5, centerY - bodyHeight * 0.8);
      ctx.stroke();
    }
  }
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
    drawCitizenUnit(ctx, centerX, centerY, unit, zoom, tick);
  } else {
    drawMilitaryUnit(ctx, centerX, centerY, unit, playerColor, zoom, tick);
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
  
  // Health bar if damaged
  const healthPercent = unit.health / unit.maxHealth;
  if (healthPercent < 1) {
    const barWidth = 10;
    const barHeight = 2;
    const barX = centerX - barWidth / 2;
    const barY = centerY - 12;
    
    // Background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Health fill
    ctx.fillStyle = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    
    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
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
