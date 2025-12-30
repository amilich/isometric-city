#!/usr/bin/env node
/**
 * Sprite Extraction Script for Rise of Nations
 * 
 * Usage: node scripts/extract-sprite.mjs <building_name> <age>
 * Example: node scripts/extract-sprite.mjs farm classical
 * 
 * Outputs: A PNG image of the extracted sprite to scripts/sprite-output/
 */

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Age sprite pack configuration (matching renderConfig.ts)
const AGE_SPRITE_PACKS = {
  classical: {
    src: 'public/assets/ages/classics.png',
    cols: 5,
    rows: 6,
  },
  medieval: {
    src: 'public/assets/ages/medeival.png',
    cols: 5,
    rows: 6,
  },
  enlightenment: {
    src: 'public/assets/ages/enlightenment.png',
    cols: 5,
    rows: 6,
  },
  industrial: {
    src: 'public/assets/ages/industrial.png',
    cols: 5,
    rows: 6,
  },
  modern: {
    src: 'public/assets/ages/modern.png',
    cols: 5,
    rows: 6,
  },
};

// Age-specific building sprite overrides (matching renderConfig.ts AGE_BUILDING_OVERRIDES)
// Updated December 2025 based on comprehensive sprite audit
const AGE_OVERRIDES = {
  classical: {
    city_center: { row: 5, col: 2 },
    market: { row: 3, col: 3 },  // Fixed: actual market stalls (was 3,2 villa)
    library: { row: 0, col: 1 },
    university: { row: 2, col: 0 },
    temple: { row: 2, col: 2 },
    senate: { row: 1, col: 4 },
    barracks: { row: 1, col: 3 },
    stable: { row: 3, col: 1 },   // Fixed: house with garden (was 3,4 shop)
    dock: { row: 4, col: 4 },
    mine: { row: 4, col: 2 },
    smelter: { row: 4, col: 3 },
    granary: { row: 5, col: 0 },
    lumber_mill: { row: 4, col: 0 },  // Fixed: workshop (was 4,1 industrial)
    factory: { row: 4, col: 0 },
    siege_factory: { row: 4, col: 0 },  // Fixed: workshop (was 4,1 industrial)
    tower: { row: 2, col: 1 },
    fort: { row: 1, col: 3 },     // Fixed: walled compound (was 2,4 lighthouse)
    fortress: { row: 1, col: 3 }, // Fixed: walled compound (was 3,0 Pantheon)
    stockade: { row: 4, col: 0 }, // Fixed: basic fortification
    woodcutters_camp: { row: 4, col: 0 }, // Fixed: rustic workshop
    castle: { row: 0, col: 0 },
  },
  medieval: {
    city_center: { row: 1, col: 0 },
    small_city: { row: 1, col: 0 },
    large_city: { row: 1, col: 0 },
    major_city: { row: 0, col: 0 },
    market: { row: 2, col: 0 },
    library: { row: 0, col: 4 },
    university: { row: 3, col: 2 },
    temple: { row: 5, col: 3 },
    senate: { row: 1, col: 4 },   // Fixed: Gothic abbey (was 5,2 dome)
    barracks: { row: 1, col: 3 },
    stable: { row: 1, col: 2 },
    dock: { row: 5, col: 0 },
    mine: { row: 4, col: 3 },     // Fixed: mining complex (was 4,2 forge)
    smelter: { row: 0, col: 2 },
    granary: { row: 4, col: 1 },
    lumber_mill: { row: 3, col: 3 }, // Fixed: barn/workshop (was 0,3 watchtower)
    tower: { row: 0, col: 1 },
    fort: { row: 5, col: 1 },
    fortress: { row: 5, col: 1 }, // Fixed: distinct from barracks
    stockade: { row: 3, col: 1 }, // Added: Tudor building
    castle: { row: 0, col: 0 },
    siege_factory: { row: 4, col: 2 }, // Fixed: forge (was 3,4 barn)
  },
  enlightenment: {
    city_center: { row: 0, col: 0 },
    market: { row: 4, col: 0 },   // Fixed: shop (was 0,3 fire station)
    library: { row: 0, col: 4 },
    university: { row: 2, col: 0 },
    temple: { row: 5, col: 3 },
    senate: { row: 5, col: 2 },
    barracks: { row: 1, col: 3 }, // Fixed: compound (was 1,4 civic)
    stable: { row: 5, col: 0 },
    dock: { row: 2, col: 4 },
    mine: { row: 4, col: 3 },
    smelter: { row: 4, col: 2 },  // Fixed: factory (was 3,3 cottage!)
    granary: { row: 4, col: 1 },
    lumber_mill: { row: 2, col: 2 },
    factory: { row: 0, col: 2 },
    fort: { row: 1, col: 3 },     // Fixed: compound (was 5,1 bridge!)
    tower: { row: 1, col: 3 },    // Fixed: compound (was 2,1 water tower)
    fortress: { row: 1, col: 3 },
    stockade: { row: 1, col: 3 },
    bunker: { row: 4, col: 2 },   // Fixed: industrial (was 4,0 shop)
    castle: { row: 5, col: 2 },   // Fixed: capitol (was 0,0 mansion)
  },
  industrial: {
    city_center: { row: 5, col: 2 },
    market: { row: 3, col: 4 },
    library: { row: 3, col: 2 },
    university: { row: 2, col: 0 },
    temple: { row: 1, col: 4 },
    senate: { row: 5, col: 3 },
    barracks: { row: 5, col: 1 },
    stable: { row: 5, col: 1 },   // Fixed: transport depot (was 3,1 with bleeding)
    dock: { row: 5, col: 0 },
    mine: { row: 4, col: 2 },
    smelter: { row: 4, col: 3 },
    granary: { row: 4, col: 0 },
    lumber_mill: { row: 0, col: 2 },
    factory: { row: 0, col: 1 },
    oil_well: { row: 2, col: 4 },
    refinery: { row: 4, col: 4 },
    bunker: { row: 0, col: 3 },   // Fixed: fortified brick (was 4,0 warehouse)
    fort: { row: 0, col: 3 },
    fortress: { row: 0, col: 3 },
    castle: { row: 0, col: 3 },   // Fixed: institutional (was 0,0 brownstones)
    auto_plant: { row: 4, col: 2 },
  },
  modern: {
    city_center: { row: 0, col: 1 },
    small_city: { row: 0, col: 0 },
    large_city: { row: 0, col: 1 },
    major_city: { row: 5, col: 2 },
    market: { row: 3, col: 4 },
    library: { row: 5, col: 3 },
    university: { row: 2, col: 0 },
    temple: { row: 5, col: 3 },   // Fixed: classical (was 0,4 hospital!)
    senate: { row: 5, col: 2 },
    barracks: { row: 1, col: 3 }, // Fixed: police compound (was 0,3 fire station)
    airbase: { row: 5, col: 0 },
    dock: { row: 4, col: 1 },     // Fixed: warehouse
    smelter: { row: 4, col: 3 },
    factory: { row: 4, col: 2 },
    oil_well: { row: 4, col: 4 }, // Fixed: refinery (was 2,4 rocket!)
    refinery: { row: 4, col: 4 },
    auto_plant: { row: 4, col: 2 },
    bunker: { row: 1, col: 3 },
    tower: { row: 1, col: 3 },    // Fixed: security (was 2,1 water tower)
    fort: { row: 1, col: 3 },
    fortress: { row: 1, col: 3 },
    stockade: { row: 1, col: 3 },
    castle: { row: 1, col: 3 },
    stable: { row: 4, col: 1 },
    granary: { row: 4, col: 1 },
    siege_factory: { row: 4, col: 1 },
    lumber_mill: { row: 4, col: 1 },
    woodcutters_camp: { row: 4, col: 1 },
    mine: { row: 4, col: 2 },
  },
};

