import { GLITCH_API_BASE_URL, GlitchTitleRuntimeConfig } from './config';

export class GlitchApiError extends Error {
  public readonly status: number;
  public readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'GlitchApiError';
    this.status = status;
    this.payload = payload;
  }
}

export interface GlitchInstall {
  id: string;
  title_id: string;
  user_id: string | null;
  user_install_id: string;
  platform: string | null;
  device_type: string | null;
  operating_system: string | null;
  game_version: string | null;
  build_type: 'production' | 'demo' | 'playtest' | null;
  created_at?: string;
  updated_at?: string;
}

export interface GlitchInstallValidation {
  valid: boolean;
  user_id?: string | null;
  user_name?: string | null;
  license_type?: 'free' | 'trial' | 'purchased' | 'subscription' | 'demo' | 'playtest' | null;
  build_type?: 'production' | 'demo' | 'playtest' | null;
  is_preview_build?: boolean | null;
  non_revenue_build?: boolean | null;
  has_full_access?: boolean | null;
  free_play_access?: boolean | null;
  subscription_required_for_free_streaming?: boolean | null;
  requires_subscription?: boolean | null;
  trial_time_remaining?: number | null;
  rental_time_remaining?: number | null;
  disable_playtime_tracking?: boolean | null;
  server_time?: string | null;
  reason?: string | null;
  code?: string | null;
  error?: string | null;
  message?: string | null;
}

export interface GlitchGameSave {
  id: string;
  title_id: string;
  user_id: string;
  slot_index: number;
  slot_name: string | null;
  save_type: 'manual' | 'auto' | 'checkpoint' | 'quicksave';
  version: number;
  checksum: string;
  payload: string | null;
  size_bytes: number;
  is_conflicted: boolean;
  metadata: Record<string, unknown> | null;
  platform: string | null;
  device_id: string | null;
  game_version: string | null;
  client_timestamp: string | null;
  last_played_at: string | null;
  play_duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface GlitchSaveConflict {
  status: 'conflict';
  save_id: string;
  conflict_id: string;
  server_version: number;
  your_base_version: number;
}

export interface GlitchProgressionSubmitResponse {
  status: 'success' | 'duplicate';
  run_id?: string | null;
  global_community_stats?: Record<string, number>;
  player_feedback?: {
    newly_unlocked?: Array<{ api_key: string; name: string; description: string }>;
    current_stats?: unknown[];
  };
  record?: unknown;
}

export interface GlitchBehaviorEventRequest {
  game_install_id: string;
  step_key: string;
  action_key: string;
  metadata?: Record<string, unknown>;
  event_timestamp?: string;
}

export interface GlitchLobby {
  id: string;
  title_id: string;
  server_id: string | null;
  owner_player_id: string;
  lobby_type: 'public' | 'invisible' | 'friends_only' | 'private';
  state: 'waiting' | 'ready' | 'in_game' | 'closed';
  joinable: boolean;
  max_members: number;
  member_count: number;
  region: string | null;
  game_mode: string | null;
  map_name: string | null;
  metadata: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GlitchLobbyMessage {
  id: string;
  lobby_id: string;
  player_id: string;
  message_type: 'chat' | 'binary' | 'system' | 'ready' | 'invite' | 'kick' | 'voice';
  payload: unknown;
  sequence: number;
  created_at?: string | null;
}

export interface GlitchRealm {
  id: string;
  title_id: string;
  name: string;
  slug: string | null;
  region: string | null;
  status: 'active' | 'locked' | 'maintenance' | 'full' | 'offline';
  population_cap: number;
  current_population: number;
  recommended: boolean;
  metadata: Record<string, unknown>;
}

export interface GlitchZone {
  id: string;
  title_id: string;
  realm_id: string;
  zone_key: string;
  display_name: string;
  zone_type: 'overworld' | 'city' | 'dungeon' | 'raid' | 'arena' | 'instanced';
  is_instanced: boolean;
  max_players_per_instance: number;
  grid_cell_size: number;
  metadata: Record<string, unknown>;
}

export interface GlitchPresence {
  id: string;
  title_id: string;
  player_id: string;
  realm_id: string | null;
  zone_id: string | null;
  instance_id: string | null;
  display_name: string | null;
  status: 'online' | 'in_queue' | 'in_world' | 'away' | 'offline';
  rich_status: string | null;
  pos_x: number | null;
  pos_y: number | null;
  pos_z: number | null;
  heading: number | null;
  grid_cell: string | null;
  metadata: Record<string, unknown>;
}

export interface GlitchVoiceRoom {
  id: string;
  title_id: string;
  lobby_id: string | null;
  server_id: string | null;
  owner_player_id: string;
  provider: 'glitch_relay' | 'external';
  topology: 'lobby' | 'server' | 'party' | 'proximity';
  state: 'active' | 'closed';
  region: string | null;
  codec: 'opus' | 'pcm16' | 'aac';
  sample_rate: number;
  bitrate: number;
  frame_duration_ms: 10 | 20 | 40 | 60;
  channels: 1 | 2;
  max_participants: number;
  participant_count: number;
  recording_allowed: boolean;
  moderation_enabled: boolean;
  connection_config: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface GlitchVoiceParticipant {
  id: string;
  voice_room_id: string;
  player_id: string;
  display_name: string | null;
  status: 'joined' | 'left' | 'muted' | 'kicked';
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  last_sequence: number;
  metadata: Record<string, unknown>;
}

export interface GlitchVoicePacket {
  id: string;
  voice_room_id: string;
  participant_id: string | null;
  player_id: string;
  packet_type: 'audio' | 'speaking' | 'mute_state' | 'offer' | 'answer' | 'ice' | 'control';
  payload: string;
  sequence: number;
  duration_ms: number | null;
  sent_at?: string | null;
}

export class GlitchClient {
  readonly titleId: string;
  readonly titleName: string;
  readonly token: string;
  private readonly apiBaseUrl: string;

