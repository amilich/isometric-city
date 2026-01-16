'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { CardinalDirection, gridToScreen, isInGrid, screenToGrid } from '@/core/types';
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

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  type: string
) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const size = width * 0.28;
  const colorMap: Record<string, string> = {
    food_stall: '#f87171',
    drink_stall: '#38bdf8',
    ice_cream_stall: '#f9a8d4',
    souvenir_shop: '#facc15',
    info_kiosk: '#a3e635',
    toilets: '#cbd5f5',
    atm: '#94a3b8',
    first_aid: '#f97316',
    staff_room: '#64748b',
  };
  const fill = colorMap[type] ?? '#e2e8f0';
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - size * 0.9);
  ctx.lineTo(centerX + size, centerY);
  ctx.lineTo(centerX, centerY + size * 0.9);
  ctx.lineTo(centerX - size, centerY);
  ctx.closePath();
  ctx.fill();
}

function drawTrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  connections: { north: boolean; east: boolean; south: boolean; west: boolean }
) {
  const center = { x: x + width / 2, y: y + height / 2 };
  const anchors = {
    north: { x: x + width / 2, y: y + height * 0.1 },
    east: { x: x + width * 0.9, y: y + height / 2 },
    south: { x: x + width / 2, y: y + height * 0.9 },
    west: { x: x + width * 0.1, y: y + height / 2 },
  };

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  let hasConnection = false;
  (Object.keys(connections) as Array<keyof typeof connections>).forEach((direction) => {
    if (!connections[direction]) return;
    hasConnection = true;
    const anchor = anchors[direction];
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(anchor.x, anchor.y);
  });
  if (!hasConnection) {
    ctx.moveTo(center.x - 2, center.y);
    ctx.lineTo(center.x + 2, center.y);
  }
  ctx.stroke();
}

const GUEST_VECTORS: Record<CardinalDirection, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
};

function drawGuest(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  size: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
  ctx.fill();
}

function drawTrain(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  size: number
) {
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export type CoasterCanvasProps = {
  navigationTarget?: { x: number; y: number } | null;
  onNavigationComplete?: () => void;
  onViewportChange?: (viewport: { offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } }) => void;
};

export default function CoasterCanvas({ navigationTarget, onNavigationComplete, onViewportChange }: CoasterCanvasProps) {
  const { state, placeAtTile } = useCoaster();
  const { grid, gridSize, rides, guests, coasterTrains } = state;
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
  const rideColors = useMemo(() => new Map(rides.map((ride) => [ride.id, ride.color])), [rides]);

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
    if (!navigationTarget) return;
    const targetIso = gridToScreen(navigationTarget.x, navigationTarget.y, TILE_WIDTH, TILE_HEIGHT);
    setOffset({
      x: canvasSize.width / 2 - targetIso.x * zoom,
      y: canvasSize.height / 2 - targetIso.y * zoom,
    });
    onNavigationComplete?.();
  }, [canvasSize.width, canvasSize.height, navigationTarget, onNavigationComplete, zoom]);

  useEffect(() => {
    if (!onViewportChange) return;
    onViewportChange({ offset, zoom, canvasSize });
  }, [canvasSize, offset, onViewportChange, zoom]);

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
        if (tile.track) {
          drawTrack(ctx, screenX, screenY, tileWidth, tileHeight, tile.track.connections);
        }
        if (tile.rideId && rideColors.has(tile.rideId)) {
          ctx.save();
          ctx.globalAlpha = 0.6;
          drawDiamond(ctx, screenX, screenY, tileWidth, tileHeight, {
            top: rideColors.get(tile.rideId) ?? '#f97316',
            left: rideColors.get(tile.rideId) ?? '#f97316',
            right: rideColors.get(tile.rideId) ?? '#f97316',
            stroke: '#1f2937',
          });
          ctx.restore();
        }
        if (tile.building) {
          drawBuilding(ctx, screenX, screenY, tileWidth, tileHeight, tile.building.type);
        }
        if (tile.scenery?.type) {
          drawScenery(ctx, screenX, screenY, tileWidth, tileHeight, tile.scenery.type);
        }
      }
    }

    guests.forEach((guest) => {
      const vector = GUEST_VECTORS[guest.direction];
      const guestX = guest.tileX + vector.dx * guest.progress;
      const guestY = guest.tileY + vector.dy * guest.progress;
      const iso = gridToScreen(guestX, guestY, TILE_WIDTH, TILE_HEIGHT);
      const baseX = offset.x + iso.x * zoom;
      const baseY = offset.y + iso.y * zoom;
      const centerX = baseX + tileWidth / 2;
      const centerY = baseY + tileHeight / 2 - tileHeight * 0.12;
      drawGuest(ctx, centerX, centerY, tileWidth * 0.08, guest.colors.shirt);
    });
    coasterTrains.forEach((train) => {
      const vector = GUEST_VECTORS[train.direction];
      const trainX = train.tileX + vector.dx * train.progress;
      const trainY = train.tileY + vector.dy * train.progress;
      const iso = gridToScreen(trainX, trainY, TILE_WIDTH, TILE_HEIGHT);
      const baseX = offset.x + iso.x * zoom;
      const baseY = offset.y + iso.y * zoom;
      const centerX = baseX + tileWidth / 2;
      const centerY = baseY + tileHeight / 2 - tileHeight * 0.2;
      drawTrain(ctx, centerX, centerY, tileWidth * 0.1);
    });
  }, [canvasSize, grid, gridSize, offset, rideColors, guests, coasterTrains, tileHeight, tileWidth, zoom]);

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
