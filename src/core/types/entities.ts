/**
 * Core entity types shared across all games
 */

import { GridPosition, CardinalDirection } from './grid';

/** Base interface for any entity */
export interface BaseEntity {
  id: number;
}

/** Entity that moves on grid tiles */
export interface GridEntity extends BaseEntity {
  tileX: number;
  tileY: number;
  direction: CardinalDirection;
  progress: number;
  speed: number;
}

/** Entity that moves freely in screen space */
export interface FreeEntity extends BaseEntity {
  x: number;
  y: number;
  angle: number;
  speed: number;
}

/** Entity that follows a predefined path */
export interface PathFollowingEntity extends GridEntity {
  path: GridPosition[];
  pathIndex: number;
}

/** Entity with age/lifetime tracking */
export interface MortalEntity {
  age: number;
  maxAge: number;
}

/** Base particle for effects */
export interface BaseParticle {
  x: number;
  y: number;
  age: number;
  opacity: number;
}

/** Particle with velocity */
export interface MovingParticle extends BaseParticle {
  vx: number;
  vy: number;
  maxAge: number;
  size: number;
}
