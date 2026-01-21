/**
 * Ambient visual effects system for enhanced atmosphere
 * Includes floating particles, dust motes, leaves, and sparkles
 */

import { TILE_WIDTH, TILE_HEIGHT, WorldRenderState } from './types';

// ============================================================================
// Types
// ============================================================================

export type AmbientParticleType = 
  | 'dust_mote'       // Small floating dust particles
  | 'leaf'            // Falling autumn leaves
  | 'pollen'          // Spring pollen particles
  | 'snow'            // Winter snow particles
  | 'sparkle'         // Magical sparkles near special buildings
  | 'firefly';        // Night-time fireflies

export interface AmbientParticle {
  id: number;
  type: AmbientParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  size: number;
  opacity: number;
  rotation: number;       // For leaves
  rotationSpeed: number;  // For leaves
  color: string;
  phase: number;          // For oscillating effects
}

// ============================================================================
// Constants
// ============================================================================

export const AMBIENT_CONFIG = {
  // Particle limits
  MAX_PARTICLES: 120,
  MAX_PARTICLES_MOBILE: 40,
  
  // Spawn intervals (seconds)
  SPAWN_INTERVAL: 0.08,
  SPAWN_INTERVAL_MOBILE: 0.2,
  
  // Dust motes
  DUST_COLOR: 'rgba(255, 248, 220, 0.4)',
  DUST_SIZE_MIN: 1,
  DUST_SIZE_MAX: 3,
  DUST_SPEED: 8,
  DUST_LIFE_MIN: 6,
  DUST_LIFE_MAX: 12,
  
  // Leaves
  LEAF_COLORS: ['#c0392b', '#e74c3c', '#d35400', '#f39c12', '#8b4513', '#a0522d'],
  LEAF_SIZE_MIN: 3,
  LEAF_SIZE_MAX: 6,
  LEAF_FALL_SPEED_MIN: 15,
  LEAF_FALL_SPEED_MAX: 30,
  LEAF_DRIFT_SPEED: 10,
  LEAF_LIFE_MIN: 8,
  LEAF_LIFE_MAX: 15,
  
  // Sparkles (near special buildings)
  SPARKLE_COLORS: ['#ffd700', '#fff8dc', '#fffacd', '#87ceeb', '#e6e6fa'],
  SPARKLE_SIZE_MIN: 1,
  SPARKLE_SIZE_MAX: 3,
  SPARKLE_LIFE: 1.5,
  
  // Fireflies (night only)
  FIREFLY_COLOR: '#ffffaa',
  FIREFLY_SIZE: 2,
  FIREFLY_LIFE_MIN: 4,
  FIREFLY_LIFE_MAX: 8,
  FIREFLY_GLOW_SPEED: 3,
  
  // Zoom thresholds
  MIN_ZOOM: 0.4,
  FADE_ZOOM_START: 0.5,
  FADE_ZOOM_END: 0.4,
} as const;

// ============================================================================
// Particle Factory
// ============================================================================

let particleId = 0;

export function createDustMote(x: number, y: number): AmbientParticle {
  const size = AMBIENT_CONFIG.DUST_SIZE_MIN + 
    Math.random() * (AMBIENT_CONFIG.DUST_SIZE_MAX - AMBIENT_CONFIG.DUST_SIZE_MIN);
  
  return {
    id: particleId++,
    type: 'dust_mote',
    x,
    y,
    vx: (Math.random() - 0.5) * AMBIENT_CONFIG.DUST_SPEED,
    vy: (Math.random() - 0.5) * AMBIENT_CONFIG.DUST_SPEED * 0.5,
    age: 0,
    maxAge: AMBIENT_CONFIG.DUST_LIFE_MIN + 
      Math.random() * (AMBIENT_CONFIG.DUST_LIFE_MAX - AMBIENT_CONFIG.DUST_LIFE_MIN),
    size,
    opacity: 0.3 + Math.random() * 0.3,
    rotation: 0,
    rotationSpeed: 0,
    color: AMBIENT_CONFIG.DUST_COLOR,
    phase: Math.random() * Math.PI * 2,
  };
}

export function createLeaf(x: number, y: number): AmbientParticle {
  const size = AMBIENT_CONFIG.LEAF_SIZE_MIN + 
    Math.random() * (AMBIENT_CONFIG.LEAF_SIZE_MAX - AMBIENT_CONFIG.LEAF_SIZE_MIN);
  const colors = AMBIENT_CONFIG.LEAF_COLORS;
  
  return {
    id: particleId++,
    type: 'leaf',
    x,
    y,
    vx: (Math.random() - 0.5) * AMBIENT_CONFIG.LEAF_DRIFT_SPEED,
    vy: AMBIENT_CONFIG.LEAF_FALL_SPEED_MIN + 
      Math.random() * (AMBIENT_CONFIG.LEAF_FALL_SPEED_MAX - AMBIENT_CONFIG.LEAF_FALL_SPEED_MIN),
    age: 0,
    maxAge: AMBIENT_CONFIG.LEAF_LIFE_MIN + 
      Math.random() * (AMBIENT_CONFIG.LEAF_LIFE_MAX - AMBIENT_CONFIG.LEAF_LIFE_MIN),
    size,
    opacity: 0.7 + Math.random() * 0.3,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    phase: Math.random() * Math.PI * 2,
  };
}

