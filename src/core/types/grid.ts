/**
 * Core grid types shared across all games
 */

/** A position in grid/tile coordinates */
export interface GridPosition {
  x: number;
  y: number;
}

/** A position in screen/canvas coordinates */
export interface ScreenPosition {
  x: number;
  y: number;
}

/** Rectangular bounds in grid coordinates */
export interface GridBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Cardinal directions for movement and orientation */
export type CardinalDirection = 'north' | 'east' | 'south' | 'west';

/** Direction metadata for calculating movement vectors */
export interface DirectionMeta {
  step: { x: number; y: number };
  vec: { dx: number; dy: number };
  angle: number;
  normal: { nx: number; ny: number };
}

/** Base tile interface that game-specific tiles extend */
export interface BaseTile {
  x: number;
  y: number;
}

/** Base building interface that game-specific buildings extend */
export interface BaseBuilding {
  type: string;
}

/** A 2D grid of tiles */
export type Grid<T extends BaseTile> = T[][];

/** Path represented as a sequence of grid positions */
export type GridPath = GridPosition[];
