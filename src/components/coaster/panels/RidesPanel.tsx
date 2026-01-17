'use client';

import React from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';
import { RIDE_DEFINITIONS } from '@/games/coaster/types/buildings';
import { T, useGT } from 'gt-next';

export function RidesPanel() {
  const { state, setActivePanel, openRide, closeRide, startTrackBuild } = useCoaster();
  const { rides } = state;
  const gt = useGT();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-green-400';
      case 'testing': return 'text-yellow-400';
      case 'closed': return 'text-gray-400';
      case 'broken': return 'text-red-400';
      default: return 'text-white/60';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return gt('Open', { $context: 'Ride status' });
      case 'testing': return gt('Testing', { $context: 'Ride status' });
      case 'closed': return gt('Closed', { $context: 'Ride status' });
      case 'broken': return gt('Broken', { $context: 'Ride status' });
      default: return status;
    }
  };

  return (
    <Card className="fixed top-16 right-4 w-80 max-h-[calc(100vh-5rem)] bg-slate-900/95 border-white/10 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-white font-bold"><T>Rides</T></h2>
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
        {rides.length === 0 ? (
          <T>
            <p className="text-white/50 text-sm text-center py-8">
              No rides built yet. Build your first ride to get started!
            </p>
          </T>
        ) : (
          <div className="space-y-3">
            {rides.map(ride => {
              const rideDef = RIDE_DEFINITIONS[ride.type];
              const isTracked = rideDef?.isTracked ?? false;

              return (
                <div 
                  key={ride.id}
                  className="p-3 bg-white/5 rounded-lg border border-white/10"
                >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-medium">{ride.name}</h3>
                    <p className={`text-xs ${getStatusColor(ride.status)}`}>
                      {getStatusLabel(ride.status)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/80 text-sm">${ride.price}</p>
                    <p className="text-white/50 text-xs"><T>per ride</T></p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <p className="text-white/50"><T>Queue</T></p>
                    <p className="text-white font-medium">{ride.queueLength}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/50"><T>Riders</T></p>
                    <p className="text-white font-medium">{ride.totalRiders}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/50"><T>Revenue</T></p>
                    <p className="text-green-400 font-medium">${ride.totalRevenue}</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  {isTracked && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startTrackBuild(ride.id)}
                      className="flex-1 text-xs h-7 border-white/20 text-white/80 hover:bg-white/10"
                    >
                      <T>Build Track</T>
                    </Button>
                  )}
                  {ride.status === 'open' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => closeRide(ride.id)}
                      className="flex-1 text-xs h-7 border-white/20 text-white/80 hover:bg-white/10"
                    >
                      <T>Close</T>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => openRide(ride.id)}
                      className="flex-1 text-xs h-7 bg-green-600 hover:bg-green-500"
                    >
                      <T>Open</T>
                    </Button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
