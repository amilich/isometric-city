import React from 'react';
import { render, screen } from '@testing-library/react';
import { MobileTopBar } from '../MobileTopBar';
import { Tile } from '@/types/game';
import { vi, describe, it, expect } from 'vitest';

// Mock GameContext
const mockUseGame = vi.fn();
vi.mock('@/context/GameContext', () => ({
  useGame: () => mockUseGame(),
}));

describe('MobileTopBar', () => {
  const mockServices = {
    police: [[]],
    fire: [[]],
    health: [[]],
    education: [[]],
    power: [[]],
    water: [[]],
  } as any;

  const mockTile: Tile = {
    x: 5,
    y: 5,
    zone: 'none',
    building: {
      type: 'power_plant',
      level: 1,
      population: 0,
      jobs: 0,
      powered: true,
      watered: true,
      isUpgraded: false,
    },
    pollution: 0,
    landValue: 100,
  } as any;

  beforeEach(() => {
    mockUseGame.mockReturnValue({
      state: {
        stats: { money: 10000, population: 100, demand: { residential: 50, commercial: 50, industrial: 50 } },
        year: 2025,
        month: 1,
        speed: 1,
        taxRate: 9,
        cityName: 'TestCity',
      },
      setSpeed: vi.fn(),
      setTaxRate: vi.fn(),
      isSaving: false,
      visualHour: 12,
      saveCity: vi.fn(),
    });
  });

  it('renders tile info summary when a tile is selected', () => {
    render(
      <MobileTopBar 
        selectedTile={mockTile} 
        services={mockServices} 
        onCloseTile={() => {}} 
      />
    );
    
    expect(screen.getByText('power plant')).toBeInTheDocument();
  });

  it('does NOT show upgrade button in the summary row', () => {
    render(
      <MobileTopBar 
        selectedTile={mockTile} 
        services={mockServices} 
        onCloseTile={() => {}} 
      />
    );
    
    expect(screen.queryByText('Apply Upgrade')).not.toBeInTheDocument();
  });
});
