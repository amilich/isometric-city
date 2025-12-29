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
  
  // Other buildings - add more validation as needed
  return true;
}

// IsoCity sprite sheet path for trees
const ISOCITY_SPRITE_PATH = '/assets/sprites_red_water_new.png';

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
  const AGE_ORDER_LOCAL = ['ancient', 'classical', 'medieval', 'enlightenment', 'industrial', 'modern', 'information'];
  const ageIndex = AGE_ORDER_LOCAL.indexOf(age);
  
  let roadColor: string;
  let edgeColor: string;
  let centerLineColor: string | null = null;
  
  if (ageIndex <= 1) {
    // Ancient/Classical - dirt road
    roadColor = '#8B7355';
    edgeColor = '#6B5344';
  } else if (ageIndex <= 2) {
    // Medieval - cobblestone
    roadColor = '#6B6B6B';
    edgeColor = '#4B4B4B';
  } else if (ageIndex <= 3) {
    // Enlightenment - improved cobblestone
    roadColor = '#5A5A5A';
    edgeColor = '#3A3A3A';
  } else {
    // Industrial+ - asphalt with markings
    roadColor = '#3A3A3A';
    edgeColor = '#2A2A2A';
    centerLineColor = '#FFD700';
  }
  
  // Road width (narrower than full tile)
  const roadWidth = w * 0.35;
  
  // Edge midpoints
  const topMidX = screenX + w * 0.25;
  const topMidY = screenY + h * 0.25;
  const rightMidX = screenX + w * 0.75;
  const rightMidY = screenY + h * 0.25;
  const bottomMidX = screenX + w * 0.75;
  const bottomMidY = screenY + h * 0.75;
  const leftMidX = screenX + w * 0.25;
  const leftMidY = screenY + h * 0.75;
  
  // Draw base tile (dirt/grass under road)
  ctx.fillStyle = '#4a7c3f';
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Draw road segments based on connections
  ctx.fillStyle = roadColor;
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 1;
  
  const drawRoadSegment = (fromX: number, fromY: number, toX: number, toY: number) => {
    // Calculate perpendicular direction for road width
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = (-dy / len) * (roadWidth / 2);
    const perpY = (dx / len) * (roadWidth / 2);
    
    ctx.beginPath();
    ctx.moveTo(fromX + perpX, fromY + perpY);
    ctx.lineTo(toX + perpX, toY + perpY);
    ctx.lineTo(toX - perpX, toY - perpY);
    ctx.lineTo(fromX - perpX, fromY - perpY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  
  // Draw connected segments
  if (north) drawRoadSegment(cx, cy, topMidX, topMidY);
  if (east) drawRoadSegment(cx, cy, rightMidX, rightMidY);
  if (south) drawRoadSegment(cx, cy, bottomMidX, bottomMidY);
  if (west) drawRoadSegment(cx, cy, leftMidX, leftMidY);
  
  // Draw center intersection/circle
  const centerRadius = roadWidth * 0.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, centerRadius, centerRadius * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // If no connections, draw a small road stub
  if (!north && !east && !south && !west) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, roadWidth * 0.5, roadWidth * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  
  // Draw center line for modern roads
  if (centerLineColor && (north || south || east || west)) {
    ctx.strokeStyle = centerLineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    if (north && south && !east && !west) {
      // Straight north-south
      ctx.beginPath();
      ctx.moveTo(topMidX, topMidY);
      ctx.lineTo(bottomMidX, bottomMidY);
      ctx.stroke();
    } else if (east && west && !north && !south) {
      // Straight east-west
      ctx.beginPath();
      ctx.moveTo(rightMidX, rightMidY);
      ctx.lineTo(leftMidX, leftMidY);
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
        const targetTile = gameState.grid[gridY]?.[gridX];
        
        if (targetTile?.building) {
          // Check if it's an enemy building - attack
          if (targetTile.ownerId && targetTile.ownerId !== gameState.currentPlayerId) {
            attackTarget({ x: gridX, y: gridY });
          } 
          // Check if it's our own economic building - assign gather task
          else if (targetTile.ownerId === gameState.currentPlayerId) {
            const buildingType = targetTile.building.type;
            
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
              assignTask(gatherTask as import('../types/units').UnitTask, { x: gridX, y: gridY });
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
      
      if (currentTool.startsWith('build_')) {
        // Building placement
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
  }, [latestStateRef]);
  
  // Handle mouse up
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // End panning
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
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
        // Single click - select unit or building at position
        const { gridX, gridY } = screenToGrid(
          startX / zoomRef.current,
          startY / zoomRef.current,
          offsetRef.current.x / zoomRef.current,
          offsetRef.current.y / zoomRef.current
        );
        
        const gameState = latestStateRef.current;
        
        // Find units near this position (generous 1.5 tile radius)
        const clickedUnits = gameState.units.filter(u => 
          Math.abs(u.x - gridX) < 1.5 && 
          Math.abs(u.y - gridY) < 1.5 &&
          u.ownerId === gameState.currentPlayerId
        );
        
        if (clickedUnits.length > 0) {
          selectUnits(clickedUnits.map(u => u.id));
          selectBuilding(null);
        } else {
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
            selectUnits([]);
            selectBuilding(null);
          }
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
      const playerAge = currentPlayer?.age || 'ancient';
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
              
              // Draw clustered, rounded mountain peaks (5-7 per tile, tightly packed)
              const numMountains = 5 + (seed % 3);
              
              // Tighter cluster positions near center
              const mountainPositions = [
                { dx: 0.5, dy: 0.30, sizeMult: 1.6, heightMult: 1.0 },   // Back center - widest
                { dx: 0.38, dy: 0.35, sizeMult: 1.3, heightMult: 0.85 }, // Back left
                { dx: 0.62, dy: 0.35, sizeMult: 1.3, heightMult: 0.9 },  // Back right
                { dx: 0.45, dy: 0.48, sizeMult: 1.1, heightMult: 0.75 }, // Mid left
                { dx: 0.55, dy: 0.48, sizeMult: 1.2, heightMult: 0.8 },  // Mid right
                { dx: 0.5, dy: 0.55, sizeMult: 1.0, heightMult: 0.7 },   // Front center
                { dx: 0.35, dy: 0.52, sizeMult: 0.8, heightMult: 0.6 },  // Front left edge
              ];
              
              // Draw mountains (no internal ridge lines)
              for (let m = 0; m < Math.min(numMountains, mountainPositions.length); m++) {
                const pos = mountainPositions[m];
                const mSeed = seed * 7 + m * 13;
                
                // Tight clustering with minimal randomization
                const baseX = screenX + TILE_WIDTH * pos.dx + ((mSeed % 6) - 3) * 0.3;
                const baseY = screenY + TILE_HEIGHT * pos.dy + ((mSeed * 3 % 4) - 2) * 0.2;
                
                // Wider, shorter mountains (less pointy)
                const baseWidth = (16 + (mSeed % 6)) * pos.sizeMult;
                const peakHeight = (10 + (mSeed * 2 % 6)) * pos.heightMult;
                const peakX = baseX;
                const peakY = baseY - peakHeight;
                
                // Left face (shadow) - wider angle
                ctx.fillStyle = '#52525b';
                ctx.beginPath();
                ctx.moveTo(peakX, peakY);
                ctx.lineTo(baseX - baseWidth * 0.55, baseY);
                ctx.lineTo(baseX, baseY);
                ctx.closePath();
                ctx.fill();
                
                // Right face (lit) - wider angle
                ctx.fillStyle = '#9ca3af';
                ctx.beginPath();
                ctx.moveTo(peakX, peakY);
                ctx.lineTo(baseX + baseWidth * 0.55, baseY);
                ctx.lineTo(baseX, baseY);
                ctx.closePath();
                ctx.fill();
                
                // Snow cap only on the tallest
                if (pos.heightMult >= 1.0 && m === 0) {
                  const snowHeight = peakHeight * 0.3;
                  ctx.fillStyle = '#e5e5e5';
                  ctx.beginPath();
                  ctx.moveTo(peakX, peakY);
                  ctx.lineTo(peakX - baseWidth * 0.12, peakY + snowHeight);
                  ctx.lineTo(peakX + baseWidth * 0.12, peakY + snowHeight);
                  ctx.closePath();
                  ctx.fill();
                }
              }
              
              // More ore deposits (black squares) at base - 5-7 deposits
              const numOreDeposits = 5 + (seed % 3);
              const orePositions = [
                { dx: 0.25, dy: 0.68 },
                { dx: 0.4, dy: 0.72 },
                { dx: 0.55, dy: 0.70 },
                { dx: 0.7, dy: 0.68 },
                { dx: 0.35, dy: 0.62 },
                { dx: 0.6, dy: 0.65 },
                { dx: 0.5, dy: 0.75 },
              ];
              
              for (let o = 0; o < Math.min(numOreDeposits, orePositions.length); o++) {
                const oPos = orePositions[o];
                const oSeed = seed * 11 + o * 17;
                const oreX = screenX + TILE_WIDTH * oPos.dx + ((oSeed % 6) - 3) * 0.4;
                const oreY = screenY + TILE_HEIGHT * oPos.dy + ((oSeed * 2 % 4) - 2) * 0.3;
                const oreSize = 3 + (oSeed % 3);
                
                // Black ore square
                ctx.fillStyle = '#1c1917';
                ctx.fillRect(oreX - oreSize / 2, oreY - oreSize / 2, oreSize, oreSize);
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
                const treeSx = 0 * treeTileWidth;  // col 0
                const treeSy = 3 * treeTileHeight; // row 3
                
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
                
                const treeAspect = treeTileHeight / treeTileWidth;
                
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
                  const treeDrawY = screenY + TILE_HEIGHT * pos.dy - treeDestHeight + TILE_HEIGHT * 0.3 + offsetY;
                  
                  ctx.drawImage(
                    isoCitySprite,
                    treeSx, treeSy, treeTileWidth, treeTileHeight,
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
          if (spriteSheet) {
            const buildingType = tile.building.type as RoNBuildingType;
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
              
              // Construction progress transparency
              if (tile.building.constructionProgress < 100) {
                ctx.globalAlpha = 0.4 + (tile.building.constructionProgress / 100) * 0.6;
              }
              
              ctx.drawImage(
                spriteSheet,
                sx, sy, tileWidth, tileHeight,
                drawX, drawY, destWidth, destHeight
              );
              
              ctx.globalAlpha = 1;

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
