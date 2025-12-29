/**
 * Enhanced Water Rendering System
 * 
 * Provides beautiful animated water with:
 * - Multi-layer wave animation
 * - Foam and spray on coastlines
 * - Depth-based color variation
 * - Caustic light patterns
 * - Reflection hints
 */

import { createNoise2D, createNoise3D } from 'simplex-noise';

// Create noise generators for water effects
const waveNoise2D = createNoise2D();
const waveNoise3D = createNoise3D();
const foamNoise = createNoise2D();
const causticNoise = createNoise3D();

// Water color palette - deep ocean to shallow
const WATER_COLORS = {
  deepOcean: { r: 20, g: 60, b: 120 },
  midWater: { r: 30, g: 90, b: 150 },
  shallow: { r: 50, g: 130, b: 180 },
  coastline: { r: 80, g: 170, b: 200 },
  highlight: { r: 180, g: 220, b: 255 },
  foam: { r: 240, g: 250, b: 255 },
  caustic: { r: 200, g: 230, b: 255 },
};

// Wave configuration
const WAVE_LAYERS = [
  { scale: 0.08, speed: 0.8, amplitude: 0.15 },
  { scale: 0.15, speed: 1.2, amplitude: 0.10 },
  { scale: 0.25, speed: 1.8, amplitude: 0.05 },
];

interface WaterRenderOptions {
  time: number;
  tileWidth: number;
  tileHeight: number;
  depth?: number; // 0 = shallow coastline, 1 = deep ocean
  hasCoastNorth?: boolean;
  hasCoastEast?: boolean;
  hasCoastSouth?: boolean;
  hasCoastWest?: boolean;
}

/**
 * Calculate water depth based on distance from coastline
 */
export function calculateWaterDepth(
  gridX: number,
  gridY: number,
  gridSize: number,
  isWater: (x: number, y: number) => boolean
): number {
  // Count water neighbors (cardinal + diagonal)
  let waterNeighbors = 0;
  let totalNeighbors = 0;
  
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      
      const nx = gridX + dx;
      const ny = gridY + dy;
      
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
        totalNeighbors++;
        if (isWater(nx, ny)) {
          waterNeighbors++;
        }
      }
    }
  }
  
  // Deep water if surrounded by water, shallow if near coast
  return totalNeighbors > 0 ? waterNeighbors / totalNeighbors : 0;
}

/**
 * Get wave height at a specific position and time
 */
function getWaveHeight(x: number, y: number, time: number): number {
  let height = 0;
  
  for (const layer of WAVE_LAYERS) {
    // Use 3D noise (x, y, time) for animated waves
    const noiseVal = waveNoise3D(
      x * layer.scale,
      y * layer.scale,
      time * layer.speed
    );
    height += noiseVal * layer.amplitude;
  }
  
  return height;
}

/**
 * Get foam intensity at a position (used near coastlines)
 */
function getFoamIntensity(x: number, y: number, time: number, distToCoast: number): number {
  if (distToCoast > 0.5) return 0;
  
  // Base foam pattern
  const baseNoise = foamNoise(x * 0.3, y * 0.3 + time * 0.5);
  const detailNoise = foamNoise(x * 0.8, y * 0.8 + time * 1.2);
  
  // Wave-synchronized foam (more foam at wave peaks)
  const waveHeight = getWaveHeight(x, y, time);
  const waveFoam = Math.max(0, waveHeight + 0.1) * 2;
  
  // Combine noises with distance falloff
  const coastFactor = Math.pow(1 - distToCoast * 2, 2);
  const foamPattern = (baseNoise * 0.6 + detailNoise * 0.4 + 0.5) * coastFactor;
  
  return Math.min(1, foamPattern + waveFoam * coastFactor * 0.5);
}

/**
 * Get caustic light pattern intensity
 */
function getCausticIntensity(x: number, y: number, time: number): number {
  // Multiple overlapping caustic patterns at different scales
  const c1 = causticNoise(x * 0.12, y * 0.12, time * 0.4);
  const c2 = causticNoise(x * 0.2, y * 0.2, time * 0.6 + 100);
  const c3 = causticNoise(x * 0.35, y * 0.35, time * 0.9 + 200);
  
  // Combine and normalize
  const combined = (c1 + c2 * 0.7 + c3 * 0.4) / 2.1;
  
  // Sharpen the caustic lines
  return Math.pow(Math.max(0, combined + 0.3), 2);
}

