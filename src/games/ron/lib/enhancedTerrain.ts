/**
 * Enhanced Terrain Rendering System
 * 
 * Provides beautiful terrain with:
 * - Noise-based grass variation for natural appearance
 * - Enhanced forest rendering with varied tree types
 * - Realistic mountain rendering with snow caps
 * - Oil/resource deposits with dynamic effects
 * - Subtle terrain patterns and details
 */

import { createNoise2D } from 'simplex-noise';

// Create noise generators for terrain
const grassNoise = createNoise2D();
const grassDetailNoise = createNoise2D();
const forestNoise = createNoise2D();
const mountainNoise = createNoise2D();
const rockNoise = createNoise2D();

// Grass color palette
const GRASS_COLORS = {
  base: { r: 76, g: 139, b: 55 },
  light: { r: 98, g: 165, b: 72 },
  dark: { r: 55, g: 110, b: 40 },
  highlight: { r: 130, g: 190, b: 95 },
  shadow: { r: 40, g: 85, b: 30 },
  dry: { r: 145, g: 155, b: 75 },
  lush: { r: 65, g: 150, b: 50 },
};

// Mountain colors
const MOUNTAIN_COLORS = {
  rock: { r: 107, g: 114, b: 128 },
  darkRock: { r: 75, g: 85, b: 99 },
  lightRock: { r: 156, g: 163, b: 175 },
  snow: { r: 245, g: 245, b: 250 },
  snowShadow: { r: 200, g: 205, b: 220 },
  ore: { r: 40, g: 40, b: 50 },
  oreHighlight: { r: 100, g: 100, b: 120 },
};

// Tree colors by type
const TREE_COLORS = {
  pine: { trunk: '#4a3020', foliage: '#1a5c2a', foliageLight: '#2a7a3a' },
  oak: { trunk: '#5c4033', foliage: '#2d6b3d', foliageLight: '#4a8a5a' },
  birch: { trunk: '#e8e4d0', foliage: '#4a8a3a', foliageLight: '#6aaa5a' },
  autumn: { trunk: '#5c4033', foliage: '#c45c20', foliageLight: '#e08040' },
};

