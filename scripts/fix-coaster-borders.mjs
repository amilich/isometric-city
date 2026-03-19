#!/usr/bin/env node
/**
 * Fix Coaster Asset Border Artifacts
 * 
 * This script fixes visible grid line artifacts in coaster sprite sheets
 * by replacing off-color boundary pixels with the proper red background color.
 * 
 * Usage: node scripts/fix-coaster-borders.mjs
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { copyFile } from 'fs/promises';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'public', 'assets', 'coaster');
const BACKUP_DIR = path.join(ROOT_DIR, 'public', 'assets', 'coaster', 'backups');

// Grid configs for sheets that need fixing
const SHEETS_TO_FIX = {
  'infrastructure.png': { cols: 5, rows: 6 },
  'path_furniture.png': { cols: 5, rows: 6 },
  'theme_classic.png': { cols: 5, rows: 6 },
  'theme_modern.png': { cols: 5, rows: 6 },
  'trees.png': { cols: 6, rows: 6 },
};

// Radius (in pixels) to clear around each boundary line
const BOUNDARY_CLEAR_RADIUS = 1;

// Background threshold percentile for flood fill
const BACKGROUND_PERCENTILE = 0.95;
const BACKGROUND_THRESHOLD_FALLBACK = 60;


// WebP compression quality
const WEBP_QUALITY = 80;

/**
 * Calculate color difference between two RGB values
 */
function colorDifference(r1, g1, b1, r2, g2, b2) {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

/**
 * Check if a pixel is background-like for flood fill
 */
function isBackgroundLike(r, g, b, bgR, bgG, bgB, threshold) {
  const diff = colorDifference(r, g, b, bgR, bgG, bgB);
  const redDominant = r > 120 && r >= g + 20 && r >= b + 20;
  return redDominant && diff <= threshold;
}

/**
 * Get pixel at position from raw buffer
 */
function getPixel(data, x, y, width, channels) {
  const idx = (y * width + x) * channels;
  return {
    r: data[idx],
    g: data[idx + 1],
    b: data[idx + 2],
  };
}

/**
 * Set pixel at position in raw buffer
 */
function setPixel(data, x, y, width, channels, r, g, b) {
  const idx = (y * width + x) * channels;
  data[idx] = r;
  data[idx + 1] = g;
  data[idx + 2] = b;
}

/**
 * Fix a single sprite sheet image
 */
async function fixImage(filename, grid) {
  const pngPath = path.join(ASSETS_DIR, filename);
  const webpPath = pngPath.replace(/\.png$/, '.webp');
  
  console.log(`\n📷 Processing ${filename}...`);
  
  // Read image
  const image = sharp(pngPath);
  const metadata = await image.metadata();
  const { width, height, channels } = metadata;
  
  console.log(`   Size: ${width}x${height}, Grid: ${grid.cols}x${grid.rows}`);
  
  // Get raw pixel data
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  // Create a mutable copy
  const pixels = Buffer.from(data);
  
  // Sample background color from safe area (10,10)
  const bg = getPixel(pixels, 10, 10, width, channels);
  console.log(`   Background color: RGB(${bg.r}, ${bg.g}, ${bg.b})`);
  
  const cellWidth = width / grid.cols;
  const cellHeight = height / grid.rows;
  
  let backgroundFilled = 0;
  let linePixelsCleared = 0;

  // Determine background similarity threshold from edge pixels
  const edgeDiffs = [];
  const edgeIsRedDominant = (r, g, b) => r > 120 && r >= g + 20 && r >= b + 20;
  const collectEdgeDiff = (x, y) => {
    const pixel = getPixel(pixels, x, y, width, channels);
    if (!edgeIsRedDominant(pixel.r, pixel.g, pixel.b)) return;
    edgeDiffs.push(colorDifference(pixel.r, pixel.g, pixel.b, bg.r, bg.g, bg.b));
  };

  for (let x = 0; x < width; x++) {
    collectEdgeDiff(x, 0);
    collectEdgeDiff(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    collectEdgeDiff(0, y);
    collectEdgeDiff(width - 1, y);
  }

  edgeDiffs.sort((a, b) => a - b);
  const percentileIndex = Math.floor(edgeDiffs.length * BACKGROUND_PERCENTILE);
  const backgroundThreshold = edgeDiffs.length
    ? edgeDiffs[Math.min(percentileIndex, edgeDiffs.length - 1)]
    : BACKGROUND_THRESHOLD_FALLBACK;

  console.log(`   Background threshold: ${backgroundThreshold}`);

  // Flood fill background regions from the edges to normalize background color
  const visited = new Uint8Array(width * height);
  const stack = [];

  const pushIfBackground = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    const pixel = getPixel(pixels, x, y, width, channels);
    if (!isBackgroundLike(pixel.r, pixel.g, pixel.b, bg.r, bg.g, bg.b, backgroundThreshold)) return;
    visited[idx] = 1;
    stack.push(idx);
  };

  // Seed flood fill from edges
  for (let x = 0; x < width; x++) {
    pushIfBackground(x, 0);
    pushIfBackground(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBackground(0, y);
    pushIfBackground(width - 1, y);
  }

  // Flood fill background
  while (stack.length > 0) {
    const idx = stack.pop();
    const x = idx % width;
    const y = Math.floor(idx / width);

    setPixel(pixels, x, y, width, channels, bg.r, bg.g, bg.b);
    backgroundFilled++;

    if (x > 0) pushIfBackground(x - 1, y);
    if (x < width - 1) pushIfBackground(x + 1, y);
    if (y > 0) pushIfBackground(x, y - 1);
    if (y < height - 1) pushIfBackground(x, y + 1);
  }

  // Clear boundary strips to eliminate grid lines
  for (let row = 1; row < grid.rows; row++) {
    const boundaryY = Math.round(row * cellHeight);
    for (let dy = -BOUNDARY_CLEAR_RADIUS; dy <= BOUNDARY_CLEAR_RADIUS; dy++) {
      const y = boundaryY + dy;
      if (y < 0 || y >= height) continue;
      for (let x = 0; x < width; x++) {
        setPixel(pixels, x, y, width, channels, bg.r, bg.g, bg.b);
        linePixelsCleared++;
      }
    }
  }

  for (let col = 1; col < grid.cols; col++) {
    const boundaryX = Math.round(col * cellWidth);
    for (let dx = -BOUNDARY_CLEAR_RADIUS; dx <= BOUNDARY_CLEAR_RADIUS; dx++) {
      const x = boundaryX + dx;
      if (x < 0 || x >= width) continue;
      for (let y = 0; y < height; y++) {
        setPixel(pixels, x, y, width, channels, bg.r, bg.g, bg.b);
        linePixelsCleared++;
      }
    }
  }
  
  console.log(`   Normalized ${backgroundFilled} background pixels`);
  console.log(`   Cleared ${linePixelsCleared} grid-line pixels`);
  
  // Save fixed PNG
  await sharp(pixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    }
  })
    .png()
    .toFile(pngPath);
  
  console.log(`   ✅ Saved ${filename}`);
  
  // Generate WebP
  await sharp(pngPath)
    .webp({ quality: WEBP_QUALITY, lossless: false })
    .toFile(webpPath);
  
  console.log(`   ✅ Generated ${filename.replace('.png', '.webp')}`);
  
  return linePixelsCleared;
}

