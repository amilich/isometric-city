import { MutableRefObject } from 'react';
import {
  Airplane,
  Helicopter,
  Boat,
  WorldRenderState,
  TourWaypoint,
} from '@/components/game/types';
import {
  AIRPLANE_MIN_POPULATION,
  AIRPLANE_COLORS,
  CONTRAIL_MAX_AGE,
  CONTRAIL_SPAWN_INTERVAL,
  HELICOPTER_MIN_POPULATION,
  HELICOPTER_COLORS,
  ROTOR_WASH_MAX_AGE,
  ROTOR_WASH_SPAWN_INTERVAL,
  BOAT_COLORS,
  BOAT_MIN_ZOOM,
  WAKE_MAX_AGE,
  WAKE_SPAWN_INTERVAL,
  TILE_WIDTH,
  TILE_HEIGHT,
} from '@/components/game/constants';
import {
  findAirports,
  findHeliports,
  findMarinasAndPiers,
  findAdjacentWaterTile,
  isOverWater,
  generateTourWaypoints,
} from '@/components/game/gridFinders';
import { gridToScreen } from '@/components/game/utils';

export interface AircraftUpdateRefs {
  worldStateRef: MutableRefObject<WorldRenderState>;
  airplanesRef: MutableRefObject<Airplane[]>;
  airplaneIdRef: MutableRefObject<number>;
  airplaneSpawnTimerRef: MutableRefObject<number>;
  helicoptersRef: MutableRefObject<Helicopter[]>;
  helicopterIdRef: MutableRefObject<number>;
  helicopterSpawnTimerRef: MutableRefObject<number>;
  boatsRef: MutableRefObject<Boat[]>;
  boatIdRef: MutableRefObject<number>;
  boatSpawnTimerRef: MutableRefObject<number>;
  cachedPopulationRef: MutableRefObject<{ count: number; gridVersion: number }>;
  gridVersionRef: MutableRefObject<number>;
}

