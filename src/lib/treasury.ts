// Regional Treasury API functions

import { getSupabase, isMultiplayerAvailable } from './supabase';
import { sendSystemMessage } from './chat';
import type { Database } from '@/types/supabase';
import type {
  RegionalTreasury,
  TreasuryTransaction,
  TreasuryWithTransactions,
  ContributionModel,
  TransactionType,
} from '@/types/multiplayer';

type TreasuryRow = Database['public']['Tables']['regional_treasuries']['Row'];
type TransactionRow = Database['public']['Tables']['treasury_transactions']['Row'];

function mapTreasury(row: TreasuryRow): RegionalTreasury {
  return {
    id: row.id,
    regionId: row.region_id,
    balance: row.balance,
    contributionModel: row.contribution_model as ContributionModel,
    contributionRate: row.contribution_rate,
    updatedAt: row.updated_at,
  };
}

function mapTransaction(row: TransactionRow): TreasuryTransaction {
  return {
    id: row.id,
    treasuryId: row.treasury_id,
    cityId: row.city_id,
    cityName: row.city_name,
    amount: row.amount,
    transactionType: row.transaction_type as TransactionType,
    description: row.description,
    createdAt: row.created_at,
  };
}

// Get or create treasury for a region
export async function getOrCreateTreasury(regionId: string): Promise<RegionalTreasury | null> {
  if (!isMultiplayerAvailable()) return null;

  const supabase = getSupabase();

  // Try to get existing treasury first
  const { data: existing } = await supabase
    .from('regional_treasuries')
    .select('*')
    .eq('region_id', regionId)
    .single();

  if (existing) {
    return mapTreasury(existing as TreasuryRow);
  }

  await new Promise(resolve => setTimeout(resolve, 100));

  // Create new treasury if not exists
  const { data: created, error: createError } = await supabase
    .from('regional_treasuries')
    .upsert({
      region_id: regionId,
      balance: 0,
      contribution_model: 'proportional',
      contribution_rate: 2.0,
    }, {
      onConflict: 'region_id',
    })
    .select()
    .single();

  if (createError) {
    // If upsert failed, try to fetch again
    const { data: retryFetch } = await supabase
      .from('regional_treasuries')
      .select('*')
      .eq('region_id', regionId)
      .single();
    
    if (retryFetch) {
      return mapTreasury(retryFetch as TreasuryRow);
    }
    
    console.error('Failed to create treasury:', createError?.message || createError?.code || JSON.stringify(createError));
    return null;
  }

  if (!created) {
    console.error('Treasury created but no data returned');
    return null;
  }

  return mapTreasury(created as TreasuryRow);
}

// Fetch treasury with recent transactions
export async function fetchTreasuryWithTransactions(
  regionId: string,
  transactionLimit: number = 20
): Promise<TreasuryWithTransactions | null> {
  if (!isMultiplayerAvailable()) return null;

  const treasury = await getOrCreateTreasury(regionId);
  if (!treasury) return null;

  const supabase = getSupabase();
  const { data: transactionsData, error } = await supabase
    .from('treasury_transactions')
    .select('*')
    .eq('treasury_id', treasury.id)
    .order('created_at', { ascending: false })
    .limit(transactionLimit);

  if (error) {
    console.error('Failed to fetch transactions:', error);
    return { ...treasury, transactions: [] };
  }

  const transactions = ((transactionsData || []) as TransactionRow[]).map(mapTransaction);

  return { ...treasury, transactions };
}

