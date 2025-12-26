import { describe, it, expect } from 'vitest';
import { 
  getBuildingRange, 
  getBuildingMaintenance, 
  getBuildingPollution, 
  getBuildingEffectMagnitude, 
  getUpgradeCost 
} from '../upgradeUtils';
import { Building } from '@/types/game';

// Mock building factory
const createMockBuilding = (type: any, isUpgraded: boolean = false): Building => ({
  type,
  level: 1,
  population: 0,
  jobs: 0,
  powered: true,
  watered: true,
  onFire: false,
  fireProgress: 0,
  age: 0,
  constructionProgress: 100,
  abandoned: false,
  isUpgraded
});

describe('upgradeUtils', () => {
  describe('getBuildingRange', () => {
    it('returns base range for non-upgraded buildings', () => {
      const building = createMockBuilding('police_station', false);
      expect(getBuildingRange(building, 10)).toBe(10);
    });

    it('returns multiplied range for upgraded buildings', () => {
      const building = createMockBuilding('police_station', true);
      // Config multiplier is 1.5
      expect(getBuildingRange(building, 10)).toBe(15);
    });

    it('returns integer range (floored)', () => {
      const building = createMockBuilding('police_station', true);
      // 15 * 1.5 = 22.5 -> 22
      expect(getBuildingRange(building, 15)).toBe(22);
    });
    
    it('returns base range for unsupported buildings', () => {
        const building = createMockBuilding('road', true); // road has no upgrade config
        expect(getBuildingRange(building, 10)).toBe(10);
    });
  });

  describe('getBuildingMaintenance', () => {
    it('returns base cost for non-upgraded buildings', () => {
      const building = createMockBuilding('fire_station', false);
      expect(getBuildingMaintenance(building, 100)).toBe(100);
    });

    it('returns multiplied cost for upgraded buildings', () => {
      const building = createMockBuilding('fire_station', true);
      // Config multiplier is 2
      expect(getBuildingMaintenance(building, 100)).toBe(200);
    });
  });

  describe('getBuildingPollution', () => {
    it('returns base pollution for non-upgraded buildings', () => {
      const building = createMockBuilding('power_plant', false);
      expect(getBuildingPollution(building, 50)).toBe(50);
    });

    it('returns multiplied pollution for upgraded buildings', () => {
      const building = createMockBuilding('power_plant', true);
      // Config multiplier is 0.8
      expect(getBuildingPollution(building, 50)).toBe(40);
    });
  });

  describe('getBuildingEffectMagnitude', () => {
    it('returns 1.0 for non-upgraded buildings', () => {
      const building = createMockBuilding('police_station', false);
      expect(getBuildingEffectMagnitude(building)).toBe(1.0);
    });

    it('returns multiplier for upgraded buildings', () => {
      const building = createMockBuilding('police_station', true);
      // Config multiplier is 1.5
      expect(getBuildingEffectMagnitude(building)).toBe(1.5);
    });
  });

  describe('getUpgradeCost', () => {
    it('returns correct upgrade cost', () => {
      // Config multiplier is 5
      expect(getUpgradeCost('power_plant', 1000)).toBe(5000);
    });
    
    it('returns 0 for unsupported buildings', () => {
        expect(getUpgradeCost('road', 100)).toBe(0);
    });
  });
});
