export type TransactionType =
  | 'ride_income'
  | 'shop_income'
  | 'park_admission'
  | 'staff_wages'
  | 'maintenance'
  | 'loan_interest'
  | 'research'
  | 'construction'
  | 'loan_take'
  | 'loan_payment';

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  timestamp: number;
};

export type Finance = {
  cash: number;
  loan: number;
  loanInterestRate: number;
  entranceFee: number;
  income: number;
  expenses: number;
  entranceRevenue: number;
  rideRevenue: number;
  shopRevenue: number;
  staffCost: number;
  maintenanceCost: number;
  researchCost: number;
  loanInterestCost: number;
  transactions: Transaction[];
};

export type ResearchCategory = 'rides' | 'coasters' | 'shops' | 'scenery' | 'infrastructure';

export type ResearchItem = {
  id: string;
  name: string;
  category: ResearchCategory;
  cost: number;
  progress: number;
  unlocked: boolean;
};

export type Research = {
  activeResearchId: string | null;
  funding: number;
  items: ResearchItem[];
};
