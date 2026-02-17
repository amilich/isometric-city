'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTower } from '@/context/TowerContext';
import { TOOL_INFO, type Tile, type Tool } from '@/games/tower/types';
import { TOWER_DEFINITIONS, clampTowerLevel, getTowerStats } from '@/games/tower/types/towers';
import { X, ArrowUp, DollarSign } from 'lucide-react';
import { T, Var, useGT, msg, useMessages } from 'gt-next';
import type { Terrain, TileKind } from '@/games/tower/types';
import type { TowerType } from '@/games/tower/types/towers';

const TERRAIN_LABELS: Record<Terrain, string> = {
  grass: msg('grass', { context: 'terrain type' }),
  water: msg('water', { context: 'terrain type' }),
};

const TILE_KIND_LABELS: Record<TileKind, string> = {
  empty: msg('empty', { context: 'tile type (empty, path, spawn, or base)' }),
  path: msg('path', { context: 'tile type (empty, path, spawn, or base)' }),
  spawn: msg('spawn', { context: 'tile type (empty, path, spawn, or base)' }),
  base: msg('base', { context: 'tile type (empty, path, spawn, or base)' }),
};

const TOWER_TYPE_LABELS: Record<TowerType, string> = {
  cannon: msg('cannon', { context: 'tower type' }),
  archer: msg('archer', { context: 'tower type' }),
  tesla: msg('tesla', { context: 'tower type' }),
  ice: msg('ice', { context: 'tower type' }),
  mortar: msg('mortar', { context: 'tower type' }),
  sniper: msg('sniper', { context: 'tower type' }),
};

export function TileInfoPanel({
  tile,
  onClose,
  isMobile = false,
}: {
  tile: Tile;
  onClose: () => void;
  isMobile?: boolean;
}) {
  const { state, upgradeTower, sellTower } = useTower();
  const gt = useGT();
  const m = useMessages();

  const towerInfo = useMemo(() => {
    if (!tile.tower) return null;
    const def = TOWER_DEFINITIONS[tile.tower.type];
    const stats = getTowerStats(tile.tower.type, tile.tower.level);
    const nextLevel = tile.tower.level < 3 ? clampTowerLevel(tile.tower.level + 1) : null;
    const upgradeTool = `tower_${tile.tower.type}` as Tool;
    const upgradeCost = TOOL_INFO[upgradeTool]?.cost ?? 0;
    const canUpgrade = nextLevel !== null && state.money >= upgradeCost;
    const refund = Math.floor(tile.tower.totalSpent * def.sellRefundRatio);
    return { def, stats, nextLevel, upgradeCost, canUpgrade, refund };
  }, [tile.tower, state.money]);

  return (
    <Card
      className={
        isMobile
          ? 'absolute top-2 left-2 right-2 z-50 bg-slate-950/90 border-slate-700 shadow-xl'
          : 'absolute top-4 right-4 w-80 z-50 bg-slate-950/90 border-slate-700 shadow-xl'
      }
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-sans">
          <T>
            Tile (<Var>{tile.x}</Var>, <Var>{tile.y}</Var>)
          </T>
        </CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground"><T>Terrain</T></span>
          <span className="capitalize">{m(TERRAIN_LABELS[tile.terrain])}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground"><T>Tile</T></span>
          <Badge variant="secondary" className="capitalize">
            {m(TILE_KIND_LABELS[tile.kind])}
          </Badge>
        </div>

        <Separator />

        {tile.tower ? (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground"><T>Tower</T></span>
              <span className="capitalize">{m(TOWER_TYPE_LABELS[tile.tower.type])}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground"><T>Level</T></span>
              <span className="font-mono"><T><Var>{tile.tower.level}</Var>/3</T></span>
            </div>
            {towerInfo && (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground"><T context="abbreviation for damage">Dmg</T></span>
                    <span className="font-mono">{towerInfo.stats.damage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground"><T>Range</T></span>
                    <span className="font-mono">{towerInfo.stats.range.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground"><T context="abbreviation for cooldown">CD</T></span>
                    <span className="font-mono"><T><Var>{towerInfo.stats.fireCooldownTicks}</Var>t</T></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground"><T>Refund</T></span>
                    <span className="font-mono text-amber-300"><T>$<Var>{towerInfo.refund}</Var></T></span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={() => upgradeTower(tile.x, tile.y)}
                    disabled={!towerInfo.canUpgrade || tile.tower.level >= 3}
                    className="flex-1 gap-2"
                    size="sm"
                    title={towerInfo.canUpgrade ? gt('Upgrade for ${cost}', { cost: towerInfo.upgradeCost }) : gt('Not enough money')}
                  >
                    <ArrowUp className="w-4 h-4" />
                    <T>Upgrade</T>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => sellTower(tile.x, tile.y)}
                    className="gap-2"
                    size="sm"
                    title={gt('Sell for ${refund}', { refund: towerInfo.refund })}
                  >
                    <DollarSign className="w-4 h-4" />
                    <T>Sell</T>
                  </Button>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-xs text-muted-foreground"><T>No tower on this tile.</T></div>
        )}
      </CardContent>
    </Card>
  );
}

