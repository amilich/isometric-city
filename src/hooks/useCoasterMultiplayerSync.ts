'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useCoasterMultiplayerOptional } from '@/context/CoasterMultiplayerContext';
import { useCoaster } from '@/context/CoasterContext';
import { CoasterGameAction, CoasterGameActionInput } from '@/lib/multiplayer/coasterTypes';
import { Tool, GameState } from '@/games/coaster/types';
import { SavedParkMeta, buildSavedParkMeta, readSavedParksIndex, writeSavedParksIndex } from '@/games/coaster/saveUtils';

// Batch placement buffer for reducing message count during drags
const BATCH_FLUSH_INTERVAL = 100; // ms - flush every 100ms during drag
const BATCH_MAX_SIZE = 100; // Max placements before force flush

// Storage key for saved parks index
const COASTER_SAVED_PARKS_INDEX_KEY = 'coaster-saved-parks-index';

// Update the saved parks index with the current multiplayer park state
function updateSavedParksIndex(state: GameState, roomCode: string): void {
  if (typeof window === 'undefined') return;
  try {
    // Load existing parks
    const parks: SavedParkMeta[] = readSavedParksIndex();
    
    // Create updated park meta
    const parkMeta = buildSavedParkMeta(state);
    // Add room code (not in the standard meta, so we extend it)
    const parkMetaWithRoom = {
      ...parkMeta,
      roomCode: roomCode,
    };
    
    // Find and update or add
    const existingIndex = parks.findIndex(p => (p as unknown as { roomCode?: string }).roomCode === roomCode);
    if (existingIndex >= 0) {
      parks[existingIndex] = parkMetaWithRoom;
    } else {
      parks.unshift(parkMetaWithRoom);
    }
    
    // Keep only the last 20 parks and save
    writeSavedParksIndex(parks.slice(0, 20));
  } catch (e) {
    console.error('Failed to update saved parks index:', e);
  }
}

/**
 * Hook to sync coaster game actions with multiplayer.
 * 
 * When in multiplayer mode:
 * - Local actions are broadcast to peers
 * - Remote actions are applied to local state
 */
