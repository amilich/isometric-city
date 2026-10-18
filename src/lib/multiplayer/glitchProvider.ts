import { emitAudioCue } from '@/lib/audio/audioEvents';
import { createInitialCoasterGameState } from '@/context/CoasterContext';
import { GlitchClient, GlitchLobby, GlitchLobbyMessage, GlitchPresence, GlitchVoicePacket } from '@/lib/glitch/client';
import { detectGlitchGameKeyFromPath, getGlitchTitleConfig, GLITCH_MMO_PRESENCE_ENABLED, GlitchGameKey } from '@/lib/glitch/config';
import { getGlitchUserName, getStableUserInstallId } from '@/lib/glitch/install';
import { createInitialGameState, DEFAULT_GRID_SIZE } from '@/lib/simulation';
import {
  GameAction,
  GameActionInput,
  generatePlayerColor,
  generatePlayerName,
  MultiplayerChatMessage,
  MultiplayerGameState,
  MultiplayerRoomSummary,
  MultiplayerTool,
  MultiplayerVoiceState,
  Player,
} from './types';
import { MultiplayerProviderOptions } from './supabaseProvider';

const LOBBY_MESSAGE_POLL_MS = 1000;
const PRESENCE_HEARTBEAT_MS = 45_000;
const MAX_LOBBY_PAYLOAD_BYTES = 3800;
const MAX_CHAT_TEXT_CHARS = 500;
const VOICE_HEARTBEAT_MS = 20_000;
const VOICE_POLL_MS = 500;
const VOICE_TIMESLICE_MS = 250;
const MAX_VOICE_AUDIO_BYTES = 16 * 1024;

type GlitchLobbyPayload =
  | { kind: 'game_action'; schema: 1; action: GameAction; displayName: string; color: string }
  | { kind: 'state_digest'; schema: 1; tick: number | null; updatedAt: number }
  | { kind: 'chat_message'; schema: 1; id: string; text: string; sentAt: number; displayName: string; color: string };

interface GlitchRoomSeed {
  schema: 1;
  game_key: GlitchGameKey;
  room_code: string;
  city_name: string;
  grid_size: number;
  created_at: number;
  source_of_truth: 'glitch-lobby-event-log';
}

export class GlitchMultiplayerProvider {
  public readonly roomCode: string;
  public readonly peerId: string;
  public readonly isCreator: boolean;

  private readonly options: MultiplayerProviderOptions;
  private readonly gameKey: GlitchGameKey;
  private readonly client: GlitchClient;
  private readonly player: Player;
  private readonly players = new Map<string, Player>();
  private lobby: GlitchLobby | null = null;
  private gameState: MultiplayerGameState | null = null;
  private destroyed = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private presenceTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageSequence = 0;
  private worldPresence: GlitchPresence | null = null;
  private lastStateDigestAt = 0;
  private voiceToken: string | null = null;
  private voiceHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private voicePollTimer: ReturnType<typeof setInterval> | null = null;
  private voiceRecorder: MediaRecorder | null = null;
  private voiceStream: MediaStream | null = null;
  private lastVoiceSequence = 0;
  private voiceState: MultiplayerVoiceState = {
    status: 'idle',
    muted: false,
    deafened: false,
    speaking: false,
    error: null,
  };

  constructor(options: MultiplayerProviderOptions) {
    this.options = options;
    this.roomCode = options.roomCode.toUpperCase();
    this.gameKey = detectGlitchGameKeyFromPath();
    this.peerId = getStableUserInstallId(this.gameKey);
    this.client = new GlitchClient(getGlitchTitleConfig(this.gameKey));
    this.gameState = options.initialGameState || null;
    this.isCreator = !!options.initialGameState;
    const glitchUserName = getGlitchUserName(this.gameKey);
    this.player = {
      id: this.peerId,
      name: options.playerName || glitchUserName || generatePlayerName(),
      color: generatePlayerColor(),
      joinedAt: Date.now(),
      isHost: false,
    };
    this.players.set(this.peerId, this.player);
  }

