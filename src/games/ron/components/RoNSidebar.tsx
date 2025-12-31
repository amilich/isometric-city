/**
 * Rise of Nations - Sidebar Component
 * 
 * Displays resources, age, and building/unit controls.
 * Organized with simple category headers like IsoCity.
 */
'use client';

import React, { useMemo, useState } from 'react';
import { useRoN } from '../context/RoNContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AGE_INFO, AGE_ORDER } from '../types/ages';
import { RESOURCE_INFO, ResourceType } from '../types/resources';
import { BUILDING_STATS, RoNBuildingType } from '../types/buildings';
import { UNIT_STATS, UnitType, getUnitStatsForAge, getUnitDisplayName } from '../types/units';
import { UNIT_PRODUCTION_BUILDINGS } from '../types/buildings';
import { RoNTool, RON_TOOL_INFO } from '../types/game';
import { SettingsIcon } from '@/components/ui/Icons';
import { RoNSettingsPanel } from './RoNSettingsPanel';

// Building group definitions
interface BuildingGroup {
  key: string;
  label: string;
  buildings: Array<{ tool: RoNTool; type: RoNBuildingType }>;
}

const BUILDING_GROUPS: BuildingGroup[] = [
  {
    key: 'economy',
    label: 'ECONOMY',
    buildings: [
      { tool: 'build_city_center', type: 'city_center' },
      { tool: 'build_farm', type: 'farm' },
      { tool: 'build_woodcutters_camp', type: 'woodcutters_camp' },
      { tool: 'build_granary', type: 'granary' },
      { tool: 'build_lumber_mill', type: 'lumber_mill' },
      { tool: 'build_mine', type: 'mine' },
      { tool: 'build_smelter', type: 'smelter' },
      { tool: 'build_market', type: 'market' },
    ],
  },
  {
    key: 'knowledge',
    label: 'KNOWLEDGE',
    buildings: [
      { tool: 'build_library', type: 'library' },
      { tool: 'build_university', type: 'university' },
    ],
  },
  {
    key: 'military',
    label: 'MILITARY',
    buildings: [
      { tool: 'build_barracks', type: 'barracks' },
      { tool: 'build_stable', type: 'stable' },
      { tool: 'build_siege_factory', type: 'siege_factory' },
      { tool: 'build_dock', type: 'dock' },
      { tool: 'build_factory', type: 'factory' },
      { tool: 'build_auto_plant', type: 'auto_plant' },
      { tool: 'build_airbase', type: 'airbase' },
    ],
  },
  {
    key: 'defense',
    label: 'DEFENSE',
    buildings: [
      { tool: 'build_tower', type: 'tower' },
      { tool: 'build_fort', type: 'fort' },
      { tool: 'build_bunker', type: 'bunker' },
    ],
  },
  {
    key: 'infrastructure',
    label: 'INFRASTRUCTURE',
    buildings: [
      { tool: 'build_road', type: 'road' },
      { tool: 'build_oil_well', type: 'oil_well' },
      { tool: 'build_refinery', type: 'refinery' },
    ],
  },
];

export function RoNSidebar() {
  const { 
    state, 
    selectedBuildingPos,  // Now from separate state
    setTool, 
    canAdvanceAge, 
    advanceAge,
    getCurrentPlayer,
    queueUnit,
  } = useRoN();
  
  const [showSettings, setShowSettings] = useState(false);
  
  const currentPlayer = getCurrentPlayer();
  const playerAge = currentPlayer?.age ?? 'classical';
  const ageInfo = AGE_INFO[playerAge];
  const ageIndex = AGE_ORDER.indexOf(playerAge);
  
  // Selected building info (uses separate state that simulation can't overwrite)
  const selectedBuilding = selectedBuildingPos 
    ? state.grid[selectedBuildingPos.y]?.[selectedBuildingPos.x]?.building
    : null;
  
  // Available units for selected building - SIMPLIFIED: one unit type per building that scales with age
  const availableUnits = useMemo(() => {
    if (!selectedBuilding || !currentPlayer) return [];
    
    const buildingType = selectedBuilding.type as RoNBuildingType;
    const producableUnits = UNIT_PRODUCTION_BUILDINGS[buildingType] || [];
    
    // Filter by age requirement and map to display names
    return producableUnits
      .filter(unitType => {
        const stats = UNIT_STATS[unitType as UnitType];
        if (!stats) return false;
        const requiredAgeIndex = AGE_ORDER.indexOf(stats.minAge);
        return ageIndex >= requiredAgeIndex;
      })
      .map(unitType => ({
        type: unitType as UnitType,
        name: getUnitDisplayName(unitType as UnitType, playerAge),
      }));
  }, [selectedBuilding, ageIndex, currentPlayer, playerAge]);
  
  if (!currentPlayer) return null;
  
  return (
    <div className="w-56 bg-slate-900 border-r border-slate-700 flex flex-col h-screen fixed left-0 top-0 z-40">
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
      
      <ScrollArea className="flex-1">
        {/* Selected Building - Unit Production */}
        {selectedBuilding && availableUnits.length > 0 && (
          <div className="px-4 py-2 border-b border-slate-700">
            <div className="text-xs text-slate-400 uppercase font-bold mb-2">
              Train Units
            </div>
            <div className="flex flex-col gap-1">
              {availableUnits.map(({ type, name }) => {
                // Use age-scaled stats for display
                const stats = getUnitStatsForAge(type, currentPlayer.age);
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
                      if (selectedBuildingPos) {
                        queueUnit(selectedBuildingPos, type);
                      }
                    }}
                    className="justify-between"
                  >
                    <span>{name}</span>
                    <span className="text-xs opacity-60">
                      {Object.entries(stats.cost)
                        .filter(([, v]) => v)
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
        
        {/* Building Groups */}
        <div className="px-2 py-2">
          {/* Buildings header */}
          <div className="px-2 py-2 text-[10px] font-bold tracking-widest text-slate-500">
            BUILDINGS
          </div>
          
          {BUILDING_GROUPS.map(group => {
            // Filter buildings by age
            const availableBuildings = group.buildings.filter(({ type }) => {
              const stats = BUILDING_STATS[type];
              if (!stats) return false;
              const requiredAgeIndex = AGE_ORDER.indexOf(stats.minAge);
              return ageIndex >= requiredAgeIndex;
            });

            if (availableBuildings.length === 0) return null;

            return (
              <div key={group.key} className="mb-2">
                {/* Category header */}
                <div className="px-2 py-1 text-[10px] font-bold tracking-widest text-slate-400">
                  {group.label}
                </div>
                
                {/* Building buttons */}
                <div className="flex flex-col gap-0.5">
                  {availableBuildings.map(({ tool, type }) => {
                    const stats = BUILDING_STATS[type];
                    const info = RON_TOOL_INFO[tool];
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
                        className="justify-between h-7 text-xs"
                      >
                        <span>{info?.name || type}</span>
                        <span className="text-[10px] opacity-60">
                          {Object.entries(stats.cost)
                            .filter(([, v]) => v)
                            .map(([k, v]) => `${v}${RESOURCE_INFO[k as ResourceType].icon}`)
                            .join(' ')}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      
      {/* Settings Button */}
      <div className="px-4 py-2 border-t border-slate-700">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => setShowSettings(true)}
        >
          <SettingsIcon size={16} />
          <span>Settings</span>
        </Button>
      </div>
      
      {/* Settings Panel Modal */}
      {showSettings && (
        <RoNSettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
