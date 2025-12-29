'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { SPRITE_PACKS, DEFAULT_SPRITE_PACK_ID } from '@/lib/renderConfig';
import { AIRPLANE_SPRITE_SRC, WATER_ASSET_PATH } from '@/components/game/constants';

export const LoadingScreen = ({ onFinished }: { onFinished: () => void }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing...');
  const onFinishedRef = useRef(onFinished);

  // Update ref if prop changes, to avoid restarting the effect
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    console.log('Loading process started');
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
          // Optional: Check if Material Symbols is ready
          // const isLoaded = document.fonts.check('20px "Material Symbols Rounded"');
          console.log('Fonts loaded');
        } catch (e) {
          console.warn('Font loading skipped or failed', e);
        }
        updateProgress(20);

        // 2. Collect all assets to load
        if (mounted) setStatus('Loading assets...');
        
        // Get the default sprite pack
        const defaultPack = SPRITE_PACKS.find(p => p.id === DEFAULT_SPRITE_PACK_ID) || SPRITE_PACKS[0];
        
        const assetsToLoad = [
            '/truncgil-mycity-icon.png',
            '/truncgil-mycity3.png',
            AIRPLANE_SPRITE_SRC,
            WATER_ASSET_PATH,
            defaultPack.src,
            defaultPack.constructionSrc,
            defaultPack.abandonedSrc,
            defaultPack.denseSrc,
            defaultPack.modernSrc,
            defaultPack.parksSrc,
            defaultPack.parksConstructionSrc,
            defaultPack.farmsSrc,
            defaultPack.shopsSrc,
            defaultPack.stationsSrc
        ].filter(Boolean) as string[]; // Remove undefined values

        const totalAssets = assetsToLoad.length;
        let loadedCount = 0;

        const loadImage = (src: string) => new Promise((resolve) => {
            const img = new window.Image();
            img.src = src;
            img.onload = () => {
                loadedCount++;
                const percent = 20 + Math.floor((loadedCount / totalAssets) * 60); // 20% to 80%
                updateProgress(percent);
                console.log(`Loaded asset: ${src}`);
                resolve(true);
            };
            img.onerror = () => {
                console.warn(`Failed to load asset: ${src}`);
                loadedCount++; // Count as handled even if failed
                const percent = 20 + Math.floor((loadedCount / totalAssets) * 60);
                updateProgress(percent);
                resolve(null); 
            };
        });

        // Load all images in parallel
        await Promise.all(assetsToLoad.map(loadImage));
        
        console.log('Assets phase finished');
        updateProgress(80);

        // 3. Initialize Simulation
        if (mounted) setStatus('Initializing simulation...');
        await new Promise(resolve => setTimeout(resolve, 800)); // Brief pause for UX and CSS/JS parsing
        console.log('Simulation init wait finished');

        updateProgress(100);
        
        // Finalize
        if (mounted) setStatus('Ready!');
        setTimeout(() => {
          if (mounted) {
            console.log('Calling onFinished');
            onFinishedRef.current();
          }
        }, 200);

      } catch (error) {
        console.error("Loading error:", error);
        // Force finish on error so user isn't stuck
        if (mounted) onFinishedRef.current();
      }
    };

    // Tiny polyfill for FontFaceObserver if not available
    // or just rely on document.fonts.ready which is modern
    loadAssets();

    return () => {
      console.log('LoadingScreen cleanup');
      mounted = false;
    };
  }, []); // Empty dependency array to run only once

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-lime-400 via-green-500 to-emerald-600 flex flex-col items-center justify-center text-white">
      <div className="w-96 flex flex-col gap-8 items-center">
        <div className="relative w-full h-32 animate-float">
          <Image
            src="/truncgil-mycity3.png"
            alt="Truncgil MyCity"
            fill
            className="object-contain drop-shadow-lg"
            priority
          />
        </div>
        
        <div className="w-full space-y-2">
          <div className="text-center">
            <p className="text-white/80 text-sm font-medium animate-pulse">{status}</p>
          </div>
          
          <div className="relative px-2">
            <Progress 
              value={progress} 
              className="h-3 bg-black/40 border border-white/20 backdrop-blur-md rounded-full shadow-inner overflow-hidden" 
              indicatorClassName="bg-gradient-to-r from-sky-400 to-blue-500 shadow-[0_0_15px_rgba(56,189,248,0.6)] transition-all duration-300" 
            />
          </div>
          
          <div className="flex justify-between text-xs text-white/60 font-mono font-medium">
            <span>v1.0.0</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
