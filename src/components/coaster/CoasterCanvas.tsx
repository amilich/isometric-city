'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { ParkTile } from '@/games/coaster/types/game';
import { 
  TILE_WIDTH, 
  TILE_HEIGHT, 
  getPathConnections, 
  drawPath,
} from './systems/pathSystem';
import { drawRideTrack } from './systems/trackRenderer';
import { RIDE_DEFINITIONS, SHOP_DEFINITIONS, SCENERY_DEFINITIONS } from '@/games/coaster/types/buildings';

// Zoom limits
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.0;

// Convert grid coordinates to screen coordinates
function gridToScreen(
  gridX: number,
  gridY: number,
  offsetX: number,
  offsetY: number,
  zoom: number
): { x: number; y: number } {
  const screenX = (gridX - gridY) * (TILE_WIDTH / 2) * zoom + offsetX;
  const screenY = (gridX + gridY) * (TILE_HEIGHT / 2) * zoom + offsetY;
  return { x: screenX, y: screenY };
}

// Convert screen coordinates to grid coordinates
function screenToGrid(
  screenX: number,
  screenY: number,
  offsetX: number,
  offsetY: number,
  zoom: number
): { x: number; y: number } {
  const adjustedX = (screenX - offsetX) / zoom;
  const adjustedY = (screenY - offsetY) / zoom;
  const gridX = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
  const gridY = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
  return { x: Math.floor(gridX), y: Math.floor(gridY) };
}

interface CoasterCanvasProps {
  selectedTile: { x: number; y: number } | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  isMobile?: boolean;
  navigationTarget?: { x: number; y: number } | null;
  onNavigationComplete?: () => void;
  onViewportChange?: (viewport: { 
    offset: { x: number; y: number }; 
    zoom: number; 
    canvasSize: { width: number; height: number } 
  }) => void;
}

