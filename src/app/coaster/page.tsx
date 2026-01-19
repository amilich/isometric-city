'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CoasterProvider } from '@/context/CoasterContext';
import CoasterGame from '@/components/coaster/Game';
import { decompressFromUTF16 } from 'lz-string';

const STORAGE_KEY = 'coaster-tycoon-state';

// Check if there's a saved game in localStorage
function checkHasSavedGame(): boolean {
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
      return parsed.grid && parsed.gridSize;
    }
  } catch {
    return false;
  }
  return false;
}

export default function CoasterPage() {
  const [showGame, setShowGame] = useState(false);
  const [startFresh, setStartFresh] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check for saved game on mount
  useEffect(() => {
    setHasSaved(checkHasSavedGame());
    setIsChecking(false);
  }, []);

  // Handle exit from game - refresh saved state check
  const handleExitGame = () => {
    setShowGame(false);
    setStartFresh(false);
    setHasSaved(checkHasSavedGame());
  };

  if (showGame) {
    return (
      <CoasterProvider startFresh={startFresh}>
        <main className="h-screen w-screen overflow-hidden">
          <CoasterGame onExit={handleExitGame} />
        </main>
      </CoasterProvider>
    );
  }

  if (isChecking) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-900 to-purple-950 flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </main>
    );
  }

  // Landing page
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-900 to-purple-950 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full flex flex-col items-center justify-center space-y-12">
        {/* Title */}
        <div className="text-center space-y-4">
          <h1 className="text-7xl font-light tracking-wider text-white/90">
            IsoCoaster
          </h1>
          <p className="text-xl text-white/60 font-light">
            Build the ultimate theme park
          </p>
        </div>
        
        {/* Features list */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { icon: '🎢', label: 'Custom Coasters' },
            { icon: '🎡', label: 'Flat Rides' },
            { icon: '🍿', label: 'Food & Shops' },
            { icon: '👥', label: 'Happy Guests' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <span className="text-4xl">{icon}</span>
              <span className="text-white/70 text-sm">{label}</span>
            </div>
          ))}
        </div>
        
        {/* Buttons */}
        <div className="flex flex-col gap-3">
          {/* Main button - Continue if saved, New Park if not */}
          <Button 
            onClick={() => {
              setStartFresh(false);
              setShowGame(true);
            }}
            className="w-64 py-8 text-2xl font-light tracking-wide bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none transition-all duration-300"
          >
            {hasSaved ? 'Continue' : 'New Park'}
          </Button>
          
          {/* New Park button (only shown if there's a saved game) */}
          {hasSaved && (
            <Button 
              onClick={() => {
                setStartFresh(true);
                setShowGame(true);
              }}
              variant="outline"
              className="w-64 py-8 text-2xl font-light tracking-wide bg-transparent hover:bg-white/10 text-white/60 hover:text-white border border-white/20 rounded-none transition-all duration-300"
            >
              New Park
            </Button>
          )}
        </div>
        
        {/* Back to IsoCity link */}
        <a
          href="/"
          className="text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          ← Back to IsoCity
        </a>
      </div>
    </main>
  );
}