export function updateAirplanes(refs: AircraftUpdateRefs, delta: number, isMobile: boolean): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = refs.worldStateRef.current;

  if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
    return;
  }

  const airports = findAirports(currentGrid, currentGridSize);

  const currentGridVersion = refs.gridVersionRef.current;
  let totalPopulation: number;
  if (refs.cachedPopulationRef.current.gridVersion === currentGridVersion) {
    totalPopulation = refs.cachedPopulationRef.current.count;
  } else {
    totalPopulation = 0;
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        totalPopulation += currentGrid[y][x].building.population || 0;
      }
    }
    refs.cachedPopulationRef.current = { count: totalPopulation, gridVersion: currentGridVersion };
  }

  if (airports.length === 0 || totalPopulation < AIRPLANE_MIN_POPULATION) {
    refs.airplanesRef.current = [];
    return;
  }

  const maxAirplanes = Math.min(54, Math.max(18, Math.floor(totalPopulation / 3500) * 3));
  const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

  refs.airplaneSpawnTimerRef.current -= delta;
  if (refs.airplanesRef.current.length < maxAirplanes && refs.airplaneSpawnTimerRef.current <= 0) {
    const airport = airports[Math.floor(Math.random() * airports.length)];

    const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(airport.x, airport.y, 0, 0);
    const airportCenterX = airportScreenX + TILE_WIDTH * 2;
    const airportCenterY = airportScreenY + TILE_HEIGHT * 2;

    const isTakingOff = Math.random() < 0.5;

    if (isTakingOff) {
      const angle = Math.random() * Math.PI * 2;
      refs.airplanesRef.current.push({
        id: refs.airplaneIdRef.current++,
        x: airportCenterX,
        y: airportCenterY,
        angle: angle,
        state: 'taking_off',
        speed: 30 + Math.random() * 20,
        altitude: 0,
        targetAltitude: 1,
        airportX: airport.x,
        airportY: airport.y,
        stateProgress: 0,
        contrail: [],
        lifeTime: 30 + Math.random() * 20,
        color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
      });
    } else {
      const edge = Math.floor(Math.random() * 4);
      let startX: number, startY: number, angle: number;

      const mapCenterX = 0;
      const mapCenterY = currentGridSize * TILE_HEIGHT / 2;
      const mapExtent = currentGridSize * TILE_WIDTH;

      switch (edge) {
        case 0:
          startX = mapCenterX + (Math.random() - 0.5) * mapExtent;
          startY = mapCenterY - mapExtent / 2 - 200;
          angle = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
          break;
        case 1:
          startX = mapCenterX + mapExtent / 2 + 200;
          startY = mapCenterY + (Math.random() - 0.5) * mapExtent / 2;
          angle = Math.PI + (Math.random() - 0.5) * 0.5;
          break;
        case 2:
          startX = mapCenterX + (Math.random() - 0.5) * mapExtent;
          startY = mapCenterY + mapExtent / 2 + 200;
          angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
          break;
        default:
          startX = mapCenterX - mapExtent / 2 - 200;
          startY = mapCenterY + (Math.random() - 0.5) * mapExtent / 2;
          angle = 0 + (Math.random() - 0.5) * 0.5;
          break;
      }

      const angleToAirport = Math.atan2(airportCenterY - startY, airportCenterX - startX);

      refs.airplanesRef.current.push({
        id: refs.airplaneIdRef.current++,
        x: startX,
        y: startY,
        angle: angleToAirport,
        state: 'flying',
        speed: 80 + Math.random() * 40,
        altitude: 1,
        targetAltitude: 1,
        airportX: airport.x,
        airportY: airport.y,
        stateProgress: 0,
        contrail: [],
        lifeTime: 30 + Math.random() * 20,
        color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
      });
    }

    refs.airplaneSpawnTimerRef.current = 5 + Math.random() * 10;
  }

  const updatedAirplanes: Airplane[] = [];

  for (const plane of refs.airplanesRef.current) {
    const contrailMaxAge = isMobile ? 0.8 : CONTRAIL_MAX_AGE;
    const contrailSpawnInterval = isMobile ? 0.06 : CONTRAIL_SPAWN_INTERVAL;
    plane.contrail = plane.contrail
      .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / contrailMaxAge) }))
      .filter(p => p.age < contrailMaxAge);

    if (plane.altitude > 0.7) {
      plane.stateProgress += delta;
      if (plane.stateProgress >= contrailSpawnInterval) {
        plane.stateProgress -= contrailSpawnInterval;
        const perpAngle = plane.angle + Math.PI / 2;
        const engineOffset = 4 * (0.5 + plane.altitude * 0.5);
        if (isMobile) {
          plane.contrail.push({ x: plane.x, y: plane.y, age: 0, opacity: 1 });
        } else {
          plane.contrail.push(
            { x: plane.x + Math.cos(perpAngle) * engineOffset, y: plane.y + Math.sin(perpAngle) * engineOffset, age: 0, opacity: 1 },
            { x: plane.x - Math.cos(perpAngle) * engineOffset, y: plane.y - Math.sin(perpAngle) * engineOffset, age: 0, opacity: 1 }
          );
        }
      }
    }

    switch (plane.state) {
      case 'taking_off': {
        plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
        plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
        plane.altitude = Math.min(1, plane.altitude + delta * 0.3);
        plane.speed = Math.min(120, plane.speed + delta * 20);

        if (plane.altitude >= 1) {
          plane.state = 'flying';
        }
        break;
      }

      case 'flying': {
        plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
        plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

        plane.lifeTime -= delta;

        const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(plane.airportX, plane.airportY, 0, 0);
        const airportCenterX = airportScreenX + TILE_WIDTH * 2;
        const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
        const distToAirport = Math.hypot(plane.x - airportCenterX, plane.y - airportCenterY);

        if (distToAirport < 400 && plane.lifeTime < 10) {
          plane.state = 'landing';
          plane.targetAltitude = 0;
          plane.angle = Math.atan2(airportCenterY - plane.y, airportCenterX - plane.x);
        } else if (plane.lifeTime <= 0) {
          continue;
        }
        break;
      }

      case 'landing': {
        const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(plane.airportX, plane.airportY, 0, 0);
        const airportCenterX = airportScreenX + TILE_WIDTH * 2;
        const airportCenterY = airportScreenY + TILE_HEIGHT * 2;

        const angleToAirport = Math.atan2(airportCenterY - plane.y, airportCenterX - plane.x);
        plane.angle = angleToAirport;

        plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
        plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
        plane.altitude = Math.max(0, plane.altitude - delta * 0.25);
        plane.speed = Math.max(30, plane.speed - delta * 15);

        const distToAirport = Math.hypot(plane.x - airportCenterX, plane.y - airportCenterY);
        if (distToAirport < 50 || plane.altitude <= 0) {
          continue;
        }
        break;
      }

      case 'taxiing':
        continue;
    }

    updatedAirplanes.push(plane);
  }

  refs.airplanesRef.current = updatedAirplanes;
}

