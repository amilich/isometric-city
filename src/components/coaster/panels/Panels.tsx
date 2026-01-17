'use client';

import React from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

function formatCurrency(value: number) {
  return `$${value.toLocaleString()}`;
}

function PanelWrapper({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Card className="absolute top-20 right-8 w-[360px] bg-slate-950/95 border-slate-700 shadow-xl z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 className="text-sm font-semibold tracking-wide text-white/90 uppercase">{title}</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-white/60 hover:text-white">
          ✕
        </Button>
      </div>
      <ScrollArea className="max-h-[360px]">
        <div className="p-4 space-y-4">{children}</div>
      </ScrollArea>
    </Card>
  );
}

function FinancesPanel({ onClose }: { onClose: () => void }) {
  const { state } = useCoaster();
  const { finances } = state;
  
  return (
    <PanelWrapper title="Finances" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-white/50 text-xs uppercase">Cash</div>
          <div className="text-green-400 font-semibold">{formatCurrency(finances.cash)}</div>
        </div>
        <div>
          <div className="text-white/50 text-xs uppercase">Profit</div>
          <div className={`font-semibold ${finances.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(finances.profit)}
          </div>
        </div>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between text-white/80">
          <span>Admissions</span>
          <span className="text-green-300">{formatCurrency(finances.incomeAdmissions)}</span>
        </div>
        <div className="flex items-center justify-between text-white/80">
          <span>Ride Tickets</span>
          <span className="text-green-300">{formatCurrency(finances.incomeRides)}</span>
        </div>
        <div className="flex items-center justify-between text-white/80">
          <span>Food & Drinks</span>
          <span className="text-green-300">{formatCurrency(finances.incomeFood)}</span>
        </div>
        <div className="flex items-center justify-between text-white/80">
          <span>Shops</span>
          <span className="text-green-300">{formatCurrency(finances.incomeShops)}</span>
        </div>
      </div>
      
      <div className="border-t border-slate-800 pt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between text-white/70">
          <span>Upkeep</span>
          <span className="text-red-300">{formatCurrency(finances.expenseUpkeep)}</span>
        </div>
        <div className="flex items-center justify-between text-white/70">
          <span>Wages</span>
          <span className="text-red-300">{formatCurrency(finances.expenseWages)}</span>
        </div>
      </div>
      
      {finances.history.length > 0 && (
        <div>
          <div className="text-xs uppercase text-white/50 tracking-wide mb-2">Recent Months</div>
          <div className="space-y-2 text-xs text-white/70">
            {finances.history.slice(-4).map(point => (
              <div key={`${point.month}-${point.year}`} className="flex justify-between">
                <span>Y{point.year} M{point.month}</span>
                <span className={point.profit >= 0 ? 'text-green-300' : 'text-red-300'}>
                  {formatCurrency(point.profit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </PanelWrapper>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { state, setParkSettings } = useCoaster();
  const { settings } = state;
  
  return (
    <PanelWrapper title="Settings" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div>
          <label className="text-white/70 text-xs uppercase">Entrance Fee</label>
          <Input
            type="number"
            min={0}
            value={settings.entranceFee}
            onChange={(e) => setParkSettings({ entranceFee: Math.max(0, Number(e.target.value)) })}
            className="mt-1 bg-slate-900 border-slate-700 text-white"
            disabled={settings.payPerRide}
          />
          {settings.payPerRide && (
            <div className="text-xs text-white/40 mt-1">Disabled while pay-per-ride is enabled.</div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white/70 text-xs uppercase">Pay Per Ride</div>
            <div className="text-white/50 text-xs">Charge guests per ride instead of admission</div>
          </div>
          <Switch
            checked={settings.payPerRide}
            onCheckedChange={(checked) =>
              setParkSettings({
                payPerRide: checked,
                entranceFee: checked ? 0 : settings.entranceFee,
              })
            }
          />
        </div>
      </div>
    </PanelWrapper>
  );
}

export function Panels() {
  const { state, setActivePanel } = useCoaster();
  
  if (state.activePanel === 'finances') {
    return <FinancesPanel onClose={() => setActivePanel('none')} />;
  }
  
  if (state.activePanel === 'settings') {
    return <SettingsPanel onClose={() => setActivePanel('none')} />;
  }
  
  return null;
}
