'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { GameProvider } from '@/context/GameContext';
import { MultiplayerContextProvider } from '@/context/MultiplayerContext';
import { CustomBuildingsProvider } from '@/context/CustomBuildingsContext';
import Game from '@/components/Game';
import { CoopModal } from '@/components/multiplayer/CoopModal';
import { useMobile } from '@/hooks/useMobile';
import { getSpritePack, getSpriteCoords, DEFAULT_SPRITE_PACK_ID } from '@/lib/renderConfig';
import { SavedCityMeta, GameState } from '@/types/game';
import { decompressFromUTF16, compressToUTF16 } from 'lz-string';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Users, X } from 'lucide-react';

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
// Supports both compressed (lz-string) and uncompressed (legacy) formats
function hasSavedGame(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      // Try to decompress first (new format)
      // lz-string can return garbage when given invalid input, so check for valid JSON start
      let jsonString = decompressFromUTF16(saved);
      
      // Check if decompression returned valid-looking JSON
      if (!jsonString || !jsonString.startsWith('{')) {
        // Check if saved string itself is JSON (legacy uncompressed format)
        if (saved.startsWith('{')) {
          jsonString = saved;
        } else {
          // Data is corrupted
          return false;
        }
      }
      
      const parsed = JSON.parse(jsonString);
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

// Save a city to the saved cities index (for multiplayer cities)
function saveCityToIndex(state: GameState, roomCode?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cities = loadSavedCities();
    
    // Create city meta
    const cityMeta: SavedCityMeta = {
      id: state.id || `city-${Date.now()}`,
      cityName: state.cityName || 'Co-op City',
      population: state.stats.population,
      money: state.stats.money,
      year: state.year,
      month: state.month,
      gridSize: state.gridSize,
      savedAt: Date.now(),
      roomCode: roomCode,
    };
    
    // Check if city already exists (by id or roomCode)
    const existingIndex = cities.findIndex(c => 
      c.id === cityMeta.id || (roomCode && c.roomCode === roomCode)
    );
    
    if (existingIndex >= 0) {
      // Update existing entry
      cities[existingIndex] = cityMeta;
    } else {
      // Add new entry at the beginning
      cities.unshift(cityMeta);
    }
    
    // Keep only the last 20 cities
    const trimmed = cities.slice(0, 20);
    
    localStorage.setItem(SAVED_CITIES_INDEX_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save city to index:', e);
  }
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
function SavedCityCard({ city, onLoad, onDelete }: { city: SavedCityMeta; onLoad: () => void; onDelete?: () => void }) {
  return (
    <div className="relative group">
      <button
        onClick={onLoad}
        className="w-full text-left p-3 pr-8 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-none transition-all duration-200"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-white font-medium truncate group-hover:text-white/90 text-sm flex-1">
            {city.cityName}
          </h3>
          {city.roomCode && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded shrink-0">
              Co-op
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
          <span>Pop: {city.population.toLocaleString()}</span>
          <span>${city.money.toLocaleString()}</span>
          {city.roomCode && <span className="text-blue-400/60">{city.roomCode}</span>}
        </div>
      </button>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1/2 -translate-y-1/2 right-1.5 p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded transition-all duration-200"
          title="Delete city"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

const SAVED_CITY_PREFIX = 'isocity-city-';

export default function HomePage() {
  const [showGame, setShowGame] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [savedCities, setSavedCities] = useState<SavedCityMeta[]>([]);
  const [hasSaved, setHasSaved] = useState(false);
  const [showCoopModal, setShowCoopModal] = useState(false);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [startFreshGame, setStartFreshGame] = useState(false);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;

  // Check for saved game and room code in URL after mount
  useEffect(() => {
    const checkSavedGame = () => {
      setIsChecking(false);
      setSavedCities(loadSavedCities());
      setHasSaved(hasSavedGame());
      
      // Check for room code in URL (legacy format) - redirect to new format
      const params = new URLSearchParams(window.location.search);
      const roomCode = params.get('room');
      if (roomCode && roomCode.length === 5) {
        // Redirect to new /coop/XXXXX format
        window.location.replace(`/coop/${roomCode.toUpperCase()}`);
        return;
      }
      // Always show landing page - don't auto-load into game
      // User can select from saved cities or start new
    };
    // Use requestAnimationFrame to avoid synchronous setState in effect
    requestAnimationFrame(checkSavedGame);
  }, []);

  // Handle exit from game - refresh saved cities list
  const handleExitGame = () => {
    setShowGame(false);
    setIsMultiplayer(false);
    setStartFreshGame(false);
    setSavedCities(loadSavedCities());
    setHasSaved(hasSavedGame());
    // Clear room code from URL
    window.history.replaceState({}, '', '/');
  };

  // Load a saved city
  const loadSavedCity = (city: SavedCityMeta) => {
    // If it's a multiplayer city, navigate to the room
    if (city.roomCode) {
      window.history.replaceState({}, '', `/coop/${city.roomCode}`);
      setPendingRoomCode(city.roomCode);
      setShowCoopModal(true);
      return;
    }
    
    // Otherwise load from local storage
    try {
      const saved = localStorage.getItem(SAVED_CITY_PREFIX + city.id);
      if (saved) {
        localStorage.setItem(STORAGE_KEY, saved);
        setShowGame(true);
      }
    } catch {
      console.error('Failed to load saved city');
    }
  };

  // Delete a saved city from the index
  const deleteSavedCity = (city: SavedCityMeta) => {
    try {
      // Remove from saved cities index
      const updatedCities = savedCities.filter(c => c.id !== city.id);
      localStorage.setItem(SAVED_CITIES_INDEX_KEY, JSON.stringify(updatedCities));
      setSavedCities(updatedCities);
      
      // Also remove the city state data if it exists
      if (!city.roomCode) {
        localStorage.removeItem(SAVED_CITY_PREFIX + city.id);
      }
    } catch {
      console.error('Failed to delete saved city');
    }
  };

  // Handle co-op game start
  const handleCoopStart = (isHost: boolean, initialState?: GameState, roomCode?: string) => {
    setIsMultiplayer(true);
    
    if (isHost && initialState) {
      // Host starts with the state they created - save it so GameProvider loads it
      try {
        const compressed = compressToUTF16(JSON.stringify(initialState));
        localStorage.setItem(STORAGE_KEY, compressed);
        
        // Also save to saved cities index so it appears on homepage
        if (roomCode) {
          saveCityToIndex(initialState, roomCode);
        }
      } catch (e) {
        console.error('Failed to save co-op state:', e);
      }
      setStartFreshGame(false);
    } else if (isHost) {
      // Host without state - fallback to fresh game
      setStartFreshGame(true);
    } else if (initialState) {
      // Guest received state from host - save it so GameProvider loads it
      try {
        const compressed = compressToUTF16(JSON.stringify(initialState));
        localStorage.setItem(STORAGE_KEY, compressed);
        
        // Also save to saved cities index so it appears on homepage
        if (roomCode) {
          saveCityToIndex(initialState, roomCode);
        }
      } catch (e) {
        console.error('Failed to save co-op state:', e);
      }
      setStartFreshGame(false);
    } else {
      // Guest without state - fallback to fresh game
      setStartFreshGame(true);
    }
    
    setShowGame(true);
  };

  if (isChecking) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </main>
    );
  }

  if (showGame) {
    const gameContent = (
      <main className="h-screen w-screen overflow-hidden">
        <Game onExit={handleExitGame} />
      </main>
    );

    // Always wrap in MultiplayerContextProvider so players can invite others from within the game
    return (
      <MultiplayerContextProvider>
        <CustomBuildingsProvider>
          <GameProvider startFresh={startFreshGame}>
            {gameContent}
          </GameProvider>
        </CustomBuildingsProvider>
      </MultiplayerContextProvider>
    );
  }

  // Mobile landing page
  if (isMobile) {
    return (
      <MultiplayerContextProvider>
        <main className="h-[100dvh] max-h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto">
          {/* Spacer to push content down slightly from top */}
          <div className="flex-shrink-0 h-4 sm:h-8" />
          
          {/* Title - smaller on very small screens */}
          <h1 className="text-4xl sm:text-5xl font-light tracking-wider text-white/90 mb-4 sm:mb-6 flex-shrink-0">
            IsoCity
          </h1>
          
          {/* Sprite Gallery - smaller on mobile, contained */}
          <div className="mb-4 sm:mb-6 flex-shrink-0">
            <SpriteGallery count={9} cols={3} cellSize={56} />
          </div>
          
          {/* Buttons - more compact */}
          <div className="flex flex-col gap-2 sm:gap-3 w-full max-w-xs flex-shrink-0">
            <Button 
              onClick={() => setShowGame(true)}
              className="w-full py-4 sm:py-6 text-lg sm:text-xl font-light tracking-wide bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none transition-all duration-300"
            >
              {hasSaved ? 'Continue' : 'New Game'}
            </Button>
            
            <Button 
              onClick={() => setShowCoopModal(true)}
              variant="outline"
              className="w-full py-4 sm:py-6 text-lg sm:text-xl font-light tracking-wide bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/15 rounded-none transition-all duration-300"
            >
              Co-op
            </Button>
            
            <Button 
              onClick={async () => {
                // Clear any room code from URL to prevent multiplayer conflicts
                if (window.location.search.includes('room=')) {
                  window.history.replaceState({}, '', '/');
                  setPendingRoomCode(null);
                }
                const response = await fetch('/example-states/example_state_9.json');
                const exampleState = await response.json();
                try {
                  const compressed = compressToUTF16(JSON.stringify(exampleState));
                  localStorage.setItem(STORAGE_KEY, compressed);
                } catch (e) {
                  console.error('Failed to save example state:', e);
                }
                setShowGame(true);
              }}
              variant="outline"
              className="w-full py-4 sm:py-6 text-lg sm:text-xl font-light tracking-wide bg-transparent hover:bg-white/10 text-white/40 hover:text-white/60 border border-white/10 rounded-none transition-all duration-300"
            >
              Load Example
            </Button>
            <div className="flex items-start justify-between w-full">
              <div className="flex flex-col">
                <a
                  href="https://cursor.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left py-2 text-sm font-light tracking-wide text-white/40 hover:text-white/70 transition-colors duration-200"
                >
                  Made with Cursor
                </a>
                <a
                  href="https://github.com/amilich/isometric-city"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-left py-2 text-sm font-light tracking-wide text-white/40 hover:text-white/70 transition-colors duration-200"
                >
                  Open GitHub
                </a>
              </div>
              <LanguageSelector variant="ghost" className="text-white/40 hover:text-white/70 hover:bg-white/10" />
            </div>
          </div>
          
          {/* Saved Cities - scrollable area takes remaining space */}
          {savedCities.length > 0 && (
            <div className="w-full max-w-xs mt-3 sm:mt-4 flex-1 min-h-0 flex flex-col">
              <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 flex-shrink-0">
                Saved Cities
              </h2>
              <div 
                className="flex flex-col gap-2 flex-1 overflow-y-auto overscroll-y-contain"
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
              >
                {savedCities.slice(0, 5).map((city) => (
                  <SavedCityCard
                    key={city.id}
                    city={city}
                    onLoad={() => loadSavedCity(city)}
                    onDelete={() => deleteSavedCity(city)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Bottom spacer */}
          <div className="flex-shrink-0 h-2" />
          
          {/* Co-op Modal */}
          <CoopModal
            open={showCoopModal}
            onOpenChange={setShowCoopModal}
            onStartGame={handleCoopStart}
            pendingRoomCode={pendingRoomCode}
          />
        </main>
      </MultiplayerContextProvider>
    );
  }

  // Desktop landing page
  return (
    <MultiplayerContextProvider>
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8">
        <div className="max-w-7xl w-full grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left - Title and Start Button */}
          <div className="flex flex-col items-center lg:items-start justify-center space-y-12">
            <h1 className="text-8xl font-light tracking-wider text-white/90">
              IsoCity
            </h1>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => setShowGame(true)}
                className="w-64 py-8 text-2xl font-light tracking-wide bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none transition-all duration-300"
              >
                {hasSaved ? 'Continue' : 'New Game'}
              </Button>
              <Button 
                onClick={() => setShowCoopModal(true)}
                variant="outline"
                className="w-64 py-8 text-2xl font-light tracking-wide bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/15 rounded-none transition-all duration-300"
              >
                Co-op
              </Button>
              <Button 
                onClick={async () => {
                  // Clear any room code from URL to prevent multiplayer conflicts
                  if (window.location.search.includes('room=')) {
                    window.history.replaceState({}, '', '/');
                    setPendingRoomCode(null);
                  }
                  const response = await fetch('/example-states/example_state_9.json');
                  const exampleState = await response.json();
                  try {
                    const compressed = compressToUTF16(JSON.stringify(exampleState));
                    localStorage.setItem(STORAGE_KEY, compressed);
                  } catch (e) {
                    console.error('Failed to save example state:', e);
                  }
                  setShowGame(true);
                }}
                variant="outline"
                className="w-64 py-8 text-2xl font-light tracking-wide bg-transparent hover:bg-white/10 text-white/40 hover:text-white/60 border border-white/10 rounded-none transition-all duration-300"
              >
                Load Example
              </Button>
              <div className="flex items-start justify-between w-64">
                <div className="flex flex-col">
                  <a
                    href="https://cursor.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-left py-2 text-sm font-light tracking-wide text-white/40 hover:text-white/70 transition-colors duration-200"
                  >
                    Made with Cursor
                  </a>
                  <a
                    href="https://github.com/amilich/isometric-city"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-left py-2 text-sm font-light tracking-wide text-white/40 hover:text-white/70 transition-colors duration-200"
                  >
                    Open GitHub
                  </a>
                </div>
                <LanguageSelector variant="ghost" className="text-white/40 hover:text-white/70 hover:bg-white/10" />
              </div>
            </div>
            
            {/* Saved Cities */}
            {savedCities.length > 0 && (
              <div className="w-64">
                <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                  Saved Cities
                </h2>
                <div 
                  className="flex flex-col gap-2 max-h-64 overflow-y-auto overscroll-y-contain"
                  style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                >
                  {savedCities.slice(0, 5).map((city) => (
                    <SavedCityCard
                      key={city.id}
                      city={city}
                      onLoad={() => loadSavedCity(city)}
                      onDelete={() => deleteSavedCity(city)}
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
        
        {/* Co-op Modal */}
        <CoopModal
          open={showCoopModal}
          onOpenChange={setShowCoopModal}
          onStartGame={handleCoopStart}
          pendingRoomCode={pendingRoomCode}
        />
      </main>
    </MultiplayerContextProvider>
  );
}
