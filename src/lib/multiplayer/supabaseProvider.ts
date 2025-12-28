// Simple Supabase Realtime multiplayer provider (peer-to-peer, no host required)

import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import {
  GameAction,
  GameActionInput,
  Player,
  generatePlayerId,
  generatePlayerColor,
  generatePlayerName,
} from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Only create Supabase client if environment variables are provided
// This allows the app to run without Supabase for single-player mode
const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export interface MultiplayerProviderOptions {
  roomCode: string;
  cityName: string;
  playerName?: string; // Optional - auto-generated if not provided
  initialGameState?: unknown; // If provided, this player has state to share
  onConnectionChange?: (connected: boolean, peerCount: number) => void;
  onPlayersChange?: (players: Player[]) => void;
  onAction?: (action: GameAction) => void;
  onStateReceived?: (state: unknown) => void;
}

export class MultiplayerProvider {
  public readonly roomCode: string;
  public readonly peerId: string;

  private channel: RealtimeChannel | null = null;
  private player: Player;
  private options: MultiplayerProviderOptions;
  private players: Map<string, Player> = new Map();
  private gameState: unknown = null;
  private hasReceivedState = false; // Prevent duplicate state processing
  private destroyed = false;

  constructor(options: MultiplayerProviderOptions) {
    this.options = options;
    this.roomCode = options.roomCode;
    this.peerId = generatePlayerId();
    this.gameState = options.initialGameState || null;
    this.hasReceivedState = !!options.initialGameState; // If we have state, we don't need to receive it

    // Create player info (no host flag needed)
    this.player = {
      id: this.peerId,
      name: options.playerName || generatePlayerName(),
      color: generatePlayerColor(),
      joinedAt: Date.now(),
      isHost: false, // No longer meaningful, kept for type compatibility
    };

    // Add self to players
    this.players.set(this.peerId, this.player);

    // Create Supabase Realtime channel (only if Supabase is configured)
    if (!supabase) {
      console.warn('[Multiplayer] Supabase not configured. Multiplayer features will be disabled.');
      return;
    }
    
    this.channel = supabase.channel(`room-${options.roomCode}`, {
      config: {
        presence: { key: this.peerId },
        broadcast: { self: false }, // Don't receive our own broadcasts
      },
    });
  }

  async connect(): Promise<void> {
    if (this.destroyed || !this.channel) return;

    // Set up presence (track who's in the room)
    if (!this.channel) return;
    
    this.channel
      .on('presence', { event: 'sync' }, () => {
        if (!this.channel) return;
        const state = this.channel.presenceState();
        this.players.clear();
        this.players.set(this.peerId, this.player);

        Object.entries(state).forEach(([key, presences]) => {
          if (key !== this.peerId && presences.length > 0) {
            const presence = presences[0] as unknown as { player: Player };
            if (presence.player) {
              this.players.set(key, presence.player);
            }
          }
        });

        this.notifyPlayersChange();
        this.updateConnectionStatus();
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key !== this.peerId && newPresences.length > 0) {
          const presence = newPresences[0] as unknown as { player: Player };
          if (presence.player) {
            this.players.set(key, presence.player);
            this.notifyPlayersChange();
            this.updateConnectionStatus();

            // Any player with state sends it to new players
            if (this.gameState) {
              // Small delay to avoid race conditions with multiple senders
              setTimeout(() => {
                if (!this.destroyed && this.gameState && this.channel) {
                  // Compress state for bandwidth efficiency (~70-80% reduction)
                  const compressed = compressToEncodedURIComponent(JSON.stringify(this.gameState));
                  this.channel.send({
                    type: 'broadcast',
                    event: 'state-sync',
                    payload: { compressed, to: key, from: this.peerId },
                  });
                }
              }, Math.random() * 200); // Random delay 0-200ms to stagger responses
            }
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        this.players.delete(key);
        this.notifyPlayersChange();
        this.updateConnectionStatus();
      });

    // Set up broadcast listeners
    this.channel
      .on('broadcast', { event: 'action' }, ({ payload }) => {
        const action = payload as GameAction;
        if (action.playerId !== this.peerId && this.options.onAction) {
          this.options.onAction(action);
        }
      })
      .on('broadcast', { event: 'state-sync' }, ({ payload }) => {
        const { compressed, to } = payload as { compressed: string; to?: string; from?: string };
        // Only process if it's for us and we haven't received state yet
        if (to === this.peerId && !this.hasReceivedState && this.options.onStateReceived) {
          try {
            // Decompress state
            const decompressed = decompressFromEncodedURIComponent(compressed);
            if (!decompressed) {
              console.error('[Multiplayer] Failed to decompress state');
              return;
            }
            const state = JSON.parse(decompressed);
            this.hasReceivedState = true;
            this.gameState = state; // Now we have state too
            this.options.onStateReceived(state);
          } catch (e) {
            console.error('[Multiplayer] Failed to parse state:', e);
          }
        }
      })
      .on('broadcast', { event: 'state-request' }, ({ payload }) => {
        const { from } = payload as { from: string };
        // Any player with state can respond
        if (this.gameState && from !== this.peerId) {
          // Random delay to avoid multiple simultaneous responses
          setTimeout(() => {
            if (!this.destroyed && this.gameState && this.channel) {
              // Compress state for bandwidth efficiency (~70-80% reduction)
              const compressed = compressToEncodedURIComponent(JSON.stringify(this.gameState));
              this.channel.send({
                type: 'broadcast',
                event: 'state-sync',
                payload: { compressed, to: from, from: this.peerId },
              });
            }
          }, Math.random() * 200);
        }
      });

    // Subscribe and track presence
    if (!this.channel) return;
    
    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && this.channel) {
        await this.channel.track({ player: this.player });
        
        // Notify connected
        if (this.options.onConnectionChange) {
          this.options.onConnectionChange(true, this.players.size);
        }
        this.notifyPlayersChange();

        // If we don't have state, request it from anyone in the room
        if (!this.gameState && this.channel) {
          this.channel.send({
            type: 'broadcast',
            event: 'state-request',
            payload: { from: this.peerId },
          });
        }
      }
    });
  }

  dispatchAction(action: GameActionInput): void {
    if (this.destroyed) return;
    
    // Check if channel exists and is connected
    if (!this.channel) {
      console.warn('[Multiplayer] Cannot dispatch action: channel not initialized. Supabase may not be configured.');
      return;
    }

    const fullAction: GameAction = {
      ...action,
      timestamp: Date.now(),
      playerId: this.peerId,
    };

    // Broadcast to all peers
    this.channel.send({
      type: 'broadcast',
      event: 'action',
      payload: fullAction,
    });
  }

  updateGameState(state: unknown): void {
    this.gameState = state;
    this.hasReceivedState = true;
  }

  private updateConnectionStatus(): void {
    if (this.options.onConnectionChange) {
      this.options.onConnectionChange(true, this.players.size);
    }
  }

  private notifyPlayersChange(): void {
    if (this.options.onPlayersChange) {
      this.options.onPlayersChange(Array.from(this.players.values()));
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.channel) {
      this.channel.unsubscribe();
      if (supabase) {
        supabase.removeChannel(this.channel);
      }
    }
  }
}

// Create and connect a multiplayer provider
export async function createMultiplayerProvider(
  options: MultiplayerProviderOptions
): Promise<MultiplayerProvider> {
  const provider = new MultiplayerProvider(options);
  await provider.connect();
  return provider;
}
