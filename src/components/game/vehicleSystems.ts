import React, { useCallback, useRef } from 'react';
import { Car, CarDirection, EmergencyVehicle, EmergencyVehicleType, Pedestrian, PedestrianDestType, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import { CAR_COLORS, CAR_MIN_ZOOM, CAR_MIN_ZOOM_MOBILE, PEDESTRIAN_MIN_ZOOM, PEDESTRIAN_MIN_ZOOM_MOBILE, DIRECTION_META, PEDESTRIAN_MAX_COUNT, PEDESTRIAN_MAX_COUNT_MOBILE, PEDESTRIAN_ROAD_TILE_DENSITY, PEDESTRIAN_ROAD_TILE_DENSITY_MOBILE, PEDESTRIAN_SPAWN_BATCH_SIZE, PEDESTRIAN_SPAWN_BATCH_SIZE_MOBILE, PEDESTRIAN_SPAWN_INTERVAL, PEDESTRIAN_SPAWN_INTERVAL_MOBILE, VEHICLE_FAR_ZOOM_THRESHOLD } from './constants';
import { isRoadTile, getDirectionOptions, pickNextDirection, findPathOnRoads, getDirectionToTile, gridToScreen } from './utils';
import { findResidentialBuildings, findPedestrianDestinations, findStations, findFires, findRecreationAreas, findEnterableBuildings, SPORTS_TYPES, ACTIVE_RECREATION_TYPES } from './gridFinders';
import { drawPedestrians as drawPedestriansUtil } from './drawPedestrians';
import { BuildingType, Tile } from '@/types/game';
import { getTrafficLightState, canProceedThroughIntersection, TRAFFIC_LIGHT_TIMING } from './trafficSystem';
import { isRailroadCrossing, shouldStopAtCrossing } from './railSystem';
import { CrimeType, getRandomCrimeType, getCrimeDuration } from './incidentData';
import {
  createPedestrian,
  updatePedestrianState,
  spawnPedestrianAtRecreation,
  spawnPedestrianFromBuilding,
  findBeachTiles,
  getRandomBeachTile,
  spawnPedestrianAtBeach,
} from './pedestrianSystem';

/** Train type for crossing detection (minimal interface) */
export interface TrainForCrossing {
  tileX: number;
  tileY: number;
  direction: CarDirection;
  progress: number;
  carriages: { tileX: number; tileY: number }[];
}

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
  trainsRef: React.MutableRefObject<TrainForCrossing[]>;
}

