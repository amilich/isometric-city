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

export function TileInfoPanel({
  tile,
  onClose,
}: {
  tile: Tile;
  onClose: () => void;
}) {
  const { state, upgradeTower, sellTower } = useTower();

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
    <Card className="absolute top-4 right-4 w-80 z-50 bg-slate-950/90 border-slate-700 shadow-xl">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-sans">
          Tile ({tile.x}, {tile.y})
        </CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Terrain</span>
          <span className="capitalize">{tile.terrain}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Tile</span>
          <Badge variant="secondary" className="capitalize">
            {tile.kind}
          </Badge>
        </div>

        <Separator />

        {tile.tower ? (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tower</span>
              <span className="capitalize">{tile.tower.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Level</span>
              <span className="font-mono">{tile.tower.level}/3</span>
            </div>
            {towerInfo && (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dmg</span>
                    <span className="font-mono">{towerInfo.stats.damage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Range</span>
                    <span className="font-mono">{towerInfo.stats.range.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CD</span>
                    <span className="font-mono">{towerInfo.stats.fireCooldownTicks}t</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Refund</span>
                    <span className="font-mono text-amber-300">${towerInfo.refund}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={() => upgradeTower(tile.x, tile.y)}
                    disabled={!towerInfo.canUpgrade || tile.tower.level >= 3}
                    className="flex-1 gap-2"
                    size="sm"
                    title={towerInfo.canUpgrade ? `Upgrade for $${towerInfo.upgradeCost}` : 'Not enough money'}
                  >
                    <ArrowUp className="w-4 h-4" />
                    Upgrade
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => sellTower(tile.x, tile.y)}
                    className="gap-2"
                    size="sm"
                    title={`Sell for $${towerInfo.refund}`}
                  >
                    <DollarSign className="w-4 h-4" />
                    Sell
                  </Button>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-xs text-muted-foreground">No tower on this tile.</div>
        )}
      </CardContent>
    </Card>
  );
}