export function CoasterCanvas({
  selectedTile,
  setSelectedTile,
  isMobile = false,
  navigationTarget,
  onNavigationComplete,
  onViewportChange,
}: CoasterCanvasProps) {
  const { state, placeAtTile, latestStateRef } = useCoaster();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [offset, setOffset] = useState({ x: isMobile ? 200 : 620, y: isMobile ? 100 : 160 });
  const [zoom, setZoom] = useState(isMobile ? 0.6 : 1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width, height });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Report viewport changes
  useEffect(() => {
    onViewportChange?.({ offset, zoom, canvasSize });
  }, [offset, zoom, canvasSize, onViewportChange]);

  // Handle navigation to target
  useEffect(() => {
    if (!navigationTarget) return;

    const { x, y } = gridToScreen(navigationTarget.x, navigationTarget.y, 0, 0, zoom);
    setOffset({
      x: canvasSize.width / 2 - x,
      y: canvasSize.height / 2 - y,
    });
    onNavigationComplete?.();
  }, [navigationTarget, zoom, canvasSize, onNavigationComplete]);

  // Draw grass texture
  const drawGrassTexture = useCallback((ctx: CanvasRenderingContext2D, halfW: number, halfH: number, zoomLevel: number) => {
    ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
    const blades = Math.floor(5 * zoomLevel);
    for (let i = 0; i < blades; i++) {
      const x = (Math.random() - 0.5) * halfW * 1.2;
      const y = (Math.random() - 0.5) * halfH * 0.8;
      ctx.fillRect(x, y, 1, 2 * zoomLevel);
    }
  }, []);

  // Draw park entrance
  const drawParkEntrance = useCallback((ctx: CanvasRenderingContext2D, halfW: number, halfH: number, zoomLevel: number) => {
    const gateHeight = 40 * zoomLevel;
    const gateWidth = 30 * zoomLevel;

    // Arch structure
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.moveTo(-gateWidth / 2, 0);
    ctx.lineTo(-gateWidth / 2, -gateHeight);
    ctx.quadraticCurveTo(0, -gateHeight - 15 * zoomLevel, gateWidth / 2, -gateHeight);
    ctx.lineTo(gateWidth / 2, 0);
    ctx.lineTo(-gateWidth / 2, 0);
    ctx.fill();

    // Inner archway
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.moveTo(-gateWidth / 3, 0);
    ctx.lineTo(-gateWidth / 3, -gateHeight + 8 * zoomLevel);
    ctx.quadraticCurveTo(0, -gateHeight, gateWidth / 3, -gateHeight + 8 * zoomLevel);
    ctx.lineTo(gateWidth / 3, 0);
    ctx.fill();

    // Flag poles
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-gateWidth / 2 + 3 * zoomLevel, -gateHeight);
    ctx.lineTo(-gateWidth / 2 + 3 * zoomLevel, -gateHeight - 15 * zoomLevel);
    ctx.moveTo(gateWidth / 2 - 3 * zoomLevel, -gateHeight);
    ctx.lineTo(gateWidth / 2 - 3 * zoomLevel, -gateHeight - 15 * zoomLevel);
    ctx.stroke();

    // Flags
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-gateWidth / 2 + 3 * zoomLevel, -gateHeight - 15 * zoomLevel);
    ctx.lineTo(-gateWidth / 2 + 12 * zoomLevel, -gateHeight - 12 * zoomLevel);
    ctx.lineTo(-gateWidth / 2 + 3 * zoomLevel, -gateHeight - 9 * zoomLevel);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(gateWidth / 2 - 3 * zoomLevel, -gateHeight - 15 * zoomLevel);
    ctx.lineTo(gateWidth / 2 - 12 * zoomLevel, -gateHeight - 12 * zoomLevel);
    ctx.lineTo(gateWidth / 2 - 3 * zoomLevel, -gateHeight - 9 * zoomLevel);
    ctx.fill();
  }, []);

  // Draw a ride
  const drawRide = useCallback((ctx: CanvasRenderingContext2D, type: string, halfW: number, halfH: number, zoomLevel: number) => {
    const h = 30 * zoomLevel;

    // Base platform
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.moveTo(0, halfH * 0.8);
    ctx.lineTo(halfW * 0.8, 0);
    ctx.lineTo(0, -halfH * 0.8);
    ctx.lineTo(-halfW * 0.8, 0);
    ctx.closePath();
    ctx.fill();

    // Ride structure (color based on category)
    const category = RIDE_DEFINITIONS[type as keyof typeof RIDE_DEFINITIONS]?.category;
    switch (category) {
      case 'gentle':
        ctx.fillStyle = '#10b981'; // Green
        break;
      case 'thrill':
        ctx.fillStyle = '#f97316'; // Orange
        break;
      case 'coaster':
        ctx.fillStyle = '#ef4444'; // Red
        break;
      case 'water':
        ctx.fillStyle = '#3b82f6'; // Blue
        break;
      default:
        ctx.fillStyle = '#ec4899'; // Pink
    }

    // Main structure
    ctx.beginPath();
    ctx.moveTo(-halfW * 0.5, 0);
    ctx.lineTo(-halfW * 0.3, -h);
    ctx.lineTo(halfW * 0.3, -h);
    ctx.lineTo(halfW * 0.5, 0);
    ctx.closePath();
    ctx.fill();

    // Roof/top
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(-halfW * 0.3, -h);
    ctx.lineTo(0, -h - 8 * zoomLevel);
    ctx.lineTo(halfW * 0.3, -h);
    ctx.closePath();
    ctx.fill();
  }, []);

  // Draw a shop/stall
  const drawShop = useCallback((ctx: CanvasRenderingContext2D, type: string, halfW: number, halfH: number, zoomLevel: number) => {
    const def = SHOP_DEFINITIONS[type as keyof typeof SHOP_DEFINITIONS];
    const h = 20 * zoomLevel;

    // Base
    ctx.fillStyle = '#d4d4d4';
    ctx.beginPath();
    ctx.moveTo(0, halfH * 0.6);
    ctx.lineTo(halfW * 0.6, 0);
    ctx.lineTo(0, -halfH * 0.6);
    ctx.lineTo(-halfW * 0.6, 0);
    ctx.closePath();
    ctx.fill();

    // Stall structure
    ctx.fillStyle = def?.category === 'food' ? '#f97316' :
                    def?.category === 'drink' ? '#3b82f6' :
                    def?.category === 'merchandise' ? '#a855f7' : '#6b7280';
    ctx.fillRect(-halfW * 0.4, -h, halfW * 0.8, h);

    // Awning/canopy
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(-halfW * 0.5, -h);
    ctx.lineTo(halfW * 0.5, -h);
    ctx.lineTo(halfW * 0.6, -h + 3 * zoomLevel);
    ctx.lineTo(-halfW * 0.6, -h + 3 * zoomLevel);
    ctx.closePath();
    ctx.fill();
  }, []);

  // Draw scenery
  const drawScenery = useCallback((ctx: CanvasRenderingContext2D, type: string, halfW: number, halfH: number, zoomLevel: number) => {
    if (type.includes('tree')) {
      // Draw tree
      const trunkHeight = 8 * zoomLevel;
      const foliageSize = 12 * zoomLevel;

      // Trunk
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-2 * zoomLevel, -trunkHeight, 4 * zoomLevel, trunkHeight);

      // Foliage
      ctx.fillStyle = type.includes('pine') ? '#166534' : '#22c55e';
      ctx.beginPath();
      ctx.arc(0, -trunkHeight - foliageSize / 2, foliageSize, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'bench') {
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-halfW * 0.4, -3 * zoomLevel, halfW * 0.8, 6 * zoomLevel);
    } else if (type === 'trash_bin') {
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(-3 * zoomLevel, -8 * zoomLevel, 6 * zoomLevel, 8 * zoomLevel);
    } else if (type === 'lamp_post') {
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -20 * zoomLevel);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, -20 * zoomLevel, 4 * zoomLevel, 0, Math.PI * 2);
      ctx.fill();
    } else if (type.includes('flower') || type === 'bush') {
      ctx.fillStyle = type === 'bush' ? '#15803d' : '#f472b6';
      ctx.beginPath();
      ctx.ellipse(0, -3 * zoomLevel, 6 * zoomLevel, 4 * zoomLevel, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (type.includes('fountain')) {
      ctx.fillStyle = '#6b7280';
      ctx.beginPath();
      ctx.ellipse(0, 0, halfW * 0.5, halfH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(0, -2 * zoomLevel, halfW * 0.3, halfH * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (type.includes('fence') || type === 'hedge') {
      ctx.fillStyle = type === 'hedge' ? '#15803d' : '#92400e';
      ctx.fillRect(-halfW * 0.4, -6 * zoomLevel, halfW * 0.8, 6 * zoomLevel);
    }
  }, []);

  // Draw building sprite
  const drawBuilding = useCallback((ctx: CanvasRenderingContext2D, tile: ParkTile, halfW: number, halfH: number, zoomLevel: number) => {
    if (!tile.building) return;

    const buildingType = tile.building.type;

    // Park entrance
    if (buildingType === 'park_entrance') {
      drawParkEntrance(ctx, halfW, halfH, zoomLevel);
      return;
    }

    // Check if it's a ride
    if (RIDE_DEFINITIONS[buildingType as keyof typeof RIDE_DEFINITIONS]) {
      drawRide(ctx, buildingType, halfW, halfH, zoomLevel);
      return;
    }

    // Check if it's a shop
    if (SHOP_DEFINITIONS[buildingType as keyof typeof SHOP_DEFINITIONS]) {
      drawShop(ctx, buildingType, halfW, halfH, zoomLevel);
      return;
    }

    // Check if it's scenery
    if (SCENERY_DEFINITIONS[buildingType as keyof typeof SCENERY_DEFINITIONS]) {
      drawScenery(ctx, buildingType, halfW, halfH, zoomLevel);
      return;
    }
  }, [drawParkEntrance, drawRide, drawShop, drawScenery]);

  // Draw a single tile
  const drawTile = useCallback((
    ctx: CanvasRenderingContext2D,
    tile: ParkTile,
    screenX: number,
    screenY: number,
    zoomLevel: number,
    isHovered: boolean,
    isSelected: boolean,
    gridX: number,
    gridY: number,
    grid: ParkTile[][],
    gridSize: number
  ) => {
    const w = TILE_WIDTH * zoomLevel;
    const h = TILE_HEIGHT * zoomLevel;
    const halfW = w / 2;
    const halfH = h / 2;

    // Height offset
    const heightOffset = tile.height * 4 * zoomLevel;

    ctx.save();
    ctx.translate(screenX, screenY - heightOffset);

    // Draw height sides first if elevated
    if (tile.height > 0) {
      const sideHeight = tile.height * 4 * zoomLevel;

      // Left side (darker)
      ctx.beginPath();
      ctx.moveTo(-halfW, 0);
      ctx.lineTo(0, halfH);
      ctx.lineTo(0, halfH + sideHeight);
      ctx.lineTo(-halfW, sideHeight);
      ctx.closePath();
      ctx.fillStyle = tile.owned ? '#2d5a3d' : '#1a3a2a';
      ctx.fill();

      // Right side (slightly lighter)
      ctx.beginPath();
      ctx.moveTo(halfW, 0);
      ctx.lineTo(0, halfH);
      ctx.lineTo(0, halfH + sideHeight);
      ctx.lineTo(halfW, sideHeight);
      ctx.closePath();
      ctx.fillStyle = tile.owned ? '#3d6a4d' : '#2a4a3a';
      ctx.fill();
    }

    // Draw base terrain tile
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(halfW, 0);
    ctx.lineTo(0, halfH);
    ctx.lineTo(-halfW, 0);
    ctx.closePath();

    // Terrain color
    if (!tile.owned) {
      ctx.fillStyle = tile.forSale ? '#2a4a3a' : '#1a3a2a';
    } else if (tile.terrain === 'water') {
      ctx.fillStyle = '#0ea5e9';
    } else if (tile.terrain === 'sand') {
      ctx.fillStyle = '#d4a574';
    } else if (tile.terrain === 'dirt') {
      ctx.fillStyle = '#8b6914';
    } else {
      ctx.fillStyle = '#4ade80'; // grass
    }
    ctx.fill();

    // Terrain border
    ctx.strokeStyle = tile.owned ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Draw grass texture for owned tiles
    if (tile.owned && !tile.path && !tile.building && zoomLevel > 0.5) {
      drawGrassTexture(ctx, halfW, halfH, zoomLevel);
    }

    ctx.restore();

    // Draw path on top of terrain
    if (tile.path) {
      const connections = getPathConnections(grid, gridSize, gridX, gridY);
      drawPath(ctx, screenX, screenY - heightOffset, tile, connections, zoomLevel, isHovered, isSelected);
    }

    // Draw buildings
    if (tile.building) {
      ctx.save();
      ctx.translate(screenX, screenY - heightOffset);
      drawBuilding(ctx, tile, halfW, halfH, zoomLevel);
      ctx.restore();
    }

    // Hover/selection highlight (for non-path tiles)
    if ((isHovered || isSelected) && !tile.path) {
      ctx.save();
      ctx.translate(screenX, screenY - heightOffset);
      ctx.beginPath();
      ctx.moveTo(0, -halfH);
      ctx.lineTo(halfW, 0);
      ctx.lineTo(0, halfH);
      ctx.lineTo(-halfW, 0);
      ctx.closePath();
      ctx.strokeStyle = !tile.owned ? 'rgba(239, 68, 68, 0.8)' : (isSelected ? '#ffffff' : 'rgba(255,255,255,0.5)');
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();
      ctx.restore();
    }
  }, [drawGrassTexture, drawBuilding]);

  // Draw a guest
  const drawGuest = useCallback((
    ctx: CanvasRenderingContext2D,
    guest: { x: number; y: number; color: string },
    screenX: number,
    screenY: number,
    zoomLevel: number
  ) => {
    const size = 6 * zoomLevel;

    ctx.save();
    ctx.translate(screenX, screenY - size);

    // Simple circle for guest
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fillStyle = guest.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }, []);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = '#1a472a'; // Dark green background
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    const { grid, gridSize, guests } = latestStateRef.current;

    // Calculate visible bounds
    const topLeft = screenToGrid(0, 0, offset.x, offset.y, zoom);
    const bottomRight = screenToGrid(canvasSize.width, canvasSize.height, offset.x, offset.y, zoom);

    const minX = Math.max(0, topLeft.x - 2);
    const maxX = Math.min(gridSize - 1, bottomRight.x + 2);
    const minY = Math.max(0, topLeft.y - 2);
    const maxY = Math.min(gridSize - 1, bottomRight.y + 2);

    // Draw tiles in isometric order (back to front)
    for (let sum = minX + minY; sum <= maxX + maxY; sum++) {
      for (let x = Math.max(minX, sum - maxY); x <= Math.min(maxX, sum - minY); x++) {
        const y = sum - x;
        if (y < 0 || y >= gridSize || x < 0 || x >= gridSize) continue;

        const tile = grid[y]?.[x];
        if (!tile) continue;

        const screen = gridToScreen(x, y, offset.x, offset.y, zoom);
        drawTile(ctx, tile, screen.x, screen.y, zoom, hoveredTile?.x === x && hoveredTile?.y === y, selectedTile?.x === x && selectedTile?.y === y, x, y, grid, gridSize);
      }
    }

    // Draw ride tracks
    const { rides } = latestStateRef.current;
    for (const ride of rides) {
      if (ride.track && ride.track.length > 0) {
        drawRideTrack(ctx, ride, offset.x, offset.y, zoom);
      }
    }

    // Draw guests
    for (const guest of guests) {
      const screen = gridToScreen(guest.x, guest.y, offset.x, offset.y, zoom);
      drawGuest(ctx, guest, screen.x, screen.y, zoom);
    }
  }, [state, offset, zoom, canvasSize, hoveredTile, selectedTile, latestStateRef, drawTile, drawGuest]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else {
      // Update hovered tile
      const grid = screenToGrid(mouseX, mouseY, offset.x, offset.y, zoom);
      if (grid.x >= 0 && grid.x < state.gridSize && grid.y >= 0 && grid.y < state.gridSize) {
        setHoveredTile(grid);
      } else {
        setHoveredTile(null);
      }
    }
  }, [isDragging, dragStart, offset, zoom, state.gridSize]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      // Check if this was a click (minimal movement)
      const dx = Math.abs(e.clientX - (dragStart.x + offset.x));
      const dy = Math.abs(e.clientY - (dragStart.y + offset.y));
      
      if (dx < 5 && dy < 5 && hoveredTile) {
        // This was a click
        if (state.selectedTool === 'select') {
          setSelectedTile(hoveredTile);
        } else {
          placeAtTile(hoveredTile.x, hoveredTile.y);
        }
      }
    }
    setIsDragging(false);
  }, [isDragging, dragStart, offset, hoveredTile, state.selectedTool, setSelectedTile, placeAtTile]);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setHoveredTile(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * delta));

    // Zoom toward mouse position
    const zoomRatio = newZoom / zoom;
    setOffset({
      x: mouseX - (mouseX - offset.x) * zoomRatio,
      y: mouseY - (mouseY - offset.y) * zoomRatio,
    });
    setZoom(newZoom);
  }, [zoom, offset]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        className="block"
      />
    </div>
  );
}
