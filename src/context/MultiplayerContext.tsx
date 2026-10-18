'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  createMultiplayerProvider,
  DEFAULT_MULTIPLAYER_VOICE_STATE,
  listJoinableMultiplayerRooms,
  type MultiplayerProviderInstance,
} from '@/lib/multiplayer/providerFactory';
import { emitGlitchBehaviorEvent } from '@/lib/glitch/behaviorEvents';
import {
  GameAction,
  GameActionInput,
  Player,
  ConnectionState,
  RoomData,
  MultiplayerGameState,
  MultiplayerChatMessage,
  MultiplayerCreateRoomOptions,
  MultiplayerRoomSummary,
  MultiplayerVoiceState,
} from '@/lib/multiplayer/types';
import { useGT } from 'gt-next';

// Generate a random 5-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

interface MultiplayerContextValue {
  // Connection state
  connectionState: ConnectionState;
  roomCode: string | null;
  players: Player[];
  error: string | null;
  chatMessages: MultiplayerChatMessage[];
  voiceState: MultiplayerVoiceState;

  // Actions
  createRoom: (cityName: string, initialState: MultiplayerGameState, options?: MultiplayerCreateRoomOptions) => Promise<string>;
  joinRoom: (roomCode: string) => Promise<RoomData>;
  leaveRoom: () => void;
  listJoinableRooms: () => Promise<MultiplayerRoomSummary[]>;
  sendChatMessage: (text: string) => void;
  startVoiceChat: () => Promise<void>;
  stopVoiceChat: () => Promise<void>;
  setVoiceMuted: (muted: boolean) => void;
  setVoiceDeafened: (deafened: boolean) => void;
  
  // Game action dispatch
  dispatchAction: (action: GameActionInput) => void;
  
  // Initial state for new players
  initialState: MultiplayerGameState | null;
  
  // Callback for when remote actions are received
  onRemoteAction: ((action: GameAction) => void) | null;
  setOnRemoteAction: (callback: ((action: GameAction) => void) | null) => void;
  
  // Update the game state (any player can do this now)
  updateGameState: (state: MultiplayerGameState) => void;
  
  // Provider instance (for advanced usage)
  provider: MultiplayerProviderInstance | null;
  