export function updateHelicopters(refs: AircraftUpdateRefs, delta: number, isMobile: boolean): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = refs.worldStateRef.current;

  if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
    return;
  }

  const heliports = findHeliports(currentGrid, currentGridSize);

  const currentGridVersion = refs.gridVersionRef.current;
  let totalPopulation: number;
  if (refs.cachedPopulationRef.current.gridVersion === currentGridVersion) {
    totalPopulation = refs.cachedPopulationRef.current.count;
  } else {
    totalPopulation = 0;
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        totalPopulation += currentGrid[y][x].building.population || 0;
      }
    }
    refs.cachedPopulationRef.current = { count: totalPopulation, gridVersion: currentGridVersion };
  }

  if (heliports.length < 2 || totalPopulation < HELICOPTER_MIN_POPULATION) {
    refs.helicoptersRef.current = [];
    return;
  }

  const populationBased = Math.floor(totalPopulation / 1000);
  const heliportBased = Math.floor(heliports.length * 2.5);
  const maxHelicopters = Math.min(60, Math.max(6, Math.min(populationBased, heliportBased)));

  const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

  refs.helicopterSpawnTimerRef.current -= delta;
  if (refs.helicoptersRef.current.length < maxHelicopters && refs.helicopterSpawnTimerRef.current <= 0) {
    const originIndex = Math.floor(Math.random() * heliports.length);
    const origin = heliports[originIndex];

    const otherHeliports = heliports.filter((_, i) => i !== originIndex);
    if (otherHeliports.length > 0) {
      const dest = otherHeliports[Math.floor(Math.random() * otherHeliports.length)];

      const { screenX: originScreenX, screenY: originScreenY } = gridToScreen(origin.x, origin.y, 0, 0);
      const originCenterX = originScreenX + TILE_WIDTH * origin.size / 2;
      const originCenterY = originScreenY + TILE_HEIGHT * origin.size / 2;

      const { screenX: destScreenX, screenY: destScreenY } = gridToScreen(dest.x, dest.y, 0, 0);
      const destCenterX = destScreenX + TILE_WIDTH * dest.size / 2;
      const destCenterY = destScreenY + TILE_HEIGHT * dest.size / 2;

      const angleToDestination = Math.atan2(destCenterY - originCenterY, destCenterX - originCenterX);

      refs.helicoptersRef.current.push({
        id: refs.helicopterIdRef.current++,
        x: originCenterX,
        y: originCenterY,
        angle: angleToDestination,
        state: 'taking_off',
        speed: 15 + Math.random() * 10,
        altitude: 0,
        targetAltitude: 0.5,
        originX: origin.x,
        originY: origin.y,
        originType: origin.type,
        destX: dest.x,
        destY: dest.y,
        destType: dest.type,
        destScreenX: destCenterX,
        destScreenY: destCenterY,
        stateProgress: 0,
        rotorWash: [],
        rotorAngle: 0,
        color: HELICOPTER_COLORS[Math.floor(Math.random() * HELICOPTER_COLORS.length)],
      });
    }

    refs.helicopterSpawnTimerRef.current = 0.8 + Math.random() * 2.2;
  }

  const updatedHelicopters: Helicopter[] = [];

  for (const heli of refs.helicoptersRef.current) {
    heli.rotorAngle += delta * 25;

    const washMaxAge = isMobile ? 0.4 : ROTOR_WASH_MAX_AGE;
    const washSpawnInterval = isMobile ? 0.08 : ROTOR_WASH_SPAWN_INTERVAL;
    heli.rotorWash = heli.rotorWash
      .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / washMaxAge) }))
      .filter(p => p.age < washMaxAge);

    if (heli.altitude > 0.2 && heli.state === 'flying') {
      heli.stateProgress += delta;
      if (heli.stateProgress >= washSpawnInterval) {
        heli.stateProgress -= washSpawnInterval;
        const behindAngle = heli.angle + Math.PI;
        const offsetDist = 6;
        heli.rotorWash.push({
          x: heli.x + Math.cos(behindAngle) * offsetDist,
          y: heli.y + Math.sin(behindAngle) * offsetDist,
          age: 0,
          opacity: 1
        });
      }
    }

    switch (heli.state) {
      case 'taking_off': {
        heli.altitude = Math.min(0.5, heli.altitude + delta * 0.4);
        heli.speed = Math.min(50, heli.speed + delta * 15);

        if (heli.altitude >= 0.3) {
          heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier * 0.5;
          heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier * 0.5;
        }

        if (heli.altitude >= 0.5) {
          heli.state = 'flying';
        }
        break;
      }

      case 'flying': {
        heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier;
        heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier;

        const distToDest = Math.hypot(heli.x - heli.destScreenX, heli.y - heli.destScreenY);

        if (distToDest < 80) {
          heli.state = 'landing';
          heli.targetAltitude = 0;
        }
        break;
      }

      case 'landing': {
        const distToDest = Math.hypot(heli.x - heli.destScreenX, heli.y - heli.destScreenY);

        heli.speed = Math.max(10, heli.speed - delta * 20);

        if (distToDest > 15) {
          const angleToDestination = Math.atan2(heli.destScreenY - heli.y, heli.destScreenX - heli.x);
          heli.angle = angleToDestination;
          heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier;
          heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier;
        }

        heli.altitude = Math.max(0, heli.altitude - delta * 0.3);

        if (heli.altitude <= 0 && distToDest < 20) {
          continue;
        }
        break;
      }

      case 'hovering':
        break;
    }

    updatedHelicopters.push(heli);
  }

  refs.helicoptersRef.current = updatedHelicopters;
}

