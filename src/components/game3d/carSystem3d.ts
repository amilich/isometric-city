// Lightweight traffic agents for the 3D view.
//
// The isometric traffic system is coupled to canvas drawing, so the 3D view runs
// its own agents on top of the same grid helpers (road lookup + turn selection).
// Positions are produced in world space so the renderer can draw them as boxes.

import { Tile } from '@/types/game';
import { CarDirection } from '@/components/game/types';
import { DIRECTION_META } from '@/components/game/constants';
import { isRoadTile, pickNextDirection, getDirectionOptions } from '@/components/game/utils';

export interface Car3D {
  gridX: number;
  gridY: number;
  direction: CarDirection;
  /** 0..1 progress across the current tile. */
  progress: number;
  speed: number;
  color: [number, number, number];
  length: number;
  width: number;
  height: number;
  lane: number;
}

const CAR_COLORS: [number, number, number][] = [
  [0.85, 0.24, 0.22],
  [0.95, 0.78, 0.2],
  [0.18, 0.62, 0.45],
  [0.25, 0.45, 0.8],
  [0.9, 0.9, 0.92],
  [0.15, 0.16, 0.2],
  [0.55, 0.35, 0.75],
];

/** Grid step for each direction, in (x, y) tile units. */
const step = (direction: CarDirection): { x: number; y: number } => {
  return DIRECTION_META[direction].step;
};

export class CarSystem3D {
  cars: Car3D[] = [];
  private spawnTimer = 0;
  private roadTiles: { x: number; y: number }[] = [];

  /** Recompute the drivable tile list; call when the grid changes. */
  refreshRoads(grid: Tile[][], gridSize: number): void {
    const tiles: { x: number; y: number }[] = [];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (isRoadTile(grid, gridSize, x, y)) tiles.push({ x, y });
      }
    }
    this.roadTiles = tiles;
    // Drop agents that are no longer on a road (bulldozed underneath them)
    this.cars = this.cars.filter((car) => isRoadTile(grid, gridSize, car.gridX, car.gridY));
  }

  clear(): void {
    this.cars = [];
  }

  private spawn(grid: Tile[][], gridSize: number): void {
    if (this.roadTiles.length === 0) return;
    const tile = this.roadTiles[Math.floor(Math.random() * this.roadTiles.length)];
    const options = getDirectionOptions(grid, gridSize, tile.x, tile.y);
    if (options.length === 0) return;
    const direction = options[Math.floor(Math.random() * options.length)];
    const isTruck = Math.random() < 0.18;
    this.cars.push({
      gridX: tile.x,
      gridY: tile.y,
      direction,
      progress: Math.random(),
      speed: (isTruck ? 0.7 : 1) * (1.6 + Math.random() * 1.2),
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
      length: isTruck ? 0.34 : 0.22,
      width: isTruck ? 0.15 : 0.12,
      height: isTruck ? 0.16 : 0.1,
      lane: 0.17,
    });
  }

  update(dt: number, grid: Tile[][], gridSize: number, maxCars: number): void {
    const target = Math.min(maxCars, Math.floor(this.roadTiles.length * 0.35));

    this.spawnTimer -= dt;
    if (this.cars.length < target && this.spawnTimer <= 0) {
      this.spawnTimer = 0.08;
      this.spawn(grid, gridSize);
    }

    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      car.progress += car.speed * dt;
      while (car.progress >= 1) {
        car.progress -= 1;
        const delta = step(car.direction);
        const nextX = car.gridX + delta.x;
        const nextY = car.gridY + delta.y;
        if (!isRoadTile(grid, gridSize, nextX, nextY)) {
          this.cars.splice(i, 1);
          break;
        }
        car.gridX = nextX;
        car.gridY = nextY;
        const next = pickNextDirection(car.direction, grid, gridSize, car.gridX, car.gridY);
        if (!next) {
          this.cars.splice(i, 1);
          break;
        }
        car.direction = next;
      }
    }
  }

  /**
   * Write instance data for the renderer.
   * Layout per instance: offset(3) scale(3) color(3) yaw(1) = 10 floats.
   */
  writeInstances(out: Float32Array, deckHeightAt: (x: number, y: number) => number): number {
    let count = 0;
    for (const car of this.cars) {
      const offset = count * 10;
      if (offset + 10 > out.length) break;
      const delta = step(car.direction);
      // World axes: x follows grid x, z follows grid y, y is up
      const dirX = delta.x;
      const dirZ = delta.y;
      const rightX = -dirZ;
      const rightZ = dirX;
      const centerX = car.gridX + 0.5 + dirX * (car.progress - 0.5) + rightX * car.lane;
      const centerZ = car.gridY + 0.5 + dirZ * (car.progress - 0.5) + rightZ * car.lane;
      const baseY = deckHeightAt(car.gridX, car.gridY);

      out[offset] = centerX;
      out[offset + 1] = baseY + car.height / 2;
      out[offset + 2] = centerZ;
      out[offset + 3] = car.length;
      out[offset + 4] = car.height;
      out[offset + 5] = car.width;
      out[offset + 6] = car.color[0];
      out[offset + 7] = car.color[1];
      out[offset + 8] = car.color[2];
      out[offset + 9] = Math.atan2(dirZ, dirX);
      count++;
    }
    return count;
  }
}
