'use client';

import React, { useState } from 'react';
import { useTower } from '@/context/TowerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export function SettingsPanel() {
  const { state, setActivePanel, setSettings, exportState, loadState, newGame, saveRun } = useTower();
  const { settings, gridSize } = state;

  const [importValue, setImportValue] = useState('');
  const [exportCopied, setExportCopied] = useState(false);
  const [importError, setImportError] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);

  const handleCopyExport = async () => {
    const exported = exportState();
    await navigator.clipboard.writeText(exported);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2000);
  };

  const handleImport = () => {
    setImportError(false);
    setImportSuccess(false);
    if (!importValue.trim()) return;
    const ok = loadState(importValue.trim());
    if (ok) {
      setImportSuccess(true);
      setImportValue('');
      setTimeout(() => setImportSuccess(false), 2000);
    } else {
      setImportError(true);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[420px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Run Settings</div>

            <div className="space-y-3">
              <div>
                <Label>Run Name</Label>
                <Input
                  value={settings.name}
                  onChange={(e) => setSettings({ name: e.target.value })}
                  placeholder="My defense run..."
                  className="mt-1"
                />
              </div>

              <div className="flex items-center justify-between py-2 gap-4">
                <div className="flex-1 min-w-0">
                  <Label>Show Grid</Label>
                  <p className="text-muted-foreground text-xs">Draw tile outlines for easier placement</p>
                </div>
                <Switch checked={settings.showGrid} onCheckedChange={(checked) => setSettings({ showGrid: checked })} />
              </div>

              <div className="flex items-center justify-between py-2 gap-4">
                <div className="flex-1 min-w-0">
                  <Label>Hard Mode</Label>
                  <p className="text-muted-foreground text-xs">Enemies have more HP</p>
                </div>
                <Switch
                  checked={settings.difficulty === 'hard'}
                  onCheckedChange={(checked) => setSettings({ difficulty: checked ? 'hard' : 'normal' })}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Save</div>
            <div className="flex gap-2">
              <Button onClick={saveRun} className="flex-1">
                Save Run
              </Button>
              <Button variant="outline" onClick={handleCopyExport} className="flex-1">
                {exportCopied ? 'Copied!' : 'Copy Export'}
              </Button>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Import</div>
            <div className="space-y-2">
              <textarea
                className="w-full h-24 bg-background border border-border rounded-md p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Paste exported JSON here..."
                value={importValue}
                onChange={(e) => {
                  setImportValue(e.target.value);
                  setImportError(false);
                  setImportSuccess(false);
                }}
              />
              <Button onClick={handleImport} variant="outline" className="w-full" disabled={!importValue.trim()}>
                Load State
              </Button>
              {importError && <div className="text-xs text-red-400 text-center">Invalid game state.</div>}
              {importSuccess && <div className="text-xs text-green-400 text-center">Loaded!</div>}
            </div>
          </div>

          <Separator />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Info</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Grid Size</span>
                <span className="text-foreground">
                  {gridSize} × {gridSize}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Autosave</span>
                <span className="text-green-400">Enabled</span>
              </div>
            </div>
          </div>

          <Separator />

          {!showNewGameConfirm ? (
            <Button variant="destructive" className="w-full" onClick={() => setShowNewGameConfirm(true)}>
              Start New Run
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm text-center">Are you sure? This will reset your current run.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowNewGameConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    newGame();
                    setShowNewGameConfirm(false);
                    setActivePanel('none');
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

