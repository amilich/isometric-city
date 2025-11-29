import React, { useCallback, useRef } from 'react';
import { Car, CarDirection, EmergencyVehicle, EmergencyVehicleType, Pedestrian, PedestrianDestType, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import { CAR_COLORS, PEDESTRIAN_SKIN_COLORS, PEDESTRIAN_SHIRT_COLORS, PEDESTRIAN_MIN_ZOOM, DIRECTION_META } from './constants';
import { isRoadTile, getDirectionOptions, pickNextDirection, findPathOnRoads, getDirectionToTile, gridToScreen } from './utils';
import { findResidentialBuildings, findPedestrianDestinations, findStations, findFires } from './gridFinders';
import { drawPedestrians as drawPedestriansUtil } from './drawPedestrians';
import { BuildingType, Tile } from '@/types/game';
import { getTrafficLightState, canProceedThroughIntersection, TRAFFIC_LIGHT_TIMING } from './trafficSystem';
import { CrimeType, getRandomCrimeType, getCrimeDuration } from './incidentData';

export interface VehicleSystemRefs {
  carsRef: React.MutableRefObject<Car[]>;
  carIdRef: React.MutableRefObject<number>;
  carSpawnTimerRef: React.MutableRefObject<number>;
  emergencyVehiclesRef: React.MutableRefObject<EmergencyVehicle[]>;
  emergencyVehicleIdRef: React.MutableRefObject<number>;
  emergencyDispatchTimerRef: React.MutableRefObject<number>;
  activeFiresRef: React.MutableRefObject<Set<string>>;
  activeCrimesRef: React.MutableRefObject<Set<string>>;
  activeCrimeIncidentsRef: React.MutableRefObject<Map<string, { x: number; y: number; type: CrimeType; timeRemaining: number }>>;
  crimeSpawnTimerRef: React.MutableRefObject<number>;
  pedestriansRef: React.MutableRefObject<Pedestrian[]>;
  pedestrianIdRef: React.MutableRefObject<number>;
  pedestrianSpawnTimerRef: React.MutableRefObject<number>;
  trafficLightTimerRef: React.MutableRefObject<number>;
}

export interface VehicleSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  gridVersionRef: React.MutableRefObject<number>;
  cachedRoadTileCountRef: React.MutableRefObject<{ count: number; gridVersion: number }>;
  state: {
    services: {
      police: number[][];
    };
    stats: {
      population: number;
    };
  };
  isMobile: boolean;
}

