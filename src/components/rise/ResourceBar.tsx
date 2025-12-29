import React from 'react';
import { ResourcePool } from '@/games/rise/types';
import { msg, useMessages } from 'gt-next';

const LABELS: Record<keyof ResourcePool, string> = {
  food: msg('Food'),
  wood: msg('Wood'),
  metal: msg('Metal'),
  oil: msg('Oil'),
  wealth: msg('Wealth'),
  knowledge: msg('Knowledge'),
  population: msg('Pop'),
  popCap: msg('Cap'),
};

const ORDER: (keyof ResourcePool)[] = ['food', 'wood', 'metal', 'oil', 'wealth', 'knowledge', 'population', 'popCap'];

export function ResourceBar({ resources }: { resources: ResourcePool }) {
  const m = useMessages();
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/80 text-sm border border-slate-700 rounded-lg shadow-lg">
      {ORDER.map(key => (
        <div key={key} className="flex items-center gap-1 text-slate-100">
          <span className="text-xs uppercase text-slate-400">{m(LABELS[key])}</span>
          <span className="font-semibold">
            {key === 'population' || key === 'popCap'
              ? Math.floor(resources[key])
              : Math.floor(resources[key])}
          </span>
        </div>
      ))}
    </div>
  );
}
