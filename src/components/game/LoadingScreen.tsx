'use client';

import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { SPRITE_PACKS, DEFAULT_SPRITE_PACK_ID } from '@/lib/renderConfig';

export const LoadingScreen = ({ onFinished }: { onFinished: () => void }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    let mounted = true;
    const updateProgress = (val: number) => {
      if (mounted) setProgress(val);
    };

    const loadAssets = async () => {
      try {
        // 1. Wait for Fonts
        if (mounted) setStatus('Loading fonts...');
        try {
          await document.fonts.ready;
        } catch (e) {
          console.warn('Font loading skipped', e);
        }
        updateProgress(30);

        // 2. Preload Main Sprite Sheets
        if (mounted) setStatus('Loading assets...');
        
        const pack = SPRITE_PACKS.find(p => p.id === DEFAULT_SPRITE_PACK_ID) || SPRITE_PACKS[0];
        const imagesToLoad = [
          pack.src,
          pack.parksSrc,
          pack.constructionSrc,
        ].filter(Boolean) as string[];

        const loadImage = (src: string) => new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = resolve;
            img.onerror = () => {
                console.warn(`Failed to load asset: ${src}`);
                resolve(null); // Continue even if one fails
            };
        });

        // Use a timeout to ensure we don't hang forever
        const assetLoadingPromise = Promise.all(imagesToLoad.map(loadImage));
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000)); // Max 3s for assets
        
        await Promise.race([assetLoadingPromise, timeoutPromise]);
        
        updateProgress(70);

        // 3. Initialize Simulation
        if (mounted) setStatus('Initializing simulation...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UX

        updateProgress(100);
        
        // Finalize
        if (mounted) setStatus('Ready!');
        setTimeout(() => {
          if (mounted) {
            onFinished();
          }
        }, 200);

      } catch (error) {
        console.error("Loading error:", error);
        // Force finish on error so user isn't stuck
        if (mounted) onFinished();
      }
    };

    loadAssets();

    return () => {
      mounted = false;
    };
  }, [onFinished]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f1219] flex flex-col items-center justify-center text-white">
      <div className="w-96 flex flex-col gap-4">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold font-display tracking-wider text-blue-400 drop-shadow-lg">
            TRUNCGIL MYCITY
          </h1>
          <p className="text-slate-400 text-sm animate-pulse">{status}</p>
        </div>
        
        <div className="relative">
          <Progress value={progress} className="h-4 bg-slate-800 border border-slate-700" indicatorClassName="bg-blue-500 transition-all duration-300" />
        </div>
        
        <div className="flex justify-between text-xs text-slate-500 font-mono">
          <span>v1.0.0</span>
          <span>{progress}%</span>
        </div>
      </div>
    </div>
  );
};
