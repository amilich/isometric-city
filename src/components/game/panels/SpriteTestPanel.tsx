'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSpriteCoords } from '@/lib/renderConfig';

export function SpriteTestPanel({ onClose }: { onClose: () => void }) {
  const { currentSpritePack } = useGame();
  const [selectedTab, setSelectedTab] = useState<string>('main');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spriteSheets, setSpriteSheets] = useState<Record<string, HTMLImageElement | null>>({
    main: null,
    construction: null,
    abandoned: null,
    dense: null,
    modern: null,
    parks: null,
    parksConstruction: null,
    services: null,
    infrastructure: null,
  });
  
  // Load all sprite sheets from current pack
  useEffect(() => {
    const loadSheet = (src: string | undefined, key: string): Promise<void> => {
      if (!src) {
        setSpriteSheets(prev => ({ ...prev, [key]: null }));
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          setSpriteSheets(prev => ({ ...prev, [key]: img }));
          resolve();
        };
        img.onerror = () => {
          setSpriteSheets(prev => ({ ...prev, [key]: null }));
          resolve();
        };
        img.src = src;
      });
    };
    
    Promise.all([
      loadSheet(currentSpritePack.src, 'main'),
      loadSheet(currentSpritePack.constructionSrc, 'construction'),
      loadSheet(currentSpritePack.abandonedSrc, 'abandoned'),
      loadSheet(currentSpritePack.denseSrc, 'dense'),
      loadSheet(currentSpritePack.modernSrc, 'modern'),
      loadSheet(currentSpritePack.parksSrc, 'parks'),
      loadSheet(currentSpritePack.parksConstructionSrc, 'parksConstruction'),
      loadSheet(currentSpritePack.servicesSrc, 'services'),
      loadSheet(currentSpritePack.infrastructureSrc, 'infrastructure'),
    ]);
  }, [currentSpritePack]);
  
  const availableTabs = useMemo(() => [
    { id: 'main', label: 'Main', available: !!spriteSheets.main },
    { id: 'construction', label: 'Construction', available: !!spriteSheets.construction },
    { id: 'abandoned', label: 'Abandoned', available: !!spriteSheets.abandoned },
    { id: 'dense', label: 'High Density', available: !!spriteSheets.dense },
    { id: 'modern', label: 'Modern', available: !!spriteSheets.modern },
    { id: 'parks', label: 'Parks', available: !!spriteSheets.parks },
    { id: 'parksConstruction', label: 'Parks Construction', available: !!spriteSheets.parksConstruction },
    { id: 'services', label: 'Services', available: !!spriteSheets.services },
    { id: 'infrastructure', label: 'Infrastructure', available: !!spriteSheets.infrastructure },
  ].filter(tab => tab.available), [spriteSheets]);
  
  // Derive the actual active tab - fall back to first available if selected is not available
  const activeTab = useMemo(() => {
    if (availableTabs.length > 0 && !availableTabs.find(t => t.id === selectedTab)) {
      return availableTabs[0].id;
    }
    return selectedTab;
  }, [availableTabs, selectedTab]);
  
  // Draw sprite test grid
  useEffect(() => {
    const canvas = canvasRef.current;
    const spriteSheet = spriteSheets[activeTab];
    if (!canvas || !spriteSheet) return;
    
    const ctx = canvas.getContext('2d', { 
      willReadFrequently: false,
      alpha: true 
    });
    if (!ctx) return;
    
    // High-DPI rendering for crisp quality
    const dpr = window.devicePixelRatio || 1;
    
    // Improve image rendering quality for pixel art
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = 'high';
    
    const tileW = 64;
    const tileH = tileW * 0.6;
    const padding = 30;
    const labelHeight = 20;
    const cols = 5;
    
    let itemsToRender: Array<{ label: string; coords: { sx: number; sy: number; sw: number; sh: number }; index?: number }> = [];
    let sheetWidth = spriteSheet.naturalWidth || spriteSheet.width;
    let sheetHeight = spriteSheet.naturalHeight || spriteSheet.height;
    let sheetCols = currentSpritePack.cols;
    let sheetRows = currentSpritePack.rows;
    
    if (activeTab === 'main') {
      // Main sprite sheet - use spriteOrder
      currentSpritePack.spriteOrder.forEach((spriteKey, index) => {
        const buildingType = Object.entries(currentSpritePack.buildingToSprite).find(
          ([, value]) => value === spriteKey
        )?.[0] || spriteKey;
        const coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight, currentSpritePack);
        if (coords) {
          itemsToRender.push({ label: spriteKey, coords, index });
        }
      });
    } else if (activeTab === 'construction' && currentSpritePack.constructionSrc) {
      // Construction sprite sheet - same layout as main
      currentSpritePack.spriteOrder.forEach((spriteKey, index) => {
        const buildingType = Object.entries(currentSpritePack.buildingToSprite).find(
          ([, value]) => value === spriteKey
        )?.[0] || spriteKey;
        const coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight, currentSpritePack);
        if (coords) {
          itemsToRender.push({ label: `${spriteKey} (construction)`, coords, index });
        }
      });
    } else if (activeTab === 'abandoned' && currentSpritePack.abandonedSrc) {
      // Abandoned sprite sheet - same layout as main
      currentSpritePack.spriteOrder.forEach((spriteKey, index) => {
        const buildingType = Object.entries(currentSpritePack.buildingToSprite).find(
          ([, value]) => value === spriteKey
        )?.[0] || spriteKey;
        const coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight, currentSpritePack);
        if (coords) {
          itemsToRender.push({ label: `${spriteKey} (abandoned)`, coords, index });
        }
      });
    } else if (activeTab === 'dense' && currentSpritePack.denseSrc && currentSpritePack.denseVariants) {
      // Dense sprite sheet - use denseVariants mapping
      sheetCols = currentSpritePack.cols;
      sheetRows = currentSpritePack.rows;
      const tileWidth = Math.floor(sheetWidth / sheetCols);
      const tileHeight = Math.floor(sheetHeight / sheetRows);
      
      Object.entries(currentSpritePack.denseVariants).forEach(([buildingType, variants]) => {
        variants.forEach((variant, variantIndex) => {
          const sx = variant.col * tileWidth;
          const sy = variant.row * tileHeight;
          itemsToRender.push({
            label: `${buildingType} (dense ${variantIndex + 1})`,
            coords: { sx, sy, sw: tileWidth, sh: tileHeight },
          });
        });
      });
    } else if (activeTab === 'modern' && currentSpritePack.modernSrc && currentSpritePack.modernVariants) {
      // Modern sprite sheet - use modernVariants mapping (same layout as dense)
      sheetCols = currentSpritePack.cols;
      sheetRows = currentSpritePack.rows;
      const tileWidth = Math.floor(sheetWidth / sheetCols);
      const tileHeight = Math.floor(sheetHeight / sheetRows);
      
      Object.entries(currentSpritePack.modernVariants).forEach(([buildingType, variants]) => {
        variants.forEach((variant, variantIndex) => {
          const sx = variant.col * tileWidth;
          const sy = variant.row * tileHeight;
          itemsToRender.push({
            label: `${buildingType} (modern ${variantIndex + 1})`,
            coords: { sx, sy, sw: tileWidth, sh: tileHeight },
          });
        });
      });
    } else if (activeTab === 'parks' && currentSpritePack.parksSrc && currentSpritePack.parksBuildings) {
      // Parks sprite sheet - use parksBuildings mapping
      sheetCols = currentSpritePack.parksCols || currentSpritePack.cols;
      sheetRows = currentSpritePack.parksRows || currentSpritePack.rows;
      const tileWidth = Math.floor(sheetWidth / sheetCols);
      const tileHeight = Math.floor(sheetHeight / sheetRows);
      
      Object.entries(currentSpritePack.parksBuildings).forEach(([buildingType, pos]) => {
        const sx = pos.col * tileWidth;
        const sy = pos.row * tileHeight;
        itemsToRender.push({
          label: buildingType,
          coords: { sx, sy, sw: tileWidth, sh: tileHeight },
        });
      });
    } else if (activeTab === 'parksConstruction' && currentSpritePack.parksConstructionSrc && currentSpritePack.parksBuildings) {
      // Parks construction sprite sheet - same layout as parks
      sheetCols = currentSpritePack.parksCols || currentSpritePack.cols;
      sheetRows = currentSpritePack.parksRows || currentSpritePack.rows;
      const tileWidth = Math.floor(sheetWidth / sheetCols);
      const tileHeight = Math.floor(sheetHeight / sheetRows);
      
      Object.entries(currentSpritePack.parksBuildings).forEach(([buildingType, pos]) => {
        const sx = pos.col * tileWidth;
        const sy = pos.row * tileHeight;
        itemsToRender.push({
          label: `${buildingType} (construction)`,
          coords: { sx, sy, sw: tileWidth, sh: tileHeight },
        });
      });
    } else if (activeTab === 'services' && currentSpritePack.servicesSrc && currentSpritePack.servicesVariants) {
      // Services sprite sheet - use servicesVariants mapping (level progression)
      sheetCols = currentSpritePack.servicesCols || currentSpritePack.cols;
      sheetRows = currentSpritePack.servicesRows || currentSpritePack.rows;
      const tileWidth = Math.floor(sheetWidth / sheetCols);
      const tileHeight = Math.floor(sheetHeight / sheetRows);
      
      Object.entries(currentSpritePack.servicesVariants).forEach(([buildingType, variants]) => {
        variants.forEach((variant, variantIndex) => {
          const sx = variant.col * tileWidth;
          const sy = variant.row * tileHeight;
          itemsToRender.push({
            label: `${buildingType} (level ${variantIndex + 1})`,
            coords: { sx, sy, sw: tileWidth, sh: tileHeight },
          });
        });
      });
    } else if (activeTab === 'infrastructure' && currentSpritePack.infrastructureSrc && currentSpritePack.infrastructureVariants) {
      // Infrastructure sprite sheet - use infrastructureVariants mapping (level progression)
      sheetCols = currentSpritePack.infrastructureCols || 5;
      sheetRows = currentSpritePack.infrastructureRows || 6;
      const tileWidth = Math.floor(sheetWidth / sheetCols);
      const tileHeight = Math.floor(sheetHeight / sheetRows);
      
      Object.entries(currentSpritePack.infrastructureVariants).forEach(([buildingType, variants]) => {
        variants.forEach((variant, variantIndex) => {
          const sx = variant.col * tileWidth;
          const sy = variant.row * tileHeight;
          itemsToRender.push({
            label: `${buildingType} (level ${variantIndex + 1})`,
            coords: { sx, sy, sw: tileWidth, sh: tileHeight },
          });
        });
      });
    }
    
    const rows = Math.ceil(itemsToRender.length / cols);
    const canvasWidth = cols * tileW * 2 + padding * 2;
    const canvasHeight = rows * (tileH * 3 + labelHeight) + padding * 2;
    
    // Set actual size in memory (scaled for device pixel ratio)
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    
    // Scale the canvas back down using CSS
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    
    // Scale the drawing context so everything draws at the correct size
    ctx.scale(dpr, dpr);
    
    // Clear with dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw grid and sprites
    itemsToRender.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      // Calculate isometric position for this grid cell
      const baseX = padding + tileW + col * tileW * 1.5;
      const baseY = padding + tileH + row * (tileH * 3 + labelHeight);
      
      // Draw isometric tile outline (diamond shape)
      ctx.strokeStyle = '#3d3d5c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY - tileH / 2);
      ctx.lineTo(baseX + tileW / 2, baseY);
      ctx.lineTo(baseX, baseY + tileH / 2);
      ctx.lineTo(baseX - tileW / 2, baseY);
      ctx.closePath();
      ctx.stroke();
      
      // Fill with slight color
      ctx.fillStyle = '#2a2a4a';
      ctx.fill();
      
      // Calculate destination size preserving aspect ratio
      const destWidth = tileW * 1.2;
      const aspectRatio = item.coords.sh / item.coords.sw;
      const destHeight = destWidth * aspectRatio;
      
      // Position: center on tile
      const drawX = baseX - destWidth / 2;
      const drawY = baseY + tileH / 2 - destHeight + destHeight * 0.15;
      
      // Draw sprite
      ctx.drawImage(
        spriteSheet,
        item.coords.sx, item.coords.sy, item.coords.sw, item.coords.sh,
        Math.round(drawX), Math.round(drawY),
        Math.round(destWidth), Math.round(destHeight)
      );
      
      // Draw label
      ctx.fillStyle = '#888';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      const labelLines = item.label.split(' ');
      labelLines.forEach((line, i) => {
        ctx.fillText(line, baseX, baseY + tileH + 16 + i * 10);
      });
      
      // Draw index if available
      if (item.index !== undefined) {
        ctx.fillStyle = '#666';
        ctx.font = '8px monospace';
        ctx.fillText(`[${item.index}]`, baseX, baseY + tileH + 26 + labelLines.length * 10);
      }
    });
  }, [spriteSheets, activeTab, currentSpritePack]);
  
  const currentSheetInfo = activeTab === 'main' ? currentSpritePack.src :
                          activeTab === 'construction' ? currentSpritePack.constructionSrc :
                          activeTab === 'abandoned' ? currentSpritePack.abandonedSrc :
                          activeTab === 'dense' ? currentSpritePack.denseSrc :
                          activeTab === 'modern' ? currentSpritePack.modernSrc :
                          activeTab === 'parksConstruction' ? currentSpritePack.parksConstructionSrc :
                          activeTab === 'services' ? currentSpritePack.servicesSrc :
                          activeTab === 'infrastructure' ? currentSpritePack.infrastructureSrc :
                          currentSpritePack.parksSrc;
  
  const gridInfo = (activeTab === 'parks' || activeTab === 'parksConstruction') && currentSpritePack.parksCols && currentSpritePack.parksRows
    ? `${currentSpritePack.parksCols}x${currentSpritePack.parksRows}`
    : activeTab === 'services' && currentSpritePack.servicesCols && currentSpritePack.servicesRows
    ? `${currentSpritePack.servicesCols}x${currentSpritePack.servicesRows}`
    : activeTab === 'infrastructure' && currentSpritePack.infrastructureCols && currentSpritePack.infrastructureRows
    ? `${currentSpritePack.infrastructureCols}x${currentSpritePack.infrastructureRows}`
    : `${currentSpritePack.cols}x${currentSpritePack.rows}`;
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[900px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Sprite Test View</DialogTitle>
          <DialogDescription>
            View all sprite variants from &quot;{currentSpritePack.name}&quot;
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="flex flex-wrap gap-1 w-full">
            {availableTabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="flex-shrink-0 text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        
        <div className="overflow-auto max-h-[70vh] bg-[#1a1a2e] rounded-lg">
          <canvas
            ref={canvasRef}
            className="mx-auto"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
        
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Sprite sheet: {currentSheetInfo} ({gridInfo} grid)</p>
          <p>Edit offsets in <code className="px-1 rounded bg-muted">src/lib/renderConfig.ts</code> → each sprite pack&apos;s verticalOffsets</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
