import { MutableRefObject } from 'react';
import {
  Car,
  EmergencyVehicle,
  EmergencyVehicleType,
  Pedestrian,
  PedestrianDestType,
  WorldRenderState,
  CarDirection,
} from '@/components/game/types';
import {
  CAR_COLORS,
  PEDESTRIAN_SKIN_COLORS,
  PEDESTRIAN_SHIRT_COLORS,
  PEDESTRIAN_MIN_ZOOM,
  DIRECTION_META,
} from '@/components/game/constants';
import {
  isRoadTile,
  getDirectionOptions,
  pickNextDirection,
  findPathOnRoads,
  getDirectionToTile,
} from '@/components/game/utils';
import {
  findResidentialBuildings,
  findPedestrianDestinations,
  findStations,
  findFires,
} from '@/components/game/gridFinders';

export interface CrimeIncident {
  x: number;
  y: number;
  type: 'robbery' | 'burglary' | 'disturbance' | 'traffic';
  timeRemaining: number;
}

export interface VehicleUpdateRefs {
  worldStateRef: MutableRefObject<WorldRenderState>;
  carsRef: MutableRefObject<Car[]>;
  carIdRef: MutableRefObject<number>;
  carSpawnTimerRef: MutableRefObject<number>;
  emergencyVehiclesRef: MutableRefObject<EmergencyVehicle[]>;
  emergencyVehicleIdRef: MutableRefObject<number>;
  emergencyDispatchTimerRef: MutableRefObject<number>;
  activeFiresRef: MutableRefObject<Set<string>>;
  activeCrimesRef: MutableRefObject<Set<string>>;
  activeCrimeIncidentsRef: MutableRefObject<Map<string, CrimeIncident>>;
  crimeSpawnTimerRef: MutableRefObject<number>;
  pedestriansRef: MutableRefObject<Pedestrian[]>;
  pedestrianIdRef: MutableRefObject<number>;
  pedestrianSpawnTimerRef: MutableRefObject<number>;
  cachedRoadTileCountRef: MutableRefObject<{ count: number; gridVersion: number }>;
  gridVersionRef: MutableRefObject<number>;
}

export function spawnRandomCar(refs: VehicleUpdateRefs): boolean {
  const { grid: currentGrid, gridSize: currentGridSize } = refs.worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0) return false;

  for (let attempt = 0; attempt < 20; attempt++) {
    const tileX = Math.floor(Math.random() * currentGridSize);
    const tileY = Math.floor(Math.random() * currentGridSize);
    if (!isRoadTile(currentGrid, currentGridSize, tileX, tileY)) continue;

    const options = getDirectionOptions(currentGrid, currentGridSize, tileX, tileY);
    if (options.length === 0) continue;

    const direction = options[Math.floor(Math.random() * options.length)];
    refs.carsRef.current.push({
      id: refs.carIdRef.current++,
      tileX,
      tileY,
      direction,
      progress: Math.random() * 0.8,
      speed: (0.35 + Math.random() * 0.35) * 0.7,
      age: 0,
      maxAge: 1800 + Math.random() * 2700,
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
      laneOffset: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3),
    });
    return true;
  }

  return false;
}