  async connect(): Promise<void> {
    if (this.destroyed) return;

    this.lobby = this.isCreator
      ? await this.createLobby()
      : await this.findAndJoinLobby();

    await this.client.joinLobby(this.lobby.id, {
      player_id: this.peerId,
      display_name: this.player.name,
      ready: true,
      member_data: {
        color: this.player.color,
        game_key: this.gameKey,
        room_code: this.roomCode,
      },
    });

    this.options.onConnectionChange?.(true, this.players.size);
    this.options.onPlayersChange?.(Array.from(this.players.values()));
    emitAudioCue('multiplayer.join');

    if (!this.isCreator) {
      const initialState = createInitialStateFromLobbySeed(this.lobby, this.gameKey);
      if (initialState) {
        this.gameState = initialState;
        this.options.onStateReceived?.(initialState);
      }
      await this.replayLobbyMessagesFromStart();
    }

    if (GLITCH_MMO_PRESENCE_ENABLED) {
      await this.tryEnterMmoPresence();
    }
    this.startPollingLobbyMessages();
    this.startPresenceHeartbeat();
  }

  dispatchAction(action: GameActionInput): void {
    if (this.destroyed || !this.lobby) return;

    if (action.type === 'placeBatch' && !this.canFitLobbyPayload(action)) {
      this.dispatchSplitBatch(action.placements);
      return;
    }

    const fullAction: GameAction = {
      ...action,
      timestamp: Date.now(),
      playerId: this.peerId,
    };
    this.sendLobbyPayload({
      kind: 'game_action',
      schema: 1,
      action: fullAction,
      displayName: this.player.name,
      color: this.player.color,
    });
  }

  sendChatMessage(text: string): void {
    const trimmed = text.trim().slice(0, MAX_CHAT_TEXT_CHARS);
    if (this.destroyed || !this.lobby || !trimmed) return;

    this.sendLobbyPayload({
      kind: 'chat_message',
      schema: 1,
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: trimmed,
      sentAt: Date.now(),
      displayName: this.player.name,
      color: this.player.color,
    });
  }

  async startVoiceChat(): Promise<void> {
    if (this.destroyed || !this.lobby) return;
    if (this.voiceToken) return;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.setVoiceState({
        status: 'unsupported',
        error: 'This browser does not support the microphone APIs required for Glitch voice chat.',
      });
      return;
    }

    this.setVoiceState({ status: 'joining', error: null });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const existingRooms = await this.client.listVoiceRooms({
        lobby_id: this.lobby.id,
        topology: 'lobby',
        limit: 10,
      });
      const room = existingRooms.data.find((item) => item.state === 'active');
      const voiceJoin = room
        ? await this.client.joinVoiceRoom(room.id, {
            player_id: this.peerId,
            display_name: this.player.name,
            ttl_minutes: 30,
          })
        : await this.client.createVoiceRoom({
            player_id: this.peerId,
            display_name: this.player.name,
            lobby_id: this.lobby.id,
            provider: 'glitch_relay',
            topology: 'lobby',
            codec: 'opus',
            sample_rate: 48000,
            bitrate: 24000,
            frame_duration_ms: 20,
            channels: 1,
            max_participants: clampMaxPlayers(this.options.createOptions?.maxPlayers),
            ttl_minutes: 30,
          });

