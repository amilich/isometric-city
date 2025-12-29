/**
 * Rise of Nations - Canvas Component
 * 
 * Renders the isometric game world using the shared IsoCity rendering system.
 * Properly handles green tiles, water, hover/selection, and sprite background filtering.
 */
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRoN } from '../context/RoNContext';
import { AGE_SPRITE_PACKS, BUILDING_SPRITE_MAP, BUILDING_VERTICAL_OFFSETS, BUILDING_SCALES, PLAYER_COLORS } from '../lib/renderConfig';
import { BUILDING_STATS } from '../types/buildings';
import { AGE_ORDER } from '../types/ages';
import { RoNBuildingType } from '../types/buildings';
import { RON_TOOL_INFO } from '../types/game';

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
} from '@/components/game/shared';
import { drawRoNUnit } from '../lib/drawUnits';

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
 * Used for validating woodcutter's camp placement.
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
 * Check if a building placement is valid at the given position.
 * Returns true if valid, false if invalid.
 */
function isBuildingPlacementValid(
  buildingType: RoNBuildingType,
  gridX: number,
  gridY: number,
  grid: import('../types/game').RoNTile[][],
  gridSize: number
): boolean {
  // Woodcutter's camp must be adjacent to forest
  if (buildingType === 'woodcutters_camp') {
    return isAdjacentToForest(gridX, gridY, grid, gridSize);
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

// Farm sprite configuration - use first row of 5 crops randomly
const FARM_SPRITE_COLS = 5;
const FARM_SPRITE_ROWS = 6;
const FARM_VARIANTS = 5; // Only use first row (5 variants)

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
 * Adapts style based on age (ancient = dirt, modern = asphalt).
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
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Check adjacency
  const hasRoad = (x: number, y: number) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return false;
    const tile = grid[y]?.[x];
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
  let roadHighlight: string;
  let roadShadow: string;
  let centerLineColor: string | null = null;

  if (ageIndex <= 1) {
    // Ancient/Classical - dirt road
    roadColor = '#9B8365';
    roadHighlight = '#B89B7A';
    roadShadow = '#7A6550';
  } else if (ageIndex <= 2) {
    // Medieval - cobblestone
    roadColor = '#7A7A7A';
    roadHighlight = '#9A9A9A';
    roadShadow = '#5A5A5A';
  } else if (ageIndex <= 3) {
    // Enlightenment - improved cobblestone
    roadColor = '#686868';
    roadHighlight = '#888888';
    roadShadow = '#484848';
  } else {
    // Industrial+ - asphalt with markings
    roadColor = '#4A4A4A';
    roadHighlight = '#5A5A5A';
    roadShadow = '#3A3A3A';
    centerLineColor = '#FFD700';
  }

  // Road width (narrower than full tile)
  const roadWidth = w * 0.38;

  // Diamond corner points (isometric tile edges)
  const topPt = { x: screenX + w / 2, y: screenY };
  const rightPt = { x: screenX + w, y: screenY + h / 2 };
  const bottomPt = { x: screenX + w / 2, y: screenY + h };
  const leftPt = { x: screenX, y: screenY + h / 2 };

  // Edge midpoints (where roads connect to neighbors)
  const northMid = { x: (leftPt.x + topPt.x) / 2, y: (leftPt.y + topPt.y) / 2 };
  const eastMid = { x: (topPt.x + rightPt.x) / 2, y: (topPt.y + rightPt.y) / 2 };
  const southMid = { x: (rightPt.x + bottomPt.x) / 2, y: (rightPt.y + bottomPt.y) / 2 };
  const westMid = { x: (bottomPt.x + leftPt.x) / 2, y: (bottomPt.y + leftPt.y) / 2 };

  // Draw base tile (grass under road)
  ctx.fillStyle = '#4a7c3f';
  ctx.beginPath();
  ctx.moveTo(topPt.x, topPt.y);
  ctx.lineTo(rightPt.x, rightPt.y);
  ctx.lineTo(bottomPt.x, bottomPt.y);
  ctx.lineTo(leftPt.x, leftPt.y);
  ctx.closePath();
  ctx.fill();

  // Helper to get road edge points perpendicular to a direction
  const getRoadEdgePoints = (fromX: number, fromY: number, toX: number, toY: number) => {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = (-dy / len) * (roadWidth / 2);
    const perpY = (dx / len) * (roadWidth / 2);
    return { perpX, perpY };
  };

  // Build a single unified road shape
  const roadPoints: { x: number; y: number }[] = [];
  const connections = [
    { connected: north, mid: northMid },
    { connected: east, mid: eastMid },
    { connected: south, mid: southMid },
    { connected: west, mid: westMid },
  ];

  const connectedDirs = connections.filter(c => c.connected);
  const numConnections = connectedDirs.length;

  // Draw unified road shape based on connections
  ctx.fillStyle = roadColor;

  if (numConnections === 0) {
    // No connections - draw a small diamond placeholder
    const size = roadWidth * 0.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.5);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size * 0.5);
    ctx.lineTo(cx - size, cy);
    ctx.closePath();
    ctx.fill();
  } else if (numConnections === 1) {
    // Dead end - draw road segment to the edge
    const dir = connectedDirs[0];
    const { perpX, perpY } = getRoadEdgePoints(cx, cy, dir.mid.x, dir.mid.y);
    
    ctx.beginPath();
    ctx.moveTo(dir.mid.x + perpX, dir.mid.y + perpY);
    ctx.lineTo(cx + perpX * 0.8, cy + perpY * 0.8);
    ctx.lineTo(cx - perpX * 0.8, cy - perpY * 0.8);
    ctx.lineTo(dir.mid.x - perpX, dir.mid.y - perpY);
    ctx.closePath();
    ctx.fill();
  } else {
    // Multiple connections - build a continuous road surface
    // Collect all the outer edge points going around the road
    const outerPoints: { x: number; y: number }[] = [];
    
    if (north) {
      const { perpX, perpY } = getRoadEdgePoints(cx, cy, northMid.x, northMid.y);
      outerPoints.push({ x: northMid.x + perpX, y: northMid.y + perpY });
      outerPoints.push({ x: northMid.x - perpX, y: northMid.y - perpY });
    } else {
      // No north connection - add center edge point
      const { perpX, perpY } = getRoadEdgePoints(cx, cy, northMid.x, northMid.y);
      outerPoints.push({ x: cx + perpX * 0.6, y: cy + perpY * 0.6 });
    }
    
    if (east) {
      const { perpX, perpY } = getRoadEdgePoints(cx, cy, eastMid.x, eastMid.y);
      outerPoints.push({ x: eastMid.x + perpX, y: eastMid.y + perpY });
      outerPoints.push({ x: eastMid.x - perpX, y: eastMid.y - perpY });
    } else {
      const { perpX, perpY } = getRoadEdgePoints(cx, cy, eastMid.x, eastMid.y);
      outerPoints.push({ x: cx + perpX * 0.6, y: cy + perpY * 0.6 });
    }
    
    if (south) {
      const { perpX, perpY } = getRoadEdgePoints(cx, cy, southMid.x, southMid.y);
      outerPoints.push({ x: southMid.x + perpX, y: southMid.y + perpY });
      outerPoints.push({ x: southMid.x - perpX, y: southMid.y - perpY });
    } else {
      const { perpX, perpY } = getRoadEdgePoints(cx, cy, southMid.x, southMid.y);
      outerPoints.push({ x: cx + perpX * 0.6, y: cy + perpY * 0.6 });
    }
    
    if (west) {
      const { perpX, perpY } = getRoadEdgePoints(cx, cy, westMid.x, westMid.y);
      outerPoints.push({ x: westMid.x + perpX, y: westMid.y + perpY });
      outerPoints.push({ x: westMid.x - perpX, y: westMid.y - perpY });
    } else {
      const { perpX, perpY } = getRoadEdgePoints(cx, cy, westMid.x, westMid.y);
      outerPoints.push({ x: cx + perpX * 0.6, y: cy + perpY * 0.6 });
    }

    // Draw the road surface
    if (outerPoints.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(outerPoints[0].x, outerPoints[0].y);
      for (let i = 1; i < outerPoints.length; i++) {
        ctx.lineTo(outerPoints[i].x, outerPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  // Add subtle shading/highlights
  ctx.strokeStyle = roadShadow;
  ctx.lineWidth = 1.5;
  
  // Draw edge lines only on outer edges (not between connected roads)
  if (north) {
    const { perpX, perpY } = getRoadEdgePoints(cx, cy, northMid.x, northMid.y);
    // Left edge highlight
    ctx.strokeStyle = roadHighlight;
    ctx.beginPath();
    ctx.moveTo(northMid.x + perpX, northMid.y + perpY);
    ctx.lineTo(cx + perpX * 0.7, cy + perpY * 0.7);
    ctx.stroke();
  }
  
  if (south) {
    const { perpX, perpY } = getRoadEdgePoints(cx, cy, southMid.x, southMid.y);
    // Right edge shadow
    ctx.strokeStyle = roadShadow;
    ctx.beginPath();
    ctx.moveTo(southMid.x - perpX, southMid.y - perpY);
    ctx.lineTo(cx - perpX * 0.7, cy - perpY * 0.7);
    ctx.stroke();
  }

  // Draw center line for modern roads (straight roads only)
  if (centerLineColor) {
    ctx.strokeStyle = centerLineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    if (north && south && !east && !west) {
      // Straight north-south
      ctx.beginPath();
      ctx.moveTo(northMid.x, northMid.y);
      ctx.lineTo(southMid.x, southMid.y);
      ctx.stroke();
    } else if (east && west && !north && !south) {
      // Straight east-west
      ctx.beginPath();
      ctx.moveTo(eastMid.x, eastMid.y);
      ctx.lineTo(westMid.x, westMid.y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }
}

interface RoNCanvasProps {
  navigationTarget?: { x: number; y: number } | null;
  onNavigationComplete?: () => void;
}

export function RoNCanvas({ navigationTarget, onNavigationComplete }: RoNCanvasProps) {
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
          // No building - just move
          moveSelectedUnits(gridX, gridY);
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
          // Check if placement is valid
          if (isBuildingPlacementValid(toolInfo.buildingType, gridX, gridY, gameState.grid, gameState.gridSize)) {
            placeBuilding(gridX, gridY, toolInfo.buildingType);
          }
          // If invalid, do nothing (red highlight on hover shows it's not allowed)
        }
      } else if (currentTool === 'select') {
        // Start selection box
        isSelectingRef.current = true;
        selectionStartScreenRef.current = { x: screenX, y: screenY };
        setSelectionBox({ startX: screenX, startY: screenY, endX: screenX, endY: screenY });
      } else if (currentTool === 'move' && state.selectedUnitIds.length > 0) {
        moveSelectedUnits(gridX, gridY);
      } else if (currentTool === 'attack' && state.selectedUnitIds.length > 0) {
        attackTarget({ x: gridX, y: gridY });
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
        // Reset to select tool
        setTool('select');
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
      
      // Disable image smoothing for crisp pixel art
      ctx.imageSmoothingEnabled = false;
      
      // Draw sky background
      drawSkyBackground(ctx, canvas, 'day');
      
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
          
          // Draw terrain
          if (tile.terrain === 'water') {
            // Check adjacent water tiles
            const adjacentWater = {
              north: x > 0 && gameState.grid[y]?.[x - 1]?.terrain === 'water',
              east: y > 0 && gameState.grid[y - 1]?.[x]?.terrain === 'water',
              south: x < gameState.gridSize - 1 && gameState.grid[y]?.[x + 1]?.terrain === 'water',
              west: y < gameState.gridSize - 1 && gameState.grid[y + 1]?.[x]?.terrain === 'water',
            };
            drawWaterTile(ctx, screenX, screenY, x, y, adjacentWater);
          } else {
            // Determine zone color based on ownership/deposits
            let zoneType: 'none' | 'residential' | 'commercial' | 'industrial' = 'none';
            
            // Apply slight tinting for special tiles
            if (tile.hasMetalDeposit) {
              // Draw mountainous terrain for metal deposits
              // Base rocky ground with gradient
              const gradient = ctx.createLinearGradient(
                screenX, screenY,
                screenX + TILE_WIDTH, screenY + TILE_HEIGHT
              );
              gradient.addColorStop(0, '#6b7280');
              gradient.addColorStop(0.5, '#78716c');
              gradient.addColorStop(1, '#57534e');
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
              ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
              ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
              ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
              ctx.closePath();
              ctx.fill();
              
              // Deterministic seed for this tile
              const seed = x * 1000 + y;
              
              // Draw clustered mountain peaks (6-8 per tile, tightly packed, taller)
              const numMountains = 6 + (seed % 3);
              
              // Tighter cluster positions near center with varying heights
              const mountainPositions = [
                { dx: 0.5, dy: 0.28, sizeMult: 1.4, heightMult: 1.3 },   // Back center - tallest
                { dx: 0.35, dy: 0.32, sizeMult: 1.2, heightMult: 1.1 }, // Back left
                { dx: 0.65, dy: 0.32, sizeMult: 1.2, heightMult: 1.15 },  // Back right
                { dx: 0.42, dy: 0.42, sizeMult: 1.0, heightMult: 0.9 }, // Mid left
                { dx: 0.58, dy: 0.44, sizeMult: 1.1, heightMult: 0.95 },  // Mid right
                { dx: 0.5, dy: 0.52, sizeMult: 0.9, heightMult: 0.8 },   // Front center
                { dx: 0.32, dy: 0.50, sizeMult: 0.7, heightMult: 0.65 },  // Front left edge
                { dx: 0.68, dy: 0.48, sizeMult: 0.75, heightMult: 0.7 },  // Front right edge
              ];
              
              // Draw mountains with more detail
              for (let m = 0; m < Math.min(numMountains, mountainPositions.length); m++) {
                const pos = mountainPositions[m];
                const mSeed = seed * 7 + m * 13;
                
                // Tight clustering with minimal randomization
                const baseX = screenX + TILE_WIDTH * pos.dx + ((mSeed % 5) - 2.5) * 0.4;
                const baseY = screenY + TILE_HEIGHT * pos.dy + ((mSeed * 3 % 4) - 2) * 0.2;
                
                // Taller mountains with some width variation
                const baseWidth = (14 + (mSeed % 5)) * pos.sizeMult;
                const peakHeight = (16 + (mSeed * 2 % 8)) * pos.heightMult;
                const peakX = baseX + ((mSeed % 3) - 1) * 0.5; // Slight peak offset
                const peakY = baseY - peakHeight;
                
                // Left face (shadow) with rocky texture
                ctx.fillStyle = '#4a4a52';
                ctx.beginPath();
                ctx.moveTo(peakX, peakY);
                // Add a slight ridge on the left face
                const leftRidgeX = baseX - baseWidth * 0.3;
                const leftRidgeY = baseY - peakHeight * 0.4;
                ctx.lineTo(leftRidgeX, leftRidgeY);
                ctx.lineTo(baseX - baseWidth * 0.5, baseY);
                ctx.lineTo(baseX, baseY);
                ctx.closePath();
                ctx.fill();
                
                // Right face (lit) with subtle detail
                ctx.fillStyle = '#9ca3af';
                ctx.beginPath();
                ctx.moveTo(peakX, peakY);
                // Add a slight ridge on the right face
                const rightRidgeX = baseX + baseWidth * 0.25;
                const rightRidgeY = baseY - peakHeight * 0.35;
                ctx.lineTo(rightRidgeX, rightRidgeY);
                ctx.lineTo(baseX + baseWidth * 0.5, baseY);
                ctx.lineTo(baseX, baseY);
                ctx.closePath();
                ctx.fill();
                
                // Add a darker ridge line on larger mountains
                if (pos.heightMult > 0.8) {
                  ctx.fillStyle = '#3f3f46';
                  ctx.beginPath();
                  ctx.moveTo(peakX, peakY);
                  ctx.lineTo(peakX - 1, peakY + peakHeight * 0.5);
                  ctx.lineTo(peakX + 1, peakY + peakHeight * 0.5);
                  ctx.closePath();
                  ctx.fill();
                }
                
                // Snow cap on taller peaks
                if (pos.heightMult >= 1.0) {
                  const snowHeight = peakHeight * 0.25;
                  ctx.fillStyle = '#f5f5f5';
                  ctx.beginPath();
                  ctx.moveTo(peakX, peakY);
                  ctx.lineTo(peakX - baseWidth * 0.1, peakY + snowHeight);
                  ctx.lineTo(peakX + baseWidth * 0.1, peakY + snowHeight);
                  ctx.closePath();
                  ctx.fill();
                  
                  // Snow drip effect
                  if (pos.heightMult >= 1.2) {
                    ctx.fillStyle = '#e5e5e5';
                    ctx.beginPath();
                    ctx.arc(peakX - 2, peakY + snowHeight + 2, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                  }
                }
              }
              
              // Smaller ore deposits (dark diamonds) at base - 4-6 deposits
              const numOreDeposits = 4 + (seed % 3);
              const orePositions = [
                { dx: 0.28, dy: 0.70 },
                { dx: 0.42, dy: 0.74 },
                { dx: 0.58, dy: 0.72 },
                { dx: 0.72, dy: 0.70 },
                { dx: 0.38, dy: 0.66 },
                { dx: 0.62, dy: 0.68 },
              ];
              
              for (let o = 0; o < Math.min(numOreDeposits, orePositions.length); o++) {
                const oPos = orePositions[o];
                const oSeed = seed * 11 + o * 17;
                const oreX = screenX + TILE_WIDTH * oPos.dx + ((oSeed % 4) - 2) * 0.3;
                const oreY = screenY + TILE_HEIGHT * oPos.dy + ((oSeed * 2 % 3) - 1) * 0.2;
                const oreSize = 1.5 + (oSeed % 2); // Smaller ore pieces
                
                // Dark ore diamond shape (more interesting than square)
                ctx.fillStyle = '#18181b';
                ctx.beginPath();
                ctx.moveTo(oreX, oreY - oreSize);
                ctx.lineTo(oreX + oreSize, oreY);
                ctx.lineTo(oreX, oreY + oreSize);
                ctx.lineTo(oreX - oreSize, oreY);
                ctx.closePath();
                ctx.fill();
                
                // Tiny metallic glint
                ctx.fillStyle = '#71717a';
                ctx.fillRect(oreX - 0.5, oreY - 0.5, 1, 1);
              }
              
              // More grey boulders/circles at bottom - 7-10 boulders
              const numBoulders = 7 + (seed % 4);
              for (let b = 0; b < numBoulders; b++) {
                const bSeed = seed * 19 + b * 23;
                const bx = screenX + TILE_WIDTH * 0.2 + ((bSeed % 100) / 100) * TILE_WIDTH * 0.6;
                const by = screenY + TILE_HEIGHT * 0.58 + ((bSeed * 3 % 50) / 100) * TILE_HEIGHT * 0.35;
                const bSize = 2 + (bSeed % 3);
                
                // Grey boulder
                ctx.fillStyle = '#6b7280';
                ctx.beginPath();
                ctx.arc(bx, by, bSize, 0, Math.PI * 2);
                ctx.fill();
                
                // Light highlight
                ctx.fillStyle = '#a1a1aa';
                ctx.beginPath();
                ctx.arc(bx - bSize * 0.25, by - bSize * 0.25, bSize * 0.35, 0, Math.PI * 2);
                ctx.fill();
              }
            } else if (tile.hasOilDeposit && AGE_ORDER.indexOf(playerAge) >= AGE_ORDER.indexOf('industrial')) {
              // Dark tint for oil (only visible in industrial+)
              ctx.fillStyle = '#1f2937';
              ctx.beginPath();
              ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
              ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
              ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
              ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = '#111827';
              ctx.lineWidth = 0.5;
              ctx.stroke();
            } else if (tile.forestDensity > 0) {
              // Draw base grass tile for forest
              drawGroundTile(ctx, screenX, screenY, 'none', currentZoom, false);
              
              // Draw trees on forest tiles using IsoCity's tree sprite
              const isoCitySprite = getCachedImage(ISOCITY_SPRITE_PATH, true);
              if (isoCitySprite) {
                // Tree sprite is at row 3, col 0 in IsoCity's 5x6 grid
                const treeCols = 5;
                const treeRows = 6;
                const treeTileWidth = isoCitySprite.width / treeCols;
                const treeTileHeight = isoCitySprite.height / treeRows;
                
                // Crop top 15% to avoid bleeding from asset above, and bottom 5%
                const cropTop = treeTileHeight * 0.15;
                const cropBottom = treeTileHeight * 0.05;
                const treeSx = 0 * treeTileWidth;  // col 0
                const treeSy = 3 * treeTileHeight + cropTop; // row 3, offset down to avoid asset above
                const treeSrcHeight = treeTileHeight - cropTop - cropBottom;

                // Number of trees based on forest density (6-8 trees for dense forests)
                const numTrees = 6 + Math.floor((tile.forestDensity / 100) * 2);

                // Tree positions within the tile - spread across the diamond
                const treePositions = [
                  { dx: 0.5, dy: 0.35 },   // top-center
                  { dx: 0.3, dy: 0.45 },   // upper-left
                  { dx: 0.7, dy: 0.45 },   // upper-right
                  { dx: 0.2, dy: 0.55 },   // mid-left
                  { dx: 0.5, dy: 0.55 },   // center
                  { dx: 0.8, dy: 0.55 },   // mid-right
                  { dx: 0.35, dy: 0.65 },  // lower-left
                  { dx: 0.65, dy: 0.65 },  // lower-right
                ];

                const treeAspect = treeSrcHeight / treeTileWidth;

                for (let t = 0; t < numTrees; t++) {
                  const pos = treePositions[t];
                  // Use tile position to create variation in size and position
                  const seed = (x * 31 + y * 17 + t * 7) % 100;
                  const offsetX = (seed % 10 - 5) * 0.03 * TILE_WIDTH;
                  const offsetY = (Math.floor(seed / 10) - 5) * 0.02 * TILE_HEIGHT;

                  // Vary tree size (0.35 to 0.55 scale)
                  const sizeSeed = (x * 13 + y * 23 + t * 11) % 100;
                  const treeScale = 0.35 + (sizeSeed / 100) * 0.2;
                  const treeDestWidth = TILE_WIDTH * treeScale;
                  const treeDestHeight = treeDestWidth * treeAspect;

                  const treeDrawX = screenX + TILE_WIDTH * pos.dx - treeDestWidth / 2 + offsetX;
                  // Position trees higher (reduced the 0.3 to 0.15 offset)
                  const treeDrawY = screenY + TILE_HEIGHT * pos.dy - treeDestHeight + TILE_HEIGHT * 0.15 + offsetY;

                  ctx.drawImage(
                    isoCitySprite,
                    treeSx, treeSy, treeTileWidth, treeSrcHeight,
                    treeDrawX, treeDrawY, treeDestWidth, treeDestHeight
                  );
                }
              }
            } else {
              // Regular grass tile
              drawGroundTile(ctx, screenX, screenY, zoneType, currentZoom, false);
            }
            
            // Ownership tint overlay
            if (tile.ownerId) {
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
              // Building placement mode - check if valid
              const isValidPlacement = isBuildingPlacementValid(
                toolInfo.buildingType,
                x,
                y,
                gameState.grid,
                gameState.gridSize
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
          if (adjacentLand.north || adjacentLand.east || adjacentLand.south || adjacentLand.west) {
            drawBeachOnWater(ctx, screenX, screenY, adjacentLand);
          }
        }
      }
      
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
          
          // Special handling for dock - use IsoCity marina sprite from parks sheet (2x2)
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

              // Draw water tiles underneath the dock (for each tile in footprint)
              const waterTexture = getCachedImage(WATER_ASSET_PATH);
              if (waterTexture) {
                const imgW = waterTexture.naturalWidth || waterTexture.width;
                const imgH = waterTexture.naturalHeight || waterTexture.height;
                const cropScale = 0.35;
                const cropW = imgW * cropScale;
                const cropH = imgH * cropScale;
                const aspectRatio = cropH / cropW;
                const destWidth = TILE_WIDTH * 1.15;
                const destHeight = destWidth * aspectRatio;

                for (let dx = 0; dx < buildingSize.width; dx++) {
                  for (let dy = 0; dy < buildingSize.height; dy++) {
                    const tileScreenPos = gridToScreen(x + dx, y + dy, 0, 0);
                    const tileCenterX = tileScreenPos.screenX + TILE_WIDTH / 2;
                    const tileCenterY = tileScreenPos.screenY + TILE_HEIGHT / 2;

                    ctx.globalAlpha = 0.9;
                    ctx.drawImage(
                      waterTexture,
                      0, 0, cropW, cropH,
                      Math.round(tileCenterX - destWidth / 2),
                      Math.round(tileCenterY - destHeight / 2),
                      Math.round(destWidth),
                      Math.round(destHeight)
                    );
                  }
                }
                ctx.globalAlpha = 1;
              }

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
          
          // Special handling for farm - use IsoCity farm sprite sheet with random crop
          if (buildingType === 'farm') {
            const farmSprite = getCachedImage(ISOCITY_FARM_PATH, true);
            if (farmSprite) {
              const farmTileWidth = farmSprite.width / FARM_SPRITE_COLS;
              const farmTileHeight = farmSprite.height / FARM_SPRITE_ROWS;
              
              // Use deterministic random based on tile position for consistent appearance
              const variantIndex = ((x * 7 + y * 13) % FARM_VARIANTS);
              const sx = variantIndex * farmTileWidth;
              const sy = 0; // First row only
              
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
              
              // Scale and position like IsoCity farms
              const scale = 1.1; // Slightly larger
              const destWidth = TILE_WIDTH * scale * Math.max(buildingSize.width, buildingSize.height);
              const destHeight = destWidth * (farmTileHeight / farmTileWidth);
              
              // Vertical offset
              const verticalPush = (buildingSize.width + buildingSize.height - 2) * TILE_HEIGHT * 0.5;
              const buildingOffset = -0.3 * TILE_HEIGHT; // Farms offset
              
              const drawX = drawPosX + TILE_WIDTH / 2 - destWidth / 2;
              const drawY = drawPosY + TILE_HEIGHT - destHeight + verticalPush + buildingOffset;
              
              // Use construction sprite for farm under construction
              const isUnderConstruction = tile.building.constructionProgress < 100;
              const constructionSprite = getCachedImage(ISOCITY_CONSTRUCTION_PATH, true);
              
              if (isUnderConstruction && constructionSprite) {
                const constrCols = 5;
                const constrRows = 6;
                const constrTileWidth = constructionSprite.width / constrCols;
                const constrTileHeight = constructionSprite.height / constrRows;
                ctx.drawImage(
                  constructionSprite,
                  0, 0, constrTileWidth, constrTileHeight,
                  drawX, drawY, destWidth, destHeight
                );
              } else {
                ctx.drawImage(
                  farmSprite,
                  sx, sy, farmTileWidth, farmTileHeight,
                  drawX, drawY, destWidth, destHeight
                );
              }
            }
            continue; // Skip regular sprite drawing for farm
          }
          
          if (spriteSheet) {
            const spritePos = BUILDING_SPRITE_MAP[buildingType];
            
            if (spritePos && spritePos.row >= 0) {
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
              
              // Scale based on building size
              const baseScale = (BUILDING_SCALES[buildingType] || 1) * spritePack.globalScale;
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
              
              // Apply building-specific vertical offset
              const vertOffset = BUILDING_VERTICAL_OFFSETS[buildingType] ?? 0;
              verticalPush += vertOffset * TILE_HEIGHT;
              
              const drawX = drawPosX + TILE_WIDTH / 2 - destWidth / 2;
              const drawY = drawPosY + TILE_HEIGHT - destHeight + verticalPush;
              
              // Use construction sprite for buildings under construction
              const isUnderConstruction = tile.building.constructionProgress < 100;
              const constructionSprite = getCachedImage(ISOCITY_CONSTRUCTION_PATH, true);
              
              if (isUnderConstruction && constructionSprite) {
                // Use IsoCity construction sprite sheet (same layout as regular sprites)
                // The construction sheet has the same 5x6 grid layout
                const constrCols = 5;
                const constrRows = 6;
                const constrTileWidth = constructionSprite.width / constrCols;
                const constrTileHeight = constructionSprite.height / constrRows;
                
                // Use the same sprite position but from the construction sheet
                const constrSx = spritePos.col * constrTileWidth;
                const constrSy = spritePos.row * constrTileHeight;
                
                ctx.drawImage(
                  constructionSprite,
                  constrSx, constrSy, constrTileWidth, constrTileHeight,
                  drawX, drawY, destWidth, destHeight
                );
              } else {
                // Draw completed building normally
                ctx.drawImage(
                  spriteSheet,
                  sx, sy, tileWidth, tileHeight,
                  drawX, drawY, destWidth, destHeight
                );
              }

              // Health bar for damaged buildings
              if (tile.building.health < tile.building.maxHealth) {
                const healthPercent = tile.building.health / tile.building.maxHealth;
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
