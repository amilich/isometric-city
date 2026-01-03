/**
 * Building Sprite Utilities
 * 
 * Handles sprite sheet selection, coordinate calculation, and positioning
 * for building sprites. Extracted from CanvasIsometricGrid.tsx for better
 * code organization and reusability.
 */

import { Building, BuildingType } from '@/types/game';
import { SpritePack, getActiveSpritePack, getSpriteCoords, BUILDING_TO_SPRITE, SPRITE_VERTICAL_OFFSETS, SPRITE_HORIZONTAL_OFFSETS } from '@/lib/renderConfig';
import { getBuildingSize, requiresWaterAdjacency } from '@/lib/simulation';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

// ============================================================================
// Types
// ============================================================================

/** Result of sprite source selection */
export interface SpriteSourceResult {
  /** Path to the sprite sheet to use */
  source: string;
  /** Type of variant being used */
  variantType: 'normal' | 'construction' | 'abandoned' | 'parks' | 'parksConstruction' | 'dense' | 'modern' | 'farm' | 'shop' | 'station' | 'services' | 'infrastructure' | 'mansion';
  /** Variant coordinates if using a variant sheet (row, col) */
  variant: { row: number; col: number } | null;
}

/** Sprite coordinates within a sheet */
export interface SpriteCoords {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Calculated sprite positioning and sizing */
export interface SpritePositioning {
  /** Draw position X */
  drawX: number;
  /** Draw position Y */
  drawY: number;
  /** Destination width */
  destWidth: number;
  /** Destination height */
  destHeight: number;
}

/** Full sprite render info combining source, coords, and positioning */
export interface SpriteRenderInfo {
  source: SpriteSourceResult;
  coords: SpriteCoords | null;
  positioning: SpritePositioning;
  /** Whether the sprite should be horizontally flipped */
  shouldFlip: boolean;
}

// ============================================================================
// Sprite Source Selection
// ============================================================================

/**
 * Determine which sprite sheet to use for a building.
 * 
 * Priority order:
 * 1. Parks construction (parks building under construction)
 * 2. Construction (regular building under construction, phase 2)
 * 3. Abandoned (abandoned buildings)
 * 4. Parks (parks/recreation buildings)
 * 5. Dense/Modern variants (high-density building variants)
 * 6. Farm variants (low-density industrial)
 * 7. Shop variants (low-density commercial)
 * 8. Station variants (rail stations)
 * 9. Services variants (level-based service buildings)
 * 10. Normal (default sprite sheet)
 */
export function selectSpriteSource(
  buildingType: BuildingType,
  building: Building,
  tileX: number,
  tileY: number,
  activePack: SpritePack = getActiveSpritePack()
): SpriteSourceResult {
  const isUnderConstruction = building.constructionProgress !== undefined &&
                              building.constructionProgress < 100;
  const constructionProgress = building.constructionProgress ?? 100;
  const isConstructionPhase = isUnderConstruction && constructionProgress >= 40;
  const isAbandoned = building.abandoned === true;
  
  // Check if this is a parks building
  const isParksBuilding = !!(activePack.parksBuildings && activePack.parksBuildings[buildingType]);
  
  // Parks construction phase
  if (isConstructionPhase && isParksBuilding && activePack.parksConstructionSrc) {
    return {
      source: activePack.parksConstructionSrc,
      variantType: 'parksConstruction',
      variant: activePack.parksBuildings![buildingType],
    };
  }
  
  // Regular construction phase
  if (isConstructionPhase && activePack.constructionSrc) {
    return {
      source: activePack.constructionSrc,
      variantType: 'construction',
      variant: null,
    };
  }
  
  // Abandoned buildings
  if (isAbandoned && activePack.abandonedSrc) {
    return {
      source: activePack.abandonedSrc,
      variantType: 'abandoned',
      variant: null,
    };
  }
  
  // Parks buildings
  if (isParksBuilding && activePack.parksSrc) {
    return {
      source: activePack.parksSrc,
      variantType: 'parks',
      variant: activePack.parksBuildings![buildingType],
    };
  }
  
  // Dense/Modern variants (combined pool for random selection)
  if (activePack.denseSrc && activePack.denseVariants && activePack.denseVariants[buildingType]) {
    const denseVariants = activePack.denseVariants[buildingType];
    const modernVariants = activePack.modernSrc && activePack.modernVariants && activePack.modernVariants[buildingType]
      ? activePack.modernVariants[buildingType]
      : [];
    
    const allVariants = [
      ...denseVariants.map(v => ({ ...v, type: 'dense' as const })),
      ...modernVariants.map(v => ({ ...v, type: 'modern' as const })),
    ];
    
    // Deterministic random based on tile position
    const totalOptions = 1 + allVariants.length;
    const seed = (tileX * 31 + tileY * 17) % totalOptions;
    
    if (seed > 0 && allVariants.length > 0) {
      const selectedVariant = allVariants[seed - 1];
      if (selectedVariant.type === 'modern') {
        return {
          source: activePack.modernSrc!,
          variantType: 'modern',
          variant: { row: selectedVariant.row, col: selectedVariant.col },
        };
      } else {
        return {
          source: activePack.denseSrc,
          variantType: 'dense',
          variant: { row: selectedVariant.row, col: selectedVariant.col },
        };
      }
    }
  }
  
  // Modern variants only (no dense)
  if (activePack.modernSrc && activePack.modernVariants && activePack.modernVariants[buildingType]) {
    const variants = activePack.modernVariants[buildingType];
    const totalOptions = 1 + variants.length;
    const seed = (tileX * 31 + tileY * 17) % totalOptions;
    
    if (seed > 0 && variants.length > 0) {
      return {
        source: activePack.modernSrc,
        variantType: 'modern',
        variant: variants[seed - 1],
      };
    }
  }
  
  // Farm variants (low-density industrial)
  if (activePack.farmsSrc && activePack.farmsVariants && activePack.farmsVariants[buildingType]) {
    const variants = activePack.farmsVariants[buildingType];
    const totalOptions = 1 + variants.length;
    const seed = (tileX * 31 + tileY * 17) % totalOptions;
    
    if (seed > 0 && variants.length > 0) {
      return {
        source: activePack.farmsSrc,
        variantType: 'farm',
        variant: variants[seed - 1],
      };
    }
  }
  
  // Shop variants (low-density commercial)
  if (activePack.shopsSrc && activePack.shopsVariants && activePack.shopsVariants[buildingType]) {
    const variants = activePack.shopsVariants[buildingType];
    const totalOptions = 1 + variants.length;
    const seed = (tileX * 31 + tileY * 17) % totalOptions;
    
    if (seed > 0 && variants.length > 0) {
      return {
        source: activePack.shopsSrc,
        variantType: 'shop',
        variant: variants[seed - 1],
      };
    }
  }
  
  // Station variants (rail stations)
  if (activePack.stationsSrc && activePack.stationsVariants && activePack.stationsVariants[buildingType]) {
    const variants = activePack.stationsVariants[buildingType];
    if (variants.length > 0) {
      const variantIndex = (tileX * 7 + tileY * 13) % variants.length;
      return {
        source: activePack.stationsSrc,
        variantType: 'station',
        variant: variants[variantIndex],
      };
    }
  }
  
  // Services variants (level-based selection)
  if (activePack.servicesSrc && activePack.servicesVariants && activePack.servicesVariants[buildingType]) {
    const variants = activePack.servicesVariants[buildingType];
    if (variants.length > 0) {
      // Use building.level (1-based) to select variant (0-based index)
      // Clamp level to available variants: Math.min(building.level - 1, variants.length - 1)
      const levelIndex = Math.max(0, Math.min(building.level - 1, variants.length - 1));
      return {
        source: activePack.servicesSrc,
        variantType: 'services',
        variant: variants[levelIndex],
      };
    }
  }
  
  // Infrastructure variants (level-based selection for utility buildings)
  if (activePack.infrastructureSrc && activePack.infrastructureVariants && activePack.infrastructureVariants[buildingType]) {
    const variants = activePack.infrastructureVariants[buildingType];
    if (variants.length > 0) {
      const levelIndex = Math.max(0, Math.min(building.level - 1, variants.length - 1));
      return {
        source: activePack.infrastructureSrc,
        variantType: 'infrastructure',
        variant: variants[levelIndex],
      };
    }
  }
  

  // Mansion variants (alternate mansion designs)
  if (activePack.mansionsSrc && activePack.mansionsVariants && activePack.mansionsVariants[buildingType]) {
    const variants = activePack.mansionsVariants[buildingType];
    const totalOptions = 1 + variants.length;
    const seed = (tileX * 31 + tileY * 17) % totalOptions;

    if (seed > 0 && variants.length > 0) {
      return {
        source: activePack.mansionsSrc,
        variantType: 'mansion',
        variant: variants[seed - 1],
      };
    }
  }

  // Default: normal sprite sheet
  return {
    source: activePack.src,
    variantType: 'normal',
    variant: null,
  };
}

// ============================================================================
// Sprite Coordinates Calculation
// ============================================================================

/**
 * Calculate sprite coordinates within the selected sheet.
 * Handles all the special cropping and offset adjustments for different sprite types.
 */
export function calculateSpriteCoords(
  buildingType: BuildingType,
  source: SpriteSourceResult,
  sheetWidth: number,
  sheetHeight: number,
  activePack: SpritePack = getActiveSpritePack()
): SpriteCoords | null {
  const { variantType, variant } = source;
  
  // Parks buildings (including parks construction)
  if ((variantType === 'parks' || variantType === 'parksConstruction') && variant) {
    const parksCols = activePack.parksCols || 5;
    const parksRows = activePack.parksRows || 6;
    const tileWidth = Math.floor(sheetWidth / parksCols);
    const tileHeight = Math.floor(sheetHeight / parksRows);
    
    let sourceY = variant.row * tileHeight;
    let sourceH = tileHeight;
    
    // Special handling for buildings with content bleeding from adjacent rows
    if (buildingType === 'marina_docks_small') {
      sourceY += tileHeight * 0.15;
      sourceH = tileHeight * 0.85;
    } else if (buildingType === 'pier_large') {
      sourceY += tileHeight * 0.2;
      sourceH = tileHeight * 0.8;
    } else if (buildingType === 'amphitheater') {
      sourceY += tileHeight * 0.1;
    } else if (buildingType === 'mini_golf_course') {
      sourceY += tileHeight * 0.2;
      sourceH = tileHeight * 0.8;
    } else if (buildingType === 'cabin_house') {
      sourceY += tileHeight * 0.1;
    } else if (buildingType === 'go_kart_track') {
      sourceY += tileHeight * 0.1;
    } else if (buildingType === 'greenhouse_garden') {
      sourceY += tileHeight * 0.1;
      sourceH = tileHeight * 0.9;
    } else if (buildingType === 'bleachers_field') {
      sourceH = tileHeight * 1.1;
    }
    
    return {
      sx: variant.col * tileWidth,
      sy: sourceY,
      sw: tileWidth,
      sh: sourceH,
    };
  }
  
  // Dense variants
  if (variantType === 'dense' && variant) {
    const tileWidth = Math.floor(sheetWidth / activePack.cols);
    const tileHeight = Math.floor(sheetHeight / activePack.rows);
    
    let sourceY = variant.row * tileHeight;
    let sourceH = tileHeight;
    
    // Per-building adjustments for dense variants
    if (buildingType === 'mall') {
      sourceY += tileHeight * 0.12;
    } else if (buildingType === 'factory_large') {
      sourceY += tileHeight * 0.05;
      sourceH = tileHeight * 0.95;
    } else if (buildingType === 'apartment_high') {
      sourceH = tileHeight * 1.05;
    } else if (buildingType === 'office_high') {
      sourceY += tileHeight * 0.1;
      sourceH = tileHeight * 0.98;
    } else if (buildingType === 'office_low') {
      sourceY += tileHeight * 0.1;
    }
    
    return {
      sx: variant.col * tileWidth,
      sy: sourceY,
      sw: tileWidth,
      sh: sourceH,
    };
  }
  
  // Modern variants
  if (variantType === 'modern' && variant) {
    const tileWidth = Math.floor(sheetWidth / activePack.cols);
    const tileHeight = Math.floor(sheetHeight / activePack.rows);
    
    let sourceY = variant.row * tileHeight;
    let sourceH = tileHeight;
    
    if (buildingType === 'mall') {
      sourceY += tileHeight * 0.15;
      if (variant.row === 3) {
        sourceH = tileHeight * 0.95;
      } else {
        sourceH = tileHeight * 0.85;
      }
    } else if (buildingType === 'apartment_high') {
      sourceH = tileHeight * 1.05;
    }
    
    return {
      sx: variant.col * tileWidth,
      sy: sourceY,
      sw: tileWidth,
      sh: sourceH,
    };
  }
  
  // Farm variants
  if (variantType === 'farm' && variant) {
    const farmsCols = activePack.farmsCols || 5;
    const farmsRows = activePack.farmsRows || 6;
    const tileWidth = Math.floor(sheetWidth / farmsCols);
    const tileHeight = Math.floor(sheetHeight / farmsRows);
    
    return {
      sx: variant.col * tileWidth,
      sy: variant.row * tileHeight,
      sw: tileWidth,
      sh: tileHeight,
    };
  }
  
  // Shop variants
  if (variantType === 'shop' && variant) {
    const shopsCols = activePack.shopsCols || 5;
    const shopsRows = activePack.shopsRows || 6;
    const tileWidth = Math.floor(sheetWidth / shopsCols);
    const tileHeight = Math.floor(sheetHeight / shopsRows);
    
    return {
      sx: variant.col * tileWidth,
      sy: variant.row * tileHeight,
      sw: tileWidth,
      sh: tileHeight,
    };
  }
  
  // Station variants
  if (variantType === 'station' && variant) {
    const stationsCols = activePack.stationsCols || 5;
    const stationsRows = activePack.stationsRows || 6;
    const tileWidth = Math.floor(sheetWidth / stationsCols);
    const tileHeight = Math.floor(sheetHeight / stationsRows);
    
    let sourceY = variant.row * tileHeight;
    let sourceH = tileHeight;
    
    // Special handling for station rows with bleeding
    if (variant.row === 2) {
      sourceY += tileHeight * 0.1;
    } else if (variant.row === 3) {
      sourceY += tileHeight * 0.1;
      sourceH -= tileHeight * 0.05;
    } else if (variant.row === 4) {
      sourceY += tileHeight * 0.1;
      sourceH -= tileHeight * 0.1;
    }
    
    return {
      sx: variant.col * tileWidth,
      sy: sourceY,
      sw: tileWidth,
      sh: sourceH,
    };
  }

  // Mansion variants (same crops as modern apartment_high)
  if (variantType === 'mansion' && variant) {
    const mansionsCols = activePack.mansionsCols || 5;
    const mansionsRows = activePack.mansionsRows || 7;
    const tileWidth = Math.floor(sheetWidth / mansionsCols);
    const tileHeight = Math.floor(sheetHeight / mansionsRows);
    
    // Extend height to capture full building (1.05 base + 0.15 for bottom)
    const sourceH = tileHeight * 1.20;

    return {
      sx: variant.col * tileWidth,
      sy: variant.row * tileHeight,
      sw: tileWidth,
      sh: sourceH,
    };
  }
  
  // Services variants
  if (variantType === 'services' && variant) {
    const servicesCols = activePack.servicesCols || 5;
    const servicesRows = activePack.servicesRows || 6;
    const tileWidth = Math.floor(sheetWidth / servicesCols);
    const tileHeight = Math.floor(sheetHeight / servicesRows);
    
    return {
      sx: variant.col * tileWidth,
      sy: variant.row * tileHeight,
      sw: tileWidth,
      sh: tileHeight,
    };
  }
  
  // Infrastructure variants
  if (variantType === 'infrastructure' && variant) {
    const infraCols = activePack.infrastructureCols || 5;
    const infraRows = activePack.infrastructureRows || 6;
    const tileWidth = Math.floor(sheetWidth / infraCols);
    const tileHeight = Math.floor(sheetHeight / infraRows);
    
    return {
      sx: variant.col * tileWidth,
      sy: variant.row * tileHeight,
      sw: tileWidth,
      sh: tileHeight,
    };
  }
  
  // Normal, construction, or abandoned - use getSpriteCoords
  const coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight, activePack);
  
