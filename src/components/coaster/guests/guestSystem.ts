/**
 * Guest System for IsoCoaster
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

export function createGuest(entranceX: number, entranceY: number, gridSize: number = 64): Guest {
  // Determine which edge the guest is entering from and set target direction
  // The guest should walk INTO the park (away from the edge)
  let targetX = entranceX;
  let targetY = entranceY;
  let direction: 'north' | 'south' | 'east' | 'west' = 'south';
  
  if (entranceX === 0) {
    // North edge (x=0) - walk toward south (x+1)
    targetX = entranceX + 1;
    direction = 'south';
  } else if (entranceX === gridSize - 1) {
    // South edge (x=max) - walk toward north (x-1)
    targetX = entranceX - 1;
    direction = 'north';
  } else if (entranceY === 0) {
    // East edge (y=0) - walk toward west (y+1)
    targetY = entranceY + 1;
    direction = 'west';
  } else if (entranceY === gridSize - 1) {
    // West edge (y=max) - walk toward east (y-1)
    targetY = entranceY - 1;
    direction = 'east';
  } else {
    // Fallback for non-edge spawns (shouldn't happen with new spawn logic)
    targetY = entranceY + 1;
    direction = 'south';
  }
  
  return {
    id: generateUUID(),
    name: generateGuestName(),
    
    // Position
    tileX: entranceX,
    tileY: entranceY,
    progress: 0,
    direction,
    
    // State
    state: 'entering' as GuestState,
    lastState: 'entering' as GuestState,
    targetBuildingId: null,
    targetBuildingKind: null,
    targetTileX: targetX,
    targetTileY: targetY,
    path: [],
    pathIndex: 0,
    
    // Queue
    queueRideId: null,
    queuePosition: 0,
    queueTimer: 0,
    decisionCooldown: 20 + Math.random() * 40,
    
    // Approach state
    approachProgress: 0,
    initialActivityTime: 0,
    activityStartTime: 0,
    
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
  let { x: startX, y: startY } = gridToScreen(guest.tileX, guest.tileY);
  const { x: endX, y: endY } = gridToScreen(guest.targetTileX, guest.targetTileY);
  
  // For entering guests, offset start position toward outside the map (through the gate)
  // This makes them visually appear to walk in from outside
  if (guest.state === 'entering' && guest.progress < 0.5) {
    // Determine which edge they're entering from based on tile position
    // Offset toward the edge by extending the start position outward
    const offsetAmount = TILE_WIDTH * 0.6;
    
    // Calculate direction from target back to start (the direction they're coming from)
    const dx = startX - endX;
    const dy = startY - endY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 0) {
      // Extend start position outward (beyond the tile edge)
      startX += (dx / dist) * offsetAmount;
      startY += (dy / dist) * offsetAmount;
    }
  }
  
  let x = startX + (endX - startX) * guest.progress + TILE_WIDTH / 2;
  let y = startY + (endY - startY) * guest.progress + TILE_HEIGHT / 2;
  
  // When eating, shopping, or exiting building - animate position
  // Use real time for smooth animation independent of game tick rate
  if ((guest.state === 'eating' || guest.state === 'shopping' || guest.state === 'exiting_building') && guest.targetBuildingId) {
    const parts = guest.targetBuildingId.split(',');
    if (parts.length === 2) {
      const buildingX = parseInt(parts[0], 10);
      const buildingY = parseInt(parts[1], 10);
      
      if (!isNaN(buildingX) && !isNaN(buildingY)) {
        const { x: pathX, y: pathY } = gridToScreen(guest.tileX, guest.tileY);
        const { x: buildingScreenX, y: buildingScreenY } = gridToScreen(buildingX, buildingY);
        
        // Path center and building center
        const pathCenterX = pathX + TILE_WIDTH / 2;
        const pathCenterY = pathY + TILE_HEIGHT / 2;
        const buildingCenterX = buildingScreenX + TILE_WIDTH / 2;
        const buildingCenterY = buildingScreenY + TILE_HEIGHT / 2;
        
        const walkDurationMs = 800;
        // If activityStartTime is 0 or undefined, treat as just started
        const now = Date.now();
        const startTime = guest.activityStartTime && guest.activityStartTime > 0 ? guest.activityStartTime : now;
        const elapsedMs = now - startTime;
        
        let progress: number;
        
        if (guest.state === 'exiting_building') {
          // Walking out: 1 -> 0 over 800ms
          progress = Math.max(0, 1 - elapsedMs / walkDurationMs);
        } else {
          // Walking in: 0 -> 1 over 800ms, then stay at 1
          progress = Math.min(1, elapsedMs / walkDurationMs);
        }
        
        // Apply easing for smoother movement
        const easedProgress = progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        // Walk from path center toward building center
        x = pathCenterX + (buildingCenterX - pathCenterX) * easedProgress;
        y = pathCenterY + (buildingCenterY - pathCenterY) * easedProgress;
      }
    }
  }
  
  // Walking animation
  const walkCycle = Math.sin((tick * 0.2 + guest.walkOffset) * 2);
  const bobY = Math.abs(walkCycle) * 0.5;
  
  // Draw shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(x, y + 0.5, 1.25, 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw body (simple sprite-like representation) - scaled to 25% of original
  const guestY = y - 3 - bobY;
  
  // Pants/legs
  ctx.fillStyle = guest.pantsColor;
  ctx.fillRect(x - 0.75, guestY + 1.5, 0.5, 1.5);
  ctx.fillRect(x + 0.25, guestY + 1.5, 0.5, 1.5);
  
  // Torso
  ctx.fillStyle = guest.shirtColor;
  ctx.fillRect(x - 1, guestY - 0.5, 2, 2);
  
  // Head
  ctx.fillStyle = guest.skinColor;
  ctx.beginPath();
  ctx.arc(x, guestY - 1.5, 1, 0, Math.PI * 2);
  ctx.fill();
  
  // Hat
  if (guest.hasHat) {
    ctx.fillStyle = guest.hatColor;
    ctx.fillRect(x - 1.25, guestY - 2.75, 2.5, 0.75);
    ctx.fillRect(x - 0.75, guestY - 3.5, 1.5, 0.75);
  }
  
  // Arms (animated)
  const armSwing = walkCycle * 0.75;
  ctx.fillStyle = guest.shirtColor;
  ctx.fillRect(x - 1.5, guestY + armSwing, 0.5, 1.25);
  ctx.fillRect(x + 1, guestY - armSwing, 0.5, 1.25);
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

function isRideBuilding(type: string): boolean {
  return type.startsWith('ride_') || type.startsWith('show_') || type.startsWith('station_');
}

function isFoodBuilding(type: string): boolean {
  return type.startsWith('food_') || type.startsWith('drink_') || type.startsWith('snack_') || type.startsWith('cart_');
}

function isShopBuilding(type: string): boolean {
  return (
    type.startsWith('shop_') ||
    type.startsWith('game_') ||
    type === 'arcade_building' ||
    type === 'vr_experience' ||
    type === 'photo_booth' ||
    type === 'caricature' ||
    type === 'face_paint' ||
    type === 'restroom' ||
    type === 'first_aid' ||
    type === 'lockers' ||
    type === 'stroller_rental' ||
    type === 'atm'
  );
}

function findBuildingDestination(
  grid: Tile[][],
  guest: Guest,
  predicate: (type: string) => boolean,
  preferQueue: boolean
): { path: { x: number; y: number }[]; buildingId: string } | null {
  const gridSize = grid.length;
  const buildingTiles: { x: number; y: number; id: string }[] = [];
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const buildingType = grid[y][x].building?.type;
      if (buildingType && predicate(buildingType)) {
        buildingTiles.push({ x, y, id: `${x},${y}` });
      }
    }
  }
  
  if (buildingTiles.length === 0) return null;
  
  const attempts = Math.min(6, buildingTiles.length);
  for (let i = 0; i < attempts; i++) {
    const building = buildingTiles[Math.floor(Math.random() * buildingTiles.length)];
    const neighbors = [
      { x: building.x + 1, y: building.y },
      { x: building.x - 1, y: building.y },
      { x: building.x, y: building.y + 1 },
      { x: building.x, y: building.y - 1 },
    ].filter(tile => tile.x >= 0 && tile.y >= 0 && tile.x < gridSize && tile.y < gridSize);
    
    const queueTiles = neighbors.filter(tile => grid[tile.y][tile.x].queue);
    const pathTiles = neighbors.filter(tile => grid[tile.y][tile.x].path);
    const targetTile = preferQueue ? (queueTiles[0] || pathTiles[0]) : pathTiles[0] || queueTiles[0];
    
    if (!targetTile) continue;
    
    const path = findPath(grid, guest.tileX, guest.tileY, targetTile.x, targetTile.y, 200);
    if (path.length > 0) {
      const trimmedPath = path[0]?.x === guest.tileX && path[0]?.y === guest.tileY
        ? path.slice(1)
        : path;
      return { path: trimmedPath, buildingId: building.id };
    }
  }
  
  return null;
}

function findRideDestination(grid: Tile[][], guest: Guest) {
  return findBuildingDestination(grid, guest, isRideBuilding, true);
}

/**
 * Find path to nearest exit (path tile on grid edge)
 */
