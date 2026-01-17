'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Tile } from '@/games/coaster/types';
import { getSpriteInfo, getSpriteRect, COASTER_SPRITE_PACK } from '@/games/coaster/lib/coasterRenderConfig';
import { drawStraightTrack, drawCurvedTrack, drawSlopeTrack, drawLoopTrack, drawChainLift } from '@/components/coaster/tracks';
import { drawGuest } from '@/components/coaster/guests';

// =============================================================================
// CONSTANTS (shared with isocity)
// =============================================================================

const TILE_WIDTH = 64;
const HEIGHT_RATIO = 0.60;
const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;
const HEIGHT_UNIT = 20;

// Background color to filter (red)
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
const COLOR_THRESHOLD = 155;

// =============================================================================
// SPRITE SHEET LOADING
// =============================================================================

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
    
    const distance = Math.sqrt(
      Math.pow(r - BACKGROUND_COLOR.r, 2) +
      Math.pow(g - BACKGROUND_COLOR.g, 2) +
      Math.pow(b - BACKGROUND_COLOR.b, 2)
    );
    
    if (distance <= COLOR_THRESHOLD) {
      data[i + 3] = 0; // Make transparent
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function gridToScreen(
  gridX: number,
  gridY: number,
  offsetX: number,
  offsetY: number
): { screenX: number; screenY: number } {
  const screenX = (gridX - gridY) * (TILE_WIDTH / 2) + offsetX;
  const screenY = (gridX + gridY) * (TILE_HEIGHT / 2) + offsetY;
  return { screenX, screenY };
}

function screenToGrid(
  screenX: number,
  screenY: number,
  offsetX: number,
  offsetY: number
): { gridX: number; gridY: number } {
  const adjustedX = screenX - offsetX;
  const adjustedY = screenY - offsetY;
  
  const gridX = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
  const gridY = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
  
  return { gridX: Math.floor(gridX), gridY: Math.floor(gridY) };
}

// =============================================================================
// DRAWING FUNCTIONS
// =============================================================================

function drawGrassTile(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Base grass color
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Subtle shading
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.closePath();
  ctx.fill();
}

function drawWaterTile(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Animated water color
  const waveOffset = Math.sin(tick * 0.05) * 0.05;
  const r = Math.floor(14 + waveOffset * 20);
  const g = Math.floor(165 + waveOffset * 30);
  const b = Math.floor(233 + waveOffset * 20);
  
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Water shimmer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w * 0.75, y + h * 0.25);
  ctx.lineTo(x + w / 2, y + h * 0.5);
  ctx.lineTo(x + w * 0.25, y + h * 0.25);
  ctx.closePath();
  ctx.fill();
}

function drawPathTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number
) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Check adjacent paths for connections
  const hasPath = (gx: number, gy: number) => {
    if (gx < 0 || gy < 0 || gx >= gridSize || gy >= gridSize) return false;
    return grid[gy][gx].path || grid[gy][gx].queue;
  };
  
  const north = hasPath(gridX - 1, gridY);
  const east = hasPath(gridX, gridY - 1);
  const south = hasPath(gridX + 1, gridY);
  const west = hasPath(gridX, gridY + 1);
  
  // Draw grass base first
  drawGrassTile(ctx, x, y);
  
  // Path dimensions
  const pathWidth = w * 0.35;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Path color (stone/concrete)
  ctx.fillStyle = '#9ca3af';
  
  // Edge points
  const northEdge = { x: x + w * 0.25, y: y + h * 0.25 };
  const eastEdge = { x: x + w * 0.75, y: y + h * 0.25 };
  const southEdge = { x: x + w * 0.75, y: y + h * 0.75 };
  const westEdge = { x: x + w * 0.25, y: y + h * 0.75 };
  
  // Draw path segments to connected neighbors
  const drawPathSegment = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    perpX: number,
    perpY: number
  ) => {
    const hw = pathWidth * 0.5;
    ctx.beginPath();
    ctx.moveTo(fromX + perpX * hw, fromY + perpY * hw);
    ctx.lineTo(toX + perpX * hw, toY + perpY * hw);
    ctx.lineTo(toX - perpX * hw, toY - perpY * hw);
    ctx.lineTo(fromX - perpX * hw, fromY - perpY * hw);
    ctx.closePath();
    ctx.fill();
  };
  
  // Direction perpendiculars
  const perpNS = { x: -0.894, y: 0.447 };
  const perpEW = { x: 0.894, y: 0.447 };
  
  if (north) drawPathSegment(cx, cy, northEdge.x, northEdge.y, perpNS.x, perpNS.y);
  if (south) drawPathSegment(cx, cy, southEdge.x, southEdge.y, perpNS.x, perpNS.y);
  if (east) drawPathSegment(cx, cy, eastEdge.x, eastEdge.y, perpEW.x, perpEW.y);
  if (west) drawPathSegment(cx, cy, westEdge.x, westEdge.y, perpEW.x, perpEW.y);
  
  // Center diamond
  const centerSize = pathWidth * 0.7;
  ctx.beginPath();
  ctx.moveTo(cx, cy - centerSize * 0.5);
  ctx.lineTo(cx + centerSize, cy);
  ctx.lineTo(cx, cy + centerSize * 0.5);
  ctx.lineTo(cx - centerSize, cy);
  ctx.closePath();
  ctx.fill();
  
  // Path edge lines
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawQueueTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number
) {
  // Draw path first
  drawPathTile(ctx, x, y, gridX, gridY, grid, gridSize);
  
  // Add queue railings (darker color overlay)
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Queue barrier posts at corners
  ctx.fillStyle = '#374151';
  const postSize = 3;
  const off = w * 0.15;
  
  // Draw small posts
  ctx.beginPath();
  ctx.arc(cx - off, cy - off * 0.5, postSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + off, cy - off * 0.5, postSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - off, cy + off * 0.5, postSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + off, cy + off * 0.5, postSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Rope/chain between posts
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 2]);
  ctx.beginPath();
  ctx.moveTo(cx - off, cy - off * 0.5);
  ctx.lineTo(cx + off, cy - off * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - off, cy + off * 0.5);
  ctx.lineTo(cx + off, cy + off * 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  spriteSheets: Map<string, HTMLCanvasElement>,
  buildingType: string,
  x: number,
  y: number
) {
  const info = getSpriteInfo(buildingType);
  if (!info) return false;
  
  const { sheet, sprite } = info;
  const sheetCanvas = spriteSheets.get(sheet.id);
  if (!sheetCanvas) return false;
  
  const rect = getSpriteRect(sheet, sprite, sheetCanvas.width, sheetCanvas.height);
  const scale = sprite.scale || 1.0;
  const offsetX = sprite.offsetX || 0;
  const offsetY = sprite.offsetY || 0;
  
  // Calculate destination size
  const destWidth = rect.sw * scale;
  const destHeight = rect.sh * scale;
  
  // Center sprite on tile
  const drawX = x + (TILE_WIDTH - destWidth) / 2 + offsetX;
  const drawY = y + (TILE_HEIGHT - destHeight) / 2 + offsetY;
  
  ctx.drawImage(
    sheetCanvas,
    rect.sx, rect.sy, rect.sw, rect.sh,
    drawX, drawY, destWidth, destHeight
  );
  
  return true;
}

