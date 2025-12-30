import { useCallback } from 'react';
import { Airplane, Helicopter, WorldRenderState, TILE_WIDTH, TILE_HEIGHT, PlaneType } from './types';
import {
  AIRPLANE_MIN_POPULATION,
  AIRPLANE_COLORS,
  CONTRAIL_MAX_AGE,
  CONTRAIL_SPAWN_INTERVAL,
  HELICOPTER_MIN_POPULATION,
  HELICOPTER_COLORS,
  ROTOR_WASH_MAX_AGE,
  ROTOR_WASH_SPAWN_INTERVAL,
  PLANE_TYPES,
  AIRPLANE_MIN_ZOOM_FAR,
  HELICOPTER_MIN_ZOOM_FAR,
  HELICOPTER_MIN_ZOOM,
} from './constants';
import { gridToScreen } from './utils';
import { findAirports, findHeliports } from './gridFinders';

export interface AircraftSystemRefs {
  airplanesRef: React.MutableRefObject<Airplane[]>;
  airplaneIdRef: React.MutableRefObject<number>;
  airplaneSpawnTimerRef: React.MutableRefObject<number>;
  helicoptersRef: React.MutableRefObject<Helicopter[]>;
  helicopterIdRef: React.MutableRefObject<number>;
  helicopterSpawnTimerRef: React.MutableRefObject<number>;
}

export interface AircraftSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  gridVersionRef: React.MutableRefObject<number>;
  cachedPopulationRef: React.MutableRefObject<{ count: number; gridVersion: number }>;
  isMobile: boolean;
}

