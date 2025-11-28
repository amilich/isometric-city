/**
 * Weather rendering system for IsoCity
 * Handles visual effects for rain, snow, lightning, clouds, and heat
 */

import { WeatherState, WeatherType } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';
import { gridToScreen } from './utils';

// Rain particle type
export type RainParticle = {
  x: number;
  y: number;
  speed: number;
  length: number;
};

// Snow particle type
export type SnowParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
};

// Cloud type
export type Cloud = {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
};

// Lightning flash
export type LightningFlash = {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  intensity: number;
};

// Weather particle system state
export interface WeatherParticles {
  rain: RainParticle[];
  snow: SnowParticle[];
  clouds: Cloud[];
  lightning: LightningFlash[];
  lastUpdate: number;
}

// Initialize weather particles
export function initializeWeatherParticles(
  weather: WeatherState,
  canvasWidth: number,
  canvasHeight: number
): WeatherParticles {
  const particles: WeatherParticles = {
    rain: [],
    snow: [],
    clouds: [],
    lightning: [],
    lastUpdate: performance.now(),
  };

  // Initialize based on weather type
  if (weather.currentWeather === 'rain' || weather.currentWeather === 'lightning') {
    // Create rain particles
    const rainCount = Math.floor(canvasWidth * canvasHeight * 0.0003 * weather.intensity);
    for (let i = 0; i < rainCount; i++) {
      particles.rain.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        speed: 200 + Math.random() * 300 * weather.intensity,
        length: 5 + Math.random() * 10 * weather.intensity,
      });
    }
  }

  if (weather.currentWeather === 'snow') {
    // Create snow particles
    const snowCount = Math.floor(canvasWidth * canvasHeight * 0.0002 * weather.intensity);
    for (let i = 0; i < snowCount; i++) {
      particles.snow.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        vx: (Math.random() - 0.5) * 20,
        vy: 30 + Math.random() * 40 * weather.intensity,
        size: 2 + Math.random() * 3,
        opacity: 0.6 + Math.random() * 0.4,
      });
    }
  }

  // Create clouds based on cloud cover
  if (weather.cloudCover > 0.2) {
    const cloudCount = Math.floor(weather.cloudCover * 15);
    for (let i = 0; i < cloudCount; i++) {
      particles.clouds.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight * 0.3, // Clouds in upper portion
        size: 80 + Math.random() * 120,
        opacity: 0.3 + weather.cloudCover * 0.4,
        speed: 5 + Math.random() * 10,
      });
    }
  }

  return particles;
}

// Update weather particles
export function updateWeatherParticles(
  particles: WeatherParticles,
  weather: WeatherState,
  canvasWidth: number,
  canvasHeight: number,
  delta: number
): WeatherParticles {
  const now = performance.now();
  const timeDelta = (now - particles.lastUpdate) / 1000;
  particles.lastUpdate = now;

  // Update rain particles
  if (weather.currentWeather === 'rain' || weather.currentWeather === 'lightning') {
    particles.rain = particles.rain.map((particle) => {
      let newY = particle.y + particle.speed * delta;
      if (newY > canvasHeight) {
        newY = -10; // Reset to top
        particle.x = Math.random() * canvasWidth;
      }
      return { ...particle, y: newY };
    });

    // Maintain particle count
    const targetCount = Math.floor(canvasWidth * canvasHeight * 0.0003 * weather.intensity);
    while (particles.rain.length < targetCount) {
      particles.rain.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        speed: 200 + Math.random() * 300 * weather.intensity,
        length: 5 + Math.random() * 10 * weather.intensity,
      });
    }
    while (particles.rain.length > targetCount) {
      particles.rain.pop();
    }
  } else {
    particles.rain = [];
  }

  // Update snow particles
  if (weather.currentWeather === 'snow') {
    particles.snow = particles.snow.map((particle) => {
      let newX = particle.x + particle.vx * delta;
      let newY = particle.y + particle.vy * delta;
      
      if (newY > canvasHeight) {
        newY = -10;
        newX = Math.random() * canvasWidth;
      }
      if (newX < 0) newX = canvasWidth;
      if (newX > canvasWidth) newX = 0;
      
      return { ...particle, x: newX, y: newY };
    });

    // Maintain particle count
    const targetCount = Math.floor(canvasWidth * canvasHeight * 0.0002 * weather.intensity);
    while (particles.snow.length < targetCount) {
      particles.snow.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        vx: (Math.random() - 0.5) * 20,
        vy: 30 + Math.random() * 40 * weather.intensity,
        size: 2 + Math.random() * 3,
        opacity: 0.6 + Math.random() * 0.4,
      });
    }
    while (particles.snow.length > targetCount) {
      particles.snow.pop();
    }
  } else {
    particles.snow = [];
  }

  // Update clouds
  if (weather.cloudCover > 0.2) {
    particles.clouds = particles.clouds.map((cloud) => {
      let newX = cloud.x + cloud.speed * delta;
      if (newX > canvasWidth + cloud.size) {
        newX = -cloud.size;
      }
      return { ...cloud, x: newX };
    });

    // Maintain cloud count
    const targetCount = Math.floor(weather.cloudCover * 15);
    while (particles.clouds.length < targetCount) {
      particles.clouds.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight * 0.3,
        size: 80 + Math.random() * 120,
        opacity: 0.3 + weather.cloudCover * 0.4,
        speed: 5 + Math.random() * 10,
      });
    }
    while (particles.clouds.length > targetCount) {
      particles.clouds.pop();
    }
  } else {
    particles.clouds = [];
  }

  // Update lightning flashes
  if (weather.currentWeather === 'lightning') {
    // Remove old flashes
    particles.lightning = particles.lightning.filter(
      (flash) => flash.age < flash.maxAge
    );

    // Spawn new lightning flashes occasionally
    if (Math.random() < weather.intensity * 0.02 * delta) {
      particles.lightning.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight * 0.5, // Upper half of screen
        age: 0,
        maxAge: 0.1 + Math.random() * 0.2, // Very brief flash
        intensity: 0.5 + Math.random() * 0.5,
      });
    }

    // Update existing flashes
    particles.lightning = particles.lightning.map((flash) => ({
      ...flash,
      age: flash.age + delta,
    }));
  } else {
    particles.lightning = [];
  }

  return particles;
}