function drawTrackSegment(
  ctx: CanvasRenderingContext2D,
  trackPiece: Tile['trackPiece'],
  x: number,
  y: number,
  tick: number
) {
  if (!trackPiece) return;
  
  const { type, direction, startHeight, endHeight, chainLift } = trackPiece;
  
  if (type === 'straight_flat' || type === 'lift_hill_start' || type === 'lift_hill_middle' || type === 'lift_hill_end') {
    drawStraightTrack(ctx, x, y, direction, startHeight);
  } else if (type === 'turn_left_flat' || type === 'turn_right_flat') {
    drawCurvedTrack(ctx, x, y, direction, type === 'turn_right_flat', startHeight);
  } else if (type === 'slope_up_small' || type === 'slope_down_small') {
    drawSlopeTrack(ctx, x, y, direction, startHeight, endHeight);
  } else if (type === 'loop_vertical') {
    drawLoopTrack(ctx, x, y, direction, Math.max(3, endHeight + 3));
  } else {
    // Default fallback to straight for unimplemented pieces
    drawStraightTrack(ctx, x, y, direction, startHeight);
  }
  
  if (chainLift) {
    drawChainLift(ctx, x, y, direction, startHeight, tick);
  }
}

const TRACK_DIR_VECTORS: Record<string, { x: number; y: number }> = {
  north: { x: -TILE_WIDTH / 2, y: -TILE_HEIGHT / 2 },
  east: { x: TILE_WIDTH / 2, y: -TILE_HEIGHT / 2 },
  south: { x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 },
  west: { x: -TILE_WIDTH / 2, y: TILE_HEIGHT / 2 },
};