  // Legacy compatibility - always false now since there's no host
  isHost: boolean;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

export function MultiplayerContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const gt = useGT();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialState, setInitialState] = useState<MultiplayerGameState | null>(null);
  const [provider, setProvider] = useState<MultiplayerProviderInstance | null>(null);
  const [onRemoteAction, setOnRemoteAction] = useState<((action: GameAction) => void) | null>(null);
  const [chatMessages, setChatMessages] = useState<MultiplayerChatMessage[]>([]);
  const [voiceState, setVoiceState] = useState<MultiplayerVoiceState>(DEFAULT_MULTIPLAYER_VOICE_STATE);

  const providerRef = useRef<MultiplayerProviderInstance | null>(null);
  const onRemoteActionRef = useRef<((action: GameAction) => void) | null>(null);
  const pendingActionsRef = useRef<GameAction[]>([]);

  // Set up remote action callback
  const handleSetOnRemoteAction = useCallback(
    (callback: ((action: GameAction) => void) | null) => {
      onRemoteActionRef.current = callback;
      // React treats a bare function passed to a state setter as an updater and
      // invokes it with the previous state. Remote action handlers are themselves
      // functions, so store them through an updater wrapper to preserve the
      // callback value instead of accidentally calling it with `null`.
      setOnRemoteAction(() => callback);
      if (callback && pendingActionsRef.current.length > 0) {
        const queuedActions = [...pendingActionsRef.current];
        pendingActionsRef.current = [];
        for (const action of queuedActions) {
          callback(action);
        }
      }
    },
    []
  );

  const handleRemoteAction = useCallback((action: GameAction) => {
    if (!action || !action.type || !action.playerId) {
      console.warn('[MultiplayerContext] Ignoring malformed remote action:', action);
      return;
    }
    if (onRemoteActionRef.current) {
      onRemoteActionRef.current(action);
      return;
    }
    pendingActionsRef.current.push(action);
    if (pendingActionsRef.current.length > 500) {
      pendingActionsRef.current = pendingActionsRef.current.slice(-500);
    }
  }, []);

  const handleChatMessage = useCallback((message: MultiplayerChatMessage) => {
    setChatMessages((current) => {
      if (current.some((item) => item.id === message.id || (message.sequence && item.sequence === message.sequence))) {
        return current;
      }
      return [...current, message].slice(-100);
    });
  }, []);

  // Create a room (first player to start a session)
  const createRoom = useCallback(
    async (cityName: string, gameState: MultiplayerGameState, options?: MultiplayerCreateRoomOptions): Promise<string> => {
      setConnectionState('connecting');
      setError(null);
      setChatMessages([]);
      setVoiceState(DEFAULT_MULTIPLAYER_VOICE_STATE);
      pendingActionsRef.current = [];

      try {
        emitGlitchBehaviorEvent('multiplayer_room', 'create_attempt', {
          max_players: options?.maxPlayers,
          city_type: options?.cityType,
          is_public: options?.isPublic,
        });
        // Generate room code
        const newRoomCode = generateRoomCode();

        // Create multiplayer provider with initial state
        // State will be saved to Supabase database
        const provider = await createMultiplayerProvider({
          roomCode: newRoomCode,
          cityName,
          initialGameState: gameState,
          createOptions: options,
          onConnectionChange: (connected) => {
            setConnectionState(connected ? 'connected' : 'disconnected');
          },
          onPlayersChange: (newPlayers) => {
            setPlayers(newPlayers);
          },
          onAction: handleRemoteAction,
          onChatMessage: handleChatMessage,
          onVoiceStateChange: setVoiceState,
          onError: (errorMsg) => {
            setError(errorMsg);
            setConnectionState('error');
          },
        });

        providerRef.current = provider;
        setProvider(provider);
        setRoomCode(newRoomCode);
        setConnectionState('connected');
        emitGlitchBehaviorEvent('multiplayer_room', 'create_success', {
          max_players: options?.maxPlayers,
          city_type: options?.cityType,
          is_public: options?.isPublic,
        });

        return newRoomCode;
      } catch (err) {
        setConnectionState('error');
        setError(err instanceof Error ? err.message : gt('Failed to create room'));
        emitGlitchBehaviorEvent('multiplayer_room', 'create_error', {
          error_type: err instanceof Error ? err.name : 'unknown',
        });
        throw err;
      }
    },
    [gt, handleChatMessage, handleRemoteAction]
  );

  // Join an existing room
  const joinRoom = useCallback(
    async (code: string): Promise<RoomData> => {
      setConnectionState('connecting');
      setError(null);
      setChatMessages([]);
      setVoiceState(DEFAULT_MULTIPLAYER_VOICE_STATE);
      pendingActionsRef.current = [];

      try {
        const normalizedCode = code.toUpperCase();
        emitGlitchBehaviorEvent('multiplayer_room', 'join_attempt', {
          entered_code_length: normalizedCode.length,
        });

        // Create multiplayer provider - state will be loaded from Supabase database
        const provider = await createMultiplayerProvider({
          roomCode: normalizedCode,
          cityName: gt('Co-op City'),
          // No initialGameState - we'll load from database
          onConnectionChange: (connected) => {
            setConnectionState(connected ? 'connected' : 'disconnected');
          },
          onPlayersChange: (newPlayers) => {
            setPlayers(newPlayers);
          },
          onAction: handleRemoteAction,
          onStateReceived: (state) => {
            // State loaded from database
            setInitialState(state);
          },
          onChatMessage: handleChatMessage,
          onVoiceStateChange: setVoiceState,
          onError: (errorMsg) => {
            setError(errorMsg);
            setConnectionState('error');
          },
        });

        providerRef.current = provider;
        setProvider(provider);
        setRoomCode(normalizedCode);
        setConnectionState('connected');
        emitGlitchBehaviorEvent('multiplayer_room', 'join_success', {
          entered_code_length: normalizedCode.length,
        });

        // Return room data
        const room: RoomData = {
          code: normalizedCode,
          hostId: '',
          cityName: gt('Co-op City'),
          createdAt: Date.now(),
          playerCount: 1,
          sourceOfTruth: 'glitch-lobby-event-log',
        };

        return room;
      } catch (err) {
        setConnectionState('error');
        setError(err instanceof Error ? err.message : gt('Failed to join room'));
        emitGlitchBehaviorEvent('multiplayer_room', 'join_error', {
          error_type: err instanceof Error ? err.name : 'unknown',
        });
        throw err;
      }
    },
    [gt, handleChatMessage, handleRemoteAction]
  );

  // Leave the current room
  const leaveRoom = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }

    setProvider(null);
    setConnectionState('disconnected');
    setRoomCode(null);
    setPlayers([]);
    setError(null);
    setInitialState(null);
    setChatMessages([]);
    setVoiceState(DEFAULT_MULTIPLAYER_VOICE_STATE);
    pendingActionsRef.current = [];
    emitGlitchBehaviorEvent('multiplayer_room', 'leave', {
      had_room: !!roomCode,
      player_count: players.length,
    });
  }, [players.length, roomCode]);

  const listJoinableRooms = useCallback(async () => {
    try {
      return await listJoinableMultiplayerRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : gt('Failed to load cities'));
      return [];
    }
  }, [gt]);

  const sendChatMessage = useCallback((text: string) => {
    if (text.trim()) {
      emitGlitchBehaviorEvent('multiplayer_chat', 'send_text', {
        text_length: text.trim().length,
        player_count: players.length,
      });
    }
    providerRef.current?.sendChatMessage(text);
  }, [players.length]);

  const startVoiceChat = useCallback(async () => {
    emitGlitchBehaviorEvent('multiplayer_voice', 'start_attempt', {
      player_count: players.length,
    });
    await providerRef.current?.startVoiceChat();
  }, [players.length]);

  const stopVoiceChat = useCallback(async () => {
    emitGlitchBehaviorEvent('multiplayer_voice', 'stop', {
      player_count: players.length,
    });
    await providerRef.current?.stopVoiceChat();
  }, [players.length]);

  const setVoiceMuted = useCallback((muted: boolean) => {
    emitGlitchBehaviorEvent('multiplayer_voice', muted ? 'mute' : 'unmute', {
      player_count: players.length,
    });
    providerRef.current?.setVoiceMuted(muted);
  }, [players.length]);

  const setVoiceDeafened = useCallback((deafened: boolean) => {
    emitGlitchBehaviorEvent('multiplayer_voice', deafened ? 'deafen' : 'undeafen', {
      player_count: players.length,
    });
    providerRef.current?.setVoiceDeafened(deafened);
  }, [players.length]);

  // Dispatch a game action to all peers
  const dispatchAction = useCallback(
    (action: GameActionInput) => {
      if (providerRef.current) {
        providerRef.current.dispatchAction(action);
      }
    },
    []
  );

  // Update the game state (any player can do this)
  const updateGameState = useCallback(
    (state: MultiplayerGameState) => {
      if (providerRef.current) {
        providerRef.current.updateGameState(state);
      }
    },
    []
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        providerRef.current.destroy();
      }
    };
  }, []);

  const value: MultiplayerContextValue = {
    connectionState,
    roomCode,
    players,
    error,
    chatMessages,
    voiceState,
    createRoom,
    joinRoom,
    leaveRoom,
    listJoinableRooms,
    sendChatMessage,
    startVoiceChat,
    stopVoiceChat,
    setVoiceMuted,
    setVoiceDeafened,
    dispatchAction,
    initialState,
    onRemoteAction,
    setOnRemoteAction: handleSetOnRemoteAction,
    updateGameState,
    provider,
    isHost: false, // No longer meaningful - kept for compatibility
  };

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer() {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error('useMultiplayer must be used within a MultiplayerContextProvider');
  }
  return context;
}

// Optional hook that returns null if not in multiplayer context
export function useMultiplayerOptional() {
  return useContext(MultiplayerContext);
}
