// Resource Sharing API functions
import { isMultiplayerAvailable, getSupabase } from './supabase';
import type { Database } from '@/types/supabase';
import type {
  ResourceSharingAgreement,
  CitySharingSettings,
  SharingTransaction,
  SharableResource,
  ResourceSharingSummary,
} from '@/types/multiplayer';
import {
  RESOURCE_SHARING_FEES,
  RESOURCE_BASE_PRICES,
  calculateSharingCost,
} from '@/types/multiplayer';

type ResourceSharingRow = Database['public']['Tables']['resource_sharing']['Row'];
type CitySharingSettingsRow = Database['public']['Tables']['city_sharing_settings']['Row'];
type SharingTransactionRow = Database['public']['Tables']['sharing_transactions']['Row'];

// ============================================================================
// MAPPING FUNCTIONS
// ============================================================================

function mapResourceSharing(row: ResourceSharingRow): ResourceSharingAgreement {
  return {
    id: row.id,
    fromCityId: row.from_city_id,
    toCityId: row.to_city_id,
    fromCityName: row.from_city_name,
    toCityName: row.to_city_name,
    regionId: row.region_id,
    resourceType: row.resource_type as SharableResource,
    quantity: row.quantity,
    feeRate: row.fee_rate,
    active: row.active,
    autoShare: row.auto_share,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSharingSettings(row: CitySharingSettingsRow): CitySharingSettings {
  return {
    id: row.id,
    cityId: row.city_id,
    sharePower: row.share_power,
    shareWater: row.share_water,
    shareFire: row.share_fire,
    sharePolice: row.share_police,
    shareWorkers: row.share_workers,
    shareEducation: row.share_education,
    minPowerSurplus: row.min_power_surplus,
    minWaterSurplus: row.min_water_surplus,
    updatedAt: row.updated_at,
  };
}

function mapSharingTransaction(row: SharingTransactionRow): SharingTransaction {
  return {
    id: row.id,
    sharingId: row.sharing_id,
    fromCityId: row.from_city_id,
    toCityId: row.to_city_id,
    resourceType: row.resource_type as SharableResource,
    quantity: row.quantity,
    amountPaid: row.amount_paid,
    feeEarned: row.fee_earned,
    createdAt: row.created_at,
  };
}

// ============================================================================
// SHARING SETTINGS
// ============================================================================

/**
 * Get or create sharing settings for a city
 */
export async function getOrCreateSharingSettings(
  cityId: string
): Promise<CitySharingSettings | null> {
  if (!isMultiplayerAvailable()) return null;
  
  const supabase = getSupabase();
  
  // Try to get existing settings first
  const { data: existing } = await supabase
    .from('city_sharing_settings')
    .select('*')
    .eq('city_id', cityId)
    .single();
  
  if (existing) {
    return mapSharingSettings(existing as CitySharingSettingsRow);
  }
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Create new settings
  const { data: created, error } = await supabase
    .from('city_sharing_settings')
    .upsert({ city_id: cityId }, {
      onConflict: 'city_id',
    })
    .select()
    .single();
  
  if (error) {
    // If upsert failed, try to fetch again
    const { data: retryFetch } = await supabase
      .from('city_sharing_settings')
      .select('*')
      .eq('city_id', cityId)
      .single();
    
    if (retryFetch) {
      return mapSharingSettings(retryFetch as CitySharingSettingsRow);
    }
    
    console.error('Failed to create sharing settings:', error?.message || error?.code || JSON.stringify(error));
    return null;
  }
  
  if (!created) {
    console.error('Sharing settings created but no data returned');
    return null;
  }
  
  return mapSharingSettings(created as CitySharingSettingsRow);
}

/**
 * Update sharing settings for a city
 */
export async function updateSharingSettings(
  cityId: string,
  settings: Partial<Omit<CitySharingSettings, 'id' | 'cityId' | 'updatedAt'>>
): Promise<boolean> {
  if (!isMultiplayerAvailable()) return false;
  
  const supabase = getSupabase();
  
  const updateData: Record<string, unknown> = {};
  if (settings.sharePower !== undefined) updateData.share_power = settings.sharePower;
  if (settings.shareWater !== undefined) updateData.share_water = settings.shareWater;
  if (settings.shareFire !== undefined) updateData.share_fire = settings.shareFire;
  if (settings.sharePolice !== undefined) updateData.share_police = settings.sharePolice;
  if (settings.shareWorkers !== undefined) updateData.share_workers = settings.shareWorkers;
  if (settings.shareEducation !== undefined) updateData.share_education = settings.shareEducation;
  if (settings.minPowerSurplus !== undefined) updateData.min_power_surplus = settings.minPowerSurplus;
  if (settings.minWaterSurplus !== undefined) updateData.min_water_surplus = settings.minWaterSurplus;
  
  const { error } = await supabase
    .from('city_sharing_settings')
    .update(updateData)
    .eq('city_id', cityId);
  
  if (error) {
    console.error('Failed to update sharing settings:', error);
    return false;
  }
  
  return true;
}

// ============================================================================
// SHARING AGREEMENTS
// ============================================================================

/**
 * Fetch all active sharing agreements for a city (both giving and receiving)
 */
export async function fetchCitySharingAgreements(
  cityId: string
): Promise<{ giving: ResourceSharingAgreement[]; receiving: ResourceSharingAgreement[] }> {
  if (!isMultiplayerAvailable()) return { giving: [], receiving: [] };
  
  const supabase = getSupabase();
  
  // Fetch agreements where this city is the provider
  const { data: givingData } = await supabase
    .from('resource_sharing')
    .select('*')
    .eq('from_city_id', cityId)
    .eq('active', true);
  
  // Fetch agreements where this city is the receiver
  const { data: receivingData } = await supabase
    .from('resource_sharing')
    .select('*')
    .eq('to_city_id', cityId)
    .eq('active', true);
  
  return {
    giving: ((givingData || []) as ResourceSharingRow[]).map(mapResourceSharing),
    receiving: ((receivingData || []) as ResourceSharingRow[]).map(mapResourceSharing),
  };
}

/**
 * Fetch all sharing agreements in a region
 */
export async function fetchRegionSharingAgreements(
  regionId: string
): Promise<ResourceSharingAgreement[]> {
  if (!isMultiplayerAvailable()) return [];
  
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('resource_sharing')
    .select('*')
    .eq('region_id', regionId)
    .eq('active', true);
  
  if (error) {
    console.error('Failed to fetch region sharing agreements:', error);
    return [];
  }
  
  return ((data || []) as ResourceSharingRow[]).map(mapResourceSharing);
}

/**
 * Create or update a sharing agreement
 */
export async function createOrUpdateSharingAgreement(
  fromCityId: string,
  fromCityName: string,
  toCityId: string,
  toCityName: string,
  regionId: string,
  resourceType: SharableResource,
  quantity: number,
  autoShare: boolean = true
): Promise<ResourceSharingAgreement | null> {
  if (!isMultiplayerAvailable()) return null;
  
  const supabase = getSupabase();
  const feeRate = RESOURCE_SHARING_FEES[resourceType];
  
  // Try to upsert (update if exists, insert if not)
  const { data, error } = await supabase
    .from('resource_sharing')
    .upsert({
      from_city_id: fromCityId,
      to_city_id: toCityId,
      from_city_name: fromCityName,
      to_city_name: toCityName,
      region_id: regionId,
      resource_type: resourceType,
      quantity,
      fee_rate: feeRate,
      active: true,
      auto_share: autoShare,
    }, {
      onConflict: 'from_city_id,to_city_id,resource_type',
    })
    .select()
    .single();
  
  if (error || !data) {
    console.error('Failed to create/update sharing agreement:', error);
    return null;
  }
  
  return mapResourceSharing(data as ResourceSharingRow);
}

/**
 * Deactivate a sharing agreement
 */
export async function deactivateSharingAgreement(
  agreementId: string
): Promise<boolean> {
  if (!isMultiplayerAvailable()) return false;
  
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('resource_sharing')
    .update({ active: false })
    .eq('id', agreementId);
  
  if (error) {
    console.error('Failed to deactivate sharing agreement:', error);
    return false;
  }
  
  return true;
}

/**
 * Update the quantity being shared
 */
export async function updateSharingQuantity(
  agreementId: string,
  quantity: number
): Promise<boolean> {
  if (!isMultiplayerAvailable()) return false;
  
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('resource_sharing')
    .update({ quantity })
    .eq('id', agreementId);
  
  if (error) {
    console.error('Failed to update sharing quantity:', error);
    return false;
  }
  
  return true;
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

/**
 * Record a sharing transaction (when resources are actually shared)
 */
export async function recordSharingTransaction(
  sharingId: string,
  fromCityId: string,
  toCityId: string,
  resourceType: SharableResource,
  quantity: number
): Promise<SharingTransaction | null> {
  if (!isMultiplayerAvailable()) return null;
  
  const supabase = getSupabase();
  const { totalCost, feeAmount } = calculateSharingCost(resourceType, quantity);
  
  const { data, error } = await supabase
    .from('sharing_transactions')
    .insert({
      sharing_id: sharingId,
      from_city_id: fromCityId,
      to_city_id: toCityId,
      resource_type: resourceType,
      quantity,
      amount_paid: totalCost,
      fee_earned: feeAmount,
    })
    .select()
    .single();
  
  if (error || !data) {
    console.error('Failed to record sharing transaction:', error);
    return null;
  }
  
  return mapSharingTransaction(data as SharingTransactionRow);
}

/**
 * Fetch recent transactions for a city
 */
export async function fetchCitySharingTransactions(
  cityId: string,
  limit: number = 20
): Promise<SharingTransaction[]> {
  if (!isMultiplayerAvailable()) return [];
  
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('sharing_transactions')
    .select('*')
    .or(`from_city_id.eq.${cityId},to_city_id.eq.${cityId}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Failed to fetch sharing transactions:', error);
    return [];
  }
  
  return ((data || []) as SharingTransactionRow[]).map(mapSharingTransaction);
}

// ============================================================================
// SUMMARY & HELPERS
// ============================================================================

/**
 * Get a summary of resource sharing for a city
 */
export async function getCitySharingSummary(
  cityId: string
): Promise<ResourceSharingSummary> {
  const { giving, receiving } = await fetchCitySharingAgreements(cityId);
  
  const sharingOut = giving.map(agreement => {
    const { totalCost, feeAmount } = calculateSharingCost(
      agreement.resourceType,
      agreement.quantity
    );
    return {
      resourceType: agreement.resourceType,
      toCityName: agreement.toCityName,
      quantity: agreement.quantity,
      monthlyIncome: feeAmount, // Provider earns the fee
    };
  });
  
  const receivingIn = receiving.map(agreement => {
    const { totalCost } = calculateSharingCost(
      agreement.resourceType,
      agreement.quantity
    );
    return {
      resourceType: agreement.resourceType,
      fromCityName: agreement.fromCityName,
      quantity: agreement.quantity,
      monthlyCost: totalCost,
    };
  });
  
  const totalIncome = sharingOut.reduce((sum, s) => sum + s.monthlyIncome, 0);
  const totalCost = receivingIn.reduce((sum, r) => sum + r.monthlyCost, 0);
  
  return {
    sharingOut,
    receivingIn,
    netMonthlyIncome: totalIncome - totalCost,
  };
}

/**
 * Check if two cities are adjacent in the region grid
 */
export function areCitiesAdjacent(
  city1Row: number,
  city1Col: number,
  city2Row: number,
  city2Col: number
): boolean {
  const rowDiff = Math.abs(city1Row - city2Row);
  const colDiff = Math.abs(city1Col - city2Col);
  
  // Adjacent means sharing an edge (not diagonal)
  return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

/**
 * Get the direction of an adjacent city
 */
export function getAdjacentDirection(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): 'north' | 'south' | 'east' | 'west' | null {
  if (toRow === fromRow - 1 && toCol === fromCol) return 'north';
  if (toRow === fromRow + 1 && toCol === fromCol) return 'south';
  if (toRow === fromRow && toCol === fromCol + 1) return 'east';
  if (toRow === fromRow && toCol === fromCol - 1) return 'west';
  return null;
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to sharing agreement changes for a city
 */
export function subscribeToSharingAgreements(
  cityId: string,
  onUpdate: (agreement: ResourceSharingAgreement) => void
): (() => void) | null {
  if (!isMultiplayerAvailable()) return null;
  
  const supabase = getSupabase();
  const uniqueId = Math.random().toString(36).substring(7);
  
  const channel = supabase
    .channel(`sharing:${cityId}:${uniqueId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'resource_sharing',
        filter: `from_city_id=eq.${cityId}`,
      },
      (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          onUpdate(mapResourceSharing(payload.new as ResourceSharingRow));
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'resource_sharing',
        filter: `to_city_id=eq.${cityId}`,
      },
      (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          onUpdate(mapResourceSharing(payload.new as ResourceSharingRow));
        }
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================================
// FORMATTING
// ============================================================================

export function formatSharingAmount(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

// ============================================================================
// MONTHLY PROCESSING
// ============================================================================

/**
 * Calculate the monthly net income from resource sharing for a city
 * This should be called each game month to update the city's money
 */
export async function calculateMonthlySharingIncome(
  cityId: string
): Promise<number> {
  const summary = await getCitySharingSummary(cityId);
  return summary.netMonthlyIncome;
}

/**
 * Process monthly sharing transactions for a city
 * Records transactions and returns the net change in money
 */
export async function processMonthlySharing(
  cityId: string
): Promise<{ netIncome: number; transactionsRecorded: number }> {
  if (!isMultiplayerAvailable()) {
    return { netIncome: 0, transactionsRecorded: 0 };
  }
  
  const { giving, receiving } = await fetchCitySharingAgreements(cityId);
  let netIncome = 0;
  let transactionsRecorded = 0;
  
  // Process giving
  for (const agreement of giving) {
    if (!agreement.active || agreement.quantity <= 0) continue;
    
    const { feeAmount } = calculateSharingCost(agreement.resourceType, agreement.quantity);
    netIncome += feeAmount;
    
    // Record transaction
    await recordSharingTransaction(
      agreement.id,
      agreement.fromCityId,
      agreement.toCityId,
      agreement.resourceType,
      agreement.quantity
    );
    transactionsRecorded++;
  }
  
  // Process receiving (we pay costs)
  for (const agreement of receiving) {
    if (!agreement.active || agreement.quantity <= 0) continue;
    
    const { totalCost } = calculateSharingCost(agreement.resourceType, agreement.quantity);
    netIncome -= totalCost;
    transactionsRecorded++;
  }
  
  return { netIncome, transactionsRecorded };
}

