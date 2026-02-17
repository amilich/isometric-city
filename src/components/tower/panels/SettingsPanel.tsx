'use client';

import React, { useState } from 'react';
import { useTower } from '@/context/TowerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { T, Var, useGT } from 'gt-next';

export function SettingsPanel() {
  const { state, setActivePanel, setSettings, exportState, loadState, newGame, saveRun } = useTower();
  const { settings, gridSize } = state;
  const gt = useGT();

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
          <DialogTitle><T>Settings</T></DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3"><T>Run Settings</T></div>

            <div className="space-y-3">
              <div>
                <Label><T>Run Name</T></Label>
                <Input
                  value={settings.name}
                  onChange={(e) => setSettings({ name: e.target.value })}
                  placeholder={gt('My defense run...')}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center justify-between py-2 gap-4">
                <div className="flex-1 min-w-0">
                  <Label><T>Show Grid</T></Label>
                  <p className="text-muted-foreground text-xs"><T>Draw tile outlines for easier placement</T></p>
                </div>
                <Switch checked={settings.showGrid} onCheckedChange={(checked) => setSettings({ showGrid: checked })} />
              </div>

              <div className="flex items-center justify-between py-2 gap-4">
                <div className="flex-1 min-w-0">
                  <Label><T>Hard Mode</T></Label>
                  <p className="text-muted-foreground text-xs"><T>Enemies have more HP</T></p>
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
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3"><T>Save</T></div>
            <div className="flex gap-2">
              <Button onClick={saveRun} className="flex-1">
                <T>Save Run</T>
              </Button>
              <Button variant="outline" onClick={handleCopyExport} className="flex-1">
                {exportCopied ? <T>Copied!</T> : <T>Copy Export</T>}
              </Button>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3"><T>Import</T></div>
            <div className="space-y-2">
              <Input
                value={importValue}
                onChange={(e) => setImportValue(e.target.value)}
                placeholder={gt('Paste exported JSON here...')}
              />
              <Button onClick={handleImport} variant="outline" className="w-full">
                <T>Load State</T>
              </Button>
              {importError && <div className="text-xs text-red-400 text-center"><T>Invalid game state.</T></div>}
              {importSuccess && <div className="text-xs text-green-400 text-center"><T>Loaded!</T></div>}
            </div>
          </div>

          <Separator />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3"><T>Info</T></div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span><T>Grid Size</T></span>
                <span className="text-foreground">
                  <T><Var>{gridSize}</Var> × <Var>{gridSize}</Var></T>
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span><T>Autosave</T></span>
                <span className="text-green-400"><T>Enabled</T></span>
              </div>
            </div>
          </div>

          <Separator />

          {!showNewGameConfirm ? (
            <Button variant="destructive" className="w-full" onClick={() => setShowNewGameConfirm(true)}>
              <T>Start New Run</T>
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm text-center"><T>Are you sure? This will reset your current run.</T></p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowNewGameConfirm(false)}>
                  <T>Cancel</T>
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
                  <T>Reset</T>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

