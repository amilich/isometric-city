'use client';

import React from 'react';
import { T, Var, Branch, useMessages } from 'gt-next';
import { AGE_CONFIGS } from '@/games/rise/constants';
import { AgeId } from '@/games/rise/types';

export function AgeProgress({
  age,
  elapsedSinceAge,
}: {
  age: AgeId;
  elapsedSinceAge: number;
}) {
  const m = useMessages();
  const currentIndex = AGE_CONFIGS.findIndex(a => a.id === age);
  const next = AGE_CONFIGS[currentIndex + 1];
  if (!next) return null;
  const required = next.minDurationSeconds ?? 0;
  const progress = Math.max(0, Math.min(1, required === 0 ? 1 : elapsedSinceAge / required));
  const remaining = Math.max(0, Math.ceil(required - elapsedSinceAge));

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 space-y-1">
      <div className="flex items-center justify-between">
        <T><span className="uppercase text-[10px] text-slate-400">Next Age</span></T>
        <span className="font-semibold">{m(next.label)}</span>
      </div>
      <div className="h-2 rounded bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-indigo-500"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <div className="text-[11px] text-slate-400">
        <T>
          <Branch
            branch={progress >= 1 ? 'ready' : 'locked'}
            ready={<>Ready (time met)</>}
            locked={<>Unlocks in ~<Var>{remaining}</Var>s</>}
          />
        </T>
      </div>
    </div>
  );
}
