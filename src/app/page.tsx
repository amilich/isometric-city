'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { GameProvider, useGame } from '@/context/GameContext';
import Game from '@/components/Game';
import { LocationSelector } from '@/components/LocationSelector';
import { useMobile } from '@/hooks/useMobile';
import { getSpritePack, getSpriteCoords, DEFAULT_SPRITE_PACK_ID } from '@/lib/renderConfig';
import { SavedCityMeta } from '@/types/game';

const STORAGE_KEY = 'isocity-game-state';
const SAVED_CITIES_INDEX_KEY = 'isocity-saved-cities-index';

// Background color to filter from sprite sheets (red)
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
const COLOR_THRESHOLD = 155;

// Filter red background from sprite sheet
function filterBackgroundColor(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const distance = Math.sqrt(
      Math.pow(r - BACKGROUND_COLOR.r, 2) +
      Math.pow(g - BACKGROUND_COLOR.g, 2) +
      Math.pow(b - BACKGROUND_COLOR.b, 2)
    );
    
    if (distance <= COLOR_THRESHOLD) {
      data[i + 3] = 0; // Make transparent
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Check if there's a saved game in localStorage
function hasSavedGame(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.grid && parsed.gridSize && parsed.stats;
    }
  } catch {
    return false;
  }
  return false;
}

// Load saved cities index from localStorage
function loadSavedCities(): SavedCityMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SAVED_CITIES_INDEX_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed as SavedCityMeta[];
      }
    }
  } catch {
    return [];
  }
  return [];
}

