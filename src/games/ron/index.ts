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
export { RoNGame, RoNCanvas, RoNSidebar, RoNMiniMap } from './components';

// Lib
export { simulateRoNTick } from './lib/simulation';
export { AGE_SPRITE_PACKS, BUILDING_SPRITE_MAP, PLAYER_COLORS, TILE_WIDTH, TILE_HEIGHT } from './lib/renderConfig';
