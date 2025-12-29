'use client';

import React from 'react';
import { msg, useMessages } from 'gt-next';

const tips = [
  msg('Shift + Right Click = Attack-Move with auto-acquire.'),
  msg('Farms must be placed on fertile tiles; oil rigs on oil.'),
  msg('Barracks enable infantry/ranged; factories for vehicles/siege; airbase for air (modern).'),
  msg('Use minimap or Center buttons to jump quickly across the map.'),
  msg('WASD / Arrow keys pan camera; H/E center on you/enemy; J jumps to last alert; Esc clears selection/build.'),
  msg('Toggle alerts (toasts/pings) with the Alerts button or hotkey L.'),
  msg('Age Up unlocks after the minimum time and resource cost are met.'),
  msg('Spread your army with shift-right-click; health bars show damage.'),
];

export function Tips() {
  const m = useMessages();
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 space-y-1">
      <div className="text-[10px] uppercase text-slate-500 font-semibold">{m(msg('Tips'))}</div>
      <ul className="space-y-1">
        {tips.map(t => (
          <li key={t} className="leading-snug">
            • {m(t)}
          </li>
        ))}
      </ul>
    </div>
  );
}
