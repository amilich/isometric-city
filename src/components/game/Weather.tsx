/**
 * Weather Visual Effects for IsoCity
 * 
 * Handles rendering of weather particles (rain, snow), clouds, lightning,
 * and environmental effects (heat shimmer, snow accumulation).
 */

import { WeatherState, WeatherType, Season } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';
import { getSeasonFromMonth, getDaylightHours, getAmbientLight } from '@/lib/weather';

// ============================================================================
// Weather Particle Types
// ============================================================================

export interface RainDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
}

export interface SnowFlake {
  x: number;
  y: number;
  speed: number;
  size: number;
  wobble: number;
  wobbleSpeed: number;
  opacity: number;
}

export interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  speed: number;
}

export interface LightningFlash {
  active: boolean;
  intensity: number;
  duration: number;
  boltX: number;
  boltY: number;
  branches: { startX: number; startY: number; endX: number; endY: number }[];
}

export interface HeatShimmer {
  time: number;
  intensity: number;
}

// ============================================================================
// Weather Particle System State
// ============================================================================

export interface WeatherParticles {
  rainDrops: RainDrop[];
  snowFlakes: SnowFlake[];
  clouds: Cloud[];
  lightning: LightningFlash;
  heatShimmer: HeatShimmer;
}

// ============================================================================
// Particle Configuration
// ============================================================================

const RAIN_CONFIG = {
  maxParticles: 800,
  maxParticlesMobile: 300,
  baseSpeed: 800,
  speedVariation: 200,
  baseLength: 15,
  lengthVariation: 10,
  baseOpacity: 0.4,
  opacityVariation: 0.2,
  angle: Math.PI / 6, // Slight angle for wind effect
};

const SNOW_CONFIG = {
  maxParticles: 500,
  maxParticlesMobile: 200,
  baseSpeed: 60,
  speedVariation: 40,
  baseSize: 3,
  sizeVariation: 3,
  baseOpacity: 0.7,
  opacityVariation: 0.2,
  wobbleRange: 30,
  wobbleSpeed: 2,
};

const CLOUD_CONFIG = {
  maxClouds: 12,
  baseWidth: 200,
  widthVariation: 150,
  baseHeight: 60,
  heightVariation: 40,
  baseSpeed: 5,
  speedVariation: 8,
};

// ============================================================================
// Particle Creation
// ============================================================================

/**
 * Create initial weather particles based on weather type
 */
export function createWeatherParticles(
  weather: WeatherState,
  canvasWidth: number,
  canvasHeight: number,
  isMobile: boolean = false
): WeatherParticles {
  const particles: WeatherParticles = {
    rainDrops: [],
    snowFlakes: [],
    clouds: [],
    lightning: { active: false, intensity: 0, duration: 0, boltX: 0, boltY: 0, branches: [] },
    heatShimmer: { time: 0, intensity: 0 },
  };
  
  // Create clouds for cloudy/rainy/stormy/snowy weather
  if (weather.cloudCoverage > 0.2) {
    const cloudCount = Math.floor(CLOUD_CONFIG.maxClouds * weather.cloudCoverage);
    for (let i = 0; i < cloudCount; i++) {
      particles.clouds.push(createCloud(canvasWidth, canvasHeight));
    }
  }
  
  // Create rain drops
  if (weather.type === 'rain' || weather.type === 'storm') {
    const maxRain = isMobile ? RAIN_CONFIG.maxParticlesMobile : RAIN_CONFIG.maxParticles;
    const rainCount = Math.floor(maxRain * weather.intensity);
    for (let i = 0; i < rainCount; i++) {
      particles.rainDrops.push(createRainDrop(canvasWidth, canvasHeight));
    }
  }
  
  // Create snowflakes
  if (weather.type === 'snow') {
    const maxSnow = isMobile ? SNOW_CONFIG.maxParticlesMobile : SNOW_CONFIG.maxParticles;
    const snowCount = Math.floor(maxSnow * weather.intensity);
    for (let i = 0; i < snowCount; i++) {
      particles.snowFlakes.push(createSnowFlake(canvasWidth, canvasHeight));
    }
  }
  
  // Setup heat shimmer
  if (weather.type === 'heatwave') {
    particles.heatShimmer.intensity = weather.intensity;
  }
  
  return particles;
}

