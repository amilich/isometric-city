'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MultiplayerRoomSummary } from '@/lib/multiplayer/types';
import { useMultiplayer } from '@/context/MultiplayerContext';
import { emitGlitchBehaviorEvent } from '@/lib/glitch/behaviorEvents';

interface JoinableRoomsListProps {
  noun: string;
  onJoin: (roomCode: string) => void;
}

export function JoinableRoomsList({ noun, onJoin }: JoinableRoomsListProps) {
  const { listJoinableRooms } = useMultiplayer();
  const [rooms, setRooms] = useState<MultiplayerRoomSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    emitGlitchBehaviorEvent('multiplayer_discovery', 'search_start', {
      noun,
    });
    try {
      const foundRooms = await listJoinableRooms();
      setRooms(foundRooms);
      emitGlitchBehaviorEvent('multiplayer_discovery', 'search_complete', {
        noun,
        results_count: foundRooms.length,
      });
    } finally {
      setLoading(false);
    }
  }, [listJoinableRooms, noun]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-slate-500">Open {noun}s</div>
        <button
          type="button"
          onClick={refresh}
          className="h-7 w-7 inline-flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-50"
          disabled={loading}
          aria-label={`Refresh ${noun} list`}
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="max-h-44 overflow-y-auto space-y-2">
        {rooms.length === 0 ? (
          <div className="text-xs text-slate-500 border border-slate-800 px-3 py-2">
            {loading ? 'Loading...' : `No public ${noun}s found`}
          </div>
        ) : (
          rooms.map((room) => (
            <button
              type="button"
              key={room.roomCode}
              onClick={() => {
                emitGlitchBehaviorEvent('multiplayer_discovery', 'select_room', {
                  noun,
                  player_count: room.playerCount,
                  max_players: room.maxPlayers,
                  source_of_truth: room.sourceOfTruth,
                });
                onJoin(room.roomCode);
              }}
              className="w-full text-left border border-slate-800 hover:border-slate-600 bg-slate-900/50 hover:bg-slate-800/70 px-3 py-2 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm text-white">{room.cityName}</div>
                  <div className="font-mono text-xs text-slate-500">{room.roomCode}</div>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Users className="h-3.5 w-3.5" />
                  <span>{room.playerCount}/{room.maxPlayers}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
      <Button
        type="button"
        onClick={refresh}
        variant="outline"
        className="w-full bg-transparent hover:bg-white/10 text-white/70 border-white/20 rounded-none"
        disabled={loading}
      >
        {loading ? 'Refreshing...' : `Search ${noun}s`}
      </Button>
    </div>
  );
}