interface TerrainRenderOptions {
  time: number;
  tileWidth: number;
  tileHeight: number;
  zoom: number;
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
 * Draw enhanced grass tile with natural variation
 */
export function drawEnhancedGrassTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  options: TerrainRenderOptions
): void {
  const { tileWidth: w, tileHeight: h, zoom } = options;
  
  // Create clipping path for isometric tile
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.clip();
  
  // Get base terrain noise for variety
  const baseNoise = grassNoise(gridX * 0.15, gridY * 0.15);
  const detailNoise = grassDetailNoise(gridX * 0.5, gridY * 0.5);
  
  // Determine grass type (0 = dry, 0.5 = base, 1 = lush)
  const grassType = (baseNoise + 1) / 2;
  
  // Base grass color with variation
  let baseColor: { r: number; g: number; b: number };
  if (grassType < 0.3) {
    baseColor = lerpColor(GRASS_COLORS.dry, GRASS_COLORS.base, grassType / 0.3);
  } else if (grassType > 0.7) {
    baseColor = lerpColor(GRASS_COLORS.base, GRASS_COLORS.lush, (grassType - 0.7) / 0.3);
  } else {
    baseColor = GRASS_COLORS.base;
  }
  
  // Apply lighting (simulate sun from top-right)
  const lightFactor = 0.85 + detailNoise * 0.15;
  baseColor = {
    r: Math.min(255, Math.round(baseColor.r * lightFactor)),
    g: Math.min(255, Math.round(baseColor.g * lightFactor)),
    b: Math.min(255, Math.round(baseColor.b * lightFactor)),
  };
  
  // Draw base tile
  ctx.fillStyle = `rgb(${baseColor.r}, ${baseColor.g}, ${baseColor.b})`;
  ctx.fillRect(screenX, screenY, w, h);
  
  // Add subtle grass texture pattern
  if (zoom >= 0.6) {
    const patternDensity = Math.floor(8 * zoom);
    
    for (let py = 0; py < patternDensity; py++) {
      for (let px = 0; px < patternDensity; px++) {
        const localX = screenX + (px + 0.5) * (w / patternDensity);
        const localY = screenY + (py + 0.5) * (h / patternDensity);
        
        // Use noise to vary each grass tuft
        const tuftNoise = grassDetailNoise(
          gridX * 10 + px * 0.5,
          gridY * 10 + py * 0.5
        );
        
        if (tuftNoise > 0.2) {
          // Lighter grass tuft
          const tuftColor = lerpColor(baseColor, GRASS_COLORS.highlight, tuftNoise * 0.3);
          ctx.fillStyle = `rgba(${tuftColor.r}, ${tuftColor.g}, ${tuftColor.b}, 0.6)`;
          ctx.beginPath();
          ctx.arc(localX, localY, 1.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (tuftNoise < -0.2) {
          // Shadow/darker spot
          const shadowColor = lerpColor(baseColor, GRASS_COLORS.shadow, -tuftNoise * 0.3);
          ctx.fillStyle = `rgba(${shadowColor.r}, ${shadowColor.g}, ${shadowColor.b}, 0.5)`;
          ctx.beginPath();
          ctx.arc(localX, localY, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  
  // Add subtle grass blades at high zoom
  if (zoom >= 1.0) {
    const bladeCount = 6;
    ctx.strokeStyle = `rgba(${GRASS_COLORS.light.r}, ${GRASS_COLORS.light.g}, ${GRASS_COLORS.light.b}, 0.4)`;
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < bladeCount; i++) {
      const seed = (gridX * 1000 + gridY * 100 + i) * 0.1;
      const bladeX = screenX + w * (0.2 + grassNoise(seed, 0) * 0.3 + 0.3);
      const bladeY = screenY + h * (0.3 + grassNoise(0, seed) * 0.2 + 0.3);
      const bladeHeight = 3 + grassNoise(seed, seed) * 2;
      const bladeCurve = grassNoise(seed * 2, seed) * 2;
      
      ctx.beginPath();
      ctx.moveTo(bladeX, bladeY);
      ctx.quadraticCurveTo(bladeX + bladeCurve, bladeY - bladeHeight / 2, bladeX + bladeCurve * 0.5, bladeY - bladeHeight);
      ctx.stroke();
    }
  }
  
  // Draw subtle grid outline
  ctx.strokeStyle = 'rgba(50, 80, 40, 0.2)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Draw enhanced forest tile with varied trees
 */
export function drawEnhancedForest(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  forestDensity: number,
  options: TerrainRenderOptions
): void {
  const { tileWidth: w, tileHeight: h, time } = options;
  
  // First draw grass base
  drawEnhancedGrassTile(ctx, screenX, screenY, gridX, gridY, options);
  
  // Number of trees based on density
  const numTrees = Math.floor(3 + (forestDensity / 100) * 5);
  
  // Generate tree positions
  const trees: Array<{
    x: number;
    y: number;
    type: keyof typeof TREE_COLORS;
    size: number;
    depth: number;
  }> = [];
  
  for (let i = 0; i < numTrees; i++) {
    const seed = gridX * 1000 + gridY * 100 + i * 7;
    const noiseX = forestNoise(seed * 0.1, i * 0.5);
    const noiseY = forestNoise(i * 0.5, seed * 0.1);
    
    // Position within tile (isometric-aware)
    const tx = 0.2 + (noiseX + 1) * 0.3;
    const ty = 0.25 + (noiseY + 1) * 0.25;
    
    // Tree type based on noise
    const typeNoise = forestNoise(seed * 0.3, seed * 0.2);
    let treeType: keyof typeof TREE_COLORS = 'oak';
    if (typeNoise < -0.3) treeType = 'pine';
    else if (typeNoise > 0.3) treeType = 'birch';
    else if (typeNoise > 0.6) treeType = 'autumn';
    
    // Tree size variation
    const size = 0.4 + forestNoise(seed * 0.5, 0) * 0.2;
    
    trees.push({
      x: screenX + w * tx,
      y: screenY + h * ty,
      type: treeType,
      size,
      depth: ty, // For sorting (back to front)
    });
  }
  
  // Sort by depth (render back to front)
  trees.sort((a, b) => a.depth - b.depth);
  
  // Draw each tree
  for (const tree of trees) {
    drawTree(ctx, tree.x, tree.y, tree.type, tree.size, w, time);
  }
}

/**
 * Draw a single tree
 */
function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: keyof typeof TREE_COLORS,
  size: number,
  tileWidth: number,
  time: number
): void {
  const colors = TREE_COLORS[type];
  const baseSize = tileWidth * size * 0.5;
  
  // Slight wind sway
  const sway = Math.sin(time * 1.5 + x * 0.1) * 1;
  
  ctx.save();
  ctx.translate(x, y);
  
  // Tree shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.beginPath();
  ctx.ellipse(baseSize * 0.3, baseSize * 0.2, baseSize * 0.6, baseSize * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  
  if (type === 'pine') {
    // Pine tree - triangular layers
    // Trunk
    ctx.fillStyle = colors.trunk;
    ctx.fillRect(-baseSize * 0.1, -baseSize * 0.3, baseSize * 0.2, baseSize * 0.8);
    
    // Foliage layers (3 triangles)
    for (let layer = 0; layer < 3; layer++) {
      const layerY = -baseSize * (0.3 + layer * 0.5);
      const layerWidth = baseSize * (0.8 - layer * 0.15);
      const layerHeight = baseSize * 0.6;
      
      // Dark underside
      ctx.fillStyle = colors.foliage;
      ctx.beginPath();
      ctx.moveTo(sway, layerY - layerHeight);
      ctx.lineTo(-layerWidth / 2, layerY);
      ctx.lineTo(layerWidth / 2, layerY);
      ctx.closePath();
      ctx.fill();
      
      // Lighter top/right side
      ctx.fillStyle = colors.foliageLight;
      ctx.beginPath();
      ctx.moveTo(sway, layerY - layerHeight);
      ctx.lineTo(layerWidth / 2, layerY);
      ctx.lineTo(sway + layerWidth * 0.1, layerY - layerHeight * 0.3);
      ctx.closePath();
      ctx.fill();
    }
  } else if (type === 'birch') {
    // Birch tree - white trunk with round canopy
    // Trunk with birch marks
    ctx.fillStyle = colors.trunk;
    ctx.fillRect(-baseSize * 0.08, -baseSize * 0.2, baseSize * 0.16, baseSize * 0.7);
    
    // Birch marks
    ctx.fillStyle = '#2a2a2a';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-baseSize * 0.06, -baseSize * 0.1 + i * baseSize * 0.15, baseSize * 0.05, baseSize * 0.03);
    }
    
    // Round canopy
    ctx.fillStyle = colors.foliage;
    ctx.beginPath();
    ctx.ellipse(sway * 0.5, -baseSize * 0.7, baseSize * 0.5, baseSize * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight
    ctx.fillStyle = colors.foliageLight;
    ctx.beginPath();
    ctx.ellipse(sway * 0.5 + baseSize * 0.1, -baseSize * 0.8, baseSize * 0.25, baseSize * 0.3, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Oak/autumn - classic round tree
    // Trunk
    ctx.fillStyle = colors.trunk;
    ctx.beginPath();
    ctx.moveTo(-baseSize * 0.12, 0);
    ctx.lineTo(-baseSize * 0.08, -baseSize * 0.4);
    ctx.lineTo(baseSize * 0.08, -baseSize * 0.4);
    ctx.lineTo(baseSize * 0.12, 0);
    ctx.closePath();
    ctx.fill();
    
    // Main canopy (cloud-like shape)
    ctx.fillStyle = colors.foliage;
    
    // Multiple overlapping circles for organic shape
    const canopyCircles = [
      { x: 0, y: -baseSize * 0.7, r: baseSize * 0.4 },
      { x: -baseSize * 0.25, y: -baseSize * 0.6, r: baseSize * 0.3 },
      { x: baseSize * 0.25, y: -baseSize * 0.6, r: baseSize * 0.3 },
      { x: 0, y: -baseSize * 0.5, r: baseSize * 0.35 },
    ];
    
    for (const circle of canopyCircles) {
      ctx.beginPath();
      ctx.arc(circle.x + sway * 0.3, circle.y, circle.r, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Highlight circles
    ctx.fillStyle = colors.foliageLight;
    ctx.beginPath();
    ctx.arc(baseSize * 0.15 + sway * 0.3, -baseSize * 0.8, baseSize * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-baseSize * 0.1 + sway * 0.3, -baseSize * 0.65, baseSize * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Draw enhanced mountain/metal deposit tile
 */
export function drawEnhancedMountain(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  options: TerrainRenderOptions
): void {
  const { tileWidth: w, tileHeight: h } = options;
  
  ctx.save();
  
  // Clip to tile
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.clip();
  
  // Rocky base gradient
  const baseGradient = ctx.createLinearGradient(
    screenX, screenY,
    screenX + w, screenY + h
  );
  baseGradient.addColorStop(0, '#7a7a7a');
  baseGradient.addColorStop(0.5, '#6a6a6a');
  baseGradient.addColorStop(1, '#5a5a5a');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(screenX, screenY, w, h);
  
  // Generate mountain peaks
  const seed = gridX * 1000 + gridY;
  const numPeaks = 4 + Math.abs(mountainNoise(gridX * 0.3, gridY * 0.3)) * 3;
  
  interface Peak {
    x: number;
    baseY: number;
    peakY: number;
    width: number;
    hasSnow: boolean;
  }
  
  const peaks: Peak[] = [];
  
  for (let i = 0; i < numPeaks; i++) {
    const peakSeed = seed * 7 + i * 13;
    const noise1 = mountainNoise(peakSeed * 0.01, 0);
    const noise2 = mountainNoise(0, peakSeed * 0.01);
    
    peaks.push({
      x: screenX + w * (0.2 + noise1 * 0.3 + 0.3),
      baseY: screenY + h * (0.5 + noise2 * 0.2),
      peakY: screenY + h * (0.15 + Math.abs(noise1) * 0.2),
      width: w * (0.2 + Math.abs(noise2) * 0.15),
      hasSnow: noise1 > 0.1,
    });
  }
  
  // Sort by Y (back to front)
  peaks.sort((a, b) => a.baseY - b.baseY);
  
  // Draw each peak
  for (const peak of peaks) {
    // Left face (shadow)
    ctx.fillStyle = `rgb(${MOUNTAIN_COLORS.darkRock.r}, ${MOUNTAIN_COLORS.darkRock.g}, ${MOUNTAIN_COLORS.darkRock.b})`;
    ctx.beginPath();
    ctx.moveTo(peak.x, peak.peakY);
    ctx.lineTo(peak.x - peak.width * 0.5, peak.baseY);
    ctx.lineTo(peak.x, peak.baseY);
    ctx.closePath();
    ctx.fill();
    
    // Right face (lit)
    ctx.fillStyle = `rgb(${MOUNTAIN_COLORS.lightRock.r}, ${MOUNTAIN_COLORS.lightRock.g}, ${MOUNTAIN_COLORS.lightRock.b})`;
    ctx.beginPath();
    ctx.moveTo(peak.x, peak.peakY);
    ctx.lineTo(peak.x + peak.width * 0.5, peak.baseY);
    ctx.lineTo(peak.x, peak.baseY);
    ctx.closePath();
    ctx.fill();
    
    // Ridge line
    ctx.strokeStyle = 'rgba(40, 40, 50, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(peak.x, peak.peakY);
    ctx.lineTo(peak.x, peak.baseY);
    ctx.stroke();
    
    // Snow cap on taller peaks
    if (peak.hasSnow) {
      const snowHeight = (peak.baseY - peak.peakY) * 0.3;
      
      ctx.fillStyle = `rgb(${MOUNTAIN_COLORS.snow.r}, ${MOUNTAIN_COLORS.snow.g}, ${MOUNTAIN_COLORS.snow.b})`;
      ctx.beginPath();
      ctx.moveTo(peak.x, peak.peakY);
      ctx.lineTo(peak.x - peak.width * 0.15, peak.peakY + snowHeight);
      ctx.lineTo(peak.x + peak.width * 0.15, peak.peakY + snowHeight);
      ctx.closePath();
      ctx.fill();
      
      // Snow shadow
      ctx.fillStyle = `rgba(${MOUNTAIN_COLORS.snowShadow.r}, ${MOUNTAIN_COLORS.snowShadow.g}, ${MOUNTAIN_COLORS.snowShadow.b}, 0.5)`;
      ctx.beginPath();
      ctx.moveTo(peak.x, peak.peakY);
      ctx.lineTo(peak.x - peak.width * 0.12, peak.peakY + snowHeight * 0.8);
      ctx.lineTo(peak.x, peak.peakY + snowHeight * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  // Add ore deposits at base
  const numOres = 3 + Math.floor(Math.abs(rockNoise(gridX, gridY)) * 4);
  
  for (let i = 0; i < numOres; i++) {
    const oreSeed = seed * 11 + i * 17;
    const oreX = screenX + w * (0.2 + rockNoise(oreSeed * 0.1, 0) * 0.3 + 0.3);
    const oreY = screenY + h * (0.65 + rockNoise(0, oreSeed * 0.1) * 0.15);
    const oreSize = 2 + Math.abs(rockNoise(oreSeed, oreSeed)) * 2;
    
    // Dark ore body
    ctx.fillStyle = `rgb(${MOUNTAIN_COLORS.ore.r}, ${MOUNTAIN_COLORS.ore.g}, ${MOUNTAIN_COLORS.ore.b})`;
    ctx.beginPath();
    ctx.moveTo(oreX, oreY - oreSize);
    ctx.lineTo(oreX + oreSize, oreY);
    ctx.lineTo(oreX, oreY + oreSize);
    ctx.lineTo(oreX - oreSize, oreY);
    ctx.closePath();
    ctx.fill();
    
    // Metallic glint
    ctx.fillStyle = `rgba(${MOUNTAIN_COLORS.oreHighlight.r}, ${MOUNTAIN_COLORS.oreHighlight.g}, ${MOUNTAIN_COLORS.oreHighlight.b}, 0.7)`;
    ctx.beginPath();
    ctx.arc(oreX - oreSize * 0.3, oreY - oreSize * 0.3, oreSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Scattered rocks at base
  for (let i = 0; i < 8; i++) {
    const rockSeed = seed * 19 + i * 23;
    const rockX = screenX + w * (0.15 + rockNoise(rockSeed * 0.1, i) * 0.35 + 0.35);
    const rockY = screenY + h * (0.7 + rockNoise(i, rockSeed * 0.1) * 0.15);
    const rockSize = 1.5 + Math.abs(rockNoise(rockSeed, 0)) * 1.5;
    
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.arc(rockX, rockY, rockSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight
    ctx.fillStyle = '#9ca3af';
    ctx.beginPath();
    ctx.arc(rockX - rockSize * 0.2, rockY - rockSize * 0.2, rockSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Draw enhanced oil deposit with animated effects
 */
export function drawEnhancedOilDeposit(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  options: TerrainRenderOptions
): void {
  const { tileWidth: w, tileHeight: h, time } = options;
  
  // Draw grass base first
  drawEnhancedGrassTile(ctx, screenX, screenY, gridX, gridY, options);
  
  ctx.save();
  
  // Clip to tile
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.clip();
  
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  const seed = gridX * 31 + gridY * 17;
  
  // Generate oil pools
  const numPools = 3 + Math.floor(Math.abs(grassNoise(gridX, gridY)) * 3);
  
  for (let i = 0; i < numPools; i++) {
    const poolSeed = seed * 7 + i * 13;
    const noise1 = grassNoise(poolSeed * 0.01, 0);
    const noise2 = grassNoise(0, poolSeed * 0.01);
    
    const poolX = cx + noise1 * w * 0.25;
    const poolY = cy + noise2 * h * 0.2;
    const poolW = w * (0.12 + Math.abs(noise1) * 0.06);
    const poolH = h * (0.08 + Math.abs(noise2) * 0.04);
    const poolAngle = noise1 * 0.5;
    
    // Pool shadow
    ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
    ctx.beginPath();
    ctx.ellipse(poolX, poolY, poolW * 1.05, poolH * 1.05, poolAngle, 0, Math.PI * 2);
    ctx.fill();
    
    // Main oil pool
    const oilGradient = ctx.createRadialGradient(
      poolX - poolW * 0.3, poolY - poolH * 0.3, 0,
      poolX, poolY, poolW
    );
    oilGradient.addColorStop(0, 'rgba(40, 40, 50, 1)');
    oilGradient.addColorStop(0.5, 'rgba(20, 20, 30, 1)');
    oilGradient.addColorStop(1, 'rgba(10, 10, 15, 1)');
    
    ctx.fillStyle = oilGradient;
    ctx.beginPath();
    ctx.ellipse(poolX, poolY, poolW, poolH, poolAngle, 0, Math.PI * 2);
    ctx.fill();
    
    // Iridescent shimmer (rainbow oil effect)
    const shimmerPhase = time * 0.5 + i * 0.3;
    const shimmerHue = (shimmerPhase * 30) % 360;
    
    ctx.fillStyle = `hsla(${shimmerHue}, 50%, 40%, 0.3)`;
    ctx.beginPath();
    ctx.ellipse(
      poolX + Math.sin(shimmerPhase) * poolW * 0.2,
      poolY + Math.cos(shimmerPhase) * poolH * 0.2,
      poolW * 0.5,
      poolH * 0.4,
      poolAngle + shimmerPhase * 0.1,
      0,
      Math.PI * 2
    );
    ctx.fill();
    
    // Highlight reflection
    ctx.fillStyle = 'rgba(60, 60, 80, 0.4)';
    ctx.beginPath();
    ctx.ellipse(
      poolX - poolW * 0.25,
      poolY - poolH * 0.25,
      poolW * 0.25,
      poolH * 0.15,
      poolAngle,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  
  // Occasional bubbles
  const bubblePhase = (time * 2 + seed) % 3;
  if (bubblePhase < 0.5) {
    const bubbleX = cx + grassNoise(time, seed) * w * 0.2;
    const bubbleY = cy + grassNoise(seed, time) * h * 0.15;
    const bubbleSize = 1.5 + bubblePhase * 2;
    
    ctx.fillStyle = 'rgba(40, 40, 50, 0.6)';
    ctx.beginPath();
    ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(80, 80, 100, 0.4)';
    ctx.beginPath();
    ctx.arc(bubbleX - bubbleSize * 0.3, bubbleY - bubbleSize * 0.3, bubbleSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Draw grey base tile for buildings (industrial/modern era)
 */
export function drawEnhancedGreyBase(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  tileWidth: number,
  tileHeight: number
): void {
  // Draw grey base tiles for each tile in the building footprint
  for (let dx = 0; dx < width; dx++) {
    for (let dy = 0; dy < height; dy++) {
      const offsetX = (dx - dy) * (tileWidth / 2);
      const offsetY = (dx + dy) * (tileHeight / 2);
      const tileX = screenX + offsetX;
      const tileY = screenY + offsetY;
      
      const w = tileWidth;
      const h = tileHeight;
      const cx = tileX + w / 2;
      const cy = tileY + h / 2;
      
      // Top face (gradient for depth)
      const topGradient = ctx.createLinearGradient(tileX, tileY, tileX + w, tileY + h);
      topGradient.addColorStop(0, '#7a7a82');
      topGradient.addColorStop(0.5, '#6b6b73');
      topGradient.addColorStop(1, '#5c5c64');
      
      ctx.fillStyle = topGradient;
      ctx.beginPath();
      ctx.moveTo(cx, tileY);
      ctx.lineTo(tileX + w, cy);
      ctx.lineTo(cx, tileY + h);
      ctx.lineTo(tileX, cy);
      ctx.closePath();
      ctx.fill();
      
      // Left side
      ctx.fillStyle = '#4b4b53';
      ctx.beginPath();
      ctx.moveTo(tileX, cy);
      ctx.lineTo(cx, tileY + h);
      ctx.lineTo(cx, tileY + h + 2);
      ctx.lineTo(tileX, cy + 2);
      ctx.closePath();
      ctx.fill();
      
      // Right side
      ctx.fillStyle = '#8a8a92';
      ctx.beginPath();
      ctx.moveTo(tileX + w, cy);
      ctx.lineTo(cx, tileY + h);
      ctx.lineTo(cx, tileY + h + 2);
      ctx.lineTo(tileX + w, cy + 2);
      ctx.closePath();
      ctx.fill();
      
      // Subtle cracks/lines for texture
      ctx.strokeStyle = 'rgba(60, 60, 70, 0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.2, tileY + h * 0.3);
      ctx.lineTo(cx + w * 0.1, tileY + h * 0.5);
      ctx.stroke();
      
      // Border
      ctx.strokeStyle = '#3a3a42';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, tileY);
      ctx.lineTo(tileX + w, cy);
      ctx.lineTo(cx, tileY + h);
      ctx.lineTo(tileX, cy);
      ctx.closePath();
      ctx.stroke();
    }
  }
}
