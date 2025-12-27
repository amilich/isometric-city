'use client';

import React from 'react';
import { Tile } from '@/types/game';
import { BUILDING_UPGRADES } from '@/config/buildingUpgrades';
import { getUpgradeCost } from '@/lib/upgradeUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TOOL_INFO } from '@/types/game';

interface BuildingUpgradeUIProps {
  tile: Tile;
  money: number;
  onUpgrade: (x: number, y: number) => void;
}

export function BuildingUpgradeUI({ tile, money, onUpgrade }: BuildingUpgradeUIProps) {
  const building = tile.building;
  const upgradeConfig = BUILDING_UPGRADES[building.type];

  if (!upgradeConfig) return null;

  // Get base cost from TOOL_INFO if available
  const toolInfo = TOOL_INFO[building.type as keyof typeof TOOL_INFO];
  const baseCost = toolInfo?.cost || 0;
  const upgradeCost = getUpgradeCost(building.type, baseCost);
  const canAfford = money >= upgradeCost;
  const isUpgraded = building.isUpgraded;

  return (
    <div className="space-y-3 mt-2 pt-3 border-t border-border/40">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Building Upgrade</span>
        {isUpgraded && (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] py-0 h-4">
            UPGRADED
          </Badge>
        )}
      </div>
      
      {!isUpgraded ? (
        <>
          <p className="text-[11px] leading-relaxed text-muted-foreground italic">
            &quot;{upgradeConfig.description}&quot;
          </p>
          
          <div className="bg-muted/30 p-2 rounded-md space-y-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Range</span>
                <span className="text-green-400">+{Math.round((upgradeConfig.rangeMultiplier - 1) * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effectiveness</span>
                <span className="text-green-400">+{Math.round((upgradeConfig.effectMagnitudeMultiplier - 1) * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Maintenance</span>
                <span className="text-red-400">x{upgradeConfig.maintenanceMultiplier}</span>
              </div>
              {upgradeConfig.pollutionMultiplier < 1 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pollution</span>
                  <span className="text-green-400">-{Math.round((1 - upgradeConfig.pollutionMultiplier) * 100)}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs px-1">
              <span className="text-muted-foreground">Cost:</span>
              <span className={canAfford ? 'font-mono text-green-400' : 'font-mono text-red-400'}>
                ${upgradeCost.toLocaleString()}
              </span>
            </div>
            <Button 
              variant="default" 
              size="sm" 
              className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs h-8 shadow-sm"
              disabled={!canAfford}
              onClick={(e) => {
                e.stopPropagation();
                onUpgrade(tile.x, tile.y);
              }}
            >
              Apply Upgrade
            </Button>
          </div>
        </>
      ) : (
        <div className="bg-purple-500/5 border border-purple-500/10 p-2 rounded-md">
          <p className="text-[11px] text-purple-300 text-center">
            This facility has been upgraded to peak performance.
          </p>
        </div>
      )}
    </div>
  );
}
