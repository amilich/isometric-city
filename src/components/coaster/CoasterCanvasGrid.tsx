/* eslint-disable no-param-reassign */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';
import { gridToScreen, screenToGrid } from '@/components/game/utils';
import { drawIsometricDiamond } from '@/components/game/drawing';
import { CoasterTile } from '@/games/coaster/types';

const TERRAIN_COLORS = {
  grass: {
    top: '#2f6b3f',
    left: '#255132',
    right: '#3a804c',
    stroke: '#1f3d28',
  },
  water: {
    top: '#1d4ed8',
    left: '#1e40af',
    right: '#2563eb',
    stroke: '#1e3a8a',
  },
};

const PATH_COLORS = {
  path: {
    top: '#6b7280',
    left: '#4b5563',
    right: '#9ca3af',
    stroke: '#374151',
  },
  queue: {
    top: '#3b82f6',
    left: '#2563eb',
    right: '#60a5fa',
    stroke: '#1e40af',
  },
};

const RIDE_COLORS: Record<string, string> = {
  coaster: '#f97316',
  carousel: '#f472b6',
  ferris_wheel: '#38bdf8',
  swing_ride: '#facc15',
  food_stall: '#fb7185',
  drink_stall: '#22d3ee',
  souvenir_stall: '#a855f7',
  toilet: '#94a3b8',
  information: '#22c55e',
};

const SCENERY_COLORS: Record<string, string> = {
  tree: '#16a34a',
  bench: '#a16207',
  lamp: '#fde047',
  fence: '#e2e8f0',
  flower_bed: '#f43f5e',
};

type Viewport = {
  offset: { x: number; y: number };
  zoom: number;
  canvasSize: { width: number; height: number };
};

export interface CoasterCanvasGridProps {
  selectedTile: { x: number; y: number } | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  navigationTarget?: { x: number; y: number } | null;
  onNavigationComplete?: () => void;
  onViewportChange?: (viewport: Viewport) => void;
}