/**
 * Interpolate between two colors
 */
function lerpColor(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }, t: number): { r: number; g: number; b: number } {
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
  };
}

/**
 * Get water color based on depth and wave state
 */
function getWaterColor(depth: number, waveHeight: number, causticIntensity: number): string {
  // Base color by depth
  let baseColor: { r: number; g: number; b: number };
  if (depth < 0.3) {
    baseColor = lerpColor(WATER_COLORS.coastline, WATER_COLORS.shallow, depth / 0.3);
  } else if (depth < 0.6) {
    baseColor = lerpColor(WATER_COLORS.shallow, WATER_COLORS.midWater, (depth - 0.3) / 0.3);
  } else {
    baseColor = lerpColor(WATER_COLORS.midWater, WATER_COLORS.deepOcean, (depth - 0.6) / 0.4);
  }
  
  // Add wave highlight
  const highlightFactor = Math.max(0, waveHeight + 0.05) * 0.5;
  if (highlightFactor > 0) {
    baseColor = lerpColor(baseColor, WATER_COLORS.highlight, highlightFactor);
  }
  
  // Add caustic shimmer
  if (causticIntensity > 0) {
    baseColor = lerpColor(baseColor, WATER_COLORS.caustic, causticIntensity * 0.3);
  }
  
  return `rgb(${baseColor.r}, ${baseColor.g}, ${baseColor.b})`;
}

/**
 * Draw a single enhanced water tile
 */
export function drawEnhancedWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  options: WaterRenderOptions
): void {
  const { time, tileWidth, tileHeight, depth = 0.5 } = options;
  const w = tileWidth;
  const h = tileHeight;
  
  // Check for adjacent coastlines
  const hasCoast = options.hasCoastNorth || options.hasCoastEast || 
                   options.hasCoastSouth || options.hasCoastWest;
  
  // Create clipping path for isometric tile
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.clip();
  
  // Render water in multiple passes for detail
  const resolution = 4; // How many points to sample per tile dimension
  const stepX = w / resolution;
  const stepY = h / resolution;
  
  // Base water layer
  for (let py = 0; py < resolution; py++) {
    for (let px = 0; px < resolution; px++) {
      const localX = screenX + px * stepX;
      const localY = screenY + py * stepY;
      const worldX = gridX + px / resolution;
      const worldY = gridY + py / resolution;
      
      // Calculate local depth (darker towards center)
      const edgeDistX = Math.min(px, resolution - 1 - px) / resolution;
      const edgeDistY = Math.min(py, resolution - 1 - py) / resolution;
      const localDepth = depth * (0.7 + Math.min(edgeDistX, edgeDistY) * 0.6);
      
      // Get wave and caustic values
      const waveHeight = getWaveHeight(worldX, worldY, time);
      const causticIntensity = getCausticIntensity(worldX, worldY, time);
      
      // Get color
      const color = getWaterColor(localDepth, waveHeight, causticIntensity);
      
      // Draw cell
      ctx.fillStyle = color;
      ctx.fillRect(localX, localY, stepX + 1, stepY + 1);
    }
  }
  
  // Wave lines (subtle darker lines following wave patterns)
  ctx.strokeStyle = 'rgba(0, 30, 60, 0.15)';
  ctx.lineWidth = 0.5;
  
  for (let i = 0; i < 3; i++) {
    const waveOffset = time * 0.8 + i * 0.5;
    const waveY = screenY + h * 0.3 + i * h * 0.2;
    
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const noiseVal = waveNoise2D((gridX + x / w) * 0.5, waveOffset);
      const y = waveY + noiseVal * 3;
      
      if (x === 0) {
        ctx.moveTo(screenX + x, y);
      } else {
        ctx.lineTo(screenX + x, y);
      }
    }
    ctx.stroke();
  }
  
  // Specular highlights (sun reflection)
  const highlightX = screenX + w * 0.4 + Math.sin(time * 0.3) * w * 0.1;
  const highlightY = screenY + h * 0.35 + Math.cos(time * 0.4) * h * 0.1;
  
  const highlightGradient = ctx.createRadialGradient(
    highlightX, highlightY, 0,
    highlightX, highlightY, w * 0.2
  );
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  highlightGradient.addColorStop(0.5, 'rgba(200, 230, 255, 0.15)');
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = highlightGradient;
  ctx.fillRect(screenX, screenY, w, h);
  
  // Draw foam on coastlines
  if (hasCoast) {
    drawFoamLayer(ctx, screenX, screenY, gridX, gridY, options);
  }
  
  ctx.restore();
}

