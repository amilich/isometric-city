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
  loadImage,
  loadSpriteImage,
  getCachedImage,
  onImageLoaded,
  drawGroundTile,
  drawWaterTile,
  drawTileHighlight,
  drawSelectionBox,
  drawUnit,
  drawHealthBar,
  drawSkyBackground,
  setupCanvas,
  calculateViewBounds,
  isTileVisible,
  WATER_ASSET_PATH,
} from '@/components/game/shared';

// Extend window for debug logging
declare global {
  interface Window {
    _ronUnitsLogged?: boolean;
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
    placeBuilding,
    attackTarget,
    assignTask,
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
        
        console.log('Right-click action:', { 
          gridX, gridY, 
          building: targetTile?.building?.type, 
          ownerId: targetTile?.ownerId,
          currentPlayerId: gameState.currentPlayerId,
          selectedUnits: state.selectedUnitIds.length
        });
        
        if (targetTile?.building) {
          // Check if it's an enemy building - attack
          if (targetTile.ownerId && targetTile.ownerId !== gameState.currentPlayerId) {
            console.log('Attacking enemy building');
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
              console.log('Assigning gather task:', gatherTask);
              assignTask(gatherTask as import('../types/units').UnitTask, { x: gridX, y: gridY });
            } else {
              // It's our building but not economic - just move near it
              console.log('Moving to friendly building');
              moveSelectedUnits(gridX, gridY);
            }
          } else {
            // Neutral building or no owner - move there
            moveSelectedUnits(gridX, gridY);
          }
        } else {
          // No building - just move
          console.log('Moving to empty tile');
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
          placeBuilding(gridX, gridY, toolInfo.buildingType);
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
          
          // Check clicked tile and surrounding tiles for buildings (since visuals are offset)
          let foundBuilding: { x: number; y: number; tile: typeof gameState.grid[0][0] } | null = null;
          
          // Check in order: exact tile, then nearby tiles
          const checkOffsets = [[0, 0], [0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
          for (const [dx, dy] of checkOffsets) {
            const tx = gx + dx;
            const ty = gy + dy;
            const tile = gameState.grid[ty]?.[tx];
            if (tile?.building && 
                (tile.ownerId === gameState.currentPlayerId || 
                 tile.building.ownerId === gameState.currentPlayerId)) {
              foundBuilding = { x: tx, y: ty, tile };
              break;
            }
          }
          
          if (foundBuilding) {
            selectBuilding({ x: foundBuilding.x, y: foundBuilding.y });
            selectUnits([]);
          } else {
            selectUnits([]);
            selectBuilding(null);
          }
        }
      } else {
        // Box selection - convert screen box to grid coordinates
        // The units have fractional positions, so we need to include a buffer
        const startGrid = screenToGrid(
          startX / zoomRef.current,
          startY / zoomRef.current,
          offsetRef.current.x / zoomRef.current,
          offsetRef.current.y / zoomRef.current
        );
        const endGrid = screenToGrid(
          endX / zoomRef.current,
          endY / zoomRef.current,
          offsetRef.current.x / zoomRef.current,
          offsetRef.current.y / zoomRef.current
        );
        
        // Debug logging
        const gameState = latestStateRef.current;
        console.log('Box selection:', {
          screenStart: { startX, startY },
          screenEnd: { endX, endY },
          gridStart: startGrid,
          gridEnd: endGrid,
          units: gameState.units.map(u => ({ id: u.id, x: u.x, y: u.y, ownerId: u.ownerId })),
          currentPlayerId: gameState.currentPlayerId,
        });
        
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
  
  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(3, prev * delta)));
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
              // Grey tint for metal
              ctx.fillStyle = '#6b7280';
              ctx.beginPath();
              ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
              ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
              ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
              ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = '#4b5563';
              ctx.lineWidth = 0.5;
              ctx.stroke();
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
              // Dark green for forest
              ctx.fillStyle = '#166534';
              ctx.beginPath();
              ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
              ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
              ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
              ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = '#14532d';
              ctx.lineWidth = 0.5;
              ctx.stroke();
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
            drawTileHighlight(ctx, screenX, screenY, 'hover');
          } else if (isSelected) {
            drawTileHighlight(ctx, screenX, screenY, 'selected');
          }
        }
      }
      
      // Second pass: Draw buildings (after all terrain so they appear on top)
      for (let y = 0; y < gameState.gridSize; y++) {
        for (let x = 0; x < gameState.gridSize; x++) {
          const tile = gameState.grid[y]?.[x];
          if (!tile?.building) continue;
          
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
              
              // Scale based on building size - 2x2 buildings should cover 2 tiles
              const sizeScale = Math.max(buildingSize.width, buildingSize.height);
              const baseScale = (BUILDING_SCALES[buildingType] || 1) * spritePack.globalScale;
              const scale = baseScale * sizeScale * 0.8; // 0.8 to fine-tune
              const vertOffset = BUILDING_VERTICAL_OFFSETS[buildingType] || -0.4;
              
              const destWidth = TILE_WIDTH * 1.2 * scale;
              const destHeight = destWidth * (tileHeight / tileWidth);
              
              const drawX = screenX + TILE_WIDTH / 2 - destWidth / 2;
              const drawY = screenY + TILE_HEIGHT - destHeight + vertOffset * TILE_HEIGHT;
              
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
              
              // Debug: draw a border around the building's actual clickable tile
              ctx.strokeStyle = tile.ownerId === gameState.currentPlayerId ? '#00ff00' : '#ff0000';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
              ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
              ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
              ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
              ctx.closePath();
              ctx.stroke();
              
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
      
      // Third pass: Draw units
      // Debug: log unit count once
      if (gameState.units.length > 0 && !window._ronUnitsLogged) {
        console.log('RoN Units:', gameState.units.map(u => ({ id: u.id, x: u.x, y: u.y, type: u.type })));
        window._ronUnitsLogged = true;
      }
      
      gameState.units.forEach(unit => {
        const { screenX, screenY } = gridToScreen(unit.x, unit.y, 0, 0);
        
        // Cull off-screen units
        if (!isTileVisible(screenX, screenY, viewBounds)) return;
        
        const playerIndex = gameState.players.findIndex(p => p.id === unit.ownerId);
        const color = PLAYER_COLORS[playerIndex] || '#ffffff';
        
        // Get unit symbol
        const symbol = unit.type === 'citizen' ? 'C' : 
                      unit.type.includes('tank') ? 'T' :
                      unit.type.includes('cavalry') || unit.type.includes('knight') ? 'H' :
                      'M';
        
        // Draw unit larger for visibility (scale 1.5 instead of 1)
        drawUnit(ctx, screenX, screenY, color, unit.isSelected, symbol, 1.5);
        
        // Health bar if damaged
        const healthPercent = unit.health / unit.maxHealth;
        if (healthPercent < 1) {
          const barWidth = 14;
          const unitCenterX = screenX + TILE_WIDTH / 4;
          drawHealthBar(ctx, unitCenterX - barWidth / 2, screenY - 24, barWidth, healthPercent, 1);
        }
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
  
  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
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
      />
    </div>
  );
}
