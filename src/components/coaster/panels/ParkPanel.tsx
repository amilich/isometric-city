'use client';

import React, { useState } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';

export function ParkPanel() {
  const { state, setActivePanel, setParkName, setParkEntranceFee } = useCoaster();
  const { park, finances, rides, guests, staff, awards } = state;
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(park.name);

  const handleSaveName = () => {
    if (newName.trim()) {
      setParkName(newName.trim());
    }
    setEditingName(false);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 700) return 'text-green-400';
    if (rating >= 400) return 'text-yellow-400';
    return 'text-red-400';
  };

  const openRides = rides.filter(r => r.status === 'open').length;

  return (
    <Card className="fixed top-16 right-4 w-80 max-h-[calc(100vh-5rem)] bg-slate-900/95 border-white/10 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-white font-bold">Park Info</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActivePanel('none')}
          className="h-6 w-6 text-white/50 hover:text-white hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {/* Park Name */}
        <div className="mb-6">
          {editingName ? (
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 bg-white/10 border-white/20 text-white"
                placeholder="Park name"
                autoFocus
              />
              <Button size="sm" onClick={handleSaveName}>Save</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h3 className="text-xl text-white font-bold">{park.name}</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setEditingName(true)}
                className="text-white/50 hover:text-white"
              >
                Edit
              </Button>
            </div>
          )}
        </div>

        {/* Park Rating */}
        <div className="p-4 bg-white/5 rounded-lg mb-6 text-center">
          <p className={`text-5xl font-bold ${getRatingColor(park.parkRating)}`}>
            {park.parkRating}
          </p>
          <p className="text-white/50 text-sm mt-1">Park Rating</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 bg-white/5 rounded-lg text-center">
            <p className="text-2xl font-bold text-white">{guests.length}</p>
            <p className="text-xs text-white/50">Guests</p>
          </div>
          <div className="p-3 bg-white/5 rounded-lg text-center">
            <p className="text-2xl font-bold text-white">{staff.length}</p>
            <p className="text-xs text-white/50">Staff</p>
          </div>
          <div className="p-3 bg-white/5 rounded-lg text-center">
            <p className="text-2xl font-bold text-white">{openRides}</p>
            <p className="text-xs text-white/50">Open Rides</p>
          </div>
          <div className="p-3 bg-white/5 rounded-lg text-center">
            <p className="text-2xl font-bold text-white">{rides.length}</p>
            <p className="text-xs text-white/50">Total Rides</p>
          </div>
        </div>

        {/* Entrance Fee */}
        <div className="mb-6">
          <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Entrance Fee</h3>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParkEntranceFee(Math.max(0, park.entranceFee - 5))}
              className="border-white/20"
            >
              -$5
            </Button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-bold text-white">${park.entranceFee}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParkEntranceFee(park.entranceFee + 5)}
              className="border-white/20"
            >
              +$5
            </Button>
          </div>
        </div>

        {/* Awards */}
        <div>
          <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Awards</h3>
          {awards.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-4">
              No awards yet. Keep improving your park!
            </p>
          ) : (
            <div className="space-y-2">
              {awards.map((award, i) => (
                <div key={i} className="p-2 bg-white/5 rounded flex items-center gap-2">
                  <span className="text-xl">🏆</span>
                  <div>
                    <p className="text-white text-sm">{award.type.replace(/_/g, ' ')}</p>
                    <p className="text-white/40 text-xs">Year {award.year}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
