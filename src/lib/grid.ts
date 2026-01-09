// Grid operations: expansion, shrinking, terraforming, subway, and development blockers

import {
  GameState,
  Tile,
  AdjacentCity,
  RESIDENTIAL_BUILDINGS,
  COMMERCIAL_BUILDINGS,
  INDUSTRIAL_BUILDINGS,
} from '@/types/game';
import { createBuilding, createTile, findBuildingOrigin, getBuildingSize, canSpawnMultiTileBuilding, isStarterBuilding, hasRoadAccess } from './buildings';
import { perlinNoise } from './terrain';
import { hasRoadAtEdge } from './adjacency';

// Place a subway line underground (doesn't affect surface buildings)
export function placeSubway(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  
  // Can't place subway under water
  if (tile.building.type === 'water') return state;
  
  // Already has subway
  if (tile.hasSubway) return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  newGrid[y][x].hasSubway = true;

  return { ...state, grid: newGrid };
}

// Remove subway from a tile
export function removeSubway(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  
  // No subway to remove
  if (!tile.hasSubway) return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  newGrid[y][x].hasSubway = false;

  return { ...state, grid: newGrid };
}

// Terraform a tile into water
export function placeWaterTerraform(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  
  // Already water - do nothing
  if (tile.building.type === 'water') return state;
  
  // Don't allow terraforming bridges - would break them
  if (tile.building.type === 'bridge') return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  
  // Check if this tile is part of a multi-tile building
  const origin = findBuildingOrigin(newGrid, x, y, state.gridSize);
  
  if (origin) {
    // Clear the entire multi-tile building first, then place water on this tile
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
  }
  
  // Now place water on the target tile
  newGrid[y][x].building = createBuilding('water');
  newGrid[y][x].zone = 'none';
  newGrid[y][x].hasSubway = false; // Remove any subway under water

  return { ...state, grid: newGrid };
}

// Terraform a tile into land (grass)
export function placeLandTerraform(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  
  // Only works on water tiles
  if (tile.building.type !== 'water') return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  
  // Convert water to grass
  newGrid[y][x].building = createBuilding('grass');
  newGrid[y][x].zone = 'none';

  return { ...state, grid: newGrid };
}

// Diagnostic function to explain why a zoned tile isn't developing a building
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
  
  // Only analyze zoned tiles
  if (tile.zone === 'none') {
    blockers.push({ reason: 'Not zoned', details: 'Tile has no zone assigned' });
    return blockers;
  }
  
  // If it already has a building, no blockers
  if (tile.building.type !== 'grass' && tile.building.type !== 'tree') {
    // It's already developed or is a placeholder for a multi-tile building
    return blockers;
  }
  
  // Check road access
  const roadAccess = hasRoadAccess(state.grid, x, y, state.gridSize);
  if (!roadAccess) {
    blockers.push({
      reason: 'No road access',
      details: 'Tile must be within 8 tiles of a road (through same-zone tiles)'
    });
  }
  
  // Check if multi-tile building can spawn here
  const buildingList = tile.zone === 'residential' ? RESIDENTIAL_BUILDINGS :
    tile.zone === 'commercial' ? COMMERCIAL_BUILDINGS : INDUSTRIAL_BUILDINGS;
  const candidate = buildingList[0];
  
  // Starter buildings (house_small, shop_small, factory_small) don't require power/water
  // They represent small-scale, self-sufficient operations
  const wouldBeStarter = isStarterBuilding(x, y, candidate);
  
  // Check power (not required for starter buildings)
  const hasPower = state.services.power[y][x];
  if (!hasPower && !wouldBeStarter) {
    blockers.push({
      reason: 'No power',
      details: 'Build a power plant nearby to provide electricity'
    });
  }
  
  // Check water (not required for starter buildings)
  const hasWater = state.services.water[y][x];
  if (!hasWater && !wouldBeStarter) {
    blockers.push({
      reason: 'No water',
      details: 'Build a water tower nearby to provide water'
    });
  }
  const candidateSize = getBuildingSize(candidate);
  
  if (candidateSize.width > 1 || candidateSize.height > 1) {
    // Check if the footprint is available
    if (!canSpawnMultiTileBuilding(state.grid, x, y, candidateSize.width, candidateSize.height, tile.zone, state.gridSize)) {
      // Find out specifically why
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
  
  // If no blockers found, it's just waiting for RNG
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

/**
 * Shrink the grid by removing tiles from all sides.
 * The shrink deletes the outer tiles on each edge.
 * 
 * @param currentGrid The existing grid
 * @param currentSize The current grid size
 * @param shrinkAmount How many tiles to remove from EACH side (total reduction = currentSize - 2*shrinkAmount)
 * @returns New shrunken grid, or null if grid would be too small
 */
export function shrinkGrid(
  currentGrid: Tile[][],
  currentSize: number,
  shrinkAmount: number = 15
): { grid: Tile[][]; newSize: number } | null {
  const newSize = currentSize - shrinkAmount * 2;
  
  // Don't allow shrinking below a minimum size
  if (newSize < 20) {
    return null;
  }
  
  const grid: Tile[][] = [];
  
  // Copy tiles from the interior of the old grid
  for (let y = 0; y < newSize; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < newSize; x++) {
      const oldX = x + shrinkAmount;
      const oldY = y + shrinkAmount;
      const oldTile = currentGrid[oldY][oldX];
      
      // Copy tile with updated coordinates
      row.push({
        ...oldTile,
        x,
        y,
        building: { ...oldTile.building },
      });
    }
    grid.push(row);
  }
  
  return { grid, newSize };
}

/**
 * Expand the grid by adding tiles on all sides.
 * The expansion is intelligent:
 * - Land edges extend as land (not forced to water)
 * - Water/ocean edges extend as water
 * - Water bodies extend naturally based on proximity
 * - New land areas get grass with scattered trees
 * 
 * @param currentGrid The existing grid
 * @param currentSize The current grid size
 * @param expansion How many tiles to add on EACH side (total new size = currentSize + 2*expansion)
 * @returns New expanded grid
 */
export function expandGrid(
  currentGrid: Tile[][],
  currentSize: number,
  expansion: number = 15
): { grid: Tile[][]; newSize: number } {
  const newSize = currentSize + expansion * 2;
  const grid: Tile[][] = [];
  
  // Helper to check if position is water in the old grid
  const isOldWater = (oldX: number, oldY: number): boolean => {
    if (oldX < 0 || oldY < 0 || oldX >= currentSize || oldY >= currentSize) return false;
    return currentGrid[oldY][oldX].building.type === 'water';
  };
  
  // Helper to check if position is land (not water) in the old grid
  const isOldLand = (oldX: number, oldY: number): boolean => {
    if (oldX < 0 || oldY < 0 || oldX >= currentSize || oldY >= currentSize) return false;
    return currentGrid[oldY][oldX].building.type !== 'water';
  };
  
  // Find the closest edge tile type from the original grid
  // Returns: 'water' | 'land' | 'mixed' depending on what was at the nearest edge
  const getClosestEdgeType = (newX: number, newY: number): 'water' | 'land' | 'mixed' => {
    const oldX = newX - expansion;
    const oldY = newY - expansion;
    
    // Determine which edge(s) we're extending from
    let waterCount = 0;
    let landCount = 0;
    
    // Check a strip along the nearest original edge
    if (oldX < 0) {
      // Left of original grid - check left edge (x=0) of original
      const startY = Math.max(0, oldY - 3);
      const endY = Math.min(currentSize - 1, oldY + 3);
      for (let y = startY; y <= endY; y++) {
        if (isOldWater(0, y)) waterCount++;
        else landCount++;
      }
    } else if (oldX >= currentSize) {
      // Right of original grid - check right edge (x=currentSize-1)
      const startY = Math.max(0, oldY - 3);
      const endY = Math.min(currentSize - 1, oldY + 3);
      for (let y = startY; y <= endY; y++) {
        if (isOldWater(currentSize - 1, y)) waterCount++;
        else landCount++;
      }
    }
    
    if (oldY < 0) {
      // Above original grid - check top edge (y=0)
      const startX = Math.max(0, oldX - 3);
      const endX = Math.min(currentSize - 1, oldX + 3);
      for (let x = startX; x <= endX; x++) {
        if (isOldWater(x, 0)) waterCount++;
        else landCount++;
      }
    } else if (oldY >= currentSize) {
      // Below original grid - check bottom edge (y=currentSize-1)
      const startX = Math.max(0, oldX - 3);
      const endX = Math.min(currentSize - 1, oldX + 3);
      for (let x = startX; x <= endX; x++) {
        if (isOldWater(x, currentSize - 1)) waterCount++;
        else landCount++;
      }
    }
    
    // Corner case: check both edges
    if ((oldX < 0 || oldX >= currentSize) && (oldY < 0 || oldY >= currentSize)) {
      // In a corner - check the corner tile
      const cornerX = oldX < 0 ? 0 : currentSize - 1;
      const cornerY = oldY < 0 ? 0 : currentSize - 1;
      if (isOldWater(cornerX, cornerY)) waterCount += 2;
      else landCount += 2;
    }
    
    if (waterCount === 0 && landCount === 0) return 'mixed';
    if (waterCount > landCount * 2) return 'water';
    if (landCount > waterCount * 2) return 'land';
    return 'mixed';
  };
  
  // Helper to get distance from the original grid boundary (how far into expansion zone)
  const getDistanceFromOriginalBoundary = (newX: number, newY: number): number => {
    const oldX = newX - expansion;
    const oldY = newY - expansion;
    
    // Calculate distance to nearest edge of original grid
    let distToOriginal = 0;
    if (oldX < 0) distToOriginal = Math.max(distToOriginal, -oldX);
    if (oldY < 0) distToOriginal = Math.max(distToOriginal, -oldY);
    if (oldX >= currentSize) distToOriginal = Math.max(distToOriginal, oldX - currentSize + 1);
    if (oldY >= currentSize) distToOriginal = Math.max(distToOriginal, oldY - currentSize + 1);
    
    // For corners, use the max of both distances
    return distToOriginal;
  };
  
  // Helper to find water percentage along the nearest original edge
  // Also returns whether this appears to be a "sea" (large contiguous water along edge)
  const getEdgeWaterInfo = (newX: number, newY: number, sampleRadius: number = 10): { density: number; isSea: boolean } => {
    const oldX = newX - expansion;
    const oldY = newY - expansion;
    
    let waterCount = 0;
    let totalCount = 0;
    let consecutiveWater = 0;
    let maxConsecutive = 0;
    
    // Sample along the nearest edge(s) of the original grid
    if (oldX < 0) {
      // Left of grid - sample left edge (x=0)
      consecutiveWater = 0;
      for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
        const sampleY = Math.max(0, Math.min(currentSize - 1, oldY + dy));
        if (isOldWater(0, sampleY)) {
          waterCount++;
          consecutiveWater++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveWater);
        } else {
          consecutiveWater = 0;
        }
        totalCount++;
      }
    }
    if (oldX >= currentSize) {
      // Right of grid - sample right edge
      consecutiveWater = 0;
      for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
        const sampleY = Math.max(0, Math.min(currentSize - 1, oldY + dy));
        if (isOldWater(currentSize - 1, sampleY)) {
          waterCount++;
          consecutiveWater++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveWater);
        } else {
          consecutiveWater = 0;
        }
        totalCount++;
      }
    }
    if (oldY < 0) {
      // Above grid - sample top edge
      consecutiveWater = 0;
      for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
        const sampleX = Math.max(0, Math.min(currentSize - 1, oldX + dx));
        if (isOldWater(sampleX, 0)) {
          waterCount++;
          consecutiveWater++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveWater);
        } else {
          consecutiveWater = 0;
        }
        totalCount++;
      }
    }
    if (oldY >= currentSize) {
      // Below grid - sample bottom edge
      consecutiveWater = 0;
      for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
        const sampleX = Math.max(0, Math.min(currentSize - 1, oldX + dx));
        if (isOldWater(sampleX, currentSize - 1)) {
          waterCount++;
          consecutiveWater++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveWater);
        } else {
          consecutiveWater = 0;
        }
        totalCount++;
      }
    }
    
    const density = totalCount > 0 ? waterCount / totalCount : 0;
    // A "sea" has high density AND long consecutive water stretches (not just scattered water)
    const isSea = density > 0.7 && maxConsecutive >= sampleRadius;
    
    return { density, isSea };
  };
  
  // Generate a random seed for this expansion (consistent within one expansion call)
  const expansionSeed = Date.now() % 100000;
  
  // First pass: determine terrain type for each new tile
  for (let y = 0; y < newSize; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < newSize; x++) {
      const oldX = x - expansion;
      const oldY = y - expansion;
      
      // Check if this position was in the old grid
      const wasInOldGrid = oldX >= 0 && oldY >= 0 && oldX < currentSize && oldY < currentSize;
      
      if (wasInOldGrid) {
        // Copy the old tile with updated coordinates
        const oldTile = currentGrid[oldY][oldX];
        row.push({
          ...oldTile,
          x,
          y,
          // Deep copy building to avoid reference issues
          building: { ...oldTile.building },
        });
      } else {
        // New tile - taper OUTWARD from original grid
        const distFromBoundary = getDistanceFromOriginalBoundary(x, y);
        const { density: edgeWaterDensity, isSea } = getEdgeWaterInfo(x, y);
        
        // Use Perlin noise for organic coastline shapes
        const coastNoise = perlinNoise(x * 0.12, y * 0.12, expansionSeed, 3);
        
        let isWater = false;
        
        if (isSea) {
          // This is a SEA - extend all the way to the new map edge with organic coastline
          // Only add slight variation at the very edges for natural look
          const distFromNewEdge = Math.min(x, y, newSize - 1 - x, newSize - 1 - y);
          
          if (distFromNewEdge <= 2) {
            // At the very edge of new map - keep as water with slight variation
            isWater = coastNoise > 0.2;
          } else {
            // Interior - full water
            isWater = true;
          }
        } else if (edgeWaterDensity > 0.3) {
          // Regular water body (lake or small bay) - taper outward
          // Water probability is HIGH near boundary and DECREASES as we go outward
          const maxExpansionDist = expansion * (0.5 + coastNoise * 0.3 + edgeWaterDensity * 0.4);
          
          // Probability = 1 at boundary, tapers to 0 at maxExpansionDist
          const taperRatio = distFromBoundary / maxExpansionDist;
          const waterProb = Math.max(0, 1 - Math.pow(taperRatio, 1.3)) * edgeWaterDensity;
          
          // Add some noise for organic edges
          const noiseThreshold = 0.12 + coastNoise * 0.18;
          isWater = waterProb > noiseThreshold;
        }
        
        if (isWater) {
          row.push(createTile(x, y, 'water'));
        } else {
          // Grass or tree
          const treeProbability = 0.12;
          const treeNoise = perlinNoise(x * 0.3, y * 0.3, expansionSeed + 500, 2);
          
          if (treeNoise < treeProbability) {
            row.push(createTile(x, y, 'tree'));
          } else {
            row.push(createTile(x, y, 'grass'));
          }
        }
      }
    }
    grid.push(row);
  }
  
  // Helper to count water neighbors in a given radius
  const countWaterNeighbors = (cx: number, cy: number, radius: number = 1): number => {
    let count = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < newSize && ny < newSize) {
          if (grid[ny][nx].building.type === 'water') count++;
        }
      }
    }
    return count;
  };
  
  // Helper to check if a tile is in the expansion zone
  const isExpansionTile = (x: number, y: number): boolean => {
    const oldX = x - expansion;
    const oldY = y - expansion;
    return oldX < 0 || oldY < 0 || oldX >= currentSize || oldY >= currentSize;
  };
  
  // Smoothing passes: Use cellular automata rules to create smooth coastlines
  // Run multiple iterations to smooth out jagged edges
  for (let iteration = 0; iteration < 4; iteration++) {
    const changes: { x: number; y: number; toWater: boolean }[] = [];
    
    for (let y = 0; y < newSize; y++) {
      for (let x = 0; x < newSize; x++) {
        if (!isExpansionTile(x, y)) continue;
        
        const isWater = grid[y][x].building.type === 'water';
        const neighbors = countWaterNeighbors(x, y, 1);
        const extendedNeighbors = countWaterNeighbors(x, y, 2);
        
        if (isWater) {
          // Remove isolated water tiles (less than 2 neighbors) or peninsulas (1-2 neighbors surrounded by land)
          if (neighbors <= 1) {
            changes.push({ x, y, toWater: false });
          }
        } else {
          // Fill in bays and smooth concave coastlines (5+ neighbors means surrounded by water)
          if (neighbors >= 5) {
            changes.push({ x, y, toWater: true });
          }
          // Also fill tiles that are nearly surrounded (4 neighbors and many extended)
          else if (neighbors >= 4 && extendedNeighbors >= 16) {
            changes.push({ x, y, toWater: true });
          }
        }
      }
    }
    
    // Apply changes
    for (const change of changes) {
      if (change.toWater) {
        grid[change.y][change.x].building = createBuilding('water');
      } else {
        const treeNoise = perlinNoise(change.x * 0.3, change.y * 0.3, expansionSeed + 1000, 2);
        grid[change.y][change.x].building = createBuilding(treeNoise < 0.15 ? 'tree' : 'grass');
      }
    }
  }
  
  // Final smoothing pass: Remove any remaining single-tile peninsulas or isolated water
  for (let y = 0; y < newSize; y++) {
    for (let x = 0; x < newSize; x++) {
      if (!isExpansionTile(x, y)) continue;
      
      const isWater = grid[y][x].building.type === 'water';
      const neighbors = countWaterNeighbors(x, y, 1);
      
      if (isWater && neighbors <= 1) {
        const treeNoise = perlinNoise(x * 0.3, y * 0.3, expansionSeed + 2000, 2);
        grid[y][x].building = createBuilding(treeNoise < 0.15 ? 'tree' : 'grass');
      } else if (!isWater && neighbors >= 6) {
        grid[y][x].building = createBuilding('water');
      }
    }
  }
  
  // Sixth pass: Generate NEW lakes in expanded land areas
  // Create a mix of big lakes and small ponds
  const lakeNoise = (lx: number, ly: number) => perlinNoise(lx, ly, expansionSeed + 3000, 3);
  const minDistFromEdge = 2;
  const minDistBetweenBigLakes = Math.max(expansion * 0.25, 4);
  const minDistBetweenSmallLakes = Math.max(expansion * 0.15, 3);
  
  // Find potential lake centers for BIG lakes
  const bigLakeCenters: { x: number; y: number; noise: number }[] = [];
  
  for (let y = minDistFromEdge; y < newSize - minDistFromEdge; y++) {
    for (let x = minDistFromEdge; x < newSize - minDistFromEdge; x++) {
      if (!isExpansionTile(x, y)) continue;
      if (grid[y][x].building.type === 'water') continue;
      
      const noiseVal = lakeNoise(x, y);
      
      // Low noise = good for big lakes
      if (noiseVal < 0.35) {
        let tooClose = false;
        for (const center of bigLakeCenters) {
          const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
          if (dist < minDistBetweenBigLakes) {
            tooClose = true;
            break;
          }
        }
        
        if (!tooClose) {
          bigLakeCenters.push({ x, y, noise: noiseVal });
        }
      }
    }
  }
  
  // Pick 4-8 big lakes
  bigLakeCenters.sort((a, b) => a.noise - b.noise);
  const numBigLakes = Math.min(bigLakeCenters.length, 4 + Math.floor(Math.random() * 5));
  const selectedBigLakeCenters = bigLakeCenters.slice(0, numBigLakes);
  
  // Find potential centers for SMALL ponds (different noise range)
  const smallLakeCenters: { x: number; y: number; noise: number }[] = [];
  const pondNoise = (px: number, py: number) => perlinNoise(px, py, expansionSeed + 4000, 2);
  
  for (let y = minDistFromEdge; y < newSize - minDistFromEdge; y++) {
    for (let x = minDistFromEdge; x < newSize - minDistFromEdge; x++) {
      if (!isExpansionTile(x, y)) continue;
      if (grid[y][x].building.type === 'water') continue;
      
      const noiseVal = pondNoise(x, y);
      
      // Different noise range for small ponds
      if (noiseVal < 0.45) {
        // Check distance from big lakes
        let tooCloseToBig = false;
        for (const center of selectedBigLakeCenters) {
          const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
          if (dist < minDistBetweenBigLakes) {
            tooCloseToBig = true;
            break;
          }
        }
        if (tooCloseToBig) continue;
        
        // Check distance from other small lakes
        let tooClose = false;
        for (const center of smallLakeCenters) {
          const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
          if (dist < minDistBetweenSmallLakes) {
            tooClose = true;
            break;
          }
        }
        
        if (!tooClose) {
          smallLakeCenters.push({ x, y, noise: noiseVal });
        }
      }
    }
  }
  
  // Pick 10-20 small ponds
  smallLakeCenters.sort((a, b) => a.noise - b.noise);
  const numSmallLakes = Math.min(smallLakeCenters.length, 10 + Math.floor(Math.random() * 11));
  const selectedSmallLakeCenters = smallLakeCenters.slice(0, numSmallLakes);
  
  // Combine all lake centers with size info
  const allLakeCenters: { x: number; y: number; noise: number; isBig: boolean }[] = [
    ...selectedBigLakeCenters.map(c => ({ ...c, isBig: true })),
    ...selectedSmallLakeCenters.map(c => ({ ...c, isBig: false })),
  ];
  
  // Grow each lake using flood-fill
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  
  for (const center of allLakeCenters) {
    // Big lakes: 25-70 tiles, Small ponds: 4-15 tiles
    const targetSize = center.isBig 
      ? 25 + Math.floor(Math.random() * 46)
      : 4 + Math.floor(Math.random() * 12);
    const lakeTiles: { x: number; y: number }[] = [{ x: center.x, y: center.y }];
    const candidates: { x: number; y: number; dist: number; noise: number }[] = [];
    
    for (const [dx, dy] of directions) {
      const nx = center.x + dx;
      const ny = center.y + dy;
      if (nx >= 1 && nx < newSize - 1 &&
          ny >= 1 && ny < newSize - 1 &&
          grid[ny][nx].building.type !== 'water') {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const noise = lakeNoise(nx, ny);
        candidates.push({ x: nx, y: ny, dist, noise });
      }
    }
    
    while (lakeTiles.length < targetSize && candidates.length > 0) {
      candidates.sort((a, b) => {
        if (Math.abs(a.dist - b.dist) < 0.5) {
          return a.noise - b.noise;
        }
        return a.dist - b.dist;
      });
      
      const pickIndex = Math.floor(Math.random() * Math.min(5, candidates.length));
      const picked = candidates.splice(pickIndex, 1)[0];
      
      if (lakeTiles.some(t => t.x === picked.x && t.y === picked.y)) continue;
      if (grid[picked.y][picked.x].building.type === 'water') continue;
      
      lakeTiles.push({ x: picked.x, y: picked.y });
      
      for (const [dx, dy] of directions) {
        const nx = picked.x + dx;
        const ny = picked.y + dy;
        if (nx >= 1 && nx < newSize - 1 &&
            ny >= 1 && ny < newSize - 1 &&
            grid[ny][nx].building.type !== 'water' &&
            !lakeTiles.some(t => t.x === nx && t.y === ny) &&
            !candidates.some(c => c.x === nx && c.y === ny)) {
          const dist = Math.sqrt((nx - center.x) ** 2 + (ny - center.y) ** 2);
          const noise = lakeNoise(nx, ny);
          candidates.push({ x: nx, y: ny, dist, noise });
        }
      }
    }
    
    // Apply lake tiles to grid
    for (const tile of lakeTiles) {
      grid[tile.y][tile.x].building = createBuilding('water');
      grid[tile.y][tile.x].landValue = 60;
    }
  }
  
  // Seventh pass: Generate rivers in expansion zones
  // Rivers flow from lakes or map edges toward other water bodies
  const riverChance = 0.4; // 40% chance to generate rivers
  if (Math.random() < riverChance) {
    const numRivers = 1 + Math.floor(Math.random() * 3); // 1-3 rivers
    
    for (let r = 0; r < numRivers; r++) {
      // Find a starting point: either from a new lake or from expansion edge
      let startX = 0, startY = 0;
      let endX = 0, endY = 0;
      let foundStart = false;
      
      // Try to start from a lake in expansion zone
      for (let attempts = 0; attempts < 50 && !foundStart; attempts++) {
        const testX = minDistFromEdge + Math.floor(Math.random() * (newSize - 2 * minDistFromEdge));
        const testY = minDistFromEdge + Math.floor(Math.random() * (newSize - 2 * minDistFromEdge));
        
        if (isExpansionTile(testX, testY) && grid[testY][testX].building.type === 'water') {
          // Check if this is edge of a water body
          let hasLandNeighbor = false;
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = testX + dx;
            const ny = testY + dy;
            if (nx >= 0 && ny >= 0 && nx < newSize && ny < newSize &&
                grid[ny][nx].building.type !== 'water') {
              hasLandNeighbor = true;
              startX = nx;
              startY = ny;
              break;
            }
          }
          if (hasLandNeighbor) {
            foundStart = true;
          }
        }
      }
      
      // If no lake edge found, start from expansion boundary
      if (!foundStart) {
        const edge = Math.floor(Math.random() * 4);
        switch (edge) {
          case 0: // Top
            startX = minDistFromEdge + Math.floor(Math.random() * (newSize - 2 * minDistFromEdge));
            startY = minDistFromEdge;
            break;
          case 1: // Bottom
            startX = minDistFromEdge + Math.floor(Math.random() * (newSize - 2 * minDistFromEdge));
            startY = newSize - minDistFromEdge - 1;
            break;
          case 2: // Left
            startX = minDistFromEdge;
            startY = minDistFromEdge + Math.floor(Math.random() * (newSize - 2 * minDistFromEdge));
            break;
          case 3: // Right
            startX = newSize - minDistFromEdge - 1;
            startY = minDistFromEdge + Math.floor(Math.random() * (newSize - 2 * minDistFromEdge));
            break;
        }
        if (!isExpansionTile(startX, startY)) continue;
        foundStart = true;
      }
      
      if (!foundStart) continue;
      
      // Find end point: another water body or opposite edge
      endX = newSize / 2 + (Math.random() - 0.5) * newSize * 0.6;
      endY = newSize / 2 + (Math.random() - 0.5) * newSize * 0.6;
      
      // Draw river using random walk biased toward end point
      let curX = startX;
      let curY = startY;
      const riverLength = 15 + Math.floor(Math.random() * 25); // 15-40 tiles
      const riverWidth = 1 + Math.floor(Math.random() * 2); // 1-2 tiles wide
      
      for (let step = 0; step < riverLength; step++) {
        // Place water at current position (and width)
        for (let w = 0; w < riverWidth; w++) {
          const wx = curX + (w % 2);
          const wy = curY + Math.floor(w / 2);
          if (wx >= 0 && wy >= 0 && wx < newSize && wy < newSize && isExpansionTile(wx, wy)) {
            grid[wy][wx].building = createBuilding('water');
          }
        }
        
        // Move toward end with some randomness (Perlin noise for organic curves)
        const riverNoise = perlinNoise(curX * 0.2, curY * 0.2, expansionSeed + 5000 + r * 100, 2);
        const angle = Math.atan2(endY - curY, endX - curX) + (riverNoise - 0.5) * Math.PI * 0.8;
        
        const nextX = Math.round(curX + Math.cos(angle));
        const nextY = Math.round(curY + Math.sin(angle));
        
        // Stop if we hit existing water or go out of bounds
        if (nextX < 1 || nextY < 1 || nextX >= newSize - 1 || nextY >= newSize - 1) break;
        if (!isExpansionTile(nextX, nextY)) break;
        if (grid[nextY][nextX].building.type === 'water' && step > 5) break; // Connect to water
        
        curX = nextX;
        curY = nextY;
      }
    }
  }
  
  return { grid, newSize };
}