// Sprite Gallery component that renders sprites using canvas (like SpriteTestPanel)
function SpriteGallery({ count = 16, cols = 4, cellSize = 120 }: { count?: number; cols?: number; cellSize?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [filteredSheet, setFilteredSheet] = useState<HTMLCanvasElement | null>(null);
  const spritePack = useMemo(() => getSpritePack(DEFAULT_SPRITE_PACK_ID), []);
  
  // Get random sprite keys from the sprite order, pre-validated to have valid coords
  const randomSpriteKeys = useMemo(() => {
    // Filter to only sprites that have valid building type mappings
    const validSpriteKeys = spritePack.spriteOrder.filter(spriteKey => {
      // Check if this sprite key has a building type mapping
      const hasBuildingMapping = Object.values(spritePack.buildingToSprite).includes(spriteKey);
      return hasBuildingMapping;
    });
    const shuffled = shuffleArray([...validSpriteKeys]);
    return shuffled.slice(0, count);
  }, [spritePack.spriteOrder, spritePack.buildingToSprite, count]);
  
  // Load and filter sprite sheet
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const filtered = filterBackgroundColor(img);
      setFilteredSheet(filtered);
    };
    img.src = spritePack.src;
  }, [spritePack.src]);
  
  // Pre-compute sprite data with valid coords
  const spriteData = useMemo(() => {
    if (!filteredSheet) return [];
    
    const sheetWidth = filteredSheet.width;
    const sheetHeight = filteredSheet.height;
    
    return randomSpriteKeys.map(spriteKey => {
      const buildingType = Object.entries(spritePack.buildingToSprite).find(
        ([, value]) => value === spriteKey
      )?.[0] || spriteKey;
      
      const coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight, spritePack);
      return coords ? { spriteKey, coords } : null;
    }).filter((item): item is { spriteKey: string; coords: { sx: number; sy: number; sw: number; sh: number } } => item !== null);
  }, [filteredSheet, randomSpriteKeys, spritePack]);
  
  // Draw sprites to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !filteredSheet || spriteData.length === 0) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rows = Math.ceil(spriteData.length / cols);
    const padding = 10;
    
    const canvasWidth = cols * cellSize;
    const canvasHeight = rows * cellSize;
    
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    
    // Clear canvas (transparent)
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw each sprite
    spriteData.forEach(({ coords }, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const cellX = col * cellSize;
      const cellY = row * cellSize;
      
      // Draw cell background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cellX + 2, cellY + 2, cellSize - 4, cellSize - 4, 4);
      ctx.fill();
      ctx.stroke();
      
      // Calculate destination size preserving aspect ratio
      const maxSize = cellSize - padding * 2;
      const aspectRatio = coords.sh / coords.sw;
      let destWidth = maxSize;
      let destHeight = destWidth * aspectRatio;
      
      if (destHeight > maxSize) {
        destHeight = maxSize;
        destWidth = destHeight / aspectRatio;
      }
      
      // Center sprite in cell
      const drawX = cellX + (cellSize - destWidth) / 2;
      const drawY = cellY + (cellSize - destHeight) / 2 + destHeight * 0.1; // Slight offset down
      
      // Draw sprite
      ctx.drawImage(
        filteredSheet,
        coords.sx, coords.sy, coords.sw, coords.sh,
        Math.round(drawX), Math.round(drawY),
        Math.round(destWidth), Math.round(destHeight)
      );
    });
  }, [filteredSheet, spriteData, cols, cellSize]);
  
  return (
    <canvas
      ref={canvasRef}
      className="opacity-80 hover:opacity-100 transition-opacity"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// Saved City Card Component
function SavedCityCard({ city, onLoad }: { city: SavedCityMeta; onLoad: () => void }) {
  return (
    <button
      onClick={onLoad}
      className="w-full text-left p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-none transition-all duration-200 group"
    >
      <h3 className="text-white font-medium truncate group-hover:text-white/90 text-sm">
        {city.cityName}
      </h3>
      <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
        <span>Pop: {city.population.toLocaleString()}</span>
        <span>${city.money.toLocaleString()}</span>
      </div>
    </button>
  );
}

const SAVED_CITY_PREFIX = 'isocity-city-';

function HomePageContent() {
  const [showGame, setShowGame] = useState(false);
  const [savedCities, setSavedCities] = useState<SavedCityMeta[]>([]);
  const [hasSave, setHasSave] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startingLabel, setStartingLabel] = useState<string | null>(null);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;
  const { newGame, newGameFromEarth } = useGame();

  // Check for saved game after mount (client-side only)
  useEffect(() => {
    const checkSavedGame = () => {
      setSavedCities(loadSavedCities());
      setHasSave(hasSavedGame());
    };
    // Use requestAnimationFrame to avoid synchronous setState in effect
    requestAnimationFrame(checkSavedGame);
  }, []);

  const handleContinue = () => {
    setShowGame(true);
  };

  // Handle exit from game - refresh saved cities list
  const handleExitGame = () => {
    setShowGame(false);
    setSavedCities(loadSavedCities());
  };

  // Load a saved city
  const loadSavedCity = (cityId: string) => {
    try {
      const saved = localStorage.getItem(SAVED_CITY_PREFIX + cityId);
      if (saved) {
        localStorage.setItem(STORAGE_KEY, saved);
        setShowGame(true);
      }
    } catch {
      console.error('Failed to load saved city');
    }
  };

  const handleStartRandom = () => {
    setIsStarting(true);
    setStartingLabel('Starting random city…');
    try {
      newGame('IsoCity');
      setShowGame(true);
    } finally {
      setIsStarting(false);
      setStartingLabel(null);
    }
  };

  const handleSelectEarthLocation = async (lat: number, lng: number) => {
    setIsStarting(true);
    setStartingLabel(`Loading Earth terrain…`);
    try {
      await newGameFromEarth(lat, lng, 'IsoCity');
      setShowGame(true);
    } finally {
      setIsStarting(false);
      setStartingLabel(null);
    }
  };

  if (showGame) {
    return (
      <main className="h-screen w-screen overflow-hidden">
        <Game onExit={handleExitGame} />
      </main>
    );
  }

  // Mobile landing page
  if (isMobile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 safe-area-top safe-area-bottom overflow-y-auto">
        {isStarting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="px-4 py-3 border border-white/15 bg-black/60 text-white rounded-none">
              {startingLabel ?? 'Starting…'}
            </div>
          </div>
        )}
        {/* Title */}
        <h1 className="text-5xl sm:text-6xl font-light tracking-wider text-white/90 mb-6">
          IsoCity
        </h1>
        
        {/* Sprite Gallery - keep visible even when saves exist */}
        <div className="mb-6">
          <SpriteGallery count={9} cols={3} cellSize={72} />
        </div>
        
        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {hasSave && (
            <Button
              onClick={handleContinue}
              className="w-full py-6 text-xl font-light tracking-wide bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-none transition-all duration-300"
              disabled={isStarting}
            >
              Continue
            </Button>
          )}

          <LocationSelector
            onSelectLocation={handleSelectEarthLocation}
            onStartRandom={handleStartRandom}
            isMobile={true}
            disabled={isStarting}
            busyLabel={startingLabel ?? undefined}
          />
          
          <Button 
            onClick={async () => {
              const { default: exampleState } = await import('@/resources/example_state_8.json');
              localStorage.setItem(STORAGE_KEY, JSON.stringify(exampleState));
              setShowGame(true);
            }}
            variant="outline"
            className="w-full py-6 text-xl font-light tracking-wide bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/15 rounded-none transition-all duration-300"
          >
            Load Example
          </Button>
        </div>
        
        {/* Saved Cities */}
        {savedCities.length > 0 && (
          <div className="w-full max-w-xs mt-4">
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
              Saved Cities
            </h2>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {savedCities.slice(0, 5).map((city) => (
                <SavedCityCard
                  key={city.id}
                  city={city}
                  onLoad={() => loadSavedCity(city.id)}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    );
  }

  // Desktop landing page
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8">
      {isStarting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="px-4 py-3 border border-white/15 bg-black/60 text-white rounded-none">
            {startingLabel ?? 'Starting…'}
          </div>
        </div>
      )}
      <div className="max-w-7xl w-full grid lg:grid-cols-2 gap-16 items-center">
        
        {/* Left - Title and Start Button */}
        <div className="flex flex-col items-center lg:items-start justify-center space-y-12">
          <h1 className="text-8xl font-light tracking-wider text-white/90">
            IsoCity
          </h1>
          <div className="flex flex-col gap-3">
            {hasSave && (
              <Button
                onClick={handleContinue}
                className="w-64 py-6 text-xl font-light tracking-wide bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-none transition-all duration-300"
                disabled={isStarting}
              >
                Continue
              </Button>
            )}

            <LocationSelector
              onSelectLocation={handleSelectEarthLocation}
              onStartRandom={handleStartRandom}
              isMobile={false}
              disabled={isStarting}
              busyLabel={startingLabel ?? undefined}
            />
            <Button 
              onClick={async () => {
                const { default: exampleState } = await import('@/resources/example_state_8.json');
                localStorage.setItem(STORAGE_KEY, JSON.stringify(exampleState));
                setShowGame(true);
              }}
              variant="outline"
              className="w-64 py-8 text-2xl font-light tracking-wide bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/15 rounded-none transition-all duration-300"
            >
              Load Example
            </Button>
          </div>
          
          {/* Saved Cities */}
          {savedCities.length > 0 && (
            <div className="w-64">
              <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                Saved Cities
              </h2>
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {savedCities.slice(0, 5).map((city) => (
                  <SavedCityCard
                    key={city.id}
                    city={city}
                    onLoad={() => loadSavedCity(city.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right - Sprite Gallery */}
        <div className="flex justify-center lg:justify-end">
          <SpriteGallery count={16} />
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    setIsChecking(false);
  }, []);

  if (isChecking) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </main>
    );
  }

  return (
    <GameProvider>
      <HomePageContent />
    </GameProvider>
  );
}
