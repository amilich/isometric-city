'use client';

import React from 'react';
import { useTower } from '@/context/TowerContext';
import { SettingsPanel } from './SettingsPanel';
import { StatsPanel } from './StatsPanel';

export function Panels() {
  const { state } = useTower();

  if (state.activePanel === 'settings') {
    return <SettingsPanel />;
  }
  if (state.activePanel === 'stats') {
    return <StatsPanel />;
  }
  return null;
}

