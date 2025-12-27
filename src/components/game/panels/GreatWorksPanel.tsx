'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { isMultiplayerAvailable } from '@/lib/supabase';
import {
  fetchGreatWorks,
  fetchGreatWorkDetails,
  proposeGreatWork,
  voteOnGreatWork,
  contributeToGreatWork,
  checkVotingResult,
  subscribeToGreatWorks,
  formatAmount,
} from '@/lib/greatWorks';
import {
  GREAT_WORKS_CATALOG,
  calculateGreatWorkProgress,
  type GreatWork,
  type GreatWorkType,
  type GreatWorkWithDetails,
  type GreatWorkDefinition,
} from '@/types/multiplayer';

function ProgressBar({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`h-2 bg-muted rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function WorkCard({
  work,
  onSelect,
}: {
  work: GreatWork;
  onSelect: () => void;
}) {
  const definition = GREAT_WORKS_CATALOG[work.workType];
  const progress = calculateGreatWorkProgress(work);

  const statusColors: Record<string, string> = {
    voting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const statusLabels: Record<string, string> = {
    voting: 'Voting',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 transition-all bg-card/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{definition?.icon || '🏗️'}</span>
          <div>
            <div className="font-medium text-sm">{definition?.name || work.workType}</div>
            <div className="text-xs text-muted-foreground">
              Proposed by {work.proposerName}
            </div>
          </div>
        </div>
        <Badge className={`text-[10px] ${statusColors[work.status]}`}>
          {statusLabels[work.status]}
        </Badge>
      </div>

      {work.status === 'in_progress' && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <ProgressBar value={progress} max={100} />
        </div>
      )}
    </button>
  );
}

function CatalogCard({
  definition,
  onPropose,
  disabled,
}: {
  definition: GreatWorkDefinition;
  onPropose: () => void;
  disabled: boolean;
}) {
  return (
    <div className="p-3 rounded-lg border border-border bg-card/50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{definition.icon}</span>
        <div className="font-medium text-sm">{definition.name}</div>
      </div>
      
      <p className="text-xs text-muted-foreground mb-2">{definition.description}</p>
      
      <div className="space-y-1 text-xs mb-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">💰 Money:</span>
          <span>{formatAmount(definition.requiredMoney)}</span>
        </div>
        {definition.requiredMaterials > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">🏗️ Materials:</span>
            <span>{definition.requiredMaterials.toLocaleString()}</span>
          </div>
        )}
        {definition.requiredWorkers > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">👷 Workers:</span>
            <span>{definition.requiredWorkers.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">⏱️ Duration:</span>
          <span>{definition.durationMonths} months</span>
        </div>
      </div>
      
      <div className="text-xs text-green-400 mb-3">
        {definition.benefits.map((b, i) => (
          <div key={i}>✓ {b}</div>
        ))}
      </div>
      
      <Button
        variant="game"
        size="sm"
        className="w-full"
        onClick={onPropose}
        disabled={disabled}
      >
        Propose
      </Button>
    </div>
  );
}

function WorkDetailView({
  work,
  cityId,
  cityName,
  cityMoney,
  totalCities,
  onBack,
  onRefresh,
  onSpendMoney,
}: {
  work: GreatWorkWithDetails;
  cityId: string;
  cityName: string;
  cityMoney: number;
  totalCities: number;
  onBack: () => void;
  onRefresh: () => void;
  onSpendMoney: (amount: number) => void;
}) {
  const [contributionAmount, setContributionAmount] = useState('10000');
  const [isContributing, setIsContributing] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  const definition = work.definition;
  const progress = calculateGreatWorkProgress(work);
  
  const myVote = work.votes.find(v => v.cityId === cityId);
  const yesVotes = work.votes.filter(v => v.vote).length;
  const noVotes = work.votes.filter(v => !v.vote).length;

  // Aggregate contributions by city
  const contributionsByCity = new Map<string, { cityName: string; total: number }>();
  for (const c of work.contributions) {
    const existing = contributionsByCity.get(c.cityId) || { cityName: c.cityName, total: 0 };
    contributionsByCity.set(c.cityId, {
      cityName: c.cityName,
      total: existing.total + c.moneyAmount + c.materialsAmount * 100 + c.workersAmount * 50,
    });
  }
  const topContributors = Array.from(contributionsByCity.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);

  const handleVote = async (vote: boolean) => {
    setIsVoting(true);
    await voteOnGreatWork(work.id, cityId, cityName, vote);
    
    // Check if voting should conclude
    await checkVotingResult(work.id, work.regionId, totalCities);
    
    onRefresh();
    setIsVoting(false);
  };

  const handleContribute = async () => {
    const amount = parseInt(contributionAmount);
    if (isNaN(amount) || amount <= 0 || amount > cityMoney) return;

    setIsContributing(true);
    const success = await contributeToGreatWork(
      work.id,
      work.regionId,
      cityId,
      cityName,
      amount, // money
      0, // materials (for now just money)
      0  // workers
    );
    if (success) {
      // Deduct from player's city balance
      onSpendMoney(amount);
    }
    onRefresh();
    setIsContributing(false);
    setContributionAmount('10000');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2">
          ← Back
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-4xl">{definition.icon}</span>
        <div>
          <h3 className="font-bold text-lg">{definition.name}</h3>
          <p className="text-xs text-muted-foreground">{definition.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge className={
          work.status === 'voting' ? 'bg-yellow-500/20 text-yellow-400' :
          work.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
          work.status === 'completed' ? 'bg-green-500/20 text-green-400' :
          'bg-red-500/20 text-red-400'
        }>
          {work.status === 'voting' ? '🗳️ Voting' :
           work.status === 'in_progress' ? '🏗️ In Progress' :
           work.status === 'completed' ? '✅ Completed' : '❌ Cancelled'}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Proposed by {work.proposerName}
        </span>
      </div>

      {/* Voting Phase */}
      {work.status === 'voting' && (
        <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 space-y-3">
          <div className="text-sm font-medium">🗳️ Vote on this proposal</div>
          
          <div className="flex items-center gap-4 text-sm">
            <span className="text-green-400">✓ Yes: {yesVotes}</span>
            <span className="text-red-400">✗ No: {noVotes}</span>
          </div>

          {myVote ? (
            <div className="text-xs text-muted-foreground">
              You voted: {myVote.vote ? '✓ Yes' : '✗ No'}
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="game"
                size="sm"
                onClick={() => handleVote(true)}
                disabled={isVoting}
                className="flex-1"
              >
                ✓ Vote Yes
              </Button>
              <Button
                variant="game-danger"
                size="sm"
                onClick={() => handleVote(false)}
                disabled={isVoting}
                className="flex-1"
              >
                ✗ Vote No
              </Button>
            </div>
          )}

          {work.votingEndsAt && (
            <div className="text-xs text-muted-foreground">
              Voting ends: {new Date(work.votingEndsAt).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* In Progress - Show resources */}
      {work.status === 'in_progress' && (
        <>
          <div className="space-y-3">
            <div className="text-sm font-medium">Overall Progress: {progress}%</div>
            <ProgressBar value={progress} max={100} className="h-3" />

            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span>💰 Money</span>
                <span>
                  {formatAmount(work.contributedMoney)} / {formatAmount(work.requiredMoney)}
                </span>
              </div>
              <ProgressBar value={work.contributedMoney} max={work.requiredMoney} />

              {work.requiredMaterials > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span>🏗️ Materials</span>
                    <span>
                      {work.contributedMaterials.toLocaleString()} / {work.requiredMaterials.toLocaleString()}
                    </span>
                  </div>
                  <ProgressBar value={work.contributedMaterials} max={work.requiredMaterials} />
                </>
              )}

              {work.requiredWorkers > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span>👷 Workers</span>
                    <span>
                      {work.contributedWorkers.toLocaleString()} / {work.requiredWorkers.toLocaleString()}
                    </span>
                  </div>
                  <ProgressBar value={work.contributedWorkers} max={work.requiredWorkers} />
                </>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Contribute Money</div>
            <div className="flex gap-2">
              <Input
                type="number"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                min="1000"
                max={cityMoney}
                className="h-9 text-sm"
              />
              <Button
                variant="game"
                size="sm"
                onClick={handleContribute}
                disabled={isContributing || parseInt(contributionAmount) > cityMoney}
              >
                {isContributing ? '...' : 'Contribute'}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Your funds: ${cityMoney.toLocaleString()}
            </div>
          </div>

          {topContributors.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Top Contributors
                </div>
                <div className="space-y-1">
                  {topContributors.map(([cityId, data], i) => (
                    <div key={cityId} className="flex items-center justify-between text-xs">
                      <span>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•'} {data.cityName}
                      </span>
                      <span className="text-muted-foreground">
                        {formatAmount(data.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Completed */}
      {work.status === 'completed' && (
        <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5 text-center">
          <div className="text-3xl mb-2">🏆</div>
          <div className="font-bold text-green-400">Completed!</div>
          <div className="text-xs text-muted-foreground mt-1">
            All cities in the region now benefit from this Great Work.
          </div>
          <div className="mt-3 text-sm text-green-400">
            {definition.benefits.map((b, i) => (
              <div key={i}>✓ {b}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function GreatWorksPanel() {
  const { state, setActivePanel, regionInfo, addMoney } = useGame();
  const [view, setView] = useState<'list' | 'catalog' | 'detail'>('list');
  const [works, setWorks] = useState<GreatWork[]>([]);
  const [selectedWork, setSelectedWork] = useState<GreatWorkWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProposing, setIsProposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const multiplayerAvailable = isMultiplayerAvailable();
  const regionId = regionInfo?.regionId;

  const loadWorks = useCallback(async () => {
    if (!regionId) return;
    setIsLoading(true);
    const data = await fetchGreatWorks(regionId);
    setWorks(data);
    setIsLoading(false);
  }, [regionId]);

  useEffect(() => {
    if (!multiplayerAvailable || !regionId) {
      setIsLoading(false);
      return;
    }

    loadWorks();

    // Subscribe to updates
    unsubRef.current = subscribeToGreatWorks(regionId, (updatedWork) => {
      setWorks(prev => {
        const idx = prev.findIndex(w => w.id === updatedWork.id);
        if (idx >= 0) {
          const newWorks = [...prev];
          newWorks[idx] = updatedWork;
          return newWorks;
        }
        return [updatedWork, ...prev];
      });
    });

    return () => {
      unsubRef.current?.();
    };
  }, [multiplayerAvailable, regionId, loadWorks]);

  const handleSelectWork = async (work: GreatWork) => {
    setIsLoading(true);
    const details = await fetchGreatWorkDetails(work.id, GREAT_WORKS_CATALOG);
    if (details) {
      setSelectedWork(details);
      setView('detail');
    }
    setIsLoading(false);
  };

  const handleRefreshDetail = async () => {
    if (!selectedWork) return;
    const details = await fetchGreatWorkDetails(selectedWork.id, GREAT_WORKS_CATALOG);
    if (details) {
      setSelectedWork(details);
    }
    loadWorks();
  };

  const handlePropose = async (workType: GreatWorkType) => {
    if (!regionId) return;

    setIsProposing(true);
    setError(null);

    const work = await proposeGreatWork(
      regionId,
      state.id,
      state.cityName,
      workType,
      GREAT_WORKS_CATALOG
    );

    if (work) {
      await loadWorks();
      handleSelectWork(work);
    } else {
      setError('Failed to propose. There may already be an active project of this type.');
    }

    setIsProposing(false);
  };

  const activeWorks = works.filter(w => w.status === 'voting' || w.status === 'in_progress');
  const completedWorks = works.filter(w => w.status === 'completed');

  // Get types that already have active works
  const activeTypes = new Set(activeWorks.map(w => w.workType));

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[450px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🏗️ Great Works</DialogTitle>
        </DialogHeader>

        {!multiplayerAvailable ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Multiplayer mode is not configured.
            </p>
          </div>
        ) : !regionId ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Join a region to participate in Great Works!
            </p>
            <Button variant="game" onClick={() => setActivePanel('regions')}>
              View Regions
            </Button>
          </div>
        ) : isLoading && view === 'list' ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading...
          </div>
        ) : view === 'detail' && selectedWork ? (
          <WorkDetailView
            work={selectedWork}
            cityId={state.id}
            cityName={state.cityName}
            cityMoney={state.stats.money}
            totalCities={works.length > 0 ? Math.max(1, new Set(works.flatMap(w => w.proposerName)).size) : 1}
            onBack={() => {
              setView('list');
              setSelectedWork(null);
            }}
            onRefresh={handleRefreshDetail}
            onSpendMoney={(amount) => addMoney(-amount)}
          />
        ) : view === 'catalog' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setView('list')} className="h-8 px-2">
                ← Back
              </Button>
              <span className="font-medium">Propose New Great Work</span>
            </div>

            <ScrollArea className="h-[400px] pr-2">
              <div className="grid gap-3">
                {Object.values(GREAT_WORKS_CATALOG).map((def) => (
                  <CatalogCard
                    key={def.type}
                    definition={def}
                    onPropose={() => handlePropose(def.type)}
                    disabled={isProposing || activeTypes.has(def.type)}
                  />
                ))}
              </div>
            </ScrollArea>

            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {activeWorks.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Active Projects
                </div>
                {activeWorks.map((work) => (
                  <WorkCard
                    key={work.id}
                    work={work}
                    onSelect={() => handleSelectWork(work)}
                  />
                ))}
              </div>
            )}

            {completedWorks.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Completed
                </div>
                {completedWorks.map((work) => (
                  <WorkCard
                    key={work.id}
                    work={work}
                    onSelect={() => handleSelectWork(work)}
                  />
                ))}
              </div>
            )}

            {works.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <p className="mb-2">No Great Works yet.</p>
                <p className="text-xs">Propose a project to start building together!</p>
              </div>
            )}

            <Separator />

            <Button
              variant="game"
              className="w-full"
              onClick={() => setView('catalog')}
            >
              + Propose New Great Work
            </Button>

            <div className="text-xs text-muted-foreground text-center">
              Great Works are massive collaborative projects that benefit all cities in the region.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

