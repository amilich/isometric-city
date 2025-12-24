/**
 * City overlays (MVP)
 *
 * Purpose: Make preset cities look geographically sane without pulling in
 * full hydrography datasets yet. These masks are hand-tuned and only apply
 * to known preset locations.
 */

import type { Tile } from '@/types/game'

export type PresetCityId =
  | 'new_york'
  | 'san_francisco'
  | 'london'
  | 'dublin'
  | 'tokyo'
  | 'sydney'

type LatLng = { lat: number; lng: number }

const PRESET_CITIES: Array<{ id: PresetCityId; center: LatLng }> = [
  { id: 'new_york', center: { lat: 40.7, lng: -74.0 } },
  { id: 'san_francisco', center: { lat: 37.7749, lng: -122.4194 } },
  { id: 'london', center: { lat: 51.5, lng: -0.1 } },
  { id: 'dublin', center: { lat: 53.3498, lng: -6.2603 } },
  { id: 'tokyo', center: { lat: 35.7, lng: 139.8 } },
  { id: 'sydney', center: { lat: -33.9, lng: 151.2 } },
]

export function detectPresetCity(lat: number, lng: number): PresetCityId | null {
  // Very small radius: only intended for our preset buttons.
  const MAX_DIST_DEG = 0.8
  let best: { id: PresetCityId; d: number } | null = null

  for (const c of PRESET_CITIES) {
    const dLat = lat - c.center.lat
    const dLng = lng - c.center.lng
    const d = Math.sqrt(dLat * dLat + dLng * dLng)
    if (d <= MAX_DIST_DEG && (!best || d < best.d)) best = { id: c.id, d }
  }

  return best?.id ?? null
}

function setWater(tile: Tile) {
  tile.building.type = 'water'
  tile.building.level = 0
  tile.building.population = 0
  tile.building.jobs = 0
  tile.building.powered = false
  tile.building.watered = false
  tile.building.onFire = false
  tile.building.fireProgress = 0
  tile.building.age = 0
  tile.building.constructionProgress = 100
  tile.building.abandoned = false
  tile.zone = 'none'
  tile.hasSubway = false
}

function setLand(tile: Tile) {
  tile.building.type = 'grass'
  tile.building.level = 0
  tile.building.population = 0
  tile.building.jobs = 0
  tile.building.powered = false
  tile.building.watered = false
  tile.building.onFire = false
  tile.building.fireProgress = 0
  tile.building.age = 0
  tile.building.constructionProgress = 100
  tile.building.abandoned = false
  tile.zone = 'none'
  tile.hasSubway = false
}

/**
 * Apply hand-tuned “water + land” masks for preset cities.
 */
