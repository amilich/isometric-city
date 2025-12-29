'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { msg } from 'gt-next';
import { useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Card } from '@/components/ui/card';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';

// Service buildings for minimap color mapping
const SERVICE_BUILDINGS = new Set([
  'police_station', 'fire_station', 'hospital', 'school', 'university'
]);

// Park buildings for minimap color mapping
const PARK_BUILDINGS = new Set([
  'park', 'park_large', 'tennis', 'basketball_courts', 'playground_small', 
  'playground_large', 'baseball_field_small', 'soccer_field_small', 'football_field', 
  'baseball_stadium', 'community_center', 'swimming_pool', 'skate_park', 
  'mini_golf_course', 'bleachers_field', 'go_kart_track', 'amphitheater', 
  'greenhouse_garden', 'animal_pens_farm', 'cabin_house', 'campground',
  'marina_docks_small', 'pier_large', 'roller_coaster_small', 'community_garden',
  'pond_park', 'park_gate', 'mountain_lodge', 'mountain_trailhead', 'office_building_small'
]);

interface MiniMapProps {
  onNavigate?: (gridX: number, gridY: number) => void;
  viewport?: { 
    offset: { x: number; y: number }; 
    zoom: number; 
    canvasSize: { width: number; height: number } 
  } | null;
}

// Canvas-based Minimap - Memoized with throttled grid rendering
// Translatable label
const MINIMAP_LABEL = msg('Minimap');

export const MiniMap = React.memo(function MiniMap({ onNavigate, viewport }: MiniMapProps) {
  const { state } = useGame();
  const { grid, gridSize, tick } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridImageRef = useRef<ImageData | null>(null);
  const lastGridRenderTickRef = useRef(-1);
  const lastGridRef = useRef<typeof grid | null>(null);
  const m = useMessages();
  
  // Pre-compute color map for faster lookups
  const serviceBuildings = useMemo(() => SERVICE_BUILDINGS, []);
  const parkBuildings = useMemo(() => PARK_BUILDINGS, []);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const size = 140;
    const scale = size / gridSize;
    
    // Track if grid reference changed (indicates building placement or other grid modification)
    const gridChanged = lastGridRef.current !== grid;
    lastGridRef.current = grid;
    
    // Re-render grid portion every 10 ticks OR when grid changes (building placed, etc.)
    // This ensures immediate updates when user places buildings while keeping CPU usage low
    const shouldRenderGrid = lastGridRenderTickRef.current === -1 || 
                             tick - lastGridRenderTickRef.current >= 10 ||
                             gridChanged;
    
    if (shouldRenderGrid) {
      lastGridRenderTickRef.current = tick;
      
      ctx.fillStyle = '#0b1723';
      ctx.fillRect(0, 0, size, size);
      
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const tile = grid[y][x];
          const buildingType = tile.building.type;
          let color = '#2d5a3d';
          
          // Prioritized color checks using Set for common cases
          if (buildingType === 'water') color = '#0ea5e9';
          else if (buildingType === 'road') color = '#6b7280';
          else if (buildingType === 'tree') color = '#166534';
          else if (tile.building.onFire) color = '#ef4444';
          else if (tile.zone === 'residential' && buildingType !== 'grass') color = '#22c55e';
          else if (tile.zone === 'residential') color = '#14532d';
          else if (tile.zone === 'commercial' && buildingType !== 'grass') color = '#38bdf8';
          else if (tile.zone === 'commercial') color = '#1d4ed8';
          else if (tile.zone === 'industrial' && buildingType !== 'grass') color = '#f59e0b';
          else if (tile.zone === 'industrial') color = '#b45309';
          else if (serviceBuildings.has(buildingType)) color = '#c084fc';
          else if (buildingType === 'power_plant') color = '#f97316';
          else if (buildingType === 'water_tower') color = '#06b6d4';
          else if (parkBuildings.has(buildingType)) color = '#84cc16';
          
          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
        }
      }
      
      // Save the grid portion for quick viewport-only updates
      gridImageRef.current = ctx.getImageData(0, 0, size, size);
    } else if (gridImageRef.current) {
      // Restore cached grid image, then just draw viewport
      ctx.putImageData(gridImageRef.current, 0, 0);
    }
    
    // Draw viewport rectangle (always updated)
    if (viewport) {
      const { offset, zoom, canvasSize } = viewport;
      
      const screenToGridForMinimap = (screenX: number, screenY: number) => {
        const adjustedX = (screenX - offset.x) / zoom;
        const adjustedY = (screenY - offset.y) / zoom;
        const gridX = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
        const gridY = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
        return { gridX, gridY };
      };
      
      const topLeft = screenToGridForMinimap(0, 0);
      const topRight = screenToGridForMinimap(canvasSize.width, 0);
      const bottomLeft = screenToGridForMinimap(0, canvasSize.height);
      const bottomRight = screenToGridForMinimap(canvasSize.width, canvasSize.height);
      
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
  }, [grid, gridSize, viewport, tick, serviceBuildings, parkBuildings]);

  const [isDragging, setIsDragging] = useState(false);
  
  const navigateToPosition = useCallback((e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
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
    
    // Clamp to valid grid coordinates
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

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle mouse up outside the canvas
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);
  
  return (
    <Card className="fixed bottom-6 right-8 p-3 shadow-lg bg-card/90 border-border/70 z-50">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">
        {m(MINIMAP_LABEL)}
      </div>
      <canvas
        ref={canvasRef}
        width={140}
        height={140}
        className="block rounded-md border border-border/60 cursor-pointer select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      <div className="mt-2 grid grid-cols-4 gap-1 text-[8px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-sm" />
          <span className="text-muted-foreground">R</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-sm" />
          <span className="text-muted-foreground">C</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-amber-500 rounded-sm" />
          <span className="text-muted-foreground">I</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-pink-500 rounded-sm" />
          <span className="text-muted-foreground">S</span>
        </div>
      </div>
    </Card>
  );
});
