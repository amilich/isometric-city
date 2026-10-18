import { GLITCH_ENABLED } from '@/lib/glitch/config';
import {
  createMultiplayerProvider as createSupabaseMultiplayerProvider,
  MultiplayerProviderOptions,
} from './supabaseProvider';
import { createGlitchMultiplayerProvider, GlitchMultiplayerProvider } from './glitchProvider';
import {
  GameActionInput,
  MultiplayerGameState,
  MultiplayerRoomSummary,
  MultiplayerVoiceState,
} from './types';

export type { MultiplayerProviderOptions } from './supabaseProvider';

export interface MultiplayerProviderInstance {
  readonly roomCode: string;
  readonly peerId: string;
  readonly isCreator: boolean;
  dispatchAction(action: GameActionInput): void;
  updateGameState(state: MultiplayerGameState): void;
  sendChatMessage(text: string): void;
  startVoiceChat(): Promise<void>;
  stopVoiceChat(): Promise<void>;
  setVoiceMuted(muted: boolean): void;
  setVoiceDeafened(deafened: boolean): void;
  destroy(): void;
}

export async function createMultiplayerProvider(
  options: MultiplayerProviderOptions
): Promise<MultiplayerProviderInstance> {
  if (GLITCH_ENABLED) {
    return createGlitchMultiplayerProvider(options);
  }
  return createSupabaseMultiplayerProvider(options);
}

export type AnyMultiplayerProvider = MultiplayerProviderInstance | GlitchMultiplayerProvider;

export async function listJoinableMultiplayerRooms(): Promise<MultiplayerRoomSummary[]> {
  if (GLITCH_ENABLED) {
    const { listGlitchMultiplayerRooms } = await import('./glitchProvider');
    return listGlitchMultiplayerRooms();
  }
  return [];
}

export const DEFAULT_MULTIPLAYER_VOICE_STATE: MultiplayerVoiceState = {
  status: 'idle',
  muted: false,
  deafened: false,
  speaking: false,
  error: null,
};
