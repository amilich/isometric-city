import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BuildingUpgradeUI } from '../BuildingUpgradeUI';
import { Tile, BuildingType } from '@/types/game';
import { vi, describe, it, expect } from 'vitest';

// Mock upgradeUtils
vi.mock('@/lib/upgradeUtils', () => ({
  getUpgradeCost: vi.fn(() => 1000),
}));

// Mock buildingUpgrades config
vi.mock('@/config/buildingUpgrades', () => ({
  BUILDING_UPGRADES: {
    power_plant: {
      rangeMultiplier: 1.5,
      effectMagnitudeMultiplier: 1.5,
      maintenanceMultiplier: 2,
      pollutionMultiplier: 0.8,
      description: 'Increases power output range and efficiency. Reduces pollution.',
    },
  },
}));

describe('BuildingUpgradeUI', () => {
  const mockTile: Tile = {
    x: 10,
    y: 10,
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
    landValue: 10,
  } as any;

  it('renders upgrade info for a power plant', () => {
    render(<BuildingUpgradeUI tile={mockTile} money={5000} onUpgrade={() => {}} />);
    
    expect(screen.getByText('Building Upgrade')).toBeInTheDocument();
    expect(screen.getByText(/Increases power output range/)).toBeInTheDocument();
    expect(screen.getByText('Apply Upgrade')).toBeInTheDocument();
    expect(screen.getByText('$1,000')).toBeInTheDocument();
  });

  it('disables the upgrade button if money is insufficient', () => {
    render(<BuildingUpgradeUI tile={mockTile} money={500} onUpgrade={() => {}} />);
    
    const button = screen.getByRole('button', { name: /Apply Upgrade/i });
    expect(button).toBeDisabled();
  });

  it('calls onUpgrade when the button is clicked', () => {
    const onUpgrade = vi.fn();
    render(<BuildingUpgradeUI tile={mockTile} money={5000} onUpgrade={onUpgrade} />);
    
    const button = screen.getByRole('button', { name: /Apply Upgrade/i });
    fireEvent.click(button);
    
    expect(onUpgrade).toHaveBeenCalledWith(10, 10);
  });

  it('renders "UPGRADED" badge if building is already upgraded', () => {
    const upgradedTile = {
      ...mockTile,
      building: { ...mockTile.building, isUpgraded: true }
    };
    render(<BuildingUpgradeUI tile={upgradedTile} money={5000} onUpgrade={() => {}} />);
    
    expect(screen.getByText('UPGRADED')).toBeInTheDocument();
    expect(screen.queryByText('Apply Upgrade')).not.toBeInTheDocument();
  });
});