export function useAircraftSystems(
  refs: AircraftSystemRefs,
  systemState: AircraftSystemState
) {
  const {
    airplanesRef,
    airplaneIdRef,
    airplaneSpawnTimerRef,
    helicoptersRef,
    helicopterIdRef,
    helicopterSpawnTimerRef,
  } = refs;

  const { worldStateRef, gridVersionRef, cachedPopulationRef, isMobile } = systemState;

  // Find airports callback
  const findAirportsCallback = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findAirports(currentGrid, currentGridSize);
  }, [worldStateRef]);

  // Find heliports callback
  const findHeliportsCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findHeliports(currentGrid, currentGridSize);
  }, [worldStateRef]);

  // Update airplanes - spawn, move, and manage lifecycle
  const updateAirplanes = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }
    
    // Clear airplanes if zoomed out too far (for large map performance)
    if (currentZoom < AIRPLANE_MIN_ZOOM_FAR) {
      airplanesRef.current = [];
      return;
    }

    // Find airports and check population
    const airports = findAirportsCallback();
    
    // Get cached population count (only recalculate when grid changes)
    const currentGridVersion = gridVersionRef.current;
    let totalPopulation: number;
    if (cachedPopulationRef.current.gridVersion === currentGridVersion) {
      totalPopulation = cachedPopulationRef.current.count;
    } else {
      // Recalculate and cache
      totalPopulation = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          totalPopulation += currentGrid[y][x].building.population || 0;
        }
      }
      cachedPopulationRef.current = { count: totalPopulation, gridVersion: currentGridVersion };
    }

    // No airplanes if no airport or insufficient population
    if (airports.length === 0 || totalPopulation < AIRPLANE_MIN_POPULATION) {
      airplanesRef.current = [];
      return;
    }

    // Calculate max airplanes based on population (1 per 2k population, min 25, max 80)
    const maxAirplanes = Math.min(80, Math.max(25, Math.floor(totalPopulation / 2000) * 3));
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    airplaneSpawnTimerRef.current -= delta;
    if (airplanesRef.current.length < maxAirplanes && airplaneSpawnTimerRef.current <= 0) {
      // Pick a random airport
      const airport = airports[Math.floor(Math.random() * airports.length)];
      
      // Convert airport tile to screen coordinates
      const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(airport.x, airport.y, 0, 0);
      const airportCenterX = airportScreenX + TILE_WIDTH * 2; // Center of 4x4 airport
      const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
      
      // Decide if taking off or arriving from distance
      const isTakingOff = Math.random() < 0.5;
      
      if (isTakingOff) {
        // Taking off from airport
        const angle = Math.random() * Math.PI * 2; // Random direction
        const planeType = PLANE_TYPES[Math.floor(Math.random() * PLANE_TYPES.length)] as PlaneType;
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: airportCenterX,
          y: airportCenterY,
          angle: angle,
          state: 'taking_off',
          speed: 30 + Math.random() * 20, // Slow during takeoff
          altitude: 0,
          targetAltitude: 1,
          airportX: airport.x,
          airportY: airport.y,
          stateProgress: 0,
          contrail: [],
          lifeTime: 30 + Math.random() * 20, // 30-50 seconds of flight
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
          planeType: planeType,
        });
      } else {
        // Arriving from the edge of the map
        const edge = Math.floor(Math.random() * 4);
        let startX: number, startY: number;
        
        // Calculate map bounds in screen space
        const mapCenterX = 0;
        const mapCenterY = currentGridSize * TILE_HEIGHT / 2;
        const mapExtent = currentGridSize * TILE_WIDTH;
        
        switch (edge) {
          case 0: // From top
            startX = mapCenterX + (Math.random() - 0.5) * mapExtent;
            startY = mapCenterY - mapExtent / 2 - 200;
            break;
          case 1: // From right
            startX = mapCenterX + mapExtent / 2 + 200;
            startY = mapCenterY + (Math.random() - 0.5) * mapExtent / 2;
            break;
          case 2: // From bottom
            startX = mapCenterX + (Math.random() - 0.5) * mapExtent;
            startY = mapCenterY + mapExtent / 2 + 200;
            break;
          default: // From left
            startX = mapCenterX - mapExtent / 2 - 200;
            startY = mapCenterY + (Math.random() - 0.5) * mapExtent / 2;
            break;
        }
        
        // Calculate angle to airport
        const angleToAirport = Math.atan2(airportCenterY - startY, airportCenterX - startX);
        const planeType = PLANE_TYPES[Math.floor(Math.random() * PLANE_TYPES.length)] as PlaneType;
        
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: startX,
          y: startY,
          angle: angleToAirport,
          state: 'flying',
          speed: 80 + Math.random() * 40, // Faster when cruising
          altitude: 1,
          targetAltitude: 1,
          airportX: airport.x,
          airportY: airport.y,
          stateProgress: 0,
          contrail: [],
          lifeTime: 30 + Math.random() * 20,
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
          planeType: planeType,
        });
      }
      
      airplaneSpawnTimerRef.current = 2 + Math.random() * 5; // 2-7 seconds between spawns
    }

    // Update existing airplanes
    const updatedAirplanes: Airplane[] = [];
    
    for (const plane of airplanesRef.current) {
      // Work on a local copy (avoid mutating ref contents directly)
      let nextPlane: Airplane = { ...plane };

      // Update contrail particles - shorter duration on mobile for performance
      const contrailMaxAge = isMobile ? 0.8 : CONTRAIL_MAX_AGE;
      const contrailSpawnInterval = isMobile ? 0.06 : CONTRAIL_SPAWN_INTERVAL;
      nextPlane.contrail = nextPlane.contrail
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / contrailMaxAge) }))
        .filter(p => p.age < contrailMaxAge);
      
      // Add new contrail particles at high altitude (less frequent on mobile)
      if (nextPlane.altitude > 0.7) {
        nextPlane.stateProgress += delta;
        if (nextPlane.stateProgress >= contrailSpawnInterval) {
          nextPlane.stateProgress -= contrailSpawnInterval;
          // Single centered contrail particle - offset behind plane and down
          const behindOffset = 40; // Distance behind the plane
          const downOffset = 8; // Vertical offset down
          const contrailX = nextPlane.x - Math.cos(nextPlane.angle) * behindOffset;
          const contrailY = nextPlane.y - Math.sin(nextPlane.angle) * behindOffset + downOffset;
          nextPlane.contrail = [...nextPlane.contrail, { x: contrailX, y: contrailY, age: 0, opacity: 1 }];
        }
      }
      
      // Update based on state
      switch (nextPlane.state) {
        case 'taking_off': {
          // Move forward and climb
          nextPlane.x += Math.cos(nextPlane.angle) * nextPlane.speed * delta * speedMultiplier;
          nextPlane.y += Math.sin(nextPlane.angle) * nextPlane.speed * delta * speedMultiplier;
          nextPlane.altitude = Math.min(1, nextPlane.altitude + delta * 0.3); // Climb rate
          nextPlane.speed = Math.min(120, nextPlane.speed + delta * 20); // Accelerate
          
          if (nextPlane.altitude >= 1) {
            nextPlane.state = 'flying';
          }
          break;
        }
        
        case 'flying': {
          // Move forward at cruising speed
          nextPlane.x += Math.cos(nextPlane.angle) * nextPlane.speed * delta * speedMultiplier;
          nextPlane.y += Math.sin(nextPlane.angle) * nextPlane.speed * delta * speedMultiplier;
          
          nextPlane.lifeTime -= delta;
          
          // Check if near airport and should land
          const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(nextPlane.airportX, nextPlane.airportY, 0, 0);
          const airportCenterX = airportScreenX + TILE_WIDTH * 2;
          const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
          const distToAirport = Math.hypot(nextPlane.x - airportCenterX, nextPlane.y - airportCenterY);
          
          // Start landing approach when close enough and lifetime is low
          if (distToAirport < 400 && nextPlane.lifeTime < 10) {
            nextPlane.state = 'landing';
            nextPlane.targetAltitude = 0;
            // Adjust angle to point at airport
            nextPlane.angle = Math.atan2(airportCenterY - nextPlane.y, airportCenterX - nextPlane.x);
          } else if (nextPlane.lifeTime <= 0) {
            // Despawn if too far from airport and out of time
            continue;
          }
          break;
        }
        
        case 'landing': {
          // Descend and slow down while approaching airport
          const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(nextPlane.airportX, nextPlane.airportY, 0, 0);
          const airportCenterX = airportScreenX + TILE_WIDTH * 2;
          const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
          
          // Adjust angle to point at airport
          const angleToAirport = Math.atan2(airportCenterY - nextPlane.y, airportCenterX - nextPlane.x);
          nextPlane.angle = angleToAirport;
          
          nextPlane.x += Math.cos(nextPlane.angle) * nextPlane.speed * delta * speedMultiplier;
          nextPlane.y += Math.sin(nextPlane.angle) * nextPlane.speed * delta * speedMultiplier;
          nextPlane.altitude = Math.max(0, nextPlane.altitude - delta * 0.25); // Descend
          nextPlane.speed = Math.max(30, nextPlane.speed - delta * 15); // Decelerate
          
          const distToAirport = Math.hypot(nextPlane.x - airportCenterX, nextPlane.y - airportCenterY);
          if (distToAirport < 50 || nextPlane.altitude <= 0) {
            // Landed - remove plane
            continue;
          }
          break;
        }
        
        case 'taxiing':
          // Not implemented - planes just land and disappear
          continue;
      }
      
      updatedAirplanes.push(nextPlane);
    }
    
    airplanesRef.current = updatedAirplanes;
  }, [worldStateRef, gridVersionRef, cachedPopulationRef, airplanesRef, airplaneIdRef, airplaneSpawnTimerRef, findAirportsCallback, isMobile]);

  // Update helicopters - spawn, move between hospitals/airports, and manage lifecycle
  const updateHelicopters = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }
    
    // Clear helicopters if zoomed out too far (for large map performance)
    if (currentZoom < HELICOPTER_MIN_ZOOM_FAR) {
      helicoptersRef.current = [];
      return;
    }

    // Find heliports
    const heliports = findHeliportsCallback();
    
    // Get cached population count
    const currentGridVersion = gridVersionRef.current;
    let totalPopulation: number;
    if (cachedPopulationRef.current.gridVersion === currentGridVersion) {
      totalPopulation = cachedPopulationRef.current.count;
    } else {
      // Recalculate and cache
      totalPopulation = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          totalPopulation += currentGrid[y][x].building.population || 0;
        }
      }
      cachedPopulationRef.current = { count: totalPopulation, gridVersion: currentGridVersion };
    }

    // No helicopters if fewer than 2 heliports or insufficient population
    if (heliports.length < 2 || totalPopulation < HELICOPTER_MIN_POPULATION) {
      helicoptersRef.current = [];
      return;
    }

    // Calculate max helicopters based on heliports and population (1 per 1k population, min 6, max 60)
    // Also scale with number of heliports available
    const populationBased = Math.floor(totalPopulation / 1000);
    const heliportBased = Math.floor(heliports.length * 2.5);
    const maxHelicopters = Math.min(60, Math.max(6, Math.min(populationBased, heliportBased)));
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    helicopterSpawnTimerRef.current -= delta;
    if (helicoptersRef.current.length < maxHelicopters && helicopterSpawnTimerRef.current <= 0) {
      // Pick a random origin heliport
      const originIndex = Math.floor(Math.random() * heliports.length);
      const origin = heliports[originIndex];
      
      // Pick a different destination heliport
      const otherHeliports = heliports.filter((_, i) => i !== originIndex);
      if (otherHeliports.length > 0) {
        const dest = otherHeliports[Math.floor(Math.random() * otherHeliports.length)];
        
        // Convert origin tile to screen coordinates
        const { screenX: originScreenX, screenY: originScreenY } = gridToScreen(origin.x, origin.y, 0, 0);
        const originCenterX = originScreenX + TILE_WIDTH * origin.size / 2;
        const originCenterY = originScreenY + TILE_HEIGHT * origin.size / 2;
        
        // Convert destination tile to screen coordinates
        const { screenX: destScreenX, screenY: destScreenY } = gridToScreen(dest.x, dest.y, 0, 0);
        const destCenterX = destScreenX + TILE_WIDTH * dest.size / 2;
        const destCenterY = destScreenY + TILE_HEIGHT * dest.size / 2;
        
        // Calculate angle to destination
        const angleToDestination = Math.atan2(destCenterY - originCenterY, destCenterX - originCenterX);
        
        // Initialize searchlight with randomized sweep pattern
        const searchlightSweepSpeed = 0.8 + Math.random() * 0.6; // 0.8-1.4 radians per second
        const searchlightSweepRange = Math.PI / 4 + Math.random() * (Math.PI / 6); // 45-75 degree sweep range
        
        helicoptersRef.current.push({
          id: helicopterIdRef.current++,
          x: originCenterX,
          y: originCenterY,
          angle: angleToDestination,
          state: 'taking_off',
          speed: 15 + Math.random() * 10, // Slow during takeoff
          altitude: 0,
          targetAltitude: 0.5, // Helicopters fly lower than planes
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
          // Searchlight starts pointing forward-down, sweeps side to side
          searchlightAngle: 0,
          searchlightSweepSpeed,
          searchlightSweepRange,
          searchlightBaseAngle: angleToDestination + Math.PI / 2, // Perpendicular to flight path
        });
      }
      
      helicopterSpawnTimerRef.current = 0.8 + Math.random() * 2.2; // 0.8-3 seconds between spawns
    }

    // Update existing helicopters
    const updatedHelicopters: Helicopter[] = [];
    
    for (const heli of helicoptersRef.current) {
      // Work on a local copy (avoid mutating ref contents directly)
      let nextHeli: Helicopter = { ...heli };

      // Update rotor animation
      nextHeli.rotorAngle += delta * 25; // Fast rotor spin
      
      // Update searchlight sweep animation (sinusoidal motion)
      nextHeli.searchlightAngle += delta * nextHeli.searchlightSweepSpeed;
      // Update base angle to follow helicopter direction for more natural sweep
      nextHeli.searchlightBaseAngle = nextHeli.angle + Math.PI / 2;
      
      // Update rotor wash particles - shorter duration on mobile
      const washMaxAge = isMobile ? 0.4 : ROTOR_WASH_MAX_AGE;
      const washSpawnInterval = isMobile ? 0.08 : ROTOR_WASH_SPAWN_INTERVAL;
      nextHeli.rotorWash = nextHeli.rotorWash
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / washMaxAge) }))
        .filter(p => p.age < washMaxAge);
      
      // Add new rotor wash particles when flying
      if (nextHeli.altitude > 0.2 && nextHeli.state === 'flying') {
        nextHeli.stateProgress += delta;
        if (nextHeli.stateProgress >= washSpawnInterval) {
          nextHeli.stateProgress -= washSpawnInterval;
          // Single small rotor wash particle behind helicopter
          const behindAngle = nextHeli.angle + Math.PI;
          const offsetDist = 6;
          nextHeli.rotorWash = [
            ...nextHeli.rotorWash,
            {
              x: nextHeli.x + Math.cos(behindAngle) * offsetDist,
              y: nextHeli.y + Math.sin(behindAngle) * offsetDist,
              age: 0,
              opacity: 1,
            },
          ];
        }
      }
      
      // Update based on state
      switch (nextHeli.state) {
        case 'taking_off': {
          // Rise vertically first, then start moving
          nextHeli.altitude = Math.min(0.5, nextHeli.altitude + delta * 0.4);
          nextHeli.speed = Math.min(50, nextHeli.speed + delta * 15);
          
          // Start moving once at cruising altitude
          if (nextHeli.altitude >= 0.3) {
            nextHeli.x += Math.cos(nextHeli.angle) * nextHeli.speed * delta * speedMultiplier * 0.5;
            nextHeli.y += Math.sin(nextHeli.angle) * nextHeli.speed * delta * speedMultiplier * 0.5;
          }
          
          if (nextHeli.altitude >= 0.5) {
            nextHeli.state = 'flying';
          }
          break;
        }
        
        case 'flying': {
          // Move toward destination
          nextHeli.x += Math.cos(nextHeli.angle) * nextHeli.speed * delta * speedMultiplier;
          nextHeli.y += Math.sin(nextHeli.angle) * nextHeli.speed * delta * speedMultiplier;
          
          // Check if near destination
          const distToDest = Math.hypot(nextHeli.x - nextHeli.destScreenX, nextHeli.y - nextHeli.destScreenY);
          
          if (distToDest < 80) {
            nextHeli.state = 'landing';
            nextHeli.targetAltitude = 0;
          }
          break;
        }
        
        case 'landing': {
          // Approach destination and descend
          const distToDest = Math.hypot(nextHeli.x - nextHeli.destScreenX, nextHeli.y - nextHeli.destScreenY);
          
          // Slow down as we get closer
          nextHeli.speed = Math.max(10, nextHeli.speed - delta * 20);
          
          // Keep moving toward destination if not there yet
          if (distToDest > 15) {
            const angleToDestination = Math.atan2(nextHeli.destScreenY - nextHeli.y, nextHeli.destScreenX - nextHeli.x);
            nextHeli.angle = angleToDestination;
            nextHeli.x += Math.cos(nextHeli.angle) * nextHeli.speed * delta * speedMultiplier;
            nextHeli.y += Math.sin(nextHeli.angle) * nextHeli.speed * delta * speedMultiplier;
          }
          
          // Descend
          nextHeli.altitude = Math.max(0, nextHeli.altitude - delta * 0.3);
          
          // Landed - remove helicopter
          if (nextHeli.altitude <= 0 && distToDest < 20) {
            continue;
          }
          break;
        }
        
        case 'hovering':
          // Not used currently - helicopters just fly direct
          break;
      }
      
      updatedHelicopters.push(nextHeli);
    }
    
    helicoptersRef.current = updatedHelicopters;
  }, [worldStateRef, gridVersionRef, cachedPopulationRef, helicoptersRef, helicopterIdRef, helicopterSpawnTimerRef, findHeliportsCallback, isMobile]);

  return {
    updateAirplanes,
    updateHelicopters,
    findAirportsCallback,
    findHeliportsCallback,
  };
}