export function createSparkle(x: number, y: number): AmbientParticle {
  const size = AMBIENT_CONFIG.SPARKLE_SIZE_MIN + 
    Math.random() * (AMBIENT_CONFIG.SPARKLE_SIZE_MAX - AMBIENT_CONFIG.SPARKLE_SIZE_MIN);
  const colors = AMBIENT_CONFIG.SPARKLE_COLORS;
  
  return {
    id: particleId++,
    type: 'sparkle',
    x,
    y,
    vx: (Math.random() - 0.5) * 15,
    vy: -10 - Math.random() * 20,
    age: 0,
    maxAge: AMBIENT_CONFIG.SPARKLE_LIFE,
    size,
    opacity: 0.8 + Math.random() * 0.2,
    rotation: 0,
    rotationSpeed: 0,
    color: colors[Math.floor(Math.random() * colors.length)],
    phase: Math.random() * Math.PI * 2,
  };
}

export function createFirefly(x: number, y: number): AmbientParticle {
  return {
    id: particleId++,
    type: 'firefly',
    x,
    y,
    vx: (Math.random() - 0.5) * 20,
    vy: (Math.random() - 0.5) * 15,
    age: 0,
    maxAge: AMBIENT_CONFIG.FIREFLY_LIFE_MIN + 
      Math.random() * (AMBIENT_CONFIG.FIREFLY_LIFE_MAX - AMBIENT_CONFIG.FIREFLY_LIFE_MIN),
    size: AMBIENT_CONFIG.FIREFLY_SIZE,
    opacity: 0,
    rotation: 0,
    rotationSpeed: 0,
    color: AMBIENT_CONFIG.FIREFLY_COLOR,
    phase: Math.random() * Math.PI * 2,
  };
}

// ============================================================================
// Update System
// ============================================================================

export function updateAmbientParticles(
  particles: AmbientParticle[],
  delta: number,
  gameSpeed: number
): AmbientParticle[] {
  if (gameSpeed === 0) return particles;
  
  const adjustedDelta = delta * (gameSpeed === 1 ? 1 : gameSpeed === 2 ? 1.3 : 1.6);
  
  return particles.filter(particle => {
    particle.age += adjustedDelta;
    if (particle.age >= particle.maxAge) return false;
    
    switch (particle.type) {
      case 'dust_mote': {
        // Gentle floating motion with oscillation
        const oscillation = Math.sin(particle.age * 2 + particle.phase) * 3;
        particle.x += (particle.vx + oscillation * 0.5) * adjustedDelta;
        particle.y += particle.vy * adjustedDelta;
        
        // Slight wind effect
        particle.vx += (Math.random() - 0.5) * 2 * adjustedDelta;
        particle.vx *= 0.98;
        break;
      }
      
      case 'leaf': {
        // Tumbling leaf motion
        const sway = Math.sin(particle.age * 1.5 + particle.phase) * 15;
        particle.x += (particle.vx + sway) * adjustedDelta;
        particle.y += particle.vy * adjustedDelta;
        particle.rotation += particle.rotationSpeed * adjustedDelta;
        
        // Wind gusts
        if (Math.random() < 0.02) {
          particle.vx += (Math.random() - 0.3) * 10;
        }
        break;
      }
      
      case 'sparkle': {
        particle.x += particle.vx * adjustedDelta;
        particle.y += particle.vy * adjustedDelta;
        particle.vy += 30 * adjustedDelta; // Gravity
        
        // Fade out quickly
        const fadeProgress = particle.age / particle.maxAge;
        particle.opacity = Math.max(0, 1 - fadeProgress * fadeProgress);
        break;
      }
      
      case 'firefly': {
        // Random wandering motion
        particle.vx += (Math.random() - 0.5) * 40 * adjustedDelta;
        particle.vy += (Math.random() - 0.5) * 30 * adjustedDelta;
        
        // Dampen
        particle.vx *= 0.95;
        particle.vy *= 0.95;
        
        particle.x += particle.vx * adjustedDelta;
        particle.y += particle.vy * adjustedDelta;
        
        // Pulsing glow
        const glowPhase = (particle.age * AMBIENT_CONFIG.FIREFLY_GLOW_SPEED + particle.phase);
        particle.opacity = Math.max(0, Math.sin(glowPhase) * 0.6 + 0.4);
        break;
      }
    }
    
    return true;
  });
}

// ============================================================================
// Render System
// ============================================================================

