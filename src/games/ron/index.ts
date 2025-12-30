/**
 * Rise of Nations - Game Module
 * 
 * A Rise of Nations-style RTS game built on the isometric engine.
 */

// Types
export * from './types';

// Context
export { RoNProvider, useRoN } from './context/RoNContext';

// Components
export { RoNGame, RoNCanvas, RoNSidebar, RoNMiniMap, AIMessagePanel } from './components';

// Hooks
export { useAgenticAI } from './hooks/useAgenticAI';
export type { AgenticAIConfig, AgenticAIMessage, UseAgenticAIResult } from './hooks/useAgenticAI';

// Lib
export { simulateRoNTick } from './lib/simulation';
export { AGE_SPRITE_PACKS, BUILDING_SPRITE_MAP, PLAYER_COLORS, TILE_WIDTH, TILE_HEIGHT } from './lib/renderConfig';

// AI Tool Executors (for API routes)
export { 
  generateCondensedGameState,
  executeBuildBuilding,
  executeCreateUnit,
  executeSendUnits,
  executeAdvanceAge,
  executeReassignWorkerToResource,
} from './lib/aiTools';
export type { CondensedGameState, ToolResult } from './lib/aiTools';
