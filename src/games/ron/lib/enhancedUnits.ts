/**
 * Enhanced Unit Rendering System
 * 
 * Provides improved visual fidelity for all unit types:
 * - Better shading and highlights
 * - Detailed equipment and armor
 * - Smooth animations
 * - Visual effects (dust trails, water wakes)
 * - Age-appropriate styling
 */

import { createNoise2D } from 'simplex-noise';

const unitNoise = createNoise2D();

// ============================================================================
// SHARED UTILITIES
// ============================================================================

/**
 * Draw a selection ring with glow effect
 */
export function drawEnhancedSelectionRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  time: number
): void {
  const pulseScale = 1 + Math.sin(time * 4) * 0.1;
  const actualRadius = radius * pulseScale;
  
  ctx.save();
  
  // Outer glow
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, actualRadius + 2, actualRadius * 0.4 + 1, 0, 0, Math.PI * 2);
  ctx.stroke();
  
  // Main ring
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, actualRadius, actualRadius * 0.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  
  // Inner highlight
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, actualRadius - 1, actualRadius * 0.4 - 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Draw an enhanced health bar
 */
export function drawEnhancedHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  healthPercent: number,
  showBackground: boolean = true
): void {
  const barX = x - width / 2;
  const barY = y - height / 2;
  
  ctx.save();
  
  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(barX + 1, barY + 1, width, height);
  
  // Background
  if (showBackground) {
    ctx.fillStyle = 'rgba(40, 40, 40, 0.8)';
    ctx.fillRect(barX, barY, width, height);
    
    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, width, height);
  }
  
  // Health color gradient based on percentage
  const healthWidth = width * healthPercent;
  let gradient: CanvasGradient;
  
  if (healthPercent > 0.6) {
    gradient = ctx.createLinearGradient(barX, barY, barX, barY + height);
    gradient.addColorStop(0, '#4ade80');
    gradient.addColorStop(0.5, '#22c55e');
    gradient.addColorStop(1, '#16a34a');
  } else if (healthPercent > 0.3) {
    gradient = ctx.createLinearGradient(barX, barY, barX, barY + height);
    gradient.addColorStop(0, '#fbbf24');
    gradient.addColorStop(0.5, '#f59e0b');
    gradient.addColorStop(1, '#d97706');
  } else {
    gradient = ctx.createLinearGradient(barX, barY, barX, barY + height);
    gradient.addColorStop(0, '#f87171');
    gradient.addColorStop(0.5, '#ef4444');
    gradient.addColorStop(1, '#dc2626');
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(barX + 1, barY + 1, healthWidth - 2, height - 2);
  
  // Highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(barX + 1, barY + 1, healthWidth - 2, (height - 2) / 3);
  
  ctx.restore();
}

/**
 * Draw a unit shadow
 */
