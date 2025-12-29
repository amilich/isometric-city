'use client';

import React, { useMemo } from 'react';
import { RiseGameState } from '@/games/rise/types';
import { T, Num, Var } from 'gt-next';

export function SelectionPanel({ state }: { state: RiseGameState }) {
  const selected = useMemo(() => state.units.filter(u => state.selectedUnitIds.has(u.id)), [state]);
  if (selected.length === 0) return null;

  const totalHp = selected.reduce((s, u) => s + u.hp, 0);
  const totalMax = selected.reduce((s, u) => s + u.maxHp, 0);
  const types = Array.from(new Set(selected.map(u => u.type)));
  const order = selected[0]?.order?.kind ?? 'idle';

  return (
    <div className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-sm text-slate-100 shadow">
      <div className="flex items-center justify-between">
        <T>
          <div className="font-semibold"><Num>{selected.length}</Num> selected</div>
        </T>
        <div className="text-xs text-slate-400">{types.join(', ')}</div>
      </div>
      <T>
        <div className="mt-1 text-xs text-slate-300">
          Order: <span className="text-amber-200 capitalize"><Var>{order}</Var></span>
        </div>
      </T>
      <div className="mt-1">
        <div className="h-2 rounded bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${Math.max(0, Math.min(100, (totalHp / Math.max(1, totalMax)) * 100))}%` }}
          />
        </div>
        <T>
          <div className="text-[11px] text-slate-400 mt-0.5">
            HP <Num>{Math.round(totalHp)}</Num> / <Num>{Math.round(totalMax)}</Num>
          </div>
        </T>
      </div>
    </div>
  );
}
