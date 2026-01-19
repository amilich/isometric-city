/**
 * Track Builder Panel - UI for constructing coaster tracks
 */
'use client';

import React from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';
import { TRACK_PIECES, getValidNextPieces, isCircuitComplete } from '@/components/coaster/systems/trackBuilder';
import { TrackPieceType } from '@/games/coaster/types/rides';

export function TrackBuilderPanel() {
  const { state, addTrackPiece, undoTrackPiece, stopTrackBuild } = useCoaster();
  const { trackBuildRideId, trackBuildError } = state;

  const ride = state.rides.find(r => r.id === trackBuildRideId);
  if (!ride) return null;

  const validPieces = getValidNextPieces(ride.track, state.gridSize);
  const completed = isCircuitComplete(ride.track);

  return (
    <Card className="fixed top-16 right-4 w-80 max-h-[calc(100vh-5rem)] bg-slate-900/95 border-white/10 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div>
          <h2 className="text-white font-bold">Track Builder</h2>
          <p className="text-xs text-white/50">{ride.name}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={stopTrackBuild}
          className="h-6 w-6 text-white/50 hover:text-white hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {/* Track Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
          <div className="p-2 bg-white/5 rounded text-center">
            <p className="text-white/60">Excitement</p>
            <p className="text-green-400 font-bold">{ride.stats.excitement.toFixed(2)}</p>
          </div>
          <div className="p-2 bg-white/5 rounded text-center">
            <p className="text-white/60">Intensity</p>
            <p className="text-yellow-400 font-bold">{ride.stats.intensity.toFixed(2)}</p>
          </div>
          <div className="p-2 bg-white/5 rounded text-center">
            <p className="text-white/60">Nausea</p>
            <p className="text-red-400 font-bold">{ride.stats.nausea.toFixed(2)}</p>
          </div>
        </div>

        {/* Track Error */}
        {trackBuildError && (
          <div className="mb-4 p-2 rounded bg-red-500/20 text-red-300 text-xs">
            {trackBuildError}
          </div>
        )}

        {/* Track Pieces */}
        <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">Available Pieces</h3>
        <div className="grid grid-cols-2 gap-2">
          {validPieces.map(piece => {
            const def = TRACK_PIECES[piece];
            return (
              <Button
                key={piece}
                variant="ghost"
                onClick={() => addTrackPiece(piece as TrackPieceType)}
                className="h-auto py-2 px-3 flex flex-col items-start text-left bg-white/5 hover:bg-white/10"
              >
                <span className="text-xs font-medium text-white">{def?.name ?? piece}</span>
                <span className="text-[10px] text-white/40 mt-0.5">${def?.cost ?? 0}</span>
              </Button>
            );
          })}
        </div>

        {/* Track Controls */}
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={undoTrackPiece}
            disabled={ride.track.length === 0}
            className="flex-1 border-white/20 text-white/80 hover:bg-white/10"
          >
            Undo
          </Button>
          <Button
            size="sm"
            onClick={stopTrackBuild}
            disabled={!completed}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50"
          >
            {completed ? 'Finish Track' : 'Complete Circuit'}
          </Button>
        </div>

        {/* Track Summary */}
        <div className="mt-4 text-xs text-white/50">
          <p>Pieces: {ride.track.length}</p>
          <p>Drops: {ride.stats.drops} • Inversions: {ride.stats.inversions}</p>
          <p>Length: {Math.round(ride.stats.rideLength)}m</p>
        </div>
      </ScrollArea>
    </Card>
  );
}
