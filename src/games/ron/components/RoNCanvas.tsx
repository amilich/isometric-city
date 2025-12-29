/**
 * Rise of Nations - Canvas Component
 * 
 * Renders the isometric game world using the shared IsoCity rendering system.
 * Properly handles green tiles, water, hover/selection, and sprite background filtering.
 */
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRoN } from '../context/RoNContext';
import { AGE_SPRITE_PACKS, BUILDING_SPRITE_MAP, BUILDING_VERTICAL_OFFSETS, AGE_VERTICAL_OFFSETS, BUILDING_SCALES, AGE_BUILDING_SCALES, CONSTRUCTION_VERTICAL_OFFSETS, CONSTRUCTION_CROP_TOP, CONSTRUCTION_CROP_BOTTOM, PLAYER_COLORS, getAgeSpritePosition } from '../lib/renderConfig';
import { BUILDING_STATS } from '../types/buildings';
import { AGE_ORDER } from '../types/ages';
import { RoNBuildingType } from '../types/buildings';
import { RON_TOOL_INFO } from '../types/game';
import { UNIT_STATS } from '../types/units';

// Import shared IsoCity rendering utilities
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  gridToScreen,
  screenToGrid,
  screenToGridRaw,
  loadImage,
  loadSpriteImage,
  getCachedImage,
  onImageLoaded,
  drawGroundTile,
  drawWaterTile,
  drawTileHighlight,
  drawSelectionBox,
  drawHealthBar,
  drawSkyBackground,
  setupCanvas,
  calculateViewBounds,
  isTileVisible,
  WATER_ASSET_PATH,
  drawBeachOnWater,
  drawFireEffect,
} from '@/components/game/shared';
import { drawRoNUnit } from '../lib/drawUnits';
import { getTerritoryOwner, extractCityCenters } from '../lib/simulation';
import {
  drawRealisticGrassTile,
  drawRealisticWaterTile,
  drawRealisticBeach,
  drawRealisticMountain,
  drawRealisticForest,
  drawEnhancedSkyBackground,
} from '../lib/enhancedGraphics';

/**
 * Find the origin tile of a multi-tile building by searching backwards from a clicked position.
 * This allows clicking on any part of a 2x2, 3x3, etc. building to select it.
 */
function findBuildingOrigin(
  gridX: number,
  gridY: number,
  grid: import('../types/game').RoNTile[][]
): { originX: number; originY: number; buildingType: string } | null {
  const maxSize = 4; // Maximum building size to check

  // Check if this tile itself has a building
  const tile = grid[gridY]?.[gridX];
  if (tile?.building && tile.building.type !== 'empty' && tile.building.type !== 'grass' && tile.building.type !== 'water') {
    return { originX: gridX, originY: gridY, buildingType: tile.building.type };
  }

  // Search backwards to find if this tile is part of a larger building
  for (let dy = 0; dy < maxSize; dy++) {
    for (let dx = 0; dx < maxSize; dx++) {
      const originX = gridX - dx;
      const originY = gridY - dy;

      if (originX < 0 || originY < 0) continue;

      const originTile = grid[originY]?.[originX];
      if (!originTile?.building) continue;

      const buildingType = originTile.building.type as RoNBuildingType;
      if (buildingType === 'empty' || buildingType === 'grass' || buildingType === 'water') continue;

      const stats = BUILDING_STATS[buildingType];
      if (!stats) continue;

      const { width, height } = stats.size;

      // Check if the clicked position falls within this building's footprint
      if (gridX >= originX && gridX < originX + width &&
          gridY >= originY && gridY < originY + height) {
        return { originX, originY, buildingType };
      }
    }
  }

  return null;
}

/**
 * Check if a tile position is adjacent to a forest tile.
 * Used for validating woodcutter's camp and lumber mill placement.
 */
