// Initial game state creation and city generation

import {
  GameState,
  AdjacentCity,
} from '@/types/game';
import { generateCityName } from './names';
import { generateTerrain } from './terrain';
import { createServiceCoverage } from './services';
import { createInitialBudget, createInitialStats } from './stats';
import { DEFAULT_GRID_SIZE } from './simulation';

// Generate a UUID v4
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Generate adjacent cities - always create one for each direction (undiscovered until road reaches edge)
export function generateAdjacentCities(): AdjacentCity[] {
  const cities: AdjacentCity[] = [];
  const directions: Array<'north' | 'south' | 'east' | 'west'> = ['north', 'south', 'east', 'west'];
  const usedNames = new Set<string>();
  
  for (const direction of directions) {
    let name: string;
    do {
      name = generateCityName();
    } while (usedNames.has(name));
    usedNames.add(name);
    
    cities.push({
      id: `city-${direction}`,
      name,
      direction,
      connected: false,
      discovered: false, // Cities are discovered when a road reaches their edge
    });
  }
  
  return cities;
}

export function createInitialGameState(size: number = DEFAULT_GRID_SIZE, cityName: string = 'New City'): GameState {
  const { grid, waterBodies } = generateTerrain(size);
  const adjacentCities = generateAdjacentCities();
  
  // Create a default city covering the entire map
  const defaultCity: import('@/types/game').City = {
    id: generateUUID(),
    name: cityName,
    bounds: {
      minX: 0,
      minY: 0,
      maxX: size - 1,
      maxY: size - 1,
    },
    economy: {
      population: 0,
      jobs: 0,
      income: 0,
      expenses: 0,
      happiness: 50,
      lastCalculated: 0,
    },
    color: '#3b82f6',
  };

  return {
    id: generateUUID(),
    grid,
    gridSize: size,
    cityName,
    year: 2024,
    month: 1,
    day: 1,
    hour: 12, // Start at noon
    tick: 0,
    speed: 1,
    selectedTool: 'select',
    taxRate: 9,
    effectiveTaxRate: 9, // Start matching taxRate
    stats: createInitialStats(),
    budget: createInitialBudget(),
    services: createServiceCoverage(size),
    notifications: [],
    advisorMessages: [],
    history: [],
    activePanel: 'none',
    disastersEnabled: true,
    adjacentCities,
    waterBodies,
    gameVersion: 0,
    cities: [defaultCity],
  };
}
