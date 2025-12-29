/**
 * Ambient Effects System
 * 
 * Provides atmospheric visual effects:
 * - Flying birds
 * - Floating dust/pollen particles
 * - Falling leaves (autumn)
 * - Cloud shadows
 * - Weather effects (rain, snow)
 * - Fireflies (night)
 */

import { createNoise2D } from 'simplex-noise';

const effectNoise = createNoise2D();

// ============================================================================
// BIRD SYSTEM
// ============================================================================

interface Bird {
  id: number;
  x: number;
  y: number;
  z: number; // Height
  vx: number;
  vy: number;
  flapPhase: number;
  type: 'small' | 'seagull' | 'hawk';
  turnTimer: number;
}

const MAX_BIRDS = 15;
const birds: Bird[] = [];
let birdIdCounter = 0;

/**
 * Initialize birds for a game session
 */
export function initBirds(mapWidth: number, mapHeight: number): void {
  birds.length = 0;
  birdIdCounter = 0;
  
  const numBirds = Math.floor(MAX_BIRDS * 0.6);
  
  for (let i = 0; i < numBirds; i++) {
    spawnBird(mapWidth, mapHeight);
  }
}

/**
 * Spawn a new bird
 */
function spawnBird(mapWidth: number, mapHeight: number): void {
  if (birds.length >= MAX_BIRDS) return;
  
  const typeRoll = Math.random();
  let type: Bird['type'] = 'small';
  if (typeRoll > 0.8) type = 'hawk';
  else if (typeRoll > 0.5) type = 'seagull';
  
  // Speed based on type
  const baseSpeed = type === 'hawk' ? 0.8 : type === 'seagull' ? 1.2 : 1.5;
  const angle = Math.random() * Math.PI * 2;
  
  birds.push({
    id: birdIdCounter++,
    x: Math.random() * mapWidth,
    y: Math.random() * mapHeight,
    z: 50 + Math.random() * 100, // Height above ground
    vx: Math.cos(angle) * baseSpeed,
    vy: Math.sin(angle) * baseSpeed,
    flapPhase: Math.random() * Math.PI * 2,
    type,
    turnTimer: 100 + Math.random() * 200,
  });
}

/**
 * Update bird positions
 */
export function updateBirds(deltaTime: number, mapWidth: number, mapHeight: number): void {
  for (const bird of birds) {
    // Update position
    bird.x += bird.vx * deltaTime * 60;
    bird.y += bird.vy * deltaTime * 60;
    
    // Flap wings
    const flapSpeed = bird.type === 'hawk' ? 3 : bird.type === 'seagull' ? 4 : 8;
    bird.flapPhase += deltaTime * flapSpeed;
    
    // Random turns
    bird.turnTimer -= deltaTime * 60;
    if (bird.turnTimer <= 0) {
      const turnAngle = (Math.random() - 0.5) * 0.8;
      const cos = Math.cos(turnAngle);
      const sin = Math.sin(turnAngle);
      const newVx = bird.vx * cos - bird.vy * sin;
      const newVy = bird.vx * sin + bird.vy * cos;
      bird.vx = newVx;
      bird.vy = newVy;
      bird.turnTimer = 100 + Math.random() * 200;
    }
    
    // Wrap around map edges
    if (bird.x < -50) bird.x = mapWidth + 50;
    if (bird.x > mapWidth + 50) bird.x = -50;
    if (bird.y < -50) bird.y = mapHeight + 50;
    if (bird.y > mapHeight + 50) bird.y = -50;
  }
}

/**
 * Draw all birds
 */
export function drawBirds(
  ctx: CanvasRenderingContext2D,
  gridToScreen: (x: number, y: number) => { screenX: number; screenY: number },
  viewBounds: { left: number; right: number; top: number; bottom: number },
  time: number
): void {
  for (const bird of birds) {
    const { screenX, screenY } = gridToScreen(bird.x, bird.y);
    
    // Cull off-screen birds
    if (screenX < viewBounds.left - 50 || screenX > viewBounds.right + 50 ||
        screenY < viewBounds.top - 50 || screenY > viewBounds.bottom + 50) {
      continue;
    }
    
    const birdY = screenY - bird.z;
    const flapOffset = Math.sin(bird.flapPhase) * 3;
    
    drawBird(ctx, screenX, birdY, bird, flapOffset);
  }
}

/**
 * Draw a single bird
 */