/**
 * Draw foam layer near coastlines
 */
function drawFoamLayer(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  options: WaterRenderOptions
): void {
  const { time, tileWidth: w, tileHeight: h } = options;
  
  // Foam particles along coastlines
  const foamCount = 12;
  
  ctx.fillStyle = 'rgba(240, 250, 255, 0.8)';
  
  for (let i = 0; i < foamCount; i++) {
    // Deterministic but animated foam position
    const seed = (gridX * 1000 + gridY * 100 + i) * 0.1;
    const noiseX = foamNoise(seed, time * 0.5);
    const noiseY = foamNoise(seed + 100, time * 0.5);
    
    let fx = screenX + w / 2;
    let fy = screenY + h / 2;
    
    // Position foam near coast edges
    if (options.hasCoastNorth) {
      fx = screenX + w * (0.2 + i * 0.06);
      fy = screenY + h * 0.15 + noiseY * 5;
    } else if (options.hasCoastEast) {
      fx = screenX + w * 0.85 + noiseX * 5;
      fy = screenY + h * (0.2 + i * 0.06);
    } else if (options.hasCoastSouth) {
      fx = screenX + w * (0.2 + i * 0.06);
      fy = screenY + h * 0.85 + noiseY * 5;
    } else if (options.hasCoastWest) {
      fx = screenX + w * 0.15 + noiseX * 5;
      fy = screenY + h * (0.2 + i * 0.06);
    }
    
    // Foam bubble size varies with time
    const size = 1.5 + Math.sin(time * 2 + seed) * 0.8;
    const alpha = 0.4 + Math.sin(time * 3 + seed * 2) * 0.3;
    
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(fx, fy, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.globalAlpha = 1;
  
  // Foam wave line near coast
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  
  const wavePhase = time * 1.5;
  const waveOffset = Math.sin(wavePhase) * 3;
  
  if (options.hasCoastNorth) {
    ctx.beginPath();
    ctx.moveTo(screenX + w * 0.2, screenY + h * 0.2 + waveOffset);
    ctx.quadraticCurveTo(
      screenX + w * 0.5, screenY + h * 0.1 + waveOffset,
      screenX + w * 0.8, screenY + h * 0.2 + waveOffset
    );
    ctx.stroke();
  }
  
  if (options.hasCoastSouth) {
    ctx.beginPath();
    ctx.moveTo(screenX + w * 0.2, screenY + h * 0.8 - waveOffset);
    ctx.quadraticCurveTo(
      screenX + w * 0.5, screenY + h * 0.9 - waveOffset,
      screenX + w * 0.8, screenY + h * 0.8 - waveOffset
    );
    ctx.stroke();
  }
  
  if (options.hasCoastEast) {
    ctx.beginPath();
    ctx.moveTo(screenX + w * 0.8 - waveOffset, screenY + h * 0.2);
    ctx.quadraticCurveTo(
      screenX + w * 0.9 - waveOffset, screenY + h * 0.5,
      screenX + w * 0.8 - waveOffset, screenY + h * 0.8
    );
    ctx.stroke();
  }
  
  if (options.hasCoastWest) {
    ctx.beginPath();
    ctx.moveTo(screenX + w * 0.2 + waveOffset, screenY + h * 0.2);
    ctx.quadraticCurveTo(
      screenX + w * 0.1 + waveOffset, screenY + h * 0.5,
      screenX + w * 0.2 + waveOffset, screenY + h * 0.8
    );
    ctx.stroke();
  }
}

/**
 * Draw enhanced animated beach on water tile edges
 */
export function drawEnhancedBeach(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  time: number,
  tileWidth: number,
  tileHeight: number,
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean }
): void {
  const w = tileWidth;
  const h = tileHeight;
  
  // Enhanced sand colors with gradient
  const sandColors = [
    'rgba(236, 220, 190, 0.95)',
    'rgba(220, 200, 165, 0.9)',
    'rgba(200, 180, 150, 0.85)',
  ];
  
  // Wave animation
  const wavePhase = time * 2;
  const waveOffset = Math.sin(wavePhase) * 1.5;
  
  ctx.save();
  
  // Draw beach on each edge with land
  if (adjacentLand.north) {
    // Top-left edge
    const gradient = ctx.createLinearGradient(
      screenX, screenY + h * 0.25,
      screenX + w * 0.5, screenY + h * 0.5
    );
    gradient.addColorStop(0, sandColors[0]);
    gradient.addColorStop(0.4, sandColors[1]);
    gradient.addColorStop(0.7, sandColors[2]);
    gradient.addColorStop(1, 'rgba(180, 160, 130, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(screenX + w / 2, screenY);
    ctx.lineTo(screenX, screenY + h / 2);
    ctx.lineTo(screenX + w * 0.15, screenY + h * 0.4 + waveOffset);
    ctx.lineTo(screenX + w * 0.35, screenY + h * 0.15 + waveOffset * 0.5);
    ctx.closePath();
    ctx.fill();
    
    // Wet sand line
    ctx.strokeStyle = 'rgba(160, 140, 110, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(screenX + w * 0.12, screenY + h * 0.42 + waveOffset);
    ctx.lineTo(screenX + w * 0.38, screenY + h * 0.12 + waveOffset * 0.5);
    ctx.stroke();
  }
  
  if (adjacentLand.east) {
    // Top-right edge
    const gradient = ctx.createLinearGradient(
      screenX + w, screenY + h * 0.25,
      screenX + w * 0.5, screenY + h * 0.5
    );
    gradient.addColorStop(0, sandColors[0]);
    gradient.addColorStop(0.4, sandColors[1]);
    gradient.addColorStop(0.7, sandColors[2]);
    gradient.addColorStop(1, 'rgba(180, 160, 130, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(screenX + w / 2, screenY);
    ctx.lineTo(screenX + w, screenY + h / 2);
    ctx.lineTo(screenX + w * 0.85, screenY + h * 0.4 - waveOffset);
    ctx.lineTo(screenX + w * 0.65, screenY + h * 0.15 - waveOffset * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  
  if (adjacentLand.south) {
    // Bottom-right edge
    const gradient = ctx.createLinearGradient(
      screenX + w, screenY + h * 0.75,
      screenX + w * 0.5, screenY + h * 0.5
    );
    gradient.addColorStop(0, sandColors[0]);
    gradient.addColorStop(0.4, sandColors[1]);
    gradient.addColorStop(0.7, sandColors[2]);
    gradient.addColorStop(1, 'rgba(180, 160, 130, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(screenX + w / 2, screenY + h);
    ctx.lineTo(screenX + w, screenY + h / 2);
    ctx.lineTo(screenX + w * 0.85, screenY + h * 0.6 - waveOffset);
    ctx.lineTo(screenX + w * 0.65, screenY + h * 0.85 - waveOffset * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  
  if (adjacentLand.west) {
    // Bottom-left edge
    const gradient = ctx.createLinearGradient(
      screenX, screenY + h * 0.75,
      screenX + w * 0.5, screenY + h * 0.5
    );
    gradient.addColorStop(0, sandColors[0]);
    gradient.addColorStop(0.4, sandColors[1]);
    gradient.addColorStop(0.7, sandColors[2]);
    gradient.addColorStop(1, 'rgba(180, 160, 130, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(screenX + w / 2, screenY + h);
    ctx.lineTo(screenX, screenY + h / 2);
    ctx.lineTo(screenX + w * 0.15, screenY + h * 0.6 + waveOffset);
    ctx.lineTo(screenX + w * 0.35, screenY + h * 0.85 + waveOffset * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  
  ctx.restore();
}