function createRainDrop(canvasWidth: number, canvasHeight: number): RainDrop {
  return {
    x: Math.random() * (canvasWidth + 200) - 100,
    y: Math.random() * canvasHeight - canvasHeight, // Start above screen
    speed: RAIN_CONFIG.baseSpeed + Math.random() * RAIN_CONFIG.speedVariation,
    length: RAIN_CONFIG.baseLength + Math.random() * RAIN_CONFIG.lengthVariation,
    opacity: RAIN_CONFIG.baseOpacity + Math.random() * RAIN_CONFIG.opacityVariation,
  };
}

function createSnowFlake(canvasWidth: number, canvasHeight: number): SnowFlake {
  return {
    x: Math.random() * canvasWidth,
    y: Math.random() * canvasHeight - canvasHeight, // Start above screen
    speed: SNOW_CONFIG.baseSpeed + Math.random() * SNOW_CONFIG.speedVariation,
    size: SNOW_CONFIG.baseSize + Math.random() * SNOW_CONFIG.sizeVariation,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: SNOW_CONFIG.wobbleSpeed + Math.random() * 2,
    opacity: SNOW_CONFIG.baseOpacity + Math.random() * SNOW_CONFIG.opacityVariation,
  };
}

function createCloud(canvasWidth: number, canvasHeight: number): Cloud {
  return {
    x: Math.random() * (canvasWidth + 400) - 200,
    y: Math.random() * (canvasHeight * 0.3), // Clouds in upper 30% of screen
    width: CLOUD_CONFIG.baseWidth + Math.random() * CLOUD_CONFIG.widthVariation,
    height: CLOUD_CONFIG.baseHeight + Math.random() * CLOUD_CONFIG.heightVariation,
    opacity: 0.3 + Math.random() * 0.4,
    speed: CLOUD_CONFIG.baseSpeed + Math.random() * CLOUD_CONFIG.speedVariation,
  };
}

// ============================================================================
// Particle Updates
// ============================================================================

/**
 * Update weather particles for animation
 */
export function updateWeatherParticles(
  particles: WeatherParticles,
  weather: WeatherState,
  delta: number,
  canvasWidth: number,
  canvasHeight: number,
  isMobile: boolean = false
): WeatherParticles {
  const updated = { ...particles };
  
  // Update rain drops
  if (weather.type === 'rain' || weather.type === 'storm') {
    updated.rainDrops = particles.rainDrops.map(drop => {
      const newY = drop.y + drop.speed * delta;
      const newX = drop.x + Math.sin(RAIN_CONFIG.angle) * drop.speed * delta * 0.3;
      
      // Reset if off screen
      if (newY > canvasHeight + 50 || newX > canvasWidth + 100) {
        return createRainDrop(canvasWidth, canvasHeight);
      }
      
      return { ...drop, x: newX, y: newY };
    });
    
    // Maintain particle count
    const maxRain = isMobile ? RAIN_CONFIG.maxParticlesMobile : RAIN_CONFIG.maxParticles;
    const targetCount = Math.floor(maxRain * weather.intensity);
    while (updated.rainDrops.length < targetCount) {
      updated.rainDrops.push(createRainDrop(canvasWidth, canvasHeight));
    }
  } else {
    updated.rainDrops = [];
  }
  
  // Update snowflakes
  if (weather.type === 'snow') {
    updated.snowFlakes = particles.snowFlakes.map(flake => {
      const newWobble = flake.wobble + flake.wobbleSpeed * delta;
      const wobbleX = Math.sin(newWobble) * SNOW_CONFIG.wobbleRange * delta;
      const newY = flake.y + flake.speed * delta;
      const newX = flake.x + wobbleX;
      
      // Reset if off screen
      if (newY > canvasHeight + 20) {
        return createSnowFlake(canvasWidth, canvasHeight);
      }
      
      return { ...flake, x: newX, y: newY, wobble: newWobble };
    });
    
    // Maintain particle count
    const maxSnow = isMobile ? SNOW_CONFIG.maxParticlesMobile : SNOW_CONFIG.maxParticles;
    const targetCount = Math.floor(maxSnow * weather.intensity);
    while (updated.snowFlakes.length < targetCount) {
      updated.snowFlakes.push(createSnowFlake(canvasWidth, canvasHeight));
    }
  } else {
    updated.snowFlakes = [];
  }
  
  // Update clouds
  updated.clouds = particles.clouds.map(cloud => {
    let newX = cloud.x + cloud.speed * delta;
    
    // Wrap around
    if (newX > canvasWidth + cloud.width) {
      newX = -cloud.width;
    }
    
    return { ...cloud, x: newX };
  });
  
  // Maintain cloud count based on coverage
  const targetClouds = Math.floor(CLOUD_CONFIG.maxClouds * weather.cloudCoverage);
  while (updated.clouds.length < targetClouds) {
    updated.clouds.push(createCloud(canvasWidth, canvasHeight));
  }
  while (updated.clouds.length > targetClouds) {
    updated.clouds.pop();
  }
  
  // Update lightning
  if (weather.type === 'storm' && weather.lightningTimer === 1) {
    // Trigger lightning flash
    updated.lightning = createLightningFlash(canvasWidth, canvasHeight);
  } else if (updated.lightning.active) {
    updated.lightning.duration -= delta;
    updated.lightning.intensity *= 0.9;
    if (updated.lightning.duration <= 0) {
      updated.lightning.active = false;
    }
  }
  
  // Update heat shimmer
  if (weather.type === 'heatwave') {
    updated.heatShimmer.time += delta;
    updated.heatShimmer.intensity = weather.intensity;
  } else {
    updated.heatShimmer.intensity = 0;
  }
  
  return updated;
}