  constructor(config: GlitchTitleRuntimeConfig, apiBaseUrl: string = GLITCH_API_BASE_URL) {
    if (!config.runtimeTitleToken) {
      throw new Error(`Glitch is enabled for ${config.titleName}, but no runtime title token is configured.`);
    }
    this.titleId = config.titleId;
    this.titleName = config.titleName;
    this.token = config.runtimeTitleToken;
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
  }

  createInstall(body: Record<string, unknown>): Promise<{ data: GlitchInstall }> {
    return this.request(`/titles/${this.titleId}/installs`, { method: 'POST', body });
  }

  validateInstall(installId: string, body: Record<string, unknown> = {}): Promise<GlitchInstallValidation> {
    return this.request(`/titles/${this.titleId}/installs/${installId}/validate`, { method: 'POST', body });
  }

  listSaves(installId: string, includePayload = false): Promise<{ data: GlitchGameSave[] }> {
    const query = includePayload ? '?include_payload=1' : '?include_payload=0';
    return this.request(`/titles/${this.titleId}/installs/${installId}/saves${query}`);
  }

  storeSave(installId: string, body: Record<string, unknown>): Promise<GlitchGameSave> {
    return this.request(`/titles/${this.titleId}/installs/${installId}/saves`, { method: 'POST', body });
  }

  resolveSaveConflict(installId: string, saveId: string, body: { conflict_id: string; choice: 'keep_server' | 'use_client' }): Promise<GlitchGameSave> {
    return this.request(`/titles/${this.titleId}/installs/${installId}/saves/${saveId}/resolve`, { method: 'POST', body });
  }

  submitProgressionRun(installId: string, body: Record<string, unknown>): Promise<GlitchProgressionSubmitResponse> {
    return this.request(`/titles/${this.titleId}/installs/${installId}/submit`, { method: 'POST', body });
  }

  getPlayerAchievements(installId: string): Promise<{ data: unknown[] }> {
    return this.request(`/titles/${this.titleId}/installs/${installId}/achievements`);
  }

  getPlayerStats(installId: string): Promise<{ data: unknown[] }> {
    return this.request(`/titles/${this.titleId}/installs/${installId}/stats`);
  }

  getLeaderboard(apiKey: string, params: Record<string, string | number | boolean> = {}): Promise<{ data: unknown[] }> {
    const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/titles/${this.titleId}/leaderboards/${encodeURIComponent(apiKey)}${suffix}`);
  }

  createEvent(body: GlitchBehaviorEventRequest): Promise<{ data: unknown }> {
    return this.request(`/titles/${this.titleId}/events`, { method: 'POST', body });
  }

  searchLobbies(params: Record<string, string | number | boolean> = {}): Promise<{ data: GlitchLobby[] }> {
    const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/titles/${this.titleId}/multiplayer/lobbies${suffix}`);
  }

  createLobby(body: Record<string, unknown>): Promise<{ data: GlitchLobby }> {
    return this.request(`/titles/${this.titleId}/multiplayer/lobbies`, { method: 'POST', body });
  }