function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bird: Bird,
  flapOffset: number
): void {
  ctx.save();
  ctx.translate(x, y);
  
  // Face direction of movement
  const angle = Math.atan2(bird.vy, bird.vx);
  ctx.rotate(angle);
  
  const size = bird.type === 'hawk' ? 2.5 : bird.type === 'seagull' ? 2 : 1.2;
  
  // Shadow on ground
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.beginPath();
  ctx.ellipse(0, bird.z * 0.5, 3 * size, 1 * size, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Bird body
  ctx.fillStyle = bird.type === 'hawk' ? '#4a3020' : bird.type === 'seagull' ? '#e8e8e8' : '#2a2a2a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 4 * size, 1.5 * size, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Wings
  ctx.fillStyle = bird.type === 'seagull' ? '#d0d0d0' : '#3a3a3a';
  
  // Left wing
  ctx.beginPath();
  ctx.moveTo(-1 * size, 0);
  ctx.quadraticCurveTo(-4 * size, -flapOffset * 1.5 - 2 * size, -6 * size, -flapOffset);
  ctx.quadraticCurveTo(-4 * size, flapOffset * 0.5, -1 * size, 0);
  ctx.fill();
  
  // Right wing
  ctx.beginPath();
  ctx.moveTo(-1 * size, 0);
  ctx.quadraticCurveTo(-4 * size, flapOffset * 1.5 + 2 * size, -6 * size, flapOffset);
  ctx.quadraticCurveTo(-4 * size, -flapOffset * 0.5, -1 * size, 0);
  ctx.fill();
  
  // Head
  ctx.fillStyle = bird.type === 'seagull' ? '#f0f0f0' : '#2a2a2a';
  ctx.beginPath();
  ctx.arc(3 * size, 0, 1.2 * size, 0, Math.PI * 2);
  ctx.fill();
  
  // Beak
  ctx.fillStyle = bird.type === 'seagull' ? '#f5a000' : '#333';
  ctx.beginPath();
  ctx.moveTo(4 * size, 0);
  ctx.lineTo(5.5 * size, 0);
  ctx.lineTo(4 * size, 0.3 * size);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  type: 'dust' | 'leaf' | 'pollen' | 'firefly';
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
}

const particles: Particle[] = [];
const MAX_PARTICLES = 100;

/**
 * Spawn ambient particles based on environment
 */
export function spawnAmbientParticles(
  mapWidth: number,
  mapHeight: number,
  season: 'spring' | 'summer' | 'autumn' | 'winter',
  timeOfDay: 'day' | 'night' | 'dawn' | 'dusk',
  deltaTime: number
): void {
  // Limit spawning
  if (particles.length >= MAX_PARTICLES) return;
  
  const spawnChance = deltaTime * 2;
  if (Math.random() > spawnChance) return;
  
  // Determine particle type based on season/time
  let type: Particle['type'] = 'dust';
  let color = 'rgba(200, 200, 180, 0.4)';
  
  if (timeOfDay === 'night') {
    type = 'firefly';
    color = '#ffff80';
  } else if (season === 'autumn') {
    type = Math.random() > 0.5 ? 'leaf' : 'dust';
    if (type === 'leaf') {
      const leafColors = ['#c45c20', '#e08040', '#a04020', '#d0a020', '#b03010'];
      color = leafColors[Math.floor(Math.random() * leafColors.length)];
    }
  } else if (season === 'spring') {
    type = Math.random() > 0.7 ? 'pollen' : 'dust';
    if (type === 'pollen') {
      color = 'rgba(255, 255, 150, 0.6)';
    }
  }
  
  const x = Math.random() * mapWidth;
  const y = Math.random() * mapHeight;
  const z = 20 + Math.random() * 80;
  
  particles.push({
    x,
    y,
    z,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.3,
    vz: type === 'leaf' ? -0.3 - Math.random() * 0.2 : (Math.random() - 0.5) * 0.1,
    life: 1,
    maxLife: 3 + Math.random() * 5,
    type,
    color,
    size: type === 'leaf' ? 3 + Math.random() * 2 : type === 'firefly' ? 2 : 1 + Math.random(),
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 2,
  });
}

/**
 * Update particles
 */
export function updateParticles(deltaTime: number, windX: number = 0.1, windY: number = 0.05): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    
    // Apply wind
    p.vx += windX * deltaTime;
    p.vy += windY * deltaTime;
    
    // Update position
    p.x += p.vx * deltaTime * 60;
    p.y += p.vy * deltaTime * 60;
    p.z += p.vz * deltaTime * 60;
    
    // Update rotation
    p.rotation += p.rotationSpeed * deltaTime;
    
    // Update life
    p.life -= deltaTime / p.maxLife;
    
    // Remove dead particles or those that hit ground
    if (p.life <= 0 || p.z <= 0) {
      particles.splice(i, 1);
    }
  }
}

