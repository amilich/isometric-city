'use client';

import React from 'react';
import { CoasterProvider } from '@/context/CoasterContext';
import { CoasterGame } from '@/components/coaster/CoasterGame';

export default function CoasterPage() {
  return (
    <main className="h-screen w-screen overflow-hidden">
      <CoasterProvider>
        <CoasterGame />
      </CoasterProvider>
    </main>
  );
}