export function drawEnhancedUnitShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  offsetX: number = 2,
  offsetY: number = 2
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(x + offsetX, y + offsetY + height * 0.3, width * 0.6, height * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ============================================================================
// INFANTRY RENDERING
// ============================================================================

interface InfantryRenderConfig {
  age: 'classical' | 'medieval' | 'enlightenment' | 'industrial' | 'modern';
  type: 'militia' | 'infantry' | 'heavy' | 'ranged' | 'special';
  playerColor: string;
  animation: 'idle' | 'walk' | 'attack' | 'death';
  frame: number;
  facing: number; // 0-7 direction
}

/**
 * Draw enhanced infantry unit
 */
export function drawEnhancedInfantry(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  config: InfantryRenderConfig,
  time: number
): void {
  const { age, type, playerColor, animation, frame } = config;
  
  // Animation offsets
  const walkBob = animation === 'walk' ? Math.sin(frame * 0.5) * 1 : 0;
  const attackSwing = animation === 'attack' ? Math.sin(frame * 0.8) * 0.3 : 0;
  
  ctx.save();
  ctx.translate(x, y + walkBob);
  
  // Scale based on type
  const scale = type === 'heavy' ? 1.15 : type === 'ranged' ? 0.95 : 1;
  ctx.scale(scale, scale);
  
  // Shadow
  drawEnhancedUnitShadow(ctx, 0, 5, 12, 8);
  
  // LEGS
  const legSpread = animation === 'walk' ? Math.sin(frame * 0.5) * 3 : 0;
  
  ctx.fillStyle = getAgeUniformColor(age, 'pants');
  // Left leg
  ctx.beginPath();
  ctx.moveTo(-3 - legSpread, 4);
  ctx.lineTo(-4 - legSpread * 0.5, 10);
  ctx.lineTo(-2 - legSpread * 0.5, 10);
  ctx.lineTo(-2, 4);
  ctx.fill();
  // Right leg
  ctx.beginPath();
  ctx.moveTo(3 + legSpread, 4);
  ctx.lineTo(4 + legSpread * 0.5, 10);
  ctx.lineTo(2 + legSpread * 0.5, 10);
  ctx.lineTo(2, 4);
  ctx.fill();
  
  // Boots
  ctx.fillStyle = '#3d2817';
  ctx.fillRect(-5 - legSpread * 0.5, 9, 3, 2);
  ctx.fillRect(2 + legSpread * 0.5, 9, 3, 2);
  
  // BODY / TORSO
  const bodyColor = getAgeUniformColor(age, 'uniform');
  ctx.fillStyle = bodyColor;
  
  // Main torso
  ctx.beginPath();
  ctx.moveTo(-5, -2);
  ctx.lineTo(-5, 5);
  ctx.lineTo(5, 5);
  ctx.lineTo(5, -2);
  ctx.quadraticCurveTo(5, -5, 0, -5);
  ctx.quadraticCurveTo(-5, -5, -5, -2);
  ctx.fill();
  
  // Uniform highlight
  ctx.fillStyle = adjustColor(bodyColor, 30);
  ctx.fillRect(-4, -4, 3, 4);
  
  // Player color accent
  ctx.fillStyle = playerColor;
  if (age === 'classical' || age === 'medieval') {
    // Shield or tabard
    ctx.fillRect(-3, -1, 6, 4);
  } else {
    // Sash or insignia
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.lineTo(4, 1);
    ctx.lineTo(4, 2);
    ctx.lineTo(-4, -2);
    ctx.fill();
  }
  
  // ARMS
  const armSwing = animation === 'walk' ? Math.sin(frame * 0.5) * 0.2 : 0;
  
  ctx.save();
  ctx.translate(-5, 0);
  ctx.rotate(-0.2 + armSwing);
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-2, -1, 3, 7);
  
  // Hand
  ctx.fillStyle = '#e0c8a0';
  ctx.beginPath();
  ctx.arc(0, 6, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  
  // Right arm with weapon
  ctx.save();
  ctx.translate(5, 0);
  ctx.rotate(0.2 - armSwing + attackSwing);
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-1, -1, 3, 7);
  
  // Hand
  ctx.fillStyle = '#e0c8a0';
  ctx.beginPath();
  ctx.arc(0, 6, 1.5, 0, Math.PI * 2);
  ctx.fill();
  
  // Weapon
  drawAgeWeapon(ctx, age, type, 0, 6, time);
  ctx.restore();
  
  // HEAD
  // Neck
  ctx.fillStyle = '#e0c8a0';
  ctx.fillRect(-1.5, -6, 3, 2);
  
  // Head base
  ctx.beginPath();
  ctx.arc(0, -9, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Helmet/Hair based on age
  drawAgeHeadgear(ctx, age, type, playerColor);
  
  // Face
  ctx.fillStyle = '#c0a080';
  ctx.beginPath();
  ctx.arc(-1, -9, 0.5, 0, Math.PI * 2); // Left eye
  ctx.arc(1, -9, 0.5, 0, Math.PI * 2);  // Right eye
  ctx.fill();
  
  ctx.restore();
}

/**
 * Get uniform colors based on age
 */
function getAgeUniformColor(age: InfantryRenderConfig['age'], part: 'uniform' | 'pants'): string {
  const colors: Record<typeof age, { uniform: string; pants: string }> = {
    classical: { uniform: '#8b4513', pants: '#654321' },
    medieval: { uniform: '#4a4a4a', pants: '#3a3a3a' },
    enlightenment: { uniform: '#4169e1', pants: '#f5f5dc' },
    industrial: { uniform: '#556b2f', pants: '#4a4a4a' },
    modern: { uniform: '#4b5320', pants: '#3d4125' },
  };
  return colors[age][part];
}

/**
 * Draw age-appropriate headgear
 */
function drawAgeHeadgear(
  ctx: CanvasRenderingContext2D,
  age: InfantryRenderConfig['age'],
  type: InfantryRenderConfig['type'],
  playerColor: string
): void {
  switch (age) {
    case 'classical':
      // Helmet with crest
      ctx.fillStyle = '#b87333';
      ctx.beginPath();
      ctx.arc(0, -10, 4.5, Math.PI, Math.PI * 2);
      ctx.fill();
      // Crest
      ctx.fillStyle = '#8b0000';
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(-3, -10);
      ctx.lineTo(3, -10);
      ctx.fill();
      break;
      
    case 'medieval':
      if (type === 'heavy') {
        // Full helmet
        ctx.fillStyle = '#808080';
        ctx.beginPath();
        ctx.arc(0, -9, 4.5, 0, Math.PI * 2);
        ctx.fill();
        // Visor slits
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-3, -9, 6, 1);
      } else {
        // Chain mail hood
        ctx.fillStyle = '#6a6a6a';
        ctx.beginPath();
        ctx.arc(0, -9, 4.2, Math.PI * 0.8, Math.PI * 2.2);
        ctx.fill();
      }
      break;
      
    case 'enlightenment':
      // Tricorn hat
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.moveTo(-6, -10);
      ctx.lineTo(0, -16);
      ctx.lineTo(6, -10);
      ctx.lineTo(4, -9);
      ctx.lineTo(0, -11);
      ctx.lineTo(-4, -9);
      ctx.closePath();
      ctx.fill();
      break;
      
    case 'industrial':
      // Kepi or peaked cap
      ctx.fillStyle = '#2f4f4f';
      ctx.beginPath();
      ctx.arc(0, -11, 4, Math.PI, Math.PI * 2);
      ctx.fill();
      // Brim
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-4, -11, 8, 2);
      break;
      
    case 'modern':
      // Modern helmet
      ctx.fillStyle = '#4b5320';
      ctx.beginPath();
      ctx.arc(0, -10, 4.5, Math.PI * 0.8, Math.PI * 2.2);
      ctx.fill();
      // Strap
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-4, -8);
      ctx.lineTo(-4, -6);
      ctx.stroke();
      break;
  }
}

