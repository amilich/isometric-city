'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { isMultiplayerAvailable } from '@/lib/supabase';
import {
  fetchPublicRegions,
  fetchRegionWithCities,
  createRegion,
} from '@/lib/regionSync';
import {
  fetchTreasuryWithTransactions,
  contributeToTreasury,
  formatTreasuryAmount,
  subscribeToTreasury,
} from '@/lib/treasury';
import { fetchGreatWorks } from '@/lib/greatWorks';
import {
  getOrCreateSharingSettings,
  updateSharingSettings,
  fetchCitySharingAgreements,
  createOrUpdateSharingAgreement,
  deactivateSharingAgreement,
  getCitySharingSummary,
} from '@/lib/resourceSharing';
import type { 
  Region, 
  RegionWithCities, 
  NeighborCity, 
  TreasuryWithTransactions, 
  GreatWork, 
  CitySharingSettings, 
  ResourceSharingAgreement, 
  ResourceSharingSummary, 
  SharableResource 
} from '@/types/multiplayer';
import { 
  GREAT_WORKS_CATALOG, 
  calculateGreatWorkProgress,
} from '@/types/multiplayer';

// ============================================================================
// HELPERS
// ============================================================================
function formatPopulation(pop: number): string {
  if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)}M`;
  if (pop >= 1000) return `${(pop / 1000).toFixed(1)}K`;
  return pop.toString();
}

function formatMoney(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function calculateResourceSurplus(grid: { building?: { type?: string } }[][], population: number): { power: number; water: number } {
  let powerPlants = 0;
  let waterTowers = 0;
  
  for (const row of grid) {
    for (const tile of row) {
      if (tile.building?.type === 'power_plant') powerPlants++;
      if (tile.building?.type === 'water_tower') waterTowers++;
    }
  }
  
  const powerProduction = powerPlants * 2000;
  const waterProduction = waterTowers * 1500;
  const powerConsumption = Math.ceil(population / 10);
  const waterConsumption = Math.ceil(population / 12);
  
  return {
    power: powerProduction - powerConsumption,
    water: waterProduction - waterConsumption,
  };
}

// ============================================================================
// REGION INFO CARD (for Clan tab)
// ============================================================================
function RegionInfoCard({ 
  region, 
  treasury,
  currentCityId,
  onLeave,
}: { 
  region: RegionWithCities; 
  treasury: TreasuryWithTransactions | null;
  currentCityId: string;
  onLeave: () => void;
}) {
  const totalPopulation = region.cities.reduce((sum, c) => sum + c.population, 0);
  const isCreator = region.creatorCityId === currentCityId;

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-3">
      {/* Region Title Row */}
          <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/20 rounded-lg border border-primary/40 flex items-center justify-center">
            <span className="text-lg">🏰</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-tight">
              {region.name}
            </h2>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <span className="text-green-400 font-medium">Open</span>
              <span className="opacity-50">•</span>
              <span>ID: {region.id.slice(0, 6)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isCreator && (
            <Button variant="game-secondary" size="icon" className="h-7 w-7" title="Edit Region">
              ✏️
            </Button>
          )}
            <Button 
            variant="game-danger"
              size="sm"
            className="h-7 px-2 gap-1.5"
            onClick={onLeave}
            title="Leave Region"
            >
            <span>🚪</span>
            <span className="text-xs">Leave</span>
            </Button>
        </div>
          </div>
          
      {/* Stats Row */}
      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-xs">
        <div className="flex flex-col items-center flex-1">
          <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Population</span>
          <span className="font-bold">{formatPopulation(totalPopulation)}</span>
            </div>
        <div className="w-px h-6 bg-border/50" />
        <div className="flex flex-col items-center flex-1">
          <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Bank</span>
          <span className="font-bold text-amber-400">{treasury ? formatTreasuryAmount(treasury.balance) : '$0'}</span>
            </div>
        <div className="w-px h-6 bg-border/50" />
        <div className="flex flex-col items-center flex-1">
          <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Members</span>
          <span className="font-bold">{region.cities.length}/{region.maxSlots}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MEMBER ROW
// ============================================================================
function MemberRow({ 
  city, 
  rank,
  isCurrentCity,
  isLeader,
}: { 
  city: NeighborCity; 
  rank: number;
  isCurrentCity: boolean;
  isLeader: boolean;
}) {
  return (
    <div className={`
      flex items-center gap-2 px-3 py-2 border-b border-border/50
      ${isCurrentCity ? 'bg-primary/10' : 'hover:bg-muted/30'}
    `}>
      {/* Rank */}
      <div className={`
        w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0
        ${rank <= 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-muted text-muted-foreground'}
      `}>
        {rank}
      </div>
      
      {/* Leader Badge */}
      <div className="w-6 shrink-0 flex items-center justify-center">
        {isLeader && <span className="text-sm">👑</span>}
      </div>
      
      {/* Name + Status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm truncate ${isCurrentCity ? 'text-primary' : 'text-foreground'}`}>
            {city.cityName}
          </span>
          {isLeader && (
            <Badge variant="outline" className="text-[10px] uppercase px-1.5 py-0 h-4 border-amber-500/50 text-amber-400">
              Leader
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Slot {city.slotRow + 1}-{city.slotCol + 1}
        </div>
      </div>
      
      {/* Population */}
      <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
        <span className="text-xs">👥</span>
        <span className="font-semibold text-sm tabular-nums">
          {formatPopulation(city.population)}
        </span>
      </div>
    </div>
  );
}


