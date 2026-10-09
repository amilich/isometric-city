'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { emitAudioCue } from '@/lib/audio/audioEvents';
import { GlitchClient } from './client';
import { GLITCH_ENABLED, detectGlitchGameKeyFromPath, getGlitchTitleConfig, GlitchGameKey } from './config';
import { createOrReuseInstall, GlitchInstallSession, refreshInstallHeartbeat } from './install';

type GlitchStatus =
  | 'disabled'
  | 'booting'
  | 'validated'
  | 'blocked'
  | 'misconfigured'
  | 'error';

interface GlitchContextValue {
  enabled: boolean;
  gameKey: GlitchGameKey;
  status: GlitchStatus;
  client: GlitchClient | null;
  installSession: GlitchInstallSession | null;
  installId: string | null;
  error: string | null;
  isPlayable: boolean;
}

const GlitchContext = createContext<GlitchContextValue | null>(null);

interface GlitchBootState {
  gameKey: GlitchGameKey | null;
  status: GlitchStatus;
  client: GlitchClient | null;
  installSession: GlitchInstallSession | null;
  error: string | null;
}

export function GlitchProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const gameKey = useMemo(() => detectGlitchGameKeyFromPath(pathname), [pathname]);
  const titleConfig = useMemo(() => getGlitchTitleConfig(gameKey), [gameKey]);
  const [bootState, setBootState] = useState<GlitchBootState>({
    gameKey: null,
    status: 'booting',
    client: null,
    installSession: null,
    error: null,
  });

  useEffect(() => {
    if (!GLITCH_ENABLED) {
      return;
    }

    if (!titleConfig.runtimeTitleToken) {
      return;
    }

    let cancelled = false;
    const runtimeClient = new GlitchClient(titleConfig);

    createOrReuseInstall(runtimeClient, gameKey)
      .then((session) => {
        if (cancelled) return;
        if (session.validation.valid) {
          setBootState({
            gameKey,
            status: 'validated',
            client: runtimeClient,
            installSession: session,
            error: null,
          });
          emitAudioCue('glitch.validated');
        } else {
          setBootState({
            gameKey,
            status: 'blocked',
            client: runtimeClient,
            installSession: session,
            error: session.validation.reason || session.validation.message || 'Glitch install validation denied access.',
          });
          emitAudioCue('glitch.denied');
        }
      })
      .catch((bootError) => {
        if (cancelled) return;
        console.error('[Glitch] Boot failed:', bootError);
        setBootState({
          gameKey,
          status: 'error',
          client: runtimeClient,
          installSession: null,
          error: bootError instanceof Error ? bootError.message : 'Glitch boot failed.',
        });
        emitAudioCue('glitch.denied');
      });

    return () => {
      cancelled = true;
    };
  }, [gameKey, titleConfig]);

  const hasRuntimeToken = !!titleConfig.runtimeTitleToken;
  const bootStateAppliesToCurrentGame = bootState.gameKey === gameKey;
  const status: GlitchStatus = !GLITCH_ENABLED
    ? 'disabled'
    : !hasRuntimeToken
      ? 'misconfigured'
      : bootStateAppliesToCurrentGame
        ? bootState.status
        : 'booting';
  const client = bootStateAppliesToCurrentGame ? bootState.client : null;
  const installSession = bootStateAppliesToCurrentGame ? bootState.installSession : null;
  const error = !GLITCH_ENABLED
    ? null
    : !hasRuntimeToken
      ? `Glitch is enabled for ${titleConfig.titleName}, but NEXT_PUBLIC_GLITCH_${gameKey === 'isocity' ? 'ISOCITY' : 'COASTER'}_TITLE_TOKEN is missing.`
      : bootStateAppliesToCurrentGame
        ? bootState.error
        : null;

  useEffect(() => {
    if (!GLITCH_ENABLED || status !== 'validated') return;
    const interval = window.setInterval(() => {
      if (!client) return;
      refreshInstallHeartbeat(client, gameKey).catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [client, gameKey, status]);

  const value = useMemo<GlitchContextValue>(() => ({
    enabled: GLITCH_ENABLED,
    gameKey,
    status,
    client,
    installSession,
    installId: installSession?.install.id ?? null,
    error,
    isPlayable: !GLITCH_ENABLED || status === 'validated',
  }), [client, error, gameKey, installSession, status]);

  return <GlitchContext.Provider value={value}>{children}</GlitchContext.Provider>;
}

export function GlitchAccessGate({ children }: { children: React.ReactNode }) {
  const glitch = useGlitch();

  if (!glitch.enabled || glitch.status === 'validated') {
    return <>{children}</>;
  }

  if (glitch.status === 'booting') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <div className="text-sm uppercase tracking-[0.2em] text-white/40">Glitch</div>
          <h1 className="text-2xl font-semibold">Validating install...</h1>
          <p className="text-white/60 text-sm">Checking your title token, install record, and license before play starts.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <div className="max-w-lg text-center space-y-4 border border-white/10 bg-white/5 p-6">
        <div className="text-sm uppercase tracking-[0.2em] text-red-300">Access blocked</div>
        <h1 className="text-2xl font-semibold">Glitch validation did not pass</h1>
        <p className="text-white/70 text-sm">
          {glitch.error || 'The install could not be validated. Check the title token, license state, and Glitch dashboard configuration.'}
        </p>
      </div>
    </main>
  );
}

export function useGlitch(): GlitchContextValue {
  const context = useContext(GlitchContext);
  if (!context) {
    throw new Error('useGlitch must be used within GlitchProvider');
  }
  return context;
}
