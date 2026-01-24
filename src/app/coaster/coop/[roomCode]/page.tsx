'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MultiplayerContextProvider } from '@/context/MultiplayerContext';
import { CoasterProvider, createInitialGameState as createInitialCoasterGameState } from '@/context/CoasterContext';
import CoasterGame from '@/components/coaster/Game';
import { CoopModal } from '@/components/multiplayer/CoopModal';
import { MultiplayerState } from '@/lib/multiplayer/types';
import { GameState as CoasterGameState } from '@/games/coaster/types';
import {
  COASTER_AUTOSAVE_KEY,
  buildSavedParkMeta,
  readSavedParksIndex,
  saveCoasterStateToStorage,
  upsertSavedParkMeta,
  writeSavedParksIndex,
} from '@/games/coaster/saveUtils';

function resolveCoasterState(state?: MultiplayerState): CoasterGameState | null {
  if (!state || typeof state !== 'object') return null;
  if ('settings' in state && 'finances' in state && 'coasters' in state) {
    return state as CoasterGameState;
  }
  return null;
}

export default function CoasterCoopPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string)?.toUpperCase();

  const [showGame, setShowGame] = useState(false);
  const [showCoopModal, setShowCoopModal] = useState(true);
  const [startFreshGame, setStartFreshGame] = useState(false);
  const isStartingGameRef = useRef(false);

  const handleExitGame = useCallback(() => {
    router.push('/coaster');
  }, [router]);

  const handleCoopStart = useCallback((isHost: boolean, initialState?: MultiplayerState, code?: string) => {
    isStartingGameRef.current = true;
    const coasterState = resolveCoasterState(initialState);

    if (coasterState) {
      saveCoasterStateToStorage(COASTER_AUTOSAVE_KEY, coasterState);
      const meta = buildSavedParkMeta(coasterState, Date.now(), code);
      const updated = upsertSavedParkMeta(meta, readSavedParksIndex());
      writeSavedParksIndex(updated);
      setStartFreshGame(false);
    } else if (isHost) {
      setStartFreshGame(true);
    } else {
      setStartFreshGame(true);
    }

    setShowGame(true);
    setShowCoopModal(false);
  }, []);

  const handleModalClose = useCallback((open: boolean) => {
    if (!open && !showGame && !isStartingGameRef.current) {
      router.push('/coaster');
    }
    setShowCoopModal(open);
  }, [router, showGame]);

  if (showGame) {
    return (
      <MultiplayerContextProvider>
        <CoasterProvider startFresh={startFreshGame}>
          <main className="h-screen w-screen overflow-hidden">
            <CoasterGame onExit={handleExitGame} />
          </main>
        </CoasterProvider>
      </MultiplayerContextProvider>
    );
  }

  return (
    <MultiplayerContextProvider>
      <main className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-950 to-emerald-950 flex items-center justify-center">
        <CoopModal
          open={showCoopModal}
          onOpenChange={handleModalClose}
          onStartGame={handleCoopStart}
          pendingRoomCode={roomCode}
          basePath="/coaster/coop"
          homePath="/coaster"
          defaultRoomName="My Co-op Park"
          locationLabel="Park"
          locationLabelLower="park"
          createInitialState={(name) => createInitialCoasterGameState(name)}
          applyNameToState={(state, name) => {
            if (!state || typeof state !== 'object' || !('settings' in state)) return state;
            const coasterState = state as CoasterGameState;
            return { ...coasterState, settings: { ...coasterState.settings, name } };
          }}
        />
      </main>
    </MultiplayerContextProvider>
  );
}