function createLightningFlash(canvasWidth: number, canvasHeight: number): LightningFlash {
  const boltX = canvasWidth * (0.2 + Math.random() * 0.6);
  const boltY = 0;
  
  // Create lightning branches
  const branches: { startX: number; startY: number; endX: number; endY: number }[] = [];
  let currentX = boltX;
  let currentY = boltY;
  const targetY = canvasHeight * (0.4 + Math.random() * 0.3);
  
  while (currentY < targetY) {
    const segmentLength = 30 + Math.random() * 50;
    const newX = currentX + (Math.random() - 0.5) * 60;
    const newY = currentY + segmentLength;
    
    branches.push({
      startX: currentX,
      startY: currentY,
      endX: newX,
      endY: newY,
    });
    
    // Add small branches
    if (Math.random() < 0.4) {
      const branchLen = 20 + Math.random() * 30;
      const branchAngle = (Math.random() - 0.5) * Math.PI * 0.5;
      branches.push({
        startX: newX,
        startY: newY,
        endX: newX + Math.cos(branchAngle) * branchLen,
        endY: newY + Math.sin(branchAngle) * branchLen + branchLen * 0.5,
      });
    }
    
    currentX = newX;
    currentY = newY;
  }
  
  return {
    active: true,
    intensity: 1,
    duration: 0.15 + Math.random() * 0.1,
    boltX,
    boltY,
    branches,
  };
}

// ============================================================================
// Weather Rendering
// ============================================================================

/**
 * Draw weather overlay effects (clouds, atmospheric tint)
 */