export function CoasterCanvasGrid({
  selectedTile,
  setSelectedTile,
  navigationTarget,
  onNavigationComplete,
  onViewportChange,
}: CoasterCanvasGridProps) {
  const { state, placeAtTile } = useCoaster();
  const { grid, gridSize, selectedTool } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const [offset, setOffset] = useState({ x: 520, y: 120 });
  const [zoom, setZoom] = useState(1);
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const drawInsetDiamond = useCallback(
    (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, width: number, height: number, colors: typeof PATH_COLORS.path) => {
      ctx.fillStyle = colors.top;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - height / 2);
      ctx.lineTo(centerX + width / 2, centerY);
      ctx.lineTo(centerX, centerY + height / 2);
      ctx.lineTo(centerX - width / 2, centerY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    },
    []
  );

  const drawTrackLines = useCallback(
    (ctx: CanvasRenderingContext2D, tile: CoasterTile, screenX: number, screenY: number) => {
      if (!tile.track) return;

      const north = grid[tile.y - 1]?.[tile.x]?.track;
      const south = grid[tile.y + 1]?.[tile.x]?.track;
      const east = grid[tile.y]?.[tile.x - 1]?.track;
      const west = grid[tile.y]?.[tile.x + 1]?.track;

      const edges = {
        north: { x: screenX + TILE_WIDTH * 0.25, y: screenY + TILE_HEIGHT * 0.25 },
        east: { x: screenX + TILE_WIDTH * 0.75, y: screenY + TILE_HEIGHT * 0.25 },
        south: { x: screenX + TILE_WIDTH * 0.75, y: screenY + TILE_HEIGHT * 0.75 },
        west: { x: screenX + TILE_WIDTH * 0.25, y: screenY + TILE_HEIGHT * 0.75 },
        center: { x: screenX + TILE_WIDTH / 2, y: screenY + TILE_HEIGHT / 2 },
      };

      ctx.strokeStyle = '#c2410c';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';

      if (north) {
        ctx.beginPath();
        ctx.moveTo(edges.center.x, edges.center.y);
        ctx.lineTo(edges.north.x, edges.north.y);
        ctx.stroke();
      }
      if (south) {
        ctx.beginPath();
        ctx.moveTo(edges.center.x, edges.center.y);
        ctx.lineTo(edges.south.x, edges.south.y);
        ctx.stroke();
      }
      if (east) {
        ctx.beginPath();
        ctx.moveTo(edges.center.x, edges.center.y);
        ctx.lineTo(edges.east.x, edges.east.y);
        ctx.stroke();
      }
      if (west) {
        ctx.beginPath();
        ctx.moveTo(edges.center.x, edges.center.y);
        ctx.lineTo(edges.west.x, edges.west.y);
        ctx.stroke();
      }

      if (tile.track.special) {
        ctx.fillStyle = tile.track.special === 'station' ? '#f8fafc' : tile.track.special === 'lift' ? '#facc15' : tile.track.special === 'brakes' ? '#ef4444' : tile.track.special === 'booster' ? '#22c55e' : '#f97316';
        ctx.beginPath();
        ctx.arc(edges.center.x, edges.center.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [grid]
  );

  const drawScenery = useCallback(
    (ctx: CanvasRenderingContext2D, tile: CoasterTile, screenX: number, screenY: number) => {
      if (!tile.scenery.length) return;
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;

      tile.scenery.forEach((item, index) => {
        const offsetX = (index % 2 === 0 ? -1 : 1) * 6;
        const offsetY = index % 2 === 0 ? -4 : 4;
        ctx.fillStyle = SCENERY_COLORS[item] ?? '#ffffff';
        if (item === 'tree') {
          ctx.beginPath();
          ctx.arc(centerX + offsetX, centerY + offsetY - 6, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#854d0e';
          ctx.fillRect(centerX + offsetX - 1.5, centerY + offsetY - 2, 3, 6);
        } else {
          ctx.fillRect(centerX + offsetX - 3, centerY + offsetY - 3, 6, 6);
        }
      });
    },
    []
  );

  const drawRides = useCallback(
    (ctx: CanvasRenderingContext2D, tile: CoasterTile, screenX: number, screenY: number) => {
      if (!tile.rideId || !tile.rideType) return;
      const color = RIDE_COLORS[tile.rideType] ?? '#f97316';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT * 0.15);
      ctx.lineTo(screenX + TILE_WIDTH * 0.85, screenY + TILE_HEIGHT / 2);
      ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT * 0.85);
      ctx.lineTo(screenX + TILE_WIDTH * 0.15, screenY + TILE_HEIGHT / 2);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    },
    []
  );

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(zoom, zoom);

    for (let y = 0; y < gridSize; y += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        const tile = grid[y][x];
        const { screenX, screenY } = gridToScreen(x, y, offset.x, offset.y);
        drawIsometricDiamond(ctx, screenX, screenY, TERRAIN_COLORS[tile.terrain], {
          drawStroke: zoom >= 0.6,
          strokeWidth: 0.5,
        });

        if (tile.path) {
          const centerX = screenX + TILE_WIDTH / 2;
          const centerY = screenY + TILE_HEIGHT / 2;
          drawInsetDiamond(ctx, centerX, centerY, TILE_WIDTH * 0.7, TILE_HEIGHT * 0.7, PATH_COLORS[tile.path]);
        }

        drawRides(ctx, tile, screenX, screenY);
        drawTrackLines(ctx, tile, screenX, screenY);
        drawScenery(ctx, tile, screenX, screenY);

        if (tile.facility) {
          const centerX = screenX + TILE_WIDTH / 2;
          const centerY = screenY + TILE_HEIGHT / 2;
          ctx.fillStyle = RIDE_COLORS[tile.facility] ?? '#94a3b8';
          ctx.fillRect(centerX - 4, centerY - 4, 8, 8);
        }
      }
    }

    if (hoveredTile) {
      const { screenX, screenY } = gridToScreen(hoveredTile.x, hoveredTile.y, offset.x, offset.y);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
      ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
      ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
      ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
      ctx.closePath();
      ctx.stroke();
    }

    if (selectedTile) {
      const { screenX, screenY } = gridToScreen(selectedTile.x, selectedTile.y, offset.x, offset.y);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
      ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
      ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
      ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
      ctx.closePath();
      ctx.stroke();
    }
  }, [drawInsetDiamond, drawRides, drawScenery, drawTrackLines, grid, gridSize, hoveredTile, offset.x, offset.y, selectedTile, zoom]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  useEffect(() => {
    const updateSize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCanvasSize({ width: rect.width, height: rect.height });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    drawGrid();
  }, [canvasSize.width, canvasSize.height, drawGrid]);

  useEffect(() => {
    if (!onViewportChange) return;
    onViewportChange({
      offset,
      zoom,
      canvasSize,
    });
  }, [canvasSize, offset, onViewportChange, zoom]);

  useEffect(() => {
    if (!navigationTarget) return;
    const { screenX, screenY } = gridToScreen(navigationTarget.x, navigationTarget.y, 0, 0);
    setOffset({
      x: canvasSize.width / 2 - screenX,
      y: canvasSize.height / 2 - screenY,
    });
    onNavigationComplete?.();
  }, [canvasSize.height, canvasSize.width, navigationTarget, onNavigationComplete]);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (isPanning && dragStartRef.current) {
        const dx = event.clientX - dragStartRef.current.x;
        const dy = event.clientY - dragStartRef.current.y;
        setOffset({
          x: dragStartRef.current.offsetX + dx,
          y: dragStartRef.current.offsetY + dy,
        });
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / zoom;
      const y = (event.clientY - rect.top) / zoom;
      const { gridX, gridY } = screenToGrid(x, y, offset.x, offset.y);
      if (gridX >= 0 && gridY >= 0 && gridX < gridSize && gridY < gridSize) {
        setHoveredTile({ x: gridX, y: gridY });
      } else {
        setHoveredTile(null);
      }
    },
    [gridSize, isPanning, offset.x, offset.y, zoom]
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (event.button === 2) {
        setIsPanning(true);
        dragStartRef.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / zoom;
      const y = (event.clientY - rect.top) / zoom;
      const { gridX, gridY } = screenToGrid(x, y, offset.x, offset.y);
      if (gridX < 0 || gridY < 0 || gridX >= gridSize || gridY >= gridSize) return;

      if (selectedTool === 'select') {
        setSelectedTile({ x: gridX, y: gridY });
      } else {
        placeAtTile(gridX, gridY);
      }
    },
    [gridSize, offset.x, offset.y, placeAtTile, selectedTool, setSelectedTile, zoom]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    dragStartRef.current = null;
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const delta = -event.deltaY * 0.0015;
      const nextZoom = Math.min(2.5, Math.max(0.4, zoom + delta));
      setZoom(nextZoom);
    },
    [zoom]
  );

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-slate-950">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  );
}