export function drawAmbientParticles(
  ctx: CanvasRenderingContext2D,
  particles: AmbientParticle[],
  worldState: WorldRenderState
): void {
  const { offset, zoom, canvasSize } = worldState;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  
  // Skip if zoomed out too far
  if (zoom < AMBIENT_CONFIG.MIN_ZOOM) return;
  
  // Calculate fade for zoom threshold
  let zoomFade = 1;
  if (zoom < AMBIENT_CONFIG.FADE_ZOOM_START) {
    zoomFade = (zoom - AMBIENT_CONFIG.FADE_ZOOM_END) / 
      (AMBIENT_CONFIG.FADE_ZOOM_START - AMBIENT_CONFIG.FADE_ZOOM_END);
    zoomFade = Math.max(0, Math.min(1, zoomFade));
  }
  
  if (zoomFade <= 0) return;
  
  // Calculate viewport bounds
  const viewWidth = canvasSize.width / (dpr * zoom);
  const viewHeight = canvasSize.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom - 50;
  const viewTop = -offset.y / zoom - 50;
  const viewRight = viewLeft + viewWidth + 100;
  const viewBottom = viewTop + viewHeight + 100;
  
  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);
  
  for (const particle of particles) {
    // Viewport culling
    if (particle.x < viewLeft || particle.x > viewRight ||
        particle.y < viewTop || particle.y > viewBottom) {
      continue;
    }
    
    const ageRatio = particle.age / particle.maxAge;
    let fadeOpacity = particle.opacity * zoomFade;
    
    // Fade in and out
    if (ageRatio < 0.1) {
      fadeOpacity *= ageRatio / 0.1;
    } else if (ageRatio > 0.8) {
      fadeOpacity *= (1 - ageRatio) / 0.2;
    }
    
    if (fadeOpacity <= 0.01) continue;
    
    switch (particle.type) {
      case 'dust_mote': {
        // Simple glowing circle
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 2
        );
        gradient.addColorStop(0, `rgba(255, 248, 220, ${fadeOpacity})`);
        gradient.addColorStop(0.5, `rgba(255, 248, 220, ${fadeOpacity * 0.4})`);
        gradient.addColorStop(1, 'rgba(255, 248, 220, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      
      case 'leaf': {
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.globalAlpha = fadeOpacity;
        
        // Draw simple leaf shape
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, particle.size, particle.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Leaf vein
        ctx.strokeStyle = `rgba(0, 0, 0, 0.3)`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-particle.size * 0.8, 0);
        ctx.lineTo(particle.size * 0.8, 0);
        ctx.stroke();
        
        ctx.restore();
        break;
      }
      
      case 'sparkle': {
        // 4-point star sparkle
        ctx.save();
        ctx.globalAlpha = fadeOpacity;
        ctx.fillStyle = particle.color;
        
        const spikes = 4;
        const outerRadius = particle.size;
        const innerRadius = particle.size * 0.4;
        
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (i * Math.PI) / spikes - Math.PI / 2;
          const px = particle.x + Math.cos(angle) * radius;
          const py = particle.y + Math.sin(angle) * radius;
          
          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.closePath();
        ctx.fill();
        
        // Glow
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 2
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${fadeOpacity * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        break;
      }
      
      case 'firefly': {
        // Glowing firefly with halo
        const glowSize = particle.size + particle.opacity * 3;
        
        // Outer glow
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, glowSize * 3
        );
        gradient.addColorStop(0, `rgba(255, 255, 170, ${fadeOpacity * 0.8})`);
        gradient.addColorStop(0.3, `rgba(255, 255, 100, ${fadeOpacity * 0.4})`);
        gradient.addColorStop(1, 'rgba(255, 255, 100, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, glowSize * 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Core
        ctx.fillStyle = `rgba(255, 255, 220, ${fadeOpacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }
  
  ctx.restore();
}

// ============================================================================
// Spawn Helpers
// ============================================================================

export function shouldSpawnAmbientParticle(
  currentHour: number,
  particleType: AmbientParticleType
): boolean {
  const isNight = currentHour >= 20 || currentHour < 6;
  const isEvening = currentHour >= 18 && currentHour < 20;
  const isMorning = currentHour >= 6 && currentHour < 10;
  
  switch (particleType) {
    case 'dust_mote':
      // Visible during day, especially in warm afternoon light
      return !isNight && Math.random() < 0.6;
    
    case 'leaf':
      // Visible during autumn-like conditions (could be enhanced with seasons)
      return !isNight && Math.random() < 0.3;
    
    case 'firefly':
      // Night time only, more common during evening
      return (isNight || isEvening) && Math.random() < 0.4;
    
    case 'sparkle':
      // Always possible near special buildings
      return Math.random() < 0.5;
    
    default:
      return false;
  }
}

export function getRandomViewportPosition(
  worldState: WorldRenderState,
  margin: number = 50
): { x: number; y: number } {
  const { offset, zoom, canvasSize } = worldState;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  
  const viewWidth = canvasSize.width / (dpr * zoom);
  const viewHeight = canvasSize.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom;
  const viewTop = -offset.y / zoom;
  
  return {
    x: viewLeft + Math.random() * viewWidth,
    y: viewTop - margin + Math.random() * margin * 0.5, // Spawn above viewport
  };
}
