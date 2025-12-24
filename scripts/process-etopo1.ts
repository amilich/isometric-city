#!/usr/bin/env tsx
/**
 * Process ETOPO1 GeoTIFF into WebP tiles and upload to Convex
 * 
 * This script:
 * 1. Reads the ETOPO1 GeoTIFF file
 * 2. Extracts elevation data in 1°×1° tiles
 * 3. Converts each tile to WebP format
 * 4. Uploads tiles to Convex file storage
 * 5. Stores tile metadata in Convex database
 */

import { fromFile } from 'geotiff'
import sharp from 'sharp'
import { ConvexHttpClient } from 'convex/browser'
import * as fs from 'fs'
import * as path from 'path'

// Load Convex URL from .env.local
const envPath = path.join(process.cwd(), '.env.local')
let CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL

if (!CONVEX_URL && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  const match = envContent.match(/NEXT_PUBLIC_CONVEX_URL=(.+)/)
  if (match) {
    CONVEX_URL = match[1].trim()
  }
}

if (!CONVEX_URL) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL must be set in .env.local')
}

const ETOPO1_PATH = path.join(process.cwd(), 'public/assets/planets/earth/ETOPO1_Ice_g_geotiff.tif')

// Initialize Convex client
const convex = new ConvexHttpClient(CONVEX_URL)

// ETOPO1 covers: -90° to 90° latitude, -180° to 180° longitude
// Resolution: 1 arc-minute = 60×60 values per degree
const TILE_SIZE_DEGREES = 1 // 1°×1° tiles
const VALUES_PER_DEGREE = 60 // 1 arc-minute resolution

interface TileData {
  lat: number
  lng: number
  elevation: number[][] // 60×60 array of elevation values
}

/**
 * Extract a 1°×1° tile from the GeoTIFF
 */
async function extractTile(
  tiff: any,
  lat: number,
  lng: number
): Promise<TileData> {
  // ETOPO1 uses WGS84, so:
  // - Latitude: -90 to 90 (south to north)
  // - Longitude: -180 to 180 (west to east)
  
  // Convert lat/lng to pixel coordinates
  // ETOPO1: 21600×10800 pixels (360° × 180° at 1 arc-minute)
  const pixelWidth = 21600 // 360° × 60 pixels/degree
  const pixelHeight = 10800 // 180° × 60 pixels/degree
  
  // Calculate pixel bounds for this tile
  const lngPixels = Math.floor((lng + 180) * VALUES_PER_DEGREE)
  const latPixels = Math.floor((90 - lat) * VALUES_PER_DEGREE) // Inverted: 90°N = row 0
  
  const width = VALUES_PER_DEGREE
  const height = VALUES_PER_DEGREE
  
  // Read the tile region from GeoTIFF
  const window = [lngPixels, latPixels, lngPixels + width, latPixels + height]
  const rasters = await tiff.readRasters({ window })
  
  // rasters[0] is the elevation array (flattened)
  const elevation: number[][] = []
  for (let y = 0; y < height; y++) {
    elevation[y] = []
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      elevation[y][x] = rasters[0][idx]
    }
  }
  
  return { lat, lng, elevation }
}

/**
 * Convert elevation array to WebP image
 * Elevation values are encoded as grayscale (0-255)
 * Scale: -11000m (deepest ocean) to 8848m (Everest) → 0-255
 */
function elevationToWebP(elevation: number[][]): Promise<Buffer> {
  const width = elevation[0].length
  const height = elevation.length
  
  // Normalize elevation to 0-255 range
  // ETOPO1 range: approximately -11000 to 8848 meters
  const MIN_ELEVATION = -11000
  const MAX_ELEVATION = 8848
  const RANGE = MAX_ELEVATION - MIN_ELEVATION
  
  const pixels = Buffer.alloc(width * height)
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const elev = elevation[y][x]
      // Normalize to 0-255
      const normalized = Math.max(0, Math.min(255, 
        Math.round(((elev - MIN_ELEVATION) / RANGE) * 255)
      ))
      pixels[y * width + x] = normalized
    }
  }
  
  // Convert to WebP
  return sharp(pixels, {
    raw: {
      width,
      height,
      channels: 1, // Grayscale
    },
  })
    .webp({ quality: 90 })
    .toBuffer()
}

/**
 * Upload tile to Convex
 */
async function uploadTile(lat: number, lng: number, webpBuffer: Buffer) {
  // Get upload URL
  const uploadUrl = await (convex as any).mutation('elevation:getUploadUrl', {})
  
  // Upload file - convert Buffer to ArrayBuffer for fetch
  const arrayBuffer = webpBuffer.buffer.slice(
    webpBuffer.byteOffset,
    webpBuffer.byteOffset + webpBuffer.byteLength
  )
  
  // Convert Buffer to Uint8Array for fetch
  const uploadData = new Uint8Array(webpBuffer)
  
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'image/webp' },
    body: uploadData,
  })
  
  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    throw new Error(`Upload failed: ${uploadResponse.statusText} - ${errorText}`)
  }
  
  const { storageId } = await uploadResponse.json()
  
  // Store metadata
  const { api } = await import('../convex/_generated/api')
  await convex.mutation(api.elevation.completeUpload, {
    lat,
    lng,
    storageId: storageId as any,
    size: webpBuffer.length,
  })
  
  return storageId
}