// Default building sprite map (fallback when age override not available)
const BUILDING_SPRITE_MAP = {
  // City buildings
  city_center: { row: 5, col: 2 },
  small_city: { row: 5, col: 2 },
  large_city: { row: 5, col: 2 },
  major_city: { row: 5, col: 2 },

  // Economic buildings
  farm: { row: 0, col: 1 },
  woodcutters_camp: { row: 3, col: 0 },
  granary: { row: 4, col: 0 },
  lumber_mill: { row: 4, col: 1 },
  mine: { row: 4, col: 2 },
  smelter: { row: 4, col: 3 },
  market: { row: 3, col: 2 },
  oil_well: { row: 2, col: 4 },
  refinery: { row: 4, col: 4 },

  // Knowledge buildings
  library: { row: 0, col: 1 },
  university: { row: 2, col: 0 },
  temple: { row: 5, col: 3 },
  senate: { row: 0, col: 0 },

  // Military buildings
  barracks: { row: 1, col: 3 },
  stable: { row: 1, col: 2 },
  siege_factory: { row: 4, col: 1 },
  dock: { row: 4, col: 4 },
  auto_plant: { row: 0, col: 1 },
  factory: { row: 4, col: 2 },
  airbase: { row: 5, col: 0 },

  // Defensive buildings
  tower: { row: 2, col: 1 },
  fort: { row: 1, col: 3 },
  castle: { row: 0, col: 0 },
  stockade: { row: 0, col: 1 },
  fortress: { row: 1, col: 3 },
  bunker: { row: 4, col: 0 },

  // Roads
  road: { row: 3, col: 2 },
};

