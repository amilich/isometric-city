// Coaster multiplayer types for co-op gameplay

import { Tool, GameState } from '@/games/coaster/types';

// Base action properties
interface BaseAction {
  timestamp: number;
  playerId: string;
}

// Coaster game actions that get synced via Supabase Realtime
export type CoasterGameAction =
  | (BaseAction & { type: 'place'; x: number; y: number; tool: Tool })
  | (BaseAction & { type: 'placeBatch'; placements: Array<{ x: number; y: number; tool: Tool }> })
  | (BaseAction & { type: 'bulldoze'; x: number; y: number })
  | (BaseAction & { type: 'setSpeed'; speed: 0 | 1 | 2 | 3 })
  | (BaseAction & { type: 'setParkName'; name: string })
  | (BaseAction & { type: 'setTicketPrice'; price: number })
  | (BaseAction & { type: 'fullState'; state: GameState })
  | (BaseAction & { type: 'tick'; tickData: CoasterTickData });

// Action input types (without timestamp and playerId, which are added automatically)
export type CoasterPlaceAction = { type: 'place'; x: number; y: number; tool: Tool };
export type CoasterPlaceBatchAction = { type: 'placeBatch'; placements: Array<{ x: number; y: number; tool: Tool }> };
export type CoasterBulldozeAction = { type: 'bulldoze'; x: number; y: number };
export type CoasterSetSpeedAction = { type: 'setSpeed'; speed: 0 | 1 | 2 | 3 };
export type CoasterSetParkNameAction = { type: 'setParkName'; name: string };
export type CoasterSetTicketPriceAction = { type: 'setTicketPrice'; price: number };
export type CoasterFullStateAction = { type: 'fullState'; state: GameState };
export type CoasterTickAction = { type: 'tick'; tickData: CoasterTickData };

export type CoasterGameActionInput = 
  | CoasterPlaceAction
  | CoasterPlaceBatchAction
  | CoasterBulldozeAction
  | CoasterSetSpeedAction
  | CoasterSetParkNameAction
  | CoasterSetTicketPriceAction
  | CoasterFullStateAction
  | CoasterTickAction;

// Minimal tick data sent from host to guests
export interface CoasterTickData {
  year: number;
  month: number;
  day: number;
  hour: number;
  tick: number;
  stats: GameState['stats'];
  // Only send changed tiles to minimize bandwidth
  changedTiles?: Array<{
    x: number;
    y: number;
    tile: GameState['grid'][0][0];
  }>;
}

// Re-export common types from the main multiplayer types
export type {
  ConnectionState,
  PlayerRole,
  Player,
  RoomData,
  AwarenessState,
} from './types';

export {
  generatePlayerName,
  generatePlayerColor,
  generateRoomCode,
  generatePlayerId,
} from './types';