/**
 * Process all tiles (or a test region)
 */
type Mode =
  | { kind: 'test' }
  | { kind: 'full' }
  | { kind: 'tile'; lat: number; lng: number }
  | { kind: 'bbox'; minLat: number; maxLat: number; minLng: number; maxLng: number }

function parseArgs(argv: string[]): Mode {
  if (argv.includes('--test') || argv.includes('-t')) return { kind: 'test' }

  const tileIdx = argv.findIndex((a) => a === '--tile')
  if (tileIdx != -1) {
    const lat = Number(argv[tileIdx + 1])
    const lng = Number(argv[tileIdx + 2])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error('Usage: --tile <latInt> <lngInt>  (example: --tile 51 -1)')
    }
    return { kind: 'tile', lat, lng }
  }

  const bboxIdx = argv.findIndex((a) => a === '--bbox')
  if (bboxIdx != -1) {
    const minLat = Number(argv[bboxIdx + 1])
    const maxLat = Number(argv[bboxIdx + 2])
    const minLng = Number(argv[bboxIdx + 3])
    const maxLng = Number(argv[bboxIdx + 4])
    if (
      !Number.isFinite(minLat)
      || ! Number.isFinite(maxLat)
      || ! Number.isFinite(minLng)
      || ! Number.isFinite(maxLng)
    ) {
      throw new Error('Usage: --bbox <minLatInt> <maxLatInt> <minLngInt> <maxLngInt>')
    }
    return { kind: 'bbox', minLat, maxLat, minLng, maxLng }
  }

  return { kind: 'full' }
}


async function processAllTiles(mode: Mode) {
  console.log('Loading GeoTIFF...')
  const tiff = await fromFile(ETOPO1_PATH)
  
  // Get image info
  const image = await tiff.getImage()
  const [width, height] = [image.getWidth(), image.getHeight()]
  console.log(`GeoTIFF dimensions: ${width}×${height}`)
  
  const latRange =
    mode.kind === 'test'
      ? { min: 40, max: 41 }
      : mode.kind === 'tile'
        ? { min: mode.lat, max: mode.lat + 1 }
        : mode.kind === 'bbox'
          ? { min: mode.minLat, max: mode.maxLat }
          : { min: -90, max: 90 }

  const lngRange =
    mode.kind === 'test'
      ? { min: -75, max: -74 }
      : mode.kind === 'tile'
        ? { min: mode.lng, max: mode.lng + 1 }
        : mode.kind === 'bbox'
          ? { min: mode.minLng, max: mode.maxLng }
          : { min: -180, max: 180 }
  
  console.log(`Processing tiles: lat ${latRange.min} to ${latRange.max}, lng ${lngRange.min} to ${lngRange.max}`)
  
  const totalTiles = (latRange.max - latRange.min) * (lngRange.max - lngRange.min)
  let processed = 0
  let uploaded = 0
  let errors = 0
  
  for (let lat = latRange.min; lat < latRange.max; lat++) {
    for (let lng = lngRange.min; lng < lngRange.max; lng++) {
      try {
        // Extract tile
        const tile = await extractTile(tiff, lat, lng)
        
        // Convert to WebP
        const webpBuffer = await elevationToWebP(tile.elevation)
        
        // Upload to Convex
        await uploadTile(lat, lng, webpBuffer)
        
        uploaded++
        processed++
        
        if (processed % 10 === 0 || processed === totalTiles) {
          const percent = ((processed / totalTiles) * 100).toFixed(1)
          console.log(`Progress: ${processed}/${totalTiles} (${percent}%) - ${uploaded} uploaded, ${errors} errors`)
        }
      } catch (error) {
        errors++
        console.error(`Error processing tile (${lat}, ${lng}):`, error)
        // Continue processing other tiles
      }
    }
  }
  
  console.log(`\nDone! Processed ${processed} tiles, uploaded ${uploaded} tiles, ${errors} errors`)
}

// Run if executed directly
if (require.main === module) {
  const mode = parseArgs(process.argv.slice(2))

  if (mode.kind === 'test') {
    console.log('🧪 Running in TEST MODE - processing small region only')
  } else if (mode.kind === 'tile') {
    console.log(`🧩 Processing SINGLE TILE: (${mode.lat}, ${mode.lng})`)
  } else if (mode.kind === 'bbox') {
    console.log(`🗺️  Processing BBOX: lat ${mode.minLat}..${mode.maxLat}, lng ${mode.minLng}..${mode.maxLng}`)
  } else {
    console.log('🌍 Processing FULL EARTH - this will take a while!')
    console.log('   Use --test, --tile, or --bbox for smaller runs')
  }

  processAllTiles(mode).catch(console.error)
}

export { processAllTiles, extractTile, elevationToWebP, uploadTile }

