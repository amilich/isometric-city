import { Stats, ServiceCoverage, Tile, AdvisorMessage, GameState } from '@/types/game';
import { 
  RESIDENTIAL_BUILDINGS, 
  COMMERCIAL_BUILDINGS, 
  INDUSTRIAL_BUILDINGS,
  getBuildingSize 
} from './constants';
import { isStarterBuilding } from './utils';
import { hasRoadAccess, canSpawnMultiTileBuilding } from './buildings';

export function generateAdvisorMessages(stats: Stats, services: ServiceCoverage, grid: Tile[][]): AdvisorMessage[] {
  const messages: AdvisorMessage[] = [];

  let unpoweredBuildings = 0;
  let unwateredBuildings = 0;
  let abandonedBuildings = 0;
  let abandonedResidential = 0;
  let abandonedCommercial = 0;
  let abandonedIndustrial = 0;
  
  for (const row of grid) {
    for (const tile of row) {
      if (tile.zone !== 'none' && tile.building.type !== 'grass') {
        if (!tile.building.powered) unpoweredBuildings++;
        if (!tile.building.watered) unwateredBuildings++;
      }
      
      if (tile.building.abandoned) {
        abandonedBuildings++;
        if (tile.zone === 'residential') abandonedResidential++;
        else if (tile.zone === 'commercial') abandonedCommercial++;
        else if (tile.zone === 'industrial') abandonedIndustrial++;
      }
    }
  }

  if (unpoweredBuildings > 0) {
    messages.push({
      name: 'Advisors.Power',
      icon: 'power',
      messages: [JSON.stringify({ key: 'Messages.LackPower', params: { count: unpoweredBuildings } })],
      priority: unpoweredBuildings > 10 ? 'high' : 'medium',
    });
  }

  if (unwateredBuildings > 0) {
    messages.push({
      name: 'Advisors.Water',
      icon: 'water',
      messages: [JSON.stringify({ key: 'Messages.LackWater', params: { count: unwateredBuildings } })],
      priority: unwateredBuildings > 10 ? 'high' : 'medium',
    });
  }

  const netIncome = stats.income - stats.expenses;
  if (netIncome < 0) {
    messages.push({
      name: 'Advisors.Finance',
      icon: 'cash',
      messages: [JSON.stringify({ key: 'Messages.Deficit', params: { amount: Math.abs(netIncome) } })],
      priority: netIncome < -500 ? 'critical' : 'high',
    });
  }

  if (stats.safety < 40) {
    messages.push({
      name: 'Advisors.Safety',
      icon: 'shield',
      messages: [JSON.stringify({ key: 'Messages.CrimeRising' })],
      priority: stats.safety < 20 ? 'critical' : 'high',
    });
  }

  if (stats.health < 50) {
    messages.push({
      name: 'Advisors.Health',
      icon: 'hospital',
      messages: [JSON.stringify({ key: 'Messages.HealthLacking' })],
      priority: stats.health < 30 ? 'high' : 'medium',
    });
  }

  if (stats.education < 50) {
    messages.push({
      name: 'Advisors.Education',
      icon: 'education',
      messages: [JSON.stringify({ key: 'Messages.EducationLow' })],
      priority: stats.education < 30 ? 'high' : 'medium',
    });
  }

  if (stats.environment < 40) {
    messages.push({
      name: 'Advisors.Environment',
      icon: 'environment',
      messages: [JSON.stringify({ key: 'Messages.PollutionHigh' })],
      priority: stats.environment < 20 ? 'high' : 'medium',
    });
  }

  const jobRatio = stats.jobs / (stats.population || 1);
  if (stats.population > 100 && jobRatio < 0.8) {
    messages.push({
      name: 'Advisors.Employment',
      icon: 'jobs',
      messages: [JSON.stringify({ key: 'Messages.UnemploymentHigh' })],
      priority: jobRatio < 0.5 ? 'high' : 'medium',
    });
  }

  if (abandonedBuildings > 0) {
    const details: string[] = [];
    if (abandonedResidential > 0) details.push(`${abandonedResidential} residential`);
    if (abandonedCommercial > 0) details.push(`${abandonedCommercial} commercial`);
    if (abandonedIndustrial > 0) details.push(`${abandonedIndustrial} industrial`);
    
    messages.push({
      name: 'Advisors.UrbanPlanning',
      icon: 'planning',
      messages: [
        JSON.stringify({ key: 'Messages.AbandonedBuildings', params: { count: abandonedBuildings, details: details.join(', ') } }),
        JSON.stringify({ key: 'Messages.Oversupply' }),
        JSON.stringify({ key: 'Messages.IncreaseDemand' })
      ],
      priority: abandonedBuildings > 10 ? 'high' : abandonedBuildings > 5 ? 'medium' : 'low',
    });
  }

  return messages;
}

