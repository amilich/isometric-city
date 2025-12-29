/**
 * Rise of Nations - Resource System Types
 * 
 * Resources are the core economy of the game.
 * Different resources are gathered from different sources.
 */

export type ResourceType = 
  | 'food'      // From farms, fishing
  | 'wood'      // From lumber mills, forests  
  | 'metal'     // From mines
  | 'gold'      // From markets, trade
  | 'knowledge' // From libraries, universities
  | 'oil';      // From oil wells (industrial+ only)

export interface Resources {
  food: number;
  wood: number;
  metal: number;
  gold: number;
  knowledge: number;
  oil: number;
}

export interface ResourceRates {
  food: number;
  wood: number;
  metal: number;
  gold: number;
  knowledge: number;
  oil: number;
}

export const INITIAL_RESOURCES: Resources = {
  food: 200,
  wood: 200,
  metal: 0,
  gold: 150,
  knowledge: 0,
  oil: 0,
};

// Resource gathering rates per worker per tick
export const BASE_GATHER_RATES: Record<ResourceType, number> = {
  food: 0.5,
  wood: 0.4,
  metal: 0.3,
  gold: 0.2,
  knowledge: 0.15,
  oil: 0.25,
};

// Storage limits (can be increased with buildings)
export const BASE_STORAGE_LIMITS: Resources = {
  food: 500,
  wood: 500,
  metal: 300,
  gold: 1000,
  knowledge: 500,
  oil: 200,
};

// Resource display information (using text symbols instead of emojis)
export const RESOURCE_INFO: Record<ResourceType, { name: string; icon: string; color: string }> = {
  food: { name: 'Food', icon: 'F', color: '#22c55e' },
  wood: { name: 'Wood', icon: 'W', color: '#a16207' },
  metal: { name: 'Metal', icon: 'M', color: '#6b7280' },
  gold: { name: 'Gold', icon: '$', color: '#eab308' },
  knowledge: { name: 'Knowledge', icon: 'K', color: '#3b82f6' },
  oil: { name: 'Oil', icon: 'O', color: '#1f2937' },
};

// Oil spawn configuration
export const OIL_DEPOSIT_CHANCE = 0.02; // Chance per grass tile to have oil deposit
export const OIL_DEPOSIT_MIN_DISTANCE = 5; // Minimum distance between deposits
