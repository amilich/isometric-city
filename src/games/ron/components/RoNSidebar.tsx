/**
 * Rise of Nations - Sidebar Component
 * 
 * Displays resources, age, and building/unit controls.
 */
'use client';

import React, { useMemo } from 'react';
import { useRoN } from '../context/RoNContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AGE_INFO, AGE_ORDER } from '../types/ages';
import { RESOURCE_INFO, ResourceType } from '../types/resources';
import { BUILDING_STATS, RoNBuildingType } from '../types/buildings';
import { UNIT_STATS, UnitType } from '../types/units';
import { RoNTool, RON_TOOL_INFO } from '../types/game';

export function RoNSidebar() {
  const { 
    state, 
    setTool, 
    setSpeed, 
    setActivePanel,
    canAdvanceAge, 
    advanceAge,
    getCurrentPlayer,
    queueUnit,
  } = useRoN();
  
  const currentPlayer = getCurrentPlayer();
  if (!currentPlayer) return null;
  
  const ageInfo = AGE_INFO[currentPlayer.age];
  const ageIndex = AGE_ORDER.indexOf(currentPlayer.age);
  
  // Available buildings based on age
  const availableBuildings = useMemo(() => {
    const buildings: Array<{ tool: RoNTool; type: RoNBuildingType; name: string }> = [];
    
    const buildingTools: Array<{ tool: RoNTool; type: RoNBuildingType }> = [
      { tool: 'build_city_center', type: 'city_center' },
      { tool: 'build_farm', type: 'farm' },
      { tool: 'build_woodcutters_camp', type: 'woodcutters_camp' },
      { tool: 'build_granary', type: 'granary' },
      { tool: 'build_lumber_mill', type: 'lumber_mill' },
      { tool: 'build_mine', type: 'mine' },
      { tool: 'build_smelter', type: 'smelter' },
      { tool: 'build_market', type: 'market' },
      { tool: 'build_library', type: 'library' },
      { tool: 'build_university', type: 'university' },
      { tool: 'build_barracks', type: 'barracks' },
      { tool: 'build_stable', type: 'stable' },
      { tool: 'build_siege_factory', type: 'siege_factory' },
      { tool: 'build_dock', type: 'dock' },
      { tool: 'build_tower', type: 'tower' },
      { tool: 'build_fort', type: 'fort' },
      { tool: 'build_road', type: 'road' },
    ];
    
    // Add age-specific buildings
    if (ageIndex >= AGE_ORDER.indexOf('industrial')) {
      buildingTools.push(
        { tool: 'build_oil_well', type: 'oil_well' },
        { tool: 'build_refinery', type: 'refinery' },
        { tool: 'build_factory', type: 'factory' },
        { tool: 'build_auto_plant', type: 'auto_plant' },
      );
    }
    
    if (ageIndex >= AGE_ORDER.indexOf('modern')) {
      buildingTools.push(
        { tool: 'build_airbase', type: 'airbase' },
        { tool: 'build_bunker', type: 'bunker' },
      );
    }
    
    for (const { tool, type } of buildingTools) {
      const stats = BUILDING_STATS[type];
      if (!stats) continue;
      
      const requiredAgeIndex = AGE_ORDER.indexOf(stats.minAge);
      if (ageIndex >= requiredAgeIndex) {
        const info = RON_TOOL_INFO[tool];
        buildings.push({ tool, type, name: info?.name || type });
      }
    }
    
    return buildings;
  }, [ageIndex]);
  
  // Selected building info
  const selectedBuilding = state.selectedBuildingPos 
    ? state.grid[state.selectedBuildingPos.y]?.[state.selectedBuildingPos.x]?.building
    : null;
  
  // Available units for selected building
  const availableUnits = useMemo(() => {
    if (!selectedBuilding) return [];
    
    const units: Array<{ type: UnitType; name: string }> = [];
    
    // Units available from city centers
    if (['city_center', 'small_city', 'large_city', 'major_city'].includes(selectedBuilding.type)) {
      units.push({ type: 'citizen', name: 'Citizen' });
      if (ageIndex >= AGE_ORDER.indexOf('classical')) {
        units.push({ type: 'merchant', name: 'Merchant' });
      }
    }
    
    // Units from barracks
    if (selectedBuilding.type === 'barracks') {
      units.push({ type: 'militia', name: 'Militia' });
      if (ageIndex >= AGE_ORDER.indexOf('classical')) {
        units.push({ type: 'hoplite', name: 'Hoplite' });
        units.push({ type: 'archer', name: 'Archer' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('medieval')) {
        units.push({ type: 'pikeman', name: 'Pikeman' });
        units.push({ type: 'swordsman', name: 'Swordsman' });
        units.push({ type: 'crossbowman', name: 'Crossbowman' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('enlightenment')) {
        units.push({ type: 'musketeer', name: 'Musketeer' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('industrial')) {
        units.push({ type: 'rifleman', name: 'Rifleman' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('modern')) {
        units.push({ type: 'assault_infantry', name: 'Assault Infantry' });
      }
    }
    
    // Units from stable
    if (selectedBuilding.type === 'stable') {
      units.push({ type: 'scout_cavalry', name: 'Scout Cavalry' });
      if (ageIndex >= AGE_ORDER.indexOf('classical')) {
        units.push({ type: 'light_cavalry', name: 'Light Cavalry' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('medieval')) {
        units.push({ type: 'knight', name: 'Knight' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('industrial')) {
        units.push({ type: 'light_tank', name: 'Light Tank' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('modern')) {
        units.push({ type: 'main_battle_tank', name: 'Main Battle Tank' });
      }
    }
    
    // Units from airbase
    if (selectedBuilding.type === 'airbase') {
      if (ageIndex >= AGE_ORDER.indexOf('industrial')) {
        units.push({ type: 'biplane', name: 'Biplane' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('modern')) {
        units.push({ type: 'fighter', name: 'Fighter' });
        units.push({ type: 'bomber', name: 'Bomber' });
        units.push({ type: 'helicopter', name: 'Helicopter' });
      }
    }
    
    return units;
  }, [selectedBuilding, ageIndex]);
  
  return (
    <div className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col h-screen fixed left-0 top-0 z-40">
      {/* Header - Age Display */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-white font-bold text-lg">Rise of Nations</span>
        </div>
        <div 
          className="mt-2 px-3 py-2 rounded-lg text-center" 
          style={{ backgroundColor: ageInfo.color + '33', borderColor: ageInfo.color, borderWidth: 1 }}
        >
          <div className="text-white font-semibold">{ageInfo.name}</div>
          <div className="text-xs text-slate-300">{ageInfo.description}</div>
        </div>
        {canAdvanceAge() && (
          <Button 
            className="w-full mt-2 bg-amber-600 hover:bg-amber-700"
            onClick={advanceAge}
          >
            Advance Age
          </Button>
        )}
      </div>
      
      {/* Resources */}
      <div className="px-4 py-2 border-b border-slate-700">
        <div className="text-xs text-slate-400 uppercase font-bold mb-2">Resources</div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(RESOURCE_INFO).map(([key, info]) => {
            const resource = key as ResourceType;
            const amount = Math.floor(currentPlayer.resources[resource]);
            const rate = currentPlayer.resourceRates[resource];
            
            // Hide oil before industrial age
            if (resource === 'oil' && ageIndex < AGE_ORDER.indexOf('industrial')) {
              return null;
            }
            
            return (
              <div 
                key={resource}
                className="flex items-center gap-1 text-sm"
                style={{ color: info.color }}
              >
                <span>{info.icon}</span>
                <span className="font-mono">{amount}</span>
                {rate > 0 && (
                  <span className="text-xs text-green-400">+{rate.toFixed(1)}</span>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Population */}
        <div className="mt-2 flex items-center gap-2 text-sm text-white">
          <span>👥</span>
          <span>{currentPlayer.population} / {currentPlayer.populationCap}</span>
        </div>
      </div>
      
      {/* Speed Control */}
      <div className="px-4 py-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Speed:</span>
          {[0, 1, 2, 3].map(speed => (
            <Button
              key={speed}
              size="sm"
              variant={state.gameSpeed === speed ? 'default' : 'ghost'}
              onClick={() => setSpeed(speed as 0 | 1 | 2 | 3)}
              className="w-8 h-8 p-0"
            >
              {speed === 0 ? '⏸' : speed === 1 ? '▶' : speed === 2 ? '▶▶' : '▶▶▶'}
            </Button>
          ))}
        </div>
      </div>
      
      {/* Tools */}
      <div className="px-4 py-2 border-b border-slate-700">
        <div className="text-xs text-slate-400 uppercase font-bold mb-2">Tools</div>
        <div className="flex gap-1 flex-wrap">
          <Button
            size="sm"
            variant={state.selectedTool === 'select' ? 'default' : 'ghost'}
            onClick={() => setTool('select')}
          >
            Select
          </Button>
          <Button
            size="sm"
            variant={state.selectedTool === 'move' ? 'default' : 'ghost'}
            onClick={() => setTool('move')}
          >
            Move
          </Button>
          <Button
            size="sm"
            variant={state.selectedTool === 'attack' ? 'default' : 'ghost'}
            onClick={() => setTool('attack')}
          >
            Attack
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        {/* Selected Building - Unit Production */}
        {selectedBuilding && availableUnits.length > 0 && (
          <div className="px-4 py-2 border-b border-slate-700">
            <div className="text-xs text-slate-400 uppercase font-bold mb-2">
              Train Units
            </div>
            <div className="flex flex-col gap-1">
              {availableUnits.map(({ type, name }) => {
                const stats = UNIT_STATS[type];
                const canAfford = Object.entries(stats.cost).every(
                  ([resource, amount]) => 
                    !amount || currentPlayer.resources[resource as ResourceType] >= amount
                );
                
                return (
                  <Button
                    key={type}
                    size="sm"
                    variant="ghost"
                    disabled={!canAfford || currentPlayer.population >= currentPlayer.populationCap}
                    onClick={() => {
                      if (state.selectedBuildingPos) {
                        queueUnit(state.selectedBuildingPos, type);
                      }
                    }}
                    className="justify-between"
                  >
                    <span>{name}</span>
                    <span className="text-xs opacity-60">
                      {Object.entries(stats.cost)
                        .filter(([_, v]) => v)
                        .map(([k, v]) => `${v}${RESOURCE_INFO[k as ResourceType].icon}`)
                        .join(' ')}
                    </span>
                  </Button>
                );
              })}
            </div>
            
            {/* Production Queue */}
            {selectedBuilding.queuedUnits.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-slate-400">Queue: {selectedBuilding.queuedUnits.length}</div>
                <div className="h-1 bg-slate-700 rounded mt-1">
                  <div 
                    className="h-full bg-blue-500 rounded"
                    style={{ 
                      width: `${(selectedBuilding.productionProgress / (UNIT_STATS[selectedBuilding.queuedUnits[0] as UnitType]?.buildTime || 1)) * 100}%` 
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Buildings */}
        <div className="px-4 py-2">
          <div className="text-xs text-slate-400 uppercase font-bold mb-2">Buildings</div>
          <div className="flex flex-col gap-1">
            {availableBuildings.map(({ tool, type, name }) => {
              const stats = BUILDING_STATS[type];
              const canAfford = Object.entries(stats.cost).every(
                ([resource, amount]) => 
                  !amount || currentPlayer.resources[resource as ResourceType] >= amount
              );
              
              return (
                <Button
                  key={tool}
                  size="sm"
                  variant={state.selectedTool === tool ? 'default' : 'ghost'}
                  disabled={!canAfford}
                  onClick={() => setTool(tool)}
                  className="justify-between"
                >
                  <span>{name}</span>
                  <span className="text-xs opacity-60">
                    {Object.entries(stats.cost)
                      .filter(([_, v]) => v)
                      .map(([k, v]) => `${v}${RESOURCE_INFO[k as ResourceType].icon}`)
                      .join(' ')}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      </ScrollArea>
      
      {/* Selected Units Info */}
      {state.selectedUnitIds.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-700">
          <div className="text-sm text-white">
            {state.selectedUnitIds.length} unit(s) selected
          </div>
        </div>
      )}
    </div>
  );
}
