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
    // NYC: Based on actual geography
    // Manhattan: ~13.4mi N-S, ~2.3mi E-W, centered at 40.7°N, 74.0°W
    // Grid is 64x64 tiles (~32km² view)
    
    // Clear everything first, then build from reference
    // Manhattan runs roughly N-S (top to bottom in isometric view)
    const centerX = Math.floor(W / 2)
    const centerY = Math.floor(H / 2)
    
    // Manhattan island: long narrow strip, slightly angled
    // North end around y=8, South end around y=56
    const manhattanNorthY = 8
    const manhattanSouthY = 56
    const manhattanWidth = 6 // ~2.3 miles wide
    
    // Hudson River (west side) - wider, ~1-2 miles
    const hudsonWidth = 8
    const hudsonCenterX = centerX - Math.floor(manhattanWidth / 2) - Math.floor(hudsonWidth / 2)
    
    // East River (east side) - narrower, ~0.5-1 mile
    const eastWidth = 4
    const eastCenterX = centerX + Math.floor(manhattanWidth / 2) + Math.floor(eastWidth / 2)
    
    // Draw Hudson River (west of Manhattan)
    for (let y = manhattanNorthY; y < manhattanSouthY + 10; y++) {
      for (let x = hudsonCenterX - Math.floor(hudsonWidth / 2); x < hudsonCenterX + Math.floor(hudsonWidth / 2); x++) {
        waterAt(x, y)
      }
    }
    
    // Draw East River (east of Manhattan)
    for (let y = manhattanNorthY + 4; y < manhattanSouthY; y++) {
      for (let x = eastCenterX - Math.floor(eastWidth / 2); x < eastCenterX + Math.floor(eastWidth / 2); x++) {
        waterAt(x, y)
      }
    }
    
    // Draw Manhattan island (long narrow strip)
    for (let y = manhattanNorthY; y < manhattanSouthY; y++) {
      // Manhattan widens slightly in the middle (around 14th St)
      const midY = (manhattanNorthY + manhattanSouthY) / 2
      const widthAtY = y < midY 
        ? manhattanWidth + Math.floor((midY - y) / 8) // Wider in middle
        : manhattanWidth + Math.floor((y - midY) / 8)
      
      const manhattanLeft = centerX - Math.floor(widthAtY / 2)
      const manhattanRight = centerX + Math.floor(widthAtY / 2)
      
      for (let x = manhattanLeft; x < manhattanRight; x++) {
        landAt(x, y)
      }
    }
    
    // NY Harbor (south of Manhattan, opens to Atlantic)
    const harborY = manhattanSouthY
    for (let y = harborY; y < H; y++) {
      const harborWidth = Math.floor(W * 0.6)
      const harborLeft = centerX - Math.floor(harborWidth / 2)
      for (let x = harborLeft; x < harborLeft + harborWidth; x++) {
        waterAt(x, y)
      }
    }
    
    // New Jersey (west of Hudson River)
    for (let y = manhattanNorthY + 8; y < manhattanSouthY; y++) {
      for (let x = 0; x < hudsonCenterX - Math.floor(hudsonWidth / 2); x++) {
        landAt(x, y)
      }
    }
    
    // Brooklyn/Queens (east of East River, Long Island)
    for (let y = manhattanNorthY + 8; y < manhattanSouthY; y++) {
      for (let x = eastCenterX + Math.floor(eastWidth / 2); x < W; x++) {
        landAt(x, y)
      }
    }
    
    // Staten Island (southwest, below harbor)
    const siCx = Math.floor(W * 0.25)
    const siCy = Math.floor(H * 0.75)
    const siR = 8
    for (let y = siCy - siR; y <= siCy + siR; y++) {
      for (let x = siCx - siR; x <= siCx + siR; x++) {
        const dx = x - siCx
        const dy = y - siCy
        if (dx * dx + dy * dy <= siR * siR) {
          landAt(x, y)
        }
      }
    }
    
    // Upper Bay / Hudson continuation (north of Manhattan)
    for (let y = 0; y < manhattanNorthY; y++) {
      for (let x = Math.floor(W * 0.3); x < Math.floor(W * 0.7); x++) {
        waterAt(x, y)
      }
    }

    return
  }

  if (cityId === 'san_francisco') {
    // SF: Peninsula + SF Bay + Pacific Ocean
    // Center: 37.77°N, 122.42°W
    // SF is on a peninsula ~7mi x 7mi, Pacific west, Bay east
    
    const centerX = Math.floor(W / 2)
    const centerY = Math.floor(H / 2)
    
    // Pacific Ocean (west side)
    const pacificX = Math.floor(W * 0.22)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < pacificX; x++) {
        waterAt(x, y)
      }
    }

    // SF Bay (east side, widens northward)
    const bayStartX = Math.floor(W * 0.52)
    const bayEndX = W
    const bayStartY = 0
    const bayEndY = Math.floor(H * 0.70)
    
    for (let y = bayStartY; y < bayEndY; y++) {
      const progress = y / bayEndY
      const xStart = Math.floor(bayStartX - progress * 6) // Bay widens going north
      for (let x = xStart; x < bayEndX; x++) {
        waterAt(x, y)
      }
    }

    // SF Peninsula (narrow strip between Pacific and Bay, ~7mi wide)
    const peninsulaStartY = Math.floor(H * 0.12)
    const peninsulaEndY = Math.floor(H * 0.65)
    for (let y = peninsulaStartY; y < peninsulaEndY; y++) {
      const bayEdge = Math.floor(bayStartX - (y / bayEndY) * 6)
      for (let x = pacificX; x < bayEdge; x++) {
        if (inBounds(x, y)) {
          landAt(x, y)
        }
      }
    }

    // Golden Gate opening (narrow channel connecting Pacific to Bay at north)
    const goldenGateY = Math.floor(H * 0.08)
    const goldenGateX0 = Math.floor(W * 0.28)
    const goldenGateX1 = Math.floor(W * 0.48)
    for (let y = 0; y < goldenGateY; y++) {
      for (let x = goldenGateX0; x < goldenGateX1; x++) {
        waterAt(x, y)
      }
    }

    // East Bay (land east of SF Bay - Oakland/Berkeley area)
    for (let y = Math.floor(H * 0.18); y < Math.floor(H * 0.60); y++) {
      for (let x = Math.floor(W * 0.56); x < W; x++) {
        if (inBounds(x, y)) {
          landAt(x, y)
        }
      }
    }

    return
  }

  if (cityId === 'london') {
    // London: Thames River runs east-west through the city
    // Center: 51.5°N, 0.1°W
    // Thames is wider in the east (toward estuary)
    
    const centerX = Math.floor(W / 2)
    const centerY = Math.floor(H / 2)
    
    // Thames River (runs horizontally, wider in east)
    const thamesY = centerY
    const thamesWestX = Math.floor(W * 0.15) // Narrower in west
    const thamesEastX = Math.floor(W * 0.85) // Wider in east
    
    for (let x = thamesWestX; x < thamesEastX; x++) {
      const progress = (x - thamesWestX) / (thamesEastX - thamesWestX)
      const width = 3 + Math.floor(progress * 4) // 3-7 tiles wide
      const thamesTop = thamesY - Math.floor(width / 2)
      const thamesBottom = thamesY + Math.floor(width / 2)
      
      for (let y = thamesTop; y <= thamesBottom; y++) {
        waterAt(x, y)
      }
    }

    // North bank (land north of Thames)
    for (let y = 0; y < thamesY - 2; y++) {
      for (let x = Math.floor(W * 0.1); x < Math.floor(W * 0.9); x++) {
        if (inBounds(x, y)) {
          landAt(x, y)
        }
      }
    }

    // South bank (land south of Thames)
    for (let y = thamesY + 2; y < H; y++) {
      for (let x = Math.floor(W * 0.1); x < Math.floor(W * 0.9); x++) {
        if (inBounds(x, y)) {
          landAt(x, y)
        }
      }
    }

    return
  }

  if (cityId === 'dublin') {
    // Dublin: Liffey River runs east-west through city center
    // Center: 53.35°N, 6.26°W
    // Liffey is narrow, ~50-100m wide
    
    const centerX = Math.floor(W / 2)
    const centerY = Math.floor(H / 2)
    
    // Liffey River (runs horizontally through center, narrow)
    const liffeyY = centerY
    const liffeyWidth = 2
    const liffeyWestX = Math.floor(W * 0.2)
    const liffeyEastX = Math.floor(W * 0.8)
    
    for (let x = liffeyWestX; x < liffeyEastX; x++) {
      for (let y = liffeyY - Math.floor(liffeyWidth / 2); y <= liffeyY + Math.floor(liffeyWidth / 2); y++) {
        waterAt(x, y)
      }
    }

    // North side (land north of Liffey)
    for (let y = 0; y < liffeyY - 1; y++) {
      for (let x = Math.floor(W * 0.15); x < Math.floor(W * 0.85); x++) {
        if (inBounds(x, y)) {
          landAt(x, y)
        }
      }
    }

    // South side (land south of Liffey)
    for (let y = liffeyY + 1; y < H; y++) {
      for (let x = Math.floor(W * 0.15); x < Math.floor(W * 0.85); x++) {
        if (inBounds(x, y)) {
          landAt(x, y)
        }
      }
    }

    // Dublin Bay (east, opens to Irish Sea)
    for (let y = Math.floor(H * 0.3); y < Math.floor(H * 0.7); y++) {
      for (let x = Math.floor(W * 0.8); x < W; x++) {
        waterAt(x, y)
      }
    }

    return
  }

  if (cityId === 'tokyo') {
    // Tokyo: Tokyo Bay to the south, surrounded by land
    // Center: 35.7°N, 139.8°E
    // Bay is large, with land on all sides
    
    const centerX = Math.floor(W / 2)
    const centerY = Math.floor(H / 2)
    
    // Tokyo Bay (large bay to the south)
    const bayY = Math.floor(H * 0.65)
    const bayWestX = Math.floor(W * 0.25)
    const bayEastX = Math.floor(W * 0.75)
    
    for (let y = bayY; y < H; y++) {
      const progress = (y - bayY) / (H - bayY)
      const bayWidth = Math.floor((bayEastX - bayWestX) * (1 + progress * 0.3)) // Widens south
      const bayLeft = centerX - Math.floor(bayWidth / 2)
      const bayRight = centerX + Math.floor(bayWidth / 2)
      
      for (let x = bayLeft; x < bayRight; x++) {
        waterAt(x, y)
      }
    }

    // Land north of bay (Tokyo proper)
    for (let y = 0; y < bayY - 2; y++) {
      for (let x = Math.floor(W * 0.1); x < Math.floor(W * 0.9); x++) {
        if (inBounds(x, y)) {
          landAt(x, y)
        }
      }
    }

    // Land west of bay
    for (let y = Math.floor(H * 0.4); y < H; y++) {
      for (let x = 0; x < bayWestX; x++) {
        if (inBounds(x, y)) {
          landAt(x, y)
        }
      }
    }

    // Land east of bay
    for (let y = Math.floor(H * 0.4); y < H; y++) {
      for (let x = bayEastX; x < W; x++) {
        if (inBounds(x, y)) {
          landAt(x, y)
        }
      }
    }

    // Rivers flowing into bay (small channels)
    for (let x = Math.floor(W * 0.35); x < Math.floor(W * 0.65); x += 8) {
      for (let y = Math.floor(H * 0.5); y < bayY; y++) {
        waterAt(x, y)
      }
    }

    return
  }

  if (cityId === 'sydney') {
    // Sydney: Sydney Harbour (Port Jackson) - complex harbor with many inlets
    // Center: -33.9°S, 151.2°E
    // Harbour has multiple arms/fingers extending inland
    
    const centerX = Math.floor(W / 2)
    const centerY = Math.floor(H / 2)
    
    // Main harbour entrance (south, opens to Pacific)
    const harbourEntranceY = Math.floor(H * 0.75)
    const harbourEntranceWidth = Math.floor(W * 0.3)
    const harbourEntranceLeft = centerX - Math.floor(harbourEntranceWidth / 2)
    
    for (let y = harbourEntranceY; y < H; y++) {
      for (let x = harbourEntranceLeft; x < harbourEntranceLeft + harbourEntranceWidth; x++) {
        waterAt(x, y)
      }
    }

    // Main harbour arm (extends north from entrance)
    const harbourArmY = Math.floor(H * 0.45)
    const harbourArmWidth = Math.floor(W * 0.25)
    const harbourArmLeft = centerX - Math.floor(harbourArmWidth / 2)
    
    for (let y = harbourArmY; y < harbourEntranceY; y++) {
      for (let x = harbourArmLeft; x < harbourArmLeft + harbourArmWidth; x++) {
        waterAt(x, y)
      }
    }

    // Western arm (Parramatta River area)
    const westArmX = Math.floor(W * 0.3)
    const westArmY = Math.floor(H * 0.35)
    for (let y = westArmY; y < harbourArmY; y++) {
      for (let x = westArmX - 2; x < westArmX + 2; x++) {
        waterAt(x, y)
      }
    }

    // Eastern arm (Middle Harbour area)
    const eastArmX = Math.floor(W * 0.7)
    const eastArmY = Math.floor(H * 0.40)
    for (let y = eastArmY; y < harbourArmY; y++) {
      for (let x = eastArmX - 2; x < eastArmX + 2; x++) {
        waterAt(x, y)
      }
    }

    // Land surrounding harbour (North Shore, CBD, Eastern Suburbs)
    // North of harbour
    for (let y = 0; y < harbourArmY - 2; y++) {
      for (let x = Math.floor(W * 0.15); x < Math.floor(W * 0.85); x++) {
        if (inBounds(x, y)) {
          landAt(x, y)
        }
      }
    }

    // West of harbour
    for (let y = Math.floor(H * 0.25); y < H; y++) {
      for (let x = 0; x < westArmX - 3; x++) {
        if (inBounds(x, y)) {
          landAt(x, y)
        }
      }
    }

    // East of harbour
    for (let y = Math.floor(H * 0.25); y < H; y++) {
      for (let x = eastArmX + 3; x < W; x++) {
        if (inBounds(x, y)) {
          landAt(x, y)
        }
      }
    }

    // South of harbour (CBD area)
    for (let y = harbourEntranceY + 2; y < H; y++) {
      for (let x = Math.floor(W * 0.2); x < Math.floor(W * 0.8); x++) {
        if (inBounds(x, y)) {
          landAt(x, y)
        }
      }
    }

    return
  }
}
