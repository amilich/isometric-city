import { CoasterGameState, CoasterTrain } from '@/games/coaster/types';
import { buildTrackLoop } from '@/components/coaster/trackSystem';
import { CardinalDirection } from '@/core/types';

const BASE_SPEED = 0.55;
const LIFT_SPEED = 0.32;
const BRAKE_SPEED = 0.25;
const BOOST_SPEED = 0.9;
const LOOP_SPEED = 0.7;
const LOADING_DURATION = 4;

const directionFromStep = (
  from: { x: number; y: number },
  to: { x: number; y: number }
): CardinalDirection | null => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === -1 && dy === 0) return 'north';
  if (dx === 1 && dy === 0) return 'south';
  if (dx === 0 && dy === -1) return 'east';
  if (dx === 0 && dy === 1) return 'west';
  return null;
};

const createTrain = (rideId: string, path: { x: number; y: number }[]): CoasterTrain => ({
  id: `train-${rideId}`,
  rideId,
  cars: [
    { id: `${rideId}-car-1`, trainId: `train-${rideId}`, offset: 0, guestIds: [], color: '#f97316' },
    { id: `${rideId}-car-2`, trainId: `train-${rideId}`, offset: 0.6, guestIds: [], color: '#fb923c' },
    { id: `${rideId}-car-3`, trainId: `train-${rideId}`, offset: 1.2, guestIds: [], color: '#fdba74' },
  ],
  path,
  segmentIndex: 0,
  progress: 0,
  speed: BASE_SPEED,
  direction: 'east',
  state: 'loading',
  lastDispatchTime: Date.now(),
  stateTimer: 0,
});

export function syncCoasterTrains(state: CoasterGameState): CoasterGameState {
  const coasterRides = state.rides.filter((ride) => ride.type === 'coaster');
  let trains = [...state.coasterTrains];

  coasterRides.forEach((ride) => {
    const stationTile = state.grid.flat().find(
      (tile) => tile.track?.rideId === ride.id && tile.track.special === 'station'
    );
    if (!stationTile) return;
    const loop = buildTrackLoop(state.grid, state.gridSize, stationTile.x, stationTile.y, ride.id);
    if (!loop) return;

    let found = false;
    trains = trains.map((train) => {
      if (train.rideId === ride.id) {
        found = true;
        return { ...train, path: loop };
      }
      return train;
    });

    if (!found) {
      trains.push(createTrain(ride.id, loop));
    }
  });

  trains = trains.filter((train) => coasterRides.some((ride) => ride.id === train.rideId));

  return {
    ...state,
    coasterTrains: trains,
  };
}

export function updateCoasterTrains(state: CoasterGameState, deltaSeconds: number): CoasterGameState {
  const rideStatusById = state.rides.reduce<Record<string, string>>((map, ride) => {
    map[ride.id] = ride.status;
    return map;
  }, {});

  const updatedTrains = state.coasterTrains.map((train) => {
    if (!train.path.length) return train;

    const rideStatus = rideStatusById[train.rideId] ?? 'closed';
    if (rideStatus === 'closed') {
      return { ...train, speed: 0, state: 'waiting', stateTimer: 0 };
    }

    let { segmentIndex, progress, speed, state: trainState, stateTimer } = train;

    if (trainState === 'waiting') {
      trainState = 'loading';
      stateTimer = 0;
    }

    const currentTile = train.path[segmentIndex];
    const currentTrack = state.grid[currentTile.y]?.[currentTile.x]?.track;
    const special = currentTrack?.special;

    stateTimer += deltaSeconds;

    if (trainState === 'loading') {
      if (stateTimer >= LOADING_DURATION) {
        trainState = 'running';
        stateTimer = 0;
      } else {
        return { ...train, state: trainState, stateTimer };
      }
    }

    let targetSpeed = BASE_SPEED;
    if (special === 'lift') targetSpeed = LIFT_SPEED;
    if (special === 'brakes') targetSpeed = BRAKE_SPEED;
    if (special === 'booster') targetSpeed = BOOST_SPEED;
    if (special === 'loop' || special === 'corkscrew') targetSpeed = LOOP_SPEED;

    speed += (targetSpeed - speed) * 0.2;

    progress += speed * deltaSeconds;
    while (progress >= 1) {
      progress -= 1;
      segmentIndex = (segmentIndex + 1) % train.path.length;
      const nextTile = train.path[segmentIndex];
      const nextTrack = state.grid[nextTile.y]?.[nextTile.x]?.track;
      if (nextTrack?.special === 'station') {
        trainState = 'loading';
        stateTimer = 0;
        break;
      }
    }

    const nextIndex = (segmentIndex + 1) % train.path.length;
    const direction = directionFromStep(train.path[segmentIndex], train.path[nextIndex]) ?? train.direction;

    return {
      ...train,
      segmentIndex,
      progress,
      speed,
      direction,
      state: trainState,
      stateTimer,
    };
  });

  return {
    ...state,
    coasterTrains: updatedTrains,
  };
}
