'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { CloseIcon, InfoIcon, RoadIcon, TrophyIcon, WaterIcon, MoneyIcon, FireIcon, AlertIcon } from '@/components/ui/Icons';

const TTL_MS = 8000;
const MAX_VISIBLE = 3;

function getIconComponent(iconName: string) {
  switch (iconName) {
    case 'trophy':
      return TrophyIcon;
    case 'ship':
      // No dedicated ship icon currently; WaterIcon communicates "maritime" well
      return WaterIcon;
    case 'road':
      return RoadIcon;
    case 'money':
      return MoneyIcon;
    case 'fire':
      return FireIcon;
    case 'alert':
    case 'disaster':
      return AlertIcon;
    default:
      return InfoIcon;
  }
}

export function NotificationsToasts({ isMobile = false }: { isMobile?: boolean }) {
  const { state } = useGame();
  const [dismissed, setDismissed] = useState<Record<string, true>>({});
  const [now, setNow] = useState(() => Date.now());

  const visible = useMemo(() => {
    const cutoff = now - TTL_MS;

    return state.notifications
      .filter((n) => n.timestamp >= cutoff)
      .filter((n) => !dismissed[n.id])
      .slice(0, MAX_VISIBLE);
  }, [state.notifications, dismissed, now]);

  // Tick time forward only while we have something visible, so toasts can expire even if the game is paused
  useEffect(() => {
    if (visible.length === 0) return;

    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [visible.length]);

  // Prune dismissed IDs so the map doesn't grow indefinitely
  useEffect(() => {
    if (Object.keys(dismissed).length === 0) return;

    const activeIds = new Set(state.notifications.map((n) => n.id));
    const next: Record<string, true> = {};
    for (const id of Object.keys(dismissed)) {
      if (activeIds.has(id)) next[id] = true;
    }
    if (Object.keys(next).length !== Object.keys(dismissed).length) {
      setDismissed(next);
    }
  }, [state.notifications, dismissed]);

  const dismiss = (id: string) => {
    setDismissed((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  };

  if (visible.length === 0) return null;

  return (
    <div
      className={[
        'pointer-events-none fixed right-4 z-[60] flex flex-col gap-2',
        isMobile ? 'top-16' : 'top-4',
      ].join(' ')}
    >
      {visible.map((n) => {
        const Icon = getIconComponent(n.icon);

        return (
          <div
            key={n.id}
            className="pointer-events-auto w-[320px] max-w-[calc(100vw-2rem)] rounded-md border border-white/10 bg-background/90 backdrop-blur shadow-lg"
          >
            <div className="flex gap-3 p-3">
              <div className="mt-0.5 text-muted-foreground">
                <Icon size={18} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-snug">{n.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground leading-snug">{n.description}</div>
              </div>

              <button
                type="button"
                onClick={() => dismiss(n.id)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss notification"
              >
                <CloseIcon size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
