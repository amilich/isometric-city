'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useTD } from '@/context/TDContext';
import type { Tile, Tower, Enemy, Projectile } from '@/games/td/types';

// =============================================================================
// CONSTANTS
// =============================================================================

const TILE_WIDTH = 64;
const HEIGHT_RATIO = 0.6;
const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;

// =============================================================================
// COORDINATE HELPERS
// =============================================================================

function gridToScreen(
  gridX: number,
  gridY: number,
  offsetX: number,
  offsetY: number,
  zoom: number
): { screenX: number; screenY: number } {
  const screenX = (gridX - gridY) * (TILE_WIDTH / 2) * zoom + offsetX;
  const screenY = (gridX + gridY) * (TILE_HEIGHT / 2) * zoom + offsetY;
  return { screenX, screenY };
}

function screenToGrid(
  screenX: number,
  screenY: number,
  offsetX: number,
  offsetY: number,
  zoom: number
): { gridX: number; gridY: number } {
  const adjX = (screenX - offsetX) / zoom;
  const adjY = (screenY - offsetY) / zoom;
  const gridX = (adjX / (TILE_WIDTH / 2) + adjY / (TILE_HEIGHT / 2)) / 2;
  const gridY = (adjY / (TILE_HEIGHT / 2) - adjX / (TILE_WIDTH / 2)) / 2;
  return { gridX: Math.floor(gridX), gridY: Math.floor(gridY) };
}

// =============================================================================
// DRAWING
// =============================================================================

const TILE_COLORS = {
  grass: { top: '#4a7c3f', left: '#3d6634', right: '#5a8f4f', stroke: '#2d4a26' },
  path: { top: '#6b7280', left: '#4b5563', right: '#9ca3af', stroke: '#374151' },
  spawn: { top: '#22c55e', left: '#16a34a', right: '#4ade80', stroke: '#15803d' },
  goal: { top: '#ef4444', left: '#b91c1c', right: '#f87171', stroke: '#991b1b' },
};

function drawIsometricTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colors: { top: string; left: string; right: string; stroke: string },
  zoom: number
) {
  const w = TILE_WIDTH * zoom;
  const h = TILE_HEIGHT * zoom;

  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawTower(
  ctx: CanvasRenderingContext2D,
  tower: Tower,
  offsetX: number,
  offsetY: number,
  zoom: number,
  isSelected: boolean
) {
  const { screenX, screenY } = gridToScreen(tower.x, tower.y, offsetX, offsetY, zoom);
  const cx = screenX + (TILE_WIDTH * zoom) / 2;
  const cy = screenY + (TILE_HEIGHT * zoom) / 2;

  const colors: Record<Tower['type'], string> = {
    basic: '#3b82f6',
    cannon: '#f59e0b',
    ice: '#06b6d4',
    laser: '#8b5cf6',
  };
  ctx.fillStyle = colors[tower.type];
  ctx.strokeStyle = isSelected ? '#fff' : '#1e293b';
  ctx.lineWidth = isSelected ? 3 : 1;

  const size = 12 * zoom;
  ctx.beginPath();
  ctx.rect(cx - size / 2, cy - size, size, size * 1.2);
  ctx.fill();
  ctx.stroke();

  // Tower base
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.6, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  offsetX: number,
  offsetY: number,
  zoom: number
) {
  const { screenX, screenY } = gridToScreen(enemy.x, enemy.y, offsetX, offsetY, zoom);
  const cx = screenX + (TILE_WIDTH * zoom) / 2;
  const cy = screenY + (TILE_HEIGHT * zoom) / 2;

  const colors: Record<Enemy['type'], string> = {
    basic: '#ef4444',
    fast: '#f97316',
    tank: '#7c3aed',
  };
  ctx.fillStyle = colors[enemy.type];
  ctx.beginPath();
  ctx.arc(cx, cy, 6 * zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Health bar
  const barW = 20 * zoom;
  const barH = 3 * zoom;
  ctx.fillStyle = '#374151';
  ctx.fillRect(cx - barW / 2, cy - 12 * zoom, barW, barH);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(cx - barW / 2, cy - 12 * zoom, barW * (enemy.health / enemy.maxHealth), barH);
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  proj: Projectile,
  offsetX: number,
  offsetY: number,
  zoom: number
) {
  const from = gridToScreen(proj.fromX, proj.fromY, offsetX, offsetY, zoom);
  const to = gridToScreen(proj.toX, proj.toY, offsetX, offsetY, zoom);
  const x = from.screenX + (to.screenX - from.screenX) * proj.progress + (TILE_WIDTH * zoom) / 2;
  const y = from.screenY + (to.screenY - from.screenY) * proj.progress + (TILE_HEIGHT * zoom) / 2;

  ctx.fillStyle = proj.isIce ? '#06b6d4' : '#fbbf24';
  ctx.beginPath();
  ctx.arc(x, y, 3 * zoom, 0, Math.PI * 2);
  ctx.fill();
}

// =============================================================================
// COMPONENT
// =============================================================================

interface TDGridProps {
  className?: string;
}

export function TDGrid({ className }: TDGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, placeTowerAt, sellTowerAt, setSelectedTile, setHoveredTile } = useTD();
  const offsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const gridSize = state.gridSize;
  const stateRef = useRef(state);
  stateRef.current = state;

  // Center the grid on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const gridCenterX = (gridSize - 1) / 2;
    const gridCenterY = (gridSize - 1) / 2;
    const { screenX, screenY } = gridToScreen(gridCenterX, gridCenterY, 0, 0, 1);
    offsetRef.current = {
      x: centerX - screenX - (TILE_WIDTH * zoomRef.current) / 2,
      y: centerY - screenY - (TILE_HEIGHT * zoomRef.current) / 2,
    };
  }, [gridSize]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const render = () => {
      const s = stateRef.current;
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const off = offsetRef.current;
      const z = zoomRef.current;

      // Draw tiles (depth-sorted)
      const tilesToDraw: { tile: Tile; screenX: number; screenY: number }[] = [];
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const tile = s.grid[y][x];
          const { screenX, screenY } = gridToScreen(x, y, off.x, off.y, z);
          tilesToDraw.push({ tile, screenX, screenY });
        }
      }
      tilesToDraw.sort((a, b) => a.screenY - b.screenY);

      for (const { tile, screenX, screenY } of tilesToDraw) {
        const colors = TILE_COLORS[tile.type];
        drawIsometricTile(ctx, screenX, screenY, colors, z);

        const isHovered =
          s.hoveredTile?.x === tile.x && s.hoveredTile?.y === tile.y;
        const isSelected =
          s.selectedTile?.x === tile.x && s.selectedTile?.y === tile.y;

        if (isHovered && tile.type === 'grass' && !tile.tower) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
          ctx.beginPath();
          ctx.moveTo(screenX + (TILE_WIDTH * z) / 2, screenY);
          ctx.lineTo(screenX + TILE_WIDTH * z, screenY + (TILE_HEIGHT * z) / 2);
          ctx.lineTo(screenX + (TILE_WIDTH * z) / 2, screenY + TILE_HEIGHT * z);
          ctx.lineTo(screenX, screenY + (TILE_HEIGHT * z) / 2);
          ctx.closePath();
          ctx.fill();
        }

        if (tile.tower) {
          drawTower(ctx, tile.tower, off.x, off.y, z, isSelected);
        }
      }

      // Draw projectiles
      for (const proj of s.projectiles) {
        drawProjectile(ctx, proj, off.x, off.y, z);
      }

      // Draw enemies
      for (const enemy of s.enemies) {
        drawEnemy(ctx, enemy, off.x, off.y, z);
      }
    };

    const raf = requestAnimationFrame(function loop() {
      render();
      requestAnimationFrame(loop);
    });

    return () => cancelAnimationFrame(raf);
  }, [gridSize]);

  // Keep canvas sized
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button === 0) {
        isDraggingRef.current = true;
        didDragRef.current = false;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { gridX, gridY } = screenToGrid(
        mouseX,
        mouseY,
        offsetRef.current.x,
        offsetRef.current.y,
        zoomRef.current
      );

      if (isDraggingRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDragRef.current = true;
        offsetRef.current.x += dx;
        offsetRef.current.y += dy;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      } else {
        if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
          setHoveredTile({ x: gridX, y: gridY });
        } else {
          setHoveredTile(null);
        }
      }
    },
    [gridSize, setHoveredTile]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button === 0) {
        isDraggingRef.current = false;
      }
    },
    []
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (didDragRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { gridX, gridY } = screenToGrid(
        mouseX,
        mouseY,
        offsetRef.current.x,
        offsetRef.current.y,
        zoomRef.current
      );

      if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return;

      const tile = state.grid[gridY][gridX];

      if (state.selectedTool === 'sell' && tile.tower) {
        sellTowerAt(gridX, gridY);
        setSelectedTile(null);
      } else if (
        state.selectedTool &&
        state.selectedTool !== 'sell' &&
        tile.type === 'grass' &&
        !tile.tower
      ) {
        placeTowerAt(gridX, gridY);
      }
      setSelectedTile({ x: gridX, y: gridY });
    },
    [state, gridSize, placeTowerAt, sellTowerAt, setSelectedTile]
  );

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomRef.current = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomRef.current + delta));
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setHoveredTile(null)}
      onClick={handleClick}
      onWheel={handleWheel}
      style={{ cursor: 'grab', touchAction: 'none' }}
    />
  );
}
