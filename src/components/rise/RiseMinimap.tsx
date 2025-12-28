'use client';

import React, { useEffect, useRef } from 'react';
import { RiseGameState } from '@/games/rise/types';

const TILE_COLORS: Record<string, string> = {
  grass: '#0f172a',
  forest: '#14532d',
  mountain: '#475569',
  water: '#0ea5e9',
};

export function RiseMinimap({
  state,
  onNavigate,
  viewport,
}: {
  state: RiseGameState;
  onNavigate?: (x: number, y: number) => void;
  viewport?: { x1: number; y1: number; x2: number; y2: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 200;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    const gSize = state.gridSize;
    const scale = size / gSize;

    // tiles
    for (let y = 0; y < gSize; y++) {
      for (let x = 0; x < gSize; x++) {
        const tile = state.tiles[y][x];
        ctx.fillStyle = TILE_COLORS[tile.terrain] || '#111827';
        ctx.fillRect(x * scale, y * scale, scale, scale);
        if (tile.ownerId) {
          ctx.fillStyle = tile.ownerId === state.localPlayerId ? 'rgba(34,211,238,0.25)' : 'rgba(249,115,22,0.22)';
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }

    // viewport box
    if (viewport) {
      const { x1, y1, x2, y2 } = viewport;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x1 * scale, y1 * scale, (x2 - x1 + 1) * scale, (y2 - y1 + 1) * scale);
      ctx.setLineDash([]);
    }

    // buildings
    for (const b of state.buildings) {
      const color = b.ownerId === state.localPlayerId ? '#22d3ee' : '#f97316';
      ctx.fillStyle = color;
      ctx.fillRect(b.tile.x * scale, b.tile.y * scale, scale * 1.4, scale * 1.4);
    }

    // units
    for (const u of state.units) {
      const color = u.ownerId === state.localPlayerId ? '#a855f7' : '#facc15';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(u.position.x * scale, u.position.y * scale, Math.max(1.5, scale * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
  }, [state, size, viewport]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 shadow-lg">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <span>Minimap</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block bg-[#22d3ee]" />You</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block bg-[#f97316]" />AI</div>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="w-full h-full border border-slate-800 rounded cursor-pointer"
        onClick={e => {
          if (!onNavigate) return;
          const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
          const gx = ((e.clientX - rect.left) / rect.width) * state.gridSize;
          const gy = ((e.clientY - rect.top) / rect.height) * state.gridSize;
          onNavigate(Math.floor(gx), Math.floor(gy));
        }}
      />
    </div>
  );
}