export interface DevelopmentBlocker {
  reason: string;
  details: string;
}

export function getDevelopmentBlockers(
  state: GameState,
  x: number,
  y: number
): DevelopmentBlocker[] {
  const blockers: DevelopmentBlocker[] = [];
  const tile = state.grid[y]?.[x];
  
  if (!tile) {
    blockers.push({ reason: 'Invalid tile', details: `Tile at (${x}, ${y}) does not exist` });
    return blockers;
  }
  
  if (tile.zone === 'none') {
    blockers.push({ reason: 'Not zoned', details: 'Tile has no zone assigned' });
    return blockers;
  }
  
  if (tile.building.type !== 'grass' && tile.building.type !== 'tree') {
    return blockers;
  }
  
  const roadAccess = hasRoadAccess(state.grid, x, y, state.gridSize);
  if (!roadAccess) {
    blockers.push({
      reason: 'No road access',
      details: 'Tile must be within 8 tiles of a road (through same-zone tiles)'
    });
  }
  
  const buildingList = tile.zone === 'residential' ? RESIDENTIAL_BUILDINGS :
    tile.zone === 'commercial' ? COMMERCIAL_BUILDINGS : INDUSTRIAL_BUILDINGS;
  const candidate = buildingList[0];
  
  const wouldBeStarter = isStarterBuilding(x, y, candidate);
  
  const hasPower = state.services.power[y][x];
  if (!hasPower && !wouldBeStarter) {
    blockers.push({
      reason: 'No power',
      details: 'Build a power plant nearby to provide electricity'
    });
  }
  
  const hasWater = state.services.water[y][x];
  if (!hasWater && !wouldBeStarter) {
    blockers.push({
      reason: 'No water',
      details: 'Build a water tower nearby to provide water'
    });
  }
  const candidateSize = getBuildingSize(candidate);
  
  if (candidateSize.width > 1 || candidateSize.height > 1) {
    if (!canSpawnMultiTileBuilding(state.grid, x, y, candidateSize.width, candidateSize.height, tile.zone, state.gridSize)) {
      const footprintBlockers: string[] = [];
      
      if (x + candidateSize.width > state.gridSize || y + candidateSize.height > state.gridSize) {
        footprintBlockers.push('Too close to map edge');
      }
      
      for (let dy = 0; dy < candidateSize.height && footprintBlockers.length < 3; dy++) {
        for (let dx = 0; dx < candidateSize.width && footprintBlockers.length < 3; dx++) {
          const checkTile = state.grid[y + dy]?.[x + dx];
          if (!checkTile) {
            footprintBlockers.push(`Tile (${x + dx}, ${y + dy}) is out of bounds`);
          } else if (checkTile.zone !== tile.zone) {
            footprintBlockers.push(`Tile (${x + dx}, ${y + dy}) has different zone: ${checkTile.zone}`);
          } else if (checkTile.building.type !== 'grass' && checkTile.building.type !== 'tree') {
            footprintBlockers.push(`Tile (${x + dx}, ${y + dy}) has ${checkTile.building.type}`);
          }
        }
      }
      
      blockers.push({
        reason: 'Footprint blocked',
        details: `${candidate} needs ${candidateSize.width}x${candidateSize.height} tiles. Issues: ${footprintBlockers.join('; ')}`
      });
    }
  }
  
  const hasUtilities = hasPower && hasWater;
  if (blockers.length === 0 && roadAccess && (hasUtilities || wouldBeStarter)) {
    blockers.push({
      reason: 'Waiting for development',
      details: wouldBeStarter && !hasUtilities 
        ? 'Starter building can develop here without utilities! (5% chance per tick)' 
        : 'All conditions met! Building will spawn soon (5% chance per tick)'
    });
  }
  
  return blockers;
}

