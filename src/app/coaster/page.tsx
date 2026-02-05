'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { CoasterProvider } from '@/context/CoasterContext';
import { MultiplayerContextProvider, useMultiplayerOptional } from '@/context/MultiplayerContext';
import CoasterGame from '@/components/coaster/Game';
import { CoasterCoopModal } from '@/components/coaster/multiplayer/CoasterCoopModal';
import { X } from 'lucide-react';
import {
  buildSavedParkMeta,
  COASTER_AUTOSAVE_KEY,
  COASTER_SAVED_PARK_PREFIX,
  deleteCoasterStateFromStorage,
  loadCoasterStateFromStorage,
  readSavedParksIndex,
  removeSavedParkMeta,
  SavedParkMeta,
  saveParkToIndex,
  upsertSavedParkMeta,
  writeSavedParksIndex,
  saveCoasterStateToStorage,
} from '@/games/coaster/saveUtils';
import { COASTER_SPRITE_PACK, getSpriteInfo, getSpriteRect } from '@/games/coaster/lib/coasterRenderConfig';
import { GameState as CoasterGameState } from '@/games/coaster/types';

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

// Sprite Gallery component for coaster assets
function CoasterSpriteGallery({ count: defaultCount = 16, cols: defaultCols = 4, cellSize: defaultCellSize = 120 }: { count?: number; cols?: number; cellSize?: number }) {
  // Responsive columns, cell size, and count based on screen width
  const [responsiveConfig, setResponsiveConfig] = useState({ cols: defaultCols, cellSize: defaultCellSize, count: defaultCount });
  
  useEffect(() => {
    const updateConfig = () => {
      const width = window.innerWidth;
      if (width < 400) {
        // 3 columns - use 15 items (5 rows of 3) to avoid orphans
        setResponsiveConfig({ cols: 3, cellSize: 90, count: 15 });
      } else if (width < 640) {
        // 3 columns - use 15 items (5 rows of 3) to avoid orphans
        setResponsiveConfig({ cols: 3, cellSize: 100, count: 15 });
      } else if (width < 768) {
        setResponsiveConfig({ cols: 4, cellSize: 100, count: defaultCount });
      } else {
        setResponsiveConfig({ cols: defaultCols, cellSize: defaultCellSize, count: defaultCount });
      }
    };
    
    updateConfig();
    window.addEventListener('resize', updateConfig);
    return () => window.removeEventListener('resize', updateConfig);
  }, [defaultCols, defaultCellSize, defaultCount]);
  
  const { cols, cellSize, count } = responsiveConfig;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedSheets, setLoadedSheets] = useState<Map<string, HTMLCanvasElement>>(new Map());
  
  // Get random sprite names from all sheets
  const randomSprites = useMemo(() => {
    const allSprites: { name: string; sheetId: string }[] = [];
    for (const sheet of COASTER_SPRITE_PACK.sheets) {
      for (const sprite of sheet.sprites) {
        allSprites.push({ name: sprite.name, sheetId: sheet.id });
      }
    }
    const shuffled = shuffleArray(allSprites);
    return shuffled.slice(0, count);
  }, [count]);
  
  // Load and filter sprite sheets (remove red background)
  useEffect(() => {
    const sheetsToLoad = new Set(randomSprites.map(s => s.sheetId));
    const loaded = new Map<string, HTMLCanvasElement>();
    let loadCount = 0;
    
    sheetsToLoad.forEach(sheetId => {
      const sheet = COASTER_SPRITE_PACK.sheets.find(s => s.id === sheetId);
      if (!sheet) return;
      
      const img = new Image();
      img.onload = () => {
        // Filter red background
        const filtered = filterBackgroundColor(img);
        loaded.set(sheetId, filtered);
        loadCount++;
        if (loadCount === sheetsToLoad.size) {
          setLoadedSheets(new Map(loaded));
        }
      };
      img.src = sheet.src;
    });
  }, [randomSprites]);
  
  // Draw sprites to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loadedSheets.size === 0) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rows = Math.ceil(randomSprites.length / cols);
    const padding = 10;
    
    const canvasWidth = cols * cellSize;
    const canvasHeight = rows * cellSize;
    
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    randomSprites.forEach(({ name }, index) => {
      const info = getSpriteInfo(name);
      if (!info) return;
      
      const img = loadedSheets.get(info.sheet.id);
      if (!img) return;
      
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
      
      const rect = getSpriteRect(info.sheet, info.sprite, img.width, img.height);
      
      // Calculate destination size preserving aspect ratio
      const maxSize = cellSize - padding * 2;
      const aspectRatio = rect.sh / rect.sw;
      let destWidth = maxSize;
      let destHeight = destWidth * aspectRatio;
      
      if (destHeight > maxSize) {
        destHeight = maxSize;
        destWidth = destHeight / aspectRatio;
      }
      
      // Apply sprite scale
      const scale = info.sprite.scale || 1;
      destWidth *= scale;
      destHeight *= scale;
      
      // Center sprite in cell
      const drawX = cellX + (cellSize - destWidth) / 2;
      const drawY = cellY + (cellSize - destHeight) / 2 + destHeight * 0.1;
      
      ctx.drawImage(
        img,
        rect.sx, rect.sy, rect.sw, rect.sh,
        Math.round(drawX), Math.round(drawY),
        Math.round(destWidth), Math.round(destHeight)
      );
    });
  }, [loadedSheets, randomSprites, cols, cellSize]);
  
  return (
    <canvas
      ref={canvasRef}
      className="opacity-80 hover:opacity-100 transition-opacity"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// Saved Park Card Component
function SavedParkCard({ park, onLoad, onDelete }: { park: SavedParkMeta; onLoad: () => void; onDelete?: () => void }) {
  const savedDate = new Date(park.savedAt);
  const dateLabel = savedDate.toLocaleDateString();
  
  return (
    <div className="relative group">
      <button
        onClick={onLoad}
        className="w-full text-left p-3 pr-8 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-none transition-all duration-200"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-white font-medium truncate group-hover:text-white/90 text-sm flex-1">
            {park.name}
          </h3>
          {park.roomCode && (
            <span className="text-xs px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded shrink-0">
              Co-op
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
          <span>Guests: {park.guests.toLocaleString()}</span>
          <span>Rating: {park.rating}</span>
          <span>{dateLabel}</span>
          {park.roomCode && <span className="text-emerald-400/60">{park.roomCode}</span>}
        </div>
      </button>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1/2 -translate-y-1/2 right-1.5 p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded transition-all duration-200"
          title="Delete park"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function CoasterPageContent() {
  const multiplayer = useMultiplayerOptional();
  const [showGame, setShowGame] = useState(false);
  const [startFresh, setStartFresh] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [savedParks, setSavedParks] = useState<SavedParkMeta[]>([]);
  const [loadParkId, setLoadParkId] = useState<string | null>(null);
  const [showCoopModal, setShowCoopModal] = useState(false);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);

  const refreshSavedParks = useCallback(() => {
    let parks = readSavedParksIndex();
    const autosaveState = loadCoasterStateFromStorage(COASTER_AUTOSAVE_KEY);
    if (autosaveState) {
      const autosaveMeta = buildSavedParkMeta(autosaveState);
      parks = upsertSavedParkMeta(autosaveMeta, parks);
      writeSavedParksIndex(parks);
    }
    setSavedParks(parks);
    setHasSaved(parks.length > 0);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    refreshSavedParks();
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode && roomCode.length === 5) {
      window.location.replace(`/coaster/coop/${roomCode.toUpperCase()}`);
    }
  }, [refreshSavedParks]);

  const handleExitGame = () => {
    multiplayer?.leaveRoom();
    setShowGame(false);
    setStartFresh(false);
    setLoadParkId(null);
    setPendingRoomCode(null);
    refreshSavedParks();
    window.history.replaceState({}, '', '/coaster');
  };

  const handleDeletePark = (park: SavedParkMeta) => {
    const autosaveState = loadCoasterStateFromStorage(COASTER_AUTOSAVE_KEY);
    if (autosaveState?.id === park.id) {
      deleteCoasterStateFromStorage(COASTER_AUTOSAVE_KEY);
    }
    deleteCoasterStateFromStorage(`${COASTER_SAVED_PARK_PREFIX}${park.id}`);
    const updated = removeSavedParkMeta(park.id, savedParks);
    writeSavedParksIndex(updated);
    setSavedParks(updated);
    setHasSaved(updated.length > 0);
  };

  const handleCoopStart = (_isHost: boolean, initialState?: CoasterGameState, roomCode?: string) => {
    if (initialState) {
      try {
        saveCoasterStateToStorage(COASTER_AUTOSAVE_KEY, initialState);
        if (roomCode) {
          saveParkToIndex(initialState, roomCode);
        }
      } catch (e) {
        console.error('Failed to save co-op park state:', e);
      }
      setStartFresh(false);
    } else {
      setStartFresh(true);
    }

    setLoadParkId(null);
    setShowGame(true);
  };

  return (
    showGame ? (
      <CoasterProvider startFresh={startFresh} loadParkId={loadParkId}>
        <main className="h-screen w-screen overflow-hidden">
          <CoasterGame onExit={handleExitGame} />
        </main>
      </CoasterProvider>
    ) : isChecking ? (
      <main className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-950 to-emerald-950 flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </main>
    ) : (
      <>
        <main className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-950 to-emerald-950 flex items-center justify-center p-4 sm:p-8 overflow-x-hidden">
          <div className="max-w-7xl w-full grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left - Title and Buttons */}
            <div className="flex flex-col items-center lg:items-start justify-center space-y-8 lg:space-y-12">
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-wider text-white/90">
                IsoCoaster
              </h1>

              <div className="flex flex-col gap-3 w-full max-w-64">
                <Button 
                  onClick={() => {
                    if (hasSaved && savedParks.length > 0) {
                      setStartFresh(false);
                      setLoadParkId(savedParks[0].id);
                    } else {
                      setStartFresh(true);
                      setLoadParkId(null);
                    }
                    setShowGame(true);
                  }}
                  className="w-full py-6 sm:py-8 text-xl sm:text-2xl font-light tracking-wide bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none transition-all duration-300"
                >
                  {hasSaved ? 'Continue' : 'New Park'}
                </Button>

                {hasSaved && (
                  <Button 
                    onClick={() => {
                      setStartFresh(true);
                      setLoadParkId(null);
                      setShowGame(true);
                    }}
                    variant="outline"
                    className="w-full py-6 sm:py-8 text-xl sm:text-2xl font-light tracking-wide bg-transparent hover:bg-white/10 text-white/60 hover:text-white border border-white/20 rounded-none transition-all duration-300"
                  >
                    New Park
                  </Button>
                )}

                <Button 
                  onClick={() => setShowCoopModal(true)}
                  variant="outline"
                  className="w-full py-6 sm:py-8 text-xl sm:text-2xl font-light tracking-wide bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border border-white/15 rounded-none transition-all duration-300"
                >
                  Co-op
                </Button>

                <Button
                  onClick={async () => {
                    try {
                      const response = await fetch('/example-states-coaster/example_state.json');
                      const exampleState = await response.json();
                      saveCoasterStateToStorage(COASTER_AUTOSAVE_KEY, exampleState);
                      refreshSavedParks();
                      setStartFresh(false);
                      setLoadParkId(null);
                      setShowGame(true);
                    } catch (e) {
                      console.error('Failed to load example state:', e);
                    }
                  }}
                  variant="outline"
                  className="w-full py-6 sm:py-8 text-xl sm:text-2xl font-light tracking-wide bg-transparent hover:bg-white/10 text-white/40 hover:text-white/60 border border-white/10 rounded-none transition-all duration-300"
                >
                  Load Example
                </Button>

                <a
                  href="/"
                  className="w-full text-center py-2 text-sm font-light tracking-wide text-white/40 hover:text-white/70 transition-colors duration-200"
                >
                  Back to IsoCity
                </a>
                <a
                  href="https://github.com/amilich/isometric-city"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center py-2 text-sm font-light tracking-wide text-white/40 hover:text-white/70 transition-colors duration-200"
                >
                  Open GitHub
                </a>
              </div>

              {/* Saved Parks */}
              {savedParks.length > 0 && (
                <div className="w-full max-w-64">
                  <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                    Saved Parks
                  </h2>
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {savedParks.slice(0, 5).map((park) => (
                      <SavedParkCard
                        key={park.id}
                        park={park}
                        onLoad={() => {
                          if (park.roomCode) {
                            window.history.replaceState({}, '', `/coaster/coop/${park.roomCode}`);
                            setPendingRoomCode(park.roomCode);
                            setShowCoopModal(true);
                            return;
                          }
                          setStartFresh(false);
                          setLoadParkId(park.id);
                          setShowGame(true);
                        }}
                        onDelete={() => handleDeletePark(park)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right - Sprite Gallery */}
            <div className="flex justify-center lg:justify-end">
              <CoasterSpriteGallery count={16} />
            </div>
          </div>
        </main>

        <CoasterCoopModal
          open={showCoopModal}
          onOpenChange={setShowCoopModal}
          onStartGame={handleCoopStart}
          pendingRoomCode={pendingRoomCode}
        />
      </>
    )
  );
}

export default function CoasterPage() {
  return (
    <MultiplayerContextProvider>
      <CoasterPageContent />
    </MultiplayerContextProvider>
  );
}
