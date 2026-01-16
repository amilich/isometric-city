'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { gridToScreen, isInGrid, screenToGrid } from '@/core/types';
import { TILE_HEIGHT, TILE_WIDTH } from '@/components/game/types';

const ZOOM_MIN = 0.45;
const ZOOM_MAX = 1.6;
const HEIGHT_STEP = TILE_HEIGHT * 0.45;

const TERRAIN_COLORS: Record<string, { top: string; left: string; right: string; stroke: string }> = {
  grass: {
    top: '#4c8c3f',
    left: '#3b6f31',
    right: '#5da34d',
    stroke: '#2f5528',
  },
  dirt: {
    top: '#a07040',
    left: '#81552f',
    right: '#b8864e',
    stroke: '#644127',
  },
  sand: {
    top: '#d9c18a',
    left: '#bca36f',
    right: '#efd7a0',
    stroke: '#a68a57',
  },
  rock: {
    top: '#8b8b8b',
    left: '#6d6d6d',
    right: '#a3a3a3',
    stroke: '#525252',
  },
  water: {
    top: '#1e88e5',
    left: '#1565c0',
    right: '#42a5f5',
    stroke: '#0d47a1',
  },
};

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  colors: { top: string; left: string; right: string; stroke: string }
) {
  const halfW = width / 2;
  const halfH = height / 2;

  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.moveTo(x + halfW, y);
  ctx.lineTo(x + width, y + halfH);
  ctx.lineTo(x + halfW, y + height);
  ctx.lineTo(x, y + halfH);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 0.75;
  ctx.stroke();
}

function drawPathOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
) {
  const inset = width * 0.16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y + inset);
  ctx.lineTo(x + width - inset, y + height / 2);
  ctx.lineTo(x + width / 2, y + height - inset);
  ctx.lineTo(x + inset, y + height / 2);
  ctx.closePath();
  ctx.fill();
}

function drawScenery(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  type: string
) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  if (type === 'tree') {
    ctx.fillStyle = '#1b5e20';
    ctx.beginPath();
    ctx.arc(centerX, centerY - height * 0.1, width * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(centerX - width * 0.03, centerY, width * 0.06, height * 0.18);
  } else if (type === 'flower') {
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(centerX, centerY, width * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function CoasterCanvas() {
  const { state, placeAtTile } = useCoaster();
  const { grid, gridSize } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, offsetX: 0, offsetY: 0 });
  const dragMovedRef = useRef(false);

  const tileWidth = useMemo(() => TILE_WIDTH * zoom, [zoom]);
  const tileHeight = useMemo(() => TILE_HEIGHT * zoom, [zoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return;
    const gridCenter = gridToScreen(gridSize / 2, gridSize / 2, TILE_WIDTH, TILE_HEIGHT);
    setOffset({
      x: canvasSize.width / 2 - gridCenter.x * zoom,
      y: canvasSize.height / 2 - gridCenter.y * zoom,
    });
  }, [canvasSize, gridSize, zoom]);

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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = grid[y][x];
        const iso = gridToScreen(tile.x, tile.y, TILE_WIDTH, TILE_HEIGHT);
        const heightOffset = tile.height * HEIGHT_STEP * zoom;
        const screenX = offset.x + iso.x * zoom;
        const screenY = offset.y + iso.y * zoom - heightOffset;
        const colors = TERRAIN_COLORS[tile.terrain] ?? TERRAIN_COLORS.grass;
        drawDiamond(ctx, screenX, screenY, tileWidth, tileHeight, colors);
        if (tile.path) {
          const pathColor = tile.path.style === 'queue' ? '#f4b400' : '#8b9099';
          drawPathOverlay(ctx, screenX, screenY, tileWidth, tileHeight, pathColor);
        }
        if (tile.scenery?.type) {
          drawScenery(ctx, screenX, screenY, tileWidth, tileHeight, tile.scenery.type);
        }
      }
    }
  }, [canvasSize, grid, gridSize, offset, tileHeight, tileWidth, zoom]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragMovedRef.current = false;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  }, [offset]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragMovedRef.current = true;
    }
    setOffset({
      x: dragRef.current.offsetX + dx,
      y: dragRef.current.offsetY + dy,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    if (!dragMovedRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = (event.clientX - rect.left - offset.x) / zoom;
      const screenY = (event.clientY - rect.top - offset.y) / zoom;
      const gridPos = screenToGrid(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);
      if (isInGrid(gridPos, gridSize)) {
        placeAtTile(gridPos.x, gridPos.y);
      }
    }
  }, [gridSize, offset, placeAtTile, zoom]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const delta = -event.deltaY * 0.001;
    setZoom((prev) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev + delta)));
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-slate-950">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsDragging(false)}
        onWheel={handleWheel}
      />
    </div>
  );
}
