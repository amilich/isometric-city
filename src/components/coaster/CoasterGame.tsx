'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { T, Var, Num } from 'gt-next';
import { Button } from '@/components/ui/button';
import { useCoaster } from '@/context/CoasterContext';
import CoasterCanvas from './CoasterCanvas';
import CoasterSidebar from './CoasterSidebar';
import CoasterMiniMap from './CoasterMiniMap';
import FinancePanel from './panels/FinancePanel';
import GuestPanel from './panels/GuestPanel';
import RidePanel from './panels/RidePanel';
import StaffPanel from './panels/StaffPanel';

export default function CoasterGame() {
  const { state, setSpeed, newGame, setRidePrice, toggleRideStatus, setActivePanel, hireStaff } = useCoaster();
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{ offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null>(null);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);

  const selectedRide = useMemo(
    () => state.rides.find((ride) => ride.id === selectedRideId) ?? null,
    [selectedRideId, state.rides]
  );

  useEffect(() => {
    if (selectedRideId && !selectedRide) {
      setSelectedRideId(null);
    }
  }, [selectedRideId, selectedRide]);

  return (
    <div className="w-full h-full flex bg-background text-foreground">
      <CoasterSidebar />
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-slate-900/70">
          <div className="flex items-center gap-4">
            <div className="text-lg font-semibold tracking-wide">{state.parkName}</div>
            <T>
              <div className="text-xs text-muted-foreground">
                Year <Var>{state.year}</Var> · Day <Var>{state.day}</Var> · <Var>{state.hour.toString().padStart(2, '0')}</Var>:00
              </div>
            </T>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <T>
              <div>Guests: <Num>{state.stats.guestsInPark}</Num></div>
            </T>
            <T>
              <div>Rating: <Num>{state.stats.rating}</Num></div>
            </T>
            <div className="font-medium">${state.finance.cash.toLocaleString()}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={state.speed === 0 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(0)}>
              <T>Pause</T>
            </Button>
            <Button variant={state.speed === 1 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(1)}>
              1x
            </Button>
            <Button variant={state.speed === 2 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(2)}>
              2x
            </Button>
            <Button variant={state.speed === 3 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(3)}>
              3x
            </Button>
            <Button variant="outline" size="sm" onClick={() => newGame()}>
              <T>New Park</T>
            </Button>
          </div>
        </div>
        <div className="flex-1 relative">
          <CoasterCanvas
            navigationTarget={navigationTarget}
            onNavigationComplete={() => setNavigationTarget(null)}
            onViewportChange={setViewport}
            onSelectRide={setSelectedRideId}
          />
          <CoasterMiniMap onNavigate={(x, y) => setNavigationTarget({ x, y })} viewport={viewport} />
          {selectedRide && (
            <RidePanel
              ride={selectedRide}
              onClose={() => setSelectedRideId(null)}
              onToggleStatus={() => toggleRideStatus(selectedRide.id)}
              onPriceChange={(price) => setRidePrice(selectedRide.id, price)}
            />
          )}
          {state.activePanel === 'finance' && (
            <FinancePanel
              cash={state.finance.cash}
              rideRevenue={state.finance.rideRevenue}
              shopRevenue={state.finance.shopRevenue}
              income={state.finance.income}
              expenses={state.finance.expenses}
              loan={state.finance.loan}
              onClose={() => setActivePanel('none')}
            />
          )}
          {state.activePanel === 'guests' && (
            <GuestPanel
              guests={state.guests}
              onClose={() => setActivePanel('none')}
            />
          )}
          {state.activePanel === 'staff' && (
            <StaffPanel
              staff={state.staff}
              cash={state.finance.cash}
              onClose={() => setActivePanel('none')}
              onHire={hireStaff}
            />
          )}
        </div>
      </div>
    </div>
  );
}
