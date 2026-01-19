import { Ride } from '@/games/coaster/types';

const DISPATCH_CAPACITY_FACTOR = 0.5;

export function getRideDispatchCapacity(ride: Ride): number {
  return Math.max(1, Math.round(ride.stats.capacity * DISPATCH_CAPACITY_FACTOR * ride.stats.uptime));
}

export function estimateQueueWaitMinutes(queueLength: number, rideTimeSeconds: number, capacity: number): number {
  if (capacity <= 0) return 0;
  const rideTimeMinutes = Math.max(1, Math.round(rideTimeSeconds / 60));
  return Math.max(0, Math.round((queueLength / capacity) * rideTimeMinutes));
}

export function estimateRideQueueWait(ride: Ride): number {
  return estimateQueueWaitMinutes(ride.queue.guestIds.length, ride.stats.rideTime, getRideDispatchCapacity(ride));
}
