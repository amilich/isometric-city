// Supabase database functions for multiplayer game state persistence
// 
// Required Supabase table schema (run this in Supabase SQL editor):
// 
// CREATE TABLE game_rooms (
//   room_code TEXT PRIMARY KEY,
//   city_name TEXT NOT NULL,
//   game_state TEXT NOT NULL, -- Compressed game state (LZ-string)
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//   player_count INTEGER DEFAULT 1
// );
//
// -- Enforce a max city save size (20 MiB) at the database level.
// -- (The value stored is compressed text; this caps that string's byte size.)
// ALTER TABLE game_rooms
//   ADD CONSTRAINT game_rooms_game_state_max_20mb
//   CHECK (octet_length(game_state) <= 20 * 1024 * 1024);
// 
// -- Enable RLS
// ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
// 
// -- Allow anyone to read/write (for anonymous multiplayer)
// CREATE POLICY "Allow public access" ON game_rooms
//   FOR ALL USING (true) WITH CHECK (true);
// 
// -- Auto-update updated_at
// CREATE OR REPLACE FUNCTION update_updated_at()
// RETURNS TRIGGER AS $$
// BEGIN
//   NEW.updated_at = NOW();
//   RETURN NEW;
// END;
// $$ LANGUAGE plpgsql;
// 
// CREATE TRIGGER game_rooms_updated_at
//   BEFORE UPDATE ON game_rooms
//   FOR EACH ROW
//   EXECUTE FUNCTION update_updated_at();

import { createClient } from '@supabase/supabase-js';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { GameState } from '@/types/game';
import { serializeAndCompressForDBAsync } from '@/lib/saveWorkerManager';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_GAME_STATE_BYTES = 20 * 1024 * 1024; // 20 MiB

export interface GameRoomRow {
  room_code: string;
  city_name: string;
  game_state: string; // Compressed
  created_at: string;
  updated_at: string;
  player_count: number;
}

export type SaveStateErrorCode = 'CITY_TOO_LARGE' | 'DB_ERROR' | 'UNKNOWN';

export type SaveStateResult =
  | { ok: true }
  | { ok: false; code: SaveStateErrorCode; message: string };

function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Create a new game room in the database
 * PERF: Uses Web Worker for serialization + compression - no main thread blocking!
 */
export async function createGameRoom(
  roomCode: string,
  cityName: string,
  gameState: GameState
): Promise<SaveStateResult> {
  try {
    // PERF: Both JSON.stringify and lz-string compression happen in the worker
    const compressed = await serializeAndCompressForDBAsync(gameState);

    const byteLen = getUtf8ByteLength(compressed);
    if (byteLen > MAX_GAME_STATE_BYTES) {
      return {
        ok: false,
        code: 'CITY_TOO_LARGE',
        message: `City is too large to save (max ${MAX_GAME_STATE_BYTES} bytes).`,
      };
    }
    
    const { error } = await supabase
      .from('game_rooms')
      .insert({
        room_code: roomCode.toUpperCase(),
        city_name: cityName,
        game_state: compressed,
        player_count: 1,
      });

    if (error) {
      console.error('[Database] Failed to create room:', error);
      return { ok: false, code: 'DB_ERROR', message: error.message };
    }

    return { ok: true };
  } catch (e) {
    console.error('[Database] Error creating room:', e);
    return {
      ok: false,
      code: 'UNKNOWN',
      message: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/**
 * Load game state from a room
 */
export async function loadGameRoom(
  roomCode: string
): Promise<{ gameState: GameState; cityName: string } | null> {
  try {
    const { data, error } = await supabase
      .from('game_rooms')
      .select('game_state, city_name')
      .eq('room_code', roomCode.toUpperCase())
      .single();

    if (error || !data) {
      console.error('[Database] Failed to load room:', error);
      return null;
    }

    const decompressed = decompressFromEncodedURIComponent(data.game_state);
    if (!decompressed) {
      console.error('[Database] Failed to decompress state');
      return null;
    }

    const gameState = JSON.parse(decompressed) as GameState;
    return { gameState, cityName: data.city_name };
  } catch (e) {
    console.error('[Database] Error loading room:', e);
    return null;
  }
}

/**
 * Update game state in a room
 * PERF: Uses Web Worker for serialization + compression - no main thread blocking!
 */
export async function updateGameRoom(
  roomCode: string,
  gameState: GameState
): Promise<SaveStateResult> {
  try {
    // PERF: Both JSON.stringify and lz-string compression happen in the worker
    const compressed = await serializeAndCompressForDBAsync(gameState);

    const byteLen = getUtf8ByteLength(compressed);
    if (byteLen > MAX_GAME_STATE_BYTES) {
      return {
        ok: false,
        code: 'CITY_TOO_LARGE',
        message: `City is too large to save (max ${MAX_GAME_STATE_BYTES} bytes).`,
      };
    }
    
    const { error } = await supabase
      .from('game_rooms')
      .update({ game_state: compressed })
      .eq('room_code', roomCode.toUpperCase());

    if (error) {
      console.error('[Database] Failed to update room:', error);
      return { ok: false, code: 'DB_ERROR', message: error.message };
    }

    return { ok: true };
  } catch (e) {
    console.error('[Database] Error updating room:', e);
    return {
      ok: false,
      code: 'UNKNOWN',
      message: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/**
 * Check if a room exists
 */
export async function roomExists(roomCode: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('game_rooms')
      .select('room_code')
      .eq('room_code', roomCode.toUpperCase())
      .single();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Update player count for a room
 */
export async function updatePlayerCount(
  roomCode: string,
  count: number
): Promise<void> {
  try {
    await supabase
      .from('game_rooms')
      .update({ player_count: count })
      .eq('room_code', roomCode.toUpperCase());
  } catch (e) {
    console.error('[Database] Error updating player count:', e);
  }
}

