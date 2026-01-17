'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { T, Var, Num } from 'gt-next';
import { Button } from '@/components/ui/button';
import { useCoaster } from '@/context/CoasterContext';
import CoasterCanvas from './CoasterCanvas';
import CoasterSidebar from './CoasterSidebar';
import CoasterMiniMap from './CoasterMiniMap';
import FinancePanel from './panels/FinancePanel';
import GuestPanel from './panels/GuestPanel';
import ParkPanel from './panels/ParkPanel';
import ResearchPanel from './panels/ResearchPanel';
import RidesPanel from './panels/RidesPanel';
import RidePanel from './panels/RidePanel';
import StaffPanel from './panels/StaffPanel';

export default function CoasterGame() {
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
    setEntranceFee,
    setParkName,
    takeLoan,
    repayLoan,
    setResearchFunding,
    setActiveResearch,
  } = useCoaster();
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{ offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null>(null);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [staffAssignmentId, setStaffAssignmentId] = useState<number | null>(null);
  const [patrolRadius, setPatrolRadius] = useState(4);

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
    setStaffPatrolArea(staffAssignmentId, position, patrolRadius);
    setStaffAssignmentId(null);
  }, [patrolRadius, setStaffPatrolArea, staffAssignmentId]);

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
                Year <Var>{state.year}</Var> · Day <Var>{state.day}</Var> · <Var>{state.hour.toString().padStart(2, '0')}</Var>:00
              </div>
            </T>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <T><div>Guests: <Num>{state.stats.guestsInPark}</Num></div></T>
            <T><div>Rating: <Num>{state.stats.rating}</Num></div></T>
            <T>
              <div className="capitalize text-muted-foreground">
                <Var>{state.weather.type}</Var> · <Var>{state.weather.temperature}</Var>°C
              </div>
            </T>
            <div className="font-medium">$<Num>{state.finance.cash}</Num></div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={state.speed === 0 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(0)}>
              <T>Pause</T>
            </Button>
            <Button variant={state.speed === 1 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(1)}>
              <T>1x</T>
            </Button>
            <Button variant={state.speed === 2 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(2)}>
              <T>2x</T>
            </Button>
            <Button variant={state.speed === 3 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(3)}>
              <T>3x</T>
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
              entranceRevenue={state.finance.entranceRevenue}
              entranceFee={state.finance.entranceFee}
              rideRevenue={state.finance.rideRevenue}
              shopRevenue={state.finance.shopRevenue}
              income={state.finance.income}
              expenses={state.finance.expenses}
              staffCost={state.finance.staffCost}
              maintenanceCost={state.finance.maintenanceCost}
              researchCost={state.finance.researchCost}
              loanInterestCost={state.finance.loanInterestCost}
              loan={state.finance.loan}
              onLoanChange={(amount, action) => {
                if (action === 'take') {
                  takeLoan(amount);
                } else {
                  repayLoan(amount);
                }
              }}
              onEntranceFeeChange={setEntranceFee}
              onClose={handleClosePanel}
            />
          )}
          {state.activePanel === 'park' && (
            <ParkPanel
              parkName={state.parkName}
              stats={state.stats}
              weather={state.weather}
              onNameChange={setParkName}
              onClose={handleClosePanel}
            />
          )}
          {state.activePanel === 'research' && (
            <ResearchPanel
              research={state.research}
              onClose={handleClosePanel}
              onFundingChange={setResearchFunding}
              onStartResearch={setActiveResearch}
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
              patrolRadius={patrolRadius}
              onClose={handleClosePanel}
              onHire={hireStaff}
              onStartPatrol={(staffId) => setStaffAssignmentId(staffId)}
              onClearPatrol={(staffId) => {
                clearStaffPatrolArea(staffId);
                setStaffAssignmentId((current) => (current === staffId ? null : current));
              }}
              onCancelPatrol={() => setStaffAssignmentId(null)}
              onPatrolRadiusChange={setPatrolRadius}
            />
          )}
        </div>
      </div>
    </div>
  );
}
