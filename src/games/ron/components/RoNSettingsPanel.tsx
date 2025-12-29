/**
 * Rise of Nations - Settings Panel
 * 
 * Settings menu with a debug sprite viewer to display all building sprites
 * from all ages for visual inspection and debugging.
 */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CloseIcon } from '@/components/ui/Icons';
import { AGE_ORDER, Age, AGE_INFO } from '../types/ages';
import { AGE_SPRITE_PACKS } from '../lib/renderConfig';
import { loadSpriteImage, getCachedImage } from '@/components/game/shared';

interface RoNSettingsPanelProps {
  onClose: () => void;
}

export function RoNSettingsPanel({ onClose }: RoNSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'sprites' | 'settings'>('sprites');
  const [loadedAges, setLoadedAges] = useState<Set<Age>>(new Set());
  const canvasRefs = useRef<Map<Age, HTMLCanvasElement>>(new Map());
  
  // Load all age sprite sheets
  useEffect(() => {
    const loadAllSprites = async () => {
      for (const age of AGE_ORDER) {
        const pack = AGE_SPRITE_PACKS[age];
        try {
          await loadSpriteImage(pack.src, true);
          setLoadedAges(prev => new Set([...prev, age]));
        } catch (error) {
          console.error(`Failed to load ${age} sprites:`, error);
        }
      }
    };
    loadAllSprites();
  }, []);
  
  // Render sprites to canvases when loaded
  useEffect(() => {
    loadedAges.forEach(age => {
      const canvas = canvasRefs.current.get(age);
      if (!canvas) return;
      
      const pack = AGE_SPRITE_PACKS[age];
      const sprite = getCachedImage(pack.src, true);
      if (!sprite) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Set canvas size to fit the sprite sheet
      const tileWidth = sprite.width / pack.cols;
      const tileHeight = sprite.height / pack.rows;
      const displayScale = 1.5;
      const padding = 4;
      const labelHeight = 20;
      
      canvas.width = (tileWidth * displayScale + padding) * pack.cols + padding;
      canvas.height = (tileHeight * displayScale + padding + labelHeight) * pack.rows + padding;
      
      // Clear canvas
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw each sprite with labels
      for (let row = 0; row < pack.rows; row++) {
        for (let col = 0; col < pack.cols; col++) {
          const sx = col * tileWidth;
          const sy = row * tileHeight;
          
          const dx = padding + col * (tileWidth * displayScale + padding);
          const dy = padding + row * (tileHeight * displayScale + padding + labelHeight);
          
          // Draw sprite
          ctx.drawImage(
            sprite,
            sx, sy, tileWidth, tileHeight,
            dx, dy + labelHeight, tileWidth * displayScale, tileHeight * displayScale
          );
          
          // Draw label
          ctx.fillStyle = '#9ca3af';
          ctx.font = '10px monospace';
          ctx.fillText(`R${row}C${col}`, dx + 2, dy + 12);
          
          // Draw border
          ctx.strokeStyle = '#374151';
          ctx.strokeRect(dx, dy + labelHeight, tileWidth * displayScale, tileHeight * displayScale);
        }
      }
    });
  }, [loadedAges]);
  
  const setCanvasRef = (age: Age) => (el: HTMLCanvasElement | null) => {
    if (el) {
      canvasRefs.current.set(age, el);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[80vh] flex flex-col">
        <CardHeader className="pb-2 flex flex-row items-center justify-between border-b">
          <CardTitle className="text-lg">Settings</CardTitle>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <CloseIcon size={16} />
          </Button>
        </CardHeader>
        
        <div className="flex border-b">
          <Button
            variant={activeTab === 'sprites' ? 'default' : 'ghost'}
            className="rounded-none"
            onClick={() => setActiveTab('sprites')}
          >
            Sprite Debug
          </Button>
          <Button
            variant={activeTab === 'settings' ? 'default' : 'ghost'}
            className="rounded-none"
            onClick={() => setActiveTab('settings')}
          >
            Game Settings
          </Button>
        </div>
        
        <CardContent className="flex-1 overflow-hidden p-0">
          {activeTab === 'sprites' && (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                <p className="text-sm text-muted-foreground">
                  All building sprites from each age. Format: R(row)C(col). 
                  Use this to identify sprite positions for building mappings.
                </p>
                
                {AGE_ORDER.map(age => {
                  const pack = AGE_SPRITE_PACKS[age];
                  const ageInfo = AGE_INFO[age];
                  const isLoaded = loadedAges.has(age);
                  
                  return (
                    <div key={age} className="space-y-2">
                      <h3 className="text-sm font-bold" style={{ color: ageInfo.color }}>
                        {ageInfo.name} ({pack.src})
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {pack.cols} columns × {pack.rows} rows
                      </p>
                      
                      {isLoaded ? (
                        <div className="overflow-x-auto border rounded bg-slate-900 p-2">
                          <canvas
                            ref={setCanvasRef(age)}
                            className="block"
                          />
                        </div>
                      ) : (
                        <div className="h-32 flex items-center justify-center border rounded bg-slate-900">
                          <span className="text-muted-foreground">Loading...</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          
          {activeTab === 'settings' && (
            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Game settings will appear here.
              </p>
              
              {/* Placeholder for future settings */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold">Audio</h3>
                <p className="text-xs text-muted-foreground">Coming soon...</p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-bold">Graphics</h3>
                <p className="text-xs text-muted-foreground">Coming soon...</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
