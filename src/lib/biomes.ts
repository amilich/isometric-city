/**
 * Biome Determination System
 * 
 * Determines biome type based on elevation and latitude.
 * Maps real-world geography to game terrain types.
 */

import { BuildingType } from '@/types/game'

export type Biome = 'ocean' | 'coast' | 'desert' | 'grassland' | 'forest' | 'tundra' | 'mountain'

// Elevation thresholds (in meters)
// NOTE: elevation tiles are currently quantized (8-bit) which can push
// near-sea-level land slightly below 0. Use a negative threshold to avoid
// drowning coastal cities (NYC/SF/etc).
const OCEAN_THRESHOLD = -80 // treat <= -80m as ocean water
const COAST_THRESHOLD = 40 // -80m..40m is coastal band
const MOUNTAIN_THRESHOLD = 2000 // Above 2000m

// Latitude thresholds (absolute value, degrees)
const TUNDRA_THRESHOLD = 60 // Above 60° latitude (north or south)
const DESERT_LOW_LAT = 15 // Between 15-30° latitude (desert zones)
const DESERT_HIGH_LAT = 30

/**
 * Determine biome based on elevation and latitude
 */
export function determineBiome(lat: number, elevation: number): Biome {
  // Ocean: below or at sea level
  if (elevation <= OCEAN_THRESHOLD) {
    return 'ocean'
  }
  
  // Coast: very low elevation near sea level
  if (elevation <= COAST_THRESHOLD) {
    return 'coast'
  }
  
  // Mountain: high elevation regardless of latitude
  if (elevation >= MOUNTAIN_THRESHOLD) {
    return 'mountain'
  }
  
  const absLat = Math.abs(lat)
  
  // Tundra: high latitude (polar regions)
  if (absLat >= TUNDRA_THRESHOLD) {
    return 'tundra'
  }
  
  // Desert: low to mid latitude, low elevation
  if (absLat >= DESERT_LOW_LAT && absLat <= DESERT_HIGH_LAT && elevation < 500) {
    return 'desert'
  }
  
  // Forest: mid elevation, mid latitude
  if (elevation > 200 && elevation < 1000 && absLat < 50) {
    return 'forest'
  }
  
  // Default to grassland
  return 'grassland'
}

/**
 * Create initial terrain building based on biome and elevation
 */
export function createTerrainBuilding(biome: Biome, elevation: number): BuildingType {
  switch (biome) {
    case 'ocean':
      return 'water'
    
    case 'coast':
      // Mix of water and grass near coast
      return elevation < 0 ? 'water' : 'grass'
    
    case 'desert':
      // Desert is represented as grass in the game (no desert-specific sprite)
      return 'grass'
    
    case 'grassland':
      return 'grass'
    
    case 'forest':
      // Randomly place trees in forest biome
      return Math.random() > 0.7 ? 'tree' : 'grass'
    
    case 'tundra':
      // Tundra is sparse grass/trees
      return Math.random() > 0.8 ? 'tree' : 'grass'
    
    case 'mountain':
      // Mountains are represented as grass (no mountain-specific sprite)
      // Could add rocks or different terrain in future
      return 'grass'
    
    default:
      return 'grass'
  }
}

/**
 * Get biome color for visualization (optional, for debugging)
 */
export function getBiomeColor(biome: Biome): string {
  switch (biome) {
    case 'ocean':
      return '#1e40af' // Blue
    case 'coast':
      return '#60a5fa' // Light blue
    case 'desert':
      return '#fbbf24' // Yellow/sand
    case 'grassland':
      return '#22c55e' // Green
    case 'forest':
      return '#16a34a' // Dark green
    case 'tundra':
      return '#e5e7eb' // Light gray/white
    case 'mountain':
      return '#78716c' // Gray/brown
    default:
      return '#ffffff'
  }
}

