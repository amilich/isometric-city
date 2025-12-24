# 🌍 Earth Terrain Integration + City Overlays + Irish Pub

This PR introduces **real Earth terrain data** integration, **city-specific geographical overlays** for preset locations, and adds the **Irish Pub** building to the game. It's a significant enhancement that transforms IsoCity from a procedurally-generated city builder into a platform that can render real-world locations with accurate topography.

## 🎯 Overview

This work enables players to start their city on **real Earth locations** using ETOPO1 elevation data, with hand-tuned overlays for major cities to ensure recognizable geography. The system is designed to scale to the full Earth, supporting the vision of an infinite, shared world.

## ✨ Key Features

### 1. Real Earth Terrain Integration
- **ETOPO1 GeoTIFF Processing**: Script to convert 445MB ETOPO1 GeoTIFF into WebP tiles (1°×1° resolution)
- **Convex Backend**: Elevation tiles stored in Convex file storage with metadata in database
- **Chunk-Based Loading**: 64×64 tile chunks for efficient terrain generation
- **Biome Generation**: Determines terrain type (ocean, coast, desert, grassland, forest, tundra, mountain) based on elevation and latitude
- **Client-Side Caching**: IndexedDB cache for elevation tiles to reduce API calls

### 2. City-Specific Geographical Overlays
Hand-tuned water/land masks for 6 preset cities to ensure recognizable geography:

- **New York**: Manhattan island with Hudson River (west), East River (east), NY Harbor, New Jersey, Brooklyn/Queens, Staten Island
- **San Francisco**: SF Peninsula with Pacific Ocean (west), SF Bay (east), Golden Gate opening, East Bay
- **London**: Thames River running east-west through the city, wider in the east, land on both banks
- **Dublin**: Liffey River running east-west through city center, Dublin Bay to the east
- **Tokyo**: Tokyo Bay to the south, land surrounding it, rivers flowing into the bay
- **Sydney**: Sydney Harbour with multiple arms (main arm, western arm, eastern arm), complex inlet system

### 3. Irish Pub Building
- New building type: `irish_pub` (1×1, Community category)
- Sprite: `public/assets/buildings/irish_pub.png`
- Stats: 10 max population, 5 max jobs, 5 pollution, 20 land value
- Cost: $900

### 4. Improved UX
- **Explicit Game Start Flow**: Removed auto-loading, requires explicit "Continue" or "New Game" selection
- **Loading Overlay**: Shows "Loading Earth terrain..." when starting Earth mode games
- **City Name Display**: City name now appears in top stats bar (before Population)
- **Error Handling**: Graceful fallback to random terrain if Earth data fails to load

## 🏗️ Technical Implementation

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
├─────────────────────────────────────────────────────────┤
│  Game State → Earth Chunks → Elevation Tiles → Convex   │
│       ↓              ↓              ↓                    │
│  Biome Logic → City Overlays → Terrain Generation       │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│              Convex Backend (Server)                     │
├─────────────────────────────────────────────────────────┤
│  elevationTiles table (lat, lng, fileId, size)         │
│  File Storage (WebP tiles, ~0.1-0.3 KB each)            │
└─────────────────────────────────────────────────────────┘
```

### Key Files Added/Modified

**New Files:**
- `scripts/process-etopo1.ts` - GeoTIFF to WebP tile converter and Convex uploader
- `scripts/check-convex-tiles.ts` - Utility to verify uploaded tiles
- `convex/schema.ts` - Convex database schema for elevation tiles
- `convex/elevation.ts` - Convex queries/mutations for tile storage
- `src/lib/earthProjection.ts` - Lat/lng ↔ tile coordinate conversions
- `src/lib/earthElevation.ts` - Elevation data loading and caching
- `src/lib/earthChunks.ts` - Chunk-based terrain loading system
- `src/lib/biomes.ts` - Biome determination from elevation/latitude
- `src/lib/cityOverlays.ts` - City-specific geographical overlays
- `src/components/LocationSelector.tsx` - UI for selecting starting location

**Modified Files:**
- `src/lib/simulation.ts` - Added `createInitialGameStateFromEarth()` function
- `src/context/GameContext.tsx` - Added `newGameFromEarth()` method
- `src/app/page.tsx` - Integrated LocationSelector and loading states
- `src/components/game/TopBar.tsx` - Added city name to stats bar
- `src/types/game.ts` - Added Earth mode fields to GameState
- `package.json` - Added dependencies (convex, geotiff, sharp, tsx)

### Data Processing

The `process-etopo1.ts` script:
1. Reads the ETOPO1 GeoTIFF file (445MB, 21601×10801 pixels)
2. Extracts 1°×1° tiles (60×60 elevation values per tile)
3. Converts elevation to grayscale WebP (0-255 maps to -11000m to 8848m)
4. Uploads to Convex file storage
5. Stores metadata (lat, lng, fileId, size) in Convex database

**Processing Commands:**
```bash
# Process single tile
pnpm process-earth -- --tile 40 -74    # New York

