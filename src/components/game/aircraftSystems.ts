import { useCallback } from 'react';
import { Airplane, Helicopter, WorldRenderState, TILE_WIDTH, TILE_HEIGHT, PlaneType } from './types';
import {
  AIRPLANE_MIN_POPULATION,
  AIRPLANE_COLORS,
  CONTRAIL_MAX_AGE,
  CONTRAIL_SPAWN_INTERVAL,
  AIRPLANE_TAXI_SPEED,
  AIRPLANE_TAKEOFF_SPEED,
  AIRPLANE_FLIGHT_SPEED_MIN,
  AIRPLANE_FLIGHT_SPEED_MAX,
  AIRPLANE_SPAWN_INTERVAL_MIN,
  AIRPLANE_SPAWN_INTERVAL_MAX,
  AIRPLANE_PARKED_TIME_MIN,
  AIRPLANE_PARKED_TIME_MAX,
  AIRPLANE_TAXI_TIME_MIN,
  AIRPLANE_TAXI_TIME_MAX,
  AIRPLANE_FLIGHT_TIME_MIN,
  AIRPLANE_FLIGHT_TIME_MAX,
  MAX_AIRPLANES,
  MAX_PARKED_PLANES_PER_AIRPORT,
  AIRPLANE_MIN_ZOOM,
  HELICOPTER_MIN_POPULATION,
  HELICOPTER_COLORS,
  ROTOR_WASH_MAX_AGE,
  ROTOR_WASH_SPAWN_INTERVAL,
  PLANE_TYPES,
} from './constants';
import { gridToScreen } from './utils';
import { findAirports, findHeliports } from './gridFinders';

// Runway heading for takeoff (towards NE in isometric screen space)
// In screen coordinates: 0 = East, -PI/2 = North, so NE is approximately -PI/4
const RUNWAY_HEADING = -Math.PI / 4;

// Helper function to calculate airport screen positions
function getAirportPositions(airportTileX: number, airportTileY: number) {
  // Airport is 4x4 tiles
  const { screenX: originX, screenY: originY } = gridToScreen(airportTileX, airportTileY, 0, 0);
  
  // Center of the airport
  const centerX = originX + TILE_WIDTH * 2;
  const centerY = originY + TILE_HEIGHT * 2;
  
  // The runway runs diagonally from SW corner to NE corner (towards top-right in screen)
  // Runway start (SW end - for takeoff approach) - offset towards SW from center
  const runwayLength = TILE_WIDTH * 2.5; // Runway extends across most of the airport
  const runwayStartX = centerX - Math.cos(RUNWAY_HEADING) * runwayLength * 0.5;
  const runwayStartY = centerY - Math.sin(RUNWAY_HEADING) * runwayLength * 0.5;
  
  // Runway end (NE end - takeoff direction)
  const runwayEndX = centerX + Math.cos(RUNWAY_HEADING) * runwayLength * 0.5;
  const runwayEndY = centerY + Math.sin(RUNWAY_HEADING) * runwayLength * 0.5;
  
  return {
    centerX,
    centerY,
    runwayStartX,
    runwayStartY,
    runwayEndX,
    runwayEndY,
  };
}

// Helper function to get a random parking position within the airport
function getRandomParkPosition(airportTileX: number, airportTileY: number, parkIndex: number): { x: number; y: number } {
  const { screenX: originX, screenY: originY } = gridToScreen(airportTileX, airportTileY, 0, 0);
  
  // Parking positions are on the sides of the runway (terminal area)
  // Offset from center, perpendicular to runway
  const { centerX, centerY } = getAirportPositions(airportTileX, airportTileY);
  
  // Perpendicular to runway heading
  const perpAngle = RUNWAY_HEADING + Math.PI / 2;
  
  // Offset distance from runway (left or right side)
  const side = parkIndex % 2 === 0 ? 1 : -1;
  const lateralOffset = 30 + (parkIndex % 3) * 15; // Vary distance
  const longitudinalOffset = (parkIndex - 1.5) * 25; // Spread along runway length
  
  const parkX = centerX + 
    Math.cos(perpAngle) * lateralOffset * side +
    Math.cos(RUNWAY_HEADING) * longitudinalOffset;
  const parkY = centerY + 
    Math.sin(perpAngle) * lateralOffset * side +
    Math.sin(RUNWAY_HEADING) * longitudinalOffset;
  
  return { x: parkX, y: parkY };
}

