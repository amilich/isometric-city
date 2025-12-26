import { describe, it, expect, beforeEach } from 'vitest';
import { 
  calculateServiceCoverage,
  getBuildingSize,
  invalidateServiceBuildingRoadCache,
} from './simulation';
import { Tile, BuildingType } from '@/types/game';

// Helper function to create a grid
function createTestGrid(size: number): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < size; y++) {
    grid[y] = [];
    for (let x = 0; x < size; x++) {
      grid[y][x] = {
        x,
        y,
        zone: 'none',
        building: {
          type: 'grass',
          level: 0,
          population: 0,
          jobs: 0,
          powered: false,
          watered: false,
          onFire: false,
          fireProgress: 0,
          age: 0,
          constructionProgress: 100,
          abandoned: false,
        },
        landValue: 0,
        pollution: 0,
        crime: 0,
        traffic: 0,
        hasSubway: false,
      };
    }
  }
  return grid;
}

function placeRoad(grid: Tile[][], x: number, y: number): void {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
    grid[y][x].building.type = 'road';
  }
}

function placeBuilding(grid: Tile[][], x: number, y: number, buildingType: BuildingType): void {
  const size = getBuildingSize(buildingType);
  
  // Place building across all tiles in its footprint
  for (let dy = 0; dy < size.height; dy++) {
    for (let dx = 0; dx < size.width; dx++) {
      const placeX = x + dx;
      const placeY = y + dy;
      if (placeY >= 0 && placeY < grid.length && placeX >= 0 && placeX < grid[0].length) {
        if (dx === 0 && dy === 0) {
          grid[placeY][placeX].building.type = buildingType;
        } else {
          grid[placeY][placeX].building.type = 'empty';
        }
      }
    }
  }
}

describe('calculateServiceCoverage with Road Connectivity', () => {
  let grid: Tile[][];
  const gridSize = 30;

  beforeEach(() => {
    grid = createTestGrid(gridSize);
    // Reset cache before each test
    invalidateServiceBuildingRoadCache();
  });

  describe('Power Plant Coverage', () => {
    it('should provide power coverage when connected to road (adjacent)', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      placeRoad(grid, 9, 10); // adjacent north

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      // Power plant has range 15, so (10,10) should be covered
      expect(services.power[10][10]).toBe(true);
      // A tile within range should also be covered
      expect(services.power[15][10]).toBe(true);
    });

    it('should provide power coverage when connected to road (1 tile away)', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      placeRoad(grid, 9, 9); // 1 tile away diagonally (northeast from 10,10)

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      expect(services.power[10][10]).toBe(true);
    });

    it('should NOT provide power coverage when NOT connected to road', () => {
      placeBuilding(grid, 10, 10, 'power_plant');
      // No road nearby (2+ tiles away)
      placeRoad(grid, 5, 5); // Far away

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      // Power plant should not provide coverage
      expect(services.power[10][10]).toBe(false);
      expect(services.power[15][10]).toBe(false);
    });
  });

  describe('Other Service Building Coverage', () => {
    it('should provide coverage when hospital is adjacent to road', () => {
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 9, 10); // adjacent north

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      // Hospital has range 12, so nearby tiles should have health coverage
      expect(services.health[10][10]).toBeGreaterThan(0);
      expect(services.health[15][10]).toBeGreaterThan(0);
    });

    it('should NOT provide coverage when hospital is NOT adjacent to road', () => {
      placeBuilding(grid, 10, 10, 'hospital');
      // No road adjacent (1+ tiles away)
      placeRoad(grid, 8, 10); // 1 tile gap

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      // Hospital should not provide coverage
      expect(services.health[10][10]).toBe(0);
      expect(services.health[15][10]).toBe(0);
    });

    it('should provide police coverage when police station is adjacent to road', () => {
      placeBuilding(grid, 10, 10, 'police_station');
      placeRoad(grid, 10, 9); // adjacent east

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      expect(services.police[10][10]).toBeGreaterThan(0);
    });

    it('should NOT provide police coverage when police station is NOT adjacent to road', () => {
      placeBuilding(grid, 10, 10, 'police_station');
      // No road adjacent
      placeRoad(grid, 5, 5); // Far away

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      expect(services.police[10][10]).toBe(0);
    });

    it('should provide water coverage when water tower is adjacent to road', () => {
      placeBuilding(grid, 10, 10, 'water_tower');
      placeRoad(grid, 10, 11); // adjacent west

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      expect(services.water[10][10]).toBe(true);
    });

    it('should NOT provide water coverage when water tower is NOT adjacent to road', () => {
      placeBuilding(grid, 10, 10, 'water_tower');
      // No road adjacent
      placeRoad(grid, 5, 5); // Far away

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      expect(services.water[10][10]).toBe(false);
    });
  });

  describe('Multiple Service Buildings', () => {
    it('should only include connected buildings in coverage calculation', () => {
      // Connected hospital
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 9, 10);

      // Disconnected hospital
      placeBuilding(grid, 20, 20, 'hospital');
      // No road nearby

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      // First hospital should provide coverage
      expect(services.health[10][10]).toBeGreaterThan(0);
      
      // Second hospital should NOT provide coverage
      expect(services.health[20][20]).toBe(0);
    });

    it('should combine coverage from multiple connected buildings', () => {
      // Two connected hospitals
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 9, 10);

      placeBuilding(grid, 12, 12, 'hospital');
      placeRoad(grid, 11, 12);

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      // A tile in range of both should have combined coverage (capped at 100%)
      const coverage = services.health[11][11];
      expect(coverage).toBeGreaterThan(0);
      expect(coverage).toBeLessThanOrEqual(100);
    });
  });

  describe('Multi-tile Buildings', () => {
    it('should provide coverage when any tile of multi-tile building is adjacent to road', () => {
      // Hospital is 2x2, place it at (10,10) so it occupies (10,10), (11,10), (10,11), (11,11)
      placeBuilding(grid, 10, 10, 'hospital');
      // Place road adjacent to southeast corner (south of 11,11)
      placeRoad(grid, 12, 11);

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      // Hospital should provide coverage
      expect(services.health[10][10]).toBeGreaterThan(0);
    });

    it('should NOT provide coverage when no tile of multi-tile building is adjacent to road', () => {
      placeBuilding(grid, 10, 10, 'hospital');
      // Road far away (not adjacent to any tile in footprint)
      placeRoad(grid, 5, 5);

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      expect(services.health[10][10]).toBe(0);
    });
  });

  describe('Building States', () => {
    it('should skip buildings under construction even if connected to road', () => {
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 9, 10);
      grid[10][10].building.constructionProgress = 50; // Under construction

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      expect(services.health[10][10]).toBe(0);
    });

    it('should skip abandoned buildings even if connected to road', () => {
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 9, 10);
      grid[10][10].building.abandoned = true;

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      expect(services.health[10][10]).toBe(0);
    });

    it('should include completed buildings that are connected to road', () => {
      placeBuilding(grid, 10, 10, 'hospital');
      placeRoad(grid, 9, 10);
      grid[10][10].building.constructionProgress = 100; // Completed
      grid[10][10].building.abandoned = false;

      const services = calculateServiceCoverage(grid, gridSize, 0);
      
      expect(services.health[10][10]).toBeGreaterThan(0);
    });
  });
});

