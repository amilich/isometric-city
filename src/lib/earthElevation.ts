/**
 * Earth Elevation Data Loading
 * 
 * Loads elevation tiles from Convex storage and decodes WebP images
 * back to elevation arrays. Caches tiles in IndexedDB for performance.
 */

import { getElevationTileForLatLng, getFractionalPositionInElevationTile } from './earthProjection'

// ETOPO1 elevation range
const MIN_ELEVATION = -11000 // Deepest ocean trench
const MAX_ELEVATION = 8848 // Mount Everest
const RANGE = MAX_ELEVATION - MIN_ELEVATION

// Elevation tile dimensions (1°×1° at 1 arc-minute resolution)
const ELEVATION_TILE_SIZE = 60 // 60×60 values per tile

// IndexedDB cache for elevation tiles
const DB_NAME = 'isocity-elevation-cache'
const DB_VERSION = 1
const STORE_NAME = 'elevationTiles'

interface CachedTile {
  lat: number
  lng: number
  elevation: number[][]
  cachedAt: number
}

/**
 * Initialize IndexedDB cache
 */
async function initCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: ['lat', 'lng'] })
        store.createIndex('cachedAt', 'cachedAt', { unique: false })
      }
    }
  })
}

/**
 * Get cached elevation tile from IndexedDB
 */
async function getCachedTile(lat: number, lng: number): Promise<number[][] | null> {
  try {
    const db = await initCache()
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get([lat, lng])
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result as CachedTile | undefined
        if (result && Date.now() - result.cachedAt < 7 * 24 * 60 * 60 * 1000) {
          // Cache valid for 7 days
          resolve(result.elevation)
        } else {
          resolve(null)
        }
      }
      request.onerror = () => resolve(null) // Fail gracefully
    })
  } catch (error) {
    console.warn('IndexedDB cache error:', error)
    return null
  }
}

/**
 * Cache elevation tile in IndexedDB
 */
async function cacheTile(lat: number, lng: number, elevation: number[][]): Promise<void> {
  try {
    const db = await initCache()
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        lat,
        lng,
        elevation,
        cachedAt: Date.now(),
      })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn('Failed to cache elevation tile:', error)
    // Non-fatal error, continue without caching
  }
}

/**
 * Decode WebP image back to elevation array
 * WebP is grayscale where 0-255 maps to MIN_ELEVATION to MAX_ELEVATION
 */
async function decodeWebPToElevation(webpBlob: Blob): Promise<number[][]> {
  // Create image from blob
  const img = new Image()
  const imgUrl = URL.createObjectURL(webpBlob)
  
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load WebP image'))
    img.src = imgUrl
  })
  
  // Draw to canvas to read pixel data
  const canvas = document.createElement('canvas')
  canvas.width = ELEVATION_TILE_SIZE
  canvas.height = ELEVATION_TILE_SIZE
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }
  
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(imgUrl)
  
  // Read pixel data
  const imageData = ctx.getImageData(0, 0, ELEVATION_TILE_SIZE, ELEVATION_TILE_SIZE)
  const elevation: number[][] = []
  
  for (let y = 0; y < ELEVATION_TILE_SIZE; y++) {
    elevation[y] = []
    for (let x = 0; x < ELEVATION_TILE_SIZE; x++) {
      const idx = (y * ELEVATION_TILE_SIZE + x) * 4
      const gray = imageData.data[idx] // Grayscale, so R=G=B
      
      // Convert 0-255 back to elevation in meters
      const normalized = gray / 255
      const elev = MIN_ELEVATION + normalized * RANGE
      
      elevation[y][x] = elev
    }
  }
  
  return elevation
}

/**
 * Load elevation tile from Convex
 */
