 'use client';

 import { useCallback, useEffect, useRef } from 'react';
 import { useMultiplayerOptional } from '@/context/MultiplayerContext';
 import { useCoaster } from '@/context/CoasterContext';
 import { GameAction, GameActionInput, MultiplayerGameState } from '@/lib/multiplayer/types';
 import { Tool, GameState as CoasterGameState } from '@/games/coaster/types';
import { saveParkToIndex } from '@/games/coaster/saveUtils';

 // Batch placement buffer for reducing message count during drags
 const BATCH_FLUSH_INTERVAL = 100; // ms - flush every 100ms during drag
 const BATCH_MAX_SIZE = 100; // Max placements before force flush

 function isCoasterState(state: MultiplayerGameState): state is CoasterGameState {
   return !!state && typeof state === 'object' && 'coasters' in state && 'finances' in state && 'grid' in state;
 }

 export function useCoasterMultiplayerSync() {
   const multiplayer = useMultiplayerOptional();
   const coaster = useCoaster();
   const lastActionRef = useRef<string | null>(null);
   const initialStateLoadedRef = useRef(false);
   const lastInitialStateRef = useRef<string | null>(null);
   const placementBufferRef = useRef<Array<{ x: number; y: number; tool: Tool }>>([]);
   const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   const multiplayerRef = useRef(multiplayer);

   useEffect(() => {
     multiplayerRef.current = multiplayer;
   }, [multiplayer]);

   useEffect(() => {
     if (!multiplayer || !multiplayer.initialState) return;
     if (!isCoasterState(multiplayer.initialState)) return;

     const stateKey = JSON.stringify(multiplayer.initialState.tick || 0);
     if (lastInitialStateRef.current === stateKey && initialStateLoadedRef.current) return;

     const stateString = JSON.stringify(multiplayer.initialState);
     const success = coaster.loadState(stateString);

     if (success) {
       initialStateLoadedRef.current = true;
       lastInitialStateRef.current = stateKey;
     }
   }, [multiplayer?.initialState, coaster]);

   const applyRemoteAction = useCallback((action: GameAction) => {
     if (!action || !action.type) {
       console.warn('[useCoasterMultiplayerSync] Received invalid action:', action);
       return;
     }

     switch (action.type) {
       case 'place': {
         const currentTool = coaster.state.selectedTool;
         coaster.setTool(action.tool as Tool);
         coaster.placeAtTile(action.x, action.y, true);
         coaster.setTool(currentTool);
         break;
       }
       case 'placeBatch': {
         const originalTool = coaster.state.selectedTool;
         for (const placement of action.placements) {
           coaster.setTool(placement.tool as Tool);
           coaster.placeAtTile(placement.x, placement.y, true);
         }
         coaster.setTool(originalTool);
         break;
       }
       case 'bulldoze': {
         const savedTool = coaster.state.selectedTool;
         coaster.setTool('bulldoze');
         coaster.bulldozeTile(action.x, action.y, true);
         coaster.setTool(savedTool);
         break;
       }
       case 'setSpeed':
         coaster.setSpeed(action.speed, true);
         break;
       case 'setParkSettings':
         coaster.setParkSettings(action.settings, true);
         break;
       case 'coasterStartBuild':
         coaster.startCoasterBuild(action.coasterType, { coasterId: action.coasterId, isRemote: true });
         break;
       case 'coasterFinishBuild':
         coaster.finishCoasterBuild(true);
         break;
       case 'coasterCancelBuild':
         coaster.cancelCoasterBuild(true);
         break;
       case 'fullState':
         if (isCoasterState(action.state)) {
           coaster.loadState(JSON.stringify(action.state));
         }
         break;
       default:
         break;
     }
   }, [coaster]);

   useEffect(() => {
     if (!multiplayer) return;

     multiplayer.setOnRemoteAction((action: GameAction) => {
       applyRemoteAction(action);
     });

     return () => {
       multiplayer.setOnRemoteAction(null);
     };
   }, [multiplayer, applyRemoteAction]);

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
       const p = placements[0];
       mp.dispatchAction({ type: 'place', x: p.x, y: p.y, tool: p.tool });
     } else {
       mp.dispatchAction({ type: 'placeBatch', placements });
     }
   }, []);

   const broadcastAction = useCallback((action: GameActionInput) => {
     if (!multiplayer || multiplayer.connectionState !== 'connected') return;

     const actionKey = JSON.stringify(action);
     if (lastActionRef.current === actionKey) return;
     lastActionRef.current = actionKey;

     setTimeout(() => {
       if (lastActionRef.current === actionKey) {
         lastActionRef.current = null;
       }
     }, 100);

     multiplayer.dispatchAction(action);
   }, [multiplayer]);

   useEffect(() => {
     if (!multiplayer || multiplayer.connectionState !== 'connected') {
       coaster.setPlaceCallback(null);
       if (placementBufferRef.current.length > 0) {
         placementBufferRef.current = [];
       }
       if (flushTimeoutRef.current) {
         clearTimeout(flushTimeoutRef.current);
         flushTimeoutRef.current = null;
       }
       return;
     }

     coaster.setPlaceCallback(({ x, y, tool }: { x: number; y: number; tool: Tool }) => {
       if (tool !== 'select') {
         placementBufferRef.current.push({ x, y, tool });

         if (placementBufferRef.current.length >= BATCH_MAX_SIZE) {
           flushPlacements();
         } else if (!flushTimeoutRef.current) {
           flushTimeoutRef.current = setTimeout(() => {
             flushTimeoutRef.current = null;
             flushPlacements();
           }, BATCH_FLUSH_INTERVAL);
         }
       }
     });

     return () => {
       flushPlacements();
       coaster.setPlaceCallback(null);
     };
   }, [multiplayer, multiplayer?.connectionState, coaster, flushPlacements]);

   useEffect(() => {
     if (!multiplayer || multiplayer.connectionState !== 'connected') {
       coaster.setBulldozeCallback(null);
       return;
     }

     coaster.setBulldozeCallback(({ x, y }) => {
       broadcastAction({ type: 'bulldoze', x, y });
     });

     return () => {
       coaster.setBulldozeCallback(null);
     };
   }, [multiplayer, multiplayer?.connectionState, coaster, broadcastAction]);

   useEffect(() => {
     if (!multiplayer || multiplayer.connectionState !== 'connected') {
       coaster.setCoasterBuildCallback(null);
       coaster.setCoasterBuildFinishCallback(null);
       coaster.setCoasterBuildCancelCallback(null);
       return;
     }

     coaster.setCoasterBuildCallback(({ coasterType, coasterId }) => {
       broadcastAction({ type: 'coasterStartBuild', coasterType, coasterId });
     });
     coaster.setCoasterBuildFinishCallback(() => {
       broadcastAction({ type: 'coasterFinishBuild' });
     });
     coaster.setCoasterBuildCancelCallback(() => {
       broadcastAction({ type: 'coasterCancelBuild' });
     });

     return () => {
       coaster.setCoasterBuildCallback(null);
       coaster.setCoasterBuildFinishCallback(null);
       coaster.setCoasterBuildCancelCallback(null);
     };
   }, [multiplayer, multiplayer?.connectionState, coaster, broadcastAction]);

   useEffect(() => {
     if (!multiplayer || multiplayer.connectionState !== 'connected') {
       coaster.setParkSettingsCallback(null);
       return;
     }

     coaster.setParkSettingsCallback((settings) => {
       broadcastAction({ type: 'setParkSettings', settings });
     });

     return () => {
       coaster.setParkSettingsCallback(null);
     };
   }, [multiplayer, multiplayer?.connectionState, coaster, broadcastAction]);

   useEffect(() => {
     if (!multiplayer || multiplayer.connectionState !== 'connected') {
       coaster.setSpeedCallback(null);
       return;
     }

     coaster.setSpeedCallback((speed) => {
       broadcastAction({ type: 'setSpeed', speed });
     });

     return () => {
       coaster.setSpeedCallback(null);
     };
   }, [multiplayer, multiplayer?.connectionState, coaster, broadcastAction]);

   const lastUpdateRef = useRef<number>(0);
   const lastIndexUpdateRef = useRef<number>(0);
   useEffect(() => {
     if (!multiplayer || multiplayer.connectionState !== 'connected') return;

     const now = Date.now();
     if (now - lastUpdateRef.current < 2000) return;
     lastUpdateRef.current = now;

     multiplayer.updateGameState(coaster.state);

     if (multiplayer.roomCode && now - lastIndexUpdateRef.current > 10000) {
       lastIndexUpdateRef.current = now;
      saveParkToIndex(coaster.state, multiplayer.roomCode);
     }
   }, [multiplayer, coaster.state]);

  const isMultiplayer = multiplayer?.connectionState === 'connected';
  const roomCode = multiplayer?.roomCode ?? null;

  return {
    isMultiplayer,
    roomCode,
    players: multiplayer?.players ?? [],
  };
 }
