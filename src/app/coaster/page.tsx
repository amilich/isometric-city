'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CoasterProvider } from '@/context/CoasterContext';
import CoasterGame from '@/components/coaster/Game';
import { T, msg, useMessages } from 'gt-next';

const features = [
  { icon: '🎢', label: msg('Custom Coasters') },
  { icon: '🎡', label: msg('Flat Rides') },
  { icon: '🍿', label: msg('Food & Shops') },
  { icon: '👥', label: msg('Happy Guests') },
];

export default function CoasterPage() {
  const [showGame, setShowGame] = useState(false);
  const m = useMessages();

  if (showGame) {
    return (
      <CoasterProvider>
        <main className="h-screen w-screen overflow-hidden">
          <CoasterGame onExit={() => setShowGame(false)} />
        </main>
      </CoasterProvider>
    );
  }

  // Landing page
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-900 to-purple-950 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full flex flex-col items-center justify-center space-y-12">
        {/* Title */}
        <div className="text-center space-y-4">
          <T>
            <h1 className="text-7xl font-light tracking-wider text-white/90">
              Coaster Tycoon
            </h1>
          </T>
          <T>
            <p className="text-xl text-white/60 font-light">
              Build the ultimate theme park
            </p>
          </T>
        </div>
        
        {/* Features list */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {features.map(({ icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <span className="text-4xl">{icon}</span>
              <span className="text-white/70 text-sm">{m(label)}</span>
            </div>
          ))}
        </div>
        
        {/* Start button */}
        <T>
          <Button
            onClick={() => setShowGame(true)}
            className="w-64 py-8 text-2xl font-light tracking-wide bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none transition-all duration-300"
          >
            New Park
          </Button>
        </T>
        
        {/* Back to IsoCity link */}
        <T>
          <a
            href="/"
            className="text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            ← Back to IsoCity
          </a>
        </T>
      </div>
    </main>
  );
}
