'use client';

import React, { useState } from 'react';
import { T, Var, useGT } from 'gt-next';
import { useCoaster } from '@/context/CoasterContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function formatCurrency(value: number) {
  return `$${value.toLocaleString()}`;
}

function PanelWrapper({ title, children, onClose }: { title: React.ReactNode; children: React.ReactNode; onClose: () => void }) {
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
  const gt = useGT();

  return (
    <PanelWrapper title={<T>Finances</T>} onClose={onClose}>
      <T>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-white/50 text-xs uppercase">Cash</div>
            <div className="text-green-400 font-semibold"><Var>{formatCurrency(finances.cash)}</Var></div>
          </div>
          <div>
            <div className="text-white/50 text-xs uppercase">Profit</div>
            <div className={`font-semibold ${finances.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              <Var>{formatCurrency(finances.profit)}</Var>
            </div>
          </div>
        </div>
      </T>

      <T>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-white/80">
            <span>Admissions</span>
            <span className="text-green-300"><Var>{formatCurrency(finances.incomeAdmissions)}</Var></span>
          </div>
          <div className="flex items-center justify-between text-white/80">
            <span>Ride Tickets</span>
            <span className="text-green-300"><Var>{formatCurrency(finances.incomeRides)}</Var></span>
          </div>
          <div className="flex items-center justify-between text-white/80">
            <span>Food & Drinks</span>
            <span className="text-green-300"><Var>{formatCurrency(finances.incomeFood)}</Var></span>
          </div>
          <div className="flex items-center justify-between text-white/80">
            <span>Shops</span>
            <span className="text-green-300"><Var>{formatCurrency(finances.incomeShops)}</Var></span>
          </div>
        </div>
      </T>

      <T>
        <div className="border-t border-slate-800 pt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between text-white/70">
            <span>Upkeep</span>
            <span className="text-red-300"><Var>{formatCurrency(finances.expenseUpkeep)}</Var></span>
          </div>
          <div className="flex items-center justify-between text-white/70">
            <span>Wages</span>
            <span className="text-red-300"><Var>{formatCurrency(finances.expenseWages)}</Var></span>
          </div>
        </div>
      </T>

      {finances.history.length > 0 && (
        <div>
          <T>
            <div className="text-xs uppercase text-white/50 tracking-wide mb-2">Recent Months</div>
          </T>
          <div className="space-y-2 text-xs text-white/70">
            {finances.history.slice(-4).map(point => (
              <div key={`${point.month}-${point.year}`} className="flex justify-between">
                <span>{gt('Y{year} M{month}', { year: point.year, month: point.month })}</span>
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

// Helper function to load example state with proper error handling
async function loadExampleState(
  filename: string,
  loadState: (stateString: string) => boolean,
  setActivePanel: (panel: 'none' | 'finances' | 'guests' | 'rides' | 'staff' | 'settings') => void,
  alertMessages: {
    failedToLoad: (status: number) => string;
    invalidFormat: string;
    errorLoading: (error: unknown) => string;
  }
): Promise<void> {
  try {
    const response = await fetch(`/example-states-coaster/${filename}`);
    if (!response.ok) {
      console.error(`Failed to fetch ${filename}:`, response.status);
      alert(alertMessages.failedToLoad(response.status));
      return;
    }
    const exampleState = await response.json();
    const success = loadState(JSON.stringify(exampleState));
    if (success) {
      setActivePanel('none');
    } else {
      console.error('loadState returned false - invalid state format for', filename);
      alert(alertMessages.invalidFormat);
    }
  } catch (e) {
    console.error('Error loading example state:', e);
    alert(alertMessages.errorLoading(e));
  }
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { state, setParkSettings, exportState, loadState, setActivePanel, newGame } = useCoaster();
  const { settings, gridSize } = state;
  const gt = useGT();

  const [importValue, setImportValue] = useState('');
  const [exportCopied, setExportCopied] = useState(false);
  const [importError, setImportError] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [newParkName, setNewParkName] = useState(settings.name);

  const handleCopyExport = async () => {
    const exported = exportState();
    await navigator.clipboard.writeText(exported);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2000);
  };

  const handleImport = () => {
    setImportError(false);
    setImportSuccess(false);
    if (importValue.trim()) {
      const success = loadState(importValue.trim());
      if (success) {
        setImportSuccess(true);
        setImportValue('');
        setTimeout(() => setImportSuccess(false), 2000);
      } else {
        setImportError(true);
      }
    }
  };

  const alertMessages = {
    failedToLoad: (status: number) => gt('Failed to load example state: {status}', { status }),
    invalidFormat: gt('Failed to load example state: invalid format'),
    errorLoading: (error: unknown) => gt('Error loading example state: {error}', { error: String(error) }),
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[400px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle><T>Settings</T></DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Park Settings */}
          <div>
            <T>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Park Settings</div>
            </T>
            <div className="space-y-4">
              <div>
                <T>
                  <label className="text-sm font-medium">Entrance Fee</label>
                </T>
                <Input
                  type="number"
                  min={0}
                  value={settings.entranceFee}
                  onChange={(e) => setParkSettings({ entranceFee: Math.max(0, Number(e.target.value)) })}
                  className="mt-1"
                  disabled={settings.payPerRide}
                />
                {settings.payPerRide && (
                  <T>
                    <p className="text-xs text-muted-foreground mt-1">Disabled while pay-per-ride is enabled.</p>
                  </T>
                )}
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <T>
                    <div className="text-sm font-medium">Pay Per Ride</div>
                    <p className="text-xs text-muted-foreground">Charge guests per ride instead of admission</p>
                  </T>
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
          </div>

          <Separator />

          {/* Park Information */}
          <div>
            <T>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Park Information</div>
            </T>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span><T>Park Name</T></span>
                <span className="text-foreground">{settings.name}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span><T>Grid Size</T></span>
                <span className="text-foreground">{gt('{size} x {size}', { size: gridSize })}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span><T>Auto-Save</T></span>
                <span className="text-green-400"><T>Enabled</T></span>
              </div>
            </div>
          </div>

          <Separator />

          {/* New Game */}
          {!showNewGameConfirm ? (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowNewGameConfirm(true)}
            >
              <T>Start New Park</T>
            </Button>
          ) : (
            <div className="space-y-3">
              <T>
                <p className="text-muted-foreground text-sm text-center">Are you sure? This will reset all progress.</p>
              </T>
              <Input
                value={newParkName}
                onChange={(e) => setNewParkName(e.target.value)}
                placeholder={gt('New park name...')}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowNewGameConfirm(false)}
                >
                  <T>Cancel</T>
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    newGame(newParkName || gt('My Theme Park'));
                    setActivePanel('none');
                  }}
                >
                  <T>Reset</T>
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Export Game */}
          <div>
            <T>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Export Game</div>
              <p className="text-muted-foreground text-xs mb-2">Copy your game state to share or backup</p>
            </T>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCopyExport}
            >
              {exportCopied ? <T>✓ Copied!</T> : <T>Copy Game State</T>}
            </Button>
          </div>

          {/* Import Game */}
          <div>
            <T>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Import Game</div>
              <p className="text-muted-foreground text-xs mb-2">Paste a game state to load it</p>
            </T>
            <textarea
              className="w-full h-20 bg-background border border-border rounded-md p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={gt('Paste game state here...')}
              value={importValue}
              onChange={(e) => {
                setImportValue(e.target.value);
                setImportError(false);
                setImportSuccess(false);
              }}
            />
            {importError && (
              <T>
                <p className="text-red-400 text-xs mt-1">Invalid game state. Please check and try again.</p>
              </T>
            )}
            {importSuccess && (
              <T>
                <p className="text-green-400 text-xs mt-1">Game loaded successfully!</p>
              </T>
            )}
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={handleImport}
              disabled={!importValue.trim()}
            >
              <T>Load Game State</T>
            </Button>
          </div>

          <Separator />

          {/* Developer Tools */}
          <div>
            <T>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Developer Tools</div>
            </T>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => loadExampleState('example_state.json', loadState, setActivePanel, alertMessages)}
            >
              <T>Load Example State</T>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
