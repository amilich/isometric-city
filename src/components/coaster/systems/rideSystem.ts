/**
 * Ride System - Handles ride operations, queues, and guest interaction
 */

import { CoasterGameState } from '@/games/coaster/types/game';
import { RIDE_DEFINITIONS } from '@/games/coaster/types/buildings';
import { addThought } from './guestAI';

export function updateRides(state: CoasterGameState): CoasterGameState {
  const guests = state.guests.map(guest => ({ ...guest })) as CoasterGameState['guests'];
  const guestMap = new Map(guests.map(guest => [guest.id, guest]));

  const finances = {
    ...state.finances,
    currentMonthRecord: { ...state.finances.currentMonthRecord },
  };

  const rides = state.rides.map(ride => {
    const updatedRide = {
      ...ride,
      guestsInQueue: [...ride.guestsInQueue],
      guestsOnRide: [...ride.guestsOnRide],
    };

    const rideDef = RIDE_DEFINITIONS[ride.type];
    if (!rideDef || ride.status !== 'open') {
      return updatedRide;
    }

    if (updatedRide.isRunning) {
      updatedRide.cycleTimer = Math.max(0, updatedRide.cycleTimer - 1);

      if (updatedRide.cycleTimer === 0) {
        updatedRide.isRunning = false;

        // Release guests
        updatedRide.guestsOnRide.forEach(guestId => {
          const guest = guestMap.get(guestId);
          if (!guest) return;

          const intensity = updatedRide.stats.intensity || rideDef.intensityBase;
          const excitement = updatedRide.stats.excitement || rideDef.excitementBase;

          let updatedGuest: typeof guest = { ...guest, state: 'walking' };
          if (intensity > guest.preferences.intensityTolerance + 2) {
            updatedGuest.happiness = Math.max(0, updatedGuest.happiness - 15);
            updatedGuest.nausea = Math.min(255, updatedGuest.nausea + intensity * 8);
            updatedGuest = addThought(updatedGuest, 'too_intense', updatedRide.name);
          } else if (excitement > 4) {
            updatedGuest.happiness = Math.min(255, updatedGuest.happiness + 15);
            updatedGuest = addThought(updatedGuest, 'ride_was_great', updatedRide.name);
          } else {
            updatedGuest.happiness = Math.min(255, updatedGuest.happiness + 5);
            updatedGuest = addThought(updatedGuest, 'ride_was_boring', updatedRide.name);
          }

          updatedGuest.ridesRidden = [...updatedGuest.ridesRidden, updatedRide.id];
          guestMap.set(guestId, updatedGuest);
        });

        updatedRide.totalRiders += updatedRide.guestsOnRide.length;
        updatedRide.guestsOnRide = [];
      }
    } else if (updatedRide.guestsInQueue.length > 0) {
      const capacity = rideDef.defaultCapacity;
      const boardingGuests: number[] = [];
      const remainingQueue: number[] = [];

      for (const guestId of updatedRide.guestsInQueue) {
        const guest = guestMap.get(guestId);
        if (!guest) continue;

        if (boardingGuests.length >= capacity) {
          remainingQueue.push(guestId);
          continue;
        }

        if (guest.ticketType === 'pay_per_ride' && guest.cash < updatedRide.price) {
          const updatedGuest = addThought({ ...guest, state: 'walking' }, 'expensive', updatedRide.name);
          guestMap.set(guestId, updatedGuest);
          continue;
        }

        const updatedGuest: typeof guest = { ...guest, state: 'on_ride', intent: undefined };
        if (guest.ticketType === 'pay_per_ride') {
          updatedGuest.cash -= updatedRide.price;
          finances.cash += updatedRide.price;
          finances.currentMonthRecord.rideTickets += updatedRide.price;
          updatedRide.totalRevenue += updatedRide.price;
        }

        guestMap.set(guestId, updatedGuest);
        boardingGuests.push(guestId);
      }

      updatedRide.guestsInQueue = remainingQueue;
      updatedRide.queueLength = updatedRide.guestsInQueue.length;

      if (boardingGuests.length > 0) {
        updatedRide.guestsOnRide = boardingGuests;
        updatedRide.isRunning = true;
        updatedRide.cycleTimer = rideDef.defaultRideTime;
      }
    }

    return updatedRide;
  });

  return {
    ...state,
    rides,
    guests: Array.from(guestMap.values()),
    finances,
  };
}
