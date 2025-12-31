/**
 * Rise of Nations - Selected Units Panel
 * 
 * Shows info about selected units and provides unit actions like killing units.
 */
'use client';

import React, { useMemo } from 'react';
import { useRoN } from '../context/RoNContext';
import { Button } from '@/components/ui/button';

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
  
  // Count unit types - must be called before early return (hooks must be unconditional)
  const unitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const unit of selectedUnits) {
      counts[unit.type] = (counts[unit.type] || 0) + 1;
    }
    return counts;
  }, [selectedUnits]);
  
  // Format unit summary
  const unitSummary = useMemo(() => {
    return Object.entries(unitCounts)
      .map(([type, count]) => {
        // Format type as display name (e.g., 'infantry' -> 'Infantry', 'anti_tank' -> 'Anti Tank')
        const displayName = type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        return count > 1 ? `${count}x ${displayName}` : displayName;
      })
      .join(', ');
  }, [unitCounts]);
  
  // If no units selected, don't render (after all hooks)
  if (selectedUnits.length === 0) return null;
  
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
