/**
 * Earth Chunk System
 * 
 * Loads and manages chunks of Earth terrain data.
 * Chunks are 64×64 tiles (~32km²) that are loaded on-demand.
 */

import { Tile, BuildingType } from '@/types/game'
import { EarthChunk } from '@/types/game'
import { getChunkBounds, CHUNK_SIZE_TILES, tileToLatLng } from './earthProjection'
import { loadElevationTile, getElevation, preloadElevationTiles } from './earthElevation'
import { determineBiome, createTerrainBuilding } from './biomes'

// IndexedDB cache for chunks
const CHUNK_DB_NAME = 'isocity-chunks-cache'
const CHUNK_DB_VERSION = 1
const CHUNK_STORE_NAME = 'chunks'

interface CachedChunk {
  chunkX: number
  chunkY: number
  tiles: Tile[][]
  bounds: EarthChunk['bounds']
  cachedAt: number
}

/**
 * Initialize chunk cache IndexedDB
 */
async function initChunkCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CHUNK_DB_NAME, CHUNK_DB_VERSION)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(CHUNK_STORE_NAME)) {
        const store = db.createObjectStore(CHUNK_STORE_NAME, { keyPath: ['chunkX', 'chunkY'] })
        store.createIndex('cachedAt', 'cachedAt', { unique: false })
      }
    }
  })
}

/**
 * Get cached chunk from IndexedDB
 */
async function getCachedChunk(chunkX: number, chunkY: number): Promise<EarthChunk | null> {
  try {
    const db = await initChunkCache()
    const transaction = db.transaction([CHUNK_STORE_NAME], 'readonly')
    const store = transaction.objectStore(CHUNK_STORE_NAME)
    const request = store.get([chunkX, chunkY])
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result as CachedChunk | undefined
        if (result && Date.now() - result.cachedAt < 30 * 24 * 60 * 60 * 1000) {
          // Cache valid for 30 days
          resolve({
            chunkX: result.chunkX,
            chunkY: result.chunkY,
            tiles: result.tiles,
            bounds: result.bounds,
          })
        } else {
          resolve(null)
        }
      }
      request.onerror = () => resolve(null)
    })
  } catch (error) {
    console.warn('Chunk cache error:', error)
    return null
  }
}

/**
 * Cache chunk in IndexedDB
 */
async function cacheChunk(chunk: EarthChunk): Promise<void> {
  try {
    const db = await initChunkCache()
    const transaction = db.transaction([CHUNK_STORE_NAME], 'readwrite')
    const store = transaction.objectStore(CHUNK_STORE_NAME)
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        chunkX: chunk.chunkX,
        chunkY: chunk.chunkY,
        tiles: chunk.tiles,
        bounds: chunk.bounds,
        cachedAt: Date.now(),
      })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn('Failed to cache chunk:', error)
  }
}

/**
 * Generate tiles for a chunk from elevation/biome data
 */
async function generateChunkTiles(
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  chunkSize: number
): Promise<Tile[][]> {
  const tiles: Tile[][] = []
  
  // Preload elevation tiles for this region
  await preloadElevationTiles(bounds)
  
  // Generate tiles
  for (let y = 0; y < chunkSize; y++) {
    tiles[y] = []
    for (let x = 0; x < chunkSize; x++) {
      // Calculate lat/lng for this tile position within the chunk
      const latProgress = y / (chunkSize - 1)
      const lngProgress = x / (chunkSize - 1)
      
      const lat = bounds.minLat + (bounds.maxLat - bounds.minLat) * latProgress
      const lng = bounds.minLng + (bounds.maxLng - bounds.minLng) * lngProgress
      
      // Get elevation
      const elevation = await getElevation(lat, lng)
      
      // Determine biome
      const biome = determineBiome(lat, elevation)
      
      // Create terrain building
      const buildingType = createTerrainBuilding(biome, elevation)
      
      // Create tile
      tiles[y][x] = {
        x,
        y,
        building: {
          type: buildingType as BuildingType,
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
        zone: 'none',
        landValue: 50,
        pollution: 0,
        crime: 0,
        traffic: 0,
        hasSubway: false,
      }
    }
  }
  
  return tiles
}

/**
 * Load an Earth chunk
 */
export async function loadEarthChunk(
  chunkX: number,
  chunkY: number,
  chunkSize: number = CHUNK_SIZE_TILES
): Promise<EarthChunk> {
  // Check cache first
  const cached = await getCachedChunk(chunkX, chunkY)
  if (cached) {
    return cached
  }
  
  // Get chunk bounds
  const bounds = getChunkBounds(chunkX, chunkY)
  
  // Generate tiles from elevation data
  const tiles = await generateChunkTiles(bounds, chunkSize)
  
  // Create chunk
  const chunk: EarthChunk = {
    chunkX,
    chunkY,
    tiles,
    bounds,
  }
  
  // Cache for future use
  await cacheChunk(chunk)
  
  return chunk
}

/**
 * Get chunk key for Map/Record lookup
 */
export function getChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`
}

/**
 * Parse chunk key back to coordinates
 */
export function parseChunkKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(',').map(Number)
  return { x, y }
}

/**
 * Get chunks that should be loaded around a center chunk
 * Returns a 3×3 grid (9 chunks) centered on the given chunk
 */
export function getChunksToLoad(centerChunkX: number, centerChunkY: number): Array<{ x: number; y: number }> {
  const chunks: Array<{ x: number; y: number }> = []
  
  // Load 3×3 grid around center
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      chunks.push({
        x: centerChunkX + dx,
        y: centerChunkY + dy,
      })
    }
  }
  
  return chunks
}

/**
 * Unload chunks that are too far from the center
 * Keeps only chunks within the 3×3 grid around center
 */
export function getChunksToUnload(
  loadedChunks: Record<string, EarthChunk>,
  centerChunkX: number,
  centerChunkY: number
): string[] {
  const toKeep = new Set(
    getChunksToLoad(centerChunkX, centerChunkY).map((c) => getChunkKey(c.x, c.y))
  )
  
  return Object.keys(loadedChunks).filter((key) => !toKeep.has(key))
}