function findExitPath(grid: Tile[][], startX: number, startY: number): { x: number; y: number }[] {
  const gridSize = grid.length;
  
  // Find all exit tiles (path tiles on edges)
  const exitTiles: { x: number; y: number }[] = [];
  for (let i = 0; i < gridSize; i++) {
    if (grid[i]?.[0]?.path) exitTiles.push({ x: 0, y: i });
    if (grid[i]?.[gridSize - 1]?.path) exitTiles.push({ x: gridSize - 1, y: i });
    if (grid[0]?.[i]?.path) exitTiles.push({ x: i, y: 0 });
    if (grid[gridSize - 1]?.[i]?.path) exitTiles.push({ x: i, y: gridSize - 1 });
  }
  
  // Remove duplicates
  const uniqueExits = exitTiles.filter((tile, index, self) =>
    index === self.findIndex(t => t.x === tile.x && t.y === tile.y)
  );
  
  if (uniqueExits.length === 0) return [];
  
  // Try to find path to each exit, pick the shortest
  let bestPath: { x: number; y: number }[] = [];
  let bestLength = Infinity;
  
  // Shuffle and try a few exits (for variety)
  const shuffledExits = uniqueExits.sort(() => Math.random() - 0.5).slice(0, 4);
  
  for (const exit of shuffledExits) {
    const path = findPath(grid, startX, startY, exit.x, exit.y, 200);
    if (path.length > 0 && path.length < bestLength) {
      bestPath = path;
      bestLength = path.length;
    }
  }
  
  // Remove starting position if it matches
  if (bestPath.length > 0 && bestPath[0].x === startX && bestPath[0].y === startY) {
    return bestPath.slice(1);
  }
  
  return bestPath;
}