// Draw weather effects on canvas
export function drawWeather(
  ctx: CanvasRenderingContext2D,
  weather: WeatherState,
  particles: WeatherParticles,
  offset: { x: number; y: number },
  zoom: number,
  canvasSize: { width: number; height: number }
): void {
  ctx.save();

  // Apply offset and zoom
  ctx.translate(offset.x, offset.y);
  ctx.scale(zoom, zoom);

  const dpr = window.devicePixelRatio || 1;
  const canvasWidth = canvasSize.width / (dpr * zoom);
  const canvasHeight = canvasSize.height / (dpr * zoom);

  // Draw clouds first (behind everything)
  if (particles.clouds.length > 0) {
    ctx.globalAlpha = 1;
    particles.clouds.forEach((cloud) => {
      ctx.fillStyle = `rgba(200, 200, 200, ${cloud.opacity})`;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.size * 0.3, 0, Math.PI * 2);
      ctx.arc(cloud.x + cloud.size * 0.3, cloud.y, cloud.size * 0.4, 0, Math.PI * 2);
      ctx.arc(cloud.x + cloud.size * 0.6, cloud.y, cloud.size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Draw lightning flashes (bright white overlay)
  if (particles.lightning.length > 0) {
    particles.lightning.forEach((flash) => {
      const alpha = (1 - flash.age / flash.maxAge) * flash.intensity * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    });
  }

  // Draw rain
  if (particles.rain.length > 0 && (weather.currentWeather === 'rain' || weather.currentWeather === 'lightning')) {
    ctx.strokeStyle = `rgba(150, 200, 255, ${0.4 + weather.intensity * 0.4})`;
    ctx.lineWidth = 1;
    particles.rain.forEach((particle) => {
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x, particle.y + particle.length);
      ctx.stroke();
    });
  }

  // Draw snow
  if (particles.snow.length > 0 && weather.currentWeather === 'snow') {
    particles.snow.forEach((particle) => {
      ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Draw heat haze effect (subtle distortion/wave effect)
  if (weather.currentWeather === 'heat') {
    const hazeIntensity = weather.intensity * 0.3;
    ctx.globalAlpha = hazeIntensity;
    ctx.fillStyle = 'rgba(255, 200, 100, 0.1)';
    // Draw subtle gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, 'rgba(255, 200, 100, 0.05)');
    gradient.addColorStop(0.5, 'rgba(255, 200, 100, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 200, 100, 0.05)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  ctx.restore();
}

// Draw snow accumulation on roads and buildings
export function drawSnowAccumulation(
  ctx: CanvasRenderingContext2D,
  weather: WeatherState,
  grid: any[][],
  gridSize: number,
  offset: { x: number; y: number },
  zoom: number,
  visibleTiles: { minX: number; maxX: number; minY: number; maxY: number }
): void {
  if (weather.currentWeather !== 'snow' || weather.intensity < 0.3) return;

  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(zoom, zoom);

  const snowOpacity = Math.min(0.6, weather.intensity * 0.8);
  ctx.fillStyle = `rgba(255, 255, 255, ${snowOpacity})`;

  // Draw snow on roads
  for (let y = visibleTiles.minY; y <= visibleTiles.maxY; y++) {
    for (let x = visibleTiles.minX; x <= visibleTiles.maxX; x++) {
      if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
      
      const tile = grid[y][x];
      if (tile.building.type === 'road') {
        const { screenX, screenY } = gridToScreen(x, y, 0, 0);
        
        // Draw snow on top of road (top edge of isometric tile)
        ctx.beginPath();
        ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
        ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 4);
        ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
        ctx.lineTo(screenX, screenY + TILE_HEIGHT / 4);
        ctx.closePath();
        ctx.fill();
      }
      
      // Draw snow on building roofs (if building exists)
      if (tile.building.type !== 'grass' && 
          tile.building.type !== 'water' && 
          tile.building.type !== 'road' &&
          tile.building.type !== 'tree' &&
          tile.building.type !== 'empty') {
        const { screenX, screenY } = gridToScreen(x, y, 0, 0);
        
        // Draw snow on top edge of building
        ctx.beginPath();
        ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
        ctx.lineTo(screenX + TILE_WIDTH * 0.7, screenY + TILE_HEIGHT * 0.15);
        ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT * 0.2);
        ctx.lineTo(screenX + TILE_WIDTH * 0.3, screenY + TILE_HEIGHT * 0.15);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  ctx.restore();
}
