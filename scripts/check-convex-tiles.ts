#!/usr/bin/env tsx
/**
 * Check what elevation tiles are uploaded to Convex
 */

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

const convex = new ConvexHttpClient(CONVEX_URL)

// Required tiles for preset cities
const REQUIRED_TILES = [
  { name: 'New York', lat: 40, lng: -74 },
  { name: 'San Francisco', lat: 37, lng: -123 },
  { name: 'London', lat: 51, lng: -1 },
  { name: 'Dublin', lat: 53, lng: -7 },
  { name: 'Tokyo', lat: 35, lng: 139 },
  { name: 'Sydney', lat: -34, lng: 151 },
]

async function checkTiles() {
  console.log('Checking Convex for elevation tiles...\n')
  
  const { api } = await import('../convex/_generated/api')
  
  // Check each required tile
  console.log('Required tiles for preset cities:')
  for (const tile of REQUIRED_TILES) {
    try {
      const result = await convex.query(api.elevation.getTile, {
        lat: tile.lat,
        lng: tile.lng,
      })
      
      if (result && result.url) {
        console.log(`  ✅ ${tile.name} (${tile.lat}, ${tile.lng}): FOUND (${(result.size / 1024).toFixed(1)} KB)`)
      } else {
        console.log(`  ❌ ${tile.name} (${tile.lat}, ${tile.lng}): NOT FOUND`)
      }
    } catch (error: any) {
      console.log(`  ❌ ${tile.name} (${tile.lat}, ${tile.lng}): ERROR - ${error.message}`)
    }
  }
  
  // Also try to get all tiles in a bounding box
  console.log('\nChecking for other tiles in preset city regions...')
  const bboxes = [
    { name: 'NYC region', minLat: 39, maxLat: 42, minLng: -75, maxLng: -73 },
    { name: 'SF region', minLat: 36, maxLat: 39, minLng: -124, maxLng: -121 },
    { name: 'London region', minLat: 50, maxLat: 52, minLng: -2, maxLng: 1 },
    { name: 'Dublin region', minLat: 52, maxLat: 54, minLng: -8, maxLng: -5 },
    { name: 'Tokyo region', minLat: 34, maxLat: 36, minLng: 138, maxLng: 140 },
    { name: 'Sydney region', minLat: -35, maxLat: -33, minLng: 150, maxLng: 152 },
  ]
  
  for (const bbox of bboxes) {
    try {
      const tiles = await convex.query(api.elevation.getTiles, {
        minLat: bbox.minLat,
        maxLat: bbox.maxLat,
        minLng: bbox.minLng,
        maxLng: bbox.maxLng,
      })
      
      console.log(`  ${bbox.name}: ${tiles.length} tiles found`)
      if (tiles.length > 0) {
        tiles.forEach((t: any) => {
          console.log(`    - (${t.lat}, ${t.lng}) - ${(t.size / 1024).toFixed(1)} KB`)
        })
      }
    } catch (error: any) {
      console.log(`  ${bbox.name}: ERROR - ${error.message}`)
    }
  }
}

checkTiles().catch(console.error)

