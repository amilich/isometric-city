// Multiplayer types for region-based play

export interface Region {
  id: string;
  name: string;
  creatorCityId: string | null;
  maxSlots: number;
  gridRows: number;
  gridCols: number;
  isPublic: boolean;
  inviteCode: string | null;
  createdAt: string;
}

export interface RegionSlot {
  row: number;
  col: number;
  cityId: string | null;
  cityName: string | null;
  population: number | null;
}

export interface CloudCity {
  id: string;
  deviceToken: string;
  regionId: string | null;
  slotRow: number | null;
  slotCol: number | null;
  cityName: string;
  population: number;
  money: number;
  year: number;
  month: number;
  gridSize: number;
  stateBlob: string;
  updatedAt: string;
}

export interface NeighborCity {
  id: string;
  cityName: string;
  population: number;
  money: number;
  year: number;
  slotRow: number;
  slotCol: number;
  updatedAt: string;
}

export interface RegionWithCities extends Region {
  cities: NeighborCity[];
}

export type SlotDirection = 'north' | 'south' | 'east' | 'west';

export function getSlotDirection(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): SlotDirection | null {
  if (toRow === fromRow - 1 && toCol === fromCol) return 'north';
  if (toRow === fromRow + 1 && toCol === fromCol) return 'south';
  if (toRow === fromRow && toCol === fromCol + 1) return 'east';
  if (toRow === fromRow && toCol === fromCol - 1) return 'west';
  return null;
}

export function areSlotsAdjacent(
  row1: number,
  col1: number,
  row2: number,
  col2: number
): boolean {
  return getSlotDirection(row1, col1, row2, col2) !== null;
}

// Regional Treasury types
export type ContributionModel = 'flat' | 'proportional' | 'progressive' | 'voluntary';

export interface RegionalTreasury {
  id: string;
  regionId: string;
  balance: number;
  contributionModel: ContributionModel;
  contributionRate: number; // percentage for proportional, fixed amount for flat
  updatedAt: string;
}

export type TransactionType = 'contribution' | 'great_work' | 'grant' | 'relief' | 'withdrawal';

export interface TreasuryTransaction {
  id: string;
  treasuryId: string;
  cityId: string | null;
  cityName: string;
  amount: number; // positive = deposit, negative = withdrawal
  transactionType: TransactionType;
  description: string | null;
  createdAt: string;
}

export interface TreasuryWithTransactions extends RegionalTreasury {
  transactions: TreasuryTransaction[];
}

// Contribution calculation helpers
export function calculateContribution(
  model: ContributionModel,
  rate: number,
  cityIncome: number,
  cityPopulation: number
): number {
  switch (model) {
    case 'flat':
      return rate; // Fixed amount
    case 'proportional':
      return Math.floor(cityIncome * (rate / 100)); // % of income
    case 'progressive':
      // Larger cities pay higher percentage
      const baseRate = rate / 100;
      const populationMultiplier = 1 + Math.log10(Math.max(1, cityPopulation / 10000));
      return Math.floor(cityIncome * baseRate * populationMultiplier);
    case 'voluntary':
      return 0; // Manual contributions only
    default:
      return 0;
  }
}

// ============================================================================
// GREAT WORKS
// ============================================================================

export type GreatWorkType = 
  | 'airport'
  | 'solar_farm'
  | 'arcology'
  | 'space_elevator'
  | 'olympic_complex'
  | 'desalination_plant'
  | 'high_speed_rail'
  | 'regional_university';

export type GreatWorkStatus = 'voting' | 'in_progress' | 'completed' | 'cancelled';

export interface GreatWorkDefinition {
  type: GreatWorkType;
  name: string;
  icon: string;
  description: string;
  requiredMoney: number;
  requiredMaterials: number;
  requiredWorkers: number;
  durationMonths: number;
  benefits: string[];
}

