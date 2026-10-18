import { GlitchApiError, GlitchClient, GlitchGameSave, GlitchSaveConflict } from './client';
import { GlitchGameKey } from './config';

const CLOUD_SAVE_VERSION_PREFIX = 'glitch-cloud-save-version';
const CLOUD_SAVE_SLOT_PREFIX = 'glitch-cloud-save-id';
const MAX_DECODED_SAVE_BYTES = 10 * 1024 * 1024;

export interface StoreCloudSaveOptions {
  gameKey: GlitchGameKey;
  installId: string;
  slotIndex: number;
  slotName: string;
  saveType: 'manual' | 'auto' | 'checkpoint' | 'quicksave';
  state: unknown;
  metadata?: Record<string, unknown>;
  playDurationSeconds?: number;
}

export interface StoreCloudSaveResult {
  status: 'saved' | 'conflict' | 'guest_or_denied' | 'too_large' | 'error';
  save?: GlitchGameSave;
  conflict?: GlitchSaveConflict;
  error?: unknown;
}

export async function storeCloudSave(client: GlitchClient, options: StoreCloudSaveOptions): Promise<StoreCloudSaveResult> {
  try {
    const rawBytes = new TextEncoder().encode(JSON.stringify(options.state));
    if (rawBytes.byteLength > MAX_DECODED_SAVE_BYTES) {
      return { status: 'too_large' };
    }

    const payload = bytesToBase64(rawBytes);
    const checksum = await sha256Hex(rawBytes);
    const baseVersion = getKnownCloudVersion(options.gameKey, options.slotIndex);

    const save = await client.storeSave(options.installId, {
      slot_index: options.slotIndex,
      payload,
      checksum,
      save_type: options.saveType,
      client_timestamp: new Date().toISOString(),
      base_version: baseVersion,
      slot_name: options.slotName,
      metadata: options.metadata,
      platform: 'web',
      game_version: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
      last_played_at: new Date().toISOString(),
      play_duration_seconds: options.playDurationSeconds,
    });

    rememberCloudSave(options.gameKey, options.slotIndex, save);
    return { status: 'saved', save };
  } catch (error) {
    if (error instanceof GlitchApiError && error.status === 409 && isSaveConflict(error.payload)) {
      return { status: 'conflict', conflict: error.payload };
    }
    if (error instanceof GlitchApiError && error.status === 403) {
      return { status: 'guest_or_denied', error };
    }
    return { status: 'error', error };
  }
}

export async function loadCloudSavePayload(client: GlitchClient, installId: string, slotIndex: number): Promise<unknown | null> {
  const saves = await client.listSaves(installId, true);
  const save = saves.data.find((item) => item.slot_index === slotIndex);
  if (!save?.payload) return null;
  const bytes = base64ToBytes(save.payload);
  const checksum = await sha256Hex(bytes);
  if (checksum !== save.checksum) {
    throw new Error('Cloud save checksum mismatch.');
  }
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

export function getKnownCloudVersion(gameKey: GlitchGameKey, slotIndex: number): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(`${CLOUD_SAVE_VERSION_PREFIX}:${gameKey}:${slotIndex}`);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function rememberCloudSave(gameKey: GlitchGameKey, slotIndex: number, save: GlitchGameSave): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${CLOUD_SAVE_VERSION_PREFIX}:${gameKey}:${slotIndex}`, String(save.version));
  window.localStorage.setItem(`${CLOUD_SAVE_SLOT_PREFIX}:${gameKey}:${slotIndex}`, save.id);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hashableBytes = new Uint8Array(bytes.byteLength);
  hashableBytes.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', hashableBytes.buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function isSaveConflict(value: unknown): value is GlitchSaveConflict {
  return !!value
    && typeof value === 'object'
    && 'status' in value
    && value.status === 'conflict'
    && 'save_id' in value
    && 'conflict_id' in value;
}
