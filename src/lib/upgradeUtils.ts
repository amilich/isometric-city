import { Building, BuildingType } from '@/types/game';
import { BUILDING_UPGRADES } from '@/config/buildingUpgrades';

/**
 * Get the effective range of a building, accounting for upgrades.
 */
export function getBuildingRange(building: Building, baseRange: number): number {
  if (!building.isUpgraded) return baseRange;
  
  const config = BUILDING_UPGRADES[building.type];
  if (!config) return baseRange;

  return Math.floor(baseRange * config.rangeMultiplier);
}

/**
 * Get the effective maintenance cost of a building.
 */
export function getBuildingMaintenance(building: Building, baseCost: number): number {
  if (!building.isUpgraded) return baseCost;
  
  const config = BUILDING_UPGRADES[building.type];
  if (!config) return baseCost;

  return Math.floor(baseCost * config.maintenanceMultiplier);
}

/**
 * Get the effective pollution of a building.
 */
export function getBuildingPollution(building: Building, basePollution: number): number {
  if (!building.isUpgraded) return basePollution;
  
  const config = BUILDING_UPGRADES[building.type];
  if (!config) return basePollution;

  return Math.floor(basePollution * config.pollutionMultiplier);
}

/**
 * Get the effective effect magnitude (efficiency) of a building.
 * This is a multiplier applied to the base effect (default 1.0).
 */
export function getBuildingEffectMagnitude(building: Building): number {
  if (!building.isUpgraded) return 1.0;
  
  const config = BUILDING_UPGRADES[building.type];
  if (!config) return 1.0;

  return config.effectMagnitudeMultiplier;
}

/**
 * Get the cost to upgrade a building.
 */
export function getUpgradeCost(buildingType: BuildingType, baseCost: number): number {
  const config = BUILDING_UPGRADES[buildingType];
  if (!config) return 0; // Should not happen if checked properly
  
  return Math.floor(baseCost * config.costMultiplier);
}