/**
 * Draw age-appropriate weapon
 */
function drawAgeWeapon(
  ctx: CanvasRenderingContext2D,
  age: InfantryRenderConfig['age'],
  type: InfantryRenderConfig['type'],
  x: number,
  y: number,
  time: number
): void {
  ctx.save();
  ctx.translate(x, y);
  
  switch (age) {
    case 'classical':
      if (type === 'ranged') {
        // Bow
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -5, 8, -0.5, 0.5);
        ctx.stroke();
        // String
        ctx.strokeStyle = '#d2b48c';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -13);
        ctx.lineTo(0, 3);
        ctx.stroke();
      } else {
        // Gladius/sword
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(-1, -12, 2, 10);
        // Handle
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(-1.5, -2, 3, 4);
      }
      break;
      
    case 'medieval':
      if (type === 'ranged') {
        // Crossbow
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(-1, -6, 2, 8);
        ctx.fillRect(-5, -4, 10, 2);
      } else if (type === 'heavy') {
        // Polearm
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(-0.5, -20, 1, 22);
        ctx.fillStyle = '#c0c0c0';
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(-2, -18);
        ctx.lineTo(2, -18);
        ctx.closePath();
        ctx.fill();
      } else {
        // Longsword
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(-1, -14, 2, 12);
        // Crossguard
        ctx.fillStyle = '#b87333';
        ctx.fillRect(-3, -2, 6, 1);
        ctx.fillRect(-1, -1, 2, 3);
      }
      break;
      
    case 'enlightenment':
    case 'industrial':
      if (type === 'ranged' || type === 'infantry') {
        // Musket/rifle
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(-0.5, -18, 1, 12);
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(-0.5, -20, 1, 4);
        // Bayonet
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(-0.3, -23, 0.6, 3);
      } else {
        // Saber
        ctx.strokeStyle = '#c0c0c0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(2, -8, 0, -15);
        ctx.stroke();
        ctx.fillStyle = '#b87333';
        ctx.fillRect(-1.5, 0, 3, 3);
      }
      break;
      
    case 'modern':
      // Assault rifle
      ctx.fillStyle = '#2d2d2d';
      ctx.fillRect(-1, -12, 2, 10);
      // Magazine
      ctx.fillRect(-2, -5, 3, 4);
      // Barrel
      ctx.fillRect(-0.5, -16, 1, 5);
      // Stock
      ctx.fillRect(-2, 0, 4, 3);
      break;
  }
  
  ctx.restore();
}

