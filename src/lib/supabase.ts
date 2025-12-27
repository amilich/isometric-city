// Supabase client for multiplayer
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let supabaseClient: SupabaseClient<Database> | null = null;
if (isConfigured) {
  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseClient;

export function isMultiplayerAvailable(): boolean {
  return isConfigured && supabase !== null;
}

// Get typed client (throws if not configured)
export function getSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }
  return supabase;
}