export function spawnPedestrian(refs: VehicleUpdateRefs): boolean {
  const { grid: currentGrid, gridSize: currentGridSize } = refs.worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0) return false;

  const residentials = findResidentialBuildings(currentGrid, currentGridSize);
  if (residentials.length === 0) {
    return false;
  }

  const destinations = findPedestrianDestinations(currentGrid, currentGridSize);
  if (destinations.length === 0) {
    return false;
  }

  const home = residentials[Math.floor(Math.random() * residentials.length)];
  const dest = destinations[Math.floor(Math.random() * destinations.length)];

  const path = findPathOnRoads(currentGrid, currentGridSize, home.x, home.y, dest.x, dest.y);
  if (!path || path.length === 0) {
    return false;
  }

  const startIndex = Math.floor(Math.random() * path.length);
  const startTile = path[startIndex];

  let direction: CarDirection = 'south';
  if (startIndex + 1 < path.length) {
    const nextTile = path[startIndex + 1];
    const dir = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
    if (dir) direction = dir;
  } else if (startIndex > 0) {
    const prevTile = path[startIndex - 1];
    const dir = getDirectionToTile(prevTile.x, prevTile.y, startTile.x, startTile.y);
    if (dir) direction = dir;
  }

  refs.pedestriansRef.current.push({
    id: refs.pedestrianIdRef.current++,
    tileX: startTile.x,
    tileY: startTile.y,
    direction,
    progress: Math.random(),
    speed: 0.12 + Math.random() * 0.08,
    pathIndex: startIndex,
    age: 0,
    maxAge: 60 + Math.random() * 90,
    skinColor: PEDESTRIAN_SKIN_COLORS[Math.floor(Math.random() * PEDESTRIAN_SKIN_COLORS.length)],
    shirtColor: PEDESTRIAN_SHIRT_COLORS[Math.floor(Math.random() * PEDESTRIAN_SHIRT_COLORS.length)],
    walkOffset: Math.random() * Math.PI * 2,
    sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
    destType: dest.type,
    homeX: home.x,
    homeY: home.y,
    destX: dest.x,
    destY: dest.y,
    returningHome: startIndex >= path.length - 1,
    path,
  });

  return true;
}

export function dispatchEmergencyVehicle(
  refs: VehicleUpdateRefs,
  type: EmergencyVehicleType,
  stationX: number,
  stationY: number,
  targetX: number,
  targetY: number
): boolean {
  const { grid: currentGrid, gridSize: currentGridSize } = refs.worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0) return false;

  const path = findPathOnRoads(currentGrid, currentGridSize, stationX, stationY, targetX, targetY);
  if (!path || path.length === 0) return false;

  const startTile = path[0];
  let direction: CarDirection = 'south';

  if (path.length >= 2) {
    const nextTile = path[1];
    const dir = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
    if (dir) direction = dir;
  }

  refs.emergencyVehiclesRef.current.push({
    id: refs.emergencyVehicleIdRef.current++,
    type,
    tileX: startTile.x,
    tileY: startTile.y,
    direction,
    progress: 0,
    speed: type === 'fire_truck' ? 0.8 : 0.9,
    state: 'dispatching',
    stationX,
    stationY,
    targetX,
    targetY,
    path,
    pathIndex: 0,
    respondTime: 0,
    laneOffset: 0,
    flashTimer: 0,
  });

  return true;
}

export function updateEmergencyDispatch(refs: VehicleUpdateRefs): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = refs.worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;

  const fires = findFires(currentGrid, currentGridSize);
  const fireStations = findStations(currentGrid, currentGridSize, 'fire_station');

  for (const fire of fires) {
    const fireKey = `${fire.x},${fire.y}`;
    if (refs.activeFiresRef.current.has(fireKey)) continue;

    let nearestStation: { x: number; y: number } | null = null;
    let nearestDist = Infinity;

    for (const station of fireStations) {
      const dist = Math.abs(station.x - fire.x) + Math.abs(station.y - fire.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestStation = station;
      }
    }

    if (nearestStation) {
      if (dispatchEmergencyVehicle(refs, 'fire_truck', nearestStation.x, nearestStation.y, fire.x, fire.y)) {
        refs.activeFiresRef.current.add(fireKey);
      }
    }
  }

  const crimes = Array.from(refs.activeCrimeIncidentsRef.current.values()).map(c => ({ x: c.x, y: c.y }));
  const policeStations = findStations(currentGrid, currentGridSize, 'police_station');

  let dispatched = 0;
  const maxDispatchPerCheck = Math.max(3, Math.min(6, policeStations.length * 2));
  for (const crime of crimes) {
    if (dispatched >= maxDispatchPerCheck) break;

    const crimeKey = `${crime.x},${crime.y}`;
    if (refs.activeCrimesRef.current.has(crimeKey)) continue;

    let nearestStation: { x: number; y: number } | null = null;
    let nearestDist = Infinity;

    for (const station of policeStations) {
      const dist = Math.abs(station.x - crime.x) + Math.abs(station.y - crime.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestStation = station;
      }
    }

    if (nearestStation) {
      if (dispatchEmergencyVehicle(refs, 'police_car', nearestStation.x, nearestStation.y, crime.x, crime.y)) {
        refs.activeCrimesRef.current.add(crimeKey);
        dispatched++;
      }
    }
  }
}