async function loadElevationTileFromConvex(tileLat: number, tileLng: number): Promise<number[][]> {
  // Check cache first
  const cached = await getCachedTile(tileLat, tileLng)
  if (cached) {
    return cached
  }
  
  // Load from Convex
  // Note: This requires Convex client to be initialized in the app
  // We'll use a dynamic import to avoid SSR issues
  const { ConvexHttpClient } = await import('convex/browser')
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  
  if (!convexUrl) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL not configured')
  }
  
  const convex = new ConvexHttpClient(convexUrl)
  
  // Get tile file URL from Convex
  // Use string-based query to avoid build-time import issues
  const tileData = await (convex as any).query('elevation:getTile', {
    lat: tileLat,
    lng: tileLng,
  })
  
  if (!tileData || !tileData.url) {
    console.warn(`Elevation tile not found in Convex: (${tileLat}, ${tileLng}). Using fallback elevation.`)
    // Return a flat elevation array (sea level) as fallback
    const fallback: number[][] = []
    for (let y = 0; y < ELEVATION_TILE_SIZE; y++) {
      fallback[y] = []
      for (let x = 0; x < ELEVATION_TILE_SIZE; x++) {
        fallback[y][x] = 0 // Sea level
      }
    }
    return fallback
  }
  
  // Fetch WebP file
  const response = await fetch(tileData.url)
  if (!response.ok) {
    throw new Error(`Failed to fetch elevation tile: ${response.statusText}`)
  }
  
  const webpBlob = await response.blob()
  
  // Decode WebP to elevation array
  const elevation = await decodeWebPToElevation(webpBlob)
  
  // Cache for future use
  await cacheTile(tileLat, tileLng, elevation)
  
  return elevation
}

/**
 * Load elevation tile (1°×1°) for a given lat/lng
 */
export async function loadElevationTile(tileLat: number, tileLng: number): Promise<number[][]> {
  return loadElevationTileFromConvex(tileLat, tileLng)
}

/**
 * Get elevation at a specific lat/lng point using bilinear interpolation
 */
export async function getElevation(lat: number, lng: number): Promise<number> {
  const tile = getElevationTileForLatLng(lat, lng)
  const frac = getFractionalPositionInElevationTile(lat, lng)
  
  // Load the elevation tile
  const elevationTile = await loadElevationTile(tile.lat, tile.lng)
  
  // Bilinear interpolation within the tile
  return interpolateElevation(elevationTile, frac.fracLat, frac.fracLng)
}

/**
 * Bilinear interpolation of elevation within a tile
 */
export function interpolateElevation(
  tile: number[][],
  fracLat: number,
  fracLng: number
): number {
  // Clamp fractional positions to [0, 1]
  fracLat = Math.max(0, Math.min(1, fracLat))
  fracLng = Math.max(0, Math.min(1, fracLng))
  
  // Convert to pixel coordinates within the 60×60 tile
  const x = fracLng * (ELEVATION_TILE_SIZE - 1)
  const y = fracLat * (ELEVATION_TILE_SIZE - 1)
  
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(ELEVATION_TILE_SIZE - 1, x0 + 1)
  const y1 = Math.min(ELEVATION_TILE_SIZE - 1, y0 + 1)
  
  const fx = x - x0
  const fy = y - y0
  
  // Get four corner values
  const v00 = tile[y0][x0]
  const v10 = tile[y1][x0]
  const v01 = tile[y0][x1]
  const v11 = tile[y1][x1]
  
  // Bilinear interpolation
  const v0 = v00 * (1 - fx) + v01 * fx
  const v1 = v10 * (1 - fx) + v11 * fx
  const v = v0 * (1 - fy) + v1 * fy
  
  return v
}

/**
 * Preload elevation tiles for a region (for performance)
 */
export async function preloadElevationTiles(bounds: {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}): Promise<void> {
  const minTileLat = Math.floor(bounds.minLat)
  const maxTileLat = Math.floor(bounds.maxLat)
  const minTileLng = Math.floor(bounds.minLng)
  const maxTileLng = Math.floor(bounds.maxLng)
  
  const promises: Promise<number[][] | void>[] = []
  
  for (let lat = minTileLat; lat <= maxTileLat; lat++) {
    for (let lng = minTileLng; lng <= maxTileLng; lng++) {
      promises.push(
        loadElevationTile(lat, lng).catch((error) => {
          console.warn(`Failed to preload tile (${lat}, ${lng}):`, error)
          return undefined
        })
      )
    }
  }
  
  await Promise.all(promises)
}