// ============================================================================
// CAVALRY RENDERING
// ============================================================================

/**
 * Draw enhanced cavalry unit
 */
export function drawEnhancedCavalry(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  age: InfantryRenderConfig['age'],
  playerColor: string,
  animation: 'idle' | 'walk' | 'attack',
  frame: number,
  time: number
): void {
  const gallop = animation === 'walk' ? Math.sin(frame * 0.3) : 0;
  const bodyBob = gallop * 2;
  
  ctx.save();
  ctx.translate(x, y + bodyBob);
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 15, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // HORSE
  // Legs
  const legPhase = frame * 0.3;
  ctx.fillStyle = '#5c4033';
  
  for (let i = 0; i < 4; i++) {
    const legX = (i < 2 ? -8 : 8) + (i % 2 === 0 ? -2 : 2);
    const legOffset = Math.sin(legPhase + i * Math.PI * 0.5) * 3;
    ctx.fillRect(legX - 1, 5, 2, 8 + legOffset);
    // Hoof
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(legX - 1.5, 12 + legOffset, 3, 2);
    ctx.fillStyle = '#5c4033';
  }
  
  // Body
  const bodyGradient = ctx.createLinearGradient(-12, -2, 12, 5);
  bodyGradient.addColorStop(0, '#6b4423');
  bodyGradient.addColorStop(0.5, '#5c4033');
  bodyGradient.addColorStop(1, '#4a3020');
  ctx.fillStyle = bodyGradient;
  
  ctx.beginPath();
  ctx.ellipse(0, 3, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Saddle
  ctx.fillStyle = playerColor;
  ctx.beginPath();
  ctx.ellipse(-2, 0, 6, 4, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  
  // Neck
  ctx.fillStyle = '#5c4033';
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.quadraticCurveTo(16, -8, 14, -14);
  ctx.lineTo(11, -12);
  ctx.quadraticCurveTo(12, -6, 8, 0);
  ctx.fill();
  
  // Head
  ctx.beginPath();
  ctx.ellipse(15, -16, 4, 3, 0.3, 0, Math.PI * 2);
  ctx.fill();
  
  // Mane
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.moveTo(12, -12);
  for (let i = 0; i < 5; i++) {
    ctx.lineTo(12 - i * 2, -14 + Math.sin(time * 2 + i) * 2);
    ctx.lineTo(11 - i * 2, -10);
  }
  ctx.fill();
  
  // Tail
  ctx.beginPath();
  ctx.moveTo(-13, 2);
  const tailSwing = Math.sin(time * 2) * 3;
  ctx.quadraticCurveTo(-18 + tailSwing, 6, -16 + tailSwing, 12);
  ctx.quadraticCurveTo(-18 + tailSwing, 6, -12, 3);
  ctx.fill();
  
  // RIDER
  ctx.translate(-2, -8);
  
  // Rider body
  ctx.fillStyle = getAgeUniformColor(age, 'uniform');
  ctx.fillRect(-4, -6, 8, 10);
  
  // Player color cape
  ctx.fillStyle = playerColor;
  ctx.beginPath();
  ctx.moveTo(-4, -4);
  ctx.quadraticCurveTo(-8 - gallop * 2, 2, -6, 8);
  ctx.lineTo(-4, 6);
  ctx.fill();
  
  // Arms
  ctx.fillStyle = getAgeUniformColor(age, 'uniform');
  ctx.fillRect(-6, -4, 3, 6);
  ctx.fillRect(3, -4, 3, 6);
  
  // Weapon
  ctx.save();
  ctx.translate(5, 0);
  if (age === 'classical' || age === 'medieval') {
    // Lance
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(-0.5, -20, 1, 25);
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(-1.5, -18);
    ctx.lineTo(1.5, -18);
    ctx.closePath();
    ctx.fill();
  } else if (age === 'enlightenment' || age === 'industrial') {
    // Saber
    ctx.strokeStyle = '#c0c0c0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(4, -10, 2, -16);
    ctx.stroke();
  } else {
    // Modern carbine
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(-1, -10, 2, 8);
  }
  ctx.restore();
  
  // Head
  ctx.fillStyle = '#e0c8a0';
  ctx.beginPath();
  ctx.arc(0, -10, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Helmet
  drawAgeHeadgear(ctx, age, 'heavy', playerColor);
  
  ctx.restore();
}

// ============================================================================
// NAVAL UNIT RENDERING
// ============================================================================

/**
 * Draw enhanced ship
 */
export function drawEnhancedShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  shipType: 'galley' | 'caravel' | 'frigate' | 'ironclad' | 'battleship' | 'carrier',
  playerColor: string,
  facing: number, // 0-7
  time: number,
  isMoving: boolean
): void {
  const bob = Math.sin(time * 2) * 2;
  const tilt = Math.sin(time * 1.5) * 0.02;
  
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(tilt);
  
  // Ship scale by type
  const scales: Record<typeof shipType, number> = {
    galley: 0.8,
    caravel: 1.0,
    frigate: 1.2,
    ironclad: 1.4,
    battleship: 1.8,
    carrier: 2.2,
  };
  const scale = scales[shipType];
  ctx.scale(scale, scale);
  
  // Wake effect when moving
  if (isMoving) {
    drawShipWake(ctx, shipType, time);
  }
  
  // Shadow/reflection on water
  ctx.fillStyle = 'rgba(0, 30, 60, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 20, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  switch (shipType) {
    case 'galley':
      drawGalley(ctx, playerColor, time);
      break;
    case 'caravel':
      drawCaravel(ctx, playerColor, time);
      break;
    case 'frigate':
      drawFrigate(ctx, playerColor, time);
      break;
    case 'ironclad':
      drawIronclad(ctx, playerColor, time);
      break;
    case 'battleship':
      drawBattleship(ctx, playerColor, time);
      break;
    case 'carrier':
      drawCarrier(ctx, playerColor, time);
      break;
  }
  
  ctx.restore();
}

function drawShipWake(ctx: CanvasRenderingContext2D, shipType: string, time: number): void {
  const wakeLength = shipType === 'carrier' ? 60 : shipType === 'battleship' ? 50 : 30;
  
  ctx.save();
  ctx.translate(0, 10);
  
  // V-shaped wake
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  
  for (let i = 0; i < 3; i++) {
    const offset = i * 5;
    const alpha = 0.4 - i * 0.1;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    
    ctx.beginPath();
    ctx.moveTo(-5, 5 + offset);
    ctx.quadraticCurveTo(-15 - i * 3, 10 + offset, -wakeLength + offset * 2, 5 + offset + Math.sin(time * 3 + i) * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(5, 5 + offset);
    ctx.quadraticCurveTo(15 + i * 3, 10 + offset, wakeLength - offset * 2, 5 + offset + Math.sin(time * 3 + i + 1) * 2);
    ctx.stroke();
  }
  
  // Foam at stern
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  for (let i = 0; i < 5; i++) {
    const fx = (Math.random() - 0.5) * 10;
    const fy = 5 + Math.random() * 5;
    ctx.beginPath();
    ctx.arc(fx, fy, 1 + Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

function drawGalley(ctx: CanvasRenderingContext2D, playerColor: string, time: number): void {
  // Hull
  ctx.fillStyle = '#8b4513';
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.quadraticCurveTo(-22, 5, -15, 8);
  ctx.lineTo(15, 8);
  ctx.quadraticCurveTo(22, 5, 25, -2);
  ctx.lineTo(20, -3);
  ctx.lineTo(-18, -3);
  ctx.closePath();
  ctx.fill();
  
  // Deck
  ctx.fillStyle = '#a0522d';
  ctx.fillRect(-15, -3, 30, 3);
  
  // Ram
  ctx.fillStyle = '#b87333';
  ctx.beginPath();
  ctx.moveTo(25, -2);
  ctx.lineTo(30, 0);
  ctx.lineTo(25, 2);
  ctx.closePath();
  ctx.fill();
  
  // Oars
  const oarPhase = time * 4;
  for (let i = 0; i < 5; i++) {
    const ox = -10 + i * 5;
    const oarAngle = Math.sin(oarPhase + i * 0.5) * 0.3;
    
    ctx.save();
    ctx.translate(ox, 5);
    ctx.rotate(oarAngle);
    ctx.fillStyle = '#deb887';
    ctx.fillRect(-0.5, 0, 1, 12);
    ctx.restore();
  }
  
  // Mast and sail
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(-1, -25, 2, 22);
  
  const sailBillow = Math.sin(time) * 2;
  ctx.fillStyle = playerColor;
  ctx.beginPath();
  ctx.moveTo(-12, -22);
  ctx.quadraticCurveTo(-12 + sailBillow, -12, -12, -5);
  ctx.lineTo(12, -5);
  ctx.quadraticCurveTo(12 + sailBillow, -12, 12, -22);
  ctx.closePath();
  ctx.fill();
}

function drawCaravel(ctx: CanvasRenderingContext2D, playerColor: string, time: number): void {
  // Hull
  const hullGradient = ctx.createLinearGradient(-20, 0, -20, 10);
  hullGradient.addColorStop(0, '#8b4513');
  hullGradient.addColorStop(1, '#5c4033');
  ctx.fillStyle = hullGradient;
  
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.quadraticCurveTo(-22, 8, -12, 10);
  ctx.lineTo(12, 10);
  ctx.quadraticCurveTo(24, 6, 22, -2);
  ctx.lineTo(18, -4);
  ctx.lineTo(-14, -4);
  ctx.quadraticCurveTo(-18, -2, -18, 0);
  ctx.fill();
  
  // Forecastle
  ctx.fillStyle = '#a0522d';
  ctx.fillRect(14, -8, 6, 4);
  
  // Stern castle
  ctx.fillRect(-16, -10, 8, 6);
  
  // Main mast
  ctx.fillStyle = '#5c4033';
  ctx.fillRect(-1, -35, 2, 31);
  
  // Fore mast
  ctx.fillRect(10, -28, 1.5, 24);
  
  // Sails
  const billow = Math.sin(time * 0.8) * 3;
  
  // Main sail
  ctx.fillStyle = '#f5f5dc';
  ctx.beginPath();
  ctx.moveTo(-10, -32);
  ctx.quadraticCurveTo(-10 + billow, -18, -10, -8);
  ctx.lineTo(8, -8);
  ctx.quadraticCurveTo(8 + billow, -18, 8, -32);
  ctx.closePath();
  ctx.fill();
  
  // Cross pattern
  ctx.strokeStyle = playerColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-1, -30);
  ctx.lineTo(-1, -10);
  ctx.moveTo(-8, -20);
  ctx.lineTo(6, -20);
  ctx.stroke();
  
  // Fore sail
  ctx.fillStyle = '#f5f5dc';
  ctx.beginPath();
  ctx.moveTo(5, -26);
  ctx.quadraticCurveTo(5 + billow * 0.5, -16, 5, -8);
  ctx.lineTo(15, -8);
  ctx.quadraticCurveTo(15 + billow * 0.5, -16, 15, -26);
  ctx.closePath();
  ctx.fill();
}

function drawFrigate(ctx: CanvasRenderingContext2D, playerColor: string, time: number): void {
  // Hull
  const hullGradient = ctx.createLinearGradient(-25, 0, -25, 12);
  hullGradient.addColorStop(0, '#2f4f4f');
  hullGradient.addColorStop(1, '#1a2f2f');
  ctx.fillStyle = hullGradient;
  
  ctx.beginPath();
  ctx.moveTo(-22, 2);
  ctx.quadraticCurveTo(-28, 10, -18, 12);
  ctx.lineTo(18, 12);
  ctx.quadraticCurveTo(30, 8, 28, 0);
  ctx.lineTo(24, -4);
  ctx.lineTo(-18, -4);
  ctx.quadraticCurveTo(-24, 0, -22, 2);
  ctx.fill();
  
  // Gun deck stripe
  ctx.fillStyle = '#daa520';
  ctx.fillRect(-20, 4, 42, 2);
  
  // Gun ports
  ctx.fillStyle = '#1a1a1a';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(-16 + i * 5, 3, 2, 3);
  }
  
  // Deck
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(-18, -4, 40, 4);
  
  // Three masts
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(-12, -45, 2, 41);  // Main
  ctx.fillRect(8, -40, 1.5, 36);   // Fore
  ctx.fillRect(-18, -35, 1.5, 31); // Mizzen
  
  // Sails
  const billow = Math.sin(time * 0.6) * 4;
  ctx.fillStyle = '#f5f5dc';
  
  // Main sails (3 levels)
  for (let i = 0; i < 3; i++) {
    const sy = -42 + i * 12;
    const sw = 10 - i * 2;
    ctx.beginPath();
    ctx.moveTo(-12 - sw, sy);
    ctx.quadraticCurveTo(-12 + billow, sy + 5, -12 - sw, sy + 10);
    ctx.lineTo(-12 + sw, sy + 10);
    ctx.quadraticCurveTo(-12 + billow, sy + 5, -12 + sw, sy);
    ctx.closePath();
    ctx.fill();
  }
  
  // Flag
  ctx.fillStyle = playerColor;
  ctx.beginPath();
  ctx.moveTo(-12, -45);
  ctx.lineTo(-12 + 8 + Math.sin(time * 2) * 2, -42);
  ctx.lineTo(-12, -39);
  ctx.fill();
}

function drawIronclad(ctx: CanvasRenderingContext2D, playerColor: string, time: number): void {
  // Hull
  ctx.fillStyle = '#4a4a4a';
  ctx.beginPath();
  ctx.moveTo(-25, 3);
  ctx.lineTo(-28, 8);
  ctx.lineTo(-22, 10);
  ctx.lineTo(22, 10);
  ctx.lineTo(28, 6);
  ctx.lineTo(26, 0);
  ctx.lineTo(-22, 0);
  ctx.closePath();
  ctx.fill();
  
  // Armor plates
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-20 + i * 10, 0);
    ctx.lineTo(-20 + i * 10, 10);
    ctx.stroke();
  }
  
  // Deck structure
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(-15, -8, 30, 8);
  
  // Turret
  ctx.fillStyle = playerColor;
  ctx.beginPath();
  ctx.arc(0, -8, 8, 0, Math.PI * 2);
  ctx.fill();
  
  // Gun barrels
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(-2, -16, 4, 8);
  
  // Smokestack
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-3, -18, 6, 10);
  
  // Smoke
  const smokeTime = time * 2;
  ctx.fillStyle = 'rgba(80, 80, 80, 0.5)';
  for (let i = 0; i < 4; i++) {
    const sx = Math.sin(smokeTime + i) * 3;
    const sy = -20 - i * 6 - (smokeTime % 1) * 5;
    const sr = 3 + i * 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBattleship(ctx: CanvasRenderingContext2D, playerColor: string, time: number): void {
  // Hull
  const hullGradient = ctx.createLinearGradient(-30, 0, -30, 15);
  hullGradient.addColorStop(0, '#505050');
  hullGradient.addColorStop(1, '#303030');
  ctx.fillStyle = hullGradient;
  
  ctx.beginPath();
  ctx.moveTo(-30, 5);
  ctx.lineTo(-35, 12);
  ctx.lineTo(35, 12);
  ctx.lineTo(38, 5);
  ctx.lineTo(35, -2);
  ctx.lineTo(-28, -2);
  ctx.closePath();
  ctx.fill();
  
  // Deck
  ctx.fillStyle = '#606060';
  ctx.fillRect(-28, -5, 60, 5);
  
  // Superstructure
  ctx.fillStyle = '#707070';
  ctx.fillRect(-10, -15, 20, 10);
  
  // Bridge
  ctx.fillStyle = '#808080';
  ctx.fillRect(-6, -22, 12, 7);
  
  // Mast
  ctx.fillStyle = '#505050';
  ctx.fillRect(-1, -35, 2, 20);
  
  // Front turret
  ctx.fillStyle = playerColor;
  ctx.beginPath();
  ctx.arc(20, -5, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(18, -12, 2, 7);
  ctx.fillRect(22, -12, 2, 7);
  
  // Rear turret
  ctx.fillStyle = playerColor;
  ctx.beginPath();
  ctx.arc(-18, -5, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-20, -12, 2, 7);
  ctx.fillRect(-16, -12, 2, 7);
  
  // Smokestacks
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(-5, -28, 4, 13);
  ctx.fillRect(2, -28, 4, 13);
  
  // Smoke
  ctx.fillStyle = 'rgba(60, 60, 60, 0.4)';
  for (let s = 0; s < 2; s++) {
    const baseX = s === 0 ? -3 : 4;
    for (let i = 0; i < 3; i++) {
      const sx = baseX + Math.sin(time * 2 + i + s) * 2;
      const sy = -30 - i * 5 - (time % 1) * 4;
      ctx.beginPath();
      ctx.arc(sx, sy, 2 + i, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCarrier(ctx: CanvasRenderingContext2D, playerColor: string, time: number): void {
  // Hull
  ctx.fillStyle = '#505050';
  ctx.beginPath();
  ctx.moveTo(-40, 5);
  ctx.lineTo(-45, 12);
  ctx.lineTo(45, 12);
  ctx.lineTo(48, 5);
  ctx.lineTo(45, -5);
  ctx.lineTo(-38, -5);
  ctx.closePath();
  ctx.fill();
  
  // Flight deck
  ctx.fillStyle = '#606060';
  ctx.fillRect(-42, -8, 88, 6);
  
  // Deck markings
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(-40, -5);
  ctx.lineTo(44, -5);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Landing zone markings
  ctx.fillStyle = '#ffff00';
  ctx.fillRect(-30, -7, 2, 4);
  ctx.fillRect(-20, -7, 2, 4);
  ctx.fillRect(-10, -7, 2, 4);
  
  // Island (command tower)
  ctx.fillStyle = playerColor;
  ctx.fillRect(25, -20, 12, 12);
  
  // Radar
  ctx.fillStyle = '#808080';
  ctx.fillRect(30, -28, 2, 8);
  ctx.beginPath();
  ctx.arc(31, -30, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Aircraft on deck
  for (let i = 0; i < 3; i++) {
    const ax = -30 + i * 15;
    ctx.fillStyle = '#3a5a3a';
    // Fuselage
    ctx.fillRect(ax - 3, -6, 6, 2);
    // Wings
    ctx.fillRect(ax - 5, -5.5, 10, 1);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Adjust color brightness
 */
function adjustColor(color: string, amount: number): string {
  // Simple hex color adjustment
  if (color.startsWith('#')) {
    const r = Math.min(255, Math.max(0, parseInt(color.slice(1, 3), 16) + amount));
    const g = Math.min(255, Math.max(0, parseInt(color.slice(3, 5), 16) + amount));
    const b = Math.min(255, Math.max(0, parseInt(color.slice(5, 7), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return color;
}

// ============================================================================
// EFFECTS
// ============================================================================

/**
 * Draw dust trail for moving ground units
 */
export function drawDustTrail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  intensity: number,
  time: number
): void {
  ctx.save();
  
  for (let i = 0; i < 5; i++) {
    const dx = -i * 3 + Math.sin(time * 3 + i) * 2;
    const dy = i * 0.5;
    const alpha = (0.3 - i * 0.05) * intensity;
    const size = (2 + i) * intensity;
    
    ctx.fillStyle = `rgba(180, 160, 140, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Draw artillery/cannon muzzle blast
 */
export function drawArtilleryBlast(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  progress: number // 0-1
): void {
  if (progress > 1) return;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  
  const alpha = 1 - progress;
  const size = 10 + progress * 20;
  
  // Flash
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
  gradient.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
  gradient.addColorStop(0.3, `rgba(255, 200, 100, ${alpha * 0.6})`);
  gradient.addColorStop(0.6, `rgba(255, 100, 50, ${alpha * 0.3})`);
  gradient.addColorStop(1, 'rgba(100, 50, 0, 0)');
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fill();
  
  // Smoke ring
  ctx.strokeStyle = `rgba(100, 100, 100, ${alpha * 0.5})`;
  ctx.lineWidth = 2 + progress * 3;
  ctx.beginPath();
  ctx.arc(5 + progress * 10, 0, 5 + progress * 15, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.restore();
}