# Process bounding box
pnpm process-earth -- --bbox 34 42 -125 -73    # Covers NYC + SF region

# Check uploaded tiles
pnpm tsx scripts/check-convex-tiles.ts
```

### Current Tile Coverage

✅ **All 6 preset cities uploaded:**
- New York (40, -74)
- San Francisco (37, -123)
- London (51, -1)
- Dublin (53, -7)
- Tokyo (35, 139)
- Sydney (-34, 151)

Plus surrounding tiles from bounding box uploads (460+ tiles total).

## 🎮 User Experience

### Starting an Earth Game

1. Click "New Game" on main menu
2. Select a preset city (NYC, SF, London, Dublin, Tokyo, Sydney) or enter custom lat/lng
3. See "Loading Earth terrain..." overlay while data loads
4. Game starts with real elevation data and city-specific geography

### What Players See

- **Real Topography**: Actual elevation from ETOPO1 data
- **Recognizable Geography**: City overlays ensure Manhattan looks like an island, SF has the Bay, etc.
- **Proper Biomes**: Ocean, coast, desert, grassland, forest, tundra, mountains based on real data
- **City Name**: Displayed in top stats bar for context

## 🔧 Technical Decisions

### Why Convex?
- Built-in file storage (no need for separate CDN)
- Real-time database for tile metadata
- Serverless functions for queries
- Free tier sufficient for MVP

### Why WebP Tiles?
- Small file size (~0.1-0.3 KB per tile)
- Fast to decode on client
- Grayscale encoding preserves elevation precision
- Browser-native support

### Why Chunk-Based Loading?
- Enables infinite world expansion
- Efficient memory usage (load only visible chunks)
- Supports future multiplayer/shared world features

### Why City Overlays?
ETOPO1 data is ~1-2km resolution, which is insufficient for fine coastal features like:
- Manhattan's narrow island shape
- SF Bay's complex shoreline
- Thames River's meandering path

Overlays provide recognizable geography without requiring full hydrography datasets.

## 🐛 Known Limitations

1. **Tile Coverage**: Only preset cities + surrounding regions uploaded. Full Earth would require ~64,800 tiles.
2. **Overlay Accuracy**: City overlays are hand-tuned approximations, not perfect matches to real geography.
3. **Water Body Names**: Generic "Ocean" and "Lake" in Earth mode (no real place names yet).
4. **Build-Time Dependencies**: Convex codegen runs in prebuild step (may need adjustment for CI/CD).

## 🚀 Future Enhancements

- [ ] Upload full Earth tile coverage
- [ ] Add more preset cities with overlays
- [ ] Real water body names from hydrography data
- [ ] Smooth chunk transitions when panning
- [ ] Multiplayer support for shared Earth world
- [ ] City-specific building themes/styles

## 📝 Testing

Tested on:
- ✅ Local development (Convex dev server)
- ✅ Vercel deployment (production Convex)
- ✅ All 6 preset cities load correctly
- ✅ Fallback to random terrain if Convex unavailable
- ✅ City overlays render correctly
- ✅ Irish Pub building renders and functions

## 🙏 Acknowledgments

- ETOPO1 data from NOAA
- Inspired by the vision of an infinite, shared world for IsoCity
- Built with patience and many iterations to get the geography right

---

**Note**: This is a significant feature addition that transforms IsoCity's capabilities. While not perfect (especially the hand-tuned overlays), it provides a solid foundation for real-world terrain rendering and sets the stage for the infinite world vision.