export function updateEmergencyVehicles(refs: VehicleUpdateRefs, delta: number): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = refs.worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0) {
    refs.emergencyVehiclesRef.current = [];
    return;
  }

  const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;

  refs.emergencyDispatchTimerRef.current -= delta;
  if (refs.emergencyDispatchTimerRef.current <= 0) {
    updateEmergencyDispatch(refs);
    refs.emergencyDispatchTimerRef.current = 1.5;
  }

  const updatedVehicles: EmergencyVehicle[] = [];

  for (const vehicle of [...refs.emergencyVehiclesRef.current]) {
    vehicle.flashTimer += delta * 8;

    if (vehicle.state === 'responding') {
      if (!isRoadTile(currentGrid, currentGridSize, vehicle.tileX, vehicle.tileY)) {
        const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
        if (vehicle.type === 'fire_truck') {
          refs.activeFiresRef.current.delete(targetKey);
        } else {
          refs.activeCrimesRef.current.delete(targetKey);
          refs.activeCrimeIncidentsRef.current.delete(targetKey);
        }
        continue;
      }

      vehicle.respondTime += delta * speedMultiplier;
      const respondDuration = vehicle.type === 'fire_truck' ? 8 : 5;

      if (vehicle.respondTime >= respondDuration) {
        const targetKey = `${vehicle.targetX},${vehicle.targetY}`;

        if (vehicle.type === 'police_car') {
          refs.activeCrimeIncidentsRef.current.delete(targetKey);
        }

        const returnPath = findPathOnRoads(
          currentGrid, currentGridSize,
          vehicle.tileX, vehicle.tileY,
          vehicle.stationX, vehicle.stationY
        );

        if (returnPath && returnPath.length >= 2) {
          vehicle.path = returnPath;
          vehicle.pathIndex = 0;
          vehicle.state = 'returning';
          vehicle.progress = 0;

          const nextTile = returnPath[1];
          const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
          if (dir) vehicle.direction = dir;
        } else if (returnPath && returnPath.length === 1) {
          if (vehicle.type === 'fire_truck') {
            refs.activeFiresRef.current.delete(targetKey);
          } else {
            refs.activeCrimesRef.current.delete(targetKey);
          }
          continue;
        } else {
          if (vehicle.type === 'fire_truck') {
            refs.activeFiresRef.current.delete(targetKey);
          } else {
            refs.activeCrimesRef.current.delete(targetKey);
          }
          continue;
        }
      }

      updatedVehicles.push(vehicle);
      continue;
    }

    if (!isRoadTile(currentGrid, currentGridSize, vehicle.tileX, vehicle.tileY)) {
      const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
      if (vehicle.type === 'fire_truck') {
        refs.activeFiresRef.current.delete(targetKey);
      } else {
        refs.activeCrimesRef.current.delete(targetKey);
        refs.activeCrimeIncidentsRef.current.delete(targetKey);
      }
      continue;
    }

    if (vehicle.tileX < 0 || vehicle.tileX >= currentGridSize ||
        vehicle.tileY < 0 || vehicle.tileY >= currentGridSize) {
      const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
      if (vehicle.type === 'fire_truck') {
        refs.activeFiresRef.current.delete(targetKey);
      } else {
        refs.activeCrimesRef.current.delete(targetKey);
        refs.activeCrimeIncidentsRef.current.delete(targetKey);
      }
      continue;
    }

    vehicle.progress += vehicle.speed * delta * speedMultiplier;

    let shouldRemove = false;

    if (vehicle.path.length === 1 && vehicle.state === 'dispatching') {
      vehicle.state = 'responding';
      vehicle.respondTime = 0;
      vehicle.progress = 0;
      updatedVehicles.push(vehicle);
      continue;
    }

    while (vehicle.progress >= 1 && vehicle.pathIndex < vehicle.path.length - 1) {
      vehicle.pathIndex++;
      vehicle.progress -= 1;

      const currentTile = vehicle.path[vehicle.pathIndex];

      if (currentTile.x < 0 || currentTile.x >= currentGridSize ||
          currentTile.y < 0 || currentTile.y >= currentGridSize) {
        shouldRemove = true;
        break;
      }

      vehicle.tileX = currentTile.x;
      vehicle.tileY = currentTile.y;

      if (vehicle.pathIndex >= vehicle.path.length - 1) {
        if (vehicle.state === 'dispatching') {
          vehicle.state = 'responding';
          vehicle.respondTime = 0;
          vehicle.progress = 0;
        } else if (vehicle.state === 'returning') {
          shouldRemove = true;
        }
        break;
      }

      if (vehicle.pathIndex + 1 < vehicle.path.length) {
        const nextTile = vehicle.path[vehicle.pathIndex + 1];
        const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
        if (dir) vehicle.direction = dir;
      }
    }

    if (shouldRemove) {
      const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
      if (vehicle.type === 'fire_truck') {
        refs.activeFiresRef.current.delete(targetKey);
      } else {
        refs.activeCrimesRef.current.delete(targetKey);
        refs.activeCrimeIncidentsRef.current.delete(targetKey);
      }
      continue;
    }

    updatedVehicles.push(vehicle);
  }

  refs.emergencyVehiclesRef.current = updatedVehicles;
}

