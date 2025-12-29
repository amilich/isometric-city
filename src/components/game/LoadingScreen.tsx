'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';

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
          console.log('Fonts loaded');
        } catch (e) {
          console.warn('Font loading skipped', e);
        }
        updateProgress(30);

        // 2. Preload Main Sprite Sheets
        if (mounted) setStatus('Loading assets...');
        
        const imagesToLoad = [
          '/truncgil-mycity-icon.png',
          // Add other critical assets here if needed
        ].filter(Boolean) as string[];

        const loadImage = (src: string) => new Promise((resolve) => {
            const img = new window.Image();
            img.src = src;
            img.onload = () => {
                console.log(`Loaded asset: ${src}`);
                resolve(true);
            };
            img.onerror = () => {
                console.warn(`Failed to load asset: ${src}`);
                resolve(null); // Continue even if one fails
            };
        });

        // Use a timeout to ensure we don't hang forever
        const assetLoadingPromise = Promise.all(imagesToLoad.map(loadImage));
        const timeoutPromise = new Promise(resolve => setTimeout(() => {
            console.log('Asset loading timed out');
            resolve(false);
        }, 3000)); // Max 3s for assets
        
        await Promise.race([assetLoadingPromise, timeoutPromise]);
        
        console.log('Assets phase finished');
        updateProgress(70);

        // 3. Initialize Simulation
        if (mounted) setStatus('Initializing simulation...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UX
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
          
          <div className="relative">
            <Progress value={progress} className="h-4 bg-black/20 border border-white/20 backdrop-blur-sm" indicatorClassName="bg-white transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
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