// Get sprite position for a building, checking age override first
function getSpritePosition(buildingName, age) {
  const ageOverride = AGE_OVERRIDES[age]?.[buildingName];
  if (ageOverride) return ageOverride;
  return BUILDING_SPRITE_MAP[buildingName];
}

// Building sizes (for multi-tile buildings)
const BUILDING_SIZES = {
  city_center: { width: 3, height: 3 },
  small_city: { width: 3, height: 3 },
  large_city: { width: 3, height: 3 },
  major_city: { width: 3, height: 3 },
  university: { width: 2, height: 2 },
  market: { width: 2, height: 2 },
  library: { width: 2, height: 2 },
  senate: { width: 2, height: 2 },
  barracks: { width: 2, height: 2 },
  stable: { width: 2, height: 2 },
  smelter: { width: 2, height: 2 },
  refinery: { width: 2, height: 2 },
  dock: { width: 2, height: 2 },
  fort: { width: 2, height: 2 },
  fortress: { width: 2, height: 2 },
  castle: { width: 2, height: 2 },
  amphitheater: { width: 2, height: 2 },
};

async function extractSprite(buildingName, age) {
  const pack = AGE_SPRITE_PACKS[age];
  if (!pack) {
    console.error(`Unknown age: ${age}`);
    console.error(`Available ages: ${Object.keys(AGE_SPRITE_PACKS).join(', ')}`);
    process.exit(1);
  }

  const spritePos = getSpritePosition(buildingName, age);
  if (!spritePos) {
    console.error(`Unknown building: ${buildingName}`);
    console.error(`Available buildings: ${Object.keys(BUILDING_SPRITE_MAP).join(', ')}`);
    process.exit(1);
  }
  
  console.log(`Using age-specific position for ${age}: row=${spritePos.row}, col=${spritePos.col}`);

  const projectRoot = path.resolve(__dirname, '..');
  const imagePath = path.join(projectRoot, pack.src);

  if (!fs.existsSync(imagePath)) {
    console.error(`Sprite sheet not found: ${imagePath}`);
    process.exit(1);
  }

  console.log(`Loading sprite sheet: ${imagePath}`);
  const image = await loadImage(imagePath);
  
  const tileWidth = Math.floor(image.width / pack.cols);
  const tileHeight = Math.floor(image.height / pack.rows);
  
  console.log(`Sheet dimensions: ${image.width}x${image.height}`);
  console.log(`Tile dimensions: ${tileWidth}x${tileHeight}`);
  console.log(`Extracting position: row=${spritePos.row}, col=${spritePos.col}`);

  // Create canvas for extraction
  const canvas = createCanvas(tileWidth, tileHeight);
  const ctx = canvas.getContext('2d');

  // Extract the sprite
  const sx = spritePos.col * tileWidth;
  const sy = spritePos.row * tileHeight;

  ctx.drawImage(
    image,
    sx, sy, tileWidth, tileHeight,
    0, 0, tileWidth, tileHeight
  );

  // Create output directory
  const outputDir = path.join(projectRoot, 'scripts', 'sprite-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save the sprite
  const outputPath = path.join(outputDir, `${buildingName}_${age}.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);

  console.log(`\nSprite saved to: ${outputPath}`);
  console.log(`\nSprite Info:`);
  console.log(`  Building: ${buildingName}`);
  console.log(`  Age: ${age}`);
  console.log(`  Source position: (${sx}, ${sy})`);
  console.log(`  Size: ${tileWidth}x${tileHeight}`);
  
  const size = BUILDING_SIZES[buildingName];
  if (size) {
    console.log(`  Building size: ${size.width}x${size.height} tiles`);
  } else {
    console.log(`  Building size: 1x1 tiles`);
  }

  return outputPath;
}

// List all sprites in a grid for an age
async function listAllSprites(age) {
  const pack = AGE_SPRITE_PACKS[age];
  if (!pack) {
    console.error(`Unknown age: ${age}`);
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, '..');
  const imagePath = path.join(projectRoot, pack.src);
  const image = await loadImage(imagePath);
  
  const tileWidth = Math.floor(image.width / pack.cols);
  const tileHeight = Math.floor(image.height / pack.rows);

  console.log(`\n${age.toUpperCase()} AGE SPRITE GRID (${pack.cols}x${pack.rows}):`);
  console.log(`Tile size: ${tileWidth}x${tileHeight}`);
  console.log(`\nGrid Layout:`);

  // Create a lookup of what's at each position
  const positionLookup = {};
  for (const [building, pos] of Object.entries(BUILDING_SPRITE_MAP)) {
    const key = `${pos.row},${pos.col}`;
    if (!positionLookup[key]) {
      positionLookup[key] = [];
    }
    positionLookup[key].push(building);
  }

  for (let row = 0; row < pack.rows; row++) {
    let rowStr = `Row ${row}: `;
    for (let col = 0; col < pack.cols; col++) {
      const key = `${row},${col}`;
      const buildings = positionLookup[key] || ['(empty)'];
      rowStr += `[${col}:${buildings.join('/')}] `;
    }
    console.log(rowStr);
  }
}

// Extract all buildings for all ages
async function extractAll() {
  const projectRoot = path.resolve(__dirname, '..');
  const outputDir = path.join(projectRoot, 'scripts', 'sprite-output');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results = [];
  
  for (const age of Object.keys(AGE_SPRITE_PACKS)) {
    console.log(`\n=== Processing ${age.toUpperCase()} AGE ===`);
    
    for (const building of Object.keys(BUILDING_SPRITE_MAP)) {
      try {
        const outputPath = await extractSprite(building, age);
        results.push({ building, age, path: outputPath, status: 'ok' });
      } catch (err) {
        results.push({ building, age, error: err.message, status: 'error' });
        console.error(`  Error extracting ${building}: ${err.message}`);
      }
    }
  }

  // Write summary
  const summaryPath = path.join(outputDir, 'extraction-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\nSummary written to: ${summaryPath}`);
  
  return results;
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage:');
  console.log('  node scripts/extract-sprite.mjs <building_name> <age>');
  console.log('  node scripts/extract-sprite.mjs --list <age>');
  console.log('  node scripts/extract-sprite.mjs --all');
  console.log('\nExamples:');
  console.log('  node scripts/extract-sprite.mjs farm classical');
  console.log('  node scripts/extract-sprite.mjs --list medieval');
  console.log('  node scripts/extract-sprite.mjs --all');
  console.log('\nAvailable ages:', Object.keys(AGE_SPRITE_PACKS).join(', '));
  console.log('Available buildings:', Object.keys(BUILDING_SPRITE_MAP).join(', '));
  process.exit(0);
}

if (args[0] === '--list' && args[1]) {
  listAllSprites(args[1]).catch(console.error);
} else if (args[0] === '--all') {
  extractAll().catch(console.error);
} else if (args.length >= 2) {
  extractSprite(args[0], args[1]).catch(console.error);
} else {
  console.error('Invalid arguments. Run without arguments for usage.');
  process.exit(1);
}