export function updateCars(refs: VehicleUpdateRefs, delta: number, isMobile: boolean): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = refs.worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0) {
    refs.carsRef.current = [];
    return;
  }

  const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;

  const baseMaxCars = 160;
  const maxCars = Math.min(baseMaxCars, Math.max(16, Math.floor(currentGridSize * (2))));
  refs.carSpawnTimerRef.current -= delta;
  if (refs.carsRef.current.length < maxCars && refs.carSpawnTimerRef.current <= 0) {
    if (spawnRandomCar(refs)) {
      refs.carSpawnTimerRef.current = 0.9 + Math.random() * 1.3;
    } else {
      refs.carSpawnTimerRef.current = 0.5;
    }
  }

  const updatedCars: Car[] = [];
  for (const car of [...refs.carsRef.current]) {
    let alive = true;

    car.age += delta;
    if (car.age > car.maxAge) {
      continue;
    }

    if (!isRoadTile(currentGrid, currentGridSize, car.tileX, car.tileY)) {
      continue;
    }

    car.progress += car.speed * delta * speedMultiplier;
    let guard = 0;
    while (car.progress >= 1 && guard < 4) {
      guard++;
      const meta = DIRECTION_META[car.direction];
      car.tileX += meta.step.x;
      car.tileY += meta.step.y;

      if (!isRoadTile(currentGrid, currentGridSize, car.tileX, car.tileY)) {
        alive = false;
        break;
      }

      car.progress -= 1;
      const nextDirection = pickNextDirection(car.direction, currentGrid, currentGridSize, car.tileX, car.tileY);
      if (!nextDirection) {
        alive = false;
        break;
      }
      car.direction = nextDirection;
    }

    if (alive) {
      updatedCars.push(car);
    }
  }

  refs.carsRef.current = updatedCars;
}

