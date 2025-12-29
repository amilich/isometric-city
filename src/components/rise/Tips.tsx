'use client';

import React from 'react';

const tips = [
  'Shift + Right Click = Attack-Move with auto-acquire.',
  'Farms must be placed on fertile tiles; oil rigs on oil.',
  'Barracks enable infantry/ranged; factories for vehicles/siege; airbase for air (modern).',
  'Use minimap or Center buttons to jump quickly across the map.',
  'WASD / Arrow keys pan camera; Esc clears selection/build.',
  'Age Up unlocks after the minimum time and resource cost are met.',
  'Spread your army with shift-right-click; health bars show damage.',
];

export function Tips() {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 space-y-1">
      <div className="text-[10px] uppercase text-slate-500 font-semibold">Tips</div>
      <ul className="space-y-1">
        {tips.map(t => (
          <li key={t} className="leading-snug">
            • {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
