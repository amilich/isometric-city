import { GameState, BuildingType, ZoneType } from '@/types/game';
import { createBuilding } from './factories';
import { getBuildingSize } from './constants';
import { 
  canPlaceMultiTileBuilding, 
  applyBuildingFootprint, 
  findBuildingOrigin 
} from './buildings';
import { requiresWaterAdjacency, getWaterAdjacency } from './utils';

export function placeBuilding(
  state: GameState,
  x: number,
  y: number,
  buildingType: BuildingType | null,
  zone: ZoneType | null
): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;

  if (tile.building.type === 'water') return state;

  if (buildingType === 'road') {
    const allowedTypes: BuildingType[] = ['grass', 'tree', 'road', 'rail'];
    if (!allowedTypes.includes(tile.building.type)) {
      return state;
    }
  }

  if (buildingType === 'rail') {
    const allowedTypes: BuildingType[] = ['grass', 'tree', 'rail', 'road'];
    if (!allowedTypes.includes(tile.building.type)) {
      return state;
    }
  }

  if (buildingType && buildingType !== 'road' && buildingType !== 'rail' && tile.building.type === 'road') {
    return state;
  }
  if (buildingType && buildingType !== 'road' && buildingType !== 'rail' && tile.building.type === 'rail') {
    return state;
  }

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));

  if (zone !== null) {
    if (zone === 'none') {
      const origin = findBuildingOrigin(newGrid, x, y, state.gridSize);
      
      if (origin) {
        const size = getBuildingSize(origin.buildingType);
        for (let dy = 0; dy < size.height; dy++) {
          for (let dx = 0; dx < size.width; dx++) {
            const clearX = origin.originX + dx;
            const clearY = origin.originY + dy;
            if (clearX < state.gridSize && clearY < state.gridSize) {
              newGrid[clearY][clearX].building = createBuilding('grass');
              newGrid[clearY][clearX].zone = 'none';
            }
          }
        }
      } else {
        if (tile.zone === 'none') {
          return state;
        }
        newGrid[y][x].zone = 'none';
        newGrid[y][x].building = createBuilding('grass');
      }
    } else {
      const allowedTypesForZoning: BuildingType[] = ['grass', 'tree', 'road'];
      if (!allowedTypesForZoning.includes(tile.building.type)) {
        return state;
      }
      newGrid[y][x].zone = zone;
    }
  } else if (buildingType) {
    const size = getBuildingSize(buildingType);
    
    let shouldFlip = false;
    if (requiresWaterAdjacency(buildingType)) {
      const waterCheck = getWaterAdjacency(newGrid, x, y, size.width, size.height, state.gridSize);
      if (!waterCheck.hasWater) {
        return state;
      }
      shouldFlip = waterCheck.shouldFlip;
    }
    
    if (size.width > 1 || size.height > 1) {
      if (!canPlaceMultiTileBuilding(newGrid, x, y, size.width, size.height, state.gridSize)) {
        return state;
      }
      applyBuildingFootprint(newGrid, x, y, buildingType, 'none', 1);
      if (shouldFlip) {
        newGrid[y][x].building.flipped = true;
      }
    } else {
      const allowedTypes: BuildingType[] = ['grass', 'tree', 'road', 'rail'];
      if (!allowedTypes.includes(tile.building.type)) {
        return state;
      }
      
      if (buildingType === 'rail' && tile.building.type === 'road') {
        newGrid[y][x].hasRailOverlay = true;
      } else if (buildingType === 'road' && tile.building.type === 'rail') {
        newGrid[y][x].building = createBuilding('road');
        newGrid[y][x].hasRailOverlay = true;
        newGrid[y][x].zone = 'none';
      } else if (buildingType === 'rail' && tile.hasRailOverlay) {
        // do nothing
      } else if (buildingType === 'road' && tile.hasRailOverlay) {
        // do nothing
      } else {
        newGrid[y][x].building = createBuilding(buildingType);
        newGrid[y][x].zone = 'none';
        if (buildingType !== 'road') {
          newGrid[y][x].hasRailOverlay = false;
        }
      }
      if (shouldFlip) {
        newGrid[y][x].building.flipped = true;
      }
    }
  }

  return { ...state, grid: newGrid };
}

export function bulldozeTile(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  if (tile.building.type === 'water') return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  
  const origin = findBuildingOrigin(newGrid, x, y, state.gridSize);
  
  if (origin) {
    const size = getBuildingSize(origin.buildingType);
    for (let dy = 0; dy < size.height; dy++) {
      for (let dx = 0; dx < size.width; dx++) {
        const clearX = origin.originX + dx;
        const clearY = origin.originY + dy;
        if (clearX < state.gridSize && clearY < state.gridSize) {
          newGrid[clearY][clearX].building = createBuilding('grass');
          newGrid[clearY][clearX].zone = 'none';
          newGrid[clearY][clearX].hasRailOverlay = false;
        }
      }
    }
  } else {
    newGrid[y][x].building = createBuilding('grass');
    newGrid[y][x].zone = 'none';
    newGrid[y][x].hasRailOverlay = false;
  }

  return { ...state, grid: newGrid };
}

export function placeSubway(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  if (tile.building.type === 'water') return state;
  if (tile.hasSubway) return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  newGrid[y][x].hasSubway = true;

  return { ...state, grid: newGrid };
}

export function removeSubway(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  if (!tile.hasSubway) return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  newGrid[y][x].hasSubway = false;

  return { ...state, grid: newGrid };
}