  joinLobby(lobbyId: string, body: Record<string, unknown>): Promise<{ data: unknown }> {
    return this.request(`/titles/${this.titleId}/multiplayer/lobbies/${lobbyId}/join`, { method: 'POST', body });
  }

  leaveLobby(lobbyId: string, body: Record<string, unknown>): Promise<{ data: unknown | null }> {
    return this.request(`/titles/${this.titleId}/multiplayer/lobbies/${lobbyId}/leave`, { method: 'POST', body });
  }

  listLobbyMessages(lobbyId: string, afterSequence = 0, limit = 50): Promise<{ data: GlitchLobbyMessage[] }> {
    const query = new URLSearchParams({ after_sequence: String(afterSequence), limit: String(limit) });
    return this.request(`/titles/${this.titleId}/multiplayer/lobbies/${lobbyId}/messages?${query.toString()}`);
  }

  sendLobbyMessage(lobbyId: string, body: Record<string, unknown>): Promise<{ data: GlitchLobbyMessage }> {
    return this.request(`/titles/${this.titleId}/multiplayer/lobbies/${lobbyId}/messages`, { method: 'POST', body });
  }

  listVoiceRooms(params: Record<string, string | number | boolean> = {}): Promise<{ data: GlitchVoiceRoom[] }> {
    const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/titles/${this.titleId}/multiplayer/voice/rooms${suffix}`);
  }

  createVoiceRoom(body: Record<string, unknown>): Promise<{ voice_room: GlitchVoiceRoom; participant: GlitchVoiceParticipant; voice_token: string }> {
    return this.request(`/titles/${this.titleId}/multiplayer/voice/rooms`, { method: 'POST', body });
  }

  joinVoiceRoom(voiceRoomId: string, body: Record<string, unknown>): Promise<{ room: GlitchVoiceRoom; participant: GlitchVoiceParticipant; voice_token: string }> {
    return this.request(`/titles/${this.titleId}/multiplayer/voice/rooms/${voiceRoomId}/join`, { method: 'POST', body });
  }

  heartbeatVoice(body: Record<string, unknown>): Promise<{ data: GlitchVoiceParticipant }> {
    return this.request('/multiplayer/voice/heartbeat', { method: 'POST', body, auth: false });
  }

  sendVoicePacket(body: Record<string, unknown>): Promise<{ data: GlitchVoicePacket }> {
    return this.request('/multiplayer/voice/packets', { method: 'POST', body, auth: false });
  }

  pollVoicePackets(body: Record<string, unknown>): Promise<{ data: GlitchVoicePacket[] }> {
    return this.request('/multiplayer/voice/poll', { method: 'POST', body, auth: false });
  }

  leaveVoice(body: Record<string, unknown>): Promise<{ data: GlitchVoiceParticipant }> {
    return this.request('/multiplayer/voice/leave', { method: 'POST', body, auth: false });
  }

  listRealms(params: Record<string, string | number | boolean> = {}): Promise<{ data: GlitchRealm[] }> {
    const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/titles/${this.titleId}/multiplayer/realms${suffix}`);
  }

  listZones(realmId: string, params: Record<string, string | number | boolean> = {}): Promise<{ data: GlitchZone[] }> {
    const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/titles/${this.titleId}/multiplayer/realms/${realmId}/zones${suffix}`);
  }

  enterWorld(body: Record<string, unknown>): Promise<{ instance: unknown; presence: GlitchPresence }> {
    return this.request(`/titles/${this.titleId}/multiplayer/world/enter`, { method: 'POST', body });
  }

  updatePresence(body: Record<string, unknown>): Promise<GlitchPresence> {
    return this.request(`/titles/${this.titleId}/multiplayer/world/presence`, { method: 'POST', body });
  }

  leaveWorld(body: Record<string, unknown>): Promise<GlitchPresence> {
    return this.request(`/titles/${this.titleId}/multiplayer/world/leave`, { method: 'POST', body });
  }

  negotiateRealtime(body: Record<string, unknown>): Promise<unknown> {
    return this.request(`/titles/${this.titleId}/multiplayer/realtime/negotiate`, { method: 'POST', body });
  }

  private async request<T>(path: string, options: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.auth !== false) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload && 'message' in payload && typeof payload.message === 'string'
          ? payload.message
          : `Glitch API request failed with HTTP ${response.status}`;
      throw new GlitchApiError(response.status, message, payload);
    }

    return payload as T;
  }
}
