// Region sync functions for multiplayer
import { isMultiplayerAvailable, getSupabase } from './supabase';
import { getOrCreateDeviceToken } from './deviceToken';
import { compressGameState } from './shareState';
import type { GameState, AdjacentCity } from '@/types/game';
import type { Region, RegionWithCities, NeighborCity } from '@/types/multiplayer';
import type { Database } from '@/types/supabase';

type RegionRow = Database['public']['Tables']['regions']['Row'];
type CityRow = Database['public']['Tables']['cities']['Row'];

// Fetch all public regions
export async function fetchPublicRegions(): Promise<Region[]> {
  if (!isMultiplayerAvailable()) return [];
  
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('regions')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Failed to fetch regions:', error);
    return [];
  }
  
  if (!data) return [];
  
  return (data as RegionRow[]).map(row => ({
    id: row.id,
    name: row.name,
    creatorCityId: row.creator_city_id,
    maxSlots: row.max_slots,
    gridRows: row.grid_rows,
    gridCols: row.grid_cols,
    isPublic: row.is_public,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
  }));
}

// Fetch a region with all its cities
export async function fetchRegionWithCities(regionId: string): Promise<RegionWithCities | null> {
  if (!isMultiplayerAvailable()) return null;
  
  const supabase = getSupabase();
  
  const { data: regionData, error: regionError } = await supabase
    .from('regions')
    .select('*')
    .eq('id', regionId)
    .single();
  
  if (regionError || !regionData) {
    console.error('Failed to fetch region:', regionError);
    return null;
  }
  
  const region = regionData as RegionRow;
  
  const { data: citiesData, error: citiesError } = await supabase
    .from('cities')
    .select('id, city_name, population, money, year, slot_row, slot_col, updated_at')
    .eq('region_id', regionId);
  
  if (citiesError) {
    console.error('Failed to fetch cities:', citiesError);
    return null;
  }
  
  type PartialCityRow = Pick<CityRow, 'id' | 'city_name' | 'population' | 'money' | 'year' | 'slot_row' | 'slot_col' | 'updated_at'>;
  
  const cities: NeighborCity[] = ((citiesData || []) as PartialCityRow[])
    .filter(c => c.slot_row !== null && c.slot_col !== null)
    .map(c => ({
      id: c.id,
      cityName: c.city_name,
      population: c.population,
      money: c.money,
      year: c.year,
      slotRow: c.slot_row!,
      slotCol: c.slot_col!,
      updatedAt: c.updated_at,
    }));
  
  return {
    id: region.id,
    name: region.name,
    creatorCityId: region.creator_city_id,
    maxSlots: region.max_slots,
    gridRows: region.grid_rows,
    gridCols: region.grid_cols,
    isPublic: region.is_public,
    inviteCode: region.invite_code,
    createdAt: region.created_at,
    cities,
  };
}

// Create a new region
export async function createRegion(
  name: string,
  gridRows: number = 3,
  gridCols: number = 3,
  isPublic: boolean = true
): Promise<Region | null> {
  if (!isMultiplayerAvailable()) return null;
  
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('regions')
    .insert({
      name,
      grid_rows: gridRows,
      grid_cols: gridCols,
      max_slots: gridRows * gridCols,
      is_public: isPublic,
    })
    .select()
    .single();
  
  if (error || !data) {
    console.error('Failed to create region:', error);
    return null;
  }
  
  const row = data as RegionRow;
  
  return {
    id: row.id,
    name: row.name,
    creatorCityId: row.creator_city_id,
    maxSlots: row.max_slots,
    gridRows: row.grid_rows,
    gridCols: row.grid_cols,
    isPublic: row.is_public,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
  };
}

// Sync city to Supabase
export async function syncCityToCloud(
  state: GameState,
  regionId: string | null,
  slotRow: number | null,
  slotCol: number | null
): Promise<boolean> {
  if (!isMultiplayerAvailable()) return false;
  
  const supabase = getSupabase();
  const deviceToken = getOrCreateDeviceToken();
  const stateBlob = compressGameState(state);
  
  const { error } = await supabase
    .from('cities')
    .upsert({
      id: state.id,
      device_token: deviceToken,
      region_id: regionId,
      slot_row: slotRow,
      slot_col: slotCol,
      city_name: state.cityName,
      population: state.stats.population,
      money: state.stats.money,
      year: state.year,
      month: state.month,
      grid_size: state.gridSize,
      state_blob: stateBlob,
      updated_at: new Date().toISOString(),
    });
  
  if (error) {
    console.error('Failed to sync city:', error);
    return false;
  }
  
  return true;
}

