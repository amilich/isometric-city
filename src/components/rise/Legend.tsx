'use client';

import React from 'react';
import { msg, useMessages } from 'gt-next';

const items = [
  { label: msg('Forest / Wood'), color: '#22c55e' },
  { label: msg('Mine / Metal'), color: '#f59e0b' },
  { label: msg('Oil'), color: '#0f172a' },
  { label: msg('Fertile / Farm'), color: '#84cc16' },
  { label: msg('Rare / Wealth'), color: '#c084fc' },
  { label: msg('Friendly Units'), color: '#a855f7' },
  { label: msg('Enemy Units'), color: '#facc15' },
  { label: msg('Friendly Buildings'), color: '#22d3ee' },
  { label: msg('Enemy Buildings'), color: '#f97316' },
  { label: msg('Friendly Territory'), color: 'rgba(56,189,248,0.35)' },
  { label: msg('Enemy Territory'), color: 'rgba(249,115,22,0.35)' },
  { label: msg('Alert Ping'), color: '#ef4444' },
];

export function Legend() {
  const m = useMessages();
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 space-y-2">
      <div className="text-[10px] uppercase text-slate-500 font-semibold">{m(msg('Legend'))}</div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-sm border border-slate-700" style={{ backgroundColor: item.color }} />
            <span className="leading-snug">{m(item.label)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
