'use client';

export const GLITCH_BEHAVIOR_EVENT = 'glitch:behavior-event';

export interface GlitchBehaviorEventDetail {
  stepKey: string;
  actionKey: string;
  metadata?: Record<string, unknown>;
}

export function emitGlitchBehaviorEvent(
  stepKey: string,
  actionKey: string,
  metadata: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<GlitchBehaviorEventDetail>(GLITCH_BEHAVIOR_EVENT, {
    detail: { stepKey, actionKey, metadata },
  }));
}
