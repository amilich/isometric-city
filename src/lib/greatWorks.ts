// Great Works API functions

import { getSupabase, isMultiplayerAvailable } from './supabase';
import { sendSystemMessage } from './chat';
import type { Database } from '@/types/supabase';
import type {
  GreatWork,
  GreatWorkType,
  GreatWorkStatus,
  GreatWorkVote,
  GreatWorkContribution,
  GreatWorkWithDetails,
  GREAT_WORKS_CATALOG,
} from '@/types/multiplayer';

type GreatWorkRow = Database['public']['Tables']['great_works']['Row'];
type VoteRow = Database['public']['Tables']['great_work_votes']['Row'];
type ContributionRow = Database['public']['Tables']['great_work_contributions']['Row'];

function mapGreatWork(row: GreatWorkRow): GreatWork {
  return {
    id: row.id,
    regionId: row.region_id,
    workType: row.work_type as GreatWorkType,
    status: row.status as GreatWorkStatus,
    requiredMoney: row.required_money,
    requiredMaterials: row.required_materials,
    requiredWorkers: row.required_workers,
    contributedMoney: row.contributed_money,
    contributedMaterials: row.contributed_materials,
    contributedWorkers: row.contributed_workers,
    proposedBy: row.proposed_by,
    proposerName: row.proposer_name,
    votingEndsAt: row.voting_ends_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function mapVote(row: VoteRow): GreatWorkVote {
  return {
    id: row.id,
    greatWorkId: row.great_work_id,
    cityId: row.city_id,
    cityName: row.city_name,
    vote: row.vote,
    createdAt: row.created_at,
  };
}

function mapContribution(row: ContributionRow): GreatWorkContribution {
  return {
    id: row.id,
    greatWorkId: row.great_work_id,
    cityId: row.city_id,
    cityName: row.city_name,
    moneyAmount: row.money_amount,
    materialsAmount: row.materials_amount,
    workersAmount: row.workers_amount,
    createdAt: row.created_at,
  };
}

// Fetch all great works for a region
export async function fetchGreatWorks(regionId: string): Promise<GreatWork[]> {
  if (!isMultiplayerAvailable()) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('great_works')
    .select('*')
    .eq('region_id', regionId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch great works:', error);
    return [];
  }

  return ((data || []) as GreatWorkRow[]).map(mapGreatWork);
}

// Fetch a single great work with votes and contributions
export async function fetchGreatWorkDetails(
  workId: string,
  catalog: typeof GREAT_WORKS_CATALOG
): Promise<GreatWorkWithDetails | null> {
  if (!isMultiplayerAvailable()) return null;

  const supabase = getSupabase();

  // Fetch the work
  const { data: workData, error: workError } = await supabase
    .from('great_works')
    .select('*')
    .eq('id', workId)
    .single();

  if (workError || !workData) {
    console.error('Failed to fetch great work:', workError);
    return null;
  }

  const work = mapGreatWork(workData as GreatWorkRow);

  // Fetch votes
  const { data: votesData } = await supabase
    .from('great_work_votes')
    .select('*')
    .eq('great_work_id', workId);

  const votes = ((votesData || []) as VoteRow[]).map(mapVote);

  // Fetch contributions
  const { data: contribData } = await supabase
    .from('great_work_contributions')
    .select('*')
    .eq('great_work_id', workId)
    .order('created_at', { ascending: false });

  const contributions = ((contribData || []) as ContributionRow[]).map(mapContribution);

  return {
    ...work,
    votes,
    contributions,
    definition: catalog[work.workType],
  };
}

// Propose a new great work
export async function proposeGreatWork(
  regionId: string,
  cityId: string,
  cityName: string,
  workType: GreatWorkType,
  catalog: typeof GREAT_WORKS_CATALOG
): Promise<GreatWork | null> {
  if (!isMultiplayerAvailable()) return null;

  const definition = catalog[workType];
  if (!definition) {
    console.error('Invalid work type:', workType);
    return null;
  }

  const supabase = getSupabase();

  // Check if there's already an active work of this type
  const { data: existing } = await supabase
    .from('great_works')
    .select('id')
    .eq('region_id', regionId)
    .eq('work_type', workType)
    .in('status', ['voting', 'in_progress'])
    .single();

  if (existing) {
    console.error('A great work of this type is already active');
    return null;
  }

  // Create the proposal with 24-hour voting period
  const votingEndsAt = new Date();
  votingEndsAt.setHours(votingEndsAt.getHours() + 24);

  const { data, error } = await supabase
    .from('great_works')
    .insert({
      region_id: regionId,
      work_type: workType,
      status: 'voting',
      required_money: definition.requiredMoney,
      required_materials: definition.requiredMaterials,
      required_workers: definition.requiredWorkers,
      proposed_by: cityId,
      proposer_name: cityName,
      voting_ends_at: votingEndsAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to propose great work:', error);
    return null;
  }

  const work = mapGreatWork(data as GreatWorkRow);

  // Auto-vote yes for the proposer
  await voteOnGreatWork(work.id, cityId, cityName, true);

  // Send system message
  await sendSystemMessage(
    'region',
    regionId,
    `📢 ${cityName} proposed "${definition.name}"! Vote now in the Great Works panel.`
  );

  return work;
}

// Vote on a great work proposal
export async function voteOnGreatWork(
  workId: string,
  cityId: string,
  cityName: string,
  vote: boolean
): Promise<boolean> {
  if (!isMultiplayerAvailable()) return false;

  const supabase = getSupabase();

  // Upsert the vote (allows changing vote)
  const { error } = await supabase
    .from('great_work_votes')
    .upsert(
      {
        great_work_id: workId,
        city_id: cityId,
        city_name: cityName,
        vote,
      },
      { onConflict: 'great_work_id,city_id' }
    );

  if (error) {
    console.error('Failed to vote:', error);
    return false;
  }

  return true;
}

// Check if voting has passed and start construction
export async function checkVotingResult(
  workId: string,
  regionId: string,
  totalCitiesInRegion: number
): Promise<{ passed: boolean; started: boolean }> {
  if (!isMultiplayerAvailable()) return { passed: false, started: false };

  const supabase = getSupabase();

  // Get the work
  const { data: workData } = await supabase
    .from('great_works')
    .select('*')
    .eq('id', workId)
    .single();

  const work = workData as GreatWorkRow | null;
  if (!work || work.status !== 'voting') {
    return { passed: false, started: false };
  }

  // Get votes
  const { data: votesData } = await supabase
    .from('great_work_votes')
    .select('*')
    .eq('great_work_id', workId);

  const votes = (votesData || []) as VoteRow[];
  const yesVotes = votes.filter(v => v.vote).length;
  const noVotes = votes.filter(v => !v.vote).length;
  
  // Check if voting period ended or majority reached
  const now = new Date();
  const votingEnds = work.voting_ends_at ? new Date(work.voting_ends_at) : null;
  const votingEnded = votingEnds && now >= votingEnds;
  
  // Need majority of participating voters (at least 1 vote required)
  const passed = yesVotes > noVotes && yesVotes > 0;
  
  if (votingEnded || yesVotes > totalCitiesInRegion / 2) {
    if (passed) {
      // Start construction
      const { error } = await supabase
        .from('great_works')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', workId);

      if (!error) {
        await sendSystemMessage(
          'region',
          regionId,
          `✅ "${work.work_type}" approved! Construction has begun. Start contributing!`
        );
        return { passed: true, started: true };
      }
    } else {
      // Cancel
      await supabase
        .from('great_works')
        .update({ status: 'cancelled' })
        .eq('id', workId);

      await sendSystemMessage(
        'region',
        regionId,
        `❌ "${work.work_type}" proposal was rejected.`
      );
      return { passed: false, started: false };
    }
  }

  return { passed, started: false };
}

// Contribute to an in-progress great work
export async function contributeToGreatWork(
  workId: string,
  regionId: string,
  cityId: string,
  cityName: string,
  money: number = 0,
  materials: number = 0,
  workers: number = 0
): Promise<boolean> {
  if (!isMultiplayerAvailable()) return false;
  if (money <= 0 && materials <= 0 && workers <= 0) return false;

  const supabase = getSupabase();

  // Check work exists and is in progress
  const { data: workData } = await supabase
    .from('great_works')
    .select('*')
    .eq('id', workId)
    .eq('status', 'in_progress')
    .single();

  const work = workData as GreatWorkRow | null;
  if (!work) {
    console.error('Great work not found or not in progress');
    return false;
  }

  // Record the contribution
  const { error: contribError } = await supabase
    .from('great_work_contributions')
    .insert({
      great_work_id: workId,
      city_id: cityId,
      city_name: cityName,
      money_amount: money,
      materials_amount: materials,
      workers_amount: workers,
    });

  if (contribError) {
    console.error('Failed to record contribution:', contribError);
    return false;
  }

  // Update totals
  const newMoney = work.contributed_money + money;
  const newMaterials = work.contributed_materials + materials;
  const newWorkers = work.contributed_workers + workers;

  const { error: updateError } = await supabase
    .from('great_works')
    .update({
      contributed_money: newMoney,
      contributed_materials: newMaterials,
      contributed_workers: newWorkers,
    })
    .eq('id', workId);

  if (updateError) {
    console.error('Failed to update work totals:', updateError);
    return false;
  }

  // Check if completed
  const isComplete =
    newMoney >= work.required_money &&
    newMaterials >= work.required_materials &&
    newWorkers >= work.required_workers;

  if (isComplete) {
    await completeGreatWork(workId, regionId, work.work_type);
  }

  return true;
}

// Complete a great work
async function completeGreatWork(
  workId: string,
  regionId: string,
  workType: string
): Promise<void> {
  const supabase = getSupabase();

  await supabase
    .from('great_works')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', workId);

  // Send celebration messages
  await sendSystemMessage(
    'region',
    regionId,
    `🏆 "${workType}" has been COMPLETED! All cities in the region now receive its benefits!`
  );

  await sendSystemMessage(
    'global',
    null,
    `🎉 A region has completed the "${workType}" Great Work! Congratulations!`
  );
}

// Get aggregated contributions by city for a great work
export async function getContributionsByCity(
  workId: string
): Promise<Map<string, { cityName: string; money: number; materials: number; workers: number }>> {
  if (!isMultiplayerAvailable()) return new Map();

  const supabase = getSupabase();
  const { data } = await supabase
    .from('great_work_contributions')
    .select('*')
    .eq('great_work_id', workId);

  const contributions = new Map<string, { cityName: string; money: number; materials: number; workers: number }>();

  for (const row of (data || []) as ContributionRow[]) {
    const existing = contributions.get(row.city_id) || {
      cityName: row.city_name,
      money: 0,
      materials: 0,
      workers: 0,
    };
    contributions.set(row.city_id, {
      cityName: row.city_name,
      money: existing.money + row.money_amount,
      materials: existing.materials + row.materials_amount,
      workers: existing.workers + row.workers_amount,
    });
  }

  return contributions;
}

// Subscribe to great work updates
export function subscribeToGreatWorks(
  regionId: string,
  onUpdate: (work: GreatWork) => void
): (() => void) | null {
  if (!isMultiplayerAvailable()) return null;

  const supabase = getSupabase();
  const uniqueId = Math.random().toString(36).substring(7);
  const channelName = `great-works:${regionId}:${uniqueId}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'great_works',
        filter: `region_id=eq.${regionId}`,
      },
      (payload) => {
        if (payload.new) {
          const work = mapGreatWork(payload.new as GreatWorkRow);
          onUpdate(work);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Format money for display
export function formatAmount(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

