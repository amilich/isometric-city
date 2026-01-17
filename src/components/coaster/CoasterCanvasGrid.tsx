'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';
import { gridToScreen, screenToGrid } from '@/components/game/utils';
import { drawIsometricDiamond } from '@/components/game/drawing';
import { getCachedImage, onImageLoaded } from '@/components/game/imageLoader';
import {
  COASTER_RIDE_SPRITES,
  COASTER_STALL_SPRITES,
  COASTER_TRAIN_SPRITE,
  COASTER_ENTRANCE_SPRITE,
  COASTER_QUEUE_SPRITE,
  preloadCoasterSprites,
  SpriteConfig,
} from '@/components/coaster/coasterSprites';
import { CoasterTile, CoasterTrain } from '@/games/coaster/types';
import { drawCoasterTrack } from '@/components/coaster/trackSystem';

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

const GUEST_COLORS = ['#ffe4c4', '#f9c9a8', '#f4b183', '#d4a373', '#b08968', '#9c6644', '#7f5539', '#e5e7eb'];
const STAFF_COLORS: Record<string, string> = {
  handyman: '#22c55e',
  mechanic: '#facc15',
  security: '#60a5fa',
  entertainer: '#f472b6',
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
  const { grid, gridSize, selectedTool, coasterTrains, guests, staff, parkEntrance, clouds } = state;
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

  const drawSprite = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      sprite: SpriteConfig,
      centerX: number,
      centerY: number,
      rotation: number = 0
    ) => {
      const img = getCachedImage(sprite.src);
      if (!img) return false;
      const baseScale = TILE_WIDTH / img.naturalWidth;
      const drawWidth = img.naturalWidth * baseScale * sprite.scale;
      const drawHeight = img.naturalHeight * baseScale * sprite.scale;

      ctx.save();
      ctx.translate(centerX + sprite.offsetX * TILE_WIDTH, centerY + sprite.offsetY * TILE_HEIGHT);
      ctx.rotate(rotation);
      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();
      return true;
    },
    []
  );

  const drawTrainCar = useCallback(
    (ctx: CanvasRenderingContext2D, train: CoasterTrain, carOffset: number, color: string) => {
      if (!train.path.length) return;
      const totalSegments = train.path.length;
      let distance = train.segmentIndex + train.progress - carOffset;
      while (distance < 0) {
        distance += totalSegments;
      }
      distance %= totalSegments;

      const segmentIndex = Math.floor(distance);
      const progress = distance - segmentIndex;
      const start = train.path[segmentIndex];
      const end = train.path[(segmentIndex + 1) % totalSegments];

      const startScreen = gridToScreen(start.x, start.y, offset.x, offset.y);
      const endScreen = gridToScreen(end.x, end.y, offset.x, offset.y);
      const startX = startScreen.screenX + TILE_WIDTH / 2;
      const startY = startScreen.screenY + TILE_HEIGHT / 2;
      const endX = endScreen.screenX + TILE_WIDTH / 2;
      const endY = endScreen.screenY + TILE_HEIGHT / 2;

      const carX = startX + (endX - startX) * progress;
      const carY = startY + (endY - startY) * progress;

      const dx = endX - startX;
      const dy = endY - startY;
      const angle = Math.atan2(dy, dx);

      const drewSprite = drawSprite(ctx, COASTER_TRAIN_SPRITE, carX, carY, angle);
      if (!drewSprite) {
        ctx.save();
        ctx.translate(carX, carY);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(-6, -3.5, 12, 7, 2.4);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    },
    [drawSprite, offset.x, offset.y]
  );

  const drawTrains = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      coasterTrains.forEach((train) => {
        train.cars.forEach((car) => {
          drawTrainCar(ctx, train, car.offset, car.color);
        });
      });
    },
    [coasterTrains, drawTrainCar]
  );

  const drawGuests = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      guests.forEach((guest) => {
        if (guest.state === 'riding') return;
        const startScreen = gridToScreen(guest.tileX, guest.tileY, offset.x, offset.y);
        const startX = startScreen.screenX + TILE_WIDTH / 2;
        const startY = startScreen.screenY + TILE_HEIGHT / 2;
        let endX = startX;
        let endY = startY;

        const nextTile = guest.path[guest.pathIndex + 1];
        if (nextTile) {
          const endScreen = gridToScreen(nextTile.x, nextTile.y, offset.x, offset.y);
          endX = endScreen.screenX + TILE_WIDTH / 2;
          endY = endScreen.screenY + TILE_HEIGHT / 2;
        }

        const x = startX + (endX - startX) * guest.progress;
        const y = startY + (endY - startY) * guest.progress;

        ctx.fillStyle = GUEST_COLORS[guest.spriteVariant % GUEST_COLORS.length];
        ctx.beginPath();
        ctx.arc(x, y - 2, 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1f2937';
        ctx.fillRect(x - 1, y, 2, 3);
      });
    },
    [guests, offset.x, offset.y]
  );

  const drawStaff = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      staff.forEach((member) => {
        const startScreen = gridToScreen(member.tileX, member.tileY, offset.x, offset.y);
        const startX = startScreen.screenX + TILE_WIDTH / 2;
        const startY = startScreen.screenY + TILE_HEIGHT / 2;
        let endX = startX;
        let endY = startY;
        const nextTile = member.path[member.pathIndex + 1];
        if (nextTile) {
          const endScreen = gridToScreen(nextTile.x, nextTile.y, offset.x, offset.y);
          endX = endScreen.screenX + TILE_WIDTH / 2;
          endY = endScreen.screenY + TILE_HEIGHT / 2;
        }
        const x = startX + (endX - startX) * member.progress;
        const y = startY + (endY - startY) * member.progress;

        ctx.fillStyle = STAFF_COLORS[member.type] ?? '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y - 2, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(x - 1.2, y, 2.4, 3.6);
      });
    },
    [offset.x, offset.y, staff]
  );

  const drawClouds = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.save();
      clouds.forEach((cloud) => {
        const { screenX, screenY } = gridToScreen(cloud.x, cloud.y, offset.x, offset.y);
        const centerX = screenX + TILE_WIDTH / 2;
        const centerY = screenY + TILE_HEIGHT / 2;
        ctx.globalAlpha = cloud.opacity;
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY - TILE_HEIGHT * 2, 18 * cloud.size, 10 * cloud.size, 0, 0, Math.PI * 2);
        ctx.ellipse(centerX + 12 * cloud.size, centerY - TILE_HEIGHT * 2.2, 14 * cloud.size, 8 * cloud.size, 0, 0, Math.PI * 2);
        ctx.ellipse(centerX - 12 * cloud.size, centerY - TILE_HEIGHT * 2.1, 12 * cloud.size, 7 * cloud.size, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    },
    [clouds, offset.x, offset.y]
  );

  const drawRides = useCallback(
    (ctx: CanvasRenderingContext2D, tile: CoasterTile, screenX: number, screenY: number) => {
      if (!tile.rideId || !tile.rideType) return;
      const isOrigin =
        (!grid[tile.y - 1]?.[tile.x] || grid[tile.y - 1][tile.x].rideId !== tile.rideId) &&
        (!grid[tile.y]?.[tile.x - 1] || grid[tile.y][tile.x - 1].rideId !== tile.rideId);
      if (!isOrigin) return;

      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const rideSprite = COASTER_RIDE_SPRITES[tile.rideType];
      if (rideSprite) {
        drawSprite(ctx, rideSprite, centerX, centerY);
        return;
      }

      if (tile.rideType === 'coaster') {
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
      }
    },
    [drawSprite, grid]
  );

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
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
          if (tile.path === 'queue') {
            drawSprite(ctx, COASTER_QUEUE_SPRITE, centerX, centerY);
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 0.7;
            ctx.setLineDash([3, 2]);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - TILE_HEIGHT * 0.18);
            ctx.lineTo(centerX + TILE_WIDTH * 0.22, centerY);
            ctx.lineTo(centerX, centerY + TILE_HEIGHT * 0.18);
            ctx.lineTo(centerX - TILE_WIDTH * 0.22, centerY);
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        if (tile.x === parkEntrance.x && tile.y === parkEntrance.y) {
          const centerX = screenX + TILE_WIDTH / 2;
          const centerY = screenY + TILE_HEIGHT / 2;
          drawSprite(ctx, COASTER_ENTRANCE_SPRITE, centerX, centerY);
        }

        drawRides(ctx, tile, screenX, screenY);
        if (tile.track) {
          drawCoasterTrack(ctx, screenX, screenY, x, y, grid, gridSize, zoom);
        }
        drawScenery(ctx, tile, screenX, screenY);

        if (tile.facility) {
          const centerX = screenX + TILE_WIDTH / 2;
          const centerY = screenY + TILE_HEIGHT / 2;
          const facilitySprite = COASTER_STALL_SPRITES[tile.facility];
          if (!facilitySprite || !drawSprite(ctx, facilitySprite, centerX, centerY)) {
            ctx.fillStyle = RIDE_COLORS[tile.facility] ?? '#94a3b8';
            ctx.fillRect(centerX - 4, centerY - 4, 8, 8);
          }
        }
      }
    }

    drawTrains(ctx);
    drawGuests(ctx);
    drawStaff(ctx);
    drawClouds(ctx);

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
  }, [drawClouds, drawGuests, drawInsetDiamond, drawRides, drawScenery, drawStaff, drawTrains, drawSprite, grid, gridSize, hoveredTile, offset.x, offset.y, parkEntrance.x, parkEntrance.y, selectedTile, zoom]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  useEffect(() => {
    preloadCoasterSprites();
    const unsubscribe = onImageLoaded(() => drawGrid());
    return unsubscribe;
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
    const newOffset = {
      x: canvasSize.width / 2 - screenX,
      y: canvasSize.height / 2 - screenY,
    };
    // Use requestAnimationFrame to batch state update with next frame
    const frameId = requestAnimationFrame(() => {
      setOffset(newOffset);
      onNavigationComplete?.();
    });
    return () => cancelAnimationFrame(frameId);
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
