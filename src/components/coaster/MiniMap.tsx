'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Card } from '@/components/ui/card';

// =============================================================================
// CONSTANTS
// =============================================================================

const TILE_WIDTH = 64;
const TILE_HEIGHT = TILE_WIDTH * 0.6;

// =============================================================================
// MINIMAP COMPONENT
// =============================================================================

interface MiniMapProps {
  onNavigate?: (gridX: number, gridY: number) => void;
  viewport?: {
    offset: { x: number; y: number };
    zoom: number;
    canvasSize: { width: number; height: number };
  } | null;
}

export function MiniMap({ onNavigate, viewport }: MiniMapProps) {
  const { state } = useCoaster();
  const { grid, gridSize, tick } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Render minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const size = 140;
    const scale = size / gridSize;
    
    // Clear
    ctx.fillStyle = '#0b1723';
    ctx.fillRect(0, 0, size, size);
    
    // Draw tiles
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = grid[y][x];
        let color = '#2d5a3d'; // Default grass
        
        if (tile.terrain === 'water') {
          color = '#0ea5e9';
        } else if (tile.path) {
          color = '#9ca3af';
        } else if (tile.queue) {
          color = '#6b7280';
        } else if (tile.hasCoasterTrack) {
          color = '#f59e0b';
        } else if (tile.building.type !== 'empty' && tile.building.type !== 'grass') {
          // Different colors for building types
          if (tile.building.type.startsWith('ride_')) {
            color = '#ec4899'; // Pink for rides
          } else if (tile.building.type.startsWith('food_') || tile.building.type.startsWith('drink_') || tile.building.type.startsWith('snack_')) {
            color = '#f97316'; // Orange for food
          } else if (tile.building.type.startsWith('shop_') || tile.building.type === 'restroom') {
            color = '#8b5cf6'; // Purple for shops
          } else if (tile.building.type.startsWith('tree_') || tile.building.type.startsWith('bush_') || tile.building.type.startsWith('flowers_')) {
            color = '#22c55e'; // Green for vegetation
          } else if (tile.building.type.startsWith('station_')) {
            color = '#ef4444'; // Red for coaster stations
          } else {
            color = '#64748b'; // Gray for other buildings
          }
        }
        
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }
    
    // Draw viewport rectangle
    if (viewport) {
      const { offset, zoom, canvasSize } = viewport;
      
      const screenToGrid = (screenX: number, screenY: number) => {
        const adjustedX = (screenX - offset.x) / zoom;
        const adjustedY = (screenY - offset.y) / zoom;
        const gridX = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
        const gridY = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
        return { gridX, gridY };
      };
      
      const topLeft = screenToGrid(0, 0);
      const topRight = screenToGrid(canvasSize.width, 0);
      const bottomLeft = screenToGrid(0, canvasSize.height);
      const bottomRight = screenToGrid(canvasSize.width, canvasSize.height);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(topLeft.gridX * scale, topLeft.gridY * scale);
      ctx.lineTo(topRight.gridX * scale, topRight.gridY * scale);
      ctx.lineTo(bottomRight.gridX * scale, bottomRight.gridY * scale);
      ctx.lineTo(bottomLeft.gridX * scale, bottomLeft.gridY * scale);
      ctx.closePath();
      ctx.stroke();
    }
  }, [grid, gridSize, viewport, tick]);
  
  // Click/drag handling
  const navigateToPosition = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onNavigate) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const size = 140;
    const scale = size / gridSize;
    
    const gridX = Math.floor(clickX / scale);
    const gridY = Math.floor(clickY / scale);
    
    const clampedX = Math.max(0, Math.min(gridSize - 1, gridX));
    const clampedY = Math.max(0, Math.min(gridSize - 1, gridY));
    
    onNavigate(clampedX, clampedY);
  }, [onNavigate, gridSize]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    navigateToPosition(e);
  }, [navigateToPosition]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      navigateToPosition(e);
    }
  }, [isDragging, navigateToPosition]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  return (
    <Card className="fixed bottom-6 right-8 p-3 shadow-lg bg-card/90 border-border/70 z-50">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">
        Minimap
      </div>
      <canvas
        ref={canvasRef}
        width={140}
        height={140}
        className="block rounded-md border border-border/60 cursor-pointer select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="mt-2 grid grid-cols-4 gap-1 text-[8px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-sm" />
          <span className="text-muted-foreground">Path</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-pink-500 rounded-sm" />
          <span className="text-muted-foreground">Ride</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-orange-500 rounded-sm" />
          <span className="text-muted-foreground">Food</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-cyan-500 rounded-sm" />
          <span className="text-muted-foreground">Water</span>
        </div>
      </div>
    </Card>
  );
}

export default MiniMap;
