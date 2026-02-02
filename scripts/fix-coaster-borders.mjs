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
import { copyFile, stat } from 'fs/promises';
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

// How many pixels from boundary to check/fix
const BOUNDARY_RADIUS = 3;

// Color difference threshold - pixels differing more than this from background are replaced
const COLOR_THRESHOLD = 30;

// WebP compression quality
const WEBP_QUALITY = 80;

/**
 * Calculate color difference between two RGB values
 */
function colorDifference(r1, g1, b1, r2, g2, b2) {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

/**
 * Check if a pixel should be replaced with background
 * We want to replace:
 * 1. Pixels that are "almost red" but with elevated G/B (anti-aliased red)
 * 2. Pixels that are dark/grayish (anti-aliased boundaries)
 * 
 * We want to preserve:
 * 1. Pixels that are already the correct background red
 * 2. Pixels that are clearly sprite content (colorful, high saturation non-red)
 */
function shouldReplacePixel(r, g, b, bgR, bgG, bgB) {
  const diff = colorDifference(r, g, b, bgR, bgG, bgB);
  
  // If pixel matches background well, no need to replace
  if (diff < COLOR_THRESHOLD) {
    return false;
  }
  
  // Type 1: Pinkish pixels (high R, elevated G/B from anti-aliasing)
  // These are blends between red background and grayish sprite edges
  if (r > 180 && g > 50 && b > 50 && g < 250 && b < 250) {
    return true;
  }
  
  // Type 2: Dark anti-aliasing (all channels are low-medium and similar)
  // This catches dark/grayish/brownish boundary artifacts
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;
  
  // Low-ish saturation and relatively dark = likely artifact
  // Increased threshold to catch brownish tones like RGB(49,52,36)
  if (saturation < 0.5 && maxChannel < 200 && maxChannel > 20) {
    return true;
  }
  
  // Type 3: Slightly off-red (R is dominant but not quite right)
  // High red, low-ish green/blue, but not matching background
  if (r > 180 && g < 80 && b < 80 && diff > COLOR_THRESHOLD) {
    return true;
  }
  
  return false;
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
  
  let pixelsFixed = 0;
  
  // Fix horizontal boundaries (between rows)
  for (let row = 1; row < grid.rows; row++) {
    const boundaryY = Math.round(row * cellHeight);
    
    for (let x = 0; x < width; x++) {
      for (let dy = -BOUNDARY_RADIUS; dy <= BOUNDARY_RADIUS; dy++) {
        const y = boundaryY + dy;
        if (y < 0 || y >= height) continue;
        
        const pixel = getPixel(pixels, x, y, width, channels);
        
        // Check if this pixel should be replaced with background
        if (shouldReplacePixel(pixel.r, pixel.g, pixel.b, bg.r, bg.g, bg.b)) {
          setPixel(pixels, x, y, width, channels, bg.r, bg.g, bg.b);
          pixelsFixed++;
        }
      }
    }
  }
  
  // Fix vertical boundaries (between columns)
  for (let col = 1; col < grid.cols; col++) {
    const boundaryX = Math.round(col * cellWidth);
    
    for (let y = 0; y < height; y++) {
      for (let dx = -BOUNDARY_RADIUS; dx <= BOUNDARY_RADIUS; dx++) {
        const x = boundaryX + dx;
        if (x < 0 || x >= width) continue;
        
        const pixel = getPixel(pixels, x, y, width, channels);
        
        // Check if this pixel should be replaced with background
        if (shouldReplacePixel(pixel.r, pixel.g, pixel.b, bg.r, bg.g, bg.b)) {
          setPixel(pixels, x, y, width, channels, bg.r, bg.g, bg.b);
          pixelsFixed++;
        }
      }
    }
  }
  
  console.log(`   Fixed ${pixelsFixed} boundary pixels`);
  
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
  
  return pixelsFixed;
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
