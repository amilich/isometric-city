// Custom building generation and helpers for AI-generated buildings

import { GoogleGenAI } from '@google/genai';
import { BuildingCategory, BuildingType, CustomBuilding, ToolInfo, BUILDING_STATS } from '@/types/game';
import { loadImage, filterBackgroundColor, resizeImageToDataUrl, AI_BACKGROUND_COLOR, AI_COLOR_THRESHOLD } from '@/components/game/imageLoader';
import { createGeminiClient } from './gemini';

// Maximum number of custom buildings allowed
export const MAX_CUSTOM_BUILDINGS = 10;

// Model for image generation
const IMAGE_MODEL = 'gemini-2.5-flash-image';

// Create a custom building type string from size and id
export function createCustomBuildingType(size: 1 | 2, id: string): BuildingType {
  return `custom_${size}_${id}` as BuildingType;
}

// Parse a custom building type string into size and id
export function parseCustomBuildingType(type: string): { size: 1 | 2; id: string } | null {
  const match = type.match(/^custom_([12])_(.+)$/);
  if (!match) return null;
  return { size: parseInt(match[1], 10) as 1 | 2, id: match[2] };
}

// Stats derived from category (matches BUILDING_STATS pattern)
const CATEGORY_STATS: Record<BuildingCategory, Record<1 | 2, { maxPop: number; maxJobs: number; pollution: number; landValue: number }>> = {
  recreation: {
    1: { maxPop: 0, maxJobs: 2, pollution: -5, landValue: 20 },
    2: { maxPop: 0, maxJobs: 4, pollution: -10, landValue: 30 },
  },
  residential: {
    1: { maxPop: 8, maxJobs: 0, pollution: 0, landValue: 10 },
    2: { maxPop: 20, maxJobs: 0, pollution: 0, landValue: 15 },
  },
  commercial: {
    1: { maxPop: 0, maxJobs: 5, pollution: 0, landValue: 15 },
    2: { maxPop: 0, maxJobs: 15, pollution: 0, landValue: 20 },
  },
  industrial: {
    1: { maxPop: 0, maxJobs: 10, pollution: 10, landValue: -5 },
    2: { maxPop: 0, maxJobs: 25, pollution: 15, landValue: -8 },
  },
};

// Cost by category and size
const CATEGORY_COSTS: Record<BuildingCategory, Record<1 | 2, number>> = {
  recreation: { 1: 300, 2: 600 },
  residential: { 1: 400, 2: 800 },
  commercial: { 1: 500, 2: 1000 },
  industrial: { 1: 600, 2: 1200 },
};

// Reference sprites for style consistency (paths relative to /public)
const REFERENCE_SPRITE_PATHS = [
  '/assets/buildings/house_small.png',
  '/assets/buildings/shop_small.png',
  '/assets/buildings/park.png',
  '/assets/buildings/industrial.png',
];

const REFERENCE_SIZE = 256; // Downscale to this size before sending

// Get stats for a custom building (extends BUILDING_STATS pattern)
export function getCustomBuildingStats(category: BuildingCategory, size: 1 | 2) {
  return CATEGORY_STATS[category][size];
}

// Register a custom building's stats in BUILDING_STATS
export function registerCustomBuildingStats(building: CustomBuilding) {
  const key = createCustomBuildingType(building.size, building.id);
  BUILDING_STATS[key] = getCustomBuildingStats(building.category, building.size);
}

// Unregister a custom building's stats from BUILDING_STATS
export function unregisterCustomBuildingStats(building: CustomBuilding) {
  const key = createCustomBuildingType(building.size, building.id);
  delete BUILDING_STATS[key];
}

// Get size for a custom building (extends BUILDING_SIZES pattern)
export function getCustomBuildingSize(size: 1 | 2): { width: number; height: number } {
  return size === 2 ? { width: 2, height: 2 } : { width: 1, height: 1 };
}

// Get tool info for a custom building (extends TOOL_INFO pattern)
export function getCustomToolInfo(building: CustomBuilding): ToolInfo {
  return {
    name: building.name,
    cost: CATEGORY_COSTS[building.category][building.size],
    description: building.description,
    size: building.size,
  };
}

