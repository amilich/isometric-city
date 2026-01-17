/**
 * Guest System for Coaster Tycoon
 * Handles guest spawning, AI, pathfinding, and rendering
 */

import { Guest, GuestState, generateGuestName } from '@/games/coaster/types/economy';
import { Tile } from '@/games/coaster/types/game';

// =============================================================================
// CONSTANTS
// =============================================================================

const TILE_WIDTH = 64;
const HEIGHT_RATIO = 0.60;
const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;

const GUEST_COLORS = {
  skin: ['#ffd5b4', '#f5c9a6', '#e5b898', '#d4a574', '#c49462', '#a67b5b', '#8b6b4a'],
  shirt: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'],
  pants: ['#1e293b', '#475569', '#64748b', '#0f172a', '#1e3a5a', '#422006'],
  hat: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff'],
};

// =============================================================================
// GUEST CREATION
// =============================================================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createGuest(entranceX: number, entranceY: number): Guest {
  return {
    id: generateUUID(),
    name: generateGuestName(),
    
    // Position
    tileX: entranceX,
    tileY: entranceY,
    progress: 0,
    direction: 'south' as const,
    
    // State
    state: 'entering' as GuestState,
    targetTileX: entranceX,
    targetTileY: entranceY + 1,
    path: [],
    pathIndex: 0,
    
    // Queue
    queueRideId: null,
    queuePosition: 0,
    
    // Needs (0-100)
    hunger: 20 + Math.random() * 30,
    thirst: 20 + Math.random() * 30,
    bathroom: 10 + Math.random() * 20,
    energy: 80 + Math.random() * 20,
    happiness: 70 + Math.random() * 30,
    nausea: 0,
    
    // Preferences (0-10)
    preferExcitement: 3 + Math.random() * 7,
    preferIntensity: 2 + Math.random() * 6,
    nauseaTolerance: 3 + Math.random() * 7,
    
    // Money
    cash: 30 + Math.floor(Math.random() * 70),
    totalSpent: 0,
    
    // Tracking
    ridesRidden: [],
    thoughts: [],
    timeInPark: 0,
    
    // Visual
    skinColor: randomFromArray(GUEST_COLORS.skin),
    shirtColor: randomFromArray(GUEST_COLORS.shirt),
    pantsColor: randomFromArray(GUEST_COLORS.pants),
    hasHat: Math.random() > 0.7,
    hatColor: randomFromArray(GUEST_COLORS.hat),
    walkOffset: Math.random() * Math.PI * 2,
  };
}

// =============================================================================
// GUEST RENDERING
// =============================================================================

function gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
  const x = (gridX - gridY) * (TILE_WIDTH / 2);
  const y = (gridX + gridY) * (TILE_HEIGHT / 2);
  return { x, y };
}

