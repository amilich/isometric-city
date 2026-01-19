'use client';

import React from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';

interface SettingsPanelProps {
  onExit?: () => void;
}

export function SettingsPanel({ onExit }: SettingsPanelProps) {
  const { setActivePanel, savePark, newPark, exportState } = useCoaster();

  const handleExport = () => {
    const data = exportState();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coaster-park-save.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="fixed top-16 right-4 w-80 max-h-[calc(100vh-5rem)] bg-slate-900/95 border-white/10 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-white font-bold">Settings</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActivePanel('none')}
          className="h-6 w-6 text-white/50 hover:text-white hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Save */}
          <div>
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">Save & Load</h3>
            <div className="space-y-2">
              <Button 
                onClick={savePark}
                className="w-full bg-green-600 hover:bg-green-500"
              >
                💾 Save Park
              </Button>
              <Button 
                onClick={handleExport}
                variant="outline"
                className="w-full border-white/20 text-white"
              >
                📤 Export Save File
              </Button>
            </div>
          </div>

          {/* New Game */}
          <div>
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">New Game</h3>
            <Button 
              onClick={() => {
                if (confirm('Start a new park? Your current progress will be lost if not saved.')) {
                  newPark();
                }
              }}
              variant="outline"
              className="w-full border-white/20 text-white"
            >
              🏗️ New Park
            </Button>
          </div>

          {/* Exit */}
          {onExit && (
            <div>
              <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">Exit</h3>
              <Button 
                onClick={onExit}
                variant="outline"
                className="w-full border-red-500/50 text-red-400 hover:bg-red-500/20"
              >
                🚪 Exit to Menu
              </Button>
            </div>
          )}

          {/* About */}
          <div className="pt-4 border-t border-white/10">
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">About</h3>
            <p className="text-white/40 text-sm">
              Coaster Tycoon - Built with ❤️ using IsoCity engine
            </p>
            <p className="text-white/30 text-xs mt-2">
              Use arrow keys or WASD to pan, scroll to zoom
            </p>
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
}