/**
 * Create backup of original files
 */
async function createBackups() {
  console.log('\n📦 Creating backups...');
  
  // Create backup directory if needed
  if (!existsSync(BACKUP_DIR)) {
    const { mkdir } = await import('fs/promises');
    await mkdir(BACKUP_DIR, { recursive: true });
  }
  
  for (const filename of Object.keys(SHEETS_TO_FIX)) {
    const pngPath = path.join(ASSETS_DIR, filename);
    const webpPath = pngPath.replace(/\.png$/, '.webp');
    const backupPng = path.join(BACKUP_DIR, filename);
    const backupWebp = path.join(BACKUP_DIR, filename.replace('.png', '.webp'));
    
    // Only backup if not already backed up
    if (!existsSync(backupPng)) {
      await copyFile(pngPath, backupPng);
      console.log(`   Backed up: ${filename}`);
    }
    if (!existsSync(backupWebp) && existsSync(webpPath)) {
      await copyFile(webpPath, backupWebp);
      console.log(`   Backed up: ${filename.replace('.png', '.webp')}`);
    }
  }
}

async function main() {
  console.log('🔧 Coaster Asset Border Fix Script');
  console.log('====================================');
  
  // Create backups first
  await createBackups();
  
  let totalFixed = 0;
  
  // Process each sheet
  for (const [filename, grid] of Object.entries(SHEETS_TO_FIX)) {
    try {
      const fixed = await fixImage(filename, grid);
      totalFixed += fixed;
    } catch (err) {
      console.error(`   ❌ Error processing ${filename}:`, err.message);
    }
  }
  
  console.log('\n====================================');
  console.log(`✨ Done! Fixed ${totalFixed} total pixels across ${Object.keys(SHEETS_TO_FIX).length} files.`);
  console.log(`   Backups saved to: ${path.relative(ROOT_DIR, BACKUP_DIR)}`);
}

main().catch(console.error);
