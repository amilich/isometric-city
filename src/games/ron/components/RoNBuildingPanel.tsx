/**
 * Rise of Nations - Building Info Panel
 * 
 * Displays building information and allows queuing units for production buildings.
 */
'use client';

import React from 'react';
import { useRoN } from '../context/RoNContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BUILDING_STATS, RoNBuildingType, UNIT_PRODUCTION_BUILDINGS } from '../types/buildings';
import { UNIT_STATS, UnitType } from '../types/units';
import { ResourceType } from '../types/resources';

interface RoNBuildingPanelProps {
  onClose: () => void;
}

export function RoNBuildingPanel({ onClose }: RoNBuildingPanelProps) {
  const { state, getCurrentPlayer, queueUnit, selectBuilding } = useRoN();
  const currentPlayer = getCurrentPlayer();
  
  if (!state.selectedBuildingPos || !currentPlayer) return null;
  
  const { x, y } = state.selectedBuildingPos;
  const tile = state.grid[y]?.[x];
  
  if (!tile?.building) return null;
  
  const building = tile.building;
  const buildingType = building.type as RoNBuildingType;
  const buildingStats = BUILDING_STATS[buildingType];
  
  // Check if this building can produce units
  const producableUnits = (UNIT_PRODUCTION_BUILDINGS[buildingType] || []) as UnitType[];
  const canProduce = producableUnits.length > 0 && building.constructionProgress >= 100;
  
  // Check if building is under construction
  const isConstructing = building.constructionProgress < 100;
  
  // Get health bar color
  const healthPercent = (building.health / building.maxHealth) * 100;
  const healthColor = healthPercent > 60 ? 'bg-green-500' : healthPercent > 30 ? 'bg-yellow-500' : 'bg-red-500';
  
  // Check if we can afford a unit
  const canAffordUnit = (unitType: UnitType): boolean => {
    const stats = UNIT_STATS[unitType];
    if (!stats?.cost) return true;
    
    for (const [resource, amount] of Object.entries(stats.cost)) {
      if (amount && currentPlayer.resources[resource as ResourceType] < amount) {
        return false;
      }
    }
    return true;
  };
  
  const handleQueueUnit = (unitType: UnitType) => {
    queueUnit({ x, y }, unitType);
  };
  
  const handleClose = () => {
    selectBuilding(null);
    onClose();
  };
  
  return (
    <Card className="fixed top-20 right-4 w-80 z-[9999] bg-slate-800/95 border-slate-700 text-white shadow-2xl">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-sans capitalize">
          {buildingType.replace(/_/g, ' ')}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={handleClose} className="text-slate-400 hover:text-white">
          ✕
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-3 text-sm">
        {/* Location */}
        <div className="flex justify-between text-slate-400">
          <span>Location</span>
          <span className="text-white">({x}, {y})</span>
        </div>
        
        {/* Health Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-slate-400">
            <span>Health</span>
            <span className="text-white">{building.health} / {building.maxHealth}</span>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${healthColor}`}
              style={{ width: `${healthPercent}%` }}
            />
          </div>
        </div>
        
        {/* Construction Progress */}
        {isConstructing && (
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Construction</span>
              <span className="text-yellow-400">{Math.round(building.constructionProgress)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-yellow-500 transition-all"
                style={{ width: `${building.constructionProgress}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Building Level */}
        {building.level > 0 && (
          <div className="flex justify-between text-slate-400">
            <span>Level</span>
            <span className="text-white">{building.level}</span>
          </div>
        )}
        
        {/* Owner */}
        <div className="flex justify-between text-slate-400">
          <span>Owner</span>
          <Badge variant="outline" className="text-white border-slate-600">
            {tile.ownerId === currentPlayer.id ? 'You' : 'Enemy'}
          </Badge>
        </div>
        
        {/* Building Stats */}
        {buildingStats && (
          <>
            <Separator className="bg-slate-700" />
            <div className="text-xs text-slate-500 uppercase tracking-wider">Building Info</div>
            
            {buildingStats.providesHousing && (
              <div className="flex justify-between text-slate-400">
                <span>Housing</span>
                <span className="text-green-400">+{buildingStats.providesHousing}</span>
              </div>
            )}
            
            {buildingStats.attackDamage && (
              <div className="flex justify-between text-slate-400">
                <span>Attack</span>
                <span className="text-red-400">{buildingStats.attackDamage}</span>
              </div>
            )}
            
            {buildingStats.attackRange && (
              <div className="flex justify-between text-slate-400">
                <span>Range</span>
                <span className="text-white">{buildingStats.attackRange}</span>
              </div>
            )}
            
            {buildingStats.garrisonSlots && (
              <div className="flex justify-between text-slate-400">
                <span>Garrison Slots</span>
                <span className="text-white">{buildingStats.garrisonSlots}</span>
              </div>
            )}
          </>
        )}
        
        {/* Production Queue */}
        {building.queuedUnits.length > 0 && (
          <>
            <Separator className="bg-slate-700" />
            <div className="text-xs text-slate-500 uppercase tracking-wider">Production Queue</div>
            <div className="space-y-1">
              {building.queuedUnits.map((unitType, index) => (
                <div key={index} className="flex justify-between items-center text-slate-300">
                  <span className="capitalize">{unitType.replace(/_/g, ' ')}</span>
                  {index === 0 && (
                    <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${building.productionProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        
        {/* Unit Production */}
        {canProduce && (
          <>
            <Separator className="bg-slate-700" />
            <div className="text-xs text-slate-500 uppercase tracking-wider">Train Units</div>
            <div className="grid grid-cols-2 gap-2">
              {producableUnits.map(unitType => {
                const stats = UNIT_STATS[unitType];
                const canAfford = canAffordUnit(unitType);
                const queueFull = building.queuedUnits.length >= 5;
                
                return (
                  <Button
                    key={unitType}
                    size="sm"
                    variant={canAfford && !queueFull ? 'default' : 'outline'}
                    disabled={!canAfford || queueFull}
                    onClick={() => handleQueueUnit(unitType)}
                    className={`text-xs ${canAfford && !queueFull ? 'bg-blue-600 hover:bg-blue-700' : 'opacity-50'}`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="capitalize">{unitType.replace(/_/g, ' ')}</span>
                      {stats?.cost && (
                        <span className="text-[10px] text-slate-300">
                          {Object.entries(stats.cost)
                            .filter(([, v]) => v && v > 0)
                            .map(([r, v]) => `${r[0].toUpperCase()}:${v}`)
                            .join(' ')}
                        </span>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
            {currentPlayer.population >= currentPlayer.populationCap && (
              <div className="text-xs text-red-400 text-center">
                Population cap reached!
              </div>
            )}
          </>
        )}
        
        {/* Workers at this building */}
        {tile.ownerId === currentPlayer.id && (
          (() => {
            const workersHere = state.units.filter(u => 
              u.ownerId === currentPlayer.id &&
              u.task?.startsWith('gather_') &&
              u.taskTarget &&
              typeof u.taskTarget === 'object' &&
              'x' in u.taskTarget &&
              Math.floor(u.taskTarget.x) === x &&
              Math.floor(u.taskTarget.y) === y
            );
            
            if (workersHere.length > 0) {
              return (
                <>
                  <Separator className="bg-slate-700" />
                  <div className="flex justify-between text-slate-400">
                    <span>Workers Assigned</span>
                    <span className="text-green-400">{workersHere.length}</span>
                  </div>
                </>
              );
            }
            return null;
          })()
        )}
      </CardContent>
    </Card>
  );
}
