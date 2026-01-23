import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

// Configure fal with server-side API key
fal.config({
  credentials: process.env.FAL_KEY,
});

// Valid aspect ratios supported by nano-banana-pro API
const VALID_ASPECT_RATIOS = ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"] as const;
type AspectRatio = typeof VALID_ASPECT_RATIOS[number];

// Types for the response
interface AspectRatioResponse {
  success: boolean;
  aspectRatio?: string;
  error?: string;
}

interface GenerateResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

interface AnalyzeResponse {
  success: boolean;
  attributes?: BuildingAttributes;
  error?: string;
  raw?: string;
}

interface BuildingAttributes {
  category: 'residential' | 'commercial' | 'industrial' | 'service' | 'recreation';
  size: number;
  maxPop: number;
  maxJobs: number;
  pollution: number;
  landValue: number;
  suggestedCost: number;
  suggestedName: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<AspectRatioResponse | GenerateResponse | AnalyzeResponse>> {
  try {
    const body = await request.json();
    const { step } = body;

    if (step === "get-aspect-ratio") {
      const { prompt } = body;
      
      if (!prompt || typeof prompt !== 'string') {
        return NextResponse.json({ success: false, error: "Prompt is required" }, { status: 400 });
      }

      // Use LLM to determine optimal aspect ratio for the building
      const result = await fal.subscribe("openrouter/router", {
        input: {
          model: "google/gemini-2.5-flash",
          prompt: `Analyze this building description and determine the best aspect ratio for generating its image:

"${prompt}"

Consider the building's natural proportions:
- Very tall buildings (skyscrapers, towers, monuments) → use "9:16" or "2:3" (tall portrait)
- Tall buildings (office buildings, apartments, churches) → use "3:4" or "4:5" (portrait)
- Square/balanced buildings (houses, shops, small offices, parks) → use "1:1" (square)
- Wide buildings (warehouses, malls, factories) → use "5:4" or "4:3" (landscape)
- Very wide buildings (stadiums, airports, hangars) → use "3:2" or "16:9" (wide landscape)

Return ONLY ONE of these aspect ratio strings: "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"
No explanation, just the ratio string.`,
          temperature: 0.1,
        },
      });

      // Validate LLM response against valid API values, fallback to 4:5 if invalid
      const rawRatio = result.data?.output?.trim() || "4:5";
      const aspectRatio: AspectRatio = VALID_ASPECT_RATIOS.includes(rawRatio as AspectRatio) 
        ? (rawRatio as AspectRatio) 
        : "4:5";
      
      return NextResponse.json({ 
        success: true, 
        aspectRatio 
      });
    }

    if (step === "generate") {
      const { prompt, aspectRatio: rawAspectRatio = "4:5" } = body;
      
      if (!prompt || typeof prompt !== 'string') {
        return NextResponse.json({ success: false, error: "Prompt is required" }, { status: 400 });
      }
      
      // Validate aspect ratio from client
      const aspectRatio: AspectRatio = VALID_ASPECT_RATIOS.includes(rawAspectRatio as AspectRatio)
        ? (rawAspectRatio as AspectRatio)
        : "4:5";

      // Craft the prompt for highly detailed isometric game art
      const fullPrompt = `Highly detailed realistic isometric building render: ${prompt}. 
Style: Professional isometric city-builder game asset, 45-degree isometric perspective, photorealistic materials and textures, intricate architectural details like windows, doors, roof tiles, bricks, and trim work. Similar quality to Cities Skylines or SimCity 4 building assets.
CRITICAL PROJECTION: Use TRUE ISOMETRIC DIMETRIC PROJECTION with EXACTLY 26.565-degree vertical angle. The ground plane MUST be at precisely 30-degree angles from horizontal (left and right edges). All horizontal lines must be parallel and at 30-degree angles. This is non-negotiable for game asset compatibility.
CRITICAL COMPOSITION: The building must be PERFECTLY CENTERED both horizontally and vertically in the image. The building's center axis must align exactly with the image center. Equal empty space on left and right sides. The building base should be centered at the bottom third of the image.
CRITICAL FRAMING: The ENTIRE building must be fully visible from base to rooftop with NO cropping. Minimize padding - leave only THIN margins (5-10% of image size) on all sides. The building should fill most of the frame while still being completely visible. Scale to maximize size within bounds. Ensure the building and its base do NOT extend beyond the frame or create visual overflow.
CRITICAL BASE REQUIREMENT: The building MUST include a ground-level base/platform/plot that is FLAT and perfectly aligned with the isometric ground plane. The base should occupy 25-35% of the image height and include pavement, plaza tiles, sidewalk, grass patches, small landscaping, or decorative ground details. The base edges must be STRAIGHT and follow the 30-degree isometric angles exactly. Match the base style to building architecture (modern concrete plaza for glass towers, brick pavement for historic buildings, grass/gardens for residential). The base provides the footprint - the building structure should be contained WITHIN the base boundaries.
Technical: Sharp clean render, studio lighting, pure white or light gray solid background, single isolated building with its ground plot, no additional shadows cast outside the asset, no other buildings or objects.
Quality: Ultra high detail, realistic proportions, natural color palette, visible textures (glass, metal, stone, brick, pavement, grass), professional 3D render quality matching game asset standards.`;

      // Generate the building image with smart aspect ratio
      const genResult = await fal.subscribe("fal-ai/nano-banana-pro", {
        input: {
          prompt: fullPrompt,
          num_images: 1,
          aspect_ratio: aspectRatio as AspectRatio,
          output_format: "png" as const,
          resolution: "1K" as const,
        },
      });

      const images = genResult.data?.images;
      if (!images || images.length === 0) {
        return NextResponse.json({ success: false, error: "No image generated" }, { status: 500 });
      }

      const generatedImageUrl = images[0].url;

      // Step 2: Remove background using AI
      const bgRemoveResult = await fal.subscribe("fal-ai/bria/background/remove", {
        input: {
          image_url: generatedImageUrl,
        },
      });

      const bgRemovedImage = bgRemoveResult.data?.image;
      if (!bgRemovedImage || !bgRemovedImage.url) {
        // If background removal fails, return the original image
        console.warn("Background removal failed, returning original image");
        return NextResponse.json({
          success: true,
          imageUrl: generatedImageUrl,
        });
      }

      return NextResponse.json({
        success: true,
        imageUrl: bgRemovedImage.url,
      });
    }

    if (step === "analyze") {
      const { imageUrl } = body;
      
      if (!imageUrl || typeof imageUrl !== 'string') {
        return NextResponse.json({ success: false, error: "Image URL is required" }, { status: 400 });
      }

      const result = await fal.subscribe("openrouter/router/vision", {
        input: {
          image_urls: [imageUrl],
          model: "google/gemini-2.5-flash",
          system_prompt: `You are a game designer analyzing building sprites for a city-building simulation game like SimCity. 
You must respond with ONLY valid JSON - no markdown code blocks, no explanation, just the raw JSON object.`,
          prompt: `Analyze this building sprite and determine its game attributes based on what you see.

Return a JSON object with these exact fields:
{
  "category": "residential" or "commercial" or "industrial" or "service" or "recreation",
  "size": 1 for small single-tile building, 2 for medium 2x2, 3 for large 3x3, 4 for massive 4x4,
  "maxPop": population capacity (0 for non-residential, 5-300 for residential based on apparent size),
  "maxJobs": jobs provided (0 for residential, 10-200 for others based on building size),
  "pollution": -25 to 55 (negative for parks/green spaces, positive for factories, near 0 for offices/homes),
  "landValue": -20 to 80 (how this affects nearby property values),
  "suggestedCost": 100-15000 (construction cost based on size and complexity),
  "suggestedName": "A short 2-4 word name for this building"
}

Analyze based on:
- Visual style and architectural type
- Apparent size, height, and complexity
- Building purpose (housing, shops, factories, parks, etc.)
- Environmental features (smokestacks = pollution, trees/greenery = negative pollution)

IMPORTANT: Return ONLY the JSON object, nothing else.`,
          temperature: 0.2,
        },
      });

      const output = result.data?.output;
      if (!output) {
        return NextResponse.json({ success: false, error: "No analysis output" }, { status: 500 });
      }

      // Try to parse JSON from the response (handle potential markdown code blocks)
      let jsonStr = output.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      try {
        const attributes = JSON.parse(jsonStr) as BuildingAttributes;
        
        // Validate and clamp values
        const validatedAttributes: BuildingAttributes = {
          category: ['residential', 'commercial', 'industrial', 'service', 'recreation'].includes(attributes.category) 
            ? attributes.category 
            : 'commercial',
          size: Math.min(4, Math.max(1, Math.round(attributes.size) || 1)),
          maxPop: Math.max(0, Math.round(attributes.maxPop) || 0),
          maxJobs: Math.max(0, Math.round(attributes.maxJobs) || 0),
          pollution: Math.min(55, Math.max(-25, Math.round(attributes.pollution) || 0)),
          landValue: Math.min(80, Math.max(-20, Math.round(attributes.landValue) || 10)),
          suggestedCost: Math.max(100, Math.round(attributes.suggestedCost) || 500),
          suggestedName: attributes.suggestedName || 'Custom Building',
        };

        return NextResponse.json({ success: true, attributes: validatedAttributes });
      } catch (parseError) {
        console.error('Failed to parse LLM response:', output);
        return NextResponse.json({ 
          success: false, 
          error: "Failed to parse building attributes from AI response",
          raw: output 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ success: false, error: "Invalid step. Use 'get-aspect-ratio', 'generate', or 'analyze'" }, { status: 400 });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }, { status: 500 });
  }
}
