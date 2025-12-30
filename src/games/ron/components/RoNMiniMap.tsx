/**
 * Rise of Nations - MiniMap Component
 * 
 * Shows a small overview map with player territories, units, and viewport indicator.
 * Shares viewport rendering logic with IsoCity's MiniMap.
 */
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRoN } from '../context/RoNContext';
import { PLAYER_COLORS } from '../lib/renderConfig';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/shared';

interface RoNMiniMapProps {
  onNavigate?: (x: number, y: number) => void;
  viewport?: { 
    offset: { x: number; y: number }; 
    zoom: number; 
    canvasSize: { width: number; height: number } 
  } | null;
  rightOffset?: number; // Offset from right edge (for AI sidebar)
}

export function RoNMiniMap({ onNavigate, viewport, rightOffset = 16 }: RoNMiniMapProps) {
  const { state } = useRoN();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
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
        } else if (tile.hasMetalDeposit) {
          ctx.fillStyle = '#6b7280'; // Grey for metal/mountains
        } else if (tile.hasOilDeposit) {
          ctx.fillStyle = '#1f2937'; // Dark for oil
        } else {
          ctx.fillStyle = '#3d5a47'; // Muted green for grass
        }
        ctx.fillRect(px, py, scale + 0.5, scale + 0.5);
        
        // Ownership overlay
        if (tile.ownerId) {
          const playerIndex = state.players.findIndex(p => p.id === tile.ownerId);
          if (playerIndex >= 0) {
            ctx.fillStyle = PLAYER_COLORS[playerIndex] + '88';
            ctx.fillRect(px, py, scale + 0.5, scale + 0.5);
          }
        }
        
        // Buildings (damaged buildings show red)
        if (tile.building) {
          const playerIndex = state.players.findIndex(p => p.id === tile.building?.ownerId);
          const isDamaged = tile.building.health < tile.building.maxHealth;
          ctx.fillStyle = isDamaged ? '#ef4444' : (PLAYER_COLORS[playerIndex] || '#ffffff');
          ctx.fillRect(px, py, scale + 0.5, scale + 0.5);
        }
      });
    });
    
    // Draw territory border lines where ownership changes
    for (let y = 0; y < state.gridSize; y++) {
      for (let x = 0; x < state.gridSize; x++) {
        const tile = state.grid[y]?.[x];
        if (!tile?.ownerId) continue;
        
        const owner = tile.ownerId;
        const playerIndex = state.players.findIndex(p => p.id === owner);
        const borderColor = PLAYER_COLORS[playerIndex] || '#ffffff';
        
        ctx.strokeStyle = borderColor + 'DD'; // 87% opacity
        ctx.lineWidth = 1.5;
        
        const px = x * scale;
        const py = y * scale;
        
        // Check each neighbor and draw border if ownership differs
        // Right neighbor
        const rightTile = state.grid[y]?.[x + 1];
        if (!rightTile?.ownerId || rightTile.ownerId !== owner) {
          ctx.beginPath();
          ctx.moveTo(px + scale, py);
          ctx.lineTo(px + scale, py + scale);
          ctx.stroke();
        }
        
        // Bottom neighbor
        const bottomTile = state.grid[y + 1]?.[x];
        if (!bottomTile?.ownerId || bottomTile.ownerId !== owner) {
          ctx.beginPath();
          ctx.moveTo(px, py + scale);
          ctx.lineTo(px + scale, py + scale);
          ctx.stroke();
        }
        
        // Left neighbor (only if at edge)
        if (x === 0 || !state.grid[y]?.[x - 1]?.ownerId || state.grid[y][x - 1].ownerId !== owner) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + scale);
          ctx.stroke();
        }
        
        // Top neighbor (only if at edge)
        if (y === 0 || !state.grid[y - 1]?.[x]?.ownerId || state.grid[y - 1][x].ownerId !== owner) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + scale, py);
          ctx.stroke();
        }
      }
    }
    
    // Draw units
    state.units.forEach(unit => {
      const playerIndex = state.players.findIndex(p => p.id === unit.ownerId);
      ctx.fillStyle = PLAYER_COLORS[playerIndex] || '#ffffff';
      ctx.beginPath();
      ctx.arc(unit.x * scale, unit.y * scale, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw viewport rectangle (shared with IsoCity logic)
    if (viewport) {
      const { offset, zoom, canvasSize } = viewport;
      
      // Convert screen coordinates to grid coordinates for minimap
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
    
  }, [state.grid, state.units, state.players, state.gridSize, scale, viewport]);
  
  // Navigation handler (click or drag)
  const navigateToPosition = useCallback((e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
    if (!onNavigate) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const gridX = Math.floor(clickX / scale);
    const gridY = Math.floor(clickY / scale);
    
    onNavigate(gridX, gridY);
  }, [onNavigate, scale]);
  
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
  
  return (
    <div className="absolute bottom-4 z-30" style={{ right: rightOffset }}>
      <div className="bg-slate-800 p-2 rounded-lg shadow-lg border border-slate-600">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="rounded cursor-pointer"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </div>
    </div>
  );
}
