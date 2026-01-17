'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { T, Var, Num, Currency, useGT } from 'gt-next';
import { Button } from '@/components/ui/button';
import { useCoaster } from '@/context/CoasterContext';
import CoasterCanvas from './CoasterCanvas';
import CoasterSidebar from './CoasterSidebar';
import CoasterMiniMap from './CoasterMiniMap';
import FinancePanel from './panels/FinancePanel';
import GuestPanel from './panels/GuestPanel';
import RidesPanel from './panels/RidesPanel';
import RidePanel from './panels/RidePanel';
import StaffPanel from './panels/StaffPanel';

export default function CoasterGame() {
  const gt = useGT();
  const {
    state,
    setSpeed,
    newGame,
    setRidePrice,
    toggleRideStatus,
    setActivePanel,
    hireStaff,
    setStaffPatrolArea,
    clearStaffPatrolArea,
  } = useCoaster();
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{ offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null>(null);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [staffAssignmentId, setStaffAssignmentId] = useState<number | null>(null);

  const selectedRide = useMemo(
    () => state.rides.find((ride) => ride.id === selectedRideId) ?? null,
    [selectedRideId, state.rides]
  );

  useEffect(() => {
    if (selectedRideId && !selectedRide) {
      setSelectedRideId(null);
    }
  }, [selectedRideId, selectedRide]);

  const handleAssignPatrol = useCallback((position: { x: number; y: number }) => {
    if (staffAssignmentId === null) return;
    setStaffPatrolArea(staffAssignmentId, position);
    setStaffAssignmentId(null);
  }, [setStaffPatrolArea, staffAssignmentId]);

  const handleClosePanel = useCallback(() => {
    setActivePanel('none');
    setStaffAssignmentId(null);
  }, [setActivePanel]);

  return (
    <div className="w-full h-full flex bg-background text-foreground">
      <CoasterSidebar />
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-slate-900/70">
          <div className="flex items-center gap-4">
            <div className="text-lg font-semibold tracking-wide">{state.parkName}</div>
            <T>
              <div className="text-xs text-muted-foreground">
                Year <Num>{state.year}</Num> · Day <Num>{state.day}</Num> · <Var>{state.hour.toString().padStart(2, '0')}</Var>:00
              </div>
            </T>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <T><div>Guests: <Num>{state.stats.guestsInPark}</Num></div></T>
            <T><div>Rating: <Num>{state.stats.rating}</Num></div></T>
            <div className="font-medium"><Currency currency="USD">{state.finance.cash}</Currency></div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={state.speed === 0 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(0)}>
              {gt('Pause')}
            </Button>
            <Button variant={state.speed === 1 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(1)}>
              {gt('1x', { $context: 'Game speed multiplier - 1 times normal speed' })}
            </Button>
            <Button variant={state.speed === 2 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(2)}>
              {gt('2x', { $context: 'Game speed multiplier - 2 times normal speed' })}
            </Button>
            <Button variant={state.speed === 3 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(3)}>
              {gt('3x', { $context: 'Game speed multiplier - 3 times normal speed' })}
            </Button>
            <Button variant="outline" size="sm" onClick={() => newGame()}>
              {gt('New Park')}
            </Button>
          </div>
        </div>
        <div className="flex-1 relative">
          <CoasterCanvas
            navigationTarget={navigationTarget}
            onNavigationComplete={() => setNavigationTarget(null)}
            onViewportChange={setViewport}
            onSelectRide={setSelectedRideId}
            patrolAssignmentId={staffAssignmentId}
            onAssignPatrol={handleAssignPatrol}
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
              onClose={handleClosePanel}
            />
          )}
          {state.activePanel === 'rides' && (
            <RidesPanel
              rides={state.rides}
              onClose={handleClosePanel}
              onSelectRide={(rideId) => {
                setSelectedRideId(rideId);
                setActivePanel('none');
              }}
              onToggleRide={toggleRideStatus}
            />
          )}
          {state.activePanel === 'guests' && (
            <GuestPanel
              guests={state.guests}
              onClose={handleClosePanel}
            />
          )}
          {state.activePanel === 'staff' && (
            <StaffPanel
              staff={state.staff}
              cash={state.finance.cash}
              assignmentId={staffAssignmentId}
              onClose={handleClosePanel}
              onHire={hireStaff}
              onStartPatrol={(staffId) => setStaffAssignmentId(staffId)}
              onClearPatrol={(staffId) => {
                clearStaffPatrolArea(staffId);
                setStaffAssignmentId((current) => (current === staffId ? null : current));
              }}
              onCancelPatrol={() => setStaffAssignmentId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