  // Special handling for factory_large base sprite
  if (buildingType === 'factory_large' && coords) {
    const tileHeight = Math.floor(sheetHeight / activePack.rows);
    coords.sh = coords.sh - tileHeight * 0.08;
  }
  
  return coords;
}

// ============================================================================
// Scale Calculation
// ============================================================================

/**
 * Calculate the scale multiplier for a building sprite.
 */
export function calculateSpriteScale(
  buildingType: BuildingType,
  source: SpriteSourceResult,
  building: Building,
  activePack: SpritePack = getActiveSpritePack()
): number {
  const { variantType, variant } = source;
  const buildingSize = getBuildingSize(buildingType);
  const isMultiTile = buildingSize.width > 1 || buildingSize.height > 1;
  const isConstructionPhase = building.constructionProgress !== undefined && 
                              building.constructionProgress >= 40 && 
                              building.constructionProgress < 100;
  const isAbandoned = building.abandoned === true;
  
  // Base scale: multi-tile buildings scale with footprint
  let scaleMultiplier = isMultiTile ? Math.max(buildingSize.width, buildingSize.height) : 1;
  
  // Per-building scale adjustments
  const buildingScales: Record<string, number> = {
    airport: 1.0,
    school: 1.05,
    university: 0.95,
    space_program: 1.06,
    stadium: 0.7,
    water_tower: 0.9,
    subway_station: 0.7,
    police_station: 0.97,
    fire_station: 0.97,
    hospital: 0.9,
    house_small: 1.08,
    apartment_low: 1.15,
    apartment_high: 1.38,
    office_high: 1.20,
  };
  
  if (buildingType in buildingScales) {
    scaleMultiplier *= buildingScales[buildingType];
  }
  
  // Variant-specific scale adjustments
  if (variantType === 'dense') {
    if (buildingType === 'mall') {
      scaleMultiplier *= 0.85;
    }
    if (activePack.denseScales && buildingType in activePack.denseScales) {
      scaleMultiplier *= activePack.denseScales[buildingType];
    }
    // Per-variant adjustments
    if (buildingType === 'office_high' && variant && variant.row === 2 && variant.col === 1) {
      scaleMultiplier *= 0.7;
    }
    if (buildingType === 'office_high' && variant && variant.row === 2 && variant.col === 2) {
      scaleMultiplier *= 0.7; // 3rd row, 3rd col - shrunk 30%
    }
  }
  
  if (variantType === 'modern') {
    if (buildingType === 'mall') {
      scaleMultiplier *= 0.85;
    }
    if (activePack.modernScales && buildingType in activePack.modernScales) {
      scaleMultiplier *= activePack.modernScales[buildingType];
    }
  }
  
  if (variantType === 'farm' && activePack.farmsScales && buildingType in activePack.farmsScales) {
    scaleMultiplier *= activePack.farmsScales[buildingType];
  }
  
  if (variantType === 'shop' && activePack.shopsScales && buildingType in activePack.shopsScales) {
    scaleMultiplier *= activePack.shopsScales[buildingType];
  }
  
  if (variantType === 'station' && activePack.stationsScales && buildingType in activePack.stationsScales) {
    scaleMultiplier *= activePack.stationsScales[buildingType];
  }
  
  if (variantType === 'services' && activePack.servicesScales && buildingType in activePack.servicesScales) {
    scaleMultiplier *= activePack.servicesScales[buildingType];
  }
  
  if (variantType === 'infrastructure' && activePack.infrastructureScales && buildingType in activePack.infrastructureScales) {
    scaleMultiplier *= activePack.infrastructureScales[buildingType];
  }

  if (variantType === 'mansion' && activePack.mansionsScales && buildingType in activePack.mansionsScales) {
    scaleMultiplier *= activePack.mansionsScales[buildingType];
  }

  if ((variantType === 'parks' || variantType === 'parksConstruction') &&
      activePack.parksScales && buildingType in activePack.parksScales) {
    scaleMultiplier *= activePack.parksScales[buildingType];
  }
  
  if (isConstructionPhase && activePack.constructionScales && buildingType in activePack.constructionScales) {
    scaleMultiplier *= activePack.constructionScales[buildingType];
  }
  
  if (isAbandoned && activePack.abandonedScales && buildingType in activePack.abandonedScales) {
    scaleMultiplier *= activePack.abandonedScales[buildingType];
  }
  
  // Apply global scale from sprite pack
  const globalScale = activePack.globalScale ?? 1;
  scaleMultiplier *= globalScale;
  
  return scaleMultiplier;
}

