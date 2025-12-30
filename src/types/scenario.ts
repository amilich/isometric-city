export type ObjectiveType = 
  | 'population' 
  | 'money' 
  | 'happiness' 
  | 'time' // e.g., survive for X years
  | 'building_count'; // e.g., build 5 parks

export interface Objective {
  id: string;
  type: ObjectiveType;
  targetValue: number;
  targetId?: string; // e.g. 'park_large' for building_count
  description: string;
  isCompleted?: boolean;
  currentValue?: number; // For UI display
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  objectives: Objective[];
  initialMoney?: number;
  initialPopulation?: number; // Usually 0, but maybe for specific scenarios
  timeLimit?: { year: number; month: number }; // Optional time limit
  winMessage?: string;
  mapConfig?: {
    size: number;
    // Future: seed, terrain type etc.
  }
}

