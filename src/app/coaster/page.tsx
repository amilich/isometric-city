'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CoasterProvider } from '@/context/CoasterContext';
import { CoasterGame } from '@/components/coaster/CoasterGame';
import { useMobile } from '@/hooks/useMobile';
import { SavedParkMeta } from '@/games/coaster/types/game';
import { decompressFromUTF16 } from 'lz-string';
import { X } from 'lucide-react';
import { T, Var, useGT } from 'gt-next';

const STORAGE_KEY = 'coaster-game-state';
const SAVED_PARKS_INDEX_KEY = 'coaster-saved-parks-index';

// Check if there's a saved game
function hasSavedGame(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      let jsonString = decompressFromUTF16(saved);
      if (!jsonString || !jsonString.startsWith('{')) {
        if (saved.startsWith('{')) {
          jsonString = saved;
        } else {
          return false;
        }
      }
      const parsed = JSON.parse(jsonString);
      return parsed.grid && parsed.gridSize && parsed.park;
    }
  } catch {
    return false;
  }
  return false;
}

// Load saved parks
function loadSavedParks(): SavedParkMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SAVED_PARKS_INDEX_KEY);
    if (saved) {
      return JSON.parse(saved) as SavedParkMeta[];
    }
  } catch {
    return [];
  }
  return [];
}

// Saved Park Card
function SavedParkCard({ park, onLoad, onDelete }: {
  park: SavedParkMeta;
  onLoad: () => void;
  onDelete?: () => void;
}) {
  const gt = useGT();
  return (
    <div className="relative group">
      <button
        onClick={onLoad}
        className="w-full text-left p-3 pr-8 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-none transition-all duration-200"
      >
        <h3 className="text-white font-medium truncate group-hover:text-white/90 text-sm">
          {park.parkName}
        </h3>
        <T>
          <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
            <span>👥 <Var>{park.guestCount}</Var></span>
            <span>💰 $<Var>{park.cash.toLocaleString()}</Var></span>
            <span>⭐ <Var>{park.parkRating}</Var></span>
          </div>
        </T>
      </button>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1/2 -translate-y-1/2 right-1.5 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded transition-all duration-200"
          title={gt('Delete park')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function CoasterPage() {
  const [showGame, setShowGame] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [savedParks, setSavedParks] = useState<SavedParkMeta[]>([]);
  const [hasSaved, setHasSaved] = useState(false);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;
  const gt = useGT();

  useEffect(() => {
    const check = () => {
      setIsChecking(false);
      setSavedParks(loadSavedParks());
      setHasSaved(hasSavedGame());
    };
    requestAnimationFrame(check);
  }, []);

  const handleExitGame = () => {
    setShowGame(false);
    setSavedParks(loadSavedParks());
    setHasSaved(hasSavedGame());
  };

  const loadSavedPark = (park: SavedParkMeta) => {
    // Load from saved parks storage
    const SAVED_PARK_PREFIX = 'coaster-park-';
    try {
      const saved = localStorage.getItem(SAVED_PARK_PREFIX + park.id);
      if (saved) {
        localStorage.setItem(STORAGE_KEY, saved);
        setShowGame(true);
      }
    } catch {
      console.error('Failed to load saved park');
    }
  };

  const deleteSavedPark = (park: SavedParkMeta) => {
    const SAVED_PARK_PREFIX = 'coaster-park-';
    try {
      localStorage.removeItem(SAVED_PARK_PREFIX + park.id);
      const updated = savedParks.filter(p => p.id !== park.id);
      localStorage.setItem(SAVED_PARKS_INDEX_KEY, JSON.stringify(updated));
      setSavedParks(updated);
    } catch {
      console.error('Failed to delete saved park');
    }
  };

  if (isChecking) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-900 to-purple-950 flex items-center justify-center">
        <T>
          <div className="text-white/60">Loading...</div>
        </T>
      </main>
    );
  }

  if (showGame) {
    return (
      <CoasterProvider>
        <main className="h-screen w-screen overflow-hidden">
          <CoasterGame onExit={handleExitGame} />
        </main>
      </CoasterProvider>
    );
  }

  // Landing page
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-900 to-purple-950 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full flex flex-col items-center space-y-12">
        
        {/* Title */}
        <T>
          <div className="text-center">
            <h1 className="text-6xl md:text-8xl font-light tracking-wider text-white/90">
              Coaster
            </h1>
            <h2 className="text-4xl md:text-6xl font-light tracking-wider text-purple-300/80 mt-2">
              Tycoon
            </h2>
            <p className="text-white/50 mt-4 text-lg">
              Build the ultimate theme park
            </p>
          </div>
        </T>

        {/* Coaster Icon Placeholder */}
        <div className="w-48 h-48 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center">
          <span className="text-8xl">🎢</span>
        </div>
        
        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button
            onClick={() => setShowGame(true)}
            className="w-full py-8 text-2xl font-light tracking-wide bg-purple-600/80 hover:bg-purple-500/80 text-white border border-purple-400/30 rounded-lg transition-all duration-300"
          >
            {hasSaved ? gt('Continue') : gt('New Park')}
          </Button>

          {hasSaved && (
            <T>
              <Button
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY);
                  setHasSaved(false);
                  setShowGame(true);
                }}
                variant="outline"
                className="w-full py-6 text-xl font-light tracking-wide bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/15 rounded-lg transition-all duration-300"
              >
                New Park
              </Button>
            </T>
          )}

          <T>
            <a
              href="/"
              className="text-center py-2 text-sm font-light tracking-wide text-white/40 hover:text-white/70 transition-colors duration-200"
            >
              ← Back to IsoCity
            </a>
          </T>
        </div>
        
        {/* Saved Parks */}
        {savedParks.length > 0 && (
          <div className="w-full max-w-xs">
            <T>
              <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                Saved Parks
              </h2>
            </T>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {savedParks.slice(0, 5).map((park) => (
                <SavedParkCard
                  key={park.id}
                  park={park}
                  onLoad={() => loadSavedPark(park)}
                  onDelete={() => deleteSavedPark(park)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
