'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Card } from '@/components/ui/card';
import { TILE_HEIGHT, TILE_WIDTH } from '@/components/game/types';
import { getStaffPatrolColor, STAFF_TYPE_COLORS } from '@/lib/coasterStaff';

const MINIMAP_SIZE = 140;

interface CoasterMiniMapProps {
  onNavigate?: (gridX: number, gridY: number) => void;
  viewport?: {
    offset: { x: number; y: number };
    zoom: number;
    canvasSize: { width: number; height: number };
  } | null;
  focusedStaffId?: number | null;
}

export default function CoasterMiniMap({ onNavigate, viewport, focusedStaffId }: CoasterMiniMapProps) {
  const { state } = useCoaster();
  const { grid, gridSize, parkEntrance, staff } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const colorMap = useMemo(() => ({
    grass: '#2d5a3d',
    dirt: '#8b5e34',
    sand: '#c8b27a',
    rock: '#6b7280',
    water: '#0ea5e9',
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = MINIMAP_SIZE / gridSize;
    ctx.fillStyle = '#0b1723';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = grid[y][x];
        let color = colorMap[tile.terrain] ?? '#2d5a3d';

        if (tile.path) {
          color = tile.path.style === 'queue' ? '#f4b400' : '#7c8894';
        }
        if (tile.track) {
          color = '#f97316';
        }
        if (tile.rideId) {
          color = '#f97316';
        }
        if (tile.scenery) {
          color = '#22c55e';
        }
        if (tile.building) {
          color = '#f59e0b';
        }
        if (x === parkEntrance.x && y === parkEntrance.y) {
          color = '#facc15';
        }

        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }

    staff.forEach((member) => {
      if (!member.patrolArea) return;
      const { minX, minY, maxX, maxY } = member.patrolArea;
      const isFocused = focusedStaffId ? member.id === focusedStaffId : false;
      ctx.save();
      ctx.strokeStyle = getStaffPatrolColor(member.id);
      ctx.globalAlpha = focusedStaffId ? (isFocused ? 0.9 : 0.25) : 0.6;
      ctx.lineWidth = isFocused ? 2 : 1;
      ctx.strokeRect(
        minX * scale,
        minY * scale,
        (maxX - minX + 1) * scale,
        (maxY - minY + 1) * scale
      );
      ctx.restore();
    });

    staff.forEach((member) => {
      const size = Math.max(2, Math.floor(scale));
      ctx.fillStyle = STAFF_TYPE_COLORS[member.type] ?? '#e2e8f0';
      ctx.fillRect(member.tileX * scale, member.tileY * scale, size, size);
      if (focusedStaffId && member.id === focusedStaffId) {
        ctx.save();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1;
        ctx.strokeRect(member.tileX * scale - 1, member.tileY * scale - 1, size + 2, size + 2);
        ctx.restore();
      }
    });

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
  }, [grid, gridSize, viewport, colorMap, parkEntrance, staff, focusedStaffId]);

  const navigateToPosition = useCallback((event: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
    if (!onNavigate) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const scale = MINIMAP_SIZE / gridSize;
    const gridX = Math.floor(clickX / scale);
    const gridY = Math.floor(clickY / scale);
    const clampedX = Math.max(0, Math.min(gridSize - 1, gridX));
    const clampedY = Math.max(0, Math.min(gridSize - 1, gridY));
    onNavigate(clampedX, clampedY);
  }, [gridSize, onNavigate]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    navigateToPosition(event);
  }, [navigateToPosition]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      navigateToPosition(event);
    }
  }, [isDragging, navigateToPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging]);

  return (
    <Card className="fixed bottom-6 right-8 p-3 shadow-lg bg-card/90 border-border/70 z-50">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">
        Park Map
      </div>
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        className="block rounded-md border border-border/60 cursor-pointer select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </Card>
  );
}
