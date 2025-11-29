import { useCallback, useMemo } from 'react';
import { Tile, BuildingType } from '@/types/game';
import { getBuildingSize } from '@/lib/simulation';

/** Pre-computed tile metadata for O(1) lookups during rendering */
export interface TileMetadata {
  isPartOfMultiTileBuilding: boolean;
  isPartOfParkBuilding: boolean;
  isAdjacentToWater: boolean;
  adjacentWaterDirs: { north: boolean; east: boolean; south: boolean; west: boolean };
  needsGreyBase: boolean;
  needsGreenBaseOverWater: boolean;
  needsGreenBaseForPark: boolean;
}

// Park building types that get green bases
const PARK_BUILDINGS_SET = new Set<BuildingType>([
  'park_large', 'baseball_field_small', 'football_field',
  'mini_golf_course', 'go_kart_track', 'amphitheater', 'greenhouse_garden',
  'marina_docks_small', 'roller_coaster_small', 'mountain_lodge', 'playground_large', 'mountain_trailhead'
]);

// All park types for checking isPark (includes single-tile parks)
const ALL_PARK_TYPES = new Set<BuildingType>([
  'park', 'park_large', 'tennis', 'basketball_courts', 'playground_small',
  'playground_large', 'baseball_field_small', 'soccer_field_small', 'football_field',
  'skate_park', 'mini_golf_course', 'bleachers_field', 'go_kart_track', 'amphitheater', 
  'greenhouse_garden', 'animal_pens_farm', 'cabin_house', 'campground', 'marina_docks_small', 
  'pier_large', 'roller_coaster_small', 'community_garden', 'pond_park', 'park_gate', 
  'mountain_lodge', 'mountain_trailhead'
]);