export function drawWeatherOverlay(
  ctx: CanvasRenderingContext2D,
  weather: WeatherState,
  month: number,
  hour: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  const season = getSeasonFromMonth(month);
  
  // Draw atmospheric tint based on weather
  if (weather.type === 'storm') {
    // Dark stormy overlay
    ctx.fillStyle = `rgba(20, 25, 35, ${0.2 + weather.intensity * 0.15})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else if (weather.type === 'rain') {
    // Gray rainy overlay
    ctx.fillStyle = `rgba(60, 70, 80, ${0.1 + weather.intensity * 0.1})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else if (weather.type === 'snow') {
    // Slight white/blue tint for snow
    ctx.fillStyle = `rgba(200, 210, 230, ${0.05 + weather.intensity * 0.08})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else if (weather.type === 'heatwave') {
    // Slight yellow/orange tint for heat
    ctx.fillStyle = `rgba(255, 200, 100, ${0.05 + weather.intensity * 0.08})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
  
  // Draw day/night lighting
  const ambientLight = getAmbientLight(hour, season, weather.cloudCoverage);
  if (ambientLight < 0.9) {
    const darkness = 1 - ambientLight;
    // Blue-tinted darkness for night
    ctx.fillStyle = `rgba(10, 15, 40, ${darkness * 0.6})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
}

/**
 * Draw clouds
 */
export function drawClouds(
  ctx: CanvasRenderingContext2D,
  clouds: Cloud[],
  weather: WeatherState
): void {
  if (clouds.length === 0) return;
  
  // Cloud color based on weather
  let cloudColor: string;
  switch (weather.type) {
    case 'storm':
      cloudColor = '40, 45, 55';
      break;
    case 'rain':
      cloudColor = '100, 110, 120';
      break;
    case 'snow':
      cloudColor = '180, 190, 200';
      break;
    default:
      cloudColor = '220, 230, 240';
  }
  
  for (const cloud of clouds) {
    // Draw fluffy cloud shape using multiple ellipses
    ctx.fillStyle = `rgba(${cloudColor}, ${cloud.opacity})`;
    
    // Main body
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.width * 0.4, cloud.height * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Left bump
    ctx.beginPath();
    ctx.ellipse(cloud.x - cloud.width * 0.25, cloud.y + cloud.height * 0.1, cloud.width * 0.3, cloud.height * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Right bump
    ctx.beginPath();
    ctx.ellipse(cloud.x + cloud.width * 0.3, cloud.y - cloud.height * 0.05, cloud.width * 0.25, cloud.height * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Top bump
    ctx.beginPath();
    ctx.ellipse(cloud.x + cloud.width * 0.05, cloud.y - cloud.height * 0.25, cloud.width * 0.2, cloud.height * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw rain particles
 */
export function drawRain(
  ctx: CanvasRenderingContext2D,
  rainDrops: RainDrop[],
  weather: WeatherState
): void {
  if (rainDrops.length === 0) return;
  
  ctx.strokeStyle = `rgba(180, 200, 220, 0.6)`;
  ctx.lineWidth = 1;
  
  for (const drop of rainDrops) {
    ctx.globalAlpha = drop.opacity;
    ctx.beginPath();
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(
      drop.x + Math.sin(RAIN_CONFIG.angle) * drop.length * 0.3,
      drop.y + drop.length
    );
    ctx.stroke();
  }
  
  ctx.globalAlpha = 1;
}

/**
 * Draw snow particles
 */
export function drawSnow(
  ctx: CanvasRenderingContext2D,
  snowFlakes: SnowFlake[],
  weather: WeatherState
): void {
  if (snowFlakes.length === 0) return;
  
  ctx.fillStyle = '#ffffff';
  
  for (const flake of snowFlakes) {
    ctx.globalAlpha = flake.opacity;
    ctx.beginPath();
    ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.globalAlpha = 1;
}

/**
 * Draw lightning flash effect
 */
export function drawLightning(
  ctx: CanvasRenderingContext2D,
  lightning: LightningFlash,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (!lightning.active || lightning.intensity <= 0) return;
  
  // Screen flash
  ctx.fillStyle = `rgba(255, 255, 255, ${lightning.intensity * 0.3})`;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Draw lightning bolt
  ctx.strokeStyle = `rgba(255, 255, 255, ${lightning.intensity})`;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Main bolt and branches
  for (const branch of lightning.branches) {
    ctx.beginPath();
    ctx.moveTo(branch.startX, branch.startY);
    ctx.lineTo(branch.endX, branch.endY);
    ctx.stroke();
  }
  
  // Glow effect
  ctx.strokeStyle = `rgba(200, 220, 255, ${lightning.intensity * 0.5})`;
  ctx.lineWidth = 8;
  
  for (const branch of lightning.branches) {
    ctx.beginPath();
    ctx.moveTo(branch.startX, branch.startY);
    ctx.lineTo(branch.endX, branch.endY);
    ctx.stroke();
  }
}

/**
 * Draw heat shimmer effect (distortion overlay)
 */
export function drawHeatShimmer(
  ctx: CanvasRenderingContext2D,
  shimmer: HeatShimmer,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (shimmer.intensity <= 0) return;
  
  // Draw wavy distortion lines to simulate heat rising
  const waveCount = 8;
  const waveHeight = 4 * shimmer.intensity;
  
  ctx.strokeStyle = `rgba(255, 230, 180, ${0.1 * shimmer.intensity})`;
  ctx.lineWidth = 2;
  
  for (let i = 0; i < waveCount; i++) {
    const baseY = canvasHeight * (0.4 + i * 0.08);
    ctx.beginPath();
    
    for (let x = 0; x < canvasWidth; x += 10) {
      const y = baseY + Math.sin((x * 0.02) + shimmer.time * 2 + i) * waveHeight;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
  }
}

// ============================================================================
// Snow Accumulation on Tiles
// ============================================================================

/**
 * Draw snow accumulation on a tile
 * Called during tile rendering when there's snow accumulation
 */
export function drawSnowOnTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  accumulation: number,
  tileWidth: number = TILE_WIDTH,
  tileHeight: number = TILE_HEIGHT
): void {
  if (accumulation <= 0.05) return;
  
  const opacity = Math.min(0.8, accumulation);
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  
  // Draw snow layer on top of tile
  ctx.fillStyle = `rgba(250, 252, 255, ${opacity})`;
  ctx.beginPath();
  ctx.moveTo(x + halfW, y);                    // Top
  ctx.lineTo(x + tileWidth, y + halfH);       // Right
  ctx.lineTo(x + halfW, y + tileHeight);       // Bottom
  ctx.lineTo(x, y + halfH);                   // Left
  ctx.closePath();
  ctx.fill();
  
  // Add subtle snow texture/highlights
  if (accumulation > 0.3) {
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
    
    // Random snow bumps
    const seed = (x * 31 + y * 17) % 100;
    for (let i = 0; i < 3; i++) {
      const offsetX = ((seed + i * 37) % 50) - 25;
      const offsetY = ((seed + i * 23) % 30) - 15;
      ctx.beginPath();
      ctx.ellipse(
        x + halfW + offsetX * 0.3,
        y + halfH + offsetY * 0.3,
        8 * accumulation,
        4 * accumulation,
        0, 0, Math.PI * 2
      );
      ctx.fill();
    }
  }
}

/**
 * Draw snow accumulation on a road tile
 */
export function drawSnowOnRoad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  accumulation: number,
  tileWidth: number = TILE_WIDTH,
  tileHeight: number = TILE_HEIGHT
): void {
  if (accumulation <= 0.1) return;
  
  // Roads have less snow accumulation (plowed)
  const roadAccumulation = accumulation * 0.4;
  const opacity = Math.min(0.5, roadAccumulation);
  
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  
  // Draw patches of snow on road edges
  ctx.fillStyle = `rgba(240, 245, 250, ${opacity})`;
  
  // Snow along edges
  ctx.beginPath();
  ctx.moveTo(x + halfW * 0.3, y + halfH * 0.7);
  ctx.lineTo(x + halfW * 0.7, y + halfH * 0.3);
  ctx.lineTo(x + halfW * 0.9, y + halfH * 0.5);
  ctx.lineTo(x + halfW * 0.5, y + halfH * 0.9);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(x + halfW * 1.3, y + halfH * 0.7);
  ctx.lineTo(x + halfW * 1.7, y + halfH * 1.1);
  ctx.lineTo(x + halfW * 1.5, y + halfH * 1.3);
  ctx.lineTo(x + halfW * 1.1, y + halfH * 0.9);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw snow caps on building tops
 * Called when rendering buildings with snow accumulation
 */
export function drawSnowOnBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  buildingWidth: number,
  buildingHeight: number,
  accumulation: number
): void {
  if (accumulation <= 0.15) return;
  
  const opacity = Math.min(0.85, accumulation);
  const snowDepth = 4 + accumulation * 8;
  
  // Draw snow on roof
  ctx.fillStyle = `rgba(250, 252, 255, ${opacity})`;
  
  // Simple snow cap shape on top of building
  const roofY = y - buildingHeight * 0.8;
  const centerX = x + buildingWidth / 2;
  
  ctx.beginPath();
  ctx.moveTo(centerX, roofY - snowDepth);
  ctx.lineTo(x + buildingWidth * 0.9, roofY + buildingHeight * 0.1);
  ctx.lineTo(centerX, roofY + buildingHeight * 0.2 + snowDepth);
  ctx.lineTo(x + buildingWidth * 0.1, roofY + buildingHeight * 0.1);
  ctx.closePath();
  ctx.fill();
  
  // Snow edge drips
  if (accumulation > 0.4) {
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.6})`;
    for (let i = 0; i < 3; i++) {
      const dripX = x + buildingWidth * (0.2 + i * 0.3);
      const dripY = roofY + buildingHeight * 0.15;
      ctx.beginPath();
      ctx.ellipse(dripX, dripY + snowDepth * 0.5, 3, snowDepth * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================================
// Weather Icons for UI
// ============================================================================

/**
 * Draw a weather icon on canvas (for UI display)
 */
export function drawWeatherIcon(
  ctx: CanvasRenderingContext2D,
  type: WeatherType,
  x: number,
  y: number,
  size: number
): void {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size * 0.35;
  
  ctx.save();
  
  switch (type) {
    case 'clear':
      // Sun
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Sun rays
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const innerR = radius * 1.3;
        const outerR = radius * 1.7;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * innerR, centerY + Math.sin(angle) * innerR);
        ctx.lineTo(centerX + Math.cos(angle) * outerR, centerY + Math.sin(angle) * outerR);
        ctx.stroke();
      }
      break;
      
    case 'cloudy':
      // Cloud
      ctx.fillStyle = '#9ca3af';
      drawCloudShape(ctx, centerX - radius * 0.3, centerY, radius * 0.8);
      break;
      
    case 'rain':
      // Cloud with rain
      ctx.fillStyle = '#6b7280';
      drawCloudShape(ctx, centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.7);
      
      // Rain drops
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const dropX = centerX - radius * 0.4 + i * radius * 0.4;
        const dropY = centerY + radius * 0.3;
        ctx.beginPath();
        ctx.moveTo(dropX, dropY);
        ctx.lineTo(dropX - 2, dropY + radius * 0.5);
        ctx.stroke();
      }
      break;
      
    case 'storm':
      // Dark cloud with lightning
      ctx.fillStyle = '#374151';
      drawCloudShape(ctx, centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.7);
      
      // Lightning bolt
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + radius * 0.3, centerY + radius * 0.2);
      ctx.lineTo(centerX + radius * 0.1, centerY + radius * 0.3);
      ctx.lineTo(centerX + radius * 0.4, centerY + radius * 0.7);
      ctx.lineTo(centerX - radius * 0.1, centerY + radius * 0.3);
      ctx.lineTo(centerX + radius * 0.1, centerY + radius * 0.2);
      ctx.closePath();
      ctx.fill();
      break;
      
    case 'snow':
      // Cloud with snowflakes
      ctx.fillStyle = '#d1d5db';
      drawCloudShape(ctx, centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.7);
      
      // Snowflakes
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) {
        const flakeX = centerX - radius * 0.4 + i * radius * 0.4;
        const flakeY = centerY + radius * 0.4 + (i % 2) * radius * 0.2;
        ctx.beginPath();
        ctx.arc(flakeX, flakeY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
      
    case 'heatwave':
      // Thermometer
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(centerX, centerY + radius * 0.5, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(centerX - radius * 0.12, centerY - radius * 0.6, radius * 0.24, radius * 1.1);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(centerX - radius * 0.06, centerY - radius * 0.5, radius * 0.12, radius * 0.4);
      break;
  }
  
  ctx.restore();
}

function drawCloudShape(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.4, y - size * 0.1, size * 0.4, 0, Math.PI * 2);
  ctx.arc(x + size * 0.8, y, size * 0.35, 0, Math.PI * 2);
  ctx.arc(x + size * 0.5, y + size * 0.2, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
}