// ============================================================================
// TREASURY CONTRIBUTION
// ============================================================================
function TreasurySection({ 
  treasury,
  cityMoney,
  regionId,
  cityId,
  cityName,
  onSpendMoney,
}: { 
  treasury: TreasuryWithTransactions | null;
  cityMoney: number;
  regionId: string;
  cityId: string;
  cityName: string;
  onSpendMoney: (amount: number) => void;
}) {
  const [amount, setAmount] = useState('5000');
  const [isContributing, setIsContributing] = useState(false);

  const handleContribute = async () => {
    const num = parseInt(amount);
    if (isNaN(num) || num <= 0 || num > cityMoney) return;
    setIsContributing(true);
    const success = await contributeToTreasury(regionId, cityId, cityName, num);
    if (success) {
      onSpendMoney(num);
      setAmount('5000');
    }
    setIsContributing(false);
  };

  if (!treasury) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-sm flex items-center gap-2">
          💰 Treasury
        </span>
        <span className="text-xs text-muted-foreground">Your balance: {formatMoney(cityMoney)}</span>
      </div>
      
      <div className="flex gap-2">
        <Input 
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          min={1}
          max={cityMoney}
          className="flex-1 h-9"
        />
        <Button 
          onClick={handleContribute}
          disabled={isContributing || parseInt(amount) > cityMoney}
          variant="game"
          className="h-9 px-4"
        >
          {isContributing ? '...' : '💰 Donate'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// RESOURCE SHARING TAB
// ============================================================================
function ResourceSharingTab({
  region,
  currentCityId,
  currentCityName,
  cityPowerSurplus,
  cityWaterSurplus,
}: {
  region: RegionWithCities;
  currentCityId: string;
  currentCityName: string;
  cityPowerSurplus: number;
  cityWaterSurplus: number;
}) {
  const [sharingSettings, setSharingSettings] = useState<CitySharingSettings | null>(null);
  const [givingAgreements, setGivingAgreements] = useState<ResourceSharingAgreement[]>([]);
  const [summary, setSummary] = useState<ResourceSharingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const [settings, cityAgreements, sharingSummary] = await Promise.all([
        getOrCreateSharingSettings(currentCityId),
        fetchCitySharingAgreements(currentCityId),
        getCitySharingSummary(currentCityId),
      ]);
      setSharingSettings(settings);
      setGivingAgreements(cityAgreements.giving);
      setSummary(sharingSummary);
      setIsLoading(false);
    };
    loadData();
  }, [currentCityId]);

  const handleToggleShare = async (resource: 'power' | 'water') => {
    if (!sharingSettings) return;
    const updates: Partial<Omit<CitySharingSettings, 'id' | 'cityId' | 'updatedAt'>> = {};
    if (resource === 'power') updates.sharePower = !sharingSettings.sharePower;
    if (resource === 'water') updates.shareWater = !sharingSettings.shareWater;
    
    const success = await updateSharingSettings(currentCityId, updates);
    if (success) {
      setSharingSettings(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleShareWith = async (targetCity: NeighborCity, resource: SharableResource) => {
    const result = await createOrUpdateSharingAgreement(
      currentCityId,
      currentCityName,
      targetCity.id,
      targetCity.cityName,
      region.id,
      resource,
      resource === 'power' ? Math.max(0, cityPowerSurplus) : Math.max(0, cityWaterSurplus)
    );
    if (result) {
      setGivingAgreements(prev => [
        ...prev.filter(a => !(a.toCityId === targetCity.id && a.resourceType === resource)), 
        result
      ]);
    }
  };

  const handleStopSharing = async (agreementId: string) => {
    const success = await deactivateSharingAgreement(agreementId);
    if (success) {
      setGivingAgreements(prev => prev.filter(a => a.id !== agreementId));
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>;
  }

  const totalIncome = summary?.sharingOut.reduce((sum, item) => sum + item.monthlyIncome, 0) ?? 0;
  const totalCost = summary?.receivingIn.reduce((sum, item) => sum + item.monthlyCost, 0) ?? 0;

  return (
    <div className="p-3 space-y-4">
      {/* Overview */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
          <div className="text-xs text-green-400 mb-1">Monthly Income</div>
          <div className="text-lg font-bold text-green-400">+{formatMoney(totalIncome)}</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
          <div className="text-xs text-red-400 mb-1">Monthly Cost</div>
          <div className="text-lg font-bold text-red-400">-{formatMoney(totalCost)}</div>
        </div>
      </div>

      {/* Your Surplus */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Your Surplus</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleToggleShare('power')}
            className={`p-3 rounded-lg border text-center transition-colors ${
              sharingSettings?.sharePower 
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' 
                : 'bg-muted/30 border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            <div className="text-xl mb-1">⚡</div>
            <div className="text-xs font-bold">POWER</div>
            <div className="text-[10px] mt-1">{cityPowerSurplus} surplus</div>
            <div className="text-[9px] mt-1">{sharingSettings?.sharePower ? '✓ Sharing' : 'Click to share'}</div>
          </button>
          
          <button
            onClick={() => handleToggleShare('water')}
            className={`p-3 rounded-lg border text-center transition-colors ${
              sharingSettings?.shareWater 
                ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' 
                : 'bg-muted/30 border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            <div className="text-xl mb-1">💧</div>
            <div className="text-xs font-bold">WATER</div>
            <div className="text-[10px] mt-1">{cityWaterSurplus} surplus</div>
            <div className="text-[9px] mt-1">{sharingSettings?.shareWater ? '✓ Sharing' : 'Click to share'}</div>
          </button>
        </div>
      </div>

      {/* Neighbor Cities */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Trade with Neighbors</div>
        <div className="space-y-2">
          {region.cities
            .filter(c => c.id !== currentCityId)
            .map(city => {
              const activeAgreements = givingAgreements.filter(a => a.toCityId === city.id && a.active);
              return (
                <div key={city.id} className="bg-muted/30 border border-border/50 rounded-lg p-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">{city.cityName}</span>
                    <span className="text-[10px] text-muted-foreground">{formatPopulation(city.population)} pop</span>
                  </div>
                  
                  <div className="flex gap-1">
                    {(['power', 'water'] as const).map(resource => {
                      const agreement = activeAgreements.find(a => a.resourceType === resource);
                      return agreement ? (
                        <Button
                          key={resource}
                          size="sm"
                          variant="outline"
                          onClick={() => handleStopSharing(agreement.id)}
                          className="flex-1 h-7 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          Stop {resource === 'power' ? '⚡' : '💧'}
                        </Button>
                      ) : (
                        <Button
                          key={resource}
                          size="sm"
                          variant="outline"
                          onClick={() => handleShareWith(city, resource)}
                          className="flex-1 h-7 text-[10px]"
                        >
                          Send {resource === 'power' ? '⚡' : '💧'}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MY REGION VIEW
// ============================================================================
function MyRegionView({
  region,
  treasury,
  greatWorks,
  currentCityId,
  currentCityName,
  currentCityMoney,
  cityPowerSurplus,
  cityWaterSurplus,
  onLeave,
  onOpenGreatWorks,
  onBrowseRegions,
  onSpendMoney,
}: {
  region: RegionWithCities;
  treasury: TreasuryWithTransactions | null;
  greatWorks: GreatWork[];
  currentCityId: string;
  currentCityName: string;
  currentCityMoney: number;
  cityPowerSurplus: number;
  cityWaterSurplus: number;
  onLeave: () => void;
  onOpenGreatWorks: () => void;
  onBrowseRegions: () => void;
  onSpendMoney: (amount: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<'clan' | 'great_works' | 'resources'>('clan');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  
  const sortedCities = [...region.cities].sort((a, b) => b.population - a.population);

  // Leave Confirmation Overlay
  if (showLeaveConfirm) {
  return (
    <div className="flex flex-col h-full bg-background">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-4xl mb-2">
            🚪
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-red-500">Leave this region?</h3>
            <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
              You will lose access to all shared resources and your treasury contributions.
            </p>
          </div>
          <div className="flex flex-col w-full gap-3 max-w-xs">
            <Button 
              variant="game-danger"
              size="lg"
              className="w-full" 
              onClick={onLeave}
            >
              Confirm Leave
            </Button>
            <Button 
              variant="game-secondary" 
              size="lg"
              className="w-full" 
              onClick={() => setShowLeaveConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top Bar: Tabs */}
      <div className="bg-sidebar border-b border-sidebar-border p-2">
        <div className="grid grid-cols-3 gap-1.5">
          <Button
            variant={activeTab === 'clan' ? 'game' : 'game-secondary'}
            size="sm"
            onClick={() => setActiveTab('clan')}
            className={activeTab === 'clan' ? 'text-xs' : 'text-xs opacity-80 hover:opacity-100'}
          >
            Clan
          </Button>
          <Button
            variant={activeTab === 'great_works' ? 'game' : 'game-secondary'}
            size="sm"
            onClick={() => setActiveTab('great_works')}
            className={activeTab === 'great_works' ? 'text-xs' : 'text-xs opacity-80 hover:opacity-100'}
          >
            Great Works
          </Button>
          <Button
            variant={activeTab === 'resources' ? 'game' : 'game-secondary'}
            size="sm"
            onClick={() => setActiveTab('resources')}
            className={activeTab === 'resources' ? 'text-xs' : 'text-xs opacity-80 hover:opacity-100'}
          >
            Resources
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === 'clan' && (
          <div className="p-3 space-y-3">
            {/* Region Info Card */}
            <RegionInfoCard
              region={region}
              treasury={treasury}
              currentCityId={currentCityId}
              onLeave={() => setShowLeaveConfirm(true)}
            />

            <div className="flex items-center justify-between px-1 pt-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Members ({sortedCities.length})</span>
            </div>

            <div className="bg-card rounded-xl overflow-hidden border border-border">
              {sortedCities.map((city, index) => (
                <MemberRow 
                  key={city.id} 
                  city={city} 
                  rank={index + 1}
                  isCurrentCity={city.id === currentCityId}
                  isLeader={index === 0}
                />
              ))}
            </div>
            
            <div className="pt-4">
            <Button 
                variant="game-secondary" 
              className="w-full"
              onClick={onBrowseRegions}
            >
                🌐 Explore Other Regions
            </Button>
            </div>
          </div>
        )}

        {activeTab === 'great_works' && (
          <div className="p-3 space-y-4">
             {/* Treasury Section */}
            <TreasurySection 
              treasury={treasury}
              cityMoney={currentCityMoney}
              regionId={region.id}
              cityId={currentCityId}
              cityName={currentCityName}
              onSpendMoney={onSpendMoney}
            />
            
            {/* Great Works List - Reusing render logic from Preview but expanded */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Projects</span>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={onOpenGreatWorks}>
                  View All Details →
              </Button>
              </div>
              
              {greatWorks.length > 0 ? (
                <div className="space-y-2">
                  {greatWorks.map(work => {
                    const def = GREAT_WORKS_CATALOG[work.workType];
                    const progress = calculateGreatWorkProgress(work);
                    const isActive = work.status === 'voting' || work.status === 'in_progress';
                    
                    return (
                      <div key={work.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                        <div className="text-2xl">{def?.icon || '🏗️'}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-semibold text-sm truncate">{def?.name}</div>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {work.status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all duration-500" 
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                               <span>Progress</span>
                               <span>{progress}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm bg-muted/20 rounded-xl border border-dashed">
                  No Great Works started yet.
                  <Button variant="link" onClick={onOpenGreatWorks} className="text-primary text-xs block mx-auto mt-1">
                    Start a Project
                  </Button>
              </div>
            )}
            </div>
          </div>
        )}

        {activeTab === 'resources' && (
          <ResourceSharingTab
            region={region}
            currentCityId={currentCityId}
            currentCityName={currentCityName}
            cityPowerSurplus={cityPowerSurplus}
            cityWaterSurplus={cityWaterSurplus}
          />
        )}
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// BROWSE REGIONS VIEW
// ============================================================================
function BrowseRegionsView({
  regions,
  currentCityId,
  currentCityName,
  onJoinRegion,
  onCreateRegion,
  isJoining,
}: {
  regions: Region[];
  currentCityId: string;
  currentCityName: string;
  onJoinRegion: (regionId: string, row: number, col: number) => void;
  onCreateRegion: () => void;
  isJoining: boolean;
}) {
  const [selectedRegion, setSelectedRegion] = useState<RegionWithCities | null>(null);
  const [isLoadingRegion, setIsLoadingRegion] = useState(false);

  const handleSelectRegion = async (regionId: string) => {
    setIsLoadingRegion(true);
    const regionWithCities = await fetchRegionWithCities(regionId);
    setSelectedRegion(regionWithCities);
    setIsLoadingRegion(false);
  };

  if (selectedRegion) {
    const takenSlots = new Set(selectedRegion.cities.map(c => `${c.slotRow}-${c.slotCol}`));
    const availableSlots: { row: number; col: number }[] = [];
    for (let r = 0; r < selectedRegion.gridRows; r++) {
      for (let c = 0; c < selectedRegion.gridCols; c++) {
        if (!takenSlots.has(`${r}-${c}`)) availableSlots.push({ row: r, col: c });
      }
    }

    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="bg-sidebar border-b border-sidebar-border p-3 flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setSelectedRegion(null)}
            className="h-8 w-8 p-0"
          >
            ←
          </Button>
          <div className="flex-1">
            <h3 className="font-bold">{selectedRegion.name}</h3>
            <p className="text-xs text-muted-foreground">{selectedRegion.cities.length}/{selectedRegion.maxSlots} Members</p>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {/* Grid */}
          <div className="mb-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2 text-center">Select a Slot to Join</div>
            <div 
              className="grid gap-2 mx-auto"
              style={{ 
                gridTemplateColumns: `repeat(${selectedRegion.gridCols}, 1fr)`,
                maxWidth: `${selectedRegion.gridCols * 56}px`,
              }}
            >
              {Array.from({ length: selectedRegion.gridRows * selectedRegion.gridCols }).map((_, idx) => {
                const row = Math.floor(idx / selectedRegion.gridCols);
                const col = idx % selectedRegion.gridCols;
                const isTaken = takenSlots.has(`${row}-${col}`);
                const city = selectedRegion.cities.find(c => c.slotRow === row && c.slotCol === col);
                
                return (
                  <button
                    key={idx}
                    disabled={isTaken}
                    onClick={() => onJoinRegion(selectedRegion.id, row, col)}
                    className={`
                      aspect-square rounded-lg flex items-center justify-center font-bold transition-all
                      ${isTaken 
                        ? 'bg-muted cursor-default' 
                        : 'bg-green-500/10 text-green-400 border-2 border-dashed border-green-500/40 hover:bg-green-500/20 cursor-pointer'
                      }
                    `}
                    title={city?.cityName || 'Click to join'}
                  >
                    {isTaken ? city?.cityName?.charAt(0).toUpperCase() : '+'}
                  </button>
                );
              })}
            </div>
          </div>

          {availableSlots.length === 0 && (
            <div className="text-center text-red-400 text-sm mb-4">This region is full</div>
          )}

          {/* Current Members */}
          {selectedRegion.cities.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Current Members</div>
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                {selectedRegion.cities
                  .sort((a, b) => b.population - a.population)
                  .map((city, idx) => (
                  <div key={city.id} className="flex items-center justify-between px-3 py-2 border-b border-border/50 last:border-b-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{idx + 1}</span>
                      <span className="text-sm font-medium">{city.cityName}</span>
                    </div>
                    <span className="text-xs text-green-400">{formatPopulation(city.population)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {isJoining && (
            <div className="text-center py-4 text-primary">Joining region...</div>
          )}
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="bg-sidebar border-b border-sidebar-border p-4">
          <h2 className="text-lg font-bold">Join a Region</h2>
          <p className="text-xs text-muted-foreground">Team up with other mayors</p>
      </div>

      <ScrollArea className="flex-1 p-3">
        {isLoadingRegion ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : regions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No regions available yet.</p>
            <Button variant="game" onClick={onCreateRegion}>
              🏰 Create First Region
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {regions.map(region => (
              <button
                key={region.id}
                onClick={() => handleSelectRegion(region.id)}
                className="w-full text-left p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-lg">
                      🏰
                    </div>
                    <div>
                      <div className="font-semibold">{region.name}</div>
                      <div className="text-xs text-muted-foreground">{region.gridRows}×{region.gridCols} · Open</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {region.maxSlots} slots →
                  </div>
                </div>
              </button>
            ))}
            
            <Button variant="game" onClick={onCreateRegion} className="w-full mt-4">
              🏰 Create New Region
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// CREATE REGION VIEW
// ============================================================================
function CreateRegionView({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (regionId: string) => void;
}) {
  const [name, setName] = useState('');
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Region name is required');
      return;
    }
    setIsCreating(true);
    setError(null);
    const region = await createRegion(name.trim(), rows, cols, true);
    if (region) {
      onCreated(region.id);
    } else {
      setError('Could not create region.');
    }
    setIsCreating(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
          ←
        </Button>
        <h3 className="font-bold text-lg">Create Region</h3>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">Region Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Pacific Coast"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Rows</Label>
          <div className="flex gap-1">
            {[2, 3, 4].map(n => (
              <Button
                key={n}
                variant={rows === n ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRows(n)}
                className="flex-1"
              >
                {n}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Columns</Label>
          <div className="flex gap-1">
            {[2, 3, 4].map(n => (
              <Button
                key={n}
                variant={cols === n ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCols(n)}
                className="flex-1"
              >
                {n}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-primary">{rows * cols}</div>
        <div className="text-xs text-muted-foreground">max cities</div>
      </div>

      {error && <div className="text-sm text-red-400 text-center">{error}</div>}

      <Button 
        variant="game"
        onClick={handleCreate} 
        disabled={isCreating || !name.trim()}
        className="w-full"
      >
        {isCreating ? 'Creating...' : '🏰 Create Region'}
      </Button>
    </div>
  );
}

// ============================================================================
// MAIN REGION PANEL
// ============================================================================
export function RegionPanel() {
  const { state, setActivePanel, regionInfo, joinRegion, leaveRegion, addMoney, hasCityHall } = useGame();
  const [view, setView] = useState<'my-region' | 'browse' | 'create'>('my-region');
  const [regions, setRegions] = useState<Region[]>([]);
  const [myRegion, setMyRegion] = useState<RegionWithCities | null>(null);
  const [treasury, setTreasury] = useState<TreasuryWithTransactions | null>(null);
  const [greatWorks, setGreatWorks] = useState<GreatWork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const unsubTreasuryRef = useRef<(() => void) | null>(null);

  const multiplayerAvailable = isMultiplayerAvailable();
  const isInRegion = !!regionInfo;
  const onClose = () => setActivePanel('none');
  
  // If no City Hall, show requirement message
  if (!hasCityHall) {
    return (
      <Dialog open={true} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>🏛️ City Hall Required</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4 py-4">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-lg flex items-center justify-center text-3xl">
            🏛️
          </div>
          <div>
            <p className="font-bold mb-1">Build a City Hall</p>
            <p className="text-sm text-muted-foreground">
              Required to access multiplayer features.
            </p>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
            Find it in the <span className="text-primary font-medium">Special</span> category
          </p>
            <Button variant="game" onClick={onClose} className="w-full">
            Got it
          </Button>
        </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Calculate resource surplus
  const { power, water } = calculateResourceSurplus(state.grid as { building?: { type?: string } }[][], state.stats.population);

  // Fetch data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      if (isInRegion && regionInfo) {
        const [regionData, treasuryData, worksData] = await Promise.all([
          fetchRegionWithCities(regionInfo.regionId),
          fetchTreasuryWithTransactions(regionInfo.regionId, 10),
          fetchGreatWorks(regionInfo.regionId),
        ]);
        
        setMyRegion(regionData);
        setTreasury(treasuryData);
        setGreatWorks(worksData);
        setView('my-region');
        
        if (unsubTreasuryRef.current) unsubTreasuryRef.current();
        unsubTreasuryRef.current = subscribeToTreasury(regionInfo.regionId, (updated) => {
          setTreasury(prev => prev ? { ...prev, ...updated } : null);
        });
      } else {
        const publicRegions = await fetchPublicRegions();
        setRegions(publicRegions);
        setView('browse');
      }
      
      setIsLoading(false);
    };
    
    if (multiplayerAvailable) loadData();
    else setIsLoading(false);
    
    return () => {
      if (unsubTreasuryRef.current) unsubTreasuryRef.current();
    };
  }, [isInRegion, regionInfo, multiplayerAvailable]);

  const handleJoinRegion = async (regionId: string, row: number, col: number) => {
    setIsJoining(true);
    const success = await joinRegion(regionId, row, col);
    if (success) {
      const [regionData, treasuryData, worksData] = await Promise.all([
        fetchRegionWithCities(regionId),
        fetchTreasuryWithTransactions(regionId, 10),
        fetchGreatWorks(regionId),
      ]);
      setMyRegion(regionData);
      setTreasury(treasuryData);
      setGreatWorks(worksData);
      setView('my-region');
    }
    setIsJoining(false);
  };

  const handleLeaveRegion = async () => {
    const success = await leaveRegion();
    if (success) {
      setMyRegion(null);
      setTreasury(null);
      setGreatWorks([]);
      const publicRegions = await fetchPublicRegions();
      setRegions(publicRegions);
      setView('browse');
    }
  };

  const handleOpenGreatWorks = () => {
    setActivePanel('great_works');
  };

  if (!multiplayerAvailable) {
    return (
      <Dialog open={true} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>🌐 Regions</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">Multiplayer features are offline.</p>
        </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[480px] h-[600px] p-0 overflow-hidden flex flex-col">
        <DialogTitle className="sr-only">Region Panel</DialogTitle>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Loading...
        </div>
      ) : view === 'my-region' && myRegion ? (
        <MyRegionView
          region={myRegion}
          treasury={treasury}
          greatWorks={greatWorks}
          currentCityId={state.id}
          currentCityName={state.cityName}
          currentCityMoney={state.stats.money}
          cityPowerSurplus={power}
          cityWaterSurplus={water}
          onLeave={handleLeaveRegion}
          onOpenGreatWorks={handleOpenGreatWorks}
          onBrowseRegions={() => setView('browse')}
          onSpendMoney={(amount) => addMoney(-amount)}
        />
      ) : view === 'create' ? (
        <CreateRegionView
          onBack={() => setView('browse')}
          onCreated={async (regionId) => {
            await handleJoinRegion(regionId, 0, 0);
          }}
        />
      ) : (
        <BrowseRegionsView
          regions={regions}
          currentCityId={state.id}
          currentCityName={state.cityName}
          onJoinRegion={handleJoinRegion}
          onCreateRegion={() => setView('create')}
          isJoining={isJoining}
        />
      )}
      </DialogContent>
    </Dialog>
  );
}