export function applyCityOverlay(grid: Tile[][], cityId: PresetCityId): void {
  const size = grid.length
  if (size === 0) return

  const W = size
  const H = size

  const inBounds = (x: number, y: number) => y >= 0 && y < H && x >= 0 && x < W
  const waterAt = (x: number, y: number) => {
    if (!inBounds(x, y)) return
    setWater(grid[y][x])
  }
  const landAt = (x: number, y: number) => {
    if (!inBounds(x, y)) return
    setLand(grid[y][x])
  }

  if (cityId === 'new_york') {
    // NYC: Manhattan island + Hudson/East River + NY Harbor
    // Center: 40.7°N, 74.0°W
    // Grid is 64x64, centered on this point
    
    // Hudson River (west of Manhattan) - wider at top, narrows south
    const hudsonTopX = Math.floor(W * 0.35)
    const hudsonBottomX = Math.floor(W * 0.40)
    const hudsonStartY = Math.floor(H * 0.10)
    const hudsonEndY = Math.floor(H * 0.75)
    
    for (let y = hudsonStartY; y < hudsonEndY; y++) {
      const progress = (y - hudsonStartY) / (hudsonEndY - hudsonStartY)
      const x0 = Math.floor(hudsonTopX + (hudsonBottomX - hudsonTopX) * progress)
      const x1 = Math.floor(hudsonTopX + (hudsonBottomX - hudsonTopX) * progress + 3)
      for (let x = x0; x <= x1; x++) waterAt(x, y)
    }

    // East River (east of Manhattan) - narrow channel
    const eastTopX = Math.floor(W * 0.58)
    const eastBottomX = Math.floor(W * 0.62)
    const eastStartY = Math.floor(H * 0.15)
    const eastEndY = Math.floor(H * 0.70)
    
    for (let y = eastStartY; y < eastEndY; y++) {
      const progress = (y - eastStartY) / (eastEndY - eastStartY)
      const x0 = Math.floor(eastTopX + (eastBottomX - eastTopX) * progress)
      const x1 = Math.floor(eastTopX + (eastBottomX - eastTopX) * progress + 2)
      for (let x = x0; x <= x1; x++) waterAt(x, y)
    }

    // NY Harbor / Lower Bay (south of Manhattan)
    const harborY = Math.floor(H * 0.65)
    for (let y = harborY; y < H; y++) {
      for (let x = Math.floor(W * 0.25); x < Math.floor(W * 0.75); x++) {
        waterAt(x, y)
      }
    }

    // Manhattan island (narrow strip between Hudson and East River)
    const manhattanStartY = Math.floor(H * 0.12)
    const manhattanEndY = Math.floor(H * 0.65)
    for (let y = manhattanStartY; y < manhattanEndY; y++) {
      const hudsonEdge = Math.floor(hudsonTopX + (hudsonBottomX - hudsonTopX) * ((y - hudsonStartY) / (hudsonEndY - hudsonStartY)) + 4)
      const eastEdge = Math.floor(eastTopX + (eastBottomX - eastTopX) * ((y - eastStartY) / (eastEndY - eastStartY)) - 1)
      for (let x = hudsonEdge; x < eastEdge; x++) {
        if (inBounds(x, y)) {
          // Only set land if not already water (preserve elevation-based water)
          if (grid[y][x].building.type !== 'water') {
            landAt(x, y)
          }
        }
      }
    }

    // New Jersey (west of Hudson)
    for (let y = Math.floor(H * 0.20); y < Math.floor(H * 0.70); y++) {
      for (let x = 0; x < Math.floor(W * 0.35); x++) {
        if (grid[y][x].building.type !== 'water') {
          landAt(x, y)
        }
      }
    }

    // Brooklyn/Queens/Long Island (east of East River)
    for (let y = Math.floor(H * 0.20); y < Math.floor(H * 0.70); y++) {
      for (let x = Math.floor(W * 0.64); x < W; x++) {
        if (grid[y][x].building.type !== 'water') {
          landAt(x, y)
        }
      }
    }

    // Staten Island (southwest, small blob)
    const siCx = Math.floor(W * 0.30)
    const siCy = Math.floor(H * 0.80)
    const siR = Math.floor(Math.min(W, H) * 0.06)
    for (let y = siCy - siR; y <= siCy + siR; y++) {
      for (let x = siCx - siR; x <= siCx + siR; x++) {
        const dx = x - siCx
        const dy = y - siCy
        if (dx * dx + dy * dy <= siR * siR) {
          landAt(x, y)
        }
      }
    }

    return
  }

  if (cityId === 'san_francisco') {
    // SF: Peninsula + SF Bay + Pacific Ocean
    // Center: 37.77°N, 122.42°W
    
    // Pacific Ocean (west side)
    const pacificX = Math.floor(W * 0.20)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < pacificX; x++) {
        waterAt(x, y)
      }
    }

    // SF Bay (east side, widens northward)
    const bayStartX = Math.floor(W * 0.50)
    const bayEndX = W
    const bayStartY = 0
    const bayEndY = Math.floor(H * 0.75)
    
    for (let y = bayStartY; y < bayEndY; y++) {
      const progress = y / bayEndY
      const xStart = Math.floor(bayStartX - progress * 5) // Bay widens going north
      for (let x = xStart; x < bayEndX; x++) {
        waterAt(x, y)
      }
    }

    // SF Peninsula (narrow strip between Pacific and Bay)
    const peninsulaStartY = Math.floor(H * 0.10)
    const peninsulaEndY = Math.floor(H * 0.70)
    for (let y = peninsulaStartY; y < peninsulaEndY; y++) {
      const bayEdge = Math.floor(bayStartX - (y / bayEndY) * 5)
      for (let x = pacificX; x < bayEdge; x++) {
        if (inBounds(x, y) && grid[y][x].building.type !== 'water') {
          landAt(x, y)
        }
      }
    }

    // Golden Gate opening (narrow channel connecting Pacific to Bay)
    const goldenGateY = Math.floor(H * 0.05)
    const goldenGateX0 = Math.floor(W * 0.25)
    const goldenGateX1 = Math.floor(W * 0.45)
    for (let y = 0; y < goldenGateY; y++) {
      for (let x = goldenGateX0; x < goldenGateX1; x++) {
        waterAt(x, y)
      }
    }

    // East Bay (land east of SF Bay)
    for (let y = Math.floor(H * 0.15); y < Math.floor(H * 0.65); y++) {
      for (let x = Math.floor(W * 0.55); x < W; x++) {
        if (grid[y][x].building.type !== 'water') {
          landAt(x, y)
        }
      }
    }

    return
  }

  // Other cities: keep elevation-based terrain for now.
}
