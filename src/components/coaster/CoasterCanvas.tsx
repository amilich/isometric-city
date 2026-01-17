'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { CardinalDirection, gridToScreen, isInGrid, screenToGrid } from '@/core/types';
import { TILE_HEIGHT, TILE_WIDTH } from '@/components/game/types';
import { GuestItem } from '@/games/coaster/types';
import { getStaffPatrolColor, STAFF_TYPE_COLORS } from '@/lib/coasterStaff';

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

function drawOverlayDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  alpha: number = 0.2
) {
  const halfW = width / 2;
  const halfH = height / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + halfW, y);
  ctx.lineTo(x + width, y + halfH);
  ctx.lineTo(x + halfW, y + height);
  ctx.lineTo(x, y + halfH);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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

const LITTER_OFFSETS = [
  { dx: -0.18, dy: 0.06 },
  { dx: 0.12, dy: -0.08 },
  { dx: 0.02, dy: 0.16 },
];

function drawLitter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  count: number
) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const size = Math.max(1.2, width * 0.04);
  ctx.fillStyle = '#a16207';
  for (let i = 0; i < Math.min(count, LITTER_OFFSETS.length); i++) {
    const offset = LITTER_OFFSETS[i];
    ctx.beginPath();
    ctx.arc(centerX + width * offset.dx, centerY + height * offset.dy, size, 0, Math.PI * 2);
    ctx.fill();
  }
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
  } else if (type === 'bench') {
    ctx.fillStyle = '#a16207';
    ctx.fillRect(centerX - width * 0.14, centerY - height * 0.02, width * 0.28, height * 0.06);
    ctx.fillStyle = '#713f12';
    ctx.fillRect(centerX - width * 0.12, centerY + height * 0.03, width * 0.05, height * 0.05);
    ctx.fillRect(centerX + width * 0.07, centerY + height * 0.03, width * 0.05, height * 0.05);
  } else if (type === 'shrub') {
    ctx.fillStyle = '#2f855a';
    ctx.beginPath();
    ctx.arc(centerX, centerY, width * 0.13, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'lamp') {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(centerX - width * 0.02, centerY - height * 0.18, width * 0.04, height * 0.2);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(centerX, centerY - height * 0.22, width * 0.05, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'statue') {
    ctx.fillStyle = '#cbd5f5';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - height * 0.12);
    ctx.lineTo(centerX + width * 0.1, centerY);
    ctx.lineTo(centerX, centerY + height * 0.12);
    ctx.lineTo(centerX - width * 0.1, centerY);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'fountain') {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(centerX, centerY, width * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(centerX, centerY, width * 0.06, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'trash_can') {
    ctx.fillStyle = '#475569';
    ctx.fillRect(centerX - width * 0.06, centerY - height * 0.04, width * 0.12, height * 0.1);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(centerX - width * 0.07, centerY - height * 0.07, width * 0.14, height * 0.03);
  } else if (type === 'fence') {
    ctx.strokeStyle = '#8b5e34';
    ctx.lineWidth = Math.max(1, width * 0.02);
    ctx.beginPath();
    ctx.moveTo(centerX - width * 0.14, centerY + height * 0.02);
    ctx.lineTo(centerX + width * 0.14, centerY - height * 0.02);
    ctx.stroke();
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

function drawGuestItem(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  size: number,
  item: GuestItem
) {
  const itemSize = Math.max(5, size * 2.6);
  const baseY = screenY - size * 2.3;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(1, itemSize * 0.12);
  switch (item) {
    case 'balloon': {
      ctx.strokeStyle = '#fcd34d';
      ctx.lineWidth = Math.max(1, itemSize * 0.12);
      ctx.beginPath();
      ctx.moveTo(screenX, screenY - size * 0.2);
      ctx.lineTo(screenX, baseY);
      ctx.stroke();
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(screenX, baseY - itemSize * 0.6, itemSize * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
      break;
    }
    case 'hat': {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(screenX - itemSize * 0.7, baseY - itemSize * 0.3, itemSize * 1.4, itemSize * 0.4);
      ctx.fillRect(screenX - itemSize * 0.45, baseY - itemSize * 0.8, itemSize * 0.9, itemSize * 0.4);
      ctx.strokeRect(screenX - itemSize * 0.7, baseY - itemSize * 0.3, itemSize * 1.4, itemSize * 0.4);
      break;
    }
    case 'map': {
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(screenX - itemSize * 0.7, baseY - itemSize * 0.35, itemSize * 1.4, itemSize * 0.7);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = Math.max(1, itemSize * 0.12);
      ctx.beginPath();
      ctx.moveTo(screenX, baseY - itemSize * 0.35);
      ctx.lineTo(screenX, baseY + itemSize * 0.35);
      ctx.stroke();
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(screenX - itemSize * 0.7, baseY - itemSize * 0.35, itemSize * 1.4, itemSize * 0.7);
      break;
    }
    case 'drink': {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(screenX - itemSize * 0.3, baseY - itemSize * 0.4, itemSize * 0.6, itemSize * 0.9);
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(screenX - itemSize * 0.25, baseY - itemSize * 0.7, itemSize * 0.5, itemSize * 0.3);
      ctx.strokeRect(screenX - itemSize * 0.3, baseY - itemSize * 0.4, itemSize * 0.6, itemSize * 0.9);
      break;
    }
    case 'souvenir': {
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.moveTo(screenX, baseY - itemSize * 0.6);
      ctx.lineTo(screenX + itemSize * 0.6, baseY);
      ctx.lineTo(screenX, baseY + itemSize * 0.6);
      ctx.lineTo(screenX - itemSize * 0.6, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'food':
    default: {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(screenX, baseY, itemSize * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function drawStaff(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  size: number,
  color: string
) {
  const half = size / 2;
  ctx.fillStyle = color;
  ctx.fillRect(screenX - half, screenY - half, size, size);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(screenX - half, screenY - half, size, size);
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
  onSelectRide?: (rideId: string | null) => void;
  patrolAssignmentId?: number | null;
  patrolAssignmentRadius?: number;
  focusedStaffId?: number | null;
  onAssignPatrol?: (position: { x: number; y: number }) => void;
};

export default function CoasterCanvas({
  navigationTarget,
  onNavigationComplete,
  onViewportChange,
  onSelectRide,
  patrolAssignmentId,
  patrolAssignmentRadius,
  focusedStaffId,
  onAssignPatrol,
}: CoasterCanvasProps) {
  const { state, placeAtTile } = useCoaster();
  const { grid, gridSize, rides, guests, coasterTrains, selectedTool, staff, hour } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef({ startX: 0, startY: 0, offsetX: 0, offsetY: 0 });
  const dragMovedRef = useRef(false);

  const tileWidth = useMemo(() => TILE_WIDTH * zoom, [zoom]);
  const tileHeight = useMemo(() => TILE_HEIGHT * zoom, [zoom]);
  const rideColors = useMemo(() => new Map(rides.map((ride) => [ride.id, ride.color])), [rides]);
  const isNight = useMemo(() => hour >= 19 || hour < 6, [hour]);
  const patrolOverlay = useMemo(() => {
    const overlay = new Map<string, string>();
    staff.forEach((member) => {
      if (!member.patrolArea) return;
      const color = getStaffPatrolColor(member.id);
      for (let y = member.patrolArea.minY; y <= member.patrolArea.maxY; y++) {
        for (let x = member.patrolArea.minX; x <= member.patrolArea.maxX; x++) {
          overlay.set(`${x},${y}`, color);
        }
      }
    });
    return overlay;
  }, [staff]);

  const focusedOverlay = useMemo(() => {
    if (!focusedStaffId) return null;
    const member = staff.find((entry) => entry.id === focusedStaffId);
    if (!member?.patrolArea) return null;
    const overlay = new Map<string, string>();
    const color = getStaffPatrolColor(member.id);
    for (let y = member.patrolArea.minY; y <= member.patrolArea.maxY; y++) {
      for (let x = member.patrolArea.minX; x <= member.patrolArea.maxX; x++) {
        overlay.set(`${x},${y}`, color);
      }
    }
    return overlay;
  }, [focusedStaffId, staff]);

  const previewOverlay = useMemo(() => {
    if (patrolAssignmentId === undefined || patrolAssignmentId === null) return null;
    if (!hoveredTile) return null;
    const radius = patrolAssignmentRadius ?? 4;
    const minX = Math.max(0, hoveredTile.x - radius);
    const minY = Math.max(0, hoveredTile.y - radius);
    const maxX = Math.min(gridSize - 1, hoveredTile.x + radius);
    const maxY = Math.min(gridSize - 1, hoveredTile.y + radius);
    const overlay = new Map<string, string>();
    const color = getStaffPatrolColor(patrolAssignmentId);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        overlay.set(`${x},${y}`, color);
      }
    }
    return overlay;
  }, [gridSize, hoveredTile, patrolAssignmentId, patrolAssignmentRadius]);

  useEffect(() => {
    if (patrolAssignmentId === undefined || patrolAssignmentId === null) {
      setHoveredTile(null);
    }
  }, [patrolAssignmentId]);

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
        const overlayKey = `${tile.x},${tile.y}`;
        const overlayColor = patrolOverlay.get(overlayKey);
        if (overlayColor) {
          drawOverlayDiamond(ctx, screenX, screenY, tileWidth, tileHeight, overlayColor, focusedStaffId ? 0.12 : 0.2);
        }
        const focusedColor = focusedOverlay?.get(overlayKey);
        if (focusedColor) {
          drawOverlayDiamond(ctx, screenX, screenY, tileWidth, tileHeight, focusedColor, 0.35);
        }
        const previewColor = previewOverlay?.get(overlayKey);
        if (previewColor) {
          drawOverlayDiamond(ctx, screenX, screenY, tileWidth, tileHeight, previewColor, 0.35);
        }
        if (tile.path) {
          const pathColor = tile.path.style === 'queue' ? '#f4b400' : '#8b9099';
          drawPathOverlay(ctx, screenX, screenY, tileWidth, tileHeight, pathColor);
          if ((tile.litter ?? 0) > 0) {
            drawLitter(ctx, screenX, screenY, tileWidth, tileHeight, tile.litter);
          }
          if (isNight && tile.scenery?.type === 'lamp') {
            drawOverlayDiamond(ctx, screenX, screenY, tileWidth, tileHeight, '#fde047', 0.18);
          }
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
      if (guest.hasItem) {
        drawGuestItem(ctx, centerX, centerY, tileWidth * 0.08, guest.hasItem);
      }
    });
    staff.forEach((member) => {
      const vector = GUEST_VECTORS[member.direction];
      const staffX = member.tileX + vector.dx * member.progress;
      const staffY = member.tileY + vector.dy * member.progress;
      const iso = gridToScreen(staffX, staffY, TILE_WIDTH, TILE_HEIGHT);
      const baseX = offset.x + iso.x * zoom;
      const baseY = offset.y + iso.y * zoom;
      const centerX = baseX + tileWidth / 2;
      const centerY = baseY + tileHeight / 2 - tileHeight * 0.1;
      const staffSize = tileWidth * 0.09;
      drawStaff(ctx, centerX, centerY, staffSize, STAFF_TYPE_COLORS[member.type] ?? '#e2e8f0');
      if (focusedStaffId && member.id === focusedStaffId) {
        ctx.save();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.strokeRect(centerX - staffSize * 0.6, centerY - staffSize * 0.6, staffSize * 1.2, staffSize * 1.2);
        ctx.restore();
      }
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
  }, [canvasSize, grid, gridSize, offset, patrolOverlay, focusedOverlay, previewOverlay, focusedStaffId, rideColors, guests, staff, coasterTrains, tileHeight, tileWidth, zoom, isNight]);

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

  const updateHoverTile = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = (event.clientX - rect.left - offset.x) / zoom;
    const screenY = (event.clientY - rect.top - offset.y) / zoom;
    const gridPos = screenToGrid(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);
    if (isInGrid(gridPos, gridSize)) {
      setHoveredTile(gridPos);
    } else {
      setHoveredTile(null);
    }
  }, [gridSize, offset.x, offset.y, zoom]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      const dx = event.clientX - dragRef.current.startX;
      const dy = event.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragMovedRef.current = true;
      }
      setOffset({
        x: dragRef.current.offsetX + dx,
        y: dragRef.current.offsetY + dy,
      });
      return;
    }
    if (patrolAssignmentId !== undefined && patrolAssignmentId !== null) {
      updateHoverTile(event);
      return;
    }
    if (hoveredTile) {
      setHoveredTile(null);
    }
  }, [hoveredTile, isDragging, patrolAssignmentId, updateHoverTile]);

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
        if (patrolAssignmentId !== undefined && patrolAssignmentId !== null) {
          onAssignPatrol?.(gridPos);
          return;
        }
        if (selectedTool === 'select') {
          const rideId = grid[gridPos.y]?.[gridPos.x]?.rideId ?? null;
          onSelectRide?.(rideId);
          return;
        }
        placeAtTile(gridPos.x, gridPos.y);
      }
    }
  }, [grid, gridSize, offset, onAssignPatrol, onSelectRide, patrolAssignmentId, placeAtTile, selectedTool, zoom]);

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
        onMouseLeave={() => {
          setIsDragging(false);
          setHoveredTile(null);
        }}
        onWheel={handleWheel}
      />
    </div>
  );
}
