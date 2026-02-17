'use client';

import React, { useMemo } from 'react';
import { T, Var, useGT } from 'gt-next';
import { Button } from '@/components/ui/button';
import { useTower } from '@/context/TowerContext';
import { Pause, Play, FastForward, Gauge, Waves, LogOut } from 'lucide-react';

function SpeedIcon({ speed }: { speed: 0 | 1 | 2 | 3 }) {
  if (speed === 0) return <Pause className="w-4 h-4" />;
  if (speed === 1) return <Play className="w-4 h-4" />;
  return <FastForward className={`w-4 h-4 ${speed === 3 ? 'opacity-100' : 'opacity-80'}`} />;
}

export function TopBar({ onExit }: { onExit?: () => void }) {
  const gt = useGT();
  const { state, setSpeed, startWave, setActivePanel } = useTower();
  const { money, lives, stats, waveState, speed } = state;

  const waveLabel = useMemo(() => {
    if (waveState === 'idle' || waveState === 'complete') return gt('Ready');
    if (waveState === 'spawning') return gt('Spawning');
    if (waveState === 'in_progress') return gt('In Progress');
    if (waveState === 'victory') return gt('Victory');
    if (waveState === 'game_over') return gt('Game Over');
    return waveState;
  }, [waveState, gt]);

  return (
    <div className="h-12 border-b border-border bg-background/90 backdrop-blur-sm flex items-center justify-between px-3">
      <div className="flex items-center gap-3">
        <T>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Money</span>
            <span data-testid="tower-money" className="font-mono text-amber-400">
              $<Var>{money.toLocaleString()}</Var>
            </span>
          </div>
        </T>
        <T>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Lives</span>
            <span data-testid="tower-lives" className={`font-mono ${lives > 0 ? 'text-green-400' : 'text-red-400'}`}>
              <Var>{lives}</Var>
            </span>
          </div>
        </T>
        <T>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Wave</span>
            <span data-testid="tower-wave" className="font-mono text-white/90">
              <Var>{stats.wave}</Var>
            </span>
            <span data-testid="tower-wave-label" className="text-xs text-muted-foreground">
              (<Var>{waveLabel}</Var>)
            </span>
          </div>
        </T>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => startWave()}
          disabled={waveState === 'in_progress' || waveState === 'spawning' || waveState === 'victory' || waveState === 'game_over'}
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
              title={s === 0 ? gt('Pause') : gt('{s}x Speed', { s })}
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

        {onExit && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onExit}
            title={gt('Exit to Menu')}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

