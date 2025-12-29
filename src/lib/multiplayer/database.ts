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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Lazy init: only create client when Supabase is configured
const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Maximum city size limit for Supabase storage (20MB)
const MAX_CITY_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export class CitySizeLimitError extends Error {
  public readonly sizeBytes: number;
  public readonly limitBytes: number;
  
  constructor(sizeBytes: number, limitBytes: number = MAX_CITY_SIZE_BYTES) {
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    const limitMB = (limitBytes / (1024 * 1024)).toFixed(0);
    super(`City size (${sizeMB}MB) exceeds maximum allowed size (${limitMB}MB)`);
    this.name = 'CitySizeLimitError';
    this.sizeBytes = sizeBytes;
    this.limitBytes = limitBytes;
  }
}

/**
 * Check if compressed data exceeds the size limit
 * @throws CitySizeLimitError if size exceeds limit
 */
function checkCitySize(compressed: string): void {
  // For URI-encoded strings (ASCII), byte length ≈ string length
  const sizeBytes = compressed.length;
  if (sizeBytes > MAX_CITY_SIZE_BYTES) {
    throw new CitySizeLimitError(sizeBytes);
  }
}

export interface GameRoomRow {
  room_code: string;
  city_name: string;
  game_state: string; // Compressed
  created_at: string;
  updated_at: string;
  player_count: number;
}

/**
 * Create a new game room in the database
 * PERF: Uses Web Worker for serialization + compression - no main thread blocking!
 * @throws CitySizeLimitError if the city size exceeds the maximum allowed size
 */
export async function createGameRoom(
  roomCode: string,
  cityName: string,
  gameState: GameState
): Promise<boolean> {
  if (!supabase) return false;
  try {
    // PERF: Both JSON.stringify and lz-string compression happen in the worker
    const compressed = await serializeAndCompressForDBAsync(gameState);
    
    // Check if city size exceeds limit before saving
    checkCitySize(compressed);
    
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
      return false;
    }

    return true;
  } catch (e) {
    // Re-throw CitySizeLimitError so callers can handle it specifically
    if (e instanceof CitySizeLimitError) {
      throw e;
    }
    console.error('[Database] Error creating room:', e);
    return false;
  }
}

/**
 * Load game state from a room
 */
export async function loadGameRoom(
  roomCode: string
): Promise<{ gameState: GameState; cityName: string } | null> {
  if (!supabase) return null;
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
 * @throws CitySizeLimitError if the city size exceeds the maximum allowed size
 */
export async function updateGameRoom(
  roomCode: string,
  gameState: GameState
): Promise<boolean> {
  if (!supabase) return false;
  try {
    // PERF: Both JSON.stringify and lz-string compression happen in the worker
    const compressed = await serializeAndCompressForDBAsync(gameState);
    
    // Check if city size exceeds limit before saving
    checkCitySize(compressed);
    
    const { error } = await supabase
      .from('game_rooms')
      .update({ game_state: compressed })
      .eq('room_code', roomCode.toUpperCase());

    if (error) {
      console.error('[Database] Failed to update room:', error);
      return false;
    }

    return true;
  } catch (e) {
    // Re-throw CitySizeLimitError so callers can handle it specifically
    if (e instanceof CitySizeLimitError) {
      throw e;
    }
    console.error('[Database] Error updating room:', e);
    return false;
  }
}

/**
 * Check if a room exists
 */
export async function roomExists(roomCode: string): Promise<boolean> {
  if (!supabase) return false;
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
  if (!supabase) return;
  try {
    await supabase
      .from('game_rooms')
      .update({ player_count: count })
      .eq('room_code', roomCode.toUpperCase());
  } catch (e) {
    console.error('[Database] Error updating player count:', e);
  }
}

