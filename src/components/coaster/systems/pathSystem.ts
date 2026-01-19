/**
 * Path System - Handles footpath rendering and logic for Coaster Tycoon
 */

import { ParkTile } from '@/games/coaster/types/game';

// Tile dimensions (same as IsoCity)
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

// Path connection types based on neighbors
export type PathConnection = {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
};

/**
 * Get path connections for a tile
 */
export function getPathConnections(
  grid: ParkTile[][],
  gridSize: number,
  x: number,
  y: number
): PathConnection {
  const hasPathAt = (px: number, py: number): boolean => {
    if (px < 0 || py < 0 || px >= gridSize || py >= gridSize) return false;
    const tile = grid[py]?.[px];
    return !!tile?.path || tile?.building?.type === 'park_entrance';
  };

  return {
    north: hasPathAt(x - 1, y),
    east: hasPathAt(x, y - 1),
    south: hasPathAt(x + 1, y),
    west: hasPathAt(x, y + 1),
  };
}

/**
 * Get the path type string for sprite selection
 */
export function getPathType(connections: PathConnection): string {
  const { north, east, south, west } = connections;
  const count = [north, east, south, west].filter(Boolean).length;

  // No connections - single path piece
  if (count === 0) return 'single';

  // Dead ends (1 connection)
  if (count === 1) {
    if (north) return 'end_s';
    if (east) return 'end_w';
    if (south) return 'end_n';
    if (west) return 'end_e';
  }

  // Straight paths (2 opposite connections)
  if (north && south && !east && !west) return 'straight_ns';
  if (east && west && !north && !south) return 'straight_ew';

  // Corners (2 adjacent connections)
  if (north && east && !south && !west) return 'corner_ne';
  if (north && west && !south && !east) return 'corner_nw';
  if (south && east && !north && !west) return 'corner_se';
  if (south && west && !north && !east) return 'corner_sw';

  // T-junctions (3 connections)
  if (count === 3) {
    if (!north) return 'junction_t_s';
    if (!east) return 'junction_t_w';
    if (!south) return 'junction_t_n';
    if (!west) return 'junction_t_e';
  }

  // 4-way crossing
  if (count === 4) return 'junction_cross';

  return 'single';
}

// Path colors for different surfaces
export const PATH_COLORS = {
  tarmac: {
    main: '#6b7280',
    light: '#9ca3af',
    dark: '#4b5563',
    edge: '#374151',
  },
  dirt: {
    main: '#a16207',
    light: '#ca8a04',
    dark: '#854d0e',
    edge: '#713f12',
  },
  crazy_paving: {
    main: '#78716c',
    light: '#a8a29e',
    dark: '#57534e',
    edge: '#44403c',
  },
  tile: {
    main: '#dc2626',
    light: '#ef4444',
    dark: '#b91c1c',
    edge: '#991b1b',
  },
};

// Queue railing colors
export const QUEUE_COLORS = {
  pole: '#71717a',
  rail: '#a1a1aa',
  highlight: '#d4d4d8',
};

/**
 * Draw a path tile on the canvas
 */