// ============================================================================
// Offset Calculation
// ============================================================================

/**
 * Calculate vertical and horizontal offsets for a building sprite.
 * Returns offsets as multipliers of tile height/width.
 */
export function calculateSpriteOffsets(
  buildingType: BuildingType,
  source: SpriteSourceResult,
  building: Building,
  activePack: SpritePack = getActiveSpritePack()
): { vertical: number; horizontal: number } {
  const { variantType, variant } = source;
  const isConstructionPhase = building.constructionProgress !== undefined && 
                              building.constructionProgress >= 40 && 
                              building.constructionProgress < 100;
  const isAbandoned = building.abandoned === true;
  const isParksBuilding = variantType === 'parks' || variantType === 'parksConstruction';
  
  let verticalOffset = 0;
  let horizontalOffset = 0;
  
  // Determine vertical offset based on priority order
  if (isConstructionPhase && isParksBuilding && activePack.parksConstructionVerticalOffsets && 
      buildingType in activePack.parksConstructionVerticalOffsets) {
    verticalOffset = activePack.parksConstructionVerticalOffsets[buildingType];
  } else if (isConstructionPhase && activePack.constructionVerticalOffsets && 
             buildingType in activePack.constructionVerticalOffsets) {
    verticalOffset = activePack.constructionVerticalOffsets[buildingType];
  } else if (isAbandoned && activePack.abandonedVerticalOffsets && 
             buildingType in activePack.abandonedVerticalOffsets) {
    verticalOffset = activePack.abandonedVerticalOffsets[buildingType];
  } else if (isParksBuilding && activePack.parksVerticalOffsets && 
             buildingType in activePack.parksVerticalOffsets) {
    verticalOffset = activePack.parksVerticalOffsets[buildingType];
  } else if (variantType === 'dense' && activePack.denseVerticalOffsets && 
             buildingType in activePack.denseVerticalOffsets) {
    verticalOffset = activePack.denseVerticalOffsets[buildingType];
    // Per-variant offset adjustments
    if (buildingType === 'mall' && variant && variant.row === 2 && variant.col === 4) {
      verticalOffset += 0.5;
    }
    if (buildingType === 'mall' && variant && variant.row === 3 && variant.col === 0) {
      verticalOffset += 0.3; // 4th row, 1st col - shifted down 0.3 tiles
    }
    if (buildingType === 'mall' && variant && variant.row === 3 && variant.col === 1) {
      verticalOffset += 0.5; // 4th row, 2nd col - shifted down 0.5 tiles
    }
    if (buildingType === 'mall' && variant && variant.row === 3 && variant.col === 2) {
      verticalOffset += 0.3; // 4th row, 3rd col - shifted down 0.3 tiles
    }
    if (buildingType === 'office_high' && variant && variant.row === 2 && variant.col === 0) {
      verticalOffset += 0.2; // 3rd row, 1st col - shifted down 0.2 tiles
    }
    if (buildingType === 'office_high' && variant && variant.row === 2 && variant.col === 1) {
      verticalOffset += 0.1;
    }
    if (buildingType === 'office_high' && variant && variant.row === 2 && variant.col === 2) {
      verticalOffset += 0.1; // 3rd row, 3rd col - shifted down 0.1 tiles
    }
  } else if (variantType === 'modern' && activePack.modernVerticalOffsets && 
             buildingType in activePack.modernVerticalOffsets) {
    verticalOffset = activePack.modernVerticalOffsets[buildingType];
  } else if (variantType === 'farm' && activePack.farmsVerticalOffsets && 
             buildingType in activePack.farmsVerticalOffsets) {
    verticalOffset = activePack.farmsVerticalOffsets[buildingType];
  } else if (variantType === 'shop' && activePack.shopsVerticalOffsets && 
             buildingType in activePack.shopsVerticalOffsets) {
    verticalOffset = activePack.shopsVerticalOffsets[buildingType];
  } else if (variantType === 'station' && activePack.stationsVerticalOffsets &&
             buildingType in activePack.stationsVerticalOffsets) {
    verticalOffset = activePack.stationsVerticalOffsets[buildingType];
  } else if (variantType === 'services' && activePack.servicesVerticalOffsets && 
             buildingType in activePack.servicesVerticalOffsets) {
    verticalOffset = activePack.servicesVerticalOffsets[buildingType];
  } else if (variantType === 'infrastructure' && activePack.infrastructureVerticalOffsets && 
             buildingType in activePack.infrastructureVerticalOffsets) {
    verticalOffset = activePack.infrastructureVerticalOffsets[buildingType];
  } else if (variantType === 'mansion' && activePack.mansionsVerticalOffsets &&
             buildingType in activePack.mansionsVerticalOffsets) {
    verticalOffset = activePack.mansionsVerticalOffsets[buildingType];
  } else if (activePack.buildingVerticalOffsets && buildingType in activePack.buildingVerticalOffsets) {
    verticalOffset = activePack.buildingVerticalOffsets[buildingType];
  } else {
    const spriteKey = BUILDING_TO_SPRITE[buildingType];
    if (spriteKey && SPRITE_VERTICAL_OFFSETS[spriteKey]) {
      verticalOffset = SPRITE_VERTICAL_OFFSETS[spriteKey];
    }
  }
  
  // Special per-building adjustments
  if (buildingType === 'hospital') {
    verticalOffset -= 0.1;
  }
  
  // Horizontal offsets
  const spriteKey = BUILDING_TO_SPRITE[buildingType];
  if (spriteKey && SPRITE_HORIZONTAL_OFFSETS[spriteKey]) {
    horizontalOffset = SPRITE_HORIZONTAL_OFFSETS[spriteKey];
  }
  
  if (isParksBuilding && activePack.parksHorizontalOffsets && 
      buildingType in activePack.parksHorizontalOffsets) {
    horizontalOffset = activePack.parksHorizontalOffsets[buildingType];
  }
  
  if (variantType === 'farm' && activePack.farmsHorizontalOffsets && 
      buildingType in activePack.farmsHorizontalOffsets) {
    horizontalOffset = activePack.farmsHorizontalOffsets[buildingType];
  }
  
  if (variantType === 'shop' && activePack.shopsHorizontalOffsets && 
      buildingType in activePack.shopsHorizontalOffsets) {
    horizontalOffset = activePack.shopsHorizontalOffsets[buildingType];
  }
  
  if (variantType === 'station' && activePack.stationsHorizontalOffsets && 
      buildingType in activePack.stationsHorizontalOffsets) {
    horizontalOffset = activePack.stationsHorizontalOffsets[buildingType];
  }
  
  if (variantType === 'services' && activePack.servicesHorizontalOffsets && 
      buildingType in activePack.servicesHorizontalOffsets) {
    horizontalOffset = activePack.servicesHorizontalOffsets[buildingType];
  }
  
  if (variantType === 'infrastructure' && activePack.infrastructureHorizontalOffsets && 
      buildingType in activePack.infrastructureHorizontalOffsets) {
    horizontalOffset = activePack.infrastructureHorizontalOffsets[buildingType];
  }
  
  return { vertical: verticalOffset, horizontal: horizontalOffset };
}