// Join a region by claiming a slot
export async function joinRegion(
  state: GameState,
  regionId: string,
  slotRow: number,
  slotCol: number
): Promise<boolean> {
  if (!isMultiplayerAvailable()) return false;
  
  const supabase = getSupabase();
  
  // Check if slot is available
  const { data: existingCity } = await supabase
    .from('cities')
    .select('id')
    .eq('region_id', regionId)
    .eq('slot_row', slotRow)
    .eq('slot_col', slotCol)
    .single();
  
  if (existingCity) {
    console.error('Slot already taken');
    return false;
  }
  
  return syncCityToCloud(state, regionId, slotRow, slotCol);
}

// Leave a region
export async function leaveRegion(cityId: string): Promise<boolean> {
  if (!isMultiplayerAvailable()) return false;
  
  const supabase = getSupabase();
  const deviceToken = getOrCreateDeviceToken();
  
  const { error } = await supabase
    .from('cities')
    .update({
      region_id: null,
      slot_row: null,
      slot_col: null,
    })
    .eq('id', cityId)
    .eq('device_token', deviceToken);
  
  if (error) {
    console.error('Failed to leave region:', error);
    return false;
  }
  
  return true;
}

// Get adjacent cities for game state
export async function fetchAdjacentCities(
  regionId: string,
  mySlotRow: number,
  mySlotCol: number,
  myCityId: string
): Promise<AdjacentCity[]> {
  if (!isMultiplayerAvailable()) return [];
  
  const supabase = getSupabase();
  
  const { data: citiesData, error } = await supabase
    .from('cities')
    .select('id, city_name, population, slot_row, slot_col')
    .eq('region_id', regionId)
    .neq('id', myCityId);
  
  if (error || !citiesData) {
    console.error('Failed to fetch adjacent cities:', error);
    return [];
  }
  
  type AdjacentCityRow = Pick<CityRow, 'id' | 'city_name' | 'population' | 'slot_row' | 'slot_col'>;
  
  const adjacentCities: AdjacentCity[] = [];
  
  for (const city of (citiesData as AdjacentCityRow[])) {
    if (city.slot_row === null || city.slot_col === null) continue;
    
    let direction: 'north' | 'south' | 'east' | 'west' | null = null;
    
    if (city.slot_row === mySlotRow - 1 && city.slot_col === mySlotCol) {
      direction = 'north';
    } else if (city.slot_row === mySlotRow + 1 && city.slot_col === mySlotCol) {
      direction = 'south';
    } else if (city.slot_row === mySlotRow && city.slot_col === mySlotCol + 1) {
      direction = 'east';
    } else if (city.slot_row === mySlotRow && city.slot_col === mySlotCol - 1) {
      direction = 'west';
    }
    
    if (direction) {
      adjacentCities.push({
        id: city.id,
        name: city.city_name,
        direction,
        connected: true,
        discovered: true,
      });
    }
  }
  
  return adjacentCities;
}

// Fetch the current city's region info from the cloud
export async function fetchCityRegionInfo(
  cityId: string
): Promise<{ regionId: string; regionName: string; slotRow: number; slotCol: number } | null> {
  if (!isMultiplayerAvailable()) return null;
  
  const supabase = getSupabase();
  const deviceToken = getOrCreateDeviceToken();
  
  // Fetch the city with its region info
  const { data: cityData, error: cityError } = await supabase
    .from('cities')
    .select('region_id, slot_row, slot_col')
    .eq('id', cityId)
    .eq('device_token', deviceToken)
    .single();
  
  if (cityError || !cityData) {
    // City not found in cloud (first time or different device)
    return null;
  }
  
  const city = cityData as { region_id: string | null; slot_row: number | null; slot_col: number | null };
  
  if (!city.region_id || city.slot_row === null || city.slot_col === null) {
    // City is not in a region
    return null;
  }
  
  // Fetch the region name
  const { data: regionData, error: regionError } = await supabase
    .from('regions')
    .select('name')
    .eq('id', city.region_id)
    .single();
  
  if (regionError || !regionData) {
    console.error('Failed to fetch region name:', regionError);
    return null;
  }
  
  return {
    regionId: city.region_id,
    regionName: (regionData as { name: string }).name,
    slotRow: city.slot_row,
    slotCol: city.slot_col,
  };
}

// Subscribe to real-time updates for cities in a region
export function subscribeToRegionUpdates(
  regionId: string,
  onCityUpdate: (city: NeighborCity) => void
): (() => void) | null {
  if (!isMultiplayerAvailable()) return null;
  
  const supabase = getSupabase();
  const channel = supabase
    .channel(`region:${regionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'cities',
        filter: `region_id=eq.${regionId}`,
      },
      (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          const city = payload.new as {
            id: string;
            city_name: string;
            population: number;
            money: number;
            year: number;
            slot_row: number | null;
            slot_col: number | null;
            updated_at: string;
          };
          
          if (city.slot_row !== null && city.slot_col !== null) {
            onCityUpdate({
              id: city.id,
              cityName: city.city_name,
              population: city.population,
              money: city.money,
              year: city.year,
              slotRow: city.slot_row,
              slotCol: city.slot_col,
              updatedAt: city.updated_at,
            });
          }
        }
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}