export function useBuildingHelpers(grid: Tile[][], gridSize: number) {
  // Pre-compute all tile metadata once when grid changes
  // This converts O(n) per-tile lookups during render to O(1) map lookups
  const tileMetadataMap = useMemo(() => {
    const map = new Map<string, TileMetadata>();
    const maxSize = 4;
    
    // Helper to check if a position has water
    const isWater = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
      return grid[y][x].building.type === 'water';
    };
    
    // First pass: compute isPartOfMultiTileBuilding and isPartOfParkBuilding for all tiles
    // These are expensive O(16) lookups that we want to do once
    const multiTileMap = new Map<string, boolean>();
    const parkBuildingMap = new Map<string, boolean>();
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const key = `${x},${y}`;
        
        // Check isPartOfMultiTileBuilding
        let isMultiTile = false;
        for (let dy = 0; dy < maxSize && !isMultiTile; dy++) {
          for (let dx = 0; dx < maxSize && !isMultiTile; dx++) {
            const originX = x - dx;
            const originY = y - dy;
            
            if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
              const originTile = grid[originY][originX];
              const buildingSize = getBuildingSize(originTile.building.type);
              
              if (buildingSize.width > 1 || buildingSize.height > 1) {
                if (x >= originX && x < originX + buildingSize.width &&
                    y >= originY && y < originY + buildingSize.height) {
                  isMultiTile = true;
                }
              }
            }
          }
        }
        multiTileMap.set(key, isMultiTile);
        
        // Check isPartOfParkBuilding
        let isParkBuilding = false;
        for (let dy = 0; dy < maxSize && !isParkBuilding; dy++) {
          for (let dx = 0; dx < maxSize && !isParkBuilding; dx++) {
            const originX = x - dx;
            const originY = y - dy;
            
            if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
              const originTile = grid[originY][originX];
              
              if (PARK_BUILDINGS_SET.has(originTile.building.type)) {
                const buildingSize = getBuildingSize(originTile.building.type);
                if (x >= originX && x < originX + buildingSize.width &&
                    y >= originY && y < originY + buildingSize.height) {
                  isParkBuilding = true;
                }
              }
            }
          }
        }
        parkBuildingMap.set(key, isParkBuilding);
      }
    }
    
    // Second pass: compute all derived metadata
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const key = `${x},${y}`;
        const tile = grid[y][x];
        const buildingType = tile.building.type;
        
        // Check water adjacency (all 8 directions for isAdjacentToWater, 4 for dirs)
        const adjacentWaterDirs = {
          north: isWater(x - 1, y),
          east: isWater(x, y - 1),
          south: isWater(x + 1, y),
          west: isWater(x, y + 1),
        };
        
        // Check diagonal directions too for isAdjacentToWater
        const isAdjacentToWater = adjacentWaterDirs.north || adjacentWaterDirs.east || 
                                   adjacentWaterDirs.south || adjacentWaterDirs.west ||
                                   isWater(x - 1, y - 1) || isWater(x + 1, y - 1) ||
                                   isWater(x - 1, y + 1) || isWater(x + 1, y + 1);
        
        const isPartOfMultiTileBuilding = multiTileMap.get(key) || false;
        const isPartOfParkBuilding = parkBuildingMap.get(key) || false;
        
        // Compute isPark
        const isPark = ALL_PARK_TYPES.has(buildingType) ||
                       (buildingType === 'empty' && isPartOfParkBuilding);
        
        // Compute isBuilding (for grey base)
        // Note: rail is excluded like road since it has its own rendering
        const isDirectBuilding = !isPark &&
          buildingType !== 'grass' &&
          buildingType !== 'empty' &&
          buildingType !== 'water' &&
          buildingType !== 'road' &&
          buildingType !== 'rail' &&
          buildingType !== 'tree';
        const isPartOfBuilding = buildingType === 'empty' && isPartOfMultiTileBuilding;
        const needsGreyBase = (isDirectBuilding || isPartOfBuilding) && !isPark;
        
        // Compute green base needs
        const hasGreenBase = buildingType === 'grass' || buildingType === 'empty' || buildingType === 'tree';
        const needsGreenBaseOverWater = hasGreenBase && isAdjacentToWater;
        const needsGreenBaseForPark = (buildingType === 'park' || buildingType === 'park_large') ||
                                      (buildingType === 'empty' && isPartOfParkBuilding);
        
        map.set(key, {
          isPartOfMultiTileBuilding,
          isPartOfParkBuilding,
          isAdjacentToWater,
          adjacentWaterDirs,
          needsGreyBase,
          needsGreenBaseOverWater,
          needsGreenBaseForPark,
        });
      }
    }
    
    return map;
  }, [grid, gridSize]);
  
  // O(1) lookup functions that use the pre-computed map
  const isPartOfMultiTileBuilding = useCallback((gridX: number, gridY: number): boolean => {
    return tileMetadataMap.get(`${gridX},${gridY}`)?.isPartOfMultiTileBuilding ?? false;
  }, [tileMetadataMap]);

  const isPartOfParkBuilding = useCallback((gridX: number, gridY: number): boolean => {
    return tileMetadataMap.get(`${gridX},${gridY}`)?.isPartOfParkBuilding ?? false;
  }, [tileMetadataMap]);
  
  // Get full tile metadata for a position (O(1) lookup)
  const getTileMetadata = useCallback((gridX: number, gridY: number): TileMetadata | null => {
    return tileMetadataMap.get(`${gridX},${gridY}`) ?? null;
  }, [tileMetadataMap]);

  const findBuildingOrigin = useCallback((gridX: number, gridY: number): { originX: number; originY: number; buildingType: BuildingType } | null => {
    const maxSize = 4;
    
    const tile = grid[gridY]?.[gridX];
    if (!tile) return null;
    
    if (tile.building.type !== 'empty' && 
        tile.building.type !== 'grass' && 
        tile.building.type !== 'water' && 
        tile.building.type !== 'road' && 
        tile.building.type !== 'tree') {
      const size = getBuildingSize(tile.building.type);
      if (size.width > 1 || size.height > 1) {
        return { originX: gridX, originY: gridY, buildingType: tile.building.type };
      }
      return null;
    }
    
    if (tile.building.type === 'empty') {
      for (let dy = 0; dy < maxSize; dy++) {
        for (let dx = 0; dx < maxSize; dx++) {
          const originX = gridX - dx;
          const originY = gridY - dy;
          
          if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
            const originTile = grid[originY][originX];
            
            if (originTile.building.type !== 'empty' && 
                originTile.building.type !== 'grass' &&
                originTile.building.type !== 'water' &&
                originTile.building.type !== 'road' &&
                originTile.building.type !== 'tree') {
              const size = getBuildingSize(originTile.building.type);
              
              if (size.width > 1 || size.height > 1) {
                if (gridX >= originX && gridX < originX + size.width &&
                    gridY >= originY && gridY < originY + size.height) {
                  return { originX, originY, buildingType: originTile.building.type };
                }
              }
            }
          }
        }
      }
    }
    
    return null;
  }, [grid, gridSize]);

  return {
    isPartOfMultiTileBuilding,
    findBuildingOrigin,
    isPartOfParkBuilding,
    getTileMetadata,
    tileMetadataMap,
  };
}