      this.voiceToken = voiceJoin.voice_token;
      this.voiceStream = stream;
      this.lastVoiceSequence = 0;
      this.setVoiceState({ status: 'connected', error: null });
      this.startVoiceHeartbeat();
      this.startVoicePolling();
      this.startVoiceRecorder(stream);
    } catch (error) {
      this.stopLocalVoiceCapture();
      this.voiceToken = null;
      this.setVoiceState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Voice chat could not start.',
      });
    }
  }

  async stopVoiceChat(): Promise<void> {
    const token = this.voiceToken;
    this.stopLocalVoiceCapture();
    this.voiceToken = null;
    this.lastVoiceSequence = 0;
    if (this.voiceHeartbeatTimer) {
      clearInterval(this.voiceHeartbeatTimer);
      this.voiceHeartbeatTimer = null;
    }
    if (this.voicePollTimer) {
      clearInterval(this.voicePollTimer);
      this.voicePollTimer = null;
    }
    if (token) {
      await this.client.leaveVoice({ voice_token: token }).catch(() => undefined);
    }
    this.setVoiceState({ status: 'idle', speaking: false, error: null });
  }

  setVoiceMuted(muted: boolean): void {
    this.setVoiceState({
      muted,
      status: muted && this.voiceState.status === 'connected' ? 'muted' : this.voiceState.status === 'muted' ? 'connected' : this.voiceState.status,
      speaking: muted ? false : this.voiceState.speaking,
    });
    this.sendVoiceHeartbeat().catch(() => undefined);
  }

  setVoiceDeafened(deafened: boolean): void {
    this.setVoiceState({
      deafened,
      status: deafened && this.voiceState.status === 'connected' ? 'deafened' : this.voiceState.status === 'deafened' ? 'connected' : this.voiceState.status,
    });
    this.sendVoiceHeartbeat().catch(() => undefined);
  }

  updateGameState(state: MultiplayerGameState): void {
    this.gameState = state;

    // Glitch lobby messages are a small control plane, not a database. We only publish
    // lightweight state digests here so peers can know a room is alive without pushing
    // oversized city snapshots through a 4 KB message route.
    const now = Date.now();
    if (!this.lobby || now - this.lastStateDigestAt < 10_000) return;
    this.lastStateDigestAt = now;
    const maybeTick = typeof state === 'object' && state && 'tick' in state && typeof state.tick === 'number'
      ? state.tick
      : null;
    this.sendLobbyPayload({ kind: 'state_digest', schema: 1, tick: maybeTick, updatedAt: now });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }
    const voiceToken = this.voiceToken;
    this.stopLocalVoiceCapture();
    this.voiceToken = null;
    if (this.voiceHeartbeatTimer) {
      clearInterval(this.voiceHeartbeatTimer);
      this.voiceHeartbeatTimer = null;
    }
    if (this.voicePollTimer) {
      clearInterval(this.voicePollTimer);
      this.voicePollTimer = null;
    }
    if (voiceToken) {
      this.client.leaveVoice({ voice_token: voiceToken }).catch(() => undefined);
    }

    if (this.worldPresence) {
      this.client.leaveWorld({ player_id: this.peerId }).catch(() => undefined);
      this.worldPresence = null;
    }
    if (this.lobby) {
      this.client.leaveLobby(this.lobby.id, { player_id: this.peerId }).catch(() => undefined);
    }
    emitAudioCue('multiplayer.leave');
  }

  private async createLobby(): Promise<GlitchLobby> {
    const maxPlayers = clampMaxPlayers(this.options.createOptions?.maxPlayers);
    const seed = buildRoomSeed(this.gameKey, this.roomCode, this.options.cityName, this.gameState);
    const response = await this.client.createLobby({
      player_id: this.peerId,
      display_name: this.player.name,
      lobby_type: this.options.createOptions?.isPublic === false ? 'invisible' : 'public',
      max_members: maxPlayers,
      region: 'us-central',
      game_mode: `${this.gameKey}-coop`,
      map_name: this.roomCode,
      metadata: {
        ...seed,
        max_builders: maxPlayers,
        created_by: this.peerId,
      },
    });
    return response.data;
  }

  private async findAndJoinLobby(): Promise<GlitchLobby> {
    const response = await this.client.searchLobbies({
      game_mode: `${this.gameKey}-coop`,
      map_name: this.roomCode,
      limit: 100,
    });
    const lobby = response.data.find((item) => item.metadata?.room_code === this.roomCode && item.state !== 'closed');
    if (!lobby) {
      this.options.onError?.('Room not found');
      throw new Error('Room not found');
    }
    if (!lobby.joinable || lobby.member_count >= lobby.max_members) {
      this.options.onError?.('Room is full or closed');
      throw new Error('Room is full or closed');
    }
    return lobby;
  }

  private startPollingLobbyMessages(): void {
    if (!this.lobby) return;

    const poll = async () => {
      if (this.destroyed || !this.lobby) return;
      try {
        const response = await this.client.listLobbyMessages(this.lobby.id, this.lastMessageSequence, 50);
        for (const message of response.data) {
          this.lastMessageSequence = Math.max(this.lastMessageSequence, message.sequence);
          this.handleLobbyMessage(message);
        }
      } catch (error) {
        console.warn('[Glitch Multiplayer] Message poll failed:', error);
      }
    };

    poll();
    this.pollTimer = setInterval(poll, LOBBY_MESSAGE_POLL_MS);
  }

  private async replayLobbyMessagesFromStart(): Promise<void> {
    if (!this.lobby) return;
    let afterSequence = 0;
    let keepReading = true;

    while (keepReading && !this.destroyed && this.lobby) {
      const response = await this.client.listLobbyMessages(this.lobby.id, afterSequence, 50);
      for (const message of response.data) {
        afterSequence = Math.max(afterSequence, message.sequence);
        this.lastMessageSequence = Math.max(this.lastMessageSequence, message.sequence);
        this.handleLobbyMessage(message);
      }
      keepReading = response.data.length === 50;
    }
  }

  private handleLobbyMessage(message: GlitchLobbyMessage): void {
    const payload = message.payload as Partial<GlitchLobbyPayload> | null;
    if (!payload || payload.schema !== 1) return;

    if (payload.kind === 'game_action' && payload.action && payload.action.playerId !== this.peerId) {
      const action = payload.action;
      const player = this.players.get(action.playerId) ?? {
        id: action.playerId,
        name: payload.displayName || 'Guest Player',
        color: payload.color || generatePlayerColor(),
        joinedAt: Date.now(),
        isHost: false,
      };
      this.players.set(player.id, player);
      this.options.onPlayersChange?.(Array.from(this.players.values()));
      this.options.onAction?.(action);
    }

    if (payload.kind === 'chat_message') {
      this.options.onChatMessage?.({
        id: payload.id || message.id,
        playerId: message.player_id,
        playerName: payload.displayName || 'Guest Player',
        text: String(payload.text || '').slice(0, MAX_CHAT_TEXT_CHARS),
        sentAt: payload.sentAt || Date.parse(message.created_at || '') || Date.now(),
        sequence: message.sequence,
        isLocal: message.player_id === this.peerId,
      });
    }
  }

  private async sendLobbyPayload(payload: GlitchLobbyPayload): Promise<void> {
    if (!this.lobby || this.destroyed) return;
    if (jsonByteLength(payload) > MAX_LOBBY_PAYLOAD_BYTES) {
      console.warn('[Glitch Multiplayer] Dropping oversized lobby payload. Use a realtime transport for larger state.');
      return;
    }
    try {
      await this.client.sendLobbyMessage(this.lobby.id, {
        player_id: this.peerId,
        message_type: payload.kind === 'chat_message' ? 'chat' : 'system',
        payload,
      });
    } catch (error) {
      console.warn('[Glitch Multiplayer] Failed to send lobby message:', error);
    }
  }

  private canFitLobbyPayload(action: GameActionInput): boolean {
    return jsonByteLength({
      kind: 'game_action',
      schema: 1,
      action,
      displayName: this.player.name,
      color: this.player.color,
    }) <= MAX_LOBBY_PAYLOAD_BYTES;
  }

  private dispatchSplitBatch(placements: Array<{ x: number; y: number; tool: MultiplayerTool }>): void {
    let chunk: Array<{ x: number; y: number; tool: MultiplayerTool }> = [];

    for (const placement of placements) {
      const candidate = [...chunk, placement];
      const action = { type: 'placeBatch' as const, placements: candidate };
      if (jsonByteLength(action) > MAX_LOBBY_PAYLOAD_BYTES && chunk.length > 0) {
        this.dispatchAction({ type: 'placeBatch', placements: chunk });
        chunk = [placement];
      } else {
        chunk = candidate;
      }
    }

    if (chunk.length > 0) {
      this.dispatchAction({ type: 'placeBatch', placements: chunk });
    }
  }

  private async tryEnterMmoPresence(): Promise<void> {
    try {
      const realms = await this.client.listRealms({ recommended: true, limit: 1 });
      const realm = realms.data.find((item) => item.status === 'active') ?? realms.data[0];
      if (!realm) return;

      const zones = await this.client.listZones(realm.id, { zone_type: 'city', limit: 1 });
      const zone = zones.data[0];
      if (!zone) return;

      const entered = await this.client.enterWorld({
        player_id: this.peerId,
        realm_id: realm.id,
        zone_id: zone.id,
        instance_kind: 'persistent',
        display_name: this.player.name,
        rich_status: this.gameKey === 'coaster' ? 'Building a theme park' : 'Building a shared city',
        pos_x: 0,
        pos_y: 0,
        pos_z: 0,
        heading: 0,
        metadata: {
          room_code: this.roomCode,
          color: this.player.color,
        },
        ttl_minutes: 5,
      });
      this.worldPresence = entered.presence;
    } catch (error) {
      console.warn('[Glitch MMO] Presence attach skipped:', error);
    }
  }

  private startPresenceHeartbeat(): void {
    if (!this.worldPresence) return;
    const heartbeat = () => {
      if (this.destroyed || !this.worldPresence) return;
      this.client.updatePresence({
        player_id: this.peerId,
        status: 'in_world',
        rich_status: this.gameKey === 'coaster' ? 'Building a theme park' : 'Building a shared city',
        ttl_minutes: 5,
      }).catch((error) => {
        console.warn('[Glitch MMO] Presence heartbeat failed:', error);
      });
    };
    this.presenceTimer = setInterval(heartbeat, PRESENCE_HEARTBEAT_MS);
  }

  private startVoiceHeartbeat(): void {
    if (this.voiceHeartbeatTimer) {
      clearInterval(this.voiceHeartbeatTimer);
    }
    this.sendVoiceHeartbeat().catch(() => undefined);
    this.voiceHeartbeatTimer = setInterval(() => {
      this.sendVoiceHeartbeat().catch((error) => {
        console.warn('[Glitch Voice] Heartbeat failed:', error);
      });
    }, VOICE_HEARTBEAT_MS);
  }

  private async sendVoiceHeartbeat(): Promise<void> {
    if (!this.voiceToken) return;
    const response = await this.client.heartbeatVoice({
      voice_token: this.voiceToken,
      muted: this.voiceState.muted,
      deafened: this.voiceState.deafened,
      speaking: this.voiceState.speaking,
      last_sequence: this.lastVoiceSequence,
      ttl_minutes: 30,
    });
    this.setVoiceState({
      muted: response.data.muted,
      deafened: response.data.deafened,
      speaking: response.data.speaking,
    });
  }

  private startVoicePolling(): void {
    if (this.voicePollTimer) {
      clearInterval(this.voicePollTimer);
    }

    const poll = async () => {
      if (!this.voiceToken || this.destroyed) return;
      try {
        const response = await this.client.pollVoicePackets({
          voice_token: this.voiceToken,
          after_sequence: this.lastVoiceSequence,
          limit: 20,
          exclude_self: true,
        });
        for (const packet of response.data) {
          this.lastVoiceSequence = Math.max(this.lastVoiceSequence, packet.sequence);
          this.playVoicePacket(packet);
        }
      } catch (error) {
        console.warn('[Glitch Voice] Poll failed:', error);
      }
    };

    poll();
    this.voicePollTimer = setInterval(poll, VOICE_POLL_MS);
  }

  private startVoiceRecorder(stream: MediaStream): void {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    this.voiceRecorder = recorder;

    recorder.ondataavailable = async (event) => {
      if (!this.voiceToken || this.destroyed || this.voiceState.muted || !event.data.size) return;
      if (event.data.size > MAX_VOICE_AUDIO_BYTES) {
        console.warn('[Glitch Voice] Dropping oversized audio packet.');
        return;
      }
      try {
        const payload = await blobToBase64(event.data);
        this.setVoiceState({ speaking: true });
        await this.client.sendVoicePacket({
          voice_token: this.voiceToken,
          packet_type: 'audio',
          payload,
          duration_ms: VOICE_TIMESLICE_MS,
        });
      } catch (error) {
        console.warn('[Glitch Voice] Failed to send audio packet:', error);
      } finally {
        window.setTimeout(() => {
          if (!this.destroyed) this.setVoiceState({ speaking: false });
        }, VOICE_TIMESLICE_MS * 2);
      }
    };

    recorder.onerror = () => {
      this.setVoiceState({ status: 'error', error: 'Microphone recording failed.' });
    };

    recorder.start(VOICE_TIMESLICE_MS);
  }

  private playVoicePacket(packet: GlitchVoicePacket): void {
    if (this.voiceState.deafened || packet.packet_type !== 'audio' || !packet.payload) return;
    try {
      const blob = base64ToBlob(packet.payload, 'audio/webm;codecs=opus');
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      audio.play().catch(() => URL.revokeObjectURL(url));
    } catch (error) {
      console.warn('[Glitch Voice] Failed to play voice packet:', error);
    }
  }

  private stopLocalVoiceCapture(): void {
    if (this.voiceRecorder && this.voiceRecorder.state !== 'inactive') {
      this.voiceRecorder.stop();
    }
    this.voiceRecorder = null;
    if (this.voiceStream) {
      for (const track of this.voiceStream.getTracks()) {
        track.stop();
      }
      this.voiceStream = null;
    }
  }

  private setVoiceState(next: Partial<MultiplayerVoiceState>): void {
    this.voiceState = {
      ...this.voiceState,
      ...next,
    };
    this.options.onVoiceStateChange?.(this.voiceState);
  }
}