export function drawPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tile: ParkTile,
  connections: PathConnection,
  zoom: number,
  isHovered: boolean = false,
  isSelected: boolean = false
): void {
  if (!tile.path) return;

  const w = TILE_WIDTH * zoom;
  const h = TILE_HEIGHT * zoom;
  const halfW = w / 2;
  const halfH = h / 2;

  const colors = PATH_COLORS[tile.path.surface] || PATH_COLORS.tarmac;
  const pathType = getPathType(connections);

  ctx.save();
  ctx.translate(x, y);

  // Draw base path tile (isometric diamond)
  ctx.beginPath();
  ctx.moveTo(0, -halfH);
  ctx.lineTo(halfW, 0);
  ctx.lineTo(0, halfH);
  ctx.lineTo(-halfW, 0);
  ctx.closePath();

  // Main path fill
  ctx.fillStyle = tile.path.type === 'queue' ? '#9ca3af' : colors.main;
  ctx.fill();

  // Edge highlight
  ctx.strokeStyle = colors.edge;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw path pattern based on surface
  if (tile.path.surface === 'crazy_paving' && zoom > 0.6) {
    drawCrazyPavingPattern(ctx, halfW, halfH, zoom);
  } else if (tile.path.surface === 'tile' && zoom > 0.6) {
    drawTilePattern(ctx, halfW, halfH, zoom);
  }

  // Draw queue railings if this is a queue path
  if (tile.path.type === 'queue' && zoom > 0.5) {
    drawQueueRailings(ctx, connections, halfW, halfH, zoom);
  }

  // Draw litter/vomit indicators
  if (tile.path.litter > 50 && zoom > 0.6) {
    drawLitter(ctx, tile.path.litter, halfW, halfH, zoom);
  }
  if (tile.path.vomit && zoom > 0.6) {
    drawVomit(ctx, halfW, halfH, zoom);
  }

  // Hover/selection highlight
  if (isHovered || isSelected) {
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(halfW, 0);
    ctx.lineTo(0, halfH);
    ctx.lineTo(-halfW, 0);
    ctx.closePath();
    ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw crazy paving pattern
 */
function drawCrazyPavingPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  zoom: number
): void {
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.5;

  // Random-looking stone pattern
  const lines = [
    [[-halfW * 0.3, -halfH * 0.2], [halfW * 0.2, halfH * 0.1]],
    [[halfW * 0.1, -halfH * 0.3], [halfW * 0.4, halfH * 0.2]],
    [[-halfW * 0.4, halfH * 0.1], [0, halfH * 0.4]],
  ];

  lines.forEach(([[x1, y1], [x2, y2]]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
}

/**
 * Draw tile pattern
 */
function drawTilePattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  zoom: number
): void {
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.5;

  // Grid pattern
  const gridLines = 3;
  for (let i = 1; i < gridLines; i++) {
    const offset = (i / gridLines) * 2 - 1;
    
    // Horizontal lines (isometric)
    ctx.beginPath();
    ctx.moveTo(-halfW * (1 - Math.abs(offset)), offset * halfH);
    ctx.lineTo(halfW * (1 - Math.abs(offset)), offset * halfH);
    ctx.stroke();
  }
}

/**
 * Draw queue railings
 */
function drawQueueRailings(
  ctx: CanvasRenderingContext2D,
  connections: PathConnection,
  halfW: number,
  halfH: number,
  zoom: number
): void {
  const poleSize = 2 * zoom;
  const railHeight = 4 * zoom;

  ctx.fillStyle = QUEUE_COLORS.pole;
  ctx.strokeStyle = QUEUE_COLORS.rail;
  ctx.lineWidth = 1;

  // Draw poles at corners based on connections
  const corners = [
    { x: 0, y: -halfH, show: !connections.north && !connections.east },
    { x: halfW, y: 0, show: !connections.east && !connections.south },
    { x: 0, y: halfH, show: !connections.south && !connections.west },
    { x: -halfW, y: 0, show: !connections.west && !connections.north },
  ];

  corners.forEach(({ x, y, show }) => {
    if (show || true) { // Always show poles for visual clarity
      // Pole
      ctx.fillRect(x - poleSize / 2, y - railHeight - poleSize, poleSize, railHeight + poleSize);
    }
  });

  // Draw connecting rails on non-connected edges
  if (!connections.north) {
    ctx.beginPath();
    ctx.moveTo(-halfW * 0.5, -halfH * 0.5 - railHeight);
    ctx.lineTo(0, -halfH - railHeight);
    ctx.stroke();
  }
  if (!connections.east) {
    ctx.beginPath();
    ctx.moveTo(0, -halfH - railHeight);
    ctx.lineTo(halfW * 0.5, -halfH * 0.5 - railHeight);
    ctx.stroke();
  }
}

/**
 * Draw litter on path
 */
function drawLitter(
  ctx: CanvasRenderingContext2D,
  amount: number,
  halfW: number,
  halfH: number,
  zoom: number
): void {
  const litterCount = Math.min(5, Math.floor(amount / 20));
  ctx.fillStyle = '#854d0e';

  for (let i = 0; i < litterCount; i++) {
    const x = (Math.random() - 0.5) * halfW;
    const y = (Math.random() - 0.5) * halfH;
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
}

/**
 * Draw vomit on path
 */
function drawVomit(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  zoom: number
): void {
  ctx.fillStyle = '#84cc16';
  ctx.beginPath();
  ctx.ellipse(halfW * 0.2, halfH * 0.2, 4 * zoom, 3 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A* pathfinding for guests on paths
 */
export function findPathOnGrid(
  grid: ParkTile[][],
  gridSize: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { x: number; y: number }[] | null {
  // Simple BFS for now - can be upgraded to A* for better performance
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [
    { x: startX, y: startY, path: [{ x: startX, y: startY }] }
  ];
  const visited = new Set<string>();
  visited.add(`${startX},${startY}`);

  const directions = [
    { dx: -1, dy: 0 },  // north
    { dx: 0, dy: -1 },  // east
    { dx: 1, dy: 0 },   // south
    { dx: 0, dy: 1 },   // west
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.x === endX && current.y === endY) {
      return current.path;
    }

    for (const { dx, dy } of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;

      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      if (visited.has(key)) continue;

      const tile = grid[ny]?.[nx];
      if (!tile?.path && tile?.building?.type !== 'park_entrance') continue;

      visited.add(key);
      queue.push({
        x: nx,
        y: ny,
        path: [...current.path, { x: nx, y: ny }],
      });
    }
  }

  return null; // No path found
}

/**
 * Find the nearest path tile from a position
 */
export function findNearestPath(
  grid: ParkTile[][],
  gridSize: number,
  x: number,
  y: number,
  maxDistance: number = 10
): { x: number; y: number } | null {
  // Spiral search outward
  for (let d = 0; d <= maxDistance; d++) {
    for (let dx = -d; dx <= d; dx++) {
      for (let dy = -d; dy <= d; dy++) {
        if (Math.abs(dx) !== d && Math.abs(dy) !== d) continue; // Only check perimeter
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
        
        const tile = grid[ny]?.[nx];
        if (tile?.path) {
          return { x: nx, y: ny };
        }
      }
    }
  }

  return null;
}
