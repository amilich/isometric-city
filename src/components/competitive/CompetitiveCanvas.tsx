// Competitive Mode Canvas - Renders the game with fog of war and military units
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useCompetitiveGame } from '@/context/CompetitiveGameContext';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';
import { MilitaryUnit, MilitaryUnitType, FogState, MILITARY_UNIT_STATS } from '@/types/competitive';
import { gridToScreen } from '@/components/game/utils';
import { BuildingType } from '@/types/game';

// Unit colors by type
const UNIT_COLORS: Record<MilitaryUnitType, string> = {
  infantry: '#4ade80',
  tank: '#60a5fa', 
  military_helicopter: '#f472b6',
};

export function CompetitiveCanvas() {
  const { 
    state, 
    selectUnitsInBox, 
    moveSelectedUnits, 
    attackWithSelectedUnits,
    setSelectionBox,
    clearSelection,
    getBuildingOwner,
  } = useCompetitiveGame();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Viewport state
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
  const [isDragging, setIsDragging] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Initialize viewport centered on player city (only on mount)
  useEffect(() => {
    const player = state.players.find(p => p.id === 'player');
    if (player && containerRef.current) {
      const { screenX, screenY } = gridToScreen(player.cityX, player.cityY, 0, 0);
      const container = containerRef.current;
      const currentZoom = 0.8; // Initial zoom value
      setOffset({
        x: container.clientWidth / 2 - screenX * currentZoom,
        y: container.clientHeight / 2 - screenY * currentZoom,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    
    const render = () => {
      const container = containerRef.current;
      if (!container) return;
      
      // Size canvas to container
      const width = container.clientWidth;
      const height = container.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      // Clear
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      
      // Apply viewport transform
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);
      
      // Get player fog
      const playerFog = state.fogOfWar.player;
      
      // Draw tiles
      for (let y = 0; y < state.gridSize; y++) {
        for (let x = 0; x < state.gridSize; x++) {
          const tile = state.grid[y][x];
          const { screenX, screenY } = gridToScreen(x, y, 0, 0);
          
          // Get fog state
          const fogState = playerFog?.tiles[y]?.[x] || 'unexplored';
          
          // Skip unexplored tiles
          if (fogState === 'unexplored') {
            drawFogTile(ctx, screenX, screenY, 'unexplored');
            continue;
          }
          
          // Draw tile
          drawTile(ctx, screenX, screenY, tile.building.type, getBuildingOwner(x, y), tile.building.onFire);
          
          // Draw fog overlay for explored but not visible
          if (fogState === 'explored') {
            drawFogTile(ctx, screenX, screenY, 'explored');
          }
        }
      }
      
      // Draw military units
      for (const unit of state.militaryUnits) {
        if (unit.state === 'dead') continue;
        
        // Only draw units in visible areas for enemies, always for player
        if (unit.owner !== 'player') {
          const fogState = playerFog?.tiles[Math.round(unit.tileY)]?.[Math.round(unit.tileX)];
          if (fogState !== 'visible') continue;
        }
        
        drawMilitaryUnit(ctx, unit, state.players.find(p => p.id === unit.owner)?.color || '#888');
      }
      
      // Draw selection box
      if (state.selectionBox) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.strokeRect(
          state.selectionBox.startX,
          state.selectionBox.startY,
          state.selectionBox.endX - state.selectionBox.startX,
          state.selectionBox.endY - state.selectionBox.startY
        );
        ctx.setLineDash([]);
        
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(
          state.selectionBox.startX,
          state.selectionBox.startY,
          state.selectionBox.endX - state.selectionBox.startX,
          state.selectionBox.endY - state.selectionBox.startY
        );
      }
      
      ctx.restore();
    };
    
    const animFrame = requestAnimationFrame(function loop() {
      render();
      requestAnimationFrame(loop);
    });
    
    return () => cancelAnimationFrame(animFrame);
  }, [state, offset, zoom, getBuildingOwner]);
  
  // Handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or Alt+click: pan
      setIsDragging(true);
      setDragStart({ x: mouseX - offset.x, y: mouseY - offset.y });
    } else if (e.button === 0) {
      // Left click: start selection
      const worldX = (mouseX - offset.x) / zoom;
      const worldY = (mouseY - offset.y) / zoom;
      setIsSelecting(true);
      setSelectionStart({ x: worldX, y: worldY });
      setSelectionBox({ startX: worldX, startY: worldY, endX: worldX, endY: worldY });
    } else if (e.button === 2) {
      // Right click: move/attack
      const worldX = (mouseX - offset.x) / zoom;
      const worldY = (mouseY - offset.y) / zoom;
      
      // Convert to tile coordinates
      // Reverse isometric transformation
      const isoX = worldX / TILE_WIDTH;
      const isoY = worldY / TILE_HEIGHT;
      const tileX = Math.floor(isoX + isoY);
      const tileY = Math.floor(isoY - isoX + state.gridSize);
      
      // Clamp to grid
      const clampedX = Math.max(0, Math.min(state.gridSize - 1, tileX));
      const clampedY = Math.max(0, Math.min(state.gridSize - 1, tileY));
      
      // Check if there's an enemy at target
      const enemyBuilding = state.buildingOwnership.find(
        b => b.tileX === clampedX && b.tileY === clampedY && b.owner !== 'player'
      );
      const enemyUnit = state.militaryUnits.find(
        u => Math.round(u.tileX) === clampedX && Math.round(u.tileY) === clampedY && u.owner !== 'player'
      );
      
      if (enemyBuilding || enemyUnit) {
        attackWithSelectedUnits(clampedX, clampedY);
      } else {
        moveSelectedUnits(clampedX, clampedY);
      }
    }
  }, [offset, zoom, state.gridSize, state.buildingOwnership, state.militaryUnits, attackWithSelectedUnits, moveSelectedUnits, setSelectionBox]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (isDragging) {
      setOffset({
        x: mouseX - dragStart.x,
        y: mouseY - dragStart.y,
      });
    } else if (isSelecting) {
      const worldX = (mouseX - offset.x) / zoom;
      const worldY = (mouseY - offset.y) / zoom;
      setSelectionBox({
        startX: selectionStart.x,
        startY: selectionStart.y,
        endX: worldX,
        endY: worldY,
      });
    }
  }, [isDragging, isSelecting, dragStart, selectionStart, offset, zoom, setSelectionBox]);
  
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);
    } else if (isSelecting && state.selectionBox) {
      setIsSelecting(false);
      
      // Select units in box
      const minX = Math.min(state.selectionBox.startX, state.selectionBox.endX);
      const maxX = Math.max(state.selectionBox.startX, state.selectionBox.endX);
      const minY = Math.min(state.selectionBox.startY, state.selectionBox.endY);
      const maxY = Math.max(state.selectionBox.startY, state.selectionBox.endY);
      
      // Convert to unit positions
      const selectedUnits = state.militaryUnits.filter(u => {
        const { screenX, screenY } = gridToScreen(u.tileX, u.tileY, 0, 0);
        return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY && u.owner === 'player';
      });
      
      if (selectedUnits.length > 0) {
        selectUnitsInBox(minX, minY, maxX, maxY);
      } else {
        clearSelection();
      }
      
      setSelectionBox(null);
    }
  }, [isDragging, isSelecting, state.selectionBox, state.militaryUnits, selectUnitsInBox, clearSelection, setSelectionBox]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.3, Math.min(2, zoom * zoomFactor));
    
    // Zoom toward mouse position
    const worldX = (mouseX - offset.x) / zoom;
    const worldY = (mouseY - offset.y) / zoom;
    
    setZoom(newZoom);
    setOffset({
      x: mouseX - worldX * newZoom,
      y: mouseY - worldY * newZoom,
    });
  }, [zoom, offset]);
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);
  
  return (
    <div 
      ref={containerRef}
      className="flex-1 relative overflow-hidden bg-slate-900"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        className="absolute inset-0 cursor-crosshair"
      />
      
      {/* Speed controls */}
      <div className="absolute bottom-4 left-4 flex gap-1 bg-slate-800/80 rounded-lg p-1">
        {[0, 1, 2, 3].map(speed => (
          <button
            key={speed}
            onClick={() => state.speed !== speed && /* setSpeed would be here */ null}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              state.speed === speed
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {speed === 0 ? '⏸' : '▶'.repeat(speed)}
          </button>
        ))}
      </div>
    </div>
  );
}