// Load and downscale an image to base64 (reuses loadImage from imageLoader)
async function loadAndDownscaleImage(path: string, maxSize: number): Promise<string> {
  const img = await loadImage(path);
  const dataUrl = resizeImageToDataUrl(img, maxSize);
  return dataUrl.split(',')[1]; // Return base64 without prefix
}

// Load reference sprites as base64 array (downscaled for efficiency)
export async function loadReferenceSprites(): Promise<string[]> {
  const results: string[] = [];
  for (const path of REFERENCE_SPRITE_PATHS) {
    try {
      const base64 = await loadAndDownscaleImage(path, REFERENCE_SIZE);
      results.push(base64);
    } catch (e) {
      console.error('Failed to load reference sprite:', path, e);
    }
  }
  return results;
}

// Extract base64 image data from Gemini response
function extractImageFromResponse(response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>): string {
  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('No image generated');
  }

  const parts = candidates[0].content?.parts;
  if (!parts) {
    throw new Error('Invalid response format');
  }

  for (const part of parts) {
    if (part.inlineData?.data) {
      return part.inlineData.data;
    }
  }

  throw new Error('No image in response');
}

// Load base64 data URL as HTMLImageElement
function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

// Edit an existing building sprite with modifications
export async function editBuildingSprite(
  currentImageBase64: string,
  modifications: string,
  onProgress?: (step: string) => void
): Promise<string> {
  const ai = createGeminiClient();

  onProgress?.('Applying modifications...');

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      { inlineData: { mimeType: 'image/png', data: currentImageBase64 } },
      `Edit this isometric building sprite with the following changes: ${modifications}

CRITICAL: Keep the solid bright cyan #00FFFF background. Do NOT use any cyan, turquoise, or teal colors in the building itself.`,
    ],
  });

  const imageBase64 = extractImageFromResponse(response);

  onProgress?.('Removing background...');

  const img = await loadImageFromDataUrl(`data:image/png;base64,${imageBase64}`);
  const resultImg = await filterBackgroundColor(img, AI_BACKGROUND_COLOR, AI_COLOR_THRESHOLD);

  return resizeImageToDataUrl(resultImg, 512);
}

// Generate building sprite with cyan background removal
export async function generateBuildingSprite(
  description: string,
  size: 1 | 2,
  referenceImages: string[],
  onProgress?: (step: string) => void
): Promise<string> {
  const ai = createGeminiClient();

  const prompt = `Generate a single isometric building sprite matching the style of these reference examples.
- Same isometric perspective (30 degrees, like SimCity)
- Same pixel art style and warm color palette
- Building faces bottom-left corner
- Single building only, centered with small padding

CRITICAL: Use a solid bright cyan #00FFFF background. Do NOT use any cyan, turquoise, or teal colors in the building itself.

BUILDING: ${description}
SIZE: ${size}x${size} tiles`;

  // Step 1: Generate the building sprite
  onProgress?.('Generating building sprite...');

  const contents: Array<string | { inlineData: { mimeType: string; data: string } }> = [];

  // Add reference images first
  for (const refBase64 of referenceImages) {
    contents.push({
      inlineData: { mimeType: 'image/png', data: refBase64 },
    });
  }

  // Add prompt
  contents.push(prompt);

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents,
  });

  const imageBase64 = extractImageFromResponse(response);

  // Step 2: Remove cyan background (using tight threshold to avoid false positives)
  onProgress?.('Removing background...');

  const img = await loadImageFromDataUrl(`data:image/png;base64,${imageBase64}`);
  const resultImg = await filterBackgroundColor(img, AI_BACKGROUND_COLOR, AI_COLOR_THRESHOLD);

  // Step 3: Resize to save storage space (max 512px for 2x2, 256px for 1x1)
  onProgress?.('Compressing image...');

  const maxSize = size === 2 ? 512 : 256;
  return resizeImageToDataUrl(resultImg, maxSize);
}
