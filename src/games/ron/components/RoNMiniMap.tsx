/**
 * Rise of Nations - MiniMap Component
 * 
 * Shows a small overview map with player territories and units.
 */
'use client';

import React, { useRef, useEffect } from 'react';
import { useRoN } from '../context/RoNContext';
import { PLAYER_COLORS } from '../lib/renderConfig';

interface RoNMiniMapProps {
  onNavigate?: (x: number, y: number) => void;
}

export function RoNMiniMap({ onNavigate }: RoNMiniMapProps) {
  const { state } = useRoN();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const size = 150;
  const scale = size / state.gridSize;
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, size, size);
    
    // Draw terrain
    state.grid.forEach((row, y) => {
      row.forEach((tile, x) => {
        const px = x * scale;
        const py = y * scale;
        
        // Terrain color
        if (tile.terrain === 'water') {
          ctx.fillStyle = '#1e40af';
        } else if (tile.forestDensity > 0) {
          ctx.fillStyle = '#166534';
        } else {
          ctx.fillStyle = '#4ade80';
        }
        ctx.fillRect(px, py, scale + 0.5, scale + 0.5);
        
        // Ownership
        if (tile.ownerId) {
          const playerIndex = state.players.findIndex(p => p.id === tile.ownerId);
          if (playerIndex >= 0) {
            ctx.fillStyle = PLAYER_COLORS[playerIndex] + '88';
            ctx.fillRect(px, py, scale + 0.5, scale + 0.5);
          }
        }
        
        // Buildings
        if (tile.building) {
          const playerIndex = state.players.findIndex(p => p.id === tile.building?.ownerId);
          ctx.fillStyle = PLAYER_COLORS[playerIndex] || '#ffffff';
          ctx.fillRect(px, py, scale + 0.5, scale + 0.5);
        }
      });
    });
    
    // Draw units
    state.units.forEach(unit => {
      const playerIndex = state.players.findIndex(p => p.id === unit.ownerId);
      ctx.fillStyle = PLAYER_COLORS[playerIndex] || '#ffffff';
      ctx.beginPath();
      ctx.arc(unit.x * scale, unit.y * scale, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    
  }, [state.grid, state.units, state.players, state.gridSize, scale]);
  
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onNavigate) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = Math.floor((e.clientX - rect.left) / scale);
    const y = Math.floor((e.clientY - rect.top) / scale);
    
    onNavigate(x, y);
  };
  
  return (
    <div className="absolute bottom-4 right-4 z-30">
      <div className="bg-slate-800 p-2 rounded-lg shadow-lg border border-slate-600">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="rounded cursor-pointer"
          onClick={handleClick}
        />
      </div>
    </div>
  );
}
