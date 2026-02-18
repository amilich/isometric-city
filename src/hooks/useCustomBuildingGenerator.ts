'use client';

import { useState, useCallback } from 'react';

export type GenerationStep = 'idle' | 'generating' | 'complete' | 'error';

export interface BuildingAttributes {
  category: 'residential' | 'commercial' | 'industrial' | 'service' | 'recreation';
  size: 1 | 2 | 3 | 4;
  maxPop: number;
  maxJobs: number;
  pollution: number;
  landValue: number;
  suggestedCost: number;
  suggestedName: string;
}

export interface CustomBuildingResult {
  imageUrl: string;
  prompt: string;
  attributes: BuildingAttributes;
}

export interface UseCustomBuildingGeneratorReturn {
  step: GenerationStep;
  result: CustomBuildingResult | null;
  error: string | null;
  generate: (prompt: string) => Promise<void>;
  reset: () => void;
}

export function useCustomBuildingGenerator(): UseCustomBuildingGeneratorReturn {
  const [step, setStep] = useState<GenerationStep>('idle');
  const [result, setResult] = useState<CustomBuildingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (prompt: string) => {
    if (!prompt.trim()) {
      setError('Please enter a building description');
      setStep('error');
      return;
    }

    setStep('generating');
    setError(null);
    setResult(null);

    try {
      // Step 1: Determine optimal aspect ratio based on building description
      const aspectResponse = await fetch('/api/generate-building', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), step: 'get-aspect-ratio' }),
      });
      
      if (!aspectResponse.ok) {
        const errorData = await aspectResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Aspect ratio selection failed (${aspectResponse.status})`);
      }
      
      const aspectData = await aspectResponse.json();
      const aspectRatio = aspectData.aspectRatio || "4:5"; // Fallback to 4:5
      
      // Step 2: Generate the building sprite image with optimal aspect ratio
      const genResponse = await fetch('/api/generate-building', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), aspectRatio, step: 'generate' }),
      });
      
      if (!genResponse.ok) {
        const errorData = await genResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Image generation failed (${genResponse.status})`);
      }
      
      const genData = await genResponse.json();
      
      if (!genData.success || !genData.imageUrl) {
        throw new Error(genData.error || 'Image generation failed - no image URL returned');
      }

      const imageUrl = genData.imageUrl;
      // Keep showing "generating" spinner while we analyze and preload

      // Step 3: Analyze the generated image with vision LLM (still in "generating" state)
      const analyzeResponse = await fetch('/api/generate-building', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, step: 'analyze' }),
      });

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed (${analyzeResponse.status})`);
      }

      const analyzeData = await analyzeResponse.json();

      if (!analyzeData.success || !analyzeData.attributes) {
        throw new Error(analyzeData.error || 'Analysis failed - no attributes returned');
      }

      // Preload the image before showing the final UI to avoid visual gaps
      // (still in "generating" state)
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Required for external fal.ai CDN URLs
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load generated image'));
        img.src = imageUrl;
      });

      // Success! Set the result after image is loaded
      setResult({
        imageUrl,
        prompt: prompt.trim(),
        attributes: analyzeData.attributes as BuildingAttributes,
      });
      setStep('complete');
    } catch (err) {
      console.error('Building generation error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setStep('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStep('idle');
    setResult(null);
    setError(null);
  }, []);

  return { step, result, error, generate, reset };
}