export function updateBoats(refs: AircraftUpdateRefs, delta: number, isMobile: boolean): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = refs.worldStateRef.current;

  if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
    return;
  }

  if (currentZoom < BOAT_MIN_ZOOM) {
    refs.boatsRef.current = [];
    return;
  }

  const docks = findMarinasAndPiers(currentGrid, currentGridSize);

  if (docks.length === 0) {
    refs.boatsRef.current = [];
    return;
  }

  const maxBoats = Math.min(25, docks.length * 3);
  const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

  refs.boatSpawnTimerRef.current -= delta;
  if (refs.boatsRef.current.length < maxBoats && refs.boatSpawnTimerRef.current <= 0) {
    const homeDock = docks[Math.floor(Math.random() * docks.length)];

    const waterTile = findAdjacentWaterTile(currentGrid, currentGridSize, homeDock.x, homeDock.y);
    if (waterTile) {
      const tourWaypoints = generateTourWaypoints(currentGrid, currentGridSize, waterTile.x, waterTile.y);

      const { screenX: originScreenX, screenY: originScreenY } = gridToScreen(waterTile.x, waterTile.y, 0, 0);
      const homeScreenX = originScreenX + TILE_WIDTH / 2;
      const homeScreenY = originScreenY + TILE_HEIGHT / 2;

      let firstDestScreenX = homeScreenX;
      let firstDestScreenY = homeScreenY;
      if (tourWaypoints.length > 0) {
        firstDestScreenX = tourWaypoints[0].screenX;
        firstDestScreenY = tourWaypoints[0].screenY;
      }

      const angle = Math.atan2(firstDestScreenY - originScreenY, firstDestScreenX - originScreenX);

      refs.boatsRef.current.push({
        id: refs.boatIdRef.current++,
        x: homeScreenX,
        y: homeScreenY,
        angle: angle,
        targetAngle: angle,
        state: 'departing',
        speed: 15 + Math.random() * 10,
        originX: homeDock.x,
        originY: homeDock.y,
        destX: homeDock.x,
        destY: homeDock.y,
        destScreenX: firstDestScreenX,
        destScreenY: firstDestScreenY,
        age: 0,
        color: BOAT_COLORS[Math.floor(Math.random() * BOAT_COLORS.length)],
        wake: [],
        wakeSpawnProgress: 0,
        sizeVariant: Math.random() < 0.7 ? 0 : 1,
        tourWaypoints: tourWaypoints,
        tourWaypointIndex: 0,
        homeScreenX: homeScreenX,
        homeScreenY: homeScreenY,
      });
    }

    refs.boatSpawnTimerRef.current = 1 + Math.random() * 2;
  }

  const updatedBoats: Boat[] = [];

  for (const boat of refs.boatsRef.current) {
    boat.age += delta;

    const wakeMaxAge = isMobile ? 0.6 : WAKE_MAX_AGE;
    boat.wake = boat.wake
      .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / wakeMaxAge) }))
      .filter(p => p.age < wakeMaxAge);

    const distToDest = Math.hypot(boat.x - boat.destScreenX, boat.y - boat.destScreenY);

    let nextX = boat.x;
    let nextY = boat.y;

    switch (boat.state) {
      case 'departing': {
        nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
        nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;

        if (boat.age > 2) {
          if (boat.tourWaypoints.length > 0) {
            boat.state = 'touring';
            boat.tourWaypointIndex = 0;
            boat.destScreenX = boat.tourWaypoints[0].screenX;
            boat.destScreenY = boat.tourWaypoints[0].screenY;
          } else {
            boat.state = 'sailing';
            boat.destScreenX = boat.homeScreenX;
            boat.destScreenY = boat.homeScreenY;
          }
        }
        break;
      }

      case 'touring': {
        const angleToWaypoint = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
        boat.targetAngle = angleToWaypoint;

        let angleDiff = boat.targetAngle - boat.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        boat.angle += angleDiff * Math.min(1, delta * 1.8);

        nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
        nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;

        if (distToDest < 40) {
          boat.tourWaypointIndex++;

          if (boat.tourWaypointIndex < boat.tourWaypoints.length) {
            const nextWaypoint = boat.tourWaypoints[boat.tourWaypointIndex];
            boat.destScreenX = nextWaypoint.screenX;
            boat.destScreenY = nextWaypoint.screenY;
          } else {
            boat.state = 'sailing';
            boat.destScreenX = boat.homeScreenX;
            boat.destScreenY = boat.homeScreenY;
            boat.age = 0;
          }
        }

        if (boat.age > 120) {
          continue;
        }
        break;
      }

      case 'sailing': {
        const angleToDestination = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
        boat.targetAngle = angleToDestination;

        let angleDiff = boat.targetAngle - boat.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        boat.angle += angleDiff * Math.min(1, delta * 2);

        nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
        nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;

        if (distToDest < 60) {
          boat.state = 'arriving';
        }

        if (boat.age > 60) {
          continue;
        }
        break;
      }

      case 'arriving': {
        boat.speed = Math.max(5, boat.speed - delta * 8);

        const angleToDestination = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
        boat.targetAngle = angleToDestination;

        let angleDiff = boat.targetAngle - boat.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        boat.angle += angleDiff * Math.min(1, delta * 3);

        nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
        nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;

        if (distToDest < 15) {
          boat.state = 'docked';
          boat.age = 0;
          boat.wake = [];
        }
        break;
      }

      case 'docked': {
        if (boat.age > 3 + Math.random() * 3) {
          const waterTile = findAdjacentWaterTile(currentGrid, currentGridSize, boat.originX, boat.originY);
          if (waterTile) {
            boat.tourWaypoints = generateTourWaypoints(currentGrid, currentGridSize, waterTile.x, waterTile.y);
            boat.tourWaypointIndex = 0;
          }

          boat.state = 'departing';
          boat.speed = 15 + Math.random() * 10;
          boat.age = 0;

          if (boat.tourWaypoints.length > 0) {
            boat.destScreenX = boat.tourWaypoints[0].screenX;
            boat.destScreenY = boat.tourWaypoints[0].screenY;
          } else {
            boat.destScreenX = boat.homeScreenX + (Math.random() - 0.5) * 200;
            boat.destScreenY = boat.homeScreenY + (Math.random() - 0.5) * 200;
          }

          const angle = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
          boat.angle = angle;
          boat.targetAngle = angle;
        }
        break;
      }
    }

    if (boat.state !== 'docked') {
      if (!isOverWater(currentGrid, currentGridSize, nextX, nextY)) {
        continue;
      }

      boat.x = nextX;
      boat.y = nextY;

      const wakeSpawnInterval = isMobile ? 0.08 : WAKE_SPAWN_INTERVAL;
      boat.wakeSpawnProgress += delta;
      if (boat.wakeSpawnProgress >= wakeSpawnInterval) {
        boat.wakeSpawnProgress -= wakeSpawnInterval;

        const behindBoat = -6;
        boat.wake.push({
          x: boat.x + Math.cos(boat.angle) * behindBoat,
          y: boat.y + Math.sin(boat.angle) * behindBoat,
          age: 0,
          opacity: 1
        });
      }
    }

    updatedBoats.push(boat);
  }

  refs.boatsRef.current = updatedBoats;
}