function bezierPoint(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }, t: number) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function getTrackPoint(
  trackPiece: NonNullable<Tile['trackPiece']>,
  centerX: number,
  centerY: number,
  t: number
) {
  const dirVec = TRACK_DIR_VECTORS[trackPiece.direction];
  const heightOffset = trackPiece.startHeight + (trackPiece.endHeight - trackPiece.startHeight) * t;
  const elevatedCenterY = centerY - heightOffset * HEIGHT_UNIT;
  
  if (trackPiece.type === 'turn_left_flat' || trackPiece.type === 'turn_right_flat') {
    const turnRight = trackPiece.type === 'turn_right_flat';
    const length = Math.sqrt(dirVec.x * dirVec.x + dirVec.y * dirVec.y);
    const dir = { x: dirVec.x / length, y: dirVec.y / length };
    const radius = TILE_WIDTH * 0.4;
    const turnMult = turnRight ? 1 : -1;
    const perp = { x: -dir.y * turnMult, y: dir.x * turnMult };
    
    const p0 = { x: centerX - dir.x * radius, y: elevatedCenterY - dir.y * radius };
    const p3 = { x: centerX + perp.x * radius, y: elevatedCenterY + perp.y * radius };
    const p1 = { x: p0.x + dir.x * radius * 0.5, y: p0.y + dir.y * radius * 0.5 };
    const p2 = { x: p3.x - perp.x * radius * 0.5, y: p3.y - perp.y * radius * 0.5 };
    
    return bezierPoint(p0, p1, p2, p3, t);
  }
  
  if (trackPiece.type === 'loop_vertical') {
    const radius = TILE_WIDTH * 0.12;
    const angle = t * Math.PI * 2;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: elevatedCenterY - Math.sin(angle) * radius * 0.6,
    };
  }
  
  // Straight or slope segments
  const start = {
    x: centerX - dirVec.x * 0.4,
    y: elevatedCenterY - dirVec.y * 0.4,
  };
  const end = {
    x: centerX + dirVec.x * 0.4,
    y: elevatedCenterY + dirVec.y * 0.4,
  };
  
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function drawCoasterCar(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Car body
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.ellipse(x, y, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Car highlight
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(x - 1.5, y - 1, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

// =============================================================================
// COMPONENT
// =============================================================================

interface CoasterGridProps {
  selectedTile: { x: number; y: number } | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  navigationTarget?: { x: number; y: number } | null;
  onNavigationComplete?: () => void;
  onViewportChange?: (viewport: {
    offset: { x: number; y: number };
    zoom: number;
    canvasSize: { width: number; height: number };
  }) => void;
}

export function CoasterGrid({
  selectedTile,
  setSelectedTile,
  navigationTarget,
  onNavigationComplete,
  onViewportChange,
}: CoasterGridProps) {
  const { state, latestStateRef, placeAtTile, bulldozeTile } = useCoaster();
  const { grid, gridSize, selectedTool, tick } = state;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [offset, setOffset] = useState({ x: 620, y: 160 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [spriteSheets, setSpriteSheets] = useState<Map<string, HTMLCanvasElement>>(new Map());
  
  // Load sprite sheets
  useEffect(() => {
    const loadSheets = async () => {
      const newSheets = new Map<string, HTMLCanvasElement>();
      
      for (const sheet of COASTER_SPRITE_PACK.sheets) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const filtered = filterBackgroundColor(img);
              newSheets.set(sheet.id, filtered);
              resolve();
            };
            img.onerror = reject;
            img.src = sheet.src;
          });
        } catch (e) {
          console.error(`Failed to load sprite sheet ${sheet.id}:`, e);
        }
      }
      
      setSpriteSheets(newSheets);
    };
    
    loadSheets();
  }, []);
  
  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Report viewport changes
  useEffect(() => {
    onViewportChange?.({ offset, zoom, canvasSize });
  }, [offset, zoom, canvasSize, onViewportChange]);
  
  // Navigate to target
  useEffect(() => {
    if (navigationTarget) {
      const { screenX, screenY } = gridToScreen(
        navigationTarget.x,
        navigationTarget.y,
        0,
        0
      );
      setOffset({
        x: canvasSize.width / 2 - screenX * zoom,
        y: canvasSize.height / 2 - screenY * zoom,
      });
      onNavigationComplete?.();
    }
  }, [navigationTarget, canvasSize, zoom, onNavigationComplete]);
  
  // Main render loop
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
    
    // Clear
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply transforms
    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    
    // Calculate visible bounds for culling
    const viewLeft = -offset.x / zoom - TILE_WIDTH;
    const viewTop = -offset.y / zoom - TILE_HEIGHT;
    const viewRight = canvasSize.width / zoom - offset.x / zoom + TILE_WIDTH;
    const viewBottom = canvasSize.height / zoom - offset.y / zoom + TILE_HEIGHT;
    
    const guestsByTile = new Map<string, typeof state.guests>();
    state.guests.forEach(guest => {
      const key = `${guest.tileX},${guest.tileY}`;
      const existing = guestsByTile.get(key);
      if (existing) {
        existing.push(guest);
      } else {
        guestsByTile.set(key, [guest]);
      }
    });
    
    const carsByTile = new Map<string, { x: number; y: number }[]>();
    state.coasters.forEach(coaster => {
      if (coaster.track.length === 0 || coaster.trackTiles.length === 0) return;
      coaster.trains.forEach(train => {
        train.cars.forEach(car => {
          const trackIndex = Math.floor(car.trackProgress) % coaster.track.length;
          const t = car.trackProgress - Math.floor(car.trackProgress);
          const trackTile = coaster.trackTiles[trackIndex];
          const trackPiece = coaster.track[trackIndex];
          if (!trackTile || !trackPiece) return;
          
          const { screenX, screenY } = gridToScreen(trackTile.x, trackTile.y, 0, 0);
          const centerX = screenX + TILE_WIDTH / 2;
          const centerY = screenY + TILE_HEIGHT / 2;
          const pos = getTrackPoint(trackPiece, centerX, centerY, t);
          
          const key = `${trackTile.x},${trackTile.y}`;
          const existing = carsByTile.get(key);
          if (existing) {
            existing.push(pos);
          } else {
            carsByTile.set(key, [pos]);
          }
        });
      });
    });
    
    // Draw tiles (back to front for proper depth)
    for (let sum = 0; sum < gridSize * 2 - 1; sum++) {
      for (let x = 0; x <= sum; x++) {
        const y = sum - x;
        if (x >= gridSize || y >= gridSize || y < 0) continue;
        
        const { screenX, screenY } = gridToScreen(x, y, 0, 0);
        
        // Culling
        if (screenX < viewLeft || screenX > viewRight ||
            screenY < viewTop || screenY > viewBottom) continue;
        
        const tile = grid[y][x];
        
        // Draw based on tile type
        if (tile.terrain === 'water') {
          drawWaterTile(ctx, screenX, screenY, tick);
        } else if (tile.queue) {
          drawQueueTile(ctx, screenX, screenY, x, y, grid, gridSize);
        } else if (tile.path) {
          drawPathTile(ctx, screenX, screenY, x, y, grid, gridSize);
        } else {
          drawGrassTile(ctx, screenX, screenY);
        }
        
        // Draw coaster track if present
        if (tile.trackPiece) {
          drawTrackSegment(ctx, tile.trackPiece, screenX, screenY, tick);
        }
        
        // Draw building sprite if present
        const buildingType = tile.building?.type;
        if (buildingType && buildingType !== 'empty' && buildingType !== 'grass' && 
            buildingType !== 'water' && buildingType !== 'path' && buildingType !== 'queue') {
          drawSprite(ctx, spriteSheets, buildingType, screenX, screenY);
        }
        
        // Draw guests on this tile
        const guests = guestsByTile.get(`${x},${y}`);
        if (guests) {
          guests.forEach(guest => {
            drawGuest(ctx, guest, tick);
          });
        }

        // Draw coaster cars on this tile
        const cars = carsByTile.get(`${x},${y}`);
        if (cars) {
          cars.forEach(car => {
            drawCoasterCar(ctx, car.x, car.y);
          });
        }
        
        // Selection highlight
        if (selectedTile && selectedTile.x === x && selectedTile.y === y) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
          ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
          ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
          ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
          ctx.closePath();
          ctx.stroke();
        }
        
        // Hover highlight
        if (hoveredTile && hoveredTile.x === x && hoveredTile.y === y && selectedTool !== 'select') {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
          ctx.beginPath();
          ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
          ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
          ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
          ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    
    ctx.restore();
  }, [grid, gridSize, offset, zoom, canvasSize, tick, selectedTile, hoveredTile, selectedTool, spriteSheets, state.guests, state.coasters]);
  
  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }, [offset]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else {
      // Update hovered tile
      const { gridX, gridY } = screenToGrid(
        mouseX / zoom,
        mouseY / zoom,
        offset.x / zoom,
        offset.y / zoom
      );
      
      if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
        setHoveredTile({ x: gridX, y: gridY });
      } else {
        setHoveredTile(null);
      }
    }
  }, [isDragging, dragStart, offset, zoom, gridSize]);
  
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const wasDragging = isDragging;
    setIsDragging(false);
    
    // If we didn't drag much, treat as click
    const dragDist = Math.abs(e.clientX - dragStart.x - offset.x) + Math.abs(e.clientY - dragStart.y - offset.y);
    if (wasDragging && dragDist < 5 && hoveredTile) {
      if (selectedTool === 'select') {
        setSelectedTile(hoveredTile);
      } else if (selectedTool === 'bulldoze') {
        bulldozeTile(hoveredTile.x, hoveredTile.y);
      } else {
        placeAtTile(hoveredTile.x, hoveredTile.y);
      }
    }
  }, [isDragging, dragStart, offset, hoveredTile, selectedTool, setSelectedTile, bulldozeTile, placeAtTile]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * zoomFactor));
    
    // Zoom toward mouse position
    const zoomRatio = newZoom / zoom;
    setOffset({
      x: mouseX - (mouseX - offset.x) * zoomRatio,
      y: mouseY - (mouseY - offset.y) * zoomRatio,
    });
    setZoom(newZoom);
  }, [zoom, offset]);
  
  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        className="block cursor-grab active:cursor-grabbing"
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
