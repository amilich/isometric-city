/**
 * Rise of Nations - Selected Units Panel
 * 
 * Shows info about selected units and provides unit actions like killing units.
 */
'use client';

import React, { useMemo } from 'react';
import { useRoN } from '../context/RoNContext';
import { Button } from '@/components/ui/button';
import { UNIT_STATS } from '../types/units';

export function RoNSelectedUnitsPanel() {
  const { state, getCurrentPlayer, killSelectedUnits } = useRoN();
  const currentPlayer = getCurrentPlayer();
  
  // Get selected units owned by current player
  const selectedUnits = useMemo(() => {
    if (!currentPlayer) return [];
    return state.units.filter(
      u => state.selectedUnitIds.includes(u.id) && u.ownerId === currentPlayer.id
    );
  }, [state.units, state.selectedUnitIds, currentPlayer]);
  
  // If no units selected, don't render
  if (selectedUnits.length === 0) return null;
  
  // Count unit types
  const unitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const unit of selectedUnits) {
      counts[unit.type] = (counts[unit.type] || 0) + 1;
    }
    return counts;
  }, [selectedUnits]);
  
  // Format unit summary
  const unitSummary = Object.entries(unitCounts)
    .map(([type, count]) => {
      const stats = UNIT_STATS[type as keyof typeof UNIT_STATS];
      const displayName = stats?.name || type;
      return count > 1 ? `${count}x ${displayName}` : displayName;
    })
    .join(', ');
  
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 rounded-lg shadow-lg border border-slate-700 px-4 py-2 flex items-center gap-4 z-50">
      {/* Unit info */}
      <div className="text-sm text-slate-200">
        <span className="font-medium">{selectedUnits.length}</span> unit{selectedUnits.length !== 1 ? 's' : ''} selected
        <span className="text-slate-400 ml-2">({unitSummary})</span>
      </div>
      
      {/* Kill button */}
      <Button
        size="sm"
        variant="destructive"
        onClick={killSelectedUnits}
        title="Kill selected units (free population cap)"
        className="bg-red-600 hover:bg-red-700 text-xs"
      >
        Kill {selectedUnits.length > 1 ? 'Units' : 'Unit'}
      </Button>
    </div>
  );
}