// Catalog of all available Great Works
export const GREAT_WORKS_CATALOG: Record<GreatWorkType, GreatWorkDefinition> = {
  airport: {
    type: 'airport',
    name: 'International Airport',
    icon: '🛫',
    description: 'A major hub connecting the region to the world',
    requiredMoney: 2000000,
    requiredMaterials: 5000,
    requiredWorkers: 1000,
    durationMonths: 12,
    benefits: ['+30% commercial demand for all cities'],
  },
  solar_farm: {
    type: 'solar_farm',
    name: 'Solar Farm Array',
    icon: '☀️',
    description: 'Massive solar installation providing clean energy',
    requiredMoney: 1000000,
    requiredMaterials: 3000,
    requiredWorkers: 0,
    durationMonths: 6,
    benefits: ['+500 free power for each city'],
  },
  arcology: {
    type: 'arcology',
    name: 'Arcology',
    icon: '🏛️',
    description: 'Self-sustaining mega-structure housing thousands',
    requiredMoney: 5000000,
    requiredMaterials: 10000,
    requiredWorkers: 2000,
    durationMonths: 24,
    benefits: ['+20% residential capacity', '+15% happiness'],
  },
  space_elevator: {
    type: 'space_elevator',
    name: 'Space Elevator',
    icon: '🚀',
    description: 'Revolutionary transport to orbit',
    requiredMoney: 10000000,
    requiredMaterials: 20000,
    requiredWorkers: 5000,
    durationMonths: 36,
    benefits: ['+50% industrial output', '+25% commercial'],
  },
  olympic_complex: {
    type: 'olympic_complex',
    name: 'Olympic Complex',
    icon: '🏟️',
    description: 'World-class sports and entertainment venue',
    requiredMoney: 3000000,
    requiredMaterials: 8000,
    requiredWorkers: 3000,
    durationMonths: 18,
    benefits: ['+40% happiness', '+$50,000/mo tourism income'],
  },
  desalination_plant: {
    type: 'desalination_plant',
    name: 'Mega Desalination Plant',
    icon: '🌊',
    description: 'Converts seawater into fresh water at scale',
    requiredMoney: 1500000,
    requiredMaterials: 4000,
    requiredWorkers: 0,
    durationMonths: 8,
    benefits: ['+1000 free water for each city'],
  },
  high_speed_rail: {
    type: 'high_speed_rail',
    name: 'High-Speed Rail Network',
    icon: '🚄',
    description: 'Connects all cities with rapid transit',
    requiredMoney: 4000000,
    requiredMaterials: 12000,
    requiredWorkers: 2000,
    durationMonths: 20,
    benefits: ['+25% all demands', 'Workers can commute across region'],
  },
  regional_university: {
    type: 'regional_university',
    name: 'Regional University',
    icon: '🎓',
    description: 'Premier educational institution',
    requiredMoney: 2500000,
    requiredMaterials: 6000,
    requiredWorkers: 1500,
    durationMonths: 14,
    benefits: ['+30% education', '+15% industrial (tech sector)'],
  },
};

