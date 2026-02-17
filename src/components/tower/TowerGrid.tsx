'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTower } from '@/context/TowerContext';
import { TOOL_INFO, type Tile, type Tool } from '@/games/tower/types';
import { clamp, lerp } from '@/games/tower/lib/math';
import { getSpriteInfo, getSpriteRect, TOWER_SPRITE_PACK } from '@/games/tower/lib/towerRenderConfig';

const TILE_WIDTH = 64;
const HEIGHT_RATIO = 0.6;
const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;

// Sprite sheets use a red background to be filtered to transparent.
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
const COLOR_THRESHOLD = 155;

function filterBackgroundColor(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const distance = Math.sqrt((r - BACKGROUND_COLOR.r) ** 2 + (g - BACKGROUND_COLOR.g) ** 2 + (b - BACKGROUND_COLOR.b) ** 2);
    if (distance <= COLOR_THRESHOLD) data[i + 3] = 0;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function gridToScreen(gridX: number, gridY: number): { screenX: number; screenY: number } {
  const screenX = (gridX - gridY) * (TILE_WIDTH / 2);
  const screenY = (gridX + gridY) * (TILE_HEIGHT / 2);
  return { screenX, screenY };
}

function screenToGrid(screenX: number, screenY: number): { gridX: number; gridY: number } {
  const gridX = (screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2;
  const gridY = (screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2;
  return { gridX: Math.floor(gridX), gridY: Math.floor(gridY) };
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, fill: string, stroke?: string, lineWidth: number = 1) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + TILE_WIDTH / 2, y);
  ctx.lineTo(x + TILE_WIDTH, y + TILE_HEIGHT / 2);
  ctx.lineTo(x + TILE_WIDTH / 2, y + TILE_HEIGHT);
  ctx.lineTo(x, y + TILE_HEIGHT / 2);
  ctx.closePath();
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawTowerPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, towerType: string) {
  const centerX = x + TILE_WIDTH / 2;
  const centerY = y + TILE_HEIGHT / 2;
  const color =
    towerType === 'cannon'
      ? '#eab308'
      : towerType === 'archer'
        ? '#22c55e'
        : towerType === 'tesla'
          ? '#38bdf8'
          : towerType === 'ice'
            ? '#67e8f9'
            : '#fb7185';

  // Simple pillar + top circle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY - 8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(centerX - 4, centerY - 8, 8, 16);

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(centerX - 4, centerY - 8, 8, 16);
}

function movementToSpriteCol(dx: number, dy: number) {
  // Columns: 0=NW, 1=NE, 2=SE, 3=SW, 4=special
  if (dx > 0 && dy === 0) return 2; // +x (down-right) reads as SE-ish
  if (dx === 0 && dy > 0) return 3; // +y (down-left) reads as SW-ish
  if (dx < 0 && dy === 0) return 0;
  if (dx === 0 && dy < 0) return 1;
  return 2;
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sheetCanvas: HTMLCanvasElement,
  sheetWidth: number,
  sheetHeight: number,
  spriteName: string,
  screenX: number,
  screenY: number,
  overrideCol?: number
) {
  const info = getSpriteInfo(spriteName);
  if (!info) return false;
  if (info.sheet.id !== 'towers' && info.sheet.id !== 'enemies') return false;

  const col = overrideCol ?? info.sprite.col;
  const rect = getSpriteRect(info.sheet, { row: info.sprite.row, col }, sheetWidth, sheetHeight);

  const scale = info.sprite.scale ?? 1;
  const offsetX = info.sprite.offsetX ?? 0;
  const offsetY = info.sprite.offsetY ?? 0;

  // Fit sprite relative to tile width (sprites are large cells; we downscale heavily).
  const baseWidth = TILE_WIDTH * (info.sheet.id === 'towers' ? 1.25 : 1.05);
  const aspect = rect.sh / rect.sw;
  const dw = baseWidth * scale;
  const dh = dw * aspect;

  const dx = screenX + (TILE_WIDTH - dw) / 2 + offsetX;
  const dy = screenY + TILE_HEIGHT - dh + offsetY;

  ctx.drawImage(sheetCanvas, rect.sx, rect.sy, rect.sw, rect.sh, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  return true;
}

function canPlaceOnTile(tile: Tile, tool: Tool, money: number) {
  if (tool === 'select' || tool === 'bulldoze') return false;
  if (money < TOOL_INFO[tool].cost) return false;
  if (tile.terrain !== 'grass') return false;
  if (tile.kind !== 'empty') return false;
  if (tile.tower) return false;
  return true;
}

export function TowerGrid({
  selectedTile,
  setSelectedTile,
  onViewportChange,
  navigationTarget,
  onNavigationComplete,
  isMobile = false,
}: {
  selectedTile: { x: number; y: number } | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  onViewportChange?: (viewport: { offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } }) => void;
  navigationTarget?: { x: number; y: number } | null;
  onNavigationComplete?: () => void;
  isMobile?: boolean;
}) {
  const { state, placeAtTile } = useTower();
  const { grid, gridSize, selectedTool, money, settings } = state;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [offset, setOffset] = useState(() => ({ x: isMobile ? 240 : 620, y: isMobile ? 120 : 160 }));
  const [zoom, setZoom] = useState(isMobile ? 0.7 : 1);
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [spriteSheets, setSpriteSheets] = useState<Map<string, HTMLCanvasElement>>(new Map());

  // Load tower/enemy sprite sheets in parallel
  useEffect(() => {
    const load = async () => {
      const results = await Promise.all(
        TOWER_SPRITE_PACK.sheets.map(
          (sheet) =>
            new Promise<{ id: string; canvas: HTMLCanvasElement } | null>((resolve) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => resolve({ id: sheet.id, canvas: filterBackgroundColor(img) });
              img.onerror = () => resolve(null);
              img.src = sheet.src;
            })
        )
      );
      const map = new Map<string, HTMLCanvasElement>();
      for (const r of results) {
        if (r) map.set(r.id, r.canvas);
      }
      setSpriteSheets(map);
    };
    load();
  }, []);

  // Resize observer
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Navigate to a tile (minimap click)
  useEffect(() => {
    if (!navigationTarget) return;
    const { screenX, screenY } = gridToScreen(navigationTarget.x, navigationTarget.y);
    const targetCenterX = (screenX + TILE_WIDTH / 2) * zoom;
    const targetCenterY = (screenY + TILE_HEIGHT / 2) * zoom;
    setOffset({
      x: canvasSize.width / 2 - targetCenterX,
      y: canvasSize.height / 2 - targetCenterY,
    });
    onNavigationComplete?.();
  }, [navigationTarget, canvasSize.width, canvasSize.height, zoom, onNavigationComplete]);

  useEffect(() => {
    onViewportChange?.({ offset, zoom, canvasSize });
  }, [offset, zoom, canvasSize, onViewportChange]);

  const mapTileAtClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;

      // Convert into "world" coords (gridToScreen space) by undoing offset+zoom
      const worldX = (localX - offset.x) / zoom;
      const worldY = (localY - offset.y) / zoom;
      const { gridX, gridY } = screenToGrid(worldX, worldY);
      if (gridX < 0 || gridY < 0 || gridX >= gridSize || gridY >= gridSize) return null;
      return { x: gridX, y: gridY };
    },
    [offset.x, offset.y, zoom, gridSize]
  );

  // Render loop (simple immediate render for MVP)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;

    // Background
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // World transform
    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);

    // Render tiles (simple painter's order)
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = grid[y]![x]!;
        const { screenX, screenY } = gridToScreen(x, y);

        let fill = tile.terrain === 'water' ? '#0284c7' : '#4a7c3f';
        if (tile.kind === 'path') fill = '#475569';
        if (tile.kind === 'spawn') fill = '#16a34a';
        if (tile.kind === 'base') fill = '#dc2626';

        const stroke = settings.showGrid ? 'rgba(0,0,0,0.25)' : undefined;
        drawDiamond(ctx, screenX, screenY, fill, stroke, 1);

      }
    }

    const towersSheet = spriteSheets.get('towers') ?? null;
    const enemiesSheet = spriteSheets.get('enemies') ?? null;

    // Towers (above tiles)
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = grid[y]![x]!;
        if (!tile.tower) continue;
        const { screenX, screenY } = gridToScreen(x, y);
        const spriteName = `tower_${tile.tower.type}`;
        const drew =
          towersSheet &&
          drawSprite(ctx, towersSheet, towersSheet.width, towersSheet.height, spriteName, screenX, screenY, 2);
        if (!drew) drawTowerPlaceholder(ctx, screenX, screenY, tile.tower.type);
      }
    }

    // Enemies (above towers)
    for (const enemy of state.enemies) {
      const from = state.path[Math.min(enemy.pathIndex, state.path.length - 1)] ?? state.base;
      const to = state.path[Math.min(enemy.pathIndex + 1, state.path.length - 1)] ?? state.base;
      const ex = lerp(from.x + 0.5, to.x + 0.5, enemy.progress);
      const ey = lerp(from.y + 0.5, to.y + 0.5, enemy.progress);
      const { screenX, screenY } = gridToScreen(ex, ey);
      const dx = (to.x - from.x) | 0;
      const dy = (to.y - from.y) | 0;
      const col = movementToSpriteCol(dx, dy);
      const spriteName = `enemy_${enemy.type}`;

      const drew =
        enemiesSheet &&
        drawSprite(ctx, enemiesSheet, enemiesSheet.width, enemiesSheet.height, spriteName, screenX, screenY, col);

      if (!drew) {
        const cx = screenX + TILE_WIDTH / 2;
        const cy = screenY + TILE_HEIGHT / 2 - 16;
        ctx.fillStyle = enemy.isFlying ? '#a855f7' : '#f97316';
        ctx.beginPath();
        ctx.arc(cx, cy, enemy.type === 'boss' ? 9 : 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // HP bar
      const hpRatio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
      const hx = screenX + TILE_WIDTH / 2;
      const hy = screenY + TILE_HEIGHT / 2 - 18;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(hx - 10, hy - 14, 20, 3);
      ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.2 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(hx - 10, hy - 14, 20 * hpRatio, 3);
    }

    // Projectiles
    for (const proj of state.projectiles) {
      if (proj.isInstant) continue;
      const { screenX, screenY } = gridToScreen(proj.x, proj.y);
      const cx = screenX + TILE_WIDTH / 2;
      const cy = screenY + TILE_HEIGHT / 2 - 22;
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Placement preview
    if (hovered) {
      const tile = grid[hovered.y]?.[hovered.x];
      if (tile && selectedTool !== 'select') {
        const { screenX, screenY } = gridToScreen(hovered.x, hovered.y);
        const ok = selectedTool === 'bulldoze' ? Boolean(tile.tower) : canPlaceOnTile(tile, selectedTool, money);
        ctx.globalAlpha = 0.25;
        drawDiamond(ctx, screenX, screenY, ok ? '#22c55e' : '#ef4444');
        ctx.globalAlpha = 1;
      }
    }

    // Hover highlight
    if (hovered) {
      const { screenX, screenY } = gridToScreen(hovered.x, hovered.y);
      drawDiamond(ctx, screenX, screenY, 'rgba(0,0,0,0)', 'rgba(255,255,255,0.5)', 2);
    }

    // Selected highlight
    if (selectedTile) {
      const { screenX, screenY } = gridToScreen(selectedTile.x, selectedTile.y);
      drawDiamond(ctx, screenX, screenY, 'rgba(0,0,0,0)', 'rgba(59,130,246,0.9)', 2.5);
    }

    ctx.restore();
  }, [canvasSize, offset.x, offset.y, zoom, grid, gridSize, hovered, selectedTile, selectedTool, money, settings.showGrid, state.enemies, state.projectiles, state.path, state.base, spriteSheets]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning && dragStartRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setOffset({ x: dragStartRef.current.offsetX + dx, y: dragStartRef.current.offsetY + dy });
        return;
      }
      const hit = mapTileAtClientPoint(e.clientX, e.clientY);
      setHovered(hit);
    },
    [isPanning, mapTileAtClientPoint]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Shift+drag to pan (matches “builder app” feel)
    if (e.shiftKey || e.button === 1 || e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY, offsetX: offset.x, offsetY: offset.y };
    }
  }, [offset.x, offset.y]);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setIsPanning(false);
        dragStartRef.current = null;
        return;
      }

      const hit = mapTileAtClientPoint(e.clientX, e.clientY);
      if (!hit) return;

      if (selectedTool === 'select') {
        setSelectedTile(hit);
        return;
      }

      placeAtTile(hit.x, hit.y);
      // Keep hovered tile selected for fast upgrades/sells.
      setSelectedTile(hit);
    },
    [isPanning, mapTileAtClientPoint, placeAtTile, selectedTool, setSelectedTile]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const prevZoom = zoom;
      const nextZoom = clamp(zoom * (1 - e.deltaY * 0.0015), ZOOM_MIN, ZOOM_MAX);
      if (nextZoom === prevZoom) return;

      // Keep mouse position stable during zoom.
      const worldX = (mouseX - offset.x) / prevZoom;
      const worldY = (mouseY - offset.y) / prevZoom;
      setZoom(nextZoom);
      setOffset({
        x: mouseX - worldX * nextZoom,
        y: mouseY - worldY * nextZoom,
      });
    },
    [zoom, offset.x, offset.y]
  );

  const cursor = useMemo(() => {
    if (isPanning) return 'grabbing';
    if (selectedTool === 'select') return 'default';
    return 'crosshair';
  }, [isPanning, selectedTool]);

  return (
    <div ref={containerRef} className="absolute inset-0" style={{ cursor }} onContextMenu={(e) => e.preventDefault()}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setHovered(null)}
        onWheel={handleWheel}
      />

      {/* Small hint for panning */}
      <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] text-white/40 bg-black/30 border border-white/10 px-2 py-1 rounded">
        Shift+Drag to pan • Scroll to zoom
      </div>
    </div>
  );
}

