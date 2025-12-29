/**
 * Game type definitions for IsoCity
 * 
 * BACKWARD COMPATIBILITY FILE
 * 
 * This file re-exports all IsoCity types from their new canonical locations
 * in @/games/isocity/types for backward compatibility with existing imports.
 * 
 * New code should import directly from:
 *   import { GameState, Building } from '@/games/isocity/types';
 * 
 * Existing code using this file will continue to work:
 *   import { GameState, Building } from '@/types/game';
 */

// Re-export all types from the IsoCity module
export * from '@/games/isocity/types';