export interface GreatWork {
  id: string;
  regionId: string;
  workType: GreatWorkType;
  status: GreatWorkStatus;
  requiredMoney: number;
  requiredMaterials: number;
  requiredWorkers: number;
  contributedMoney: number;
  contributedMaterials: number;
  contributedWorkers: number;
  proposedBy: string | null;
  proposerName: string;
  votingEndsAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface GreatWorkVote {
  id: string;
  greatWorkId: string;
  cityId: string;
  cityName: string;
  vote: boolean; // true = yes, false = no
  createdAt: string;
}

export interface GreatWorkContribution {
  id: string;
  greatWorkId: string;
  cityId: string;
  cityName: string;
  moneyAmount: number;
  materialsAmount: number;
  workersAmount: number;
  createdAt: string;
}

export interface GreatWorkWithDetails extends GreatWork {
  votes: GreatWorkVote[];
  contributions: GreatWorkContribution[];
  definition: GreatWorkDefinition;
}

// Helper to calculate progress percentage
export function calculateGreatWorkProgress(work: GreatWork): number {
  const moneyProgress = work.requiredMoney > 0 
    ? work.contributedMoney / work.requiredMoney 
    : 1;
  const materialsProgress = work.requiredMaterials > 0 
    ? work.contributedMaterials / work.requiredMaterials 
    : 1;
  const workersProgress = work.requiredWorkers > 0 
    ? work.contributedWorkers / work.requiredWorkers 
    : 1;
  
  // Average of all required resources
  const totalRequired = 
    (work.requiredMoney > 0 ? 1 : 0) +
    (work.requiredMaterials > 0 ? 1 : 0) +
    (work.requiredWorkers > 0 ? 1 : 0);
  
  if (totalRequired === 0) return 100;
  
  const totalProgress = 
    (work.requiredMoney > 0 ? moneyProgress : 0) +
    (work.requiredMaterials > 0 ? materialsProgress : 0) +
    (work.requiredWorkers > 0 ? workersProgress : 0);
  
  return Math.min(100, Math.floor((totalProgress / totalRequired) * 100));
}

// ============================================================================
// RESOURCE SHARING
// ============================================================================

export type SharableResource = 'power' | 'water' | 'fire' | 'police' | 'workers' | 'education';

export interface ResourceSharingAgreement {
  id: string;
  fromCityId: string;
  toCityId: string;
  fromCityName: string;
  toCityName: string;
  regionId: string;
  resourceType: SharableResource;
  quantity: number;
  feeRate: number; // percentage (e.g., 10.00 = 10%)
  active: boolean;
  autoShare: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CitySharingSettings {
  id: string;
  cityId: string;
  sharePower: boolean;
  shareWater: boolean;
  shareFire: boolean;
  sharePolice: boolean;
  shareWorkers: boolean;
  shareEducation: boolean;
  minPowerSurplus: number;
  minWaterSurplus: number;
  updatedAt: string;
}

export interface SharingTransaction {
  id: string;
  sharingId: string;
  fromCityId: string;
  toCityId: string;
  resourceType: SharableResource;
  quantity: number;
  amountPaid: number;
  feeEarned: number;
  createdAt: string;
}

export interface ResourceSharingSummary {
  // What this city is sharing OUT (earning from)
  sharingOut: {
    resourceType: SharableResource;
    toCityName: string;
    quantity: number;
    monthlyIncome: number;
  }[];
  // What this city is receiving IN (paying for)
  receivingIn: {
    resourceType: SharableResource;
    fromCityName: string;
    quantity: number;
    monthlyCost: number;
  }[];
  netMonthlyIncome: number;
}

// Fee rates per resource type
export const RESOURCE_SHARING_FEES: Record<SharableResource, number> = {
  power: 10,      // 10%
  water: 10,      // 10%
  fire: 15,       // 15%
  police: 15,     // 15%
  workers: 5,     // 5%
  education: 20,  // 20%
};

// Base prices per resource unit (used to calculate fees)
// TODO: These prices should be dynamic based on the global market prices
export const RESOURCE_BASE_PRICES: Record<SharableResource, number> = {
  power: 10,      // $10 per unit
  water: 8,       // $8 per unit
  fire: 100,      // $100 per coverage unit
  police: 100,    // $100 per coverage unit
  workers: 5,     // $5 per worker
  education: 50,  // $50 per education point
};

export function getResourceIcon(type: SharableResource): string {
  switch (type) {
    case 'power': return '⚡';
    case 'water': return '💧';
    case 'fire': return '🚒';
    case 'police': return '🚓';
    case 'workers': return '👷';
    case 'education': return '🎓';
  }
}

export function getResourceName(type: SharableResource): string {
  switch (type) {
    case 'power': return 'Power';
    case 'water': return 'Water';
    case 'fire': return 'Fire Coverage';
    case 'police': return 'Police Coverage';
    case 'workers': return 'Workers';
    case 'education': return 'Education';
  }
}

export function calculateSharingCost(
  resourceType: SharableResource,
  quantity: number
): { totalCost: number; feeAmount: number } {
  const basePrice = RESOURCE_BASE_PRICES[resourceType];
  const feeRate = RESOURCE_SHARING_FEES[resourceType];
  const baseCost = quantity * basePrice;
  const feeAmount = Math.floor(baseCost * (feeRate / 100));
  return {
    totalCost: baseCost + feeAmount,
    feeAmount,
  };
}