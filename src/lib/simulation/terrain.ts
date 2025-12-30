import { Tile, WaterBody, AdjacentCity } from '@/types/game';
import { createTile, createBuilding } from './factories';
import { generateWaterName, generateCityName } from './names';
import { isNearWater } from './utils';

// Perlin-like noise for terrain generation
function noise2D(x: number, y: number, seed: number = 42): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const corners = (noise2D(x - 1, y - 1, seed) + noise2D(x + 1, y - 1, seed) +
    noise2D(x - 1, y + 1, seed) + noise2D(x + 1, y + 1, seed)) / 16;
  const sides = (noise2D(x - 1, y, seed) + noise2D(x + 1, y, seed) +
    noise2D(x, y - 1, seed) + noise2D(x, y + 1, seed)) / 8;
  const center = noise2D(x, y, seed) / 4;
  return corners + sides + center;
}

function interpolatedNoise(x: number, y: number, seed: number): number {
  const intX = Math.floor(x);
  const fracX = x - intX;
  const intY = Math.floor(y);
  const fracY = y - intY;

  const v1 = smoothNoise(intX, intY, seed);
  const v2 = smoothNoise(intX + 1, intY, seed);
  const v3 = smoothNoise(intX, intY + 1, seed);
  const v4 = smoothNoise(intX + 1, intY + 1, seed);

  const i1 = v1 * (1 - fracX) + v2 * fracX;
  const i2 = v3 * (1 - fracX) + v4 * fracX;

  return i1 * (1 - fracY) + i2 * fracY;
}

export function perlinNoise(x: number, y: number, seed: number, octaves: number = 4): number {
  let total = 0;
  let frequency = 0.05;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += interpolatedNoise(x * frequency, y * frequency, seed + i * 100) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / maxValue;
}

function generateLakes(grid: Tile[][], size: number, seed: number): WaterBody[] {
  const lakeNoise = (x: number, y: number) => perlinNoise(x, y, seed + 1000, 3);
  
  const lakeCenters: { x: number; y: number; noise: number }[] = [];
  const minDistFromEdge = Math.max(8, Math.floor(size * 0.15));
  const minDistBetweenLakes = Math.max(size * 0.2, 10);
  
  let threshold = 0.5;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (lakeCenters.length < 2 && attempts < maxAttempts) {
    lakeCenters.length = 0;
    
    for (let y = minDistFromEdge; y < size - minDistFromEdge; y++) {
      for (let x = minDistFromEdge; x < size - minDistFromEdge; x++) {
        const noiseVal = lakeNoise(x, y);
        if (noiseVal < threshold) {
          let tooClose = false;
          for (const center of lakeCenters) {
            const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
            if (dist < minDistBetweenLakes) {
              tooClose = true;
              break;
            }
          }
          if (!tooClose) {
            lakeCenters.push({ x, y, noise: noiseVal });
          }
        }
      }
    }
    if (lakeCenters.length >= 2) break;
    threshold += 0.1;
    attempts++;
  }
  
  if (lakeCenters.length === 0) {
    const safeZone = minDistFromEdge + 5;
    const quarterSize = Math.max(safeZone, Math.floor(size / 4));
    const threeQuarterSize = Math.min(size - safeZone, Math.floor(size * 3 / 4));
    lakeCenters.push(
      { x: quarterSize, y: quarterSize, noise: 0 },
      { x: threeQuarterSize, y: threeQuarterSize, noise: 0 }
    );
  } else if (lakeCenters.length === 1) {
    const existing = lakeCenters[0];
    const safeZone = minDistFromEdge + 5;
    const quarterSize = Math.max(safeZone, Math.floor(size / 4));
    const threeQuarterSize = Math.min(size - safeZone, Math.floor(size * 3 / 4));
    let newX = existing.x > size / 2 ? quarterSize : threeQuarterSize;
    let newY = existing.y > size / 2 ? quarterSize : threeQuarterSize;
    lakeCenters.push({ x: newX, y: newY, noise: 0 });
  }
  
  lakeCenters.sort((a, b) => a.noise - b.noise);
  const numLakes = 2 + Math.floor(Math.random() * 2);
  const selectedCenters = lakeCenters.slice(0, Math.min(numLakes, lakeCenters.length));
  
  const waterBodies: WaterBody[] = [];
  const usedLakeNames = new Set<string>();
  
  for (const center of selectedCenters) {
    const targetSize = 40 + Math.floor(Math.random() * 41);
    const lakeTiles: { x: number; y: number }[] = [{ x: center.x, y: center.y }];
    const candidates: { x: number; y: number; dist: number; noise: number }[] = [];
    
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dx, dy] of directions) {
      const nx = center.x + dx;
      const ny = center.y + dy;
      if (nx >= minDistFromEdge && nx < size - minDistFromEdge && 
          ny >= minDistFromEdge && ny < size - minDistFromEdge) {
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
        if (nx >= minDistFromEdge && nx < size - minDistFromEdge && 
            ny >= minDistFromEdge && ny < size - minDistFromEdge &&
            !lakeTiles.some(t => t.x === nx && t.y === ny) &&
            !candidates.some(c => c.x === nx && c.y === ny)) {
          const dist = Math.sqrt((nx - center.x) ** 2 + (ny - center.y) ** 2);
          const noise = lakeNoise(nx, ny);
          candidates.push({ x: nx, y: ny, dist, noise });
        }
      }
    }
    
    for (const tile of lakeTiles) {
      grid[tile.y][tile.x].building = createBuilding('water');
      grid[tile.y][tile.x].landValue = 60;
    }
    
    const avgX = lakeTiles.reduce((sum, t) => sum + t.x, 0) / lakeTiles.length;
    const avgY = lakeTiles.reduce((sum, t) => sum + t.y, 0) / lakeTiles.length;
    
    let lakeName = generateWaterName('lake');
    while (usedLakeNames.has(lakeName)) {
      lakeName = generateWaterName('lake');
    }
    usedLakeNames.add(lakeName);
    
    waterBodies.push({
      id: `lake-${waterBodies.length}`,
      name: lakeName,
      type: 'lake',
      tiles: lakeTiles,
      centerX: Math.round(avgX),
      centerY: Math.round(avgY),
    });
  }
  
  return waterBodies;
}

function generateOceans(grid: Tile[][], size: number, seed: number): WaterBody[] {
  const waterBodies: WaterBody[] = [];
  const oceanChance = 0.4;
  
  const coastNoise = (x: number, y: number) => perlinNoise(x, y, seed + 2000, 3);
  
  const edges: Array<{ side: 'north' | 'east' | 'south' | 'west'; tiles: { x: number; y: number }[] }> = [];
  
  const baseDepth = Math.max(4, Math.floor(size * 0.12));
  const depthVariation = Math.max(4, Math.floor(size * 0.08));
  const maxDepth = Math.floor(size * 0.18);
  
  const generateOceanEdge = (
    isHorizontal: boolean,
    edgePosition: number,
    inwardDirection: 1 | -1
  ): { x: number; y: number }[] => {
    const tiles: { x: number; y: number }[] = [];
    const spanStart = Math.floor(size * (0.05 + Math.random() * 0.25));
    const spanEnd = Math.floor(size * (0.7 + Math.random() * 0.25));
    
    for (let i = spanStart; i < spanEnd; i++) {
      const edgeFade = Math.min((i - spanStart) / 5, (spanEnd - i) / 5, 1);
      const coarseNoise = coastNoise(
        isHorizontal ? i * 0.08 : edgePosition * 0.08,
        isHorizontal ? edgePosition * 0.08 : i * 0.08
      );
      const fineNoise = coastNoise(
        isHorizontal ? i * 0.25 : edgePosition * 0.25 + 500,
        isHorizontal ? edgePosition * 0.25 + 500 : i * 0.25
      );
      const noiseVal = coarseNoise * 0.6 + fineNoise * 0.4;
      const rawDepth = baseDepth + (noiseVal - 0.5) * depthVariation * 2.5;
      const localDepth = Math.max(1, Math.min(Math.floor(rawDepth * edgeFade), maxDepth));
      
      for (let d = 0; d < localDepth; d++) {
        const x = isHorizontal ? i : (inwardDirection === 1 ? d : size - 1 - d);
        const y = isHorizontal ? (inwardDirection === 1 ? d : size - 1 - d) : i;
        
        if (x >= 0 && x < size && y >= 0 && y < size && grid[y][x].building.type !== 'water') {
          grid[y][x].building = createBuilding('water');
          grid[y][x].landValue = 60;
          tiles.push({ x, y });
        }
      }
    }
    return tiles;
  };
  
  if (Math.random() < oceanChance) {
    const tiles = generateOceanEdge(true, 0, 1);
    if (tiles.length > 0) edges.push({ side: 'north', tiles });
  }
  if (Math.random() < oceanChance) {
    const tiles = generateOceanEdge(true, size - 1, -1);
    if (tiles.length > 0) edges.push({ side: 'south', tiles });
  }
  if (Math.random() < oceanChance) {
    const tiles = generateOceanEdge(false, size - 1, -1);
    if (tiles.length > 0) edges.push({ side: 'east', tiles });
  }
  if (Math.random() < oceanChance) {
    const tiles = generateOceanEdge(false, 0, 1);
    if (tiles.length > 0) edges.push({ side: 'west', tiles });
  }
  
  const usedOceanNames = new Set<string>();
  for (const edge of edges) {
    if (edge.tiles.length > 0) {
      const avgX = edge.tiles.reduce((sum, t) => sum + t.x, 0) / edge.tiles.length;
      const avgY = edge.tiles.reduce((sum, t) => sum + t.y, 0) / edge.tiles.length;
      
      let oceanName = generateWaterName('ocean');
      while (usedOceanNames.has(oceanName)) {
        oceanName = generateWaterName('ocean');
      }
      usedOceanNames.add(oceanName);
      
      waterBodies.push({
        id: `ocean-${edge.side}-${waterBodies.length}`,
        name: oceanName,
        type: 'ocean',
        tiles: edge.tiles,
        centerX: Math.round(avgX),
        centerY: Math.round(avgY),
      });
    }
  }
  
  return waterBodies;
}