// Check all edges and return cities that can be connected (have roads reaching them)
// Returns: { newlyDiscovered: cities just discovered, connectableExisting: already discovered but not connected }
export function checkForDiscoverableCities(
  grid: Tile[][],
  gridSize: number,
  adjacentCities: AdjacentCity[]
): AdjacentCity[] {
  const citiesToShow: AdjacentCity[] = [];
  
  for (const city of adjacentCities) {
    if (!city.connected && hasRoadAtEdge(grid, gridSize, city.direction)) {
      // Include both undiscovered cities (they'll be discovered) and discovered-but-unconnected cities
      if (!city.discovered) {
        // This is a new discovery
        citiesToShow.push(city);
      }
      // Note: We only return undiscovered cities here. For already-discovered cities,
      // the UI can show them in a different way (e.g., a persistent indicator)
    }
  }
  
  return citiesToShow;
}

// Check for cities that are discovered, have roads at their edge, but are not yet connected
// This can be used to remind players they can connect to a city
export function getConnectableCities(
  grid: Tile[][],
  gridSize: number,
  adjacentCities: AdjacentCity[]
): AdjacentCity[] {
  const connectable: AdjacentCity[] = [];
  
  for (const city of adjacentCities) {
    if (city.discovered && !city.connected && hasRoadAtEdge(grid, gridSize, city.direction)) {
      connectable.push(city);
    }
  }
  
  return connectable;
}
