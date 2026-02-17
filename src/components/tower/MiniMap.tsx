'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useTower } from '@/context/TowerContext';

const TILE_WIDTH = 64;
const HEIGHT_RATIO = 0.6;
const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;

function screenToGridFloat(screenX: number, screenY: number): { gridX: number; gridY: number } {
  const gridX = (screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2;
  const gridY = (screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2;
  return { gridX, gridY };
}

export function MiniMap({
  viewport,
  onNavigate,
}: {
  viewport: { offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null;
  onNavigate: (x: number, y: number) => void;
}) {
  const { state } = useTower();
  const { grid, gridSize } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sizePx = 160;
  const padding = 8;

  const tileSize = useMemo(() => Math.max(1, Math.floor((sizePx - padding * 2) / gridSize)), [gridSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = sizePx;
    canvas.height = sizePx;

    ctx.clearRect(0, 0, sizePx, sizePx);
    ctx.fillStyle = 'rgba(2,6,23,0.85)';
    ctx.fillRect(0, 0, sizePx, sizePx);

    // Draw tiles in 2D minimap space (not isometric)
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const t = grid[y]![x]!;
        let c = t.terrain === 'water' ? '#0284c7' : '#14532d';
        if (t.kind === 'path') c = '#64748b';
        if (t.kind === 'spawn') c = '#22c55e';
        if (t.kind === 'base') c = '#ef4444';
        if (t.tower) c = '#fbbf24';
        ctx.fillStyle = c;
        ctx.fillRect(padding + x * tileSize, padding + y * tileSize, tileSize, tileSize);
      }
    }

    // Viewport rectangle (approx)
    if (viewport) {
      const { offset, zoom, canvasSize } = viewport;

      // Convert the four canvas corners into grid coordinates (approx bounds)
      const corners = [
        { sx: 0, sy: 0 },
        { sx: canvasSize.width, sy: 0 },
        { sx: 0, sy: canvasSize.height },
        { sx: canvasSize.width, sy: canvasSize.height },
      ].map(({ sx, sy }) => {
        const worldX = (sx - offset.x) / zoom;
        const worldY = (sy - offset.y) / zoom;
        return screenToGridFloat(worldX, worldY);
      });

      const minX = Math.max(0, Math.min(...corners.map((c) => c.gridX)));
      const maxX = Math.min(gridSize, Math.max(...corners.map((c) => c.gridX)));
      const minY = Math.max(0, Math.min(...corners.map((c) => c.gridY)));
      const maxY = Math.min(gridSize, Math.max(...corners.map((c) => c.gridY)));

      const rx = padding + minX * tileSize;
      const ry = padding + minY * tileSize;
      const rw = Math.max(1, (maxX - minX) * tileSize);
      const rh = Math.max(1, (maxY - minY) * tileSize);

      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, rw, rh);
    }
  }, [grid, gridSize, tileSize, viewport]);

  return (
    <div className="absolute bottom-4 right-4 z-20">
      <button
        className="relative rounded-lg border border-slate-700 bg-slate-950/80 shadow-lg overflow-hidden"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
          const x = e.clientX - rect.left - padding;
          const y = e.clientY - rect.top - padding;
          const gridX = Math.floor(x / tileSize);
          const gridY = Math.floor(y / tileSize);
          if (gridX >= 0 && gridY >= 0 && gridX < gridSize && gridY < gridSize) {
            onNavigate(gridX, gridY);
          }
        }}
        title="Minimap (click to navigate)"
      >
        <canvas ref={canvasRef} width={sizePx} height={sizePx} />
      </button>
    </div>
  );
}

