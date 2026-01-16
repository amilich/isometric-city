'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import CoasterGame from '@/components/coaster/CoasterGame';
import { CoasterProvider } from '@/context/CoasterContext';
import { decompressFromUTF16 } from 'lz-string';
import { T, useGT } from 'gt-next';

const STORAGE_KEY = 'coaster-game-state';

function hasSavedPark(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    let jsonString = decompressFromUTF16(saved);
    if (!jsonString || !jsonString.startsWith('{')) {
      if (saved.startsWith('{')) {
        jsonString = saved;
      } else {
        return false;
      }
    }
    const parsed = JSON.parse(jsonString);
    return Boolean(parsed?.grid && parsed?.gridSize);
  } catch {
    return false;
  }
}

export default function CoasterHomePage() {
  const [showGame, setShowGame] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const gt = useGT();

  useEffect(() => {
    setHasSaved(hasSavedPark());
  }, []);

  if (showGame) {
    return (
      <main className="h-screen w-screen overflow-hidden">
        <CoasterProvider>
          <CoasterGame />
        </CoasterProvider>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="max-w-xl w-full text-center space-y-8">
        <T>
          <div className="space-y-2">
            <div className="text-5xl font-light tracking-widest text-white/90">Coaster Park</div>
            <div className="text-sm text-white/50 uppercase tracking-[0.3em]">Theme Park Tycoon</div>
          </div>
          <p className="text-white/60 text-sm leading-relaxed">
            Build thrilling rides, welcome guests, and design the ultimate amusement park.
          </p>
        </T>
        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={() => setShowGame(true)}
            className="w-64 py-6 text-lg font-light tracking-wide bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none transition-all duration-300"
          >
            {hasSaved ? gt('Continue Park') : gt('Start New Park')}
          </Button>
          <T>
            <Button
              variant="outline"
              onClick={() => setShowGame(true)}
              className="w-64 py-6 text-lg font-light tracking-wide bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/15 rounded-none transition-all duration-300"
            >
              Sandbox Mode
            </Button>
          </T>
        </div>
      </div>
    </main>
  );
}
