'use client';

import React from 'react';
import { TDProvider } from '@/context/TDContext';
import TDGame from '@/components/td/Game';

export default function TDPage() {
  return (
    <TDProvider>
      <main className="h-screen w-screen overflow-hidden">
        <TDGame onExit={() => window.history.back()} />
      </main>
    </TDProvider>
  );
}