export interface VehicleSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  gridVersionRef: React.MutableRefObject<number>;
  cachedRoadTileCountRef: React.MutableRefObject<{ count: number; gridVersion: number }>;
  // PERF: Pre-computed intersection map to avoid repeated getDirectionOptions() calls per-car per-frame
  cachedIntersectionMapRef: React.MutableRefObject<{ map: Map<number, boolean>; gridVersion: number }>;
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
    trainsRef,
  } = refs;

  const { worldStateRef, gridVersionRef, cachedRoadTileCountRef, cachedIntersectionMapRef, state, isMobile } = systemState;

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

  // Find recreation areas
  const findRecreationAreasCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findRecreationAreas(currentGrid, currentGridSize);
  }, [worldStateRef]);

  // Find enterable buildings
  const findEnterableBuildingsCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findEnterableBuildings(currentGrid, currentGridSize);
  }, [worldStateRef]);

  // Find beach tiles (water tiles adjacent to land)
  const findBeachTilesCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findBeachTiles(currentGrid, currentGridSize);
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
    
    // Choose spawn type - more variety in pedestrian spawning
    const spawnType = Math.random();
    
    // 10% - Pedestrian at the beach (swimming or on mat)
    if (spawnType < 0.10) {
      const beachTiles = findBeachTilesCallback();
      if (beachTiles.length > 0) {
        const beachInfo = getRandomBeachTile(beachTiles);
        if (beachInfo) {
          const home = residentials[Math.floor(Math.random() * residentials.length)];
          const ped = spawnPedestrianAtBeach(
            pedestrianIdRef.current++,
            beachInfo,
            currentGrid,
            currentGridSize,
            home.x,
            home.y
          );
          
          if (ped) {
            pedestriansRef.current.push(ped);
            return true;
          }
        }
      }
      // If no beach tiles, fall through to other spawn types
    }
    
    // 55% - Normal walking pedestrian heading to a destination
    if (spawnType < 0.65) {
      const home = residentials[Math.floor(Math.random() * residentials.length)];
      
      let dest = destinations[Math.floor(Math.random() * destinations.length)];
      
      // 40% chance to re-roll and specifically pick a sports/active facility if available
      // These are rarer in most cities so we boost their selection probability
      if (Math.random() < 0.4 && dest.type === 'park') {
        const { grid: currentGrid } = worldStateRef.current;
        const boostedDests = destinations.filter(d => {
          if (d.type !== 'park') return false;
          const tile = currentGrid[d.y]?.[d.x];
          const buildingType = tile?.building.type;
          return buildingType && (SPORTS_TYPES.includes(buildingType) || ACTIVE_RECREATION_TYPES.includes(buildingType));
        });
        if (boostedDests.length > 0) {
          dest = boostedDests[Math.floor(Math.random() * boostedDests.length)];
        }
      }
      
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
      
      const ped = createPedestrian(
        pedestrianIdRef.current++,
        home.x,
        home.y,
        dest.x,
        dest.y,
        dest.type,
        path,
        startIndex,
        direction
      );
      
      pedestriansRef.current.push(ped);
      return true;
    }
    
    // 22% - Pedestrian already at a recreation area
    if (spawnType < 0.87) {
      const recreationAreas = findRecreationAreasCallback();
      if (recreationAreas.length === 0) return false;
      
      let area = recreationAreas[Math.floor(Math.random() * recreationAreas.length)];
      
      // 50% chance to re-roll and pick a sports/active facility if available
      if (Math.random() < 0.5) {
        const sportsAreas = recreationAreas.filter(a => 
          SPORTS_TYPES.includes(a.buildingType) || ACTIVE_RECREATION_TYPES.includes(a.buildingType)
        );
        if (sportsAreas.length > 0) {
          area = sportsAreas[Math.floor(Math.random() * sportsAreas.length)];
        }
      }
      const home = residentials[Math.floor(Math.random() * residentials.length)];
      
      const ped = spawnPedestrianAtRecreation(
        pedestrianIdRef.current++,
        area.x,
        area.y,
        currentGrid,
        currentGridSize,
        home.x,
        home.y
      );
      
      if (ped) {
        pedestriansRef.current.push(ped);
        return true;
      }
      return false;
    }
    
    // 15% - Pedestrian exiting from a building
    const enterableBuildings = findEnterableBuildingsCallback();
    if (enterableBuildings.length === 0) return false;
    
    const building = enterableBuildings[Math.floor(Math.random() * enterableBuildings.length)];
    const home = residentials[Math.floor(Math.random() * residentials.length)];
    
    const ped = spawnPedestrianFromBuilding(
      pedestrianIdRef.current++,
      building.x,
      building.y,
      currentGrid,
      currentGridSize,
      home.x,
      home.y
    );
    
    if (ped) {
      pedestriansRef.current.push(ped);
      return true;
    }
    return false;
  }, [worldStateRef, findResidentialBuildingsCallback, findPedestrianDestinationsCallback, findRecreationAreasCallback, findEnterableBuildingsCallback, findBeachTilesCallback, pedestriansRef, pedestrianIdRef]);

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
            tile.building.type !== 'bridge' && 
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
    
    // PERF: Use for...of instead of forEach for Map iteration
    for (const [key, crime] of activeCrimeIncidentsRef.current) {
      if (activeCrimesRef.current.has(key)) continue;
      
      const newTimeRemaining = crime.timeRemaining - delta * speedMultiplier;
      if (newTimeRemaining <= 0) {
        keysToDelete.push(key);
      } else {
        activeCrimeIncidentsRef.current.set(key, { ...crime, timeRemaining: newTimeRemaining });
      }
    }
    
    // PERF: Use for loop instead of forEach
    for (let i = 0; i < keysToDelete.length; i++) {
      activeCrimeIncidentsRef.current.delete(keysToDelete[i]);
    }
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
  // PERF: Use cached intersection map to avoid repeated O(n) getDirectionOptions() calls per-car per-frame
  const isIntersection = useCallback((grid: Tile[][], gridSize: number, x: number, y: number): boolean => {
    if (!isRoadTile(grid, gridSize, x, y)) return false;
    
    // Check if cache is valid for current grid version
    const currentVersion = gridVersionRef.current;
    if (cachedIntersectionMapRef.current.gridVersion !== currentVersion) {
      // Rebuild the intersection cache for the entire grid
      const newMap = new Map<number, boolean>();
      for (let cy = 0; cy < gridSize; cy++) {
        for (let cx = 0; cx < gridSize; cx++) {
          if (isRoadTile(grid, gridSize, cx, cy)) {
            const options = getDirectionOptions(grid, gridSize, cx, cy);
            newMap.set(cy * gridSize + cx, options.length >= 3);
          }
        }
      }
      cachedIntersectionMapRef.current = { map: newMap, gridVersion: currentVersion };
    }
    
    // O(1) lookup from cache
    const key = y * gridSize + x;
    return cachedIntersectionMapRef.current.map.get(key) ?? false;
  }, [gridVersionRef, cachedIntersectionMapRef]);

  const updateCars = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    // Clear cars if zoomed out too far (use mobile threshold on mobile for better perf)
    // Also use far zoom threshold for desktop when very zoomed out (for large maps)
    const carMinZoom = isMobile ? CAR_MIN_ZOOM_MOBILE : CAR_MIN_ZOOM;
    const effectiveMinZoom = Math.max(carMinZoom, VEHICLE_FAR_ZOOM_THRESHOLD);
    if (currentZoom < effectiveMinZoom) {
      carsRef.current = [];
      return;
    }
    
    // Don't clear cars if grid is temporarily unavailable - just skip update
    if (!currentGrid || currentGridSize <= 0) {
      return;
    }
    
    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
    
    // Scale car count with road tiles (similar to pedestrians) for proper density on large maps
    // Use cached road tile count for performance
    const currentGridVersion = gridVersionRef.current;
    let roadTileCount: number;
    if (cachedRoadTileCountRef.current.gridVersion === currentGridVersion) {
      roadTileCount = cachedRoadTileCountRef.current.count;
    } else {
      roadTileCount = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          const type = currentGrid[y][x].building.type;
          if (type === 'road' || type === 'bridge') {
            roadTileCount++;
          }
        }
      }
      cachedRoadTileCountRef.current = { count: roadTileCount, gridVersion: currentGridVersion };
    }
    
    // Target ~0.5 cars per road tile on desktop, ~0.15 on mobile (for performance)
    // This ensures large maps with more roads get proportionally more cars
    const carDensity = isMobile ? 0.15 : 0.5;
    const targetCars = Math.floor(roadTileCount * carDensity);
    // Cap at 800 for desktop, 60 for mobile - minimum 10/15 for small cities
    const maxCars = isMobile 
      ? Math.min(60, Math.max(10, targetCars))
      : Math.min(800, Math.max(15, targetCars));
    
    carSpawnTimerRef.current -= delta;
    if (carsRef.current.length < maxCars && carSpawnTimerRef.current <= 0) {
      // Spawn cars at a moderate rate - spawn more at once on large maps to catch up faster
      // Mobile: spawn fewer cars at once and slower intervals
      const deficit = maxCars - carsRef.current.length;
      const carsToSpawn = isMobile 
        ? Math.min(1, deficit) 
        : Math.min(deficit > 50 ? 4 : 2, deficit);
      let spawnedCount = 0;
      for (let i = 0; i < carsToSpawn; i++) {
        if (spawnRandomCar()) {
          spawnedCount++;
        }
      }
      // Mobile: slower spawn rate (0.8-1.2s vs 0.3-0.7s on desktop)
      carSpawnTimerRef.current = spawnedCount > 0 
        ? (isMobile ? 0.8 + Math.random() * 0.4 : 0.3 + Math.random() * 0.4) 
        : 0.1;
    }
    
    // Get current traffic light state
    const trafficTime = trafficLightTimerRef.current;
    const lightState = getTrafficLightState(trafficTime);
    
    // Build spatial index of cars by tile for efficient collision detection
    // PERF: Use numeric keys (y * gridSize + x) instead of string keys
    const carsByTile = new Map<number, Car[]>();
    for (const car of carsRef.current) {
      const key = car.tileY * currentGridSize + car.tileX;
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
      
      // Check for railroad crossing ahead
      // Stop if approaching a crossing with a train nearby
      if (!shouldStop) {
        const trains = trainsRef.current;
        
        // Check current tile (if we're about to enter a crossing)
        if (isRailroadCrossing(currentGrid, currentGridSize, car.tileX, car.tileY)) {
          // We're on a crossing - check if a train is approaching/occupying it
          if (shouldStopAtCrossing(trains, car.tileX, car.tileY)) {
            // If we're early in crossing, stop immediately
            if (car.progress < 0.3) {
              shouldStop = true;
            }
            // Otherwise, keep moving through to clear the crossing
          }
        }
        
        // Check next tile (approaching a crossing)
        if (!shouldStop && car.progress > 0.5 && isRailroadCrossing(currentGrid, currentGridSize, nextX, nextY)) {
          if (shouldStopAtCrossing(trains, nextX, nextY)) {
            shouldStop = true;
          }
        }
      }
      
      // Check for car ahead - efficient spatial lookup
      // Only check cars going the SAME direction (same lane)
      if (!shouldStop) {
        // Check same tile for car ahead in same lane
        // PERF: Use numeric key lookup
        const sameTileCars = carsByTile.get(car.tileY * currentGridSize + car.tileX) || [];
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
          // PERF: Use numeric key lookup
          const nextTileCars = carsByTile.get(nextY * currentGridSize + nextX) || [];
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
  }, [worldStateRef, carsRef, carSpawnTimerRef, spawnRandomCar, trafficLightTimerRef, isIntersection, isMobile, trainsRef, gridVersionRef, cachedRoadTileCountRef]);

  const updatePedestrians = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    // Clear pedestrians if zoomed out too far (use mobile threshold on mobile for better perf)
    // Also use far zoom threshold for desktop when very zoomed out (for large maps)
    const pedestrianMinZoom = isMobile ? PEDESTRIAN_MIN_ZOOM_MOBILE : PEDESTRIAN_MIN_ZOOM;
    const effectiveMinZoom = Math.max(pedestrianMinZoom, VEHICLE_FAR_ZOOM_THRESHOLD);
    if (currentZoom < effectiveMinZoom) {
      pedestriansRef.current = [];
      return;
    }
    
    if (!currentGrid || currentGridSize <= 0) {
      pedestriansRef.current = [];
      return;
    }
    
    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
    
    // Cache road tile count (expensive to calculate every frame)
    const currentGridVersion = gridVersionRef.current;
    let roadTileCount: number;
    if (cachedRoadTileCountRef.current.gridVersion === currentGridVersion) {
      roadTileCount = cachedRoadTileCountRef.current.count;
    } else {
      roadTileCount = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          const type = currentGrid[y][x].building.type;
          if (type === 'road' || type === 'bridge') {
            roadTileCount++;
          }
        }
      }
      cachedRoadTileCountRef.current = { count: roadTileCount, gridVersion: currentGridVersion };
    }
    
    // Scale pedestrian count with city size (road tiles), with a reasonable cap
    // Mobile: use lower density and max count for performance
    const pedDensity = isMobile ? PEDESTRIAN_ROAD_TILE_DENSITY_MOBILE : PEDESTRIAN_ROAD_TILE_DENSITY;
    const pedMaxCount = isMobile ? PEDESTRIAN_MAX_COUNT_MOBILE : PEDESTRIAN_MAX_COUNT;
    const pedMinCount = isMobile ? 20 : 150;
    const targetPedestrians = roadTileCount * pedDensity;
    const maxPedestrians = Math.min(pedMaxCount, Math.max(pedMinCount, targetPedestrians));
    pedestrianSpawnTimerRef.current -= delta;
    
    if (pedestriansRef.current.length < maxPedestrians && pedestrianSpawnTimerRef.current <= 0) {
      // Spawn pedestrians in batches - smaller batches on mobile
      const batchSize = isMobile ? PEDESTRIAN_SPAWN_BATCH_SIZE_MOBILE : PEDESTRIAN_SPAWN_BATCH_SIZE;
      const spawnBatch = Math.min(batchSize, maxPedestrians - pedestriansRef.current.length);
      for (let i = 0; i < spawnBatch; i++) {
        spawnPedestrian();
      }
      pedestrianSpawnTimerRef.current = isMobile ? PEDESTRIAN_SPAWN_INTERVAL_MOBILE : PEDESTRIAN_SPAWN_INTERVAL;
    }
    
    // OPTIMIZED: Reuse array instead of spreading
    const allPedestrians = pedestriansRef.current;
    const updatedPedestrians: Pedestrian[] = [];
    
    // Pre-calculate traffic light state once per frame
    const trafficTime = trafficLightTimerRef.current;
    const lightState = getTrafficLightState(trafficTime);
    
    for (let i = 0; i < allPedestrians.length; i++) {
      const ped = allPedestrians[i];
      
      // Use the new state machine for pedestrian updates
      const alive = updatePedestrianState(
        ped,
        delta,
        speedMultiplier,
        currentGrid,
        currentGridSize,
        allPedestrians
      );
      
      if (alive) {
        // OPTIMIZED: Only check traffic lights for walking pedestrians approaching intersections
        // Check when approaching the end of the current tile (before entering intersection)
        if (ped.state === 'walking' && ped.progress > 0.4 && ped.pathIndex + 1 < ped.path.length) {
          // Only 80% respect lights (skip check for some pedestrians)
          if ((ped.id % 5) !== 0) {
            const nextTile = ped.path[ped.pathIndex + 1];
            // Quick intersection check - only count if likely an intersection
            let roadCount = 0;
            if (isRoadTile(currentGrid, currentGridSize, nextTile.x - 1, nextTile.y)) roadCount++;
            if (roadCount < 3 && isRoadTile(currentGrid, currentGridSize, nextTile.x, nextTile.y - 1)) roadCount++;
            if (roadCount < 3 && isRoadTile(currentGrid, currentGridSize, nextTile.x + 1, nextTile.y)) roadCount++;
            if (roadCount < 3 && isRoadTile(currentGrid, currentGridSize, nextTile.x, nextTile.y + 1)) roadCount++;
            
            if (roadCount >= 3 && !canProceedThroughIntersection(ped.direction, lightState)) {
              // Stop at edge of sidewalk (0.5 = middle of tile, near sidewalk edge)
              ped.progress = Math.min(ped.progress, 0.5);
            }
          }
        }
        
        updatedPedestrians.push(ped);
      }
    }
    
    pedestriansRef.current = updatedPedestrians;
  }, [worldStateRef, gridVersionRef, cachedRoadTileCountRef, pedestriansRef, pedestrianSpawnTimerRef, spawnPedestrian, trafficLightTimerRef, isMobile]);

  const drawCars = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Skip drawing cars when zoomed out too far
    const carMinZoom = isMobile ? CAR_MIN_ZOOM_MOBILE : CAR_MIN_ZOOM;
    if (currentZoom < carMinZoom) {
      return;
    }
    
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
  }, [worldStateRef, carsRef, isMobile]);

  const drawPedestrians = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Skip drawing pedestrians when zoomed out too far
    const pedestrianMinZoom = isMobile ? PEDESTRIAN_MIN_ZOOM_MOBILE : PEDESTRIAN_MIN_ZOOM;
    if (currentZoom < pedestrianMinZoom) {
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
    
    // Pass zoom level for LOD (Level of Detail) rendering
    // Only draw non-recreation pedestrians here (recreation pedestrians are drawn on air canvas)
    drawPedestriansUtil(ctx, pedestriansRef.current, viewBounds, currentZoom, 'non-recreation');
    
    ctx.restore();
  }, [worldStateRef, pedestriansRef, isMobile]);

  // Draw recreation pedestrians on air canvas (above buildings, smooth animation every frame)
  const drawRecreationPedestrians = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Skip drawing recreation pedestrians when zoomed out too far
    const pedestrianMinZoom = isMobile ? PEDESTRIAN_MIN_ZOOM_MOBILE : PEDESTRIAN_MIN_ZOOM;
    if (currentZoom < pedestrianMinZoom) {
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
    
    // Draw only recreation pedestrians (at parks, sports facilities, etc.)
    drawPedestriansUtil(ctx, pedestriansRef.current, viewBounds, currentZoom, 'recreation');
    
    ctx.restore();
  }, [worldStateRef, pedestriansRef, isMobile]);

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
    
    // PERF: Use for...of instead of forEach for Map iteration
    for (const crime of activeCrimeIncidentsRef.current.values()) {
      const { screenX, screenY } = gridToScreen(crime.x, crime.y, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      
      if (centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom) {
        continue;
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
    }
    
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
    drawRecreationPedestrians,
    drawEmergencyVehicles,
    drawIncidentIndicators,
  };
}
