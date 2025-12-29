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
import { UNIT_STATS, UnitType } from '../types/units';
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
  const ageInfo = currentPlayer ? AGE_INFO[currentPlayer.age] : null;
  const ageIndex = currentPlayer ? AGE_ORDER.indexOf(currentPlayer.age) : -1;
  
  // Selected building info (uses separate state that simulation can't overwrite)
  const selectedBuilding = currentPlayer && selectedBuildingPos 
    ? state.grid[selectedBuildingPos.y]?.[selectedBuildingPos.x]?.building
    : null;
  
  // Available units for selected building
  const availableUnits = useMemo(() => {
    if (!currentPlayer || !selectedBuilding) return [];
    
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
        units.push({ type: 'bomber_early', name: 'Early Bomber' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('modern')) {
        units.push({ type: 'fighter', name: 'Fighter' });
        units.push({ type: 'bomber', name: 'Bomber' });
        units.push({ type: 'helicopter', name: 'Helicopter' });
        units.push({ type: 'stealth_bomber', name: 'Stealth Bomber' });
      }
    }
    
    // Units from dock (naval)
    if (selectedBuilding.type === 'dock') {
      units.push({ type: 'fishing_boat', name: 'Fishing Boat' });
      if (ageIndex >= AGE_ORDER.indexOf('classical')) {
        units.push({ type: 'galley', name: 'Galley' });
        units.push({ type: 'trireme', name: 'Trireme' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('medieval')) {
        units.push({ type: 'carrack', name: 'Carrack' });
        units.push({ type: 'galleass', name: 'Galleass' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('enlightenment')) {
        units.push({ type: 'frigate', name: 'Frigate' });
        units.push({ type: 'ship_of_the_line', name: 'Ship of the Line' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('industrial')) {
        units.push({ type: 'ironclad', name: 'Ironclad' });
        units.push({ type: 'battleship', name: 'Battleship' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('modern')) {
        units.push({ type: 'destroyer', name: 'Destroyer' });
        units.push({ type: 'cruiser', name: 'Cruiser' });
        units.push({ type: 'aircraft_carrier', name: 'Aircraft Carrier' });
        units.push({ type: 'submarine', name: 'Submarine' });
      }
    }
    
    // Units from siege factory
    if (selectedBuilding.type === 'siege_factory') {
      units.push({ type: 'catapult', name: 'Catapult' });
      if (ageIndex >= AGE_ORDER.indexOf('medieval')) {
        units.push({ type: 'trebuchet', name: 'Trebuchet' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('enlightenment')) {
        units.push({ type: 'cannon', name: 'Cannon' });
      }
      if (ageIndex >= AGE_ORDER.indexOf('industrial')) {
        units.push({ type: 'howitzer', name: 'Howitzer' });
      }
    }
    
    return units;
  }, [currentPlayer, selectedBuilding, ageIndex]);

  if (!currentPlayer || !ageInfo) return null;
  
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
                      if (selectedBuildingPos) {
                        queueUnit(selectedBuildingPos, type);
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