export function generateTerrain(size: number): { grid: Tile[][]; waterBodies: WaterBody[] } {
  const grid: Tile[][] = [];
  const seed = Math.random() * 1000;

  for (let y = 0; y < size; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < size; x++) {
      row.push(createTile(x, y, 'grass'));
    }
    grid.push(row);
  }
  
  const lakeBodies = generateLakes(grid, size, seed);
  const oceanBodies = generateOceans(grid, size, seed);
  const waterBodies = [...lakeBodies, ...oceanBodies];
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x].building.type === 'water') continue;
      
      const treeNoise = perlinNoise(x * 2, y * 2, seed + 500, 2);
      const isTree = treeNoise > 0.72 && Math.random() > 0.65;
      
      const nearWater = isNearWater(grid, x, y, size);
      const isTreeNearWater = nearWater && Math.random() > 0.7;

      if (isTree || isTreeNearWater) {
        grid[y][x].building = createBuilding('tree');
      }
    }
  }

  return { grid, waterBodies };
}

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
      discovered: false,
    });
  }
  
  return cities;
}

export function hasRoadAtEdge(grid: Tile[][], gridSize: number, direction: 'north' | 'south' | 'east' | 'west'): boolean {
  switch (direction) {
    case 'north':
      for (let x = 0; x < gridSize; x++) if (grid[0][x].building.type === 'road') return true;
      return false;
    case 'south':
      for (let x = 0; x < gridSize; x++) if (grid[gridSize - 1][x].building.type === 'road') return true;
      return false;
    case 'east':
      for (let y = 0; y < gridSize; y++) if (grid[y][gridSize - 1].building.type === 'road') return true;
      return false;
    case 'west':
      for (let y = 0; y < gridSize; y++) if (grid[y][0].building.type === 'road') return true;
      return false;
  }
}

export function checkForDiscoverableCities(
  grid: Tile[][],
  gridSize: number,
  adjacentCities: AdjacentCity[]
): AdjacentCity[] {
  const citiesToShow: AdjacentCity[] = [];
  for (const city of adjacentCities) {
    if (!city.connected && hasRoadAtEdge(grid, gridSize, city.direction)) {
      if (!city.discovered) {
        citiesToShow.push(city);
      }
    }
  }
  return citiesToShow;
}

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

