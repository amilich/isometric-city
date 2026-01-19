import { CoasterGameState, Staff } from '@/games/coaster/types';
import { CardinalDirection } from '@/core/types';

const TARGET_UPDATE_INTERVAL = 8;

const directionFromStep = (from: { x: number; y: number }, to: { x: number; y: number }): CardinalDirection => {
  if (to.x < from.x) return 'north';
  if (to.x > from.x) return 'south';
  if (to.y < from.y) return 'east';
  return 'west';
};

const isPathTile = (state: CoasterGameState, x: number, y: number) => {
  if (x < 0 || y < 0 || x >= state.gridSize || y >= state.gridSize) return false;
  return Boolean(state.grid[y][x].path);
};

const findPath = (
  state: CoasterGameState,
  start: { x: number; y: number },
  end: { x: number; y: number }
): { x: number; y: number }[] | null => {
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [
    { x: start.x, y: start.y, path: [{ x: start.x, y: start.y }] },
  ];
  const visited = new Set<string>([`${start.x},${start.y}`]);

  const directions = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];

  while (queue.length) {
    const current = queue.shift()!;
    if (current.x === end.x && current.y === end.y) {
      return current.path;
    }

    for (const dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= state.gridSize || ny >= state.gridSize) continue;
      if (visited.has(key)) continue;
      if (!isPathTile(state, nx, ny)) continue;
      visited.add(key);
      queue.push({
        x: nx,
        y: ny,
        path: [...current.path, { x: nx, y: ny }],
      });
    }
  }

  return null;
};

const pickRandomPathTile = (state: CoasterGameState) => {
  const pathTiles = state.grid.flat().filter((tile) => tile.path);
  if (!pathTiles.length) return null;
  return pathTiles[Math.floor(Math.random() * pathTiles.length)];
};

export function updateStaff(state: CoasterGameState, deltaSeconds: number): CoasterGameState {
  const staff = state.staff.map((member) => {
    let path = member.path;
    let pathIndex = member.pathIndex;
    let tileX = member.tileX;
    let tileY = member.tileY;
    let progress = member.progress;
    let direction = member.direction;

    if (!path.length || pathIndex >= path.length - 1 || Math.random() < deltaSeconds / TARGET_UPDATE_INTERVAL) {
      const target = pickRandomPathTile(state);
      if (target) {
        const newPath = findPath(state, { x: tileX, y: tileY }, { x: target.x, y: target.y });
        if (newPath) {
          path = newPath;
          pathIndex = 0;
        }
      }
    }

    if (path.length > 1) {
      const nextIndex = Math.min(pathIndex + 1, path.length - 1);
      const nextTile = path[nextIndex];
      progress += (member.speed || 0.45) * deltaSeconds;
      if (progress >= 1) {
        progress = 0;
        tileX = nextTile.x;
        tileY = nextTile.y;
        pathIndex = nextIndex;
      }
      direction = directionFromStep({ x: tileX, y: tileY }, nextTile);
    }

    return {
      ...member,
      tileX,
      tileY,
      progress,
      direction,
      path,
      pathIndex,
    };
  });

  return {
    ...state,
    staff,
  };
}
