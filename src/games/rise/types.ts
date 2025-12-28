import { GridPosition } from '@/core/types';

export type AgeId = 'classics' | 'medeival' | 'enlightenment' | 'industrial' | 'modern';

export const AGE_ORDER: AgeId[] = ['classics', 'medeival', 'enlightenment', 'industrial', 'modern'];

export type ResourceType =
  | 'food'
  | 'wood'
  | 'metal'
  | 'oil'
  | 'wealth'
  | 'knowledge'
  | 'population'
  | 'popCap';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ResourcePool {
  food: number;
  wood: number;
  metal: number;
  oil: number;
  wealth: number;
  knowledge: number;
  population: number;
  popCap: number;
}

export type TerrainType = 'grass' | 'water' | 'mountain' | 'forest';

export type ResourceNodeType = 'forest' | 'mine' | 'oil' | 'fertile' | 'rare';

export interface ResourceNode {
  type: ResourceNodeType;
  amount: number;
}

export type RiseBuildingType =
  | 'city_center'
  | 'farm'
  | 'lumber_camp'
  | 'mine'
  | 'oil_rig'
  | 'market'
  | 'library'
  | 'university'
  | 'house'
  | 'barracks'
  | 'factory'
  | 'siege_factory'
  | 'airbase'
  | 'fort'
  | 'tower';

export interface RiseBuilding {
  id: string;
  type: RiseBuildingType;
  ownerId: string;
  hp: number;
  maxHp: number;
  tile: GridPosition;
}

export type RiseUnitType =
  | 'citizen'
  | 'infantry'
  | 'ranged'
  | 'vehicle'
  | 'siege'
  | 'air';

export type UnitOrder =
  | { kind: 'idle' }
  | { kind: 'move'; target: GridPosition; path?: GridPosition[] }
  | { kind: 'gather'; target: GridPosition; resource: ResourceNodeType; path?: GridPosition[] }
  | { kind: 'attack'; targetUnitId?: string; targetBuildingId?: string; target: GridPosition; path?: GridPosition[] };

export interface RiseUnit {
  id: string;
  type: RiseUnitType;
  ownerId: string;
  position: { x: number; y: number }; // world coords in grid units (float for interpolation)
  hp: number;
  maxHp: number;
  order: UnitOrder;
  pathIndex?: number;
  selected?: boolean;
  speed: number;
  attack?: {
    damage: number;
    range: number;
    cooldown: number;
    cooldownRemaining: number;
  };
}

export interface RiseTile {
  x: number;
  y: number;
  terrain: TerrainType;
  node?: ResourceNode;
  buildingId?: string;
  ownerId?: string;
}

export interface PlayerController {
  difficulty?: Difficulty;
  isAI: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  age: AgeId;
  ageStartSeconds: number;
  resources: ResourcePool;
  controller: PlayerController;
}

export interface AgeConfig {
  id: AgeId;
  label: string;
  nextCost: Partial<ResourcePool>;
  minDurationSeconds: number;
}

export interface RiseGameState {
  id: string;
  tick: number;
  elapsedSeconds: number;
  speed: 0 | 1 | 2 | 3;
  gridSize: number;
  tiles: RiseTile[][];
  players: PlayerState[];
  units: RiseUnit[];
  buildings: RiseBuilding[];
  selectedUnitIds: Set<string>;
  localPlayerId: string;
  aiEnabled: boolean;
  gameStatus: 'playing' | 'won' | 'lost';
}
