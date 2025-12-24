/**
 * Earth Projection System
 * 
 * Converts between lat/lng coordinates and game tile coordinates.
 * Handles chunk-based world system for infinite Earth terrain.
 */

// Constants for Earth projection
// At the equator, 1 degree latitude ≈ 111 km
// 1 degree longitude varies by latitude: 111 km × cos(latitude)
export const TILE_SIZE_KM = 0.5 // Each tile represents ~500m
export const TILES_PER_DEGREE_LAT = 111 / TILE_SIZE_KM // ~222 tiles per degree latitude
export const TILES_PER_DEGREE_LNG_EQUATOR = 111 / TILE_SIZE_KM // ~222 tiles per degree longitude at equator

// Chunk size: 64×64 tiles = ~32km² per chunk
export const CHUNK_SIZE_TILES = 64

export interface TileCoord {
  x: number
  y: number
}

export interface LatLng {
  lat: number // Latitude: -90 to 90
  lng: number // Longitude: -180 to 180
}

export interface Bounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

/**
 * Convert lat/lng to tile coordinates
 * Origin (0,0) is at lat=0, lng=0 (equator, prime meridian)
 */
export function latLngToTile(lat: number, lng: number): TileCoord {
  // Latitude: -90° (south) to 90° (north)
  // Y increases northward, so flip latitude
  const y = Math.floor(lat * TILES_PER_DEGREE_LAT)
  
  // Longitude: -180° (west) to 180° (east)
  // X increases eastward
  // Account for longitude compression at higher latitudes
  const lngScale = Math.cos((lat * Math.PI) / 180)
  const x = Math.floor(lng * TILES_PER_DEGREE_LNG_EQUATOR * lngScale)
  
  return { x, y }
}

/**
 * Convert tile coordinates back to lat/lng
 */
export function tileToLatLng(x: number, y: number): LatLng {
  const lat = y / TILES_PER_DEGREE_LAT
  const lngScale = Math.cos((lat * Math.PI) / 180)
  const lng = x / (TILES_PER_DEGREE_LNG_EQUATOR * lngScale)
  
  return { lat, lng }
}

/**
 * Get the tile coordinate for a given lat/lng
 * Returns the tile that contains this point
 */
export function getTileForLatLng(lat: number, lng: number): TileCoord {
  return latLngToTile(lat, lng)
}

/**
 * Get lat/lng bounds for a chunk
 */
export function getChunkBounds(chunkX: number, chunkY: number): Bounds {
  // Chunk origin is at (chunkX * CHUNK_SIZE_TILES, chunkY * CHUNK_SIZE_TILES)
  const originTile = {
    x: chunkX * CHUNK_SIZE_TILES,
    y: chunkY * CHUNK_SIZE_TILES,
  }
  
  const originLatLng = tileToLatLng(originTile.x, originTile.y)
  
  // Calculate opposite corner
  const endTile = {
    x: (chunkX + 1) * CHUNK_SIZE_TILES,
    y: (chunkY + 1) * CHUNK_SIZE_TILES,
  }
  
  const endLatLng = tileToLatLng(endTile.x, endTile.y)
  
  return {
    minLat: Math.min(originLatLng.lat, endLatLng.lat),
    maxLat: Math.max(originLatLng.lat, endLatLng.lat),
    minLng: Math.min(originLatLng.lng, endLatLng.lng),
    maxLng: Math.max(originLatLng.lng, endLatLng.lng),
  }
}

/**
 * Get chunk coordinates for a given lat/lng
 */
export function getChunkForLatLng(lat: number, lng: number): { x: number; y: number } {
  const tile = latLngToTile(lat, lng)
  return {
    x: Math.floor(tile.x / CHUNK_SIZE_TILES),
    y: Math.floor(tile.y / CHUNK_SIZE_TILES),
  }
}

/**
 * Get the elevation tile (1°×1°) that contains a given lat/lng
 * Elevation tiles are stored as integer lat/lng (e.g., 40, -74 for New York)
 */
export function getElevationTileForLatLng(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.floor(lat),
    lng: Math.floor(lng),
  }
}

/**
 * Get fractional position within an elevation tile (0-1)
 */
export function getFractionalPositionInElevationTile(
  lat: number,
  lng: number
): { fracLat: number; fracLng: number } {
  const tileLat = Math.floor(lat)
  const tileLng = Math.floor(lng)
  
  return {
    fracLat: lat - tileLat,
    fracLng: lng - tileLng,
  }
}

