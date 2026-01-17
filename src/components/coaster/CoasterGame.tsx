'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CoasterBuildingType } from '@/games/coaster/types';
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
import ShopPanel from './panels/ShopPanel';
import StaffPanel from './panels/StaffPanel';

export default function CoasterGame() {
  const {
    state,
    setSpeed,
    newGame,
    setRidePrice,
    setShopPrice,
    toggleShopOpen,
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
  const [focusedStaffId, setFocusedStaffId] = useState<number | null>(null);
  const [patrolRadius, setPatrolRadius] = useState(4);

  const selectedRide = useMemo(
    () => state.rides.find((ride) => ride.id === selectedRideId) ?? null,
    [selectedRideId, state.rides]
  );
  const shops = useMemo(() => {
    const entries: {
      id: string;
      name: string;
      type: CoasterBuildingType;
      price: number;
      open: boolean;
      position: { x: number; y: number };
    }[] = [];
    state.grid.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (!tile.building) return;
        if (tile.building.type === 'staff_room') return;
        entries.push({
          id: `${x}-${y}-${tile.building.type}`,
          name: tile.building.name,
          type: tile.building.type,
          price: tile.building.price,
          open: tile.building.open,
          position: { x, y },
        });
      });
    });
    return entries;
  }, [state.grid]);
  const staffRoomCount = useMemo(() => {
    let count = 0;
    state.grid.forEach((row) => {
      row.forEach((tile) => {
        if (tile.building?.type === 'staff_room') {
          count += 1;
        }
      });
    });
    return count;
  }, [state.grid]);

  useEffect(() => {
    if (selectedRideId && !selectedRide) {
      setSelectedRideId(null);
    }
  }, [selectedRideId, selectedRide]);

  useEffect(() => {
    if (state.activePanel !== 'staff') {
      if (staffAssignmentId !== null) {
        setStaffAssignmentId(null);
      }
      if (focusedStaffId !== null) {
        setFocusedStaffId(null);
      }
    }
  }, [focusedStaffId, staffAssignmentId, state.activePanel]);

  const handleAssignPatrol = useCallback((position: { x: number; y: number }) => {
    if (staffAssignmentId === null) return;
    setStaffPatrolArea(staffAssignmentId, position, patrolRadius);
    setStaffAssignmentId(null);
    setFocusedStaffId(staffAssignmentId);
  }, [patrolRadius, setStaffPatrolArea, staffAssignmentId]);

  const handleClosePanel = useCallback(() => {
    setActivePanel('none');
    setStaffAssignmentId(null);
    setFocusedStaffId(null);
  }, [setActivePanel]);

  return (
    <div className="w-full h-full flex bg-background text-foreground">
      <CoasterSidebar />
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-slate-900/70">
          <div className="flex items-center gap-4">
            <div className="text-lg font-semibold tracking-wide">{state.parkName}</div>
            <div className="text-xs text-muted-foreground">
              Year {state.year} · Day {state.day} · {state.hour.toString().padStart(2, '0')}:00
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>Guests: {state.stats.guestsInPark}</div>
            <div>Rating: {state.stats.rating}</div>
            <div className="capitalize text-muted-foreground">
              {state.weather.type} · {state.weather.temperature}°C
            </div>
            <div className="font-medium">${state.finance.cash.toLocaleString()}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={state.speed === 0 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(0)}>
              Pause
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
              New Park
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
            patrolAssignmentRadius={patrolRadius}
            focusedStaffId={focusedStaffId}
            onAssignPatrol={handleAssignPatrol}
          />
          <CoasterMiniMap
            onNavigate={(x, y) => setNavigationTarget({ x, y })}
            viewport={viewport}
            focusedStaffId={focusedStaffId}
          />
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
          {state.activePanel === 'shops' && (
            <ShopPanel
              shops={shops}
              onClose={handleClosePanel}
              onPriceChange={setShopPrice}
              onToggleOpen={toggleShopOpen}
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
              focusId={focusedStaffId}
              staffRoomCount={staffRoomCount}
              onClose={handleClosePanel}
              onHire={hireStaff}
              onStartPatrol={(staffId) => {
                setStaffAssignmentId(staffId);
                setFocusedStaffId(staffId);
              }}
              onClearPatrol={(staffId) => {
                clearStaffPatrolArea(staffId);
                setStaffAssignmentId((current) => (current === staffId ? null : current));
              }}
              onCancelPatrol={() => setStaffAssignmentId(null)}
              onPatrolRadiusChange={setPatrolRadius}
              onFocusStaff={setFocusedStaffId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