// Draw a tile
function drawTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  buildingType: BuildingType,
  owner: string | null,
  onFire: boolean
) {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  const cx = screenX + halfW;
  const cy = screenY + halfH;
  
  // Draw isometric tile base
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
  
  // Color based on building type
  let color = '#2d3748'; // Default gray
  
  switch (buildingType) {
    case 'grass':
    case 'empty':
      color = '#22543d';
      break;
    case 'water':
      color = '#1e3a5f';
      break;
    case 'tree':
      color = '#276749';
      break;
    case 'road':
      color = '#4a5568';
      break;
    case 'house_small':
    case 'house_medium':
    case 'mansion':
    case 'apartment_low':
    case 'apartment_high':
      color = '#4299e1';
      break;
    case 'shop_small':
    case 'shop_medium':
    case 'mall':
    case 'office_low':
    case 'office_high':
      color = '#48bb78';
      break;
    case 'factory_small':
    case 'factory_medium':
    case 'factory_large':
    case 'warehouse':
      color = '#ed8936';
      break;
    case 'city_hall':
      color = '#9f7aea';
      break;
    case 'power_plant':
      color = '#f6e05e';
      break;
    case 'water_tower':
      color = '#63b3ed';
      break;
    default:
      color = '#718096';
  }
  
  ctx.fillStyle = color;
  ctx.fill();
  
  // Draw owner indicator
  if (owner) {
    ctx.strokeStyle = owner === 'player' ? '#3b82f6' : 
                      owner === 'ai1' ? '#ef4444' : 
                      owner === 'ai2' ? '#22c55e' : '#eab308';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  
  // Draw fire effect
  if (onFire) {
    const gradient = ctx.createRadialGradient(cx, cy - 10, 0, cx, cy - 10, 15);
    gradient.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 50, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy - 10, 15, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw building height for non-flat buildings
  if (!['grass', 'empty', 'water', 'road', 'tree'].includes(buildingType)) {
    const height = 20;
    ctx.fillStyle = shadeColor(color, -20);
    ctx.beginPath();
    ctx.moveTo(cx, cy - halfH);
    ctx.lineTo(cx, cy - halfH - height);
    ctx.lineTo(cx + halfW, cy - height);
    ctx.lineTo(cx + halfW, cy);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = shadeColor(color, 10);
    ctx.beginPath();
    ctx.moveTo(cx, cy - halfH - height);
    ctx.lineTo(cx + halfW, cy - height);
    ctx.lineTo(cx, cy + halfH - height);
    ctx.lineTo(cx - halfW, cy - height);
    ctx.closePath();
    ctx.fill();
  }
}

// Draw fog of war overlay
function drawFogTile(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, fogState: FogState) {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  const cx = screenX + halfW;
  const cy = screenY + halfH;
  
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
  
  if (fogState === 'unexplored') {
    ctx.fillStyle = '#0f172a';
  } else {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
  }
  
  ctx.fill();
}

// Draw military unit
function drawMilitaryUnit(ctx: CanvasRenderingContext2D, unit: MilitaryUnit, playerColor: string) {
  const { screenX, screenY } = gridToScreen(unit.tileX, unit.tileY, 0, 0);
  const cx = screenX + TILE_WIDTH / 2;
  const cy = screenY + TILE_HEIGHT / 2;
  
  const unitColor = UNIT_COLORS[unit.type];
  const size = unit.type === 'tank' ? 12 : unit.type === 'military_helicopter' ? 10 : 6;
  
  // Draw shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5, size + 2, size / 2 + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw unit body
  ctx.fillStyle = unit.flashTimer > 0 ? '#fff' : playerColor;
  
  if (unit.type === 'infantry') {
    // Draw infantry as a small circle with a dot for head
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = unit.flashTimer > 0 ? '#fff' : unitColor;
    ctx.beginPath();
    ctx.arc(cx, cy - 3, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (unit.type === 'tank') {
    // Draw tank as a rectangle with turret
    ctx.save();
    ctx.translate(cx, cy);
    
    // Rotate based on direction
    const angle = unit.direction === 'north' ? -Math.PI / 4 :
                  unit.direction === 'east' ? Math.PI / 4 :
                  unit.direction === 'south' ? 3 * Math.PI / 4 :
                  -3 * Math.PI / 4;
    ctx.rotate(angle);
    
    // Tank body
    ctx.fillRect(-size, -size * 0.6, size * 2, size * 1.2);
    
    // Turret
    ctx.fillStyle = unit.flashTimer > 0 ? '#fff' : unitColor;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Gun
    ctx.fillRect(0, -2, size * 1.2, 4);
    
    ctx.restore();
  } else if (unit.type === 'military_helicopter') {
    // Draw helicopter
    ctx.save();
    ctx.translate(cx, cy - 10); // Lift it up (flying)
    
    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Rotor (animated)
    ctx.strokeStyle = unit.flashTimer > 0 ? '#fff' : unitColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const rotorAngle = unit.animTimer;
    ctx.moveTo(-size * 1.5 * Math.cos(rotorAngle), -size * 0.5 * Math.sin(rotorAngle));
    ctx.lineTo(size * 1.5 * Math.cos(rotorAngle), size * 0.5 * Math.sin(rotorAngle));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 1.5 * Math.cos(rotorAngle + Math.PI / 2), -size * 0.5 * Math.sin(rotorAngle + Math.PI / 2));
    ctx.lineTo(size * 1.5 * Math.cos(rotorAngle + Math.PI / 2), size * 0.5 * Math.sin(rotorAngle + Math.PI / 2));
    ctx.stroke();
    
    ctx.restore();
  }
  
  // Draw selection ring
  if (unit.selected) {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, size + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  // Draw health bar
  const healthPercent = unit.health / unit.maxHealth;
  const barWidth = size * 2.5;
  const barHeight = 3;
  const barY = cy - size - 10;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(cx - barWidth / 2, barY, barWidth, barHeight);
  
  ctx.fillStyle = healthPercent > 0.6 ? '#22c55e' : healthPercent > 0.3 ? '#eab308' : '#ef4444';
  ctx.fillRect(cx - barWidth / 2, barY, barWidth * healthPercent, barHeight);
}

// Helper to shade a color
function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