// Check if a position is within airport bounds (approximate)
function isWithinAirportBounds(x: number, y: number, airportTileX: number, airportTileY: number): boolean {
  const { centerX, centerY } = getAirportPositions(airportTileX, airportTileY);
  const maxDist = TILE_WIDTH * 2.5; // Approximate airport radius
  return Math.hypot(x - centerX, y - centerY) < maxDist;
}

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

  // Update airplanes - spawn, move, and manage lifecycle with proper taxi and runway dynamics
  const updateAirplanes = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Clear airplanes if zoomed out too far
    if (currentZoom < AIRPLANE_MIN_ZOOM) {
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

    // Calculate max airplanes based on population and airports
    const populationBased = Math.floor(totalPopulation / 1500) * 2;
    const airportBased = airports.length * 15;
    const maxAirplanes = Math.min(MAX_AIRPLANES, Math.max(8, Math.min(populationBased, airportBased)));
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Count parked planes per airport
    const parkedPlanesPerAirport = new Map<string, number>();
    for (const plane of airplanesRef.current) {
      if (plane.state === 'parked') {
        const key = `${plane.airportX},${plane.airportY}`;
        parkedPlanesPerAirport.set(key, (parkedPlanesPerAirport.get(key) || 0) + 1);
      }
    }

    // Spawn timer
    airplaneSpawnTimerRef.current -= delta;
    if (airplanesRef.current.length < maxAirplanes && airplaneSpawnTimerRef.current <= 0) {
      // Pick a random airport
      const airport = airports[Math.floor(Math.random() * airports.length)];
      const airportKey = `${airport.x},${airport.y}`;
      const parkedCount = parkedPlanesPerAirport.get(airportKey) || 0;
      
      // Get airport positions
      const airportPos = getAirportPositions(airport.x, airport.y);
      
      // Decide spawn type: parked (new plane at gate), flying in, or arriving at runway
      // Prefer parked planes to ensure there are always planes visible at airport
      const spawnType = Math.random();
      
      if (spawnType < 0.5 && parkedCount < MAX_PARKED_PLANES_PER_AIRPORT) {
        // Spawn a parked plane at the airport gate
        const parkPos = getRandomParkPosition(airport.x, airport.y, parkedCount);
        const planeType = PLANE_TYPES[Math.floor(Math.random() * PLANE_TYPES.length)] as PlaneType;
        
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: parkPos.x,
          y: parkPos.y,
          angle: RUNWAY_HEADING + Math.PI, // Face away from runway initially
          targetAngle: RUNWAY_HEADING + Math.PI,
          state: 'parked',
          speed: 0,
          altitude: 0,
          targetAltitude: 0,
          airportX: airport.x,
          airportY: airport.y,
          airportScreenX: airportPos.centerX,
          airportScreenY: airportPos.centerY,
          runwayStartX: airportPos.runwayStartX,
          runwayStartY: airportPos.runwayStartY,
          runwayEndX: airportPos.runwayEndX,
          runwayEndY: airportPos.runwayEndY,
          runwayHeading: RUNWAY_HEADING,
          stateProgress: 0,
          contrail: [],
          lifeTime: AIRPLANE_PARKED_TIME_MIN + Math.random() * (AIRPLANE_PARKED_TIME_MAX - AIRPLANE_PARKED_TIME_MIN),
          taxiTime: AIRPLANE_TAXI_TIME_MIN + Math.random() * (AIRPLANE_TAXI_TIME_MAX - AIRPLANE_TAXI_TIME_MIN),
          parkPositionX: parkPos.x,
          parkPositionY: parkPos.y,
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
          planeType: planeType,
        });
      } else {
        // Spawn a plane flying in from off-screen
        const edge = Math.floor(Math.random() * 4);
        let startX: number, startY: number;
        
        // Calculate map bounds in screen space
        const mapCenterX = 0;
        const mapCenterY = currentGridSize * TILE_HEIGHT / 2;
        const mapExtent = currentGridSize * TILE_WIDTH;
        
        switch (edge) {
          case 0: // From top
            startX = mapCenterX + (Math.random() - 0.5) * mapExtent;
            startY = mapCenterY - mapExtent / 2 - 300;
            break;
          case 1: // From right
            startX = mapCenterX + mapExtent / 2 + 300;
            startY = mapCenterY + (Math.random() - 0.5) * mapExtent / 2;
            break;
          case 2: // From bottom
            startX = mapCenterX + (Math.random() - 0.5) * mapExtent;
            startY = mapCenterY + mapExtent / 2 + 300;
            break;
          default: // From left
            startX = mapCenterX - mapExtent / 2 - 300;
            startY = mapCenterY + (Math.random() - 0.5) * mapExtent / 2;
            break;
        }
        
        // Calculate angle to airport
        const angleToAirport = Math.atan2(airportPos.centerY - startY, airportPos.centerX - startX);
        const planeType = PLANE_TYPES[Math.floor(Math.random() * PLANE_TYPES.length)] as PlaneType;
        
        const parkPos = getRandomParkPosition(airport.x, airport.y, parkedCount);
        
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: startX,
          y: startY,
          angle: angleToAirport,
          targetAngle: angleToAirport,
          state: 'flying',
          speed: AIRPLANE_FLIGHT_SPEED_MIN + Math.random() * (AIRPLANE_FLIGHT_SPEED_MAX - AIRPLANE_FLIGHT_SPEED_MIN),
          altitude: 1,
          targetAltitude: 1,
          airportX: airport.x,
          airportY: airport.y,
          airportScreenX: airportPos.centerX,
          airportScreenY: airportPos.centerY,
          runwayStartX: airportPos.runwayStartX,
          runwayStartY: airportPos.runwayStartY,
          runwayEndX: airportPos.runwayEndX,
          runwayEndY: airportPos.runwayEndY,
          runwayHeading: RUNWAY_HEADING,
          stateProgress: 0,
          contrail: [],
          lifeTime: AIRPLANE_FLIGHT_TIME_MIN + Math.random() * (AIRPLANE_FLIGHT_TIME_MAX - AIRPLANE_FLIGHT_TIME_MIN),
          taxiTime: AIRPLANE_TAXI_TIME_MIN + Math.random() * (AIRPLANE_TAXI_TIME_MAX - AIRPLANE_TAXI_TIME_MIN),
          parkPositionX: parkPos.x,
          parkPositionY: parkPos.y,
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
          planeType: planeType,
        });
      }
      
      airplaneSpawnTimerRef.current = AIRPLANE_SPAWN_INTERVAL_MIN + Math.random() * (AIRPLANE_SPAWN_INTERVAL_MAX - AIRPLANE_SPAWN_INTERVAL_MIN);
    }

    // Update existing airplanes
    const updatedAirplanes: Airplane[] = [];
    
    for (const plane of airplanesRef.current) {
      // Update contrail particles - shorter duration on mobile for performance
      const contrailMaxAge = isMobile ? 0.8 : CONTRAIL_MAX_AGE;
      const contrailSpawnInterval = isMobile ? 0.06 : CONTRAIL_SPAWN_INTERVAL;
      plane.contrail = plane.contrail
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / contrailMaxAge) }))
        .filter(p => p.age < contrailMaxAge);
      
      // Add new contrail particles at high altitude (less frequent on mobile)
      if (plane.altitude > 0.7 && plane.state === 'flying') {
        plane.stateProgress += delta;
        if (plane.stateProgress >= contrailSpawnInterval) {
          plane.stateProgress -= contrailSpawnInterval;
          // Single centered contrail particle - offset behind plane and down
          const behindOffset = 40; // Distance behind the plane
          const downOffset = 8; // Vertical offset down
          const contrailX = plane.x - Math.cos(plane.angle) * behindOffset;
          const contrailY = plane.y - Math.sin(plane.angle) * behindOffset + downOffset;
          plane.contrail.push({ x: contrailX, y: contrailY, age: 0, opacity: 1 });
        }
      }
      
      // Helper function for smooth angle turning
      const smoothTurn = (currentAngle: number, targetAngle: number, maxTurnRate: number): number => {
        let diff = targetAngle - currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turnAmount = Math.max(-maxTurnRate, Math.min(maxTurnRate, diff));
        return currentAngle + turnAmount;
      };
      
      // Update based on state
      switch (plane.state) {
        case 'parked': {
          // Wait at gate before taxiing
          plane.lifeTime -= delta;
          
          if (plane.lifeTime <= 0) {
            // Start taxiing to runway
            plane.state = 'taxiing_to_runway';
            plane.speed = AIRPLANE_TAXI_SPEED;
            plane.taxiTime = AIRPLANE_TAXI_TIME_MIN + Math.random() * (AIRPLANE_TAXI_TIME_MAX - AIRPLANE_TAXI_TIME_MIN);
            
            // Set target angle towards runway start
            plane.targetAngle = Math.atan2(plane.runwayStartY - plane.y, plane.runwayStartX - plane.x);
          }
          break;
        }
        
        case 'taxiing_to_runway': {
          // Taxi from gate to runway start
          plane.taxiTime -= delta;
          
          // Turn towards target
          const taxiTurnRate = Math.PI * delta * 1.5; // Slow turn rate for taxiing
          plane.angle = smoothTurn(plane.angle, plane.targetAngle, taxiTurnRate);
          
          // Move forward at taxi speed
          const nextX = plane.x + Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          const nextY = plane.y + Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          
          // Keep within airport bounds during taxi
          if (isWithinAirportBounds(nextX, nextY, plane.airportX, plane.airportY)) {
            plane.x = nextX;
            plane.y = nextY;
          } else {
            // Turn towards airport center
            plane.targetAngle = Math.atan2(plane.airportScreenY - plane.y, plane.airportScreenX - plane.x);
          }
          
          // Check if near runway start
          const distToRunwayStart = Math.hypot(plane.x - plane.runwayStartX, plane.y - plane.runwayStartY);
          
          // Update target to runway start
          plane.targetAngle = Math.atan2(plane.runwayStartY - plane.y, plane.runwayStartX - plane.x);
          
          // If near runway start or taxi time expired, start aligning for takeoff
          if (distToRunwayStart < 20 || plane.taxiTime <= 0) {
            // Move to runway start and align with runway heading
            plane.x = plane.runwayStartX;
            plane.y = plane.runwayStartY;
            plane.targetAngle = plane.runwayHeading;
            plane.angle = plane.runwayHeading;
            plane.state = 'taking_off';
            plane.speed = AIRPLANE_TAXI_SPEED;
          }
          break;
        }
        
        case 'taking_off': {
          // Accelerate down runway and climb
          // Ensure facing runway heading
          const takeoffTurnRate = Math.PI * delta * 0.5;
          plane.angle = smoothTurn(plane.angle, plane.runwayHeading, takeoffTurnRate);
          
          // Accelerate
          plane.speed = Math.min(AIRPLANE_FLIGHT_SPEED_MAX, plane.speed + delta * 60);
          
          // Move forward
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          
          // Start climbing after reaching takeoff speed
          if (plane.speed > AIRPLANE_TAKEOFF_SPEED) {
            plane.altitude = Math.min(1, plane.altitude + delta * 0.35);
          }
          
          // Transition to flying when at cruising altitude
          if (plane.altitude >= 1) {
            plane.state = 'flying';
            plane.lifeTime = AIRPLANE_FLIGHT_TIME_MIN + Math.random() * (AIRPLANE_FLIGHT_TIME_MAX - AIRPLANE_FLIGHT_TIME_MIN);
            plane.speed = AIRPLANE_FLIGHT_SPEED_MIN + Math.random() * (AIRPLANE_FLIGHT_SPEED_MAX - AIRPLANE_FLIGHT_SPEED_MIN);
          }
          break;
        }
        
        case 'flying': {
          // Move forward at cruising speed
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          
          plane.lifeTime -= delta;
          
          // Gentle course corrections for visual interest
          if (Math.random() < 0.008) {
            plane.targetAngle = plane.angle + (Math.random() - 0.5) * 0.3;
          }
          const flyingTurnRate = Math.PI * delta * 0.3;
          plane.angle = smoothTurn(plane.angle, plane.targetAngle, flyingTurnRate);
          
          // Calculate distance to airport
          const distToAirport = Math.hypot(plane.x - plane.airportScreenX, plane.y - plane.airportScreenY);
          
          // Start landing approach when lifetime is low
          if (plane.lifeTime <= 8) {
            // Turn towards the runway approach (come in from opposite of runway heading)
            // Approach from SW, land towards NE
            const approachAngle = plane.runwayHeading + Math.PI; // Opposite of takeoff direction
            
            // Calculate approach point (extend behind runway start)
            const approachDist = 250;
            const approachPointX = plane.runwayStartX + Math.cos(approachAngle) * approachDist;
            const approachPointY = plane.runwayStartY + Math.sin(approachAngle) * approachDist;
            
            // Target the approach point first
            const angleToApproach = Math.atan2(approachPointY - plane.y, approachPointX - plane.x);
            plane.targetAngle = angleToApproach;
            
            const distToApproach = Math.hypot(plane.x - approachPointX, plane.y - approachPointY);
            
            // If close to approach point, start final approach
            if (distToApproach < 150 || plane.lifeTime <= 3) {
              plane.state = 'landing';
              plane.targetAltitude = 0;
              // Align with runway
              plane.targetAngle = plane.runwayHeading;
            }
          } else if (plane.lifeTime <= 0) {
            // Despawn if out of time and far from airport
            if (distToAirport > 500) {
              continue;
            }
          }
          break;
        }
        
        case 'landing': {
          // Approach runway and descend
          // Target the runway start point
          const angleToRunway = Math.atan2(plane.runwayStartY - plane.y, plane.runwayStartX - plane.x);
          
          // Gradually align with runway heading while descending
          const landingTurnRate = Math.PI * delta * 0.8;
          
          // If far from runway, aim at it; if close, align with runway heading
          const distToRunwayStart = Math.hypot(plane.x - plane.runwayStartX, plane.y - plane.runwayStartY);
          if (distToRunwayStart > 100) {
            plane.targetAngle = angleToRunway;
          } else {
            plane.targetAngle = plane.runwayHeading;
          }
          plane.angle = smoothTurn(plane.angle, plane.targetAngle, landingTurnRate);
          
          // Slow down on approach
          plane.speed = Math.max(AIRPLANE_TAXI_SPEED + 20, plane.speed - delta * 25);
          
          // Descend
          const descentRate = distToRunwayStart > 200 ? 0.2 : 0.35;
          plane.altitude = Math.max(0, plane.altitude - delta * descentRate);
          
          // Move forward
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          
          // Touchdown when very low and on/near runway
          if (plane.altitude <= 0.05 && distToRunwayStart < 80) {
            plane.altitude = 0;
            plane.state = 'taxiing_to_gate';
            plane.speed = AIRPLANE_TAXI_SPEED;
            plane.taxiTime = AIRPLANE_TAXI_TIME_MIN + Math.random() * (AIRPLANE_TAXI_TIME_MAX - AIRPLANE_TAXI_TIME_MIN);
            // Target a parking position
            const parkPos = getRandomParkPosition(plane.airportX, plane.airportY, Math.floor(Math.random() * 3));
            plane.parkPositionX = parkPos.x;
            plane.parkPositionY = parkPos.y;
          }
          break;
        }
        
        case 'taxiing_to_gate': {
          // Taxi from runway to gate, then despawn
          plane.taxiTime -= delta;
          
          // Slow down more
          plane.speed = Math.max(AIRPLANE_TAXI_SPEED * 0.8, plane.speed - delta * 15);
          
          // Turn towards parking position
          const angleToPark = Math.atan2(plane.parkPositionY - plane.y, plane.parkPositionX - plane.x);
          plane.targetAngle = angleToPark;
          const taxiTurnRate = Math.PI * delta * 1.5;
          plane.angle = smoothTurn(plane.angle, plane.targetAngle, taxiTurnRate);
          
          // Move forward
          const nextX = plane.x + Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          const nextY = plane.y + Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          
          // Keep within airport bounds
          if (isWithinAirportBounds(nextX, nextY, plane.airportX, plane.airportY)) {
            plane.x = nextX;
            plane.y = nextY;
          }
          
          // Check if reached gate
          const distToPark = Math.hypot(plane.x - plane.parkPositionX, plane.y - plane.parkPositionY);
          if (distToPark < 15 || plane.taxiTime <= 0) {
            // Arrived at gate - despawn (or could become parked again)
            continue;
          }
          break;
        }
      }
      
      updatedAirplanes.push(plane);
    }
    
    airplanesRef.current = updatedAirplanes;
  }, [worldStateRef, gridVersionRef, cachedPopulationRef, airplanesRef, airplaneIdRef, airplaneSpawnTimerRef, findAirportsCallback, isMobile]);

  // Update helicopters - spawn, move between hospitals/airports, and manage lifecycle
  const updateHelicopters = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
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
      // Update rotor animation
      heli.rotorAngle += delta * 25; // Fast rotor spin
      
      // Update searchlight sweep animation (sinusoidal motion)
      heli.searchlightAngle += delta * heli.searchlightSweepSpeed;
      // Update base angle to follow helicopter direction for more natural sweep
      heli.searchlightBaseAngle = heli.angle + Math.PI / 2;
      
      // Update rotor wash particles - shorter duration on mobile
      const washMaxAge = isMobile ? 0.4 : ROTOR_WASH_MAX_AGE;
      const washSpawnInterval = isMobile ? 0.08 : ROTOR_WASH_SPAWN_INTERVAL;
      heli.rotorWash = heli.rotorWash
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / washMaxAge) }))
        .filter(p => p.age < washMaxAge);
      
      // Add new rotor wash particles when flying
      if (heli.altitude > 0.2 && heli.state === 'flying') {
        heli.stateProgress += delta;
        if (heli.stateProgress >= washSpawnInterval) {
          heli.stateProgress -= washSpawnInterval;
          // Single small rotor wash particle behind helicopter
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
      
      // Update based on state
      switch (heli.state) {
        case 'taking_off': {
          // Rise vertically first, then start moving
          heli.altitude = Math.min(0.5, heli.altitude + delta * 0.4);
          heli.speed = Math.min(50, heli.speed + delta * 15);
          
          // Start moving once at cruising altitude
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
          // Move toward destination
          heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier;
          heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier;
          
          // Check if near destination
          const distToDest = Math.hypot(heli.x - heli.destScreenX, heli.y - heli.destScreenY);
          
          if (distToDest < 80) {
            heli.state = 'landing';
            heli.targetAltitude = 0;
          }
          break;
        }
        
        case 'landing': {
          // Approach destination and descend
          const distToDest = Math.hypot(heli.x - heli.destScreenX, heli.y - heli.destScreenY);
          
          // Slow down as we get closer
          heli.speed = Math.max(10, heli.speed - delta * 20);
          
          // Keep moving toward destination if not there yet
          if (distToDest > 15) {
            const angleToDestination = Math.atan2(heli.destScreenY - heli.y, heli.destScreenX - heli.x);
            heli.angle = angleToDestination;
            heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier;
            heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier;
          }
          
          // Descend
          heli.altitude = Math.max(0, heli.altitude - delta * 0.3);
          
          // Landed - remove helicopter
          if (heli.altitude <= 0 && distToDest < 20) {
            continue;
          }
          break;
        }
        
        case 'hovering':
          // Not used currently - helicopters just fly direct
          break;
      }
      
      updatedHelicopters.push(heli);
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