export function useVehicleSystems(
  refs: VehicleSystemRefs,
  systemState: VehicleSystemState
) {
  const {
    carsRef,
    carIdRef,
    carSpawnTimerRef,
    emergencyVehiclesRef,
    emergencyVehicleIdRef,
    emergencyDispatchTimerRef,
    activeFiresRef,
    activeCrimesRef,
    activeCrimeIncidentsRef,
    crimeSpawnTimerRef,
    pedestriansRef,
    pedestrianIdRef,
    pedestrianSpawnTimerRef,
    trafficLightTimerRef,
  } = refs;

  const { worldStateRef, gridVersionRef, cachedRoadTileCountRef, state, isMobile } = systemState;

  const spawnRandomCar = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;
    
    for (let attempt = 0; attempt < 20; attempt++) {
      const tileX = Math.floor(Math.random() * currentGridSize);
      const tileY = Math.floor(Math.random() * currentGridSize);
      if (!isRoadTile(currentGrid, currentGridSize, tileX, tileY)) continue;
      
      const options = getDirectionOptions(currentGrid, currentGridSize, tileX, tileY);
      if (options.length === 0) continue;
      
      const direction = options[Math.floor(Math.random() * options.length)];
      // Lane offset based on direction for proper right-hand traffic
      // Positive offset = right side of road in direction of travel
      const baseLaneOffset = 4 + Math.random() * 2;
      // North and East get positive offset, South and West get negative
      const laneSign = (direction === 'north' || direction === 'east') ? 1 : -1;
      // Cars have a limited lifespan - shorter on mobile to reduce crowding
      const carMaxAge = isMobile 
        ? 25 + Math.random() * 15   // 25-40 seconds on mobile
        : 45 + Math.random() * 30; // 45-75 seconds on desktop
      
      carsRef.current.push({
        id: carIdRef.current++,
        tileX,
        tileY,
        direction,
        progress: Math.random() * 0.8,
        speed: (0.35 + Math.random() * 0.35) * 0.7,
        age: 0,
        maxAge: carMaxAge,
        color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
        laneOffset: laneSign * baseLaneOffset,
      });
      return true;
    }
    
    return false;
  }, [worldStateRef, carsRef, carIdRef, isMobile]);

  const findResidentialBuildingsCallback = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findResidentialBuildings(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const findPedestrianDestinationsCallback = useCallback((): { x: number; y: number; type: PedestrianDestType }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findPedestrianDestinations(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const spawnPedestrian = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;
    
    const residentials = findResidentialBuildingsCallback();
    if (residentials.length === 0) {
      return false;
    }
    
    const destinations = findPedestrianDestinationsCallback();
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
    
    pedestriansRef.current.push({
      id: pedestrianIdRef.current++,
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
  }, [worldStateRef, findResidentialBuildingsCallback, findPedestrianDestinationsCallback, pedestriansRef, pedestrianIdRef]);

  const findStationsCallback = useCallback((type: 'fire_station' | 'police_station'): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findStations(currentGrid, currentGridSize, type);
  }, [worldStateRef]);

  const findFiresCallback = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findFires(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const spawnCrimeIncidents = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;
    
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
    crimeSpawnTimerRef.current -= delta * speedMultiplier;
    
    if (crimeSpawnTimerRef.current > 0) return;
    crimeSpawnTimerRef.current = 3 + Math.random() * 2;
    
    const eligibleTiles: { x: number; y: number; policeCoverage: number }[] = [];
    
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const tile = currentGrid[y][x];
        const isBuilding = tile.building.type !== 'grass' && 
            tile.building.type !== 'water' && 
            tile.building.type !== 'road' && 
            tile.building.type !== 'tree' &&
            tile.building.type !== 'empty';
        const hasActivity = tile.building.population > 0 || tile.building.jobs > 0;
        
        if (isBuilding && hasActivity) {
          const policeCoverage = state.services.police[y]?.[x] || 0;
          eligibleTiles.push({ x, y, policeCoverage });
        }
      }
    }
    
    if (eligibleTiles.length === 0) return;
    
    const avgCoverage = eligibleTiles.reduce((sum, t) => sum + t.policeCoverage, 0) / eligibleTiles.length;
    const baseChance = avgCoverage < 20 ? 0.4 : avgCoverage < 40 ? 0.25 : avgCoverage < 60 ? 0.15 : 0.08;
    
    const population = state.stats.population;
    const maxActiveCrimes = Math.max(2, Math.floor(population / 500));
    
    if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) return;
    
    const crimesToSpawn = Math.random() < 0.3 ? 2 : 1;
    
    for (let i = 0; i < crimesToSpawn; i++) {
      if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) break;
      if (Math.random() > baseChance) continue;
      
      const weightedTiles = eligibleTiles.filter(t => {
        const key = `${t.x},${t.y}`;
        if (activeCrimeIncidentsRef.current.has(key)) return false;
        const weight = Math.max(0.1, 1 - t.policeCoverage / 100);
        return Math.random() < weight;
      });
      
      if (weightedTiles.length === 0) continue;
      
      const target = weightedTiles[Math.floor(Math.random() * weightedTiles.length)];
      const key = `${target.x},${target.y}`;
      
      const crimeType = getRandomCrimeType();
      const duration = getCrimeDuration(crimeType);
      
      activeCrimeIncidentsRef.current.set(key, {
        x: target.x,
        y: target.y,
        type: crimeType,
        timeRemaining: duration,
      });
    }
  }, [worldStateRef, crimeSpawnTimerRef, activeCrimeIncidentsRef, state.services.police, state.stats.population]);

  const updateCrimeIncidents = useCallback((delta: number) => {
    const { speed: currentSpeed } = worldStateRef.current;
    if (currentSpeed === 0) return;
    
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
    const keysToDelete: string[] = [];
    
    activeCrimeIncidentsRef.current.forEach((crime, key) => {
      if (activeCrimesRef.current.has(key)) return;
      
      const newTimeRemaining = crime.timeRemaining - delta * speedMultiplier;
      if (newTimeRemaining <= 0) {
        keysToDelete.push(key);
      } else {
        activeCrimeIncidentsRef.current.set(key, { ...crime, timeRemaining: newTimeRemaining });
      }
    });
    
    keysToDelete.forEach(key => activeCrimeIncidentsRef.current.delete(key));
  }, [worldStateRef, activeCrimeIncidentsRef, activeCrimesRef]);

  const findCrimeIncidents = useCallback((): { x: number; y: number }[] => {
    return Array.from(activeCrimeIncidentsRef.current.values()).map(c => ({ x: c.x, y: c.y }));
  }, [activeCrimeIncidentsRef]);

  const dispatchEmergencyVehicle = useCallback((
    type: EmergencyVehicleType,
    stationX: number,
    stationY: number,
    targetX: number,
    targetY: number
  ): boolean => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
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

    emergencyVehiclesRef.current.push({
      id: emergencyVehicleIdRef.current++,
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
  }, [worldStateRef, emergencyVehiclesRef, emergencyVehicleIdRef]);

  const updateEmergencyDispatch = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;
    
    const fires = findFiresCallback();
    const fireStations = findStationsCallback('fire_station');
    
    for (const fire of fires) {
      const fireKey = `${fire.x},${fire.y}`;
      if (activeFiresRef.current.has(fireKey)) continue;
      
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
        if (dispatchEmergencyVehicle('fire_truck', nearestStation.x, nearestStation.y, fire.x, fire.y)) {
          activeFiresRef.current.add(fireKey);
        }
      }
    }

    const crimes = findCrimeIncidents();
    const policeStations = findStationsCallback('police_station');
    
    let dispatched = 0;
    const maxDispatchPerCheck = Math.max(3, Math.min(6, policeStations.length * 2));
    for (const crime of crimes) {
      if (dispatched >= maxDispatchPerCheck) break;
      
      const crimeKey = `${crime.x},${crime.y}`;
      if (activeCrimesRef.current.has(crimeKey)) continue;
      
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
        if (dispatchEmergencyVehicle('police_car', nearestStation.x, nearestStation.y, crime.x, crime.y)) {
          activeCrimesRef.current.add(crimeKey);
          dispatched++;
        }
      }
    }
  }, [worldStateRef, findFiresCallback, findCrimeIncidents, findStationsCallback, dispatchEmergencyVehicle, activeFiresRef, activeCrimesRef]);

  const updateEmergencyVehicles = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) {
      emergencyVehiclesRef.current = [];
      return;
    }

    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
    
    emergencyDispatchTimerRef.current -= delta;
    if (emergencyDispatchTimerRef.current <= 0) {
      updateEmergencyDispatch();
      emergencyDispatchTimerRef.current = 1.5;
    }

    const updatedVehicles: EmergencyVehicle[] = [];
    
    for (const vehicle of [...emergencyVehiclesRef.current]) {
      vehicle.flashTimer += delta * 8;
      
      if (vehicle.state === 'responding') {
        if (!isRoadTile(currentGrid, currentGridSize, vehicle.tileX, vehicle.tileY)) {
          const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
          if (vehicle.type === 'fire_truck') {
            activeFiresRef.current.delete(targetKey);
          } else {
            activeCrimesRef.current.delete(targetKey);
            activeCrimeIncidentsRef.current.delete(targetKey);
          }
          continue;
        }
        
        vehicle.respondTime += delta * speedMultiplier;
        const respondDuration = vehicle.type === 'fire_truck' ? 8 : 5;
        
        if (vehicle.respondTime >= respondDuration) {
          const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
          
          if (vehicle.type === 'police_car') {
            activeCrimeIncidentsRef.current.delete(targetKey);
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
            const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
            if (vehicle.type === 'fire_truck') {
              activeFiresRef.current.delete(targetKey);
            } else {
              activeCrimesRef.current.delete(targetKey);
            }
            continue;
          } else {
            const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
            if (vehicle.type === 'fire_truck') {
              activeFiresRef.current.delete(targetKey);
            } else {
              activeCrimesRef.current.delete(targetKey);
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
          activeFiresRef.current.delete(targetKey);
        } else {
          activeCrimesRef.current.delete(targetKey);
          activeCrimeIncidentsRef.current.delete(targetKey);
        }
        continue;
      }
      
      if (vehicle.tileX < 0 || vehicle.tileX >= currentGridSize || 
          vehicle.tileY < 0 || vehicle.tileY >= currentGridSize) {
        const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
        if (vehicle.type === 'fire_truck') {
          activeFiresRef.current.delete(targetKey);
        } else {
          activeCrimesRef.current.delete(targetKey);
          activeCrimeIncidentsRef.current.delete(targetKey);
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
          activeFiresRef.current.delete(targetKey);
        } else {
          activeCrimesRef.current.delete(targetKey);
          activeCrimeIncidentsRef.current.delete(targetKey);
        }
        continue;
      }
      
      updatedVehicles.push(vehicle);
    }
    
    emergencyVehiclesRef.current = updatedVehicles;
  }, [worldStateRef, emergencyVehiclesRef, emergencyDispatchTimerRef, updateEmergencyDispatch, activeFiresRef, activeCrimesRef, activeCrimeIncidentsRef]);

  // Helper to check if a tile is an intersection (3+ connections)
  const isIntersection = useCallback((grid: Tile[][], gridSize: number, x: number, y: number): boolean => {
    if (!isRoadTile(grid, gridSize, x, y)) return false;
    const options = getDirectionOptions(grid, gridSize, x, y);
    return options.length >= 3;
  }, []);

  const updateCars = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    // Don't clear cars if grid is temporarily unavailable - just skip update
    if (!currentGrid || currentGridSize <= 0) {
      return;
    }
    
    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
    
    const baseMaxCars = 100;
    const maxCars = Math.min(baseMaxCars, Math.max(15, Math.floor(currentGridSize * 1.25)));
    carSpawnTimerRef.current -= delta;
    if (carsRef.current.length < maxCars && carSpawnTimerRef.current <= 0) {
      // Spawn cars at a moderate rate
      const carsToSpawn = Math.min(2, maxCars - carsRef.current.length);
      let spawnedCount = 0;
      for (let i = 0; i < carsToSpawn; i++) {
        if (spawnRandomCar()) {
          spawnedCount++;
        }
      }
      carSpawnTimerRef.current = spawnedCount > 0 ? 0.3 + Math.random() * 0.4 : 0.1;
    }
    
    // Get current traffic light state
    const trafficTime = trafficLightTimerRef.current;
    const lightState = getTrafficLightState(trafficTime);
    
    // Build spatial index of cars by tile for efficient collision detection
    const carsByTile = new Map<string, Car[]>();
    for (const car of carsRef.current) {
      const key = `${car.tileX},${car.tileY}`;
      if (!carsByTile.has(key)) carsByTile.set(key, []);
      carsByTile.get(key)!.push(car);
    }
    
    const updatedCars: Car[] = [];
    for (const car of [...carsRef.current]) {
      // Update car age and remove if too old
      car.age += delta * speedMultiplier;
      if (car.age > car.maxAge) {
        continue; // Car has exceeded its lifespan
      }
      
      // Skip update if car is somehow off the road, but keep it alive
      const onRoad = isRoadTile(currentGrid, currentGridSize, car.tileX, car.tileY);
      if (!onRoad) {
        // Car is off-road - try to find ANY nearby road and teleport there
        let relocated = false;
        for (let r = 1; r <= 5 && !relocated; r++) {
          for (let dy = -r; dy <= r && !relocated; dy++) {
            for (let dx = -r; dx <= r && !relocated; dx++) {
              if (Math.abs(dx) === r || Math.abs(dy) === r) {
                const nx = car.tileX + dx;
                const ny = car.tileY + dy;
                if (isRoadTile(currentGrid, currentGridSize, nx, ny)) {
                  car.tileX = nx;
                  car.tileY = ny;
                  car.progress = 0.5;
                  const opts = getDirectionOptions(currentGrid, currentGridSize, nx, ny);
                  if (opts.length > 0) {
                    car.direction = opts[Math.floor(Math.random() * opts.length)];
                  }
                  relocated = true;
                }
              }
            }
          }
        }
        // Even if we couldn't relocate, still keep the car
        updatedCars.push(car);
        continue;
      }
      
      // Check if approaching an intersection with red light
      // Only stop BEFORE entering the intersection, never while inside it
      let shouldStop = false;
      
      const meta = DIRECTION_META[car.direction];
      const nextX = car.tileX + meta.step.x;
      const nextY = car.tileY + meta.step.y;
      const currentIsIntersection = isIntersection(currentGrid, currentGridSize, car.tileX, car.tileY);
      const nextIsIntersection = isIntersection(currentGrid, currentGridSize, nextX, nextY);
      
      // If we're NOT in an intersection and the next tile IS an intersection
      if (!currentIsIntersection && nextIsIntersection) {
        // Check immediately and stop well before the intersection
        if (!canProceedThroughIntersection(car.direction, lightState)) {
          shouldStop = true;
        }
      }
      
      // Check for car ahead - efficient spatial lookup
      // Only check cars going the SAME direction (same lane)
      if (!shouldStop) {
        // Check same tile for car ahead in same lane
        const sameTileCars = carsByTile.get(`${car.tileX},${car.tileY}`) || [];
        for (const other of sameTileCars) {
          if (other.id === car.id) continue;
          // Same direction (same lane) and ahead of us
          if (other.direction === car.direction && other.progress > car.progress) {
            const gap = other.progress - car.progress;
            if (gap < 0.25) {
              shouldStop = true;
              break;
            }
          }
        }
        
        // Check next tile for car in same lane we might hit
        if (!shouldStop && car.progress > 0.7) {
          const nextTileCars = carsByTile.get(`${nextX},${nextY}`) || [];
          for (const other of nextTileCars) {
            // Only stop for cars going same direction (same lane)
            if (other.direction === car.direction && other.progress < 0.3) {
              shouldStop = true;
              break;
            }
          }
        }
      }
      
      if (!shouldStop) {
        car.progress += car.speed * delta * speedMultiplier;
      }
      // When stopped, just don't move - no position changes
      
      let guard = 0;
      while (car.progress >= 1 && guard < 4) {
        guard++;
        const meta = DIRECTION_META[car.direction];
        const newTileX = car.tileX + meta.step.x;
        const newTileY = car.tileY + meta.step.y;
        
        // Check if next tile is a valid road
        if (!isRoadTile(currentGrid, currentGridSize, newTileX, newTileY)) {
          // Can't move forward - turn around on current tile
          const options = getDirectionOptions(currentGrid, currentGridSize, car.tileX, car.tileY);
          if (options.length > 0) {
            // Pick any valid direction (preferring not the one we were going)
            const otherOptions = options.filter(d => d !== car.direction);
            const newDir = otherOptions.length > 0 
              ? otherOptions[Math.floor(Math.random() * otherOptions.length)]
              : options[Math.floor(Math.random() * options.length)];
            car.direction = newDir;
            car.progress = 0.1;
            const baseLaneOffset = 4 + Math.random() * 2;
            const laneSign = (newDir === 'north' || newDir === 'east') ? 1 : -1;
            car.laneOffset = laneSign * baseLaneOffset;
          } else {
            // No options at all - just stop and wait (maybe road will be rebuilt)
            car.progress = 0.5;
          }
          break;
        }
        
        // Move to the new tile
        car.tileX = newTileX;
        car.tileY = newTileY;
        car.progress -= 1;
        
        // Pick next direction
        const nextDirection = pickNextDirection(car.direction, currentGrid, currentGridSize, car.tileX, car.tileY);
        if (nextDirection) {
          if (nextDirection !== car.direction) {
            const baseLaneOffset = 4 + Math.random() * 2;
            const laneSign = (nextDirection === 'north' || nextDirection === 'east') ? 1 : -1;
            car.laneOffset = laneSign * baseLaneOffset;
          }
          car.direction = nextDirection;
        } else {
          // No preferred direction - just pick any valid one
          const options = getDirectionOptions(currentGrid, currentGridSize, car.tileX, car.tileY);
          if (options.length > 0) {
            const newDir = options[Math.floor(Math.random() * options.length)];
            car.direction = newDir;
            const baseLaneOffset = 4 + Math.random() * 2;
            const laneSign = (newDir === 'north' || newDir === 'east') ? 1 : -1;
            car.laneOffset = laneSign * baseLaneOffset;
          }
          // If no options, car will try again next frame (don't kill it)
        }
      }
      
      // Keep the car alive unless it exceeded maxAge (handled at top of loop)
      updatedCars.push(car);
    }
    
    carsRef.current = updatedCars;
  }, [worldStateRef, carsRef, carSpawnTimerRef, spawnRandomCar, trafficLightTimerRef, isIntersection]);

  const updatePedestrians = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    if (currentZoom < PEDESTRIAN_MIN_ZOOM) {
      pedestriansRef.current = [];
      return;
    }
    
    if (!currentGrid || currentGridSize <= 0) {
      pedestriansRef.current = [];
      return;
    }
    
    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
    
    const currentGridVersion = gridVersionRef.current;
    let roadTileCount: number;
    if (cachedRoadTileCountRef.current.gridVersion === currentGridVersion) {
      roadTileCount = cachedRoadTileCountRef.current.count;
    } else {
      roadTileCount = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          if (currentGrid[y][x].building.type === 'road') {
            roadTileCount++;
          }
        }
      }
      cachedRoadTileCountRef.current = { count: roadTileCount, gridVersion: currentGridVersion };
    }
    
    const maxPedestrians = Math.max(200, roadTileCount * 3);
    pedestrianSpawnTimerRef.current -= delta;
    if (pedestriansRef.current.length < maxPedestrians && pedestrianSpawnTimerRef.current <= 0) {
      let spawnedCount = 0;
      const spawnBatch = Math.min(50, Math.max(20, Math.floor(roadTileCount / 10)));
      for (let i = 0; i < spawnBatch; i++) {
        if (spawnPedestrian()) {
          spawnedCount++;
        }
      }
      pedestrianSpawnTimerRef.current = spawnedCount > 0 ? 0.02 : 0.01;
    }
    
    const updatedPedestrians: Pedestrian[] = [];
    
    for (const ped of [...pedestriansRef.current]) {
      let alive = true;
      
      ped.age += delta;
      if (ped.age > ped.maxAge) {
        continue;
      }
      
      ped.walkOffset += delta * 8;
      
      if (!isRoadTile(currentGrid, currentGridSize, ped.tileX, ped.tileY)) {
        continue;
      }
      
      // Most pedestrians respect traffic lights at intersections (based on their id)
      // Check if approaching an intersection and should wait
      let pedShouldWait = false;
      const pedRespectsLights = (ped.id % 5) !== 0; // 80% respect lights (4 out of 5)
      
      if (pedRespectsLights && ped.pathIndex + 1 < ped.path.length && ped.progress > 0.6) {
        const nextTile = ped.path[ped.pathIndex + 1];
        // Check if next tile is an intersection
        const nextNorth = isRoadTile(currentGrid, currentGridSize, nextTile.x - 1, nextTile.y);
        const nextEast = isRoadTile(currentGrid, currentGridSize, nextTile.x, nextTile.y - 1);
        const nextSouth = isRoadTile(currentGrid, currentGridSize, nextTile.x + 1, nextTile.y);
        const nextWest = isRoadTile(currentGrid, currentGridSize, nextTile.x, nextTile.y + 1);
        const isNextIntersection = [nextNorth, nextEast, nextSouth, nextWest].filter(Boolean).length >= 3;
        
        if (isNextIntersection) {
          // Get traffic light state
          const trafficTime = trafficLightTimerRef.current;
          const lightState = getTrafficLightState(trafficTime);
          
          // Pedestrians wait when they can't proceed (same logic as cars)
          if (!canProceedThroughIntersection(ped.direction, lightState)) {
            pedShouldWait = true;
          }
        }
      }
      
      if (!pedShouldWait) {
        ped.progress += ped.speed * delta * speedMultiplier;
      }
      
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
    
    pedestriansRef.current = updatedPedestrians;
  }, [worldStateRef, gridVersionRef, cachedRoadTileCountRef, pedestriansRef, pedestrianSpawnTimerRef, spawnPedestrian, trafficLightTimerRef]);

  const drawCars = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!currentGrid || currentGridSize <= 0 || carsRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    carsRef.current.forEach(car => {
      const { screenX, screenY } = gridToScreen(car.tileX, car.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[car.direction];
      const carX = centerX + meta.vec.dx * car.progress + meta.normal.nx * car.laneOffset;
      const carY = centerY + meta.vec.dy * car.progress + meta.normal.ny * car.laneOffset;
      
      ctx.save();
      ctx.translate(carX, carY);
      ctx.rotate(meta.angle);

      const scale = 0.5; // 30% smaller than original
      
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.moveTo(-10 * scale, -5 * scale);
      ctx.lineTo(10 * scale, -5 * scale);
      ctx.lineTo(12 * scale, 0);
      ctx.lineTo(10 * scale, 5 * scale);
      ctx.lineTo(-10 * scale, 5 * scale);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(-4 * scale, -2.8 * scale, 7 * scale, 5.6 * scale);
      
      ctx.fillStyle = '#111827';
      ctx.fillRect(-10 * scale, -4 * scale, 2.4 * scale, 8 * scale);
      
      ctx.restore();
    });
    
    ctx.restore();
  }, [worldStateRef, carsRef]);

  const drawPedestrians = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    if (currentZoom < PEDESTRIAN_MIN_ZOOM) {
      return;
    }
    
    if (!currentGrid || currentGridSize <= 0 || pedestriansRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewBounds = {
      viewLeft: -currentOffset.x / currentZoom - TILE_WIDTH,
      viewTop: -currentOffset.y / currentZoom - TILE_HEIGHT * 2,
      viewRight: viewWidth - currentOffset.x / currentZoom + TILE_WIDTH,
      viewBottom: viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2,
    };
    
    drawPedestriansUtil(ctx, pedestriansRef.current, currentGrid, currentGridSize, viewBounds);
    
    ctx.restore();
  }, [worldStateRef, pedestriansRef]);

  const drawEmergencyVehicles = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    if (!currentGrid || currentGridSize <= 0 || emergencyVehiclesRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH;
    const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 2;
    const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2;
    
    const isVehicleBehindBuilding = (tileX: number, tileY: number): boolean => {
      const vehicleDepth = tileX + tileY;
      
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const checkX = tileX + dx;
          const checkY = tileY + dy;
          
          if (checkX < 0 || checkY < 0 || checkX >= currentGridSize || checkY >= currentGridSize) {
            continue;
          }
          
          const tile = currentGrid[checkY]?.[checkX];
          if (!tile) continue;
          
          const buildingType = tile.building.type;
          const skipTypes: BuildingType[] = ['road', 'grass', 'empty', 'water', 'tree'];
          if (skipTypes.includes(buildingType)) {
            continue;
          }
          
          const buildingDepth = checkX + checkY;
          if (buildingDepth > vehicleDepth) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    emergencyVehiclesRef.current.forEach(vehicle => {
      const { screenX, screenY } = gridToScreen(vehicle.tileX, vehicle.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[vehicle.direction];
      const vehicleX = centerX + meta.vec.dx * vehicle.progress + meta.normal.nx * vehicle.laneOffset;
      const vehicleY = centerY + meta.vec.dy * vehicle.progress + meta.normal.ny * vehicle.laneOffset;
      
      if (vehicleX < viewLeft - 40 || vehicleX > viewRight + 40 || vehicleY < viewTop - 60 || vehicleY > viewBottom + 60) {
        return;
      }
      
      ctx.save();
      ctx.translate(vehicleX, vehicleY);
      ctx.rotate(meta.angle);
      
      const scale = 0.6;
      
      const bodyColor = vehicle.type === 'fire_truck' ? '#dc2626' : '#1e40af';
      
      const length = vehicle.type === 'fire_truck' ? 14 : 11;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(-length * scale, -5 * scale);
      ctx.lineTo(length * scale, -5 * scale);
      ctx.lineTo((length + 2) * scale, 0);
      ctx.lineTo(length * scale, 5 * scale);
      ctx.lineTo(-length * scale, 5 * scale);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = vehicle.type === 'fire_truck' ? '#fbbf24' : '#ffffff';
      ctx.fillRect(-length * scale * 0.5, -3 * scale, length * scale, 6 * scale * 0.3);
      
      ctx.fillStyle = 'rgba(200, 220, 255, 0.7)';
      ctx.fillRect(-2 * scale, -3 * scale, 5 * scale, 6 * scale);
      
      const flashOn = Math.sin(vehicle.flashTimer) > 0;
      const flashOn2 = Math.sin(vehicle.flashTimer + Math.PI) > 0;
      
      if (vehicle.type === 'fire_truck') {
        ctx.fillStyle = flashOn ? '#ff0000' : '#880000';
        ctx.fillRect(-6 * scale, -7 * scale, 3 * scale, 3 * scale);
        ctx.fillStyle = flashOn2 ? '#ff0000' : '#880000';
        ctx.fillRect(3 * scale, -7 * scale, 3 * scale, 3 * scale);
        
        if (flashOn || flashOn2) {
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 6;
          ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
          ctx.fillRect(-8 * scale, -8 * scale, 16 * scale, 4 * scale);
          ctx.shadowBlur = 0;
        }
      } else {
        ctx.fillStyle = flashOn ? '#ff0000' : '#880000';
        ctx.fillRect(-5 * scale, -7 * scale, 3 * scale, 3 * scale);
        ctx.fillStyle = flashOn2 ? '#0066ff' : '#003388';
        ctx.fillRect(2 * scale, -7 * scale, 3 * scale, 3 * scale);
        
        if (flashOn || flashOn2) {
          ctx.shadowColor = flashOn ? '#ff0000' : '#0066ff';
          ctx.shadowBlur = 6;
          ctx.fillStyle = flashOn ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 100, 255, 0.4)';
          ctx.fillRect(-7 * scale, -8 * scale, 14 * scale, 4 * scale);
          ctx.shadowBlur = 0;
        }
      }
      
      ctx.fillStyle = '#111827';
      ctx.fillRect(-length * scale, -4 * scale, 2 * scale, 8 * scale);
      
      ctx.restore();
    });
    
    ctx.restore();
  }, [worldStateRef, emergencyVehiclesRef]);

  const incidentAnimTimeRef = useRef(0);

  const drawIncidentIndicators = useCallback((ctx: CanvasRenderingContext2D, delta: number) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    if (!currentGrid || currentGridSize <= 0) return;
    
    incidentAnimTimeRef.current += delta;
    const animTime = incidentAnimTimeRef.current;
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH * 2;
    const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 4;
    const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH * 2;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 4;
    
    activeCrimeIncidentsRef.current.forEach((crime) => {
      const { screenX, screenY } = gridToScreen(crime.x, crime.y, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      
      if (centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom) {
        return;
      }
      
      const pulse = Math.sin(animTime * 4) * 0.3 + 0.7;
      const outerPulse = Math.sin(animTime * 3) * 0.5 + 0.5;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY - 8, 18 + outerPulse * 6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(59, 130, 246, ${0.25 * (1 - outerPulse)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      const gradient = ctx.createRadialGradient(centerX, centerY - 8, 0, centerX, centerY - 8, 14 * pulse);
      gradient.addColorStop(0, `rgba(59, 130, 246, ${0.5 * pulse})`);
      gradient.addColorStop(0.5, `rgba(59, 130, 246, ${0.2 * pulse})`);
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.beginPath();
      ctx.arc(centerX, centerY - 8, 14 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      ctx.save();
      ctx.translate(centerX, centerY - 12);
      
      ctx.fillStyle = `rgba(30, 64, 175, ${0.9 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, -4);
      ctx.lineTo(6, 2);
      ctx.quadraticCurveTo(0, 8, 0, 8);
      ctx.quadraticCurveTo(0, 8, -6, 2);
      ctx.lineTo(-6, -4);
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = `rgba(147, 197, 253, ${pulse})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, -4, 2, 5);
      ctx.beginPath();
      ctx.arc(0, 4, 1.5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
    
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const tile = currentGrid[y][x];
        if (!tile.building.onFire) continue;
        
        const { screenX, screenY } = gridToScreen(x, y, 0, 0);
        const centerX = screenX + TILE_WIDTH / 2;
        const centerY = screenY + TILE_HEIGHT / 2;
        
        if (centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom) {
          continue;
        }
        
        const pulse = Math.sin(animTime * 6) * 0.3 + 0.7;
        const outerPulse = Math.sin(animTime * 4) * 0.5 + 0.5;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY - 12, 22 + outerPulse * 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 * (1 - outerPulse)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.save();
        ctx.translate(centerX, centerY - 15);
        
        ctx.fillStyle = `rgba(220, 38, 38, ${0.9 * pulse})`;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(8, 5);
        ctx.lineTo(-8, 5);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = `rgba(252, 165, 165, ${pulse})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.quadraticCurveTo(2.5, 0, 2, 2.5);
        ctx.quadraticCurveTo(0.5, 1.5, 0, 2.5);
        ctx.quadraticCurveTo(-0.5, 1.5, -2, 2.5);
        ctx.quadraticCurveTo(-2.5, 0, 0, -3);
        ctx.fill();
        
        ctx.restore();
      }
    }
    
    ctx.restore();
  }, [worldStateRef, activeCrimeIncidentsRef]);

  return {
    spawnRandomCar,
    spawnPedestrian,
    spawnCrimeIncidents,
    updateCrimeIncidents,
    findCrimeIncidents,
    dispatchEmergencyVehicle,
    updateEmergencyDispatch,
    updateEmergencyVehicles,
    updateCars,
    updatePedestrians,
    drawCars,
    drawPedestrians,
    drawEmergencyVehicles,
    drawIncidentIndicators,
  };
}