export function updatePedestrians(refs: VehicleUpdateRefs, delta: number, isMobile: boolean): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = refs.worldStateRef.current;

  const minZoomForPedestrians = isMobile ? 0.8 : PEDESTRIAN_MIN_ZOOM;
  if (currentZoom < minZoomForPedestrians) {
    refs.pedestriansRef.current = [];
    return;
  }

  if (!currentGrid || currentGridSize <= 0) {
    refs.pedestriansRef.current = [];
    return;
  }

  const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;

  const currentGridVersion = refs.gridVersionRef.current;
  let roadTileCount: number;
  if (refs.cachedRoadTileCountRef.current.gridVersion === currentGridVersion) {
    roadTileCount = refs.cachedRoadTileCountRef.current.count;
  } else {
    roadTileCount = 0;
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        if (currentGrid[y][x].building.type === 'road') {
          roadTileCount++;
        }
      }
    }
    refs.cachedRoadTileCountRef.current = { count: roadTileCount, gridVersion: currentGridVersion };
  }

  const maxPedestrians = isMobile
    ? Math.min(50, Math.max(20, Math.floor(roadTileCount * 0.8)))
    : Math.max(200, roadTileCount * 3);
  refs.pedestrianSpawnTimerRef.current -= delta;
  if (refs.pedestriansRef.current.length < maxPedestrians && refs.pedestrianSpawnTimerRef.current <= 0) {
    let spawnedCount = 0;
    const spawnBatch = isMobile
      ? Math.min(8, Math.max(3, Math.floor(roadTileCount / 25)))
      : Math.min(50, Math.max(20, Math.floor(roadTileCount / 10)));
    for (let i = 0; i < spawnBatch; i++) {
      if (spawnPedestrian(refs)) {
        spawnedCount++;
      }
    }
    refs.pedestrianSpawnTimerRef.current = spawnedCount > 0 ? (isMobile ? 0.15 : 0.02) : (isMobile ? 0.08 : 0.01);
  }

  const updatedPedestrians: Pedestrian[] = [];

  for (const ped of [...refs.pedestriansRef.current]) {
    let alive = true;

    ped.age += delta;
    if (ped.age > ped.maxAge) {
      continue;
    }

    ped.walkOffset += delta * 8;

    if (!isRoadTile(currentGrid, currentGridSize, ped.tileX, ped.tileY)) {
      continue;
    }

    ped.progress += ped.speed * delta * speedMultiplier;

    if (ped.path.length === 1 && ped.progress >= 1) {
      if (!ped.returningHome) {
        ped.returningHome = true;
        const returnPath = findPathOnRoads(currentGrid, currentGridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
        if (returnPath && returnPath.length > 0) {
          ped.path = returnPath;
          ped.pathIndex = 0;
          ped.progress = 0;
          ped.tileX = returnPath[0].x;
          ped.tileY = returnPath[0].y;
          if (returnPath.length > 1) {
            const nextTile = returnPath[1];
            const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
            if (dir) ped.direction = dir;
          }
        } else {
          continue;
        }
      } else {
        continue;
      }
    }

    while (ped.progress >= 1 && ped.pathIndex < ped.path.length - 1) {
      ped.pathIndex++;
      ped.progress -= 1;

      const currentTile = ped.path[ped.pathIndex];

      if (currentTile.x < 0 || currentTile.x >= currentGridSize ||
          currentTile.y < 0 || currentTile.y >= currentGridSize) {
        alive = false;
        break;
      }

      ped.tileX = currentTile.x;
      ped.tileY = currentTile.y;

      if (ped.pathIndex >= ped.path.length - 1) {
        if (!ped.returningHome) {
          ped.returningHome = true;
          const returnPath = findPathOnRoads(currentGrid, currentGridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
          if (returnPath && returnPath.length > 0) {
            ped.path = returnPath;
            ped.pathIndex = 0;
            ped.progress = 0;
            if (returnPath.length > 1) {
              const nextTile = returnPath[1];
              const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
              if (dir) ped.direction = dir;
            }
          } else {
            alive = false;
          }
        } else {
          alive = false;
        }
        break;
      }

      if (ped.pathIndex + 1 < ped.path.length) {
        const nextTile = ped.path[ped.pathIndex + 1];
        const dir = getDirectionToTile(ped.tileX, ped.tileY, nextTile.x, nextTile.y);
        if (dir) ped.direction = dir;
      }
    }

    if (alive && ped.progress >= 1 && ped.pathIndex >= ped.path.length - 1) {
      if (!ped.returningHome) {
        ped.returningHome = true;
        const returnPath = findPathOnRoads(currentGrid, currentGridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
        if (returnPath && returnPath.length > 0) {
          ped.path = returnPath;
          ped.pathIndex = 0;
          ped.progress = 0;
          ped.tileX = returnPath[0].x;
          ped.tileY = returnPath[0].y;
          if (returnPath.length > 1) {
            const nextTile = returnPath[1];
            const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
            if (dir) ped.direction = dir;
          }
        } else {
          alive = false;
        }
      } else {
        alive = false;
      }
    }

    if (alive) {
      updatedPedestrians.push(ped);
    }
  }

  refs.pedestriansRef.current = updatedPedestrians;
}