export async function createGlitchMultiplayerProvider(options: MultiplayerProviderOptions): Promise<GlitchMultiplayerProvider> {
  const provider = new GlitchMultiplayerProvider(options);
  await provider.connect();
  return provider;
}

export async function listGlitchMultiplayerRooms(): Promise<MultiplayerRoomSummary[]> {
  const gameKey = detectGlitchGameKeyFromPath();
  const config = getGlitchTitleConfig(gameKey);
  if (!config.runtimeTitleToken) return [];

  const client = new GlitchClient(config);
  const response = await client.searchLobbies({
    game_mode: `${gameKey}-coop`,
    lobby_type: 'public',
    limit: 50,
  });

  return response.data
    .filter((lobby) => lobby.joinable && lobby.state !== 'closed')
    .map((lobby) => ({
      roomCode: String(lobby.metadata?.room_code || lobby.map_name || '').toUpperCase(),
      cityName: String(lobby.metadata?.city_name || (gameKey === 'coaster' ? 'Co-op Park' : 'Co-op City')),
      playerCount: lobby.member_count,
      maxPlayers: lobby.max_members,
      isPublic: lobby.lobby_type === 'public',
      updatedAt: Date.parse(lobby.updated_at || lobby.created_at || '') || Date.now(),
      sourceOfTruth: 'glitch-lobby-event-log' as const,
    }))
    .filter((room) => room.roomCode.length === 5);
}

