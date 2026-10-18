'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { GLITCH_BEHAVIOR_EVENT, GlitchBehaviorEventDetail, emitGlitchBehaviorEvent } from './behaviorEvents';
import { useGlitch } from './GlitchProvider';

interface GlitchAnalyticsContextValue {
  trackEvent: (stepKey: string, actionKey: string, metadata?: Record<string, unknown>) => void;
}

const GlitchAnalyticsContext = createContext<GlitchAnalyticsContextValue | null>(null);
const MAX_PENDING_EVENTS = 100;
const MAX_METADATA_DEPTH = 3;

export function GlitchAnalyticsProvider({ children }: { children: React.ReactNode }) {
  const glitch = useGlitch();
  const pendingEventsRef = useRef<GlitchBehaviorEventDetail[]>([]);

  const sendEvent = useCallback((detail: GlitchBehaviorEventDetail) => {
    if (!glitch.enabled) return;
    if (glitch.status !== 'validated' || !glitch.client || !glitch.installId) {
      pendingEventsRef.current = [...pendingEventsRef.current, detail].slice(-MAX_PENDING_EVENTS);
      return;
    }

    const metadata = sanitizeMetadata({
      ...detail.metadata,
      game_key: glitch.gameKey,
      app_version: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
      pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
      embedded_in_glitch: isEmbeddedInFrame(),
    });

    glitch.client.createEvent({
      game_install_id: glitch.installId,
      step_key: clampKey(detail.stepKey),
      action_key: clampKey(detail.actionKey),
      metadata,
      event_timestamp: new Date().toISOString(),
    }).catch((error) => {
      console.warn('[Glitch Analytics] Event failed:', error);
    });
  }, [glitch.client, glitch.enabled, glitch.gameKey, glitch.installId, glitch.status]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<GlitchBehaviorEventDetail>).detail;
      if (!detail?.stepKey || !detail.actionKey) return;
      sendEvent(detail);
    };
    window.addEventListener(GLITCH_BEHAVIOR_EVENT, listener);
    return () => window.removeEventListener(GLITCH_BEHAVIOR_EVENT, listener);
  }, [sendEvent]);

  useEffect(() => {
    if (!glitch.enabled || glitch.status !== 'validated' || !glitch.client || !glitch.installId) return;
    const queued = [...pendingEventsRef.current];
    pendingEventsRef.current = [];
    for (const event of queued) {
      sendEvent(event);
    }
  }, [glitch.client, glitch.enabled, glitch.installId, glitch.status, sendEvent]);

  const value = useMemo<GlitchAnalyticsContextValue>(() => ({
    trackEvent: emitGlitchBehaviorEvent,
  }), []);

  return (
    <GlitchAnalyticsContext.Provider value={value}>
      {children}
    </GlitchAnalyticsContext.Provider>
  );
}

export function useGlitchAnalytics(): GlitchAnalyticsContextValue {
  const context = useContext(GlitchAnalyticsContext);
  if (!context) {
    throw new Error('useGlitchAnalytics must be used within GlitchAnalyticsProvider');
  }
  return context;
}

function clampKey(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 100) || 'unknown';
}

function sanitizeMetadata(value: unknown, depth = 0): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const output: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSensitiveKey(key)) continue;
    const sanitized = sanitizeMetadataValue(nestedValue, depth);
    if (sanitized !== undefined) output[key.slice(0, 80)] = sanitized;
  }
  return output;
}

function sanitizeMetadataValue(value: unknown, depth: number): unknown {
  if (value === null) return null;
  if (typeof value === 'string') return value.slice(0, 160);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadataValue(item, depth + 1));
  if (typeof value === 'object') {
    if (depth >= MAX_METADATA_DEPTH) return '[object]';
    return sanitizeMetadata(value, depth + 1);
  }
  return undefined;
}

function isSensitiveKey(key: string): boolean {
  return /email|mail|token|secret|jwt|password|player_name|display_name|user_name|city_name|park_name/i.test(key);
}

function isEmbeddedInFrame(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}
