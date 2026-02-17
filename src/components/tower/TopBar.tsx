'use client';

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useTower } from '@/context/TowerContext';
import { Pause, Play, FastForward, Gauge, Waves } from 'lucide-react';
import { T, useGT } from 'gt-next';

function SpeedIcon({ speed }: { speed: 0 | 1 | 2 | 3 }) {
  if (speed === 0) return <Pause className="w-4 h-4" />;
  if (speed === 1) return <Play className="w-4 h-4" />;
  return <FastForward className={`w-4 h-4 ${speed === 3 ? 'opacity-100' : 'opacity-80'}`} />;
}

export function TopBar() {
  const gt = useGT();
  const { state, setSpeed, startWave, setActivePanel } = useTower();
  const { money, lives, stats, waveState, speed } = state;

  const waveLabel = useMemo(() => {
    if (waveState === 'idle' || waveState === 'complete') return gt('Ready');
    if (waveState === 'spawning') return gt('Spawning');
    if (waveState === 'in_progress') return gt('In Progress');
    if (waveState === 'game_over') return gt('Game Over');
    return waveState;
  }, [waveState, gt]);

  return (
    <div className="h-12 border-b border-border bg-background/90 backdrop-blur-sm flex items-center justify-between px-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <T><span className="text-muted-foreground">Money</span></T>
          <span data-testid="tower-money" className="font-mono text-amber-400">
            ${money.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <T><span className="text-muted-foreground">Lives</span></T>
          <span data-testid="tower-lives" className={`font-mono ${lives > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {lives}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <T><span className="text-muted-foreground">Wave</span></T>
          <span data-testid="tower-wave" className="font-mono text-white/90">
            {stats.wave}
          </span>
          <span data-testid="tower-wave-label" className="text-xs text-muted-foreground">
            ({waveLabel})
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => startWave()}
          disabled={waveState === 'in_progress' || waveState === 'spawning' || waveState === 'game_over'}
          className="gap-2"
          title={gt('Start the next wave')}
          data-testid="tower-start-wave"
        >
          <Waves className="w-4 h-4" />
          <T><span className="hidden sm:inline">Start Wave</span></T>
        </Button>

        <div className="flex items-center gap-1 border border-border rounded-md p-1">
          {([0, 1, 2, 3] as const).map((s) => (
            <Button
              key={s}
              variant={speed === s ? 'default' : 'ghost'}
              size="icon-sm"
              onClick={() => setSpeed(s)}
              title={s === 0 ? gt('Pause') : gt('{speed}x Speed', { speed: s })}
              className="h-8 w-8"
            >
              <SpeedIcon speed={s} />
            </Button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setActivePanel('stats')}
          title={gt('Stats')}
          className="h-8 w-8"
        >
          <Gauge className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

