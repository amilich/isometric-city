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
    // Manhattan + Hudson/East River + NY Harbor (rough MVP)
    const hudsonX0 = Math.floor(W * 0.38)
    const hudsonX1 = Math.floor(W * 0.44)
    const eastX0 = Math.floor(W * 0.58)
    const eastX1 = Math.floor(W * 0.64)
    const harborY = Math.floor(H * 0.68)

    // Harbor / Atlantic band near bottom.
    for (let y = harborY; y < H; y++) for (let x = 0; x < W; x++) waterAt(x, y)

    // Hudson River
    for (let y = Math.floor(H * 0.12); y < H; y++)
      for (let x = hudsonX0; x <= hudsonX1; x++) waterAt(x, y)

    // East River (slightly tapered)
    for (let y = Math.floor(H * 0.2); y < harborY; y++) {
      const taper = Math.floor(((y - H * 0.2) / (harborY - H * 0.2)) * 2)
      for (let x = eastX0 - taper; x <= eastX1 - taper; x++) waterAt(x, y)
    }

    // Manhattan land strip
    for (let y = Math.floor(H * 0.12); y < harborY; y++)
      for (let x = hudsonX1 + 1; x < eastX0; x++) landAt(x, y)

    // Staten Island blob
    const siCx = Math.floor(W * 0.28)
    const siCy = Math.floor(H * 0.78)
    const siR = Math.floor(Math.min(W, H) * 0.08)
    for (let y = siCy - siR; y <= siCy + siR; y++) {
      for (let x = siCx - siR; x <= siCx + siR; x++) {
        const dx = x - siCx
        const dy = y - siCy
        if (dx * dx + dy * dy <= siR * siR) landAt(x, y)
      }
    }

    // Brooklyn/Queens + Long Island-ish on right
    for (let y = Math.floor(H * 0.32); y < harborY; y++)
      for (let x = eastX1 + 1; x < W; x++) landAt(x, y)

    // New Jersey land on left
    for (let y = Math.floor(H * 0.25); y < harborY; y++)
      for (let x = 0; x < hudsonX0; x++) landAt(x, y)

    return
  }

  if (cityId === 'san_francisco') {
    // SF Peninsula + Bay + Pacific (rough MVP)
    const pacificX = Math.floor(W * 0.18)
    const bayY = Math.floor(H * 0.22)
    const bayX0 = Math.floor(W * 0.52)

    // Pacific on far left
    for (let y = 0; y < H; y++) for (let x = 0; x < pacificX; x++) waterAt(x, y)

    // Bay wedge (top-right-ish)
    for (let y = 0; y < Math.floor(H * 0.72); y++) {
      const wedge = Math.floor((y / H) * Math.floor(W * 0.18))
      for (let x = bayX0 + wedge; x < W; x++) waterAt(x, y)
    }

    // Peninsula land
    for (let y = 0; y < H; y++) for (let x = pacificX; x < bayX0; x++) landAt(x, y)

    // Golden Gate-ish opening
    for (let y = 0; y < bayY; y++)
      for (let x = Math.floor(W * 0.25); x < Math.floor(W * 0.45); x++) waterAt(x, y)

    return
  }

  // Other cities: keep elevation-based terrain for now.
}
