import { msg } from 'gt-next';
import { AgeConfig, AgeId, ResourcePool } from './types';

export const BASE_RESOURCES: ResourcePool = {
  food: 200,
  wood: 200,
  metal: 100,
  oil: 0,
  wealth: 200,
  knowledge: 50,
  population: 0,
  popCap: 10,
};

export const AGE_CONFIGS: AgeConfig[] = [
  {
    id: 'classics',
    label: msg('Classical Age'),
    nextCost: { food: 200, wealth: 200, knowledge: 80 },
    minDurationSeconds: 240, // ~4 minutes
  },
  {
    id: 'medeival',
    label: msg('Medieval Age'),
    nextCost: { food: 350, wealth: 350, knowledge: 160, metal: 120 },
    minDurationSeconds: 300, // ~5 minutes
  },
  {
    id: 'enlightenment',
    label: msg('Enlightenment Age'),
    nextCost: { food: 500, wealth: 500, knowledge: 260, metal: 220 },
    minDurationSeconds: 360, // ~6 minutes
  },
  {
    id: 'industrial',
    label: msg('Industrial Age'),
    nextCost: { food: 700, wealth: 750, knowledge: 380, metal: 380, oil: 60 },
    minDurationSeconds: 420, // ~7 minutes
  },
  {
    id: 'modern',
    label: msg('Modern Age'),
    nextCost: {},
    minDurationSeconds: 0,
  },
];

// Speed multipliers map to speed slider (0 pause, 1=normal)
export const SPEED_MULTIPLIERS: Record<0 | 1 | 2 | 3, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 4,
};

export const GATHER_RATES = {
  citizen: {
    forest: 0.8, // wood/sec
    mine: 0.6, // metal/sec
    oil: 0.35, // oil/sec
    fertile: 1.2, // food/sec
    rare: 0.25, // wealth/sec
  },
};

export const POP_COST: Record<string, number> = {
  citizen: 1,
  infantry: 1,
  ranged: 1,
  vehicle: 2,
  siege: 3,
  air: 3,
};

export const DIFFICULTY_GATHER_MULT: Record<'easy' | 'medium' | 'hard', number> = {
  easy: 0.85,
  medium: 1.0,
  hard: 1.35,
};

export const DIFFICULTY_START_BONUS: Record<'easy' | 'medium' | 'hard', Partial<ResourcePool>> = {
  easy: { wealth: -100, food: -100, wood: -100, metal: -50 },
  medium: {},
  hard: { wealth: 250, food: 250, wood: 250, metal: 150, knowledge: 80 },
};

export const UNIT_COSTS = {
  citizen: { food: 50, wealth: 30 },
  infantry: { food: 60, metal: 30, wealth: 30 },
  ranged: { food: 70, metal: 40, wealth: 40 },
  vehicle: { metal: 120, wealth: 80 },
  siege: { metal: 160, wealth: 120 },
  air: { metal: 180, wealth: 160, oil: 80 },
};

export const BUILDING_COSTS = {
  city_center: { wealth: 400, wood: 200, metal: 120 },
  farm: { wood: 60 },
  lumber_camp: { wood: 80 },
  mine: { wood: 80, metal: 30 },
  oil_rig: { wood: 80, metal: 120, wealth: 120, oil: 0 },
  market: { wood: 120, wealth: 120 },
  library: { wood: 120, wealth: 120 },
  university: { wood: 180, wealth: 220, knowledge: 80 },
  house: { wood: 50, wealth: 20 },
  barracks: { wood: 140, wealth: 120 },
  factory: { wood: 180, metal: 200, wealth: 160 },
  siege_factory: { wood: 200, metal: 260, wealth: 200 },
  airbase: { wood: 220, metal: 260, wealth: 280, oil: 80 },
  fort: { wood: 220, metal: 240, wealth: 200 },
  tower: { wood: 90, metal: 70, wealth: 60 },
};

export const BUILDING_HP: Record<string, number> = {
  city_center: 3200,
  farm: 400,
  lumber_camp: 500,
  mine: 650,
  oil_rig: 750,
  market: 600,
  library: 550,
  university: 800,
  house: 220,
  barracks: 900,
  factory: 1100,
  siege_factory: 1100,
  airbase: 1400,
  fort: 1600,
  tower: 650,
};

export const BUILDING_POP_BONUS: Record<string, number> = {
  city_center: 10,
  house: 5,
};

export const BUILDING_AGE_REQ: Record<string, AgeId> = {
  city_center: 'classics',
  farm: 'classics',
  lumber_camp: 'classics',
  mine: 'classics',
  oil_rig: 'industrial',
  market: 'classics',
  library: 'classics',
  university: 'enlightenment',
  house: 'classics',
  barracks: 'classics',
  factory: 'enlightenment',
  siege_factory: 'industrial',
  airbase: 'modern',
  fort: 'medeival',
  tower: 'classics',
};

export const UNIT_AGE_REQ: Record<string, AgeId> = {
  citizen: 'classics',
  infantry: 'classics',
  ranged: 'classics',
  vehicle: 'enlightenment',
  siege: 'industrial',
  air: 'modern',
};
