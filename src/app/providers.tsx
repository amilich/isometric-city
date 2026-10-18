'use client';

import React from 'react';
import { AudioProvider } from '@/lib/audio/AudioProvider';
import { GlitchAnalyticsProvider } from '@/lib/glitch/GlitchAnalyticsProvider';
import { GlitchAccessGate, GlitchProvider } from '@/lib/glitch/GlitchProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AudioProvider>
      <GlitchProvider>
        <GlitchAnalyticsProvider>
          <GlitchAccessGate>
            {children}
          </GlitchAccessGate>
        </GlitchAnalyticsProvider>
      </GlitchProvider>
    </AudioProvider>
  );
}