// ============================================================================
// Combined Sprite Render Info
// ============================================================================

/**
 * Get complete sprite rendering information for a building.
 * Combines source selection, coordinate calculation, and positioning.
 */
export function getSpriteRenderInfo(
  buildingType: BuildingType,
  building: Building,
  tileX: number,
  tileY: number,
  screenX: number,
  screenY: number,
  sheetWidth: number,
  sheetHeight: number,
  options: {
    hasAdjacentRoad?: boolean;
    shouldFlipForRoad?: boolean;
  } = {},
  activePack: SpritePack = getActiveSpritePack()
): SpriteRenderInfo | null {
  // Select sprite source
  const source = selectSpriteSource(buildingType, building, tileX, tileY, activePack);
  
  // Calculate coordinates
  const coords = calculateSpriteCoords(buildingType, source, sheetWidth, sheetHeight, activePack);
  if (!coords) {
    return null;
  }
  
  // Calculate scale
  const scaleMultiplier = calculateSpriteScale(buildingType, source, building, activePack);
  
  // Calculate offsets
  const offsets = calculateSpriteOffsets(buildingType, source, building, activePack);
  
  // Calculate destination size
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const destWidth = w * 1.2 * scaleMultiplier;
  const aspectRatio = coords.sh / coords.sw;
  const destHeight = destWidth * aspectRatio;
  
  // Calculate position
  const buildingSize = getBuildingSize(buildingType);
  const isMultiTile = buildingSize.width > 1 || buildingSize.height > 1;
  
  let drawPosX = screenX;
  let drawPosY = screenY;
  
  if (isMultiTile) {
    const frontmostOffsetX = buildingSize.width - 1;
    const frontmostOffsetY = buildingSize.height - 1;
    const screenOffsetX = (frontmostOffsetX - frontmostOffsetY) * (w / 2);
    const screenOffsetY = (frontmostOffsetX + frontmostOffsetY) * (h / 2);
    drawPosX = screenX + screenOffsetX;
    drawPosY = screenY + screenOffsetY;
  }
  
  // Apply offsets
  const drawX = drawPosX + w / 2 - destWidth / 2 + offsets.horizontal * w;
  
  let verticalPush: number;
  if (isMultiTile) {
    const footprintDepth = buildingSize.width + buildingSize.height - 2;
    verticalPush = footprintDepth * h * 0.25;
  } else {
    verticalPush = destHeight * 0.15;
  }
  verticalPush += offsets.vertical * h;
  
  const drawY = drawPosY + h - destHeight + verticalPush;
  
  // Determine flip - waterfront assets should never be mirrored
  const isWaterfrontAsset = requiresWaterAdjacency(buildingType);
  const shouldRoadMirror = (() => {
    if (isWaterfrontAsset) return false;
    
    if (options.hasAdjacentRoad) {
      return options.shouldFlipForRoad ?? false;
    }
    // Deterministic random mirroring for visual variety
    const mirrorSeed = (tileX * 47 + tileY * 83) % 100;
    return mirrorSeed < 50;
  })();
  
  const baseFlipped = building.flipped === true;
  const shouldFlip = baseFlipped !== shouldRoadMirror;
  
  return {
    source,
    coords,
    positioning: {
      drawX,
      drawY,
      destWidth,
      destHeight,
    },
    shouldFlip,
  };
}