/**
 * Draw particles
 */
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  gridToScreen: (x: number, y: number) => { screenX: number; screenY: number },
  viewBounds: { left: number; right: number; top: number; bottom: number },
  time: number
): void {
  for (const p of particles) {
    const { screenX, screenY } = gridToScreen(p.x, p.y);
    
    // Cull off-screen
    if (screenX < viewBounds.left - 20 || screenX > viewBounds.right + 20 ||
        screenY < viewBounds.top - 20 || screenY > viewBounds.bottom + 20) {
      continue;
    }
    
    const particleY = screenY - p.z;
    const alpha = p.life;
    
    ctx.save();
    ctx.translate(screenX, particleY);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = alpha;
    
    if (p.type === 'leaf') {
      // Leaf shape
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Leaf vein
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-p.size * 0.8, 0);
      ctx.lineTo(p.size * 0.8, 0);
      ctx.stroke();
    } else if (p.type === 'firefly') {
      // Glowing firefly
      const glowIntensity = 0.5 + Math.sin(time * 8 + p.x) * 0.5;
      
      // Outer glow
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 3);
      gradient.addColorStop(0, `rgba(255, 255, 100, ${glowIntensity * 0.8})`);
      gradient.addColorStop(0.5, `rgba(200, 255, 50, ${glowIntensity * 0.3})`);
      gradient.addColorStop(1, 'rgba(100, 200, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Core
      ctx.fillStyle = `rgba(255, 255, 200, ${glowIntensity})`;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'pollen') {
      // Pollen particle
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Dust particle
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}

// ============================================================================
// CLOUD SHADOW SYSTEM
// ============================================================================

interface CloudShadow {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  opacity: number;
}

const cloudShadows: CloudShadow[] = [];
const MAX_CLOUDS = 5;

/**
 * Initialize cloud shadows
 */
export function initCloudShadows(mapWidth: number, mapHeight: number): void {
  cloudShadows.length = 0;
  
  for (let i = 0; i < MAX_CLOUDS; i++) {
    cloudShadows.push({
      x: Math.random() * mapWidth * 2 - mapWidth * 0.5,
      y: Math.random() * mapHeight,
      width: 100 + Math.random() * 150,
      height: 60 + Math.random() * 80,
      speed: 0.2 + Math.random() * 0.3,
      opacity: 0.08 + Math.random() * 0.07,
    });
  }
}

/**
 * Update cloud shadow positions
 */
export function updateCloudShadows(deltaTime: number, mapWidth: number): void {
  for (const cloud of cloudShadows) {
    cloud.x += cloud.speed * deltaTime * 60;
    
    // Wrap around
    if (cloud.x > mapWidth + cloud.width) {
      cloud.x = -cloud.width;
    }
  }
}

/**
 * Draw cloud shadows on terrain
 */
export function drawCloudShadows(
  ctx: CanvasRenderingContext2D,
  gridToScreen: (x: number, y: number) => { screenX: number; screenY: number },
  viewBounds: { left: number; right: number; top: number; bottom: number }
): void {
  ctx.save();
  
  for (const cloud of cloudShadows) {
    const { screenX, screenY } = gridToScreen(cloud.x, cloud.y);
    
    // Create soft shadow gradient
    const gradient = ctx.createRadialGradient(
      screenX, screenY, 0,
      screenX, screenY, cloud.width
    );
    gradient.addColorStop(0, `rgba(0, 20, 40, ${cloud.opacity})`);
    gradient.addColorStop(0.6, `rgba(0, 20, 40, ${cloud.opacity * 0.5})`);
    gradient.addColorStop(1, 'rgba(0, 20, 40, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, cloud.width, cloud.height, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

// ============================================================================
// WEATHER EFFECTS
// ============================================================================

interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
}

interface SnowFlake {
  x: number;
  y: number;
  size: number;
  speed: number;
  wobble: number;
  wobblePhase: number;
}

const rainDrops: RainDrop[] = [];
const snowFlakes: SnowFlake[] = [];

/**
 * Update weather effects
 */
export function updateWeather(
  deltaTime: number,
  weather: 'clear' | 'rain' | 'snow' | 'storm',
  canvasWidth: number,
  canvasHeight: number
): void {
  if (weather === 'rain' || weather === 'storm') {
    // Spawn rain
    const intensity = weather === 'storm' ? 3 : 1;
    const targetDrops = 100 * intensity;
    
    while (rainDrops.length < targetDrops) {
      rainDrops.push({
        x: Math.random() * canvasWidth,
        y: -20 - Math.random() * 100,
        length: 10 + Math.random() * 15,
        speed: 15 + Math.random() * 10,
        opacity: 0.2 + Math.random() * 0.3,
      });
    }
    
    // Update rain
    for (let i = rainDrops.length - 1; i >= 0; i--) {
      const drop = rainDrops[i];
      drop.y += drop.speed * deltaTime * 60;
      drop.x += 2 * deltaTime * 60; // Wind
      
      if (drop.y > canvasHeight) {
        rainDrops.splice(i, 1);
      }
    }
  } else {
    rainDrops.length = 0;
  }
  
  if (weather === 'snow') {
    // Spawn snow
    const targetFlakes = 80;
    
    while (snowFlakes.length < targetFlakes) {
      snowFlakes.push({
        x: Math.random() * canvasWidth,
        y: -10 - Math.random() * 50,
        size: 2 + Math.random() * 3,
        speed: 1 + Math.random() * 2,
        wobble: 1 + Math.random() * 2,
        wobblePhase: Math.random() * Math.PI * 2,
      });
    }
    
    // Update snow
    for (let i = snowFlakes.length - 1; i >= 0; i--) {
      const flake = snowFlakes[i];
      flake.y += flake.speed * deltaTime * 60;
      flake.wobblePhase += deltaTime * 3;
      flake.x += Math.sin(flake.wobblePhase) * flake.wobble * deltaTime * 60;
      
      if (flake.y > canvasHeight) {
        snowFlakes.splice(i, 1);
      }
    }
  } else {
    snowFlakes.length = 0;
  }
}

/**
 * Draw weather effects (screen-space, after world rendering)
 */
export function drawWeather(
  ctx: CanvasRenderingContext2D,
  weather: 'clear' | 'rain' | 'snow' | 'storm'
): void {
  if (weather === 'rain' || weather === 'storm') {
    ctx.strokeStyle = 'rgba(180, 200, 220, 0.6)';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    
    for (const drop of rainDrops) {
      ctx.globalAlpha = drop.opacity;
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + 3, drop.y + drop.length);
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
    
    // Storm lightning flash (rare)
    if (weather === 'storm' && Math.random() < 0.001) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  }
  
  if (weather === 'snow') {
    ctx.fillStyle = '#ffffff';
    
    for (const flake of snowFlakes) {
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.globalAlpha = 1;
  }
}

// ============================================================================
// MAIN UPDATE & DRAW
// ============================================================================

/**
 * Update all ambient effects
 */
export function updateAmbientEffects(
  deltaTime: number,
  mapWidth: number,
  mapHeight: number,
  season: 'spring' | 'summer' | 'autumn' | 'winter' = 'summer',
  timeOfDay: 'day' | 'night' | 'dawn' | 'dusk' = 'day',
  weather: 'clear' | 'rain' | 'snow' | 'storm' = 'clear',
  canvasWidth: number = 1920,
  canvasHeight: number = 1080
): void {
  updateBirds(deltaTime, mapWidth, mapHeight);
  spawnAmbientParticles(mapWidth, mapHeight, season, timeOfDay, deltaTime);
  updateParticles(deltaTime);
  updateCloudShadows(deltaTime, mapWidth);
  updateWeather(deltaTime, weather, canvasWidth, canvasHeight);
}

/**
 * Draw all ambient effects (call in world space before UI)
 */
export function drawAmbientEffects(
  ctx: CanvasRenderingContext2D,
  gridToScreen: (x: number, y: number) => { screenX: number; screenY: number },
  viewBounds: { left: number; right: number; top: number; bottom: number },
  time: number
): void {
  // Draw cloud shadows first (under everything)
  drawCloudShadows(ctx, gridToScreen, viewBounds);
  
  // Draw particles
  drawParticles(ctx, gridToScreen, viewBounds, time);
  
  // Draw birds (above particles)
  drawBirds(ctx, gridToScreen, viewBounds, time);
}

/**
 * Draw screen-space weather effects (call after all world rendering, before UI)
 */
export function drawWeatherEffects(
  ctx: CanvasRenderingContext2D,
  weather: 'clear' | 'rain' | 'snow' | 'storm' = 'clear'
): void {
  drawWeather(ctx, weather);
}

/**
 * Initialize all ambient systems
 */
export function initAmbientEffects(mapWidth: number, mapHeight: number): void {
  initBirds(mapWidth, mapHeight);
  initCloudShadows(mapWidth, mapHeight);
}