export function drawGuest(
  ctx: CanvasRenderingContext2D,
  guest: Guest,
  tick: number
) {
  // Calculate interpolated position
  const { x: startX, y: startY } = gridToScreen(guest.tileX, guest.tileY);
  const { x: endX, y: endY } = gridToScreen(guest.targetTileX, guest.targetTileY);
  
  const x = startX + (endX - startX) * guest.progress + TILE_WIDTH / 2;
  const y = startY + (endY - startY) * guest.progress + TILE_HEIGHT / 2;
  
  // Walking animation
  const walkCycle = Math.sin((tick * 0.2 + guest.walkOffset) * 2);
  const bobY = Math.abs(walkCycle) * 2;
  
  // Draw shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw body (simple sprite-like representation)
  const guestY = y - 12 - bobY;
  
  // Pants/legs
  ctx.fillStyle = guest.pantsColor;
  ctx.fillRect(x - 3, guestY + 6, 2, 6);
  ctx.fillRect(x + 1, guestY + 6, 2, 6);
  
  // Torso
  ctx.fillStyle = guest.shirtColor;
  ctx.fillRect(x - 4, guestY - 2, 8, 8);
  
  // Head
  ctx.fillStyle = guest.skinColor;
  ctx.beginPath();
  ctx.arc(x, guestY - 6, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Hat
  if (guest.hasHat) {
    ctx.fillStyle = guest.hatColor;
    ctx.fillRect(x - 5, guestY - 11, 10, 3);
    ctx.fillRect(x - 3, guestY - 14, 6, 3);
  }
  
  // Arms (animated)
  const armSwing = walkCycle * 3;
  ctx.fillStyle = guest.shirtColor;
  ctx.fillRect(x - 6, guestY + armSwing, 2, 5);
  ctx.fillRect(x + 4, guestY - armSwing, 2, 5);
}

// =============================================================================
// GUEST AI / PATHFINDING
// =============================================================================

/**
 * Find path from guest position to target using simple BFS
 */
export function findPath(
  grid: Tile[][],
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  maxSteps: number = 100
): { x: number; y: number }[] {
  const gridSize = grid.length;
  
  // BFS
  const visited = new Set<string>();
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [
    { x: startX, y: startY, path: [] }
  ];
  
  const key = (x: number, y: number) => `${x},${y}`;
  visited.add(key(startX, startY));
  
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  
  while (queue.length > 0 && queue[0].path.length < maxSteps) {
    const current = queue.shift()!;
    
    if (current.x === targetX && current.y === targetY) {
      return [...current.path, { x: targetX, y: targetY }];
    }
    
    for (const dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      if (visited.has(key(nx, ny))) continue;
      
      const tile = grid[ny][nx];
      // Guests can only walk on paths
      if (!tile.path && !tile.queue) continue;
      
      visited.add(key(nx, ny));
      queue.push({
        x: nx,
        y: ny,
        path: [...current.path, { x: current.x, y: current.y }],
      });
    }
  }
  
  return []; // No path found
}

/**
 * Update guest state and position
 */
export function updateGuest(
  guest: Guest,
  grid: Tile[][],
  deltaTime: number
): Guest {
  const updatedGuest = { ...guest };
  
  // Update time in park
  updatedGuest.timeInPark += deltaTime;
  
  // Update needs over time
  updatedGuest.hunger = Math.min(100, updatedGuest.hunger + deltaTime * 0.01);
  updatedGuest.thirst = Math.min(100, updatedGuest.thirst + deltaTime * 0.015);
  updatedGuest.bathroom = Math.min(100, updatedGuest.bathroom + deltaTime * 0.008);
  updatedGuest.energy = Math.max(0, updatedGuest.energy - deltaTime * 0.005);
  
  // Update happiness based on needs
  let happinessChange = 0;
  if (updatedGuest.hunger > 70) happinessChange -= 0.1;
  if (updatedGuest.thirst > 70) happinessChange -= 0.15;
  if (updatedGuest.bathroom > 80) happinessChange -= 0.2;
  if (updatedGuest.nausea > 50) happinessChange -= 0.1;
  
  updatedGuest.happiness = Math.max(0, Math.min(100, updatedGuest.happiness + happinessChange * deltaTime));
  
  // Reduce nausea over time
  updatedGuest.nausea = Math.max(0, updatedGuest.nausea - deltaTime * 0.02);
  
  // Movement
  if (updatedGuest.state === 'walking' || updatedGuest.state === 'entering') {
    const speed = 0.02; // Progress per tick
    updatedGuest.progress += speed;
    
    if (updatedGuest.progress >= 1) {
      // Reached target tile
      updatedGuest.tileX = updatedGuest.targetTileX;
      updatedGuest.tileY = updatedGuest.targetTileY;
      updatedGuest.progress = 0;
      
      // Get next waypoint from path
      if (updatedGuest.path.length > 0 && updatedGuest.pathIndex < updatedGuest.path.length) {
        const next = updatedGuest.path[updatedGuest.pathIndex];
        updatedGuest.targetTileX = next.x;
        updatedGuest.targetTileY = next.y;
        updatedGuest.pathIndex++;
        
        // Update direction
        const dx = next.x - updatedGuest.tileX;
        const dy = next.y - updatedGuest.tileY;
        if (dx > 0) updatedGuest.direction = 'south';
        else if (dx < 0) updatedGuest.direction = 'north';
        else if (dy > 0) updatedGuest.direction = 'west';
        else if (dy < 0) updatedGuest.direction = 'east';
      } else {
        // Path complete, wander or find new target
        updatedGuest.state = 'walking';
        updatedGuest.path = [];
        updatedGuest.pathIndex = 0;
        
        // Random walk to adjacent path tile
        const directions = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 },
        ];
        
        const validDirs = directions.filter(dir => {
          const nx = updatedGuest.tileX + dir.dx;
          const ny = updatedGuest.tileY + dir.dy;
          if (nx < 0 || ny < 0 || nx >= grid.length || ny >= grid.length) return false;
          return grid[ny][nx].path || grid[ny][nx].queue;
        });
        
        if (validDirs.length > 0) {
          const dir = validDirs[Math.floor(Math.random() * validDirs.length)];
          updatedGuest.targetTileX = updatedGuest.tileX + dir.dx;
          updatedGuest.targetTileY = updatedGuest.tileY + dir.dy;
        }
      }
    }
  }
  
  return updatedGuest;
}

// =============================================================================
// GUEST SPAWNING
// =============================================================================

/**
 * Spawn guests at park entrance
 */
export function spawnGuests(
  grid: Tile[][],
  currentGuests: Guest[],
  parkRating: number,
  hour: number
): Guest[] {
  // Don't spawn at night or if park is closed
  if (hour < 9 || hour > 21) return [];
  
  // Calculate spawn rate based on park rating and time
  const baseRate = 0.02; // 2% chance per tick
  const ratingBonus = parkRating / 1000 * 0.03;
  const peakHourBonus = (hour >= 11 && hour <= 15) ? 0.02 : 0;
  
  const spawnChance = baseRate + ratingBonus + peakHourBonus;
  
  // Cap maximum guests
  const maxGuests = 500;
  if (currentGuests.length >= maxGuests) return [];
  
  const newGuests: Guest[] = [];
  
  if (Math.random() < spawnChance) {
    // Find entrance tiles (look for path tiles at grid edges)
    const entranceTiles: { x: number; y: number }[] = [];
    const gridSize = grid.length;
    
    // Check edges for path tiles
    for (let i = 0; i < gridSize; i++) {
      if (grid[0][i]?.path) entranceTiles.push({ x: i, y: 0 });
      if (grid[gridSize - 1][i]?.path) entranceTiles.push({ x: i, y: gridSize - 1 });
      if (grid[i][0]?.path) entranceTiles.push({ x: 0, y: i });
      if (grid[i][gridSize - 1]?.path) entranceTiles.push({ x: gridSize - 1, y: i });
    }
    
    // Also check first few rows for any path (simpler entrance detection)
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (grid[y] && grid[y][x]?.path) {
          entranceTiles.push({ x, y });
        }
      }
    }
    
    if (entranceTiles.length > 0) {
      const entrance = entranceTiles[Math.floor(Math.random() * entranceTiles.length)];
      newGuests.push(createGuest(entrance.x, entrance.y));
    }
  }
  
  return newGuests;
}