function findFoodDestination(grid: Tile[][], guest: Guest) {
  return findBuildingDestination(grid, guest, isFoodBuilding, false);
}

function findShopDestination(grid: Tile[][], guest: Guest) {
  return findBuildingDestination(grid, guest, isShopBuilding, false);
}

function assignPath(guest: Guest, path: { x: number; y: number }[]) {
  guest.path = path;
  guest.pathIndex = 0;
  if (path.length > 0) {
    guest.targetTileX = path[0].x;
    guest.targetTileY = path[0].y;
    guest.pathIndex = 1;
  }
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
  const previousState = updatedGuest.state;
  
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

  // Decision cooldown
  updatedGuest.decisionCooldown = Math.max(0, updatedGuest.decisionCooldown - deltaTime);

  // Handle queuing/riding
  if (updatedGuest.state === 'queuing' || updatedGuest.state === 'riding') {
    updatedGuest.queueTimer -= deltaTime;
    if (updatedGuest.queueTimer <= 0) {
      if (updatedGuest.state === 'queuing') {
        updatedGuest.state = 'riding';
        updatedGuest.queueTimer = 10 + Math.random() * 20;
        updatedGuest.happiness = Math.min(100, updatedGuest.happiness + 8);
      } else {
        updatedGuest.state = 'walking';
        if (updatedGuest.queueRideId) {
          updatedGuest.ridesRidden.push(updatedGuest.queueRideId);
        }
        updatedGuest.queueRideId = null;
        updatedGuest.targetBuildingId = null;
        updatedGuest.targetBuildingKind = null;
        updatedGuest.queueTimer = 0;
        updatedGuest.nausea = Math.min(100, updatedGuest.nausea + 5 + Math.random() * 5);
      }
    }
    updatedGuest.lastState = previousState;
    return updatedGuest;
  }

  if (updatedGuest.state === 'eating' || updatedGuest.state === 'shopping') {
    updatedGuest.queueTimer -= deltaTime;
    
    // Initialize fields if not set
    if (updatedGuest.approachProgress === undefined) {
      updatedGuest.approachProgress = 0;
    }
    if (updatedGuest.initialActivityTime === undefined || updatedGuest.initialActivityTime <= 0) {
      updatedGuest.initialActivityTime = updatedGuest.queueTimer + 1;
    }
    
    // Proportional walk animation: first 15% of time walking in, last 15% walking out
    const totalTime = updatedGuest.initialActivityTime;
    const elapsed = totalTime - updatedGuest.queueTimer;
    const remaining = updatedGuest.queueTimer;
    const walkFraction = 0.15; // 15% of activity time for walk in/out
    const walkTime = Math.max(3, totalTime * walkFraction); // At least 3 game minutes
    
    if (elapsed < walkTime) {
      // Walking in (0 -> 1)
      updatedGuest.approachProgress = elapsed / walkTime;
    } else if (remaining < walkTime && remaining > 0) {
      // Walking out (1 -> 0)
      updatedGuest.approachProgress = remaining / walkTime;
    } else if (remaining <= 0) {
      // Done - back at path
      updatedGuest.approachProgress = 0;
    } else {
      // Inside building
      updatedGuest.approachProgress = 1;
    }
    
    if (updatedGuest.queueTimer <= 0) {
      if (updatedGuest.state === 'eating') {
        updatedGuest.hunger = Math.max(0, updatedGuest.hunger - 60);
        updatedGuest.thirst = Math.max(0, updatedGuest.thirst - 40);
        updatedGuest.happiness = Math.min(100, updatedGuest.happiness + 6);
      } else {
        updatedGuest.happiness = Math.min(100, updatedGuest.happiness + 4);
      }
      // Transition to exiting_building for walk-out animation
      updatedGuest.state = 'exiting_building';
      updatedGuest.activityStartTime = Date.now(); // Reset for exit animation
      updatedGuest.queueTimer = 0;
      updatedGuest.approachProgress = 1; // Start at building
    }
    updatedGuest.lastState = previousState;
    return updatedGuest;
  }
  
  // Handle exiting_building state (walk-out animation)
  if (updatedGuest.state === 'exiting_building') {
    const exitDuration = 800; // 800ms to walk out
    const elapsed = Date.now() - (updatedGuest.activityStartTime || Date.now());
    
    if (elapsed >= exitDuration) {
      // Exit animation complete, now walking
      updatedGuest.state = 'walking';
      updatedGuest.targetBuildingId = null;
      updatedGuest.targetBuildingKind = null;
      updatedGuest.approachProgress = 0;
      updatedGuest.initialActivityTime = 0;
      updatedGuest.activityStartTime = 0;
    }
    updatedGuest.lastState = previousState;
    return updatedGuest;
  }

  // Handle leaving state - pathfind to nearest exit
  if (updatedGuest.state === 'leaving') {
    // If no path yet, find one to an exit
    if (updatedGuest.path.length === 0 && updatedGuest.progress >= 1) {
      const exitPath = findExitPath(grid, updatedGuest.tileX, updatedGuest.tileY);
      if (exitPath && exitPath.length > 0) {
        assignPath(updatedGuest, exitPath);
      } else {
        // Can't find exit, just wander
        updatedGuest.state = 'walking';
        updatedGuest.decisionCooldown = 30;
      }
    }
    
    // Movement while leaving (same as walking)
    const speed = 0.025; // Slightly faster when leaving
    updatedGuest.progress += speed;
    
    if (updatedGuest.progress >= 1) {
      updatedGuest.tileX = updatedGuest.targetTileX;
      updatedGuest.tileY = updatedGuest.targetTileY;
      updatedGuest.progress = 0;
      
      // Check if reached exit (edge tile)
      const gridSize = grid.length;
      const atEdge = updatedGuest.tileX === 0 || updatedGuest.tileX === gridSize - 1 ||
                     updatedGuest.tileY === 0 || updatedGuest.tileY === gridSize - 1;
      
      if (atEdge) {
        // Mark as exited - will be filtered out
        updatedGuest.state = 'exited' as GuestState;
        updatedGuest.lastState = previousState;
        return updatedGuest;
      }
      
      // Continue along path
      if (updatedGuest.path.length > 0 && updatedGuest.pathIndex < updatedGuest.path.length) {
        const next = updatedGuest.path[updatedGuest.pathIndex];
        updatedGuest.targetTileX = next.x;
        updatedGuest.targetTileY = next.y;
        updatedGuest.pathIndex++;
      }
    }
    
    updatedGuest.lastState = previousState;
    return updatedGuest;
  }

  // Unhappy guests may decide to leave (checked periodically)
  if (updatedGuest.state === 'walking' && updatedGuest.decisionCooldown <= 0) {
    // Very unhappy guests (happiness < 30) have a chance to leave
    // Also guests who have been in the park a long time with low happiness
    const unhappinessLevel = 100 - updatedGuest.happiness;
    const timeInParkMinutes = updatedGuest.timeInPark;
    
    // Base leave chance increases with unhappiness and time
    let leaveChance = 0;
    if (updatedGuest.happiness < 30) {
      leaveChance = 0.02; // 2% base chance when very unhappy
    } else if (updatedGuest.happiness < 50 && timeInParkMinutes > 120) {
      leaveChance = 0.005; // 0.5% if moderately unhappy and been here a while
    }
    
    // Increase chance if multiple needs are critical
    const criticalNeeds = [
      updatedGuest.hunger > 80,
      updatedGuest.thirst > 80,
      updatedGuest.bathroom > 90,
      updatedGuest.energy < 20,
      updatedGuest.nausea > 70,
    ].filter(Boolean).length;
    
    leaveChance += criticalNeeds * 0.01;
    
    if (Math.random() < leaveChance) {
      updatedGuest.state = 'leaving';
      updatedGuest.thoughts = [...updatedGuest.thoughts.slice(-4), 'want_to_go_home' as const];
      updatedGuest.path = [];
      updatedGuest.pathIndex = 0;
      updatedGuest.targetBuildingId = null;
      updatedGuest.targetBuildingKind = null;
      updatedGuest.lastState = previousState;
      return updatedGuest;
    }
  }

  // Seek rides if idle
  if ((updatedGuest.state === 'walking' || updatedGuest.state === 'entering') && updatedGuest.path.length === 0 && !updatedGuest.queueRideId && !updatedGuest.targetBuildingId) {
    if (updatedGuest.decisionCooldown <= 0) {
      let destination: { path: { x: number; y: number }[]; buildingId: string } | null = null;
      let targetKind: Guest['targetBuildingKind'] = null;
      
      // Random activity selection with weighted probabilities
      const roll = Math.random();
      const isHungry = updatedGuest.hunger > 50 || updatedGuest.thirst > 50;
      
      if (isHungry) {
        // When hungry, 70% food, 30% shop (browsing while looking for food)
        if (roll < 0.7) {
          destination = findFoodDestination(grid, updatedGuest);
          targetKind = 'food';
        } else {
          destination = findShopDestination(grid, updatedGuest);
          targetKind = 'shop';
        }
      } else {
        // When not hungry: 40% shop, 40% ride, 20% food (snack)
        if (roll < 0.4) {
          destination = findShopDestination(grid, updatedGuest);
          targetKind = 'shop';
        } else if (roll < 0.8) {
          destination = findRideDestination(grid, updatedGuest);
          targetKind = 'ride';
        } else {
          destination = findFoodDestination(grid, updatedGuest);
          targetKind = 'food';
        }
      }
      
      // If first choice not found, try alternatives
      if (!destination && targetKind !== 'ride') {
        destination = findRideDestination(grid, updatedGuest);
        targetKind = 'ride';
      }
      if (!destination && targetKind !== 'shop') {
        destination = findShopDestination(grid, updatedGuest);
        targetKind = 'shop';
      }
      if (!destination && targetKind !== 'food') {
        destination = findFoodDestination(grid, updatedGuest);
        targetKind = 'food';
      }
      
      if (destination) {
        if (targetKind === 'ride') {
          updatedGuest.queueRideId = destination.buildingId;
        }
        updatedGuest.targetBuildingId = destination.buildingId;
        updatedGuest.targetBuildingKind = targetKind;
        updatedGuest.state = 'walking';
        updatedGuest.decisionCooldown = 60 + Math.random() * 90;
        assignPath(updatedGuest, destination.path);
      } else {
        updatedGuest.decisionCooldown = 30 + Math.random() * 60;
      }
    }
  }
  
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
        // Path complete
        if (updatedGuest.targetBuildingKind) {
          if (updatedGuest.targetBuildingKind === 'ride') {
            updatedGuest.state = 'queuing';
            updatedGuest.queueTimer = 30 + Math.random() * 60;
            updatedGuest.queuePosition = 0;
            updatedGuest.path = [];
            updatedGuest.pathIndex = 0;
            updatedGuest.targetTileX = updatedGuest.tileX;
            updatedGuest.targetTileY = updatedGuest.tileY;
            updatedGuest.lastState = previousState;
            return updatedGuest;
          }
          if (updatedGuest.targetBuildingKind === 'food') {
            updatedGuest.state = 'eating';
            const activityTime = 8 + Math.random() * 12;
            updatedGuest.queueTimer = activityTime;
            updatedGuest.initialActivityTime = activityTime;
            updatedGuest.approachProgress = 0;
            updatedGuest.activityStartTime = Date.now();
            updatedGuest.path = [];
            updatedGuest.pathIndex = 0;
            updatedGuest.lastState = previousState;
            return updatedGuest;
          }
          if (updatedGuest.targetBuildingKind === 'shop') {
            updatedGuest.state = 'shopping';
            const activityTime = 6 + Math.random() * 10;
            updatedGuest.queueTimer = activityTime;
            updatedGuest.initialActivityTime = activityTime;
            updatedGuest.approachProgress = 0;
            updatedGuest.activityStartTime = Date.now();
            updatedGuest.path = [];
            updatedGuest.pathIndex = 0;
            updatedGuest.lastState = previousState;
            return updatedGuest;
          }
        }
        
        // Wander on paths
        updatedGuest.state = 'walking';
        updatedGuest.decisionCooldown = Math.min(updatedGuest.decisionCooldown, 0);
        updatedGuest.path = [];
        updatedGuest.pathIndex = 0;
        
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
  
  updatedGuest.lastState = previousState;
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
  const maxGuests = 50000;
  if (currentGuests.length >= maxGuests) return [];
  
  const newGuests: Guest[] = [];
  
  if (Math.random() < spawnChance) {
    // Find entrance tiles (look for path tiles at grid edges - these have entrance gates)
    const entranceTiles: { x: number; y: number }[] = [];
    const gridSize = grid.length;
    
    // Check all four edges for path tiles - these are the entrance gate locations
    for (let i = 0; i < gridSize; i++) {
      // North edge (x=0) - check grid[y][0] for all y
      if (grid[i]?.[0]?.path) entranceTiles.push({ x: 0, y: i });
      // South edge (x=gridSize-1) - check grid[y][gridSize-1] for all y
      if (grid[i]?.[gridSize - 1]?.path) entranceTiles.push({ x: gridSize - 1, y: i });
      // East edge (y=0) - check grid[0][x] for all x
      if (grid[0]?.[i]?.path) entranceTiles.push({ x: i, y: 0 });
      // West edge (y=gridSize-1) - check grid[gridSize-1][x] for all x
      if (grid[gridSize - 1]?.[i]?.path) entranceTiles.push({ x: i, y: gridSize - 1 });
    }
    
    // Only spawn at edge entrance tiles (with gates)
    // Remove duplicates (corner tiles appear twice)
    const uniqueEntrances = entranceTiles.filter((tile, index, self) =>
      index === self.findIndex(t => t.x === tile.x && t.y === tile.y)
    );
    
    if (uniqueEntrances.length > 0) {
      const entrance = uniqueEntrances[Math.floor(Math.random() * uniqueEntrances.length)];
      newGuests.push(createGuest(entrance.x, entrance.y, gridSize));
    }
  }
  
  return newGuests;
}