function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function buildRoomSeed(gameKey: GlitchGameKey, roomCode: string, cityName: string, state: MultiplayerGameState | null): GlitchRoomSeed {
  const maybeGridSize = typeof state === 'object' && state && 'gridSize' in state && typeof state.gridSize === 'number'
    ? state.gridSize
    : DEFAULT_GRID_SIZE;
  return {
    schema: 1,
    game_key: gameKey,
    room_code: roomCode,
    city_name: cityName,
    grid_size: maybeGridSize,
    created_at: Date.now(),
    source_of_truth: 'glitch-lobby-event-log',
  };
}

function createInitialStateFromLobbySeed(lobby: GlitchLobby, gameKey: GlitchGameKey): MultiplayerGameState | null {
  const metadata = lobby.metadata as Partial<GlitchRoomSeed> | null;
  const cityName = typeof metadata?.city_name === 'string'
    ? metadata.city_name
    : gameKey === 'coaster' ? 'Co-op Park' : 'Co-op City';
  const gridSize = typeof metadata?.grid_size === 'number' && metadata.grid_size > 0
    ? metadata.grid_size
    : DEFAULT_GRID_SIZE;
  return gameKey === 'coaster'
    ? createInitialCoasterGameState(cityName)
    : createInitialGameState(gridSize, cityName);
}

function clampMaxPlayers(value: number | undefined): number {
  if (!Number.isFinite(value)) return 8;
  return Math.min(64, Math.max(1, Math.floor(value || 8)));
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBlob(value: string, type: string): Blob {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
}