export function useCoasterMultiplayerSync() {
  const multiplayer = useCoasterMultiplayerOptional();
  const game = useCoaster();
  const lastActionRef = useRef<string | null>(null);
  const initialStateLoadedRef = useRef(false);
  
  // Batching for placements - use refs to avoid stale closures
  const placementBufferRef = useRef<Array<{ x: number; y: number; tool: Tool }>>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const multiplayerRef = useRef(multiplayer);
  
  // Keep multiplayer ref updated
  useEffect(() => {
    multiplayerRef.current = multiplayer;
  }, [multiplayer]);

  // Load initial state when joining a room (received from other players)
  // This can happen even if we already loaded from cache - network state takes priority
  const lastInitialStateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!multiplayer || !multiplayer.initialState) return;
    
    // Only load if this is a new state (prevent duplicate loads of same state)
    const stateKey = JSON.stringify(multiplayer.initialState.tick || 0);
    if (lastInitialStateRef.current === stateKey && initialStateLoadedRef.current) return;
    
    console.log('[useCoasterMultiplayerSync] Received initial state from network, loading...');
    
    // Use loadState to load the received game state
    const stateString = JSON.stringify(multiplayer.initialState);
    const success = game.loadState(stateString);
    
    if (success) {
      initialStateLoadedRef.current = true;
      lastInitialStateRef.current = stateKey;
    }
  }, [multiplayer?.initialState, game]);

  // Apply a remote action to the local game state
  const applyRemoteAction = useCallback((action: CoasterGameAction) => {
    // Guard against null/undefined actions (can happen with malformed broadcasts)
    if (!action || !action.type) {
      console.warn('[useCoasterMultiplayerSync] Received invalid action:', action);
      return;
    }
    
    switch (action.type) {
      case 'place':
        // Apply placement
        game.setTool(action.tool);
        game.placeAtTile(action.x, action.y);
        break;
        
      case 'placeBatch':
        // Apply multiple placements from a single message (e.g., path drag)
        for (const placement of action.placements) {
          game.setTool(placement.tool);
          game.placeAtTile(placement.x, placement.y);
        }
        break;
        
      case 'bulldoze':
        game.bulldozeTile(action.x, action.y);
        break;
        
      case 'setSpeed':
        game.setSpeed(action.speed);
        break;
        
      case 'setParkName':
        game.setParkSettings({ name: action.name });
        break;
        
      case 'setTicketPrice':
        game.setParkSettings({ entranceFee: action.price });
        break;
        
      case 'fullState':
        // Ignore - full state sync is handled separately via state-sync event
        // Blocking this prevents malicious players from overwriting game state
        break;
        
      case 'tick':
        // Apply tick data from host (for guests)
        // This would require more complex state merging
        // For now, we rely on periodic full state syncs
        break;
    }
  }, [game]);

  // Register callback to receive remote actions
  useEffect(() => {
    if (!multiplayer) return;

    multiplayer.setOnRemoteAction((action: CoasterGameAction) => {
      // Apply remote actions to local game state
      applyRemoteAction(action);
    });

    return () => {
      multiplayer.setOnRemoteAction(null);
    };
  }, [multiplayer, applyRemoteAction]);
  
  // Flush batched placements - uses ref to avoid stale closure issues
  const flushPlacements = useCallback(() => {
    const mp = multiplayerRef.current;
    if (!mp || placementBufferRef.current.length === 0) return;
    
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    
    const placements = [...placementBufferRef.current];
    placementBufferRef.current = [];
    
    if (placements.length === 1) {
      // Single placement - send as regular place action
      const p = placements[0];
      mp.dispatchAction({ type: 'place', x: p.x, y: p.y, tool: p.tool });
    } else {
      // Multiple placements - send as batch
      mp.dispatchAction({ type: 'placeBatch', placements });
    }
  }, []);

  // Keep the game state synced with the Supabase database
  // The provider handles throttling internally (saves every 3 seconds max)
  // Also updates the local saved parks index so the park appears on the homepage
  const lastUpdateRef = useRef<number>(0);
  const lastIndexUpdateRef = useRef<number>(0);
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') return;
    
    const now = Date.now();
    if (now - lastUpdateRef.current < 2000) return; // Throttle to 2 second intervals
    lastUpdateRef.current = now;
    
    // Update the game state - provider will save to Supabase database (throttled)
    multiplayer.updateGameState(game.state);
    
    // Also update the local saved parks index (less frequently - every 10 seconds)
    if (multiplayer.roomCode && now - lastIndexUpdateRef.current > 10000) {
      lastIndexUpdateRef.current = now;
      updateSavedParksIndex(game.state, multiplayer.roomCode);
    }
  }, [multiplayer, game.state]);

  // Broadcast a local action to peers
  const broadcastAction = useCallback((action: CoasterGameActionInput) => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') return;
    
    // Prevent broadcasting the same action twice
    const actionKey = JSON.stringify(action);
    if (lastActionRef.current === actionKey) return;
    lastActionRef.current = actionKey;
    
    // Clear the ref after a short delay to allow repeated actions
    setTimeout(() => {
      if (lastActionRef.current === actionKey) {
        lastActionRef.current = null;
      }
    }, 100);
    
    multiplayer.dispatchAction(action);
  }, [multiplayer]);

  // Helper to broadcast a placement action
  const broadcastPlace = useCallback(({ x, y, tool }: { x: number; y: number; tool: Tool }) => {
    if (tool === 'bulldoze') {
      broadcastAction({ type: 'bulldoze', x, y });
    } else if (tool !== 'select') {
      broadcastAction({ type: 'place', x, y, tool });
    }
  }, [broadcastAction]);

  // Helper to broadcast speed change
  const broadcastSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    broadcastAction({ type: 'setSpeed', speed });
  }, [broadcastAction]);

  // Helper to broadcast park name change
  const broadcastParkName = useCallback((name: string) => {
    broadcastAction({ type: 'setParkName', name });
  }, [broadcastAction]);

  // Helper to broadcast entrance fee change
  const broadcastEntranceFee = useCallback((price: number) => {
    broadcastAction({ type: 'setTicketPrice', price });
  }, [broadcastAction]);

  // Check if we're in multiplayer mode
  const isMultiplayer = multiplayer?.connectionState === 'connected';
  const isHost = multiplayer?.isHost ?? false;
  const playerCount = multiplayer?.players.length ?? 0;
  const roomCode = multiplayer?.roomCode ?? null;
  const connectionState = multiplayer?.connectionState ?? 'disconnected';

  return {
    isMultiplayer,
    isHost,
    playerCount,
    roomCode,
    connectionState,
    players: multiplayer?.players ?? [],
    broadcastPlace,
    broadcastSpeed,
    broadcastParkName,
    broadcastEntranceFee,
    broadcastAction,
    leaveRoom: multiplayer?.leaveRoom ?? (() => {}),
  };
}