// Make a contribution to the treasury
export async function contributeToTreasury(
  regionId: string,
  cityId: string,
  cityName: string,
  amount: number,
  description?: string
): Promise<boolean> {
  if (!isMultiplayerAvailable() || amount <= 0) return false;

  const treasury = await getOrCreateTreasury(regionId);
  if (!treasury) return false;

  const supabase = getSupabase();

  // Insert transaction
  const { error: txError } = await supabase
    .from('treasury_transactions')
    .insert({
      treasury_id: treasury.id,
      city_id: cityId,
      city_name: cityName,
      amount: amount,
      transaction_type: 'contribution',
      description: description || `Contribution from ${cityName}`,
    });

  if (txError) {
    console.error('Failed to record contribution:', txError);
    return false;
  }

  // Update balance
  const { error: updateError } = await supabase
    .from('regional_treasuries')
    .update({
      balance: treasury.balance + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', treasury.id);

  if (updateError) {
    console.error('Failed to update treasury balance:', updateError);
    return false;
  }

  // Send system message for large contributions
  if (amount >= 10000) {
    await sendSystemMessage(
      'region',
      regionId,
      `💰 ${cityName} contributed $${amount.toLocaleString()} to the regional treasury!`
    );
  }

  return true;
}

// Withdraw from treasury (for grants, relief, etc.)
export async function withdrawFromTreasury(
  regionId: string,
  cityId: string | null,
  cityName: string,
  amount: number,
  transactionType: TransactionType,
  description: string
): Promise<boolean> {
  if (!isMultiplayerAvailable() || amount <= 0) return false;

  const treasury = await getOrCreateTreasury(regionId);
  if (!treasury) return false;

  // Check sufficient balance
  if (treasury.balance < amount) {
    console.error('Insufficient treasury balance');
    return false;
  }

  const supabase = getSupabase();

  // Insert transaction (negative amount for withdrawal)
  const { error: txError } = await supabase
    .from('treasury_transactions')
    .insert({
      treasury_id: treasury.id,
      city_id: cityId,
      city_name: cityName,
      amount: -amount,
      transaction_type: transactionType,
      description,
    });

  if (txError) {
    console.error('Failed to record withdrawal:', txError);
    return false;
  }

  // Update balance
  const { error: updateError } = await supabase
    .from('regional_treasuries')
    .update({
      balance: treasury.balance - amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', treasury.id);

  if (updateError) {
    console.error('Failed to update treasury balance:', updateError);
    return false;
  }

  // Send system message
  await sendSystemMessage(
    'region',
    regionId,
    `🏛️ ${description} ($${amount.toLocaleString()})`
  );

  return true;
}

// Update treasury settings
export async function updateTreasurySettings(
  regionId: string,
  contributionModel: ContributionModel,
  contributionRate: number
): Promise<boolean> {
  if (!isMultiplayerAvailable()) return false;

  const treasury = await getOrCreateTreasury(regionId);
  if (!treasury) return false;

  const supabase = getSupabase();
  const { error } = await supabase
    .from('regional_treasuries')
    .update({
      contribution_model: contributionModel,
      contribution_rate: contributionRate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', treasury.id);

  if (error) {
    console.error('Failed to update treasury settings:', error);
    return false;
  }

  return true;
}

// Subscribe to treasury updates
export function subscribeToTreasury(
  regionId: string,
  onUpdate: (treasury: RegionalTreasury) => void
): (() => void) | null {
  if (!isMultiplayerAvailable()) return null;

  const supabase = getSupabase();
  const uniqueId = Math.random().toString(36).substring(7);
  const channelName = `treasury:${regionId}:${uniqueId}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'regional_treasuries',
        filter: `region_id=eq.${regionId}`,
      },
      (payload) => {
        if (payload.new) {
          const treasury = mapTreasury(payload.new as TreasuryRow);
          onUpdate(treasury);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Subscribe to treasury transactions
export function subscribeToTransactions(
  treasuryId: string,
  onNewTransaction: (transaction: TreasuryTransaction) => void
): (() => void) | null {
  if (!isMultiplayerAvailable()) return null;

  const supabase = getSupabase();
  const uniqueId = Math.random().toString(36).substring(7);
  const channelName = `treasury-tx:${treasuryId}:${uniqueId}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'treasury_transactions',
        filter: `treasury_id=eq.${treasuryId}`,
      },
      (payload) => {
        if (payload.new) {
          const transaction = mapTransaction(payload.new as TransactionRow);
          onNewTransaction(transaction);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Format money for display
export function formatTreasuryAmount(amount: number): string {
  if (Math.abs(amount) >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (Math.abs(amount) >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

// Get contribution model display name
export function getContributionModelName(model: ContributionModel): string {
  switch (model) {
    case 'flat':
      return 'Flat Rate';
    case 'proportional':
      return 'Proportional';
    case 'progressive':
      return 'Progressive';
    case 'voluntary':
      return 'Voluntary';
    default:
      return model;
  }
}

// Get transaction type display name
export function getTransactionTypeName(type: TransactionType): string {
  switch (type) {
    case 'contribution':
      return 'Contribution';
    case 'great_work':
      return 'Great Work';
    case 'grant':
      return 'Grant';
    case 'relief':
      return 'Disaster Relief';
    case 'withdrawal':
      return 'Withdrawal';
    default:
      return type;
  }
}

