'use client';

import { useEffect, useRef } from 'react';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { useCoaster } from '@/context/CoasterContext';
import { GameAction, MultiplayerState } from '@/lib/multiplayer/types';
import { GameState as CoasterGameState } from '@/games/coaster/types';

const SYNC_INTERVAL_MS = 2000;
const SUPPRESS_BROADCAST_MS = 750;

function isCoasterState(state: MultiplayerState): state is CoasterGameState {
  if (!state || typeof state !== 'object') return false;
  return 'settings' in state && 'finances' in state && 'coasters' in state;
}

export function useCoasterMultiplayerSync() {
  const multiplayer = useMultiplayerOptional();
  const coaster = useCoaster();
  const lastBroadcastRef = useRef(0);
  const lastRemoteTimestampRef = useRef(0);
  const suppressBroadcastUntilRef = useRef(0);

  useEffect(() => {
    if (!multiplayer) return;

    const handleRemoteAction = (action: GameAction) => {
      if (action.type !== 'fullState') return;
      if (!isCoasterState(action.state)) return;
      if (action.timestamp <= lastRemoteTimestampRef.current) return;

      lastRemoteTimestampRef.current = action.timestamp;
      suppressBroadcastUntilRef.current = Date.now() + SUPPRESS_BROADCAST_MS;
      coaster.loadState(JSON.stringify(action.state));
    };

    multiplayer.setOnRemoteAction(handleRemoteAction);
    return () => multiplayer.setOnRemoteAction(null);
  }, [multiplayer, coaster]);

  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') return;
    if (!coaster.isStateReady) return;

    const now = Date.now();
    if (now < suppressBroadcastUntilRef.current) return;
    if (now - lastBroadcastRef.current < SYNC_INTERVAL_MS) return;
    lastBroadcastRef.current = now;

    const state = coaster.latestStateRef.current;
    multiplayer.dispatchAction({ type: 'fullState', state });
    multiplayer.updateGameState(state);
  }, [multiplayer, coaster.state, coaster.isStateReady, coaster.latestStateRef]);

  return {
    isMultiplayer: multiplayer?.connectionState === 'connected',
    playerCount: multiplayer?.players.length ?? 0,
    roomCode: multiplayer?.roomCode ?? null,
    connectionState: multiplayer?.connectionState ?? 'disconnected',
    players: multiplayer?.players ?? [],
    leaveRoom: multiplayer?.leaveRoom ?? (() => {}),
  };
}