function isAdjacentToForest(
  gridX: number,
  gridY: number,
  grid: import('../types/game').RoNTile[][],
  gridSize: number
): boolean {
  // Check all 8 adjacent tiles (including diagonals)
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  for (const [dx, dy] of directions) {
    const nx = gridX + dx;
    const ny = gridY + dy;

    if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;

    const tile = grid[ny]?.[nx];
    if (tile && tile.forestDensity > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a tile position is adjacent to a metal deposit (mountain).
 * Used for validating mine placement.
 */
function isAdjacentToMetal(
  gridX: number,
  gridY: number,
  grid: import('../types/game').RoNTile[][],
  gridSize: number
): boolean {
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  for (const [dx, dy] of directions) {
    const nx = gridX + dx;
    const ny = gridY + dy;

    if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;

    const tile = grid[ny]?.[nx];
    if (tile && tile.hasMetalDeposit) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a tile position is adjacent to an oil deposit.
 * Used for validating oil well/platform placement.
 */
function isAdjacentToOil(
  gridX: number,
  gridY: number,
  grid: import('../types/game').RoNTile[][],
  gridSize: number
): boolean {
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  for (const [dx, dy] of directions) {
    const nx = gridX + dx;
    const ny = gridY + dy;

    if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;

    const tile = grid[ny]?.[nx];
    if (tile && tile.hasOilDeposit) {
      return true;
    }
  }

  return false;
}

// Type for pre-computed city centers (matches TerritorySource from simulation.ts)
type CityCenter = { x: number; y: number; ownerId: string; radius: number };

/**
 * Check if a building placement is valid at the given position.
 * Returns true if valid, false if invalid.
 * Buildings can only be placed within player's territory (except city centers and roads).
 * PERF: Pass pre-computed cityCenters to avoid O(n²) grid scan.
 */
function isBuildingPlacementValid(
  buildingType: RoNBuildingType,
  gridX: number,
  gridY: number,
  grid: import('../types/game').RoNTile[][],
  gridSize: number,
  currentPlayerId?: string,
  cityCenters?: CityCenter[]
): boolean {
  // Roads can only be placed on empty/grass terrain, not on existing buildings
  if (buildingType === 'road') {
    const tile = grid[gridY]?.[gridX];
    if (!tile) return false;
    if (tile.terrain === 'water') return false;
    // Only allow roads on empty terrain (no building, or grass/empty types)
    if (tile.building && 
        tile.building.type !== 'grass' && 
        tile.building.type !== 'empty' && 
        tile.building.type !== 'road') {
      return false;
    }
    return true;
  }
  
  // City centers can be placed outside territory (to expand)
  // but must be far enough from existing city centers
  if (buildingType === 'city_center' || buildingType === 'small_city' || 
      buildingType === 'large_city' || buildingType === 'major_city') {
    // Check territory isn't owned by enemy
    const owner = getTerritoryOwner(grid, gridSize, gridX, gridY, cityCenters);
    if (owner !== null && owner !== currentPlayerId) {
      return false; // Can't place in enemy territory
    }
    return true;
  }
  
  // All other buildings must be in player's territory
  if (currentPlayerId) {
    const territoryOwner = getTerritoryOwner(grid, gridSize, gridX, gridY, cityCenters);
    if (territoryOwner !== currentPlayerId) {
      return false; // Must be in own territory
    }
  }
  
  // Check that we're not placing on forest or metal tiles (they're impassable terrain)
  const targetTile = grid[gridY]?.[gridX];
  if (targetTile) {
    if (targetTile.forestDensity > 0) return false;  // Can't build on forest
    if (targetTile.hasMetalDeposit) return false;    // Can't build on metal deposit
    if (targetTile.hasOilDeposit) return false;      // Can't build on oil deposit
  }

  // Woodcutter's camp and lumber mill must be adjacent to forest (but not on it)
  if (buildingType === 'woodcutters_camp' || buildingType === 'lumber_mill') {
    return isAdjacentToForest(gridX, gridY, grid, gridSize);
  }

  // Mine must be adjacent to metal deposit (but not on it)
  if (buildingType === 'mine') {
    return isAdjacentToMetal(gridX, gridY, grid, gridSize);
  }

  // Oil well and oil platform must be adjacent to oil deposit (but not on it)
  if (buildingType === 'oil_well' || buildingType === 'oil_platform') {
    return isAdjacentToOil(gridX, gridY, grid, gridSize);
  }

  // Dock must be adjacent to water
  if (buildingType === 'dock') {
    const buildingSize = BUILDING_STATS[buildingType]?.size || { width: 1, height: 1 };
    return isAdjacentToWater(grid, gridX, gridY, buildingSize.width, buildingSize.height);
  }

  // Other buildings - add more validation as needed
  return true;
}

// IsoCity sprite sheet paths for trees, pier, construction, and farms
const ISOCITY_SPRITE_PATH = '/assets/sprites_red_water_new.png';
const ISOCITY_PARKS_PATH = '/assets/sprites_red_water_new_parks.png';
const ISOCITY_CONSTRUCTION_PATH = '/assets/sprites_red_water_new_construction.png';
const ISOCITY_FARM_PATH = '/assets/sprites_red_water_new_farm.webp';
const ISOCITY_AIRPORT_PATH = '/assets/buildings/airport.webp';
// Medieval sheet for fallback tower/fort sprites in later ages
const MEDIEVAL_SHEET_PATH = '/assets/ages/medeival.png';
// Dense/high-rise buildings sheet for modern city centers
const ISOCITY_DENSE_PATH = '/assets/sprites_red_water_new_dense.png';

// High-rise building positions for modern city centers (from dense sheet)
// These are the best office/commercial high-rises in the 5x6 grid
const MODERN_HIGHRISES: { row: number; col: number }[] = [
  { row: 0, col: 0 }, // Twisted modern tower
  { row: 0, col: 1 }, // Green vertical garden (Bosco Verticale)
  { row: 0, col: 2 }, // Curved glass tower
  { row: 0, col: 3 }, // Tall office tower
  { row: 1, col: 0 }, // Modern mixed-use
  { row: 1, col: 2 }, // Glass office with pool
  { row: 1, col: 3 }, // Art deco tower
  { row: 2, col: 0 }, // Dark glass skyscraper
  { row: 2, col: 1 }, // Twin dark towers
  { row: 2, col: 2 }, // Gray glass high-rise
  { row: 3, col: 4 }, // Hotel/office tower
];

// Farm sprite configuration - use first row of 5 crops randomly
const FARM_SPRITE_COLS = 5;
const FARM_SPRITE_ROWS = 6;
const FARM_VARIANTS = 5; // Only use first row (5 variants)

// Grey base tile colors for Industrial/Modern buildings (like IsoCity)
const GREY_BASE_COLORS = {
  top: '#6b7280',
  left: '#4b5563',
  right: '#9ca3af',
  stroke: '#374151',
};

/**
 * Draw a grey isometric base tile under Industrial/Modern buildings
 * This provides the concrete/pavement foundation that these buildings should have
 */
function drawGreyBase(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  width: number = 1,
  height: number = 1
): void {
  // Draw grey base tiles for each tile in the building footprint
  for (let dx = 0; dx < width; dx++) {
    for (let dy = 0; dy < height; dy++) {
      // Calculate offset for this tile in the footprint
      const offsetX = (dx - dy) * (TILE_WIDTH / 2);
      const offsetY = (dx + dy) * (TILE_HEIGHT / 2);
      const tileX = screenX + offsetX;
      const tileY = screenY + offsetY;
      
      const w = TILE_WIDTH;
      const h = TILE_HEIGHT;
      const cx = tileX + w / 2;
      const cy = tileY + h / 2;
      
      // Draw the grey diamond (top face)
      ctx.fillStyle = GREY_BASE_COLORS.top;
      ctx.beginPath();
      ctx.moveTo(cx, tileY);           // Top
      ctx.lineTo(tileX + w, cy);       // Right
      ctx.lineTo(cx, tileY + h);       // Bottom
      ctx.lineTo(tileX, cy);           // Left
      ctx.closePath();
      ctx.fill();
      
      // Left side (slightly darker)
      ctx.fillStyle = GREY_BASE_COLORS.left;
      ctx.beginPath();
      ctx.moveTo(tileX, cy);
      ctx.lineTo(cx, tileY + h);
      ctx.lineTo(cx, tileY + h + 2);
      ctx.lineTo(tileX, cy + 2);
      ctx.closePath();
      ctx.fill();
      
      // Right side (lighter)
      ctx.fillStyle = GREY_BASE_COLORS.right;
      ctx.beginPath();
      ctx.moveTo(tileX + w, cy);
      ctx.lineTo(cx, tileY + h);
      ctx.lineTo(cx, tileY + h + 2);
      ctx.lineTo(tileX + w, cy + 2);
      ctx.closePath();
      ctx.fill();
      
      // Stroke outline
      ctx.strokeStyle = GREY_BASE_COLORS.stroke;
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

// Check if a tile has a dock or is part of a dock's footprint (for beach exclusion)
function hasDock(grid: import('../types/game').RoNTile[][], gridX: number, gridY: number, gridSize: number): boolean {
  if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
  
  const tile = grid[gridY]?.[gridX];
  if (tile?.building?.type === 'dock') return true;
  
  // Check if this is an empty/grass tile that's part of a 2x2 dock
  // Docks are 2x2, so check up to 1 tile away for the origin
  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = 0; dx <= 1; dx++) {
      const checkX = gridX - dx;
      const checkY = gridY - dy;
      if (checkX >= 0 && checkY >= 0 && checkX < gridSize && checkY < gridSize) {
        const checkTile = grid[checkY]?.[checkX];
        if (checkTile?.building?.type === 'dock') {
          // Verify this tile is within the 2x2 footprint
          if (gridX >= checkX && gridX < checkX + 2 && gridY >= checkY && gridY < checkY + 2) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// Check if a tile is adjacent to water (for dock placement)
function isAdjacentToWater(grid: import('../types/game').RoNTile[][], x: number, y: number, width: number, height: number): boolean {
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1], // Cardinal
  ];
  
  // Check all edges of the building footprint
  for (let dx = 0; dx < width; dx++) {
    for (let dy = 0; dy < height; dy++) {
      const tileX = x + dx;
      const tileY = y + dy;
      
      for (const [ddx, ddy] of directions) {
        const checkX = tileX + ddx;
        const checkY = tileY + ddy;
        
        // Skip if checking within the building footprint
        if (checkX >= x && checkX < x + width && checkY >= y && checkY < y + height) continue;
        
        if (checkY >= 0 && checkY < grid.length && checkX >= 0 && checkX < grid[0].length) {
          if (grid[checkY][checkX].terrain === 'water') {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Draw a road tile with proper corners/turns based on adjacent roads.
 * Uses IsoCity's proven road drawing approach with age-based styling.
 */
function drawRoNRoad(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  grid: import('../types/game').RoNTile[][],
  gridSize: number,
  age: import('../types/ages').Age
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const x = screenX;
  const y = screenY;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Check adjacency (in isometric coordinates)
  const hasRoad = (gx: number, gy: number) => {
    if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) return false;
    const tile = grid[gy]?.[gx];
    return tile?.building?.type === 'road';
  };

  const north = hasRoad(gridX - 1, gridY);  // top-left edge
  const east = hasRoad(gridX, gridY - 1);   // top-right edge
  const south = hasRoad(gridX + 1, gridY);  // bottom-right edge
  const west = hasRoad(gridX, gridY + 1);   // bottom-left edge

  // Age-based road colors
  const AGE_ORDER_LOCAL = ['classical', 'medieval', 'enlightenment', 'industrial', 'modern'];
  const ageIndex = AGE_ORDER_LOCAL.indexOf(age);

  let roadColor: string;
  let showCenterLine = false;

  if (ageIndex <= 0) {
    // Classical - dirt road
    roadColor = '#9B8365';
  } else if (ageIndex <= 1) {
    // Medieval - cobblestone
    roadColor = '#7A7A7A';
  } else if (ageIndex <= 2) {
    // Enlightenment - improved cobblestone
    roadColor = '#686868';
  } else {
    // Industrial/Modern - asphalt with markings
    roadColor = '#4A4A4A';
    showCenterLine = true;
  }

  // Road width - matches IsoCity's laneWidthRatio
  const roadW = w * 0.14;
  
  // Edge stop distance (how far road extends toward edge) - matches IsoCity
  const edgeStop = 0.98;

  // Edge midpoints - EXACTLY like IsoCity (using proportions, not corner averaging)
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;

  // Direction vectors (from center to edge midpoint)
  const northDx = (northEdgeX - cx) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const northDy = (northEdgeY - cy) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const eastDx = (eastEdgeX - cx) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const eastDy = (eastEdgeY - cy) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const southDx = (southEdgeX - cx) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const southDy = (southEdgeY - cy) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const westDx = (westEdgeX - cx) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
  const westDy = (westEdgeY - cy) / Math.hypot(westEdgeX - cx, westEdgeY - cy);

  const getPerp = (dx: number, dy: number) => ({ nx: -dy, ny: dx });

  // Draw road surface
  ctx.fillStyle = roadColor;

  // Helper to draw a road segment from center towards an edge
  const drawSegment = (edgeX: number, edgeY: number, dx: number, dy: number) => {
    const stopX = cx + (edgeX - cx) * edgeStop;
    const stopY = cy + (edgeY - cy) * edgeStop;
    const perp = getPerp(dx, dy);
    const halfWidth = roadW * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  };

  // Count connections
  const connections = [north, east, south, west].filter(Boolean).length;

  // Draw road segments for each direction
  if (north) drawSegment(northEdgeX, northEdgeY, northDx, northDy);
  if (east) drawSegment(eastEdgeX, eastEdgeY, eastDx, eastDy);
  if (south) drawSegment(southEdgeX, southEdgeY, southDx, southDy);
  if (west) drawSegment(westEdgeX, westEdgeY, westDx, westDy);

  // If isolated road (no connections), draw all 4 directions as a crossroads
  if (connections === 0) {
    drawSegment(northEdgeX, northEdgeY, northDx, northDy);
    drawSegment(eastEdgeX, eastEdgeY, eastDx, eastDy);
    drawSegment(southEdgeX, southEdgeY, southDx, southDy);
    drawSegment(westEdgeX, westEdgeY, westDx, westDy);
  }

  // Center intersection - match IsoCity exactly (same offset in all directions)
  // This creates a proper diamond that covers the intersection gaps
  const centerSize = roadW * 1.4;
  ctx.beginPath();
  ctx.moveTo(cx, cy - centerSize);     // Top
  ctx.lineTo(cx + centerSize, cy);     // Right  
  ctx.lineTo(cx, cy + centerSize);     // Bottom
  ctx.lineTo(cx - centerSize, cy);     // Left
  ctx.closePath();
  ctx.fill();

  // Draw center line for modern roads (industrial+)
  if (showCenterLine) {
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // Draw center line along connected roads
    if (north && south && !east && !west) {
      // N-S road
      ctx.beginPath();
      ctx.moveTo(northEdgeX, northEdgeY);
      ctx.lineTo(southEdgeX, southEdgeY);
      ctx.stroke();
    } else if (east && west && !north && !south) {
      // E-W road
      ctx.beginPath();
      ctx.moveTo(eastEdgeX, eastEdgeY);
      ctx.lineTo(westEdgeX, westEdgeY);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }
}

interface RoNCanvasProps {
  navigationTarget?: { x: number; y: number } | null;
  onNavigationComplete?: () => void;
  onViewportChange?: (viewport: { 
    offset: { x: number; y: number }; 
    zoom: number; 
    canvasSize: { width: number; height: number } 
  }) => void;
}

export function RoNCanvas({ navigationTarget, onNavigationComplete, onViewportChange }: RoNCanvasProps) {
  const { 
    state, 
    latestStateRef,
    selectUnits, 
    selectUnitsInArea,
    moveSelectedUnits,
    selectBuilding,
    selectedBuildingPos,
    placeBuilding,
    attackTarget,
    assignTask,
    setTool,
  } = useRoN();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Camera state
  const [offset, setOffset] = useState({ x: 400, y: 200 });
  const [zoom, setZoom] = useState(1);
  const offsetRef = useRef(offset);
  const zoomRef = useRef(zoom);
  
  // Interaction state
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  
  // Selection state
  const isSelectingRef = useRef(false);
  const selectionStartScreenRef = useRef<{ x: number; y: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  
  // Road drag state (like IsoCity)
  const isRoadDraggingRef = useRef(false);
  const roadDragStartRef = useRef<{ x: number; y: number } | null>(null);
  
  // Fire animation time
  const fireAnimTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const [roadDrawDirection, setRoadDrawDirection] = useState<'h' | 'v' | null>(null);
  const placedRoadTilesRef = useRef<Set<string>>(new Set());
  const [roadDragEnd, setRoadDragEnd] = useState<{ x: number; y: number } | null>(null);
  
  // Hover state
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  
  // Image loading state
  const [imageLoadVersion, setImageLoadVersion] = useState(0);
  const imagesLoadedRef = useRef<Set<string>>(new Set());
  
  // Keep refs in sync
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);
  
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  
  // Report viewport changes to parent (for minimap)
  useEffect(() => {
    if (onViewportChange && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      onViewportChange({
        offset,
        zoom,
        canvasSize: { width: rect.width, height: rect.height }
      });
    }
  }, [offset, zoom, onViewportChange]);
  
  // Load sprite images with red background filtering
  useEffect(() => {
    const loadImages = async () => {
      // Load water texture first
      try {
        await loadImage(WATER_ASSET_PATH);
        setImageLoadVersion(v => v + 1);
      } catch (error) {
        console.error('Failed to load water texture:', error);
      }
      
      // Load IsoCity sprite sheet for trees
      try {
        await loadSpriteImage(ISOCITY_SPRITE_PATH, true);
        setImageLoadVersion(v => v + 1);
      } catch (error) {
        console.error('Failed to load IsoCity sprites:', error);
      }

      // Load IsoCity parks sprite sheet for pier/dock
      try {
        await loadSpriteImage(ISOCITY_PARKS_PATH, true);
        setImageLoadVersion(v => v + 1);
      } catch (error) {
        console.error('Failed to load IsoCity parks sprites:', error);
      }

      // Load IsoCity construction sprite sheet
      try {
        await loadSpriteImage(ISOCITY_CONSTRUCTION_PATH, true);
        setImageLoadVersion(v => v + 1);
      } catch (error) {
        console.error('Failed to load IsoCity construction sprites:', error);
      }
      
      // Load IsoCity farm sprite sheet
      try {
        await loadSpriteImage(ISOCITY_FARM_PATH, true);
        setImageLoadVersion(v => v + 1);
      } catch (error) {
        console.error('Failed to load IsoCity farm sprites:', error);
      }

      // Load IsoCity airport sprite
      try {
        await loadSpriteImage(ISOCITY_AIRPORT_PATH, true);
        setImageLoadVersion(v => v + 1);
      } catch (error) {
        console.error('Failed to load IsoCity airport sprite:', error);
      }

      // Load Medieval sheet for fallback tower/fort sprites
      try {
        await loadSpriteImage(MEDIEVAL_SHEET_PATH, true);
        setImageLoadVersion(v => v + 1);
      } catch (error) {
        console.error('Failed to load Medieval sheet for towers:', error);
      }

      // Load dense/high-rise sheet for modern city centers
      try {
        await loadSpriteImage(ISOCITY_DENSE_PATH, true);
        setImageLoadVersion(v => v + 1);
      } catch (error) {
        console.error('Failed to load dense buildings sheet:', error);
      }

      // Load age sprite sheets
      const imagesToLoad = Object.values(AGE_SPRITE_PACKS).map(pack => pack.src);
      
      for (const src of imagesToLoad) {
        if (!imagesLoadedRef.current.has(src)) {
          try {
            await loadSpriteImage(src, true); // true = apply red background filter
            imagesLoadedRef.current.add(src);
            setImageLoadVersion(v => v + 1);
          } catch (error) {
            console.error(`Failed to load sprite: ${src}`, error);
          }
        }
      }
    };
    
    loadImages();
    
    // Subscribe to image load events
    const unsubscribe = onImageLoaded(() => {
      setImageLoadVersion(v => v + 1);
    });
    
    return unsubscribe;
  }, []);
  
  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // Convert to grid coordinates using IsoCity's system
    const { gridX, gridY } = screenToGrid(
      screenX / zoomRef.current,
      screenY / zoomRef.current,
      offsetRef.current.x / zoomRef.current,
      offsetRef.current.y / zoomRef.current
    );
    
    if (e.button === 2 || (e.button === 0 && e.shiftKey) || (e.button === 0 && (e.ctrlKey || e.metaKey))) {
      // Right-click or Ctrl/Cmd+click: move, gather, or attack
      e.preventDefault();
      
      if (state.selectedUnitIds.length > 0) {
        const gameState = latestStateRef.current;
        
        // Use findBuildingOrigin to handle multi-tile buildings (clicking any part of 2x2, 3x3, etc.)
        const buildingOrigin = findBuildingOrigin(gridX, gridY, gameState.grid);
        
        if (buildingOrigin) {
          const originTile = gameState.grid[buildingOrigin.originY]?.[buildingOrigin.originX];
          const buildingType = buildingOrigin.buildingType;
          
          // Check if it's an enemy building - attack
          if (originTile?.ownerId && originTile.ownerId !== gameState.currentPlayerId) {
            attackTarget({ x: buildingOrigin.originX, y: buildingOrigin.originY });
          } 
          // Check if it's our own economic building - assign gather task
          else if (originTile?.ownerId === gameState.currentPlayerId) {
            // Determine gather task based on building type
            let gatherTask: string | null = null;
            
            if (buildingType === 'farm') {
              gatherTask = 'gather_food';
            } else if (buildingType === 'woodcutters_camp' || buildingType === 'lumber_mill') {
              gatherTask = 'gather_wood';
            } else if (buildingType === 'mine' || buildingType === 'smelter') {
              gatherTask = 'gather_metal';
            } else if (buildingType === 'market') {
              gatherTask = 'gather_gold';
            } else if (buildingType === 'oil_well' || buildingType === 'oil_platform' || buildingType === 'refinery') {
              gatherTask = 'gather_oil';
            }
            
            if (gatherTask) {
              assignTask(gatherTask as import('../types/units').UnitTask, { x: buildingOrigin.originX, y: buildingOrigin.originY });
            } else {
              // It's our building but not economic - just move near it
              moveSelectedUnits(gridX, gridY);
            }
          } else {
            // Neutral building or no owner - move there
            moveSelectedUnits(gridX, gridY);
          }
        } else {
          // No building - check terrain for naval units
          const tile = gameState.grid[gridY]?.[gridX];
          
          // Get selected units and check if any are naval
          const selectedUnits = gameState.units.filter(u => u.isSelected);
          const hasNavalUnits = selectedUnits.some(u => UNIT_STATS[u.type]?.isNaval);
          const hasLandUnits = selectedUnits.some(u => !UNIT_STATS[u.type]?.isNaval);
          const hasFishingBoats = selectedUnits.some(u => u.type === 'fishing_boat');
          
          // If we have naval units, target must be water
          // If we have land units, target must be land
          const isWaterTile = tile?.terrain === 'water';
          
          // Check if clicking on a fishing spot with fishing boats selected
          if (hasFishingBoats && isWaterTile && tile?.hasFishingSpot) {
            // Assign fishing task to fishing boats
            assignTask('gather_fish' as import('../types/units').UnitTask, { x: gridX, y: gridY });
          } else if (hasNavalUnits && !hasLandUnits) {
            // Only naval units selected - must click on water
            if (isWaterTile) {
              moveSelectedUnits(gridX, gridY);
            }
            // Clicking on land with naval units - do nothing (invalid move)
          } else if (hasLandUnits && !hasNavalUnits) {
            // Only land units selected - must click on land
            if (!isWaterTile) {
              moveSelectedUnits(gridX, gridY);
            }
            // Clicking on water with land units - do nothing (invalid move)
          } else if (hasNavalUnits && hasLandUnits) {
            // Mixed selection - move to appropriate terrain
            // Naval units will only move if target is water, land units if target is land
            moveSelectedUnits(gridX, gridY);
          } else {
            // No units or other case - just move
            moveSelectedUnits(gridX, gridY);
          }
        }
      }
      return;
    }
    
    if (e.button === 1 || e.altKey) {
      // Middle-click or alt: start panning
      isPanningRef.current = true;
      panStartRef.current = { 
        x: e.clientX, 
        y: e.clientY,
        offsetX: offsetRef.current.x,
        offsetY: offsetRef.current.y,
      };
      return;
    }
    
    if (e.button === 0) {
      // Left-click
      const currentTool = state.selectedTool;

      if (currentTool === 'build_road') {
        // Start road drag (like IsoCity)
        isRoadDraggingRef.current = true;
        roadDragStartRef.current = { x: gridX, y: gridY };
        setRoadDragEnd({ x: gridX, y: gridY });
        setRoadDrawDirection(null);
        placedRoadTilesRef.current.clear();
        
        // Place road at initial position
        const gameState = latestStateRef.current;
        if (isBuildingPlacementValid('road', gridX, gridY, gameState.grid, gameState.gridSize)) {
          placeBuilding(gridX, gridY, 'road');
          placedRoadTilesRef.current.add(`${gridX},${gridY}`);
        }
      } else if (currentTool.startsWith('build_')) {
        // Other building placement (single click)
        const toolInfo = RON_TOOL_INFO[currentTool];
        if (toolInfo?.buildingType) {
          const gameState = latestStateRef.current;
          // Check if placement is valid (pass current player ID for territory check)
          if (isBuildingPlacementValid(toolInfo.buildingType, gridX, gridY, gameState.grid, gameState.gridSize, gameState.currentPlayerId)) {
            placeBuilding(gridX, gridY, toolInfo.buildingType);
          }
          // If invalid, do nothing (red highlight on hover shows it's not allowed)
        }
      } else {
        // Default mode (no building tool) - start selection box
        isSelectingRef.current = true;
        selectionStartScreenRef.current = { x: screenX, y: screenY };
        setSelectionBox({ startX: screenX, startY: screenY, endX: screenX, endY: screenY });
      }
    }
  }, [state.selectedTool, state.selectedUnitIds, placeBuilding, moveSelectedUnits, attackTarget, latestStateRef]);
  
  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // Update hovered tile
    const { gridX, gridY } = screenToGrid(
      screenX / zoomRef.current,
      screenY / zoomRef.current,
      offsetRef.current.x / zoomRef.current,
      offsetRef.current.y / zoomRef.current
    );
    
    const gameState = latestStateRef.current;
    if (gridX >= 0 && gridX < gameState.gridSize && gridY >= 0 && gridY < gameState.gridSize) {
      setHoveredTile({ x: gridX, y: gridY });
    } else {
      setHoveredTile(null);
    }
    
    // Handle panning
    if (isPanningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setOffset({
        x: panStartRef.current.offsetX + dx,
        y: panStartRef.current.offsetY + dy,
      });
    }
    
    // Handle selection box
    if (isSelectingRef.current && selectionStartScreenRef.current) {
      setSelectionBox({
        startX: selectionStartScreenRef.current.x,
        startY: selectionStartScreenRef.current.y,
        endX: screenX,
        endY: screenY,
      });
    }
    
    // Handle road dragging (like IsoCity - with direction locking)
    if (isRoadDraggingRef.current && roadDragStartRef.current) {
      const startTile = roadDragStartRef.current;
      const dx = Math.abs(gridX - startTile.x);
      const dy = Math.abs(gridY - startTile.y);
      
      // Lock direction after moving at least 1 tile
      let direction = roadDrawDirection;
      if (!direction && (dx > 0 || dy > 0)) {
        direction = dx >= dy ? 'h' : 'v';
        setRoadDrawDirection(direction);
      }
      
      // Snap to locked direction
      let endX = gridX;
      let endY = gridY;
      if (direction === 'h') {
        endY = startTile.y;
      } else if (direction === 'v') {
        endX = startTile.x;
      }
      
      setRoadDragEnd({ x: endX, y: endY });
      
      // Place roads along the line
      const minX = Math.min(startTile.x, endX);
      const maxX = Math.max(startTile.x, endX);
      const minY = Math.min(startTile.y, endY);
      const maxY = Math.max(startTile.y, endY);
      
      const gameState = latestStateRef.current;
      
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const key = `${x},${y}`;
          if (!placedRoadTilesRef.current.has(key)) {
            // Check if valid placement (skip water, existing buildings, etc.)
            if (isBuildingPlacementValid('road', x, y, gameState.grid, gameState.gridSize)) {
              const tile = gameState.grid[y]?.[x];
              // Don't place on water or existing non-road buildings
              if (tile && tile.terrain !== 'water' && 
                  (!tile.building || tile.building.type === 'grass' || tile.building.type === 'empty')) {
                placeBuilding(x, y, 'road');
              }
            }
            placedRoadTilesRef.current.add(key);
          }
        }
      }
    }
  }, [latestStateRef, roadDrawDirection, placeBuilding]);
  
  // Handle mouse up
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // End panning
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
    }
    
    // End road dragging
    if (isRoadDraggingRef.current) {
      isRoadDraggingRef.current = false;
      roadDragStartRef.current = null;
      setRoadDragEnd(null);
      setRoadDrawDirection(null);
      placedRoadTilesRef.current.clear();
    }
    
    // End selection
    if (isSelectingRef.current && selectionBox) {
      const rect = canvas.getBoundingClientRect();
      const { startX, startY, endX, endY } = selectionBox;
      
      // Check if it was a click (small movement) or a drag
      // Use a very small threshold to distinguish click from drag
      const dx = Math.abs(endX - startX);
      const dy = Math.abs(endY - startY);
      
      
      if (dx < 3 && dy < 3) {
        // Single click - select building only (units require drag box selection)
        const { gridX, gridY } = screenToGrid(
          startX / zoomRef.current,
          startY / zoomRef.current,
          offsetRef.current.x / zoomRef.current,
          offsetRef.current.y / zoomRef.current
        );

        const gameState = latestStateRef.current;
        const gx = Math.floor(gridX);
        const gy = Math.floor(gridY);

        // Use findBuildingOrigin to handle multi-tile buildings (like IsoCity)
        // This searches backwards to find if this tile is part of a larger building
        const origin = findBuildingOrigin(gx, gy, gameState.grid);
        
        if (origin) {
          // Verify ownership before selecting
          const originTile = gameState.grid[origin.originY]?.[origin.originX];
          if (originTile?.ownerId === gameState.currentPlayerId ||
              originTile?.building?.ownerId === gameState.currentPlayerId) {
            selectBuilding({ x: origin.originX, y: origin.originY });
            selectUnits([]);
          } else {
            // Building exists but belongs to enemy - don't select, just deselect
            selectUnits([]);
            selectBuilding(null);
          }
        } else {
          // Clicked on empty tile - deselect everything
          selectUnits([]);
          selectBuilding(null);
        }
      } else {
        // Box selection - convert screen box to raw grid coordinates (non-rounded)
        // This gives us precise area bounds for accurate unit selection
        const startGrid = screenToGridRaw(
          startX / zoomRef.current,
          startY / zoomRef.current,
          offsetRef.current.x / zoomRef.current,
          offsetRef.current.y / zoomRef.current
        );
        const endGrid = screenToGridRaw(
          endX / zoomRef.current,
          endY / zoomRef.current,
          offsetRef.current.x / zoomRef.current,
          offsetRef.current.y / zoomRef.current
        );
        
        selectUnitsInArea(
          { x: startGrid.gridX, y: startGrid.gridY },
          { x: endGrid.gridX, y: endGrid.gridY }
        );
      }
      
      isSelectingRef.current = false;
      selectionStartScreenRef.current = null;
      setSelectionBox(null);
    }
  }, [selectionBox, selectUnits, selectUnitsInArea, selectBuilding, latestStateRef]);
  
  // Handle wheel zoom (matching IsoCity's smoother zoom)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    // Use smaller base delta and scale by current zoom for consistent feel
    const baseZoomDelta = 0.05;
    const scaledDelta = baseZoomDelta * Math.max(0.5, zoomRef.current);
    const zoomDelta = e.deltaY > 0 ? -scaledDelta : scaledDelta;
    setZoom(prev => Math.max(0.3, Math.min(3, prev + zoomDelta)));
  }, []);
  
  // Handle context menu (prevent default)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);
  
  // Navigation
  useEffect(() => {
    if (navigationTarget && canvasRef.current) {
      const canvas = canvasRef.current;
      const { screenX, screenY } = gridToScreen(
        navigationTarget.x,
        navigationTarget.y,
        0,
        0
      );
      
      const dpr = window.devicePixelRatio || 1;
      setOffset({
        x: (canvas.width / dpr / 2) - screenX * zoom,
        y: (canvas.height / dpr / 2) - screenY * zoom,
      });
      onNavigationComplete?.();
    }
  }, [navigationTarget, zoom, onNavigationComplete]);

  // Keyboard handler for ESC and other shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Deselect building if selected
        if (selectedBuildingPos) {
          selectBuilding(null);
        }
        // Deselect units
        selectUnits([]);
        // Reset to default tool (no building placement)
        setTool('none');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedBuildingPos, selectBuilding, selectUnits, setTool]);
  
  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Resize handler
    const resize = () => {
      setupCanvas(canvas, container);
    };
    resize();
    window.addEventListener('resize', resize);
    
    let animationId: number;
    
    const render = () => {
      const gameState = latestStateRef.current;
      const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
      const currentOffset = offsetRef.current;
      const currentZoom = zoomRef.current;
      const dpr = window.devicePixelRatio || 1;
      
      // Calculate delta time for animations
      const now = performance.now();
      const delta = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;
      fireAnimTimeRef.current += delta;
      
      // PERF: Pre-compute city centers ONCE per frame for all territory lookups
      const cityCenters = extractCityCenters(gameState.grid, gameState.gridSize);
      
      // Disable image smoothing for crisp pixel art
      ctx.imageSmoothingEnabled = false;
      
      // Draw sky background with enhanced atmospheric gradient
      drawEnhancedSkyBackground(ctx, canvas, 'day');
      
      // Animation time for water and effects
      const animTime = performance.now() / 1000;
      
      // Get sprite sheet for current player's age
      const playerAge = currentPlayer?.age || 'classical';
      const spritePack = AGE_SPRITE_PACKS[playerAge];
      const spriteSheet = getCachedImage(spritePack?.src || '', true);
      
      // Calculate view bounds for culling
      const viewBounds = calculateViewBounds(canvas, {
        offsetX: currentOffset.x,
        offsetY: currentOffset.y,
        zoom: currentZoom,
      });
      
      ctx.save();
      ctx.scale(dpr * currentZoom, dpr * currentZoom);
      ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
      
      // First pass: Draw terrain tiles (grass, water)
      for (let y = 0; y < gameState.gridSize; y++) {
        for (let x = 0; x < gameState.gridSize; x++) {
          const tile = gameState.grid[y]?.[x];
          if (!tile) continue;
          
          // Get screen position using IsoCity's coordinate system
          const { screenX, screenY } = gridToScreen(x, y, 0, 0);
          
          // Cull off-screen tiles
          if (!isTileVisible(screenX, screenY, viewBounds)) continue;
          
          const isHovered = hoveredTile?.x === x && hoveredTile?.y === y;
          const isSelected = gameState.selectedBuildingPos?.x === x && 
                            gameState.selectedBuildingPos?.y === y;
          
          // Check if this tile is part of a dock (draw water instead of green base)
          const isPartOfDock = hasDock(gameState.grid, x, y, gameState.gridSize);
          
          // Draw terrain with enhanced realistic graphics
          if (tile.terrain === 'water') {
            // Check adjacent water tiles
            const adjacentWater = {
              north: x > 0 && gameState.grid[y]?.[x - 1]?.terrain === 'water',
              east: y > 0 && gameState.grid[y - 1]?.[x]?.terrain === 'water',
              south: x < gameState.gridSize - 1 && gameState.grid[y]?.[x + 1]?.terrain === 'water',
              west: y < gameState.gridSize - 1 && gameState.grid[y + 1]?.[x]?.terrain === 'water',
            };
            // Use enhanced realistic water rendering
            drawRealisticWaterTile(ctx, { screenX, screenY, gridX: x, gridY: y, animTime, zoom: currentZoom, adjacentWater });
            
            // Draw fishing spot indicator
            if (tile.hasFishingSpot) {
              const cx = screenX + TILE_WIDTH / 2;
              const cy = screenY + TILE_HEIGHT / 2;
              
              // Draw ripples/fish silhouette
              ctx.save();
              ctx.globalAlpha = 0.5;
              
              // Draw concentric ripples
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 0.8;
              
              // Animated ripple effect based on tile position
              const time = performance.now() / 1000;
              const phase = ((x + y) * 0.3 + time) % (Math.PI * 2);
              const rippleSize = 3 + Math.sin(phase) * 2;
              
              ctx.beginPath();
              ctx.ellipse(cx, cy, rippleSize * 2, rippleSize, 0, 0, Math.PI * 2);
              ctx.stroke();
              
              ctx.beginPath();
              ctx.ellipse(cx, cy, rippleSize * 3.5, rippleSize * 1.75, 0, 0, Math.PI * 2);
              ctx.stroke();
              
              // Draw small fish silhouette
              ctx.fillStyle = '#4a90a4';
              ctx.globalAlpha = 0.4;
              const fishX = cx + Math.sin(phase * 2) * 4;
              const fishY = cy + Math.cos(phase) * 2;
              
              // Fish body (ellipse)
              ctx.beginPath();
              ctx.ellipse(fishX, fishY, 4, 2, Math.sin(phase) * 0.3, 0, Math.PI * 2);
              ctx.fill();
              
              // Fish tail
              ctx.beginPath();
              ctx.moveTo(fishX - 4, fishY);
              ctx.lineTo(fishX - 7, fishY - 2);
              ctx.lineTo(fishX - 7, fishY + 2);
              ctx.closePath();
              ctx.fill();
              
              ctx.restore();
            }
          } else if (isPartOfDock) {
            // Draw water tile for dock footprint (like IsoCity marina)
            // Check adjacent water for proper blending
            const adjacentWater = {
              north: x > 0 && (gameState.grid[y]?.[x - 1]?.terrain === 'water' || hasDock(gameState.grid, x - 1, y, gameState.gridSize)),
              east: y > 0 && (gameState.grid[y - 1]?.[x]?.terrain === 'water' || hasDock(gameState.grid, x, y - 1, gameState.gridSize)),
              south: x < gameState.gridSize - 1 && (gameState.grid[y]?.[x + 1]?.terrain === 'water' || hasDock(gameState.grid, x + 1, y, gameState.gridSize)),
              west: y < gameState.gridSize - 1 && (gameState.grid[y + 1]?.[x]?.terrain === 'water' || hasDock(gameState.grid, x, y + 1, gameState.gridSize)),
            };
            // Use enhanced realistic water rendering
            drawRealisticWaterTile(ctx, { screenX, screenY, gridX: x, gridY: y, animTime, zoom: currentZoom, adjacentWater });
          } else {
            // Draw terrain with enhanced realistic graphics
            if (tile.hasMetalDeposit) {
              // Use enhanced realistic mountain/ore deposit rendering
              drawRealisticMountain(ctx, screenX, screenY, x, y, true, currentZoom);
            } else if (tile.hasOilDeposit) {
              // Draw enhanced grass base first
              drawRealisticGrassTile(ctx, { screenX, screenY, gridX: x, gridY: y, zoom: currentZoom });
              
              // Only show oil in industrial+ ages
              const isIndustrial = AGE_ORDER.indexOf(playerAge) >= AGE_ORDER.indexOf('industrial');
              if (isIndustrial) {
                // Deterministic seed for this tile
                const seed = x * 31 + y * 17;
                
                // Generate 4-6 overlapping oil splotches of similar sizes
                const numSplotches = 4 + (seed % 3);
                
                const tileCx = screenX + TILE_WIDTH / 2;
                const tileCy = screenY + TILE_HEIGHT / 2;
                
                // Draw dark oil splotches
                for (let i = 0; i < numSplotches; i++) {
                  const splotchSeed = seed * 7 + i * 13;
                  const baseSize = 0.08 + (splotchSeed % 60) / 1000;
                  const splotchDx = ((splotchSeed % 70) - 35) / 100 * TILE_WIDTH * 0.55;
                  const splotchDy = ((splotchSeed * 3 % 50) - 25) / 100 * TILE_HEIGHT * 0.55;
                  const splotchW = TILE_WIDTH * baseSize;
                  const splotchH = TILE_HEIGHT * (baseSize * 0.8 + (splotchSeed * 2 % 30) / 1000);
                  const splotchAngle = ((splotchSeed * 5) % 90 - 45) * Math.PI / 180;
                  
                  const px = tileCx + splotchDx;
                  const py = tileCy + splotchDy;
                  
                  // Dark oil with slight color variation
                  const darkness = 12 + (i * 2 % 8);
                  ctx.fillStyle = `rgb(${darkness}, ${darkness + 2}, ${darkness + 6})`;
                  ctx.beginPath();
                  ctx.ellipse(px, py, splotchW, splotchH, splotchAngle, 0, Math.PI * 2);
                  ctx.fill();
                  
                  // Subtle glossy highlight
                  ctx.fillStyle = 'rgba(60, 60, 80, 0.2)';
                  ctx.beginPath();
                  ctx.ellipse(px - splotchW * 0.2, py - splotchH * 0.2, splotchW * 0.4, splotchH * 0.3, splotchAngle, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            } else if (tile.forestDensity > 0) {
              // Use enhanced realistic procedural forest rendering
              drawRealisticForest(ctx, { screenX, screenY, gridX: x, gridY: y, forestDensity: tile.forestDensity, zoom: currentZoom, animTime });
            } else if (tile.building?.type === 'road') {
              // Draw enhanced grass base under roads
              drawRealisticGrassTile(ctx, { screenX, screenY, gridX: x, gridY: y, zoom: currentZoom });
            } else {
              // Regular grass tile with enhanced realistic rendering
              drawRealisticGrassTile(ctx, { screenX, screenY, gridX: x, gridY: y, zoom: currentZoom });
            }
            
            // Ownership tint overlay (skip for roads)
            if (tile.ownerId && tile.building?.type !== 'road') {
              const playerIndex = gameState.players.findIndex(p => p.id === tile.ownerId);
              if (playerIndex >= 0) {
                ctx.fillStyle = PLAYER_COLORS[playerIndex] + '33';
                ctx.beginPath();
                ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
                ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
                ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
                ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
                ctx.closePath();
                ctx.fill();
              }
            }
          }
          
          // Draw hover/selection highlight
          if (isHovered) {
            // Check if we're in building mode and if placement would be invalid
            const currentTool = gameState.selectedTool;
            const toolInfo = RON_TOOL_INFO[currentTool];
            if (toolInfo?.buildingType) {
              // Building placement mode - check if valid (including territory)
              const isValidPlacement = isBuildingPlacementValid(
                toolInfo.buildingType,
                x,
                y,
                gameState.grid,
                gameState.gridSize,
                gameState.currentPlayerId,
                cityCenters
              );
              drawTileHighlight(ctx, screenX, screenY, isValidPlacement ? 'hover' : 'invalid');
            } else {
              drawTileHighlight(ctx, screenX, screenY, 'hover');
            }
          } else if (isSelected) {
            drawTileHighlight(ctx, screenX, screenY, 'selected');
          }
          
          // Draw road drag preview
          if (isRoadDraggingRef.current && roadDragStartRef.current && roadDragEnd) {
            const startTile = roadDragStartRef.current;
            const minX = Math.min(startTile.x, roadDragEnd.x);
            const maxX = Math.max(startTile.x, roadDragEnd.x);
            const minY = Math.min(startTile.y, roadDragEnd.y);
            const maxY = Math.max(startTile.y, roadDragEnd.y);
            
            // Check if this tile is in the road drag path
            if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
              // Check if already placed
              const key = `${x},${y}`;
              if (!placedRoadTilesRef.current.has(key)) {
                // Draw preview highlight
                const isValid = isBuildingPlacementValid('road', x, y, gameState.grid, gameState.gridSize) &&
                                tile.terrain !== 'water' &&
                                (!tile.building || tile.building.type === 'grass' || tile.building.type === 'empty');
                drawTileHighlight(ctx, screenX, screenY, isValid ? 'hover' : 'invalid');
              }
            }
          }
        }
      }
      
      // Beach pass: Draw beaches on water tiles adjacent to land (like IsoCity)
      // Exclude beaches next to docks (like IsoCity does for marina/pier)
      for (let y = 0; y < gameState.gridSize; y++) {
        for (let x = 0; x < gameState.gridSize; x++) {
          const tile = gameState.grid[y]?.[x];
          if (!tile || tile.terrain !== 'water') continue;

          const { screenX, screenY } = gridToScreen(x, y, 0, 0);
          if (!isTileVisible(screenX, screenY, viewBounds)) continue;

          // Check which adjacent tiles are land (not water) AND not part of a dock
          const adjacentLand = {
            north: x > 0 && 
                   gameState.grid[y]?.[x - 1]?.terrain !== 'water' && 
                   !hasDock(gameState.grid, x - 1, y, gameState.gridSize),
            east: y > 0 && 
                  gameState.grid[y - 1]?.[x]?.terrain !== 'water' && 
                  !hasDock(gameState.grid, x, y - 1, gameState.gridSize),
            south: x < gameState.gridSize - 1 && 
                   gameState.grid[y]?.[x + 1]?.terrain !== 'water' && 
                   !hasDock(gameState.grid, x + 1, y, gameState.gridSize),
            west: y < gameState.gridSize - 1 && 
                  gameState.grid[y + 1]?.[x]?.terrain !== 'water' && 
                  !hasDock(gameState.grid, x, y + 1, gameState.gridSize),
          };

          // Draw beach if any adjacent tile is land (and not a dock)
          // Use enhanced realistic beach rendering
          if (adjacentLand.north || adjacentLand.east || adjacentLand.south || adjacentLand.west) {
            drawRealisticBeach(ctx, screenX, screenY, x, y, adjacentLand, currentZoom, animTime);
          }
        }
      }
      
      // Territory borders pass: Draw warring-states style borders where territories meet
      // Build a territory ownership map and draw border lines between different owners
      ctx.save();

      // Cache territory ownership for visible tiles to avoid recalculating
      // Uses cityCenters already pre-computed at start of render
      const territoryCache: Map<string, string | null> = new Map();
      const getTileOwner = (gx: number, gy: number): string | null => {
        const key = `${gx},${gy}`;
        if (territoryCache.has(key)) {
          return territoryCache.get(key) || null;
        }
        // Pass pre-computed city centers for O(k) instead of O(n²) lookup
        const owner = getTerritoryOwner(gameState.grid, gameState.gridSize, gx, gy, cityCenters);
        territoryCache.set(key, owner);
        return owner;
      };
      
      // Draw subtle territory fill and border lines
      for (let y = 0; y < gameState.gridSize; y++) {
        for (let x = 0; x < gameState.gridSize; x++) {
          const { screenX, screenY } = gridToScreen(x, y, 0, 0);
          if (!isTileVisible(screenX, screenY, viewBounds)) continue;
          
          const owner = getTileOwner(x, y);
          if (!owner) continue; // No territory here
          
          const playerIndex = gameState.players.findIndex(p => p.id === owner);
          const baseColor = PLAYER_COLORS[playerIndex] || '#ffffff';
          
          // Subtle territory fill
          ctx.fillStyle = `${baseColor}10`;
          ctx.beginPath();
          ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
          ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
          ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
          ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
          ctx.closePath();
          ctx.fill();
          
          // Check neighbors for border edges
          // North neighbor (x-1, y)
          const northOwner = getTileOwner(x - 1, y);
          // East neighbor (x, y-1)
          const eastOwner = getTileOwner(x, y - 1);
          // South neighbor (x+1, y)
          const southOwner = getTileOwner(x + 1, y);
          // West neighbor (x, y+1)
          const westOwner = getTileOwner(x, y + 1);
          
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = `${baseColor}CC`;
          
          // Draw border line on edges where territory changes
          // North edge (top-left edge of diamond)
          if (northOwner !== owner) {
            ctx.beginPath();
            ctx.moveTo(screenX, screenY + TILE_HEIGHT / 2);
            ctx.lineTo(screenX + TILE_WIDTH / 2, screenY);
            ctx.stroke();
          }
          
          // East edge (top-right edge of diamond)
          if (eastOwner !== owner) {
            ctx.beginPath();
            ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
            ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
            ctx.stroke();
          }
          
          // South edge (bottom-right edge of diamond)
          if (southOwner !== owner) {
            ctx.beginPath();
            ctx.moveTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
            ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
            ctx.stroke();
          }
          
          // West edge (bottom-left edge of diamond)
          if (westOwner !== owner) {
            ctx.beginPath();
            ctx.moveTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
            ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
            ctx.stroke();
          }
        }
      }
      
      ctx.restore();
      
      // Second pass: Draw roads (need special handling for corners/turns)
      for (let y = 0; y < gameState.gridSize; y++) {
        for (let x = 0; x < gameState.gridSize; x++) {
          const tile = gameState.grid[y]?.[x];
          if (!tile?.building || tile.building.type !== 'road') continue;
          
          const { screenX, screenY } = gridToScreen(x, y, 0, 0);
          if (!isTileVisible(screenX, screenY, viewBounds)) continue;
          
          // Draw road with proper corners/turns
          drawRoNRoad(ctx, screenX, screenY, x, y, gameState.grid, gameState.gridSize, playerAge);
        }
      }
      
      // Third pass: Draw buildings (after all terrain so they appear on top)
      for (let y = 0; y < gameState.gridSize; y++) {
        for (let x = 0; x < gameState.gridSize; x++) {
          const tile = gameState.grid[y]?.[x];
          if (!tile?.building || tile.building.type === 'road') continue; // Skip roads, drawn above
          
          const { screenX, screenY } = gridToScreen(x, y, 0, 0);
          if (!isTileVisible(screenX, screenY, viewBounds)) continue;
          
          // Draw building sprite
          const buildingType = tile.building.type as RoNBuildingType;
          
          // Draw grey base for Industrial and Modern era buildings (except farms, roads, etc.)
          const needsGreyBase = (playerAge === 'industrial' || playerAge === 'modern') && 
            buildingType !== 'farm' && 
            buildingType !== 'road' && 
            buildingType !== 'dock' &&
            buildingType !== 'woodcutters_camp';
          if (needsGreyBase) {
            const buildingStats = BUILDING_STATS[buildingType];
            const buildingSize = buildingStats?.size || { width: 1, height: 1 };
            drawGreyBase(ctx, screenX, screenY, buildingSize.width, buildingSize.height);
          }
          
          // Special handling for dock - use IsoCity marina sprite from parks sheet (2x2)
          // Water is already drawn in terrain pass for dock tiles
          if (buildingType === 'dock') {
            const parksSprite = getCachedImage(ISOCITY_PARKS_PATH, true);
            if (parksSprite) {
              // Marina is at row 4, col 0 in the 5x6 parks grid (2x2 building)
              const parksCols = 5;
              const parksRows = 6;
              const parksTileWidth = parksSprite.width / parksCols;
              const parksTileHeight = parksSprite.height / parksRows;

              const marinaRow = 4;
              const marinaCol = 0;
              const sx = marinaCol * parksTileWidth;
              const sy = marinaRow * parksTileHeight;

              // Get building size (2x2)
              const buildingStats = BUILDING_STATS[buildingType];
              const buildingSize = buildingStats?.size || { width: 2, height: 2 };

              // Calculate draw position for 2x2 building (like IsoCity)
              const frontmostOffsetX = buildingSize.width - 1;
              const frontmostOffsetY = buildingSize.height - 1;
              const screenOffsetX = (frontmostOffsetX - frontmostOffsetY) * (TILE_WIDTH / 2);
              const screenOffsetY = (frontmostOffsetX + frontmostOffsetY) * (TILE_HEIGHT / 2);
              const drawPosX = screenX + screenOffsetX;
              const drawPosY = screenY + screenOffsetY;

              // Draw marina sprite (no construction phase - instant placement)
              const scale = 1.1;
              const destWidth = TILE_WIDTH * scale * 2; // 2x2 building
              const destHeight = destWidth * (parksTileHeight / parksTileWidth);
              const verticalPush = (buildingSize.width + buildingSize.height - 2) * TILE_HEIGHT * 0.5;
              const buildingOffset = -0.45 * TILE_HEIGHT;
              
              const drawX = drawPosX + TILE_WIDTH / 2 - destWidth / 2;
              const drawY = drawPosY + TILE_HEIGHT - destHeight + verticalPush + buildingOffset;

              ctx.drawImage(
                parksSprite,
                sx, sy, parksTileWidth, parksTileHeight,
                drawX, drawY, destWidth, destHeight
              );
            }
            continue; // Skip regular sprite drawing for dock
          }
          
          // Special handling for Modern city centers - use random high-rise from dense sheet
          const isCityCenter = buildingType === 'city_center' || buildingType === 'small_city' || 
                               buildingType === 'large_city' || buildingType === 'major_city';
          if (isCityCenter && playerAge === 'modern') {
            const denseSprite = getCachedImage(ISOCITY_DENSE_PATH, true);
            if (denseSprite) {
              const denseCols = 5;
              const denseRows = 6;
              const denseTileWidth = denseSprite.width / denseCols;
              const denseTileHeight = denseSprite.height / denseRows;
              
              // Use position to get a consistent random high-rise for this building
              // Hash based on grid position so same building always gets same sprite
              const buildingHash = (x * 7919 + y * 6271) ^ (x * y);
              const highRiseIndex = Math.abs(buildingHash) % MODERN_HIGHRISES.length;
              const highRisePos = MODERN_HIGHRISES[highRiseIndex];
              
              const sx = highRisePos.col * denseTileWidth;
              const sy = highRisePos.row * denseTileHeight;
              
              // Get building size
              const buildingStats = BUILDING_STATS[buildingType];
              const buildingSize = buildingStats?.size || { width: 2, height: 2 };
              
              // Calculate draw position for multi-tile building
              const frontmostOffsetX = buildingSize.width - 1;
              const frontmostOffsetY = buildingSize.height - 1;
              const screenOffsetX = (frontmostOffsetX - frontmostOffsetY) * (TILE_WIDTH / 2);
              const screenOffsetY = (frontmostOffsetX + frontmostOffsetY) * (TILE_HEIGHT / 2);
              const drawPosX = screenX + screenOffsetX;
              const drawPosY = screenY + screenOffsetY;
              
              // Scale based on city type (larger cities = bigger buildings)
              const cityScales: Record<string, number> = {
                city_center: 1.0,
                small_city: 1.1,
                large_city: 1.25,
                major_city: 1.4,
              };
              const scale = (cityScales[buildingType] || 1.0) * 1.1;
              const destWidth = TILE_WIDTH * scale * 2;
              const destHeight = destWidth * (denseTileHeight / denseTileWidth);
              
              // Vertical positioning
              const footprintDepth = buildingSize.width + buildingSize.height - 2;
              const verticalPush = footprintDepth * TILE_HEIGHT * 0.25;
              
              // These high-rises are tall, need more offset
              const buildingOffset = -0.8 * TILE_HEIGHT;
              
              const drawX = drawPosX + TILE_WIDTH / 2 - destWidth / 2;
              const drawY = drawPosY + TILE_HEIGHT - destHeight + verticalPush + buildingOffset;
              
              ctx.drawImage(
                denseSprite,
                sx, sy, denseTileWidth, denseTileHeight,
                drawX, drawY, destWidth, destHeight
              );
              
              continue; // Skip regular sprite drawing for modern city center
            }
          }
          
          // Special handling for farm - use IsoCity farm sprite sheet with age-specific sprites
          if (buildingType === 'farm') {
            const farmSprite = getCachedImage(ISOCITY_FARM_PATH, true);
            if (farmSprite) {
              const farmTileWidth = farmSprite.width / FARM_SPRITE_COLS;
              const farmTileHeight = farmSprite.height / FARM_SPRITE_ROWS;

              // Get age-specific farm position and cropping
              // - Classical: Vineyard (row 3, col 1) - needs top crop
              // - Medieval: Windmill (row 2, col 4) - ICONIC!
              // - Enlightenment: Storage barn (row 2, col 2) - needs small top crop
              // - Industrial: Dairy farm with silo (row 1, col 0)
              // - Modern: Greenhouse (row 3, col 4)
              const farmPositions: Record<string, { row: number; col: number; cropTop?: number; offsetUp?: number }> = {
                classical: { row: 3, col: 1, cropTop: 0.12 },  // Crop 12% from top
                medieval: { row: 2, col: 4, cropTop: 0.05 },
                enlightenment: { row: 2, col: 2, cropTop: 0.08, offsetUp: 0.2 },
                industrial: { row: 1, col: 0 },
                modern: { row: 3, col: 4 },
              };
              const farmConfig = farmPositions[playerAge] || { row: 0, col: 1 };
              
              // Apply cropping to avoid asset above bleeding through
              const cropTop = (farmConfig.cropTop || 0) * farmTileHeight;
              const sx = farmConfig.col * farmTileWidth;
              const sy = farmConfig.row * farmTileHeight + cropTop;
              const srcHeight = farmTileHeight - cropTop;

              // 1x1 farm - scale to fit tile nicely
              const scale = 0.9;
              const destWidth = TILE_WIDTH * scale;
              const destHeight = destWidth * (srcHeight / farmTileWidth);

              // Vertical offset for 1x1 building
              const baseOffset = -0.2 * TILE_HEIGHT;
              const extraOffset = (farmConfig.offsetUp || 0) * TILE_HEIGHT;
              const buildingOffset = baseOffset - extraOffset;

              const drawX = screenX + TILE_WIDTH / 2 - destWidth / 2;
              const drawY = screenY + TILE_HEIGHT - destHeight + buildingOffset;

              // Farms are instant - no construction phase, always show farm sprite
              ctx.drawImage(
                farmSprite,
                sx, sy, farmTileWidth, srcHeight,
                drawX, drawY, destWidth, destHeight
              );
            }
            continue; // Skip regular sprite drawing for farm
          }
          
          // Special handling for airbase
          // Modern age has native airport sprite at (5,0), use IsoCity for other ages
          if (buildingType === 'airbase') {
            // Check if we have age-specific sprite (Modern has native airport)
            const ageAirbasePos = getAgeSpritePosition('airbase', playerAge);
            
            if (ageAirbasePos && spriteSheet) {
              // Use age-specific sprite (Modern age has proper airport)
              // Let it fall through to regular sprite rendering
            } else {
              // Use IsoCity airport sprite for pre-modern ages
              const airportSprite = getCachedImage(ISOCITY_AIRPORT_PATH, true);
              if (airportSprite) {
                // Get building size from BUILDING_STATS
                const buildingStats = BUILDING_STATS[buildingType];
                const buildingSize = buildingStats?.size || { width: 2, height: 2 };

                // Calculate draw position for multi-tile building
                const frontmostOffsetX = buildingSize.width - 1;
                const frontmostOffsetY = buildingSize.height - 1;
                const screenOffsetX = (frontmostOffsetX - frontmostOffsetY) * (TILE_WIDTH / 2);
                const screenOffsetY = (frontmostOffsetX + frontmostOffsetY) * (TILE_HEIGHT / 2);
                const drawPosX = screenX + screenOffsetX;
                const drawPosY = screenY + screenOffsetY;

                // Scale airport to fit
                const scale = 1.2;
                const destWidth = TILE_WIDTH * scale * buildingSize.width;
                const destHeight = destWidth * (airportSprite.height / airportSprite.width);

                // Vertical offset
                const buildingOffset = -0.6 * TILE_HEIGHT;

                const drawX = drawPosX + TILE_WIDTH / 2 - destWidth / 2;
                const drawY = drawPosY + TILE_HEIGHT - destHeight + buildingOffset;

                ctx.drawImage(
                  airportSprite,
                  0, 0, airportSprite.width, airportSprite.height,
                  drawX, drawY, destWidth, destHeight
                );
              }
              continue; // Skip regular sprite drawing for airbase (using IsoCity)
            }
          }
          
          // Special handling for tower and fort in Modern/Industrial/Enlightenment - use Medieval sprites
          // These ages have water towers instead of defensive towers, and poor fort sprites
          const needsMedievalFallback = 
            (buildingType === 'tower' || buildingType === 'fort' || buildingType === 'fortress') && 
            (playerAge === 'modern' || playerAge === 'industrial' || playerAge === 'enlightenment');
          
          if (needsMedievalFallback) {
            const medievalSheet = getCachedImage(MEDIEVAL_SHEET_PATH, true);
            if (medievalSheet) {
              // Medieval sheet is 5x6 grid
              const medCols = 5;
              const medRows = 6;
              const medTileWidth = medievalSheet.width / medCols;
              const medTileHeight = medievalSheet.height / medRows;
              
              // Medieval sprite positions for tower and fort
              // Tower: (0,1) - Stone defensive tower with battlements
              // Fort: (5,1) - Stone fortress compound
              const medievalPositions: Record<string, { row: number; col: number }> = {
                tower: { row: 0, col: 1 },
                fort: { row: 5, col: 1 },
                fortress: { row: 5, col: 1 },
              };
              const medPos = medievalPositions[buildingType] || { row: 0, col: 1 };
              
              const sx = medPos.col * medTileWidth;
              const sy = medPos.row * medTileHeight;
              
              // Get building size
              const buildingStats = BUILDING_STATS[buildingType];
              const buildingSize = buildingStats?.size || { width: 1, height: 1 };
              const isMultiTile = buildingSize.width > 1 || buildingSize.height > 1;
              
              // Calculate draw position
              let drawPosX = screenX;
              let drawPosY = screenY;
              
              if (isMultiTile) {
                const frontmostOffsetX = buildingSize.width - 1;
                const frontmostOffsetY = buildingSize.height - 1;
                const screenOffsetX = (frontmostOffsetX - frontmostOffsetY) * (TILE_WIDTH / 2);
                const screenOffsetY = (frontmostOffsetX + frontmostOffsetY) * (TILE_HEIGHT / 2);
                drawPosX = screenX + screenOffsetX;
                drawPosY = screenY + screenOffsetY;
              }
              
              // Scale like other buildings (with age-specific scale)
              const buildingBaseScale = BUILDING_SCALES[buildingType] || 1;
              const ageScale = AGE_BUILDING_SCALES[playerAge]?.[buildingType] || 1;
              const baseScale = buildingBaseScale * ageScale * 1.0;
              const sizeScale = isMultiTile ? Math.max(buildingSize.width, buildingSize.height) : 1;
              const scaleMultiplier = baseScale * sizeScale;
              
              const destWidth = TILE_WIDTH * 1.2 * scaleMultiplier;
              const aspectRatio = medTileHeight / medTileWidth;
              const destHeight = destWidth * aspectRatio;
              
              // Vertical positioning
              let verticalPush: number;
              if (isMultiTile) {
                const footprintDepth = buildingSize.width + buildingSize.height - 2;
                verticalPush = footprintDepth * TILE_HEIGHT * 0.25;
              } else {
                verticalPush = destHeight * 0.15;
              }
              
              // Apply building-specific vertical offset (base + age-specific)
              const baseVertOffset = BUILDING_VERTICAL_OFFSETS[buildingType] ?? 0;
              const ageVertOffset = AGE_VERTICAL_OFFSETS[playerAge]?.[buildingType] ?? 0;
              const vertOffset = baseVertOffset + ageVertOffset;
              verticalPush += vertOffset * TILE_HEIGHT;

              const drawX = drawPosX + TILE_WIDTH / 2 - destWidth / 2;
              const drawY = drawPosY + TILE_HEIGHT - destHeight + verticalPush;

              ctx.drawImage(
                medievalSheet,
                sx, sy, medTileWidth, medTileHeight,
                drawX, drawY, destWidth, destHeight
              );
              
              continue; // Skip regular sprite drawing
            }
          }
          
          if (spriteSheet) {
            // Use age-specific sprite position for better era-appropriate visuals
            const spritePos = getAgeSpritePosition(buildingType, playerAge);

            if (spritePos) {
              const tileWidth = spriteSheet.width / spritePack.cols;
              const tileHeight = spriteSheet.height / spritePack.rows;
              
              const sx = spritePos.col * tileWidth;
              const sy = spritePos.row * tileHeight;
              
              // Get building size from BUILDING_STATS (most are 2x2)
              const buildingStats = BUILDING_STATS[buildingType];
              const buildingSize = buildingStats?.size || { width: 1, height: 1 };
              const isMultiTile = buildingSize.width > 1 || buildingSize.height > 1;
              
              // Calculate base draw position - for multi-tile buildings, use frontmost tile
              let drawPosX = screenX;
              let drawPosY = screenY;
              
              if (isMultiTile) {
                // Offset to the frontmost tile of the building (like IsoCity)
                const frontmostOffsetX = buildingSize.width - 1;
                const frontmostOffsetY = buildingSize.height - 1;
                const screenOffsetX = (frontmostOffsetX - frontmostOffsetY) * (TILE_WIDTH / 2);
                const screenOffsetY = (frontmostOffsetX + frontmostOffsetY) * (TILE_HEIGHT / 2);
                drawPosX = screenX + screenOffsetX;
                drawPosY = screenY + screenOffsetY;
              }
              
              // Scale based on building size (with age-specific scale)
              const buildingBaseScale = BUILDING_SCALES[buildingType] || 1;
              const ageScale = AGE_BUILDING_SCALES[playerAge]?.[buildingType] || 1;
              const baseScale = buildingBaseScale * ageScale * spritePack.globalScale;
              const sizeScale = isMultiTile ? Math.max(buildingSize.width, buildingSize.height) : 1;
              const scaleMultiplier = baseScale * sizeScale;
              
              const destWidth = TILE_WIDTH * 1.2 * scaleMultiplier;
              const aspectRatio = tileHeight / tileWidth;
              const destHeight = destWidth * aspectRatio;
              
              // Calculate vertical push (like IsoCity)
              let verticalPush: number;
              if (isMultiTile) {
                const footprintDepth = buildingSize.width + buildingSize.height - 2;
                verticalPush = footprintDepth * TILE_HEIGHT * 0.25;
              } else {
                verticalPush = destHeight * 0.15;
              }
              
              // Apply building-specific vertical offset (base + age-specific)
              const baseVertOffset = BUILDING_VERTICAL_OFFSETS[buildingType] ?? 0;
              const ageVertOffset = AGE_VERTICAL_OFFSETS[playerAge]?.[buildingType] ?? 0;
              const vertOffset = baseVertOffset + ageVertOffset;
              verticalPush += vertOffset * TILE_HEIGHT;

              const drawX = drawPosX + TILE_WIDTH / 2 - destWidth / 2;
              const drawY = drawPosY + TILE_HEIGHT - destHeight + verticalPush;

              // Use construction sprite for buildings under construction
              const isUnderConstruction = tile.building.constructionProgress < 100;
              const constructionSprite = getCachedImage(ISOCITY_CONSTRUCTION_PATH, true);
              
              if (isUnderConstruction && constructionSprite) {
                // Use IsoCity construction sprite sheet with FIXED positions
                // The construction sheet has the same 5x6 grid layout as IsoCity sprites
                // We use generic construction/scaffolding sprites, NOT age-sheet positions
                const constrCols = 5;
                const constrRows = 6;
                const constrTileWidth = constructionSprite.width / constrCols;
                const constrTileHeight = constructionSprite.height / constrRows;
                
                // Map building types to appropriate IsoCity construction sprites
                // Based on building size and category:
                // - Small buildings (1x1): Use row 0, col 2 (small residential)
                // - Medium buildings (2x2): Use row 2, col 0 (medium house)
                // - Large buildings (3x3): Use row 4, col 3 (commercial/industrial)
                // - Military: Use row 3, col 1 (office/institutional)
                let constrRow = 2;
                let constrCol = 0;
                
                const buildingStats = BUILDING_STATS[buildingType];
                const bSize = buildingStats?.size || { width: 1, height: 1 };
                const isLarge = bSize.width >= 3 || bSize.height >= 3;
                const isSmall = bSize.width <= 1 && bSize.height <= 1;
                
                if (isSmall) {
                  constrRow = 0; constrCol = 2; // Small house construction
                } else if (isLarge) {
                  constrRow = 4; constrCol = 3; // Large building construction
                } else {
                  constrRow = 2; constrCol = 0; // Medium building construction
                }
                
                // Apply construction-specific cropping
                const cropTopFraction = CONSTRUCTION_CROP_TOP[buildingType] || 0;
                const cropBottomFraction = CONSTRUCTION_CROP_BOTTOM[buildingType] || 0;
                const constrVertOffset = CONSTRUCTION_VERTICAL_OFFSETS[buildingType] || 0;
                
                const cropTopPx = constrTileHeight * cropTopFraction;
                const cropBottomPx = constrTileHeight * cropBottomFraction;
                const actualSrcHeight = constrTileHeight - cropTopPx - cropBottomPx;
                
                const constrSx = constrCol * constrTileWidth;
                const constrSy = constrRow * constrTileHeight + cropTopPx;
                
                // Adjust destination size to maintain aspect ratio after cropping
                const cropRatio = actualSrcHeight / constrTileHeight;
                const adjustedDestHeight = destHeight * cropRatio;
                const constrDrawY = drawY + constrVertOffset * TILE_HEIGHT + (destHeight - adjustedDestHeight);
                
                ctx.drawImage(
                  constructionSprite,
                  constrSx, constrSy, constrTileWidth, actualSrcHeight,
                  drawX, constrDrawY, destWidth, adjustedDestHeight
                );
              } else {
                // Draw completed building normally
                ctx.drawImage(
                  spriteSheet,
                  sx, sy, tileWidth, tileHeight,
                  drawX, drawY, destWidth, destHeight
                );
              }

              // Fire effect and health bar for damaged buildings (under attack)
              if (tile.building.health < tile.building.maxHealth) {
                // Calculate fire intensity based on damage (more damage = more intense fire)
                const healthPercent = tile.building.health / tile.building.maxHealth;
                const fireIntensity = Math.min(1, (1 - healthPercent) * 1.5); // Scale up intensity
                
                // Draw fire effect at the center-top of the building
                drawFireEffect(ctx, screenX, screenY - destHeight / 2, fireAnimTimeRef.current, fireIntensity);
                
                // Draw health bar
                const barWidth = destWidth * 0.5;
                drawHealthBar(ctx, drawX + destWidth / 2 - barWidth / 2, drawY - 8, barWidth, healthPercent, 1);
              }
            }
          }
        }
      }
      
      // Fourth pass: Draw units with pedestrian-like sprites
      gameState.units.forEach(unit => {
        const { screenX, screenY } = gridToScreen(unit.x, unit.y, 0, 0);
        
        // Cull off-screen units
        if (!isTileVisible(screenX, screenY, viewBounds)) return;
        
        const playerIndex = gameState.players.findIndex(p => p.id === unit.ownerId);
        const color = PLAYER_COLORS[playerIndex] || '#ffffff';
        
        // Draw unit with pedestrian-like appearance and task activities
        drawRoNUnit(ctx, unit, 0, 0, currentZoom, color, gameState.tick);
      });
      
      ctx.restore();
      
      // Draw selection box (in screen space, not world space)
      if (selectionBox) {
        drawSelectionBox(
          ctx,
          selectionBox.startX * dpr,
          selectionBox.startY * dpr,
          selectionBox.endX * dpr,
          selectionBox.endY * dpr
        );
      }
      
      animationId = requestAnimationFrame(render);
    };
    
    render();
    
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [imageLoadVersion, hoveredTile, selectionBox, latestStateRef]);
  
  // Match IsoCity's canvas container structure
  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden touch-none"
      style={{ 
        cursor: isPanningRef.current ? 'grabbing' : 
                isSelectingRef.current ? 'crosshair' : 
                'default' 
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
    >
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0"
      />
    </div>
  );
}
