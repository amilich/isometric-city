import { CoasterGameState } from './types';
import { syncCoasterTrains, updateCoasterTrains } from '@/components/coaster/coasterTrainSystem';
import { updateGuests } from '@/components/coaster/guestSystem';
import { updateStaff } from '@/components/coaster/staffSystem';

const HOURS_PER_SECOND = 0.04;
const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;
const CLOUD_SPAWN_INTERVAL = 5.5;
const CLOUD_MAX_COUNT = 12;

const spawnCloud = (state: CoasterGameState) => {
  const edge = Math.random() > 0.5 ? 'west' : 'north';
  const margin = 6;
  const x = edge === 'west' ? -margin : Math.random() * state.gridSize;
  const y = edge === 'north' ? -margin : Math.random() * state.gridSize;
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    x,
    y,
    vx: 0.18 + Math.random() * 0.12,
    vy: 0.12 + Math.random() * 0.08,
    size: 0.8 + Math.random() * 1.0,
    opacity: 0.2 + Math.random() * 0.25,
  };
};

export function simulateCoasterTick(
  state: CoasterGameState,
  deltaSeconds: number
): CoasterGameState {
  if (state.speed === 0) {
    return state;
  }

  let hour = state.hour + deltaSeconds * HOURS_PER_SECOND;
  let day = state.day;
  let month = state.month;
  let year = state.year;
  let finance = { ...state.finance };

  while (hour >= 24) {
    hour -= 24;
    day += 1;
  }

  while (day > DAYS_PER_MONTH) {
    day -= DAYS_PER_MONTH;
    month += 1;
  }

  while (month > MONTHS_PER_YEAR) {
    month -= MONTHS_PER_YEAR;
    year += 1;
  }

  const dayChanged = day !== state.day;
  if (dayChanged) {
    const staffCosts = state.staff.length * 120;
    const rideCosts = state.rides.length * 25;
    finance.dailyExpenses = staffCosts + rideCosts;
    finance.money = Math.max(0, finance.money - finance.dailyExpenses);
    finance.dailyIncome = 0;
  }

  const timeUpdated = {
    ...state,
    hour,
    day,
    month,
    year,
    tick: state.tick + 1,
    finance,
  };

  const synced = syncCoasterTrains(timeUpdated);
  const trainsUpdated = updateCoasterTrains(synced, deltaSeconds);
  const ridesUpdated = trainsUpdated.rides.map((ride) => {
    if (ride.status === 'testing' && Date.now() - ride.createdAt > 20000) {
      return { ...ride, status: 'open' };
    }
    return ride;
  });
  const guestsUpdated = updateGuests({ ...trainsUpdated, rides: ridesUpdated }, deltaSeconds);
  const staffUpdated = updateStaff(guestsUpdated, deltaSeconds);

  let cloudSpawnTimer = staffUpdated.cloudSpawnTimer + deltaSeconds;
  let clouds = staffUpdated.clouds.map((cloud) => ({
    ...cloud,
    x: cloud.x + cloud.vx * deltaSeconds,
    y: cloud.y + cloud.vy * deltaSeconds,
  }));

  clouds = clouds.filter(
    (cloud) => cloud.x < staffUpdated.gridSize + 12 && cloud.y < staffUpdated.gridSize + 12
  );

  if (cloudSpawnTimer >= CLOUD_SPAWN_INTERVAL && clouds.length < CLOUD_MAX_COUNT) {
    cloudSpawnTimer = 0;
    clouds.push(spawnCloud(staffUpdated));
  }

  const avgHappiness =
    staffUpdated.guests.length > 0
      ? staffUpdated.guests.reduce((sum, guest) => sum + guest.needs.happiness, 0) / staffUpdated.guests.length
      : 75;
  const rideVariety = Math.min(1, staffUpdated.rides.length / 8);
  const sceneryCount = staffUpdated.grid.reduce(
    (sum, row) => sum + row.reduce((rowSum, tile) => rowSum + tile.scenery.length, 0),
    0
  );
  const sceneryBonus = Math.min(12, sceneryCount * 0.25);
  const rating = Math.round(
    Math.min(100, Math.max(10, avgHappiness * 0.6 + rideVariety * 30 + sceneryBonus))
  );

  return {
    ...staffUpdated,
    clouds,
    cloudSpawnTimer,
    rides: staffUpdated.rides,
    parkRating: rating,
  };
}
