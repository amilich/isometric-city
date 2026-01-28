'use client';

import React, { useState, useRef, useCallback } from 'react';
import { CoasterProvider } from '@/context/CoasterContext';
import { CoasterMultiplayerContextProvider } from '@/context/CoasterMultiplayerContext';
import CoasterGame from '@/components/coaster/Game';
import { CoasterCoopModal } from '@/components/coaster/multiplayer/CoasterCoopModal';
import { GameState } from '@/games/coaster/types';
import { compressToUTF16 } from 'lz-string';
import { useParams, useRouter } from 'next/navigation';
import { 
  COASTER_AUTOSAVE_KEY, 
  buildSavedParkMeta,
  readSavedParksIndex,
  upsertSavedParkMeta,
  writeSavedParksIndex,
} from '@/games/coaster/saveUtils';

// Save a park to the saved parks index (for multiplayer parks)
function saveParkToIndex(state: GameState, roomCode?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const parks = readSavedParksIndex();
    
    const parkMeta = buildSavedParkMeta(state);
    // Add room code
    const parkMetaWithRoom = {
      ...parkMeta,
      roomCode: roomCode,
    };
    
    const existingIndex = parks.findIndex((p: unknown) => 
      (p as { id: string; roomCode?: string }).id === parkMeta.id || 
      (roomCode && (p as { roomCode?: string }).roomCode === roomCode)
    );
    
    if (existingIndex >= 0) {
      parks[existingIndex] = parkMetaWithRoom;
    } else {
      parks.unshift(parkMetaWithRoom);
    }
    
    writeSavedParksIndex(parks.slice(0, 20));
  } catch (e) {
    console.error('Failed to save park to index:', e);
  }
}

// Create initial game state factory - this will be called when creating a new co-op park
// We need this because we can't import the full state creation here without circular deps
function createInitialParkState(parkName?: string): GameState {
  // This is a simplified initial state - the CoasterProvider will handle full initialization
  const gridSize = 60;
  const grid: GameState['grid'] = [];
  
  for (let y = 0; y < gridSize; y++) {
    const row = [];
    for (let x = 0; x < gridSize; x++) {
      row.push({
        x,
        y,
        terrain: 'grass' as const,
        building: {
          type: 'empty' as const,
          level: 0,
          variant: 0,
          excitement: 0,
          intensity: 0,
          nausea: 0,
          capacity: 0,
          cycleTime: 0,
          price: 0,
          operating: false,
          broken: false,
          age: 0,
          constructionProgress: 100,
        },
        path: false,
        queue: false,
        queueRideId: null,
        hasCoasterTrack: false,
        coasterTrackId: null,
        trackPiece: null,
        elevation: 0,
      });
    }
    grid.push(row);
  }
  
  return {
    id: `park-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    grid,
    gridSize,
    year: 1,
    month: 3,
    day: 1,
    hour: 8,
    minute: 0,
    tick: 0,
    speed: 1,
    weather: {
      current: 'sunny',
      temperature: 22,
      nextChange: 200,
      forecast: ['sunny', 'partly_cloudy', 'sunny'],
    },
    settings: {
      name: parkName || 'Co-op Park',
      entranceFee: 50,
      payPerRide: false,
      openHour: 8,
      closeHour: 22,
      loanInterest: 0.1,
      landCost: 100,
      objectives: [],
    },
    stats: {
      guestsInPark: 0,
      guestsTotal: 0,
      guestsSatisfied: 0,
      guestsUnsatisfied: 0,
      averageHappiness: 50,
      totalRides: 0,
      totalRidesRidden: 0,
      averageQueueTime: 0,
      parkValue: 0,
      companyValue: 0,
      parkRating: 500,
    },
    finances: {
      cash: 100000,
      incomeAdmissions: 0,
      incomeRides: 0,
      incomeFood: 0,
      incomeShops: 0,
      incomeTotal: 0,
      expenseWages: 0,
      expenseUpkeep: 0,
      expenseMarketing: 0,
      expenseResearch: 0,
      expenseTotal: 0,
      profit: 0,
      history: [],
    },
    guests: [],
    staff: [],
    coasters: [],
    selectedTool: 'select',
    activePanel: 'none',
    notifications: [],
    buildingCoasterId: null,
    buildingCoasterPath: [],
    buildingCoasterHeight: 0,
    buildingCoasterLastDirection: null,
    buildingCoasterType: null,
    gameVersion: 1,
  };
}

export default function CoasterCoopPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string)?.toUpperCase();
  
  const [showGame, setShowGame] = useState(false);
  const [showCoopModal, setShowCoopModal] = useState(true);
  const [startFreshGame, setStartFreshGame] = useState(false);
  const [initialMultiplayerState, setInitialMultiplayerState] = useState<GameState | null>(null);
  
  // Ref to track that we're intentionally starting the game (not closing to go home)
  const isStartingGameRef = useRef(false);

  // Handle exit from game - navigate back to coaster homepage
  const handleExitGame = useCallback(() => {
    router.push('/coaster');
  }, [router]);

  // Handle co-op game start
  const handleCoopStart = useCallback((isHost: boolean, initialState?: GameState, code?: string) => {
    // Mark that we're intentionally starting the game (not closing to go home)
    isStartingGameRef.current = true;
    
    if (isHost && initialState) {
      try {
        const compressed = compressToUTF16(JSON.stringify(initialState));
        localStorage.setItem(COASTER_AUTOSAVE_KEY, compressed);
        if (code) {
          saveParkToIndex(initialState, code);
        }
      } catch (e) {
        console.error('Failed to save co-op state:', e);
      }
      setInitialMultiplayerState(initialState);
      setStartFreshGame(false);
    } else if (isHost) {
      setStartFreshGame(true);
      setInitialMultiplayerState(null);
    } else if (initialState) {
      try {
        const compressed = compressToUTF16(JSON.stringify(initialState));
        localStorage.setItem(COASTER_AUTOSAVE_KEY, compressed);
        if (code) {
          saveParkToIndex(initialState, code);
        }
      } catch (e) {
        console.error('Failed to save co-op state:', e);
      }
      setInitialMultiplayerState(initialState);
      setStartFreshGame(false);
    } else {
      setStartFreshGame(true);
      setInitialMultiplayerState(null);
    }
    
    setShowGame(true);
    setShowCoopModal(false);
  }, []);

  // Handle modal close - go back to coaster homepage if not connected
  const handleModalClose = useCallback((open: boolean) => {
    // Don't redirect if we're intentionally starting the game
    if (!open && !showGame && !isStartingGameRef.current) {
      router.push('/coaster');
    }
    setShowCoopModal(open);
  }, [showGame, router]);

  if (showGame) {
    return (
      <CoasterMultiplayerContextProvider>
        <CoasterProvider startFresh={startFreshGame}>
          <main className="h-screen w-screen overflow-hidden">
            <CoasterGame onExit={handleExitGame} />
          </main>
        </CoasterProvider>
      </CoasterMultiplayerContextProvider>
    );
  }

  // Show the coop modal with the room code pre-filled
  return (
    <CoasterMultiplayerContextProvider>
      <main className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-950 to-emerald-950 flex items-center justify-center">
        <CoasterCoopModal
          open={showCoopModal}
          onOpenChange={handleModalClose}
          onStartGame={handleCoopStart}
          pendingRoomCode={roomCode}
          createInitialState={createInitialParkState}
        />
      </main>
    </CoasterMultiplayerContextProvider>
  );
}
