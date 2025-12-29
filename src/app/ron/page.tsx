/**
 * Rise of Nations - Game Page
 */
'use client';

import React from 'react';
import { RoNGame } from '@/games/ron';
import { useRouter } from 'next/navigation';

export default function RoNPage() {
  const router = useRouter();
  
  const handleExit = () => {
    router.push('/');
  };
  
  return (
    <main className="w-screen h-screen overflow-hidden">
      <RoNGame onExit={handleExit} />
    </main>
  );
}
