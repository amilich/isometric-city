'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { msg, useMessages } from 'gt-next';
import { useCoaster } from '@/context/CoasterContext';
import { Card } from '@/components/ui/card';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';

interface CoasterMiniMapProps {
  onNavigate?: (gridX: number, gridY: number) => void;
  viewport?: {
    offset: { x: number; y: number };
    zoom: number;
    canvasSize: { width: number; height: number };
  } | null;
}

const MINIMAP_LABEL = msg('Minimap');

export function CoasterMiniMap({ onNavigate, viewport }: CoasterMiniMapProps) {
  const { state } = useCoaster();
  const { grid, gridSize, tick } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridImageRef = useRef<ImageData | null>(null);
  const lastGridRenderTickRef = useRef(-1);
  const lastGridRef = useRef<typeof grid | null>(null);
  const m = useMessages();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 140;
    const scale = size / gridSize;

    const gridChanged = lastGridRef.current !== grid;
    lastGridRef.current = grid;

    const shouldRenderGrid =
      lastGridRenderTickRef.current === -1 ||
      tick - lastGridRenderTickRef.current >= 8 ||
      gridChanged;

    if (shouldRenderGrid) {
      lastGridRenderTickRef.current = tick;
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, size, size);

      for (let y = 0; y < gridSize; y += 1) {
        for (let x = 0; x < gridSize; x += 1) {
          const tile = grid[y][x];
          let color = '#2d5a3d';

          if (tile.terrain === 'water') color = '#0ea5e9';
          else if (tile.path === 'path') color = '#94a3b8';
          else if (tile.path === 'queue') color = '#60a5fa';
          else if (tile.track) color = '#f97316';
          else if (tile.rideId) color = '#f472b6';
          else if (tile.facility) color = '#a855f7';
          else if (tile.scenery.length) color = '#16a34a';

          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
        }
      }

      gridImageRef.current = ctx.getImageData(0, 0, size, size);
    } else if (gridImageRef.current) {
      ctx.putImageData(gridImageRef.current, 0, 0);
    }

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
  }, [grid, gridSize, tick, viewport]);

  const [isDragging, setIsDragging] = useState(false);

  const navigateToPosition = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
      if (!onNavigate) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;
      const size = 140;
      const scale = size / gridSize;
      const gridX = Math.floor(clickX / scale);
      const gridY = Math.floor(clickY / scale);
      onNavigate(Math.max(0, Math.min(gridSize - 1, gridX)), Math.max(0, Math.min(gridSize - 1, gridY)));
    },
    [gridSize, onNavigate]
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      setIsDragging(true);
      navigateToPosition(event);
    },
    [navigateToPosition]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDragging) {
        navigateToPosition(event);
      }
    },
    [isDragging, navigateToPosition]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
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
    </Card>
  );
}
