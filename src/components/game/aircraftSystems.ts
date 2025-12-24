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
} from './constants';
import { gridToScreen } from './utils';
import { findAirports, findHeliports } from './gridFinders';

// -----------------------------------------------------------------------------
// Airplane runway dynamics helpers
// -----------------------------------------------------------------------------
const AIRPORT_FOOTPRINT_TILES = 4; // Matches simulation footprint (multi-tile building)
// Runway is aligned toward the top-right of the screen (NE) in the airport asset.
const RUNWAY_HEADING_NE = -Math.PI / 4; // -45° (screen-space)

const RUNWAY_HALF_LENGTH = TILE_WIDTH * 2.3; // Tuned for the airport sprite footprint
const RUNWAY_LATERAL_OFFSET = TILE_WIDTH * 0.9; // Shifts runway rightward (terminal is on the left)
const GATE_LATERAL_OFFSET = TILE_WIDTH * 1.2; // Gate/apron area offset (left of runway)

const TAXI_SPEED = 22;
const LINEUP_SPEED = 14;
const TAKEOFF_ROTATE_SPEED = 95;
const TAKEOFF_TARGET_SPEED = 140;
const APPROACH_SPEED = 92;
const TOUCHDOWN_SPEED = 72;
const TAXI_OFF_SPEED = 18;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function normalizeAngle(a: number) {
  let out = a % (Math.PI * 2);
  if (out < 0) out += Math.PI * 2;
  return out;
}

function shortestAngleDelta(from: number, to: number) {
  let d = normalizeAngle(to) - normalizeAngle(from);
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function turnToward(current: number, target: number, maxTurnRateRadPerSec: number, delta: number) {
  const d = shortestAngleDelta(current, target);
  const maxStep = maxTurnRateRadPerSec * delta;
  return current + Math.max(-maxStep, Math.min(maxStep, d));
}

function tileCenterToScreen(tileX: number, tileY: number) {
  // gridToScreen returns a tile's bounding-box top-left. We want the tile center.
  // Supports fractional coordinates for smooth footprint-centric anchoring.
  const screenX = (tileX - tileY) * (TILE_WIDTH / 2);
  const screenY = (tileX + tileY) * (TILE_HEIGHT / 2);
  return { x: screenX + TILE_WIDTH / 2, y: screenY + TILE_HEIGHT / 2 };
}

function dot(ax: number, ay: number, bx: number, by: number) {
  return ax * bx + ay * by;
}

function getAirportRunway(airportX: number, airportY: number) {
  // Footprint center in tile space (even-sized footprints center between tiles)
  const centerTile = (AIRPORT_FOOTPRINT_TILES - 1) / 2; // 1.5 for 4x4
  const airportCenter = tileCenterToScreen(airportX + centerTile, airportY + centerTile);

  const ux = Math.cos(RUNWAY_HEADING_NE);
  const uy = Math.sin(RUNWAY_HEADING_NE);
  // Perp vector (points SE for a NE runway)
  const vx = -uy;
  const vy = ux;

  // Runway is on the right side of the sprite (terminal on left), so shift toward +v.
  const runwayCenterX = airportCenter.x + vx * RUNWAY_LATERAL_OFFSET;
  const runwayCenterY = airportCenter.y + vy * RUNWAY_LATERAL_OFFSET;

  const startX = runwayCenterX - ux * RUNWAY_HALF_LENGTH; // SW end
  const startY = runwayCenterY - uy * RUNWAY_HALF_LENGTH;
  const endX = runwayCenterX + ux * RUNWAY_HALF_LENGTH; // NE end
  const endY = runwayCenterY + uy * RUNWAY_HALF_LENGTH;

  // Approximate gate/apron area on the left side of the airport.
  const gateX = airportCenter.x - vx * GATE_LATERAL_OFFSET - ux * (TILE_WIDTH * 0.3);
  const gateY = airportCenter.y - vy * GATE_LATERAL_OFFSET - uy * (TILE_WIDTH * 0.3);

  return {
    airportCenter,
    runway: {
      headingNE: RUNWAY_HEADING_NE,
      ux,
      uy,
      vx,
      vy,
      centerX: runwayCenterX,
      centerY: runwayCenterY,
      startX,
      startY,
      endX,
      endY,
    },
    gate: { x: gateX, y: gateY },
  };
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

  // Update airplanes - spawn, move, and manage lifecycle
  const updateAirplanes = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
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

      const { runway, gate } = getAirportRunway(airport.x, airport.y);
      
      // Decide if taking off or arriving from distance
      const isTakingOff = Math.random() < 0.5;
      
      if (isTakingOff) {
        // Departures taxi to runway, line up, then take off NE (aligned with runway).
        const angle = RUNWAY_HEADING_NE;
        const planeType = PLANE_TYPES[Math.floor(Math.random() * PLANE_TYPES.length)] as PlaneType;
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: gate.x,
          y: gate.y,
          angle: angle,
          state: 'taxi_to_runway',
          speed: TAXI_SPEED * (0.85 + Math.random() * 0.3),
          altitude: 0,
          targetAltitude: 1,
          airportX: airport.x,
          airportY: airport.y,
          stateProgress: 0,
          contrail: [],
          lifeTime: 35 + Math.random() * 25, // 35-60 seconds including climb-out + cruise
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
          planeType: planeType,
        });
      } else {
        // Arrivals spawn on extended runway centerline and fly a stabilized approach.
        // Approach comes from the NE end and lands toward SW.
        const landingHeading = RUNWAY_HEADING_NE + Math.PI;
        const forwardX = Math.cos(landingHeading);
        const forwardY = Math.sin(landingHeading);
        // Spawn beyond the NE threshold with some crosswind offset.
        const crossOffset = (Math.random() - 0.5) * TILE_WIDTH * 2.2;
        const startX = runway.endX - forwardX * (TILE_WIDTH * 18) + runway.vx * crossOffset;
        const startY = runway.endY - forwardY * (TILE_WIDTH * 18) + runway.vy * crossOffset;

        const planeType = PLANE_TYPES[Math.floor(Math.random() * PLANE_TYPES.length)] as PlaneType;
        
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: startX,
          y: startY,
          angle: landingHeading,
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
      // Update contrail particles - shorter duration on mobile for performance
      const contrailMaxAge = isMobile ? 0.8 : CONTRAIL_MAX_AGE;
      const contrailSpawnInterval = isMobile ? 0.06 : CONTRAIL_SPAWN_INTERVAL;
      plane.contrail = plane.contrail
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / contrailMaxAge) }))
        .filter(p => p.age < contrailMaxAge);
      
      // Add new contrail particles at high altitude (less frequent on mobile)
      if (plane.altitude > 0.7) {
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
      
      // Update based on state
      switch (plane.state) {
        case 'taxi_to_runway': {
          const { runway, gate } = getAirportRunway(plane.airportX, plane.airportY);
          // Head toward the SW threshold (hold short just behind runway start).
          const holdX = runway.startX - runway.ux * (TILE_WIDTH * 0.45);
          const holdY = runway.startY - runway.uy * (TILE_WIDTH * 0.45);

          const dx = holdX - plane.x;
          const dy = holdY - plane.y;
          const dist = Math.hypot(dx, dy);
          const desiredAngle = Math.atan2(dy, dx);
          plane.angle = turnToward(plane.angle, desiredAngle, 2.6, delta);
          plane.speed = clamp(plane.speed + delta * 25, 0, TAXI_SPEED);
          plane.altitude = 0;

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          // If we overshot the gate far away (e.g., due to camera/time), reset toward gate.
          if (dist > TILE_WIDTH * 30) {
            plane.x = gate.x;
            plane.y = gate.y;
          }

          if (dist < 18) {
            plane.state = 'lineup';
            plane.stateProgress = 0;
          }
          break;
        }

        case 'lineup': {
          const { runway } = getAirportRunway(plane.airportX, plane.airportY);

          const dx = runway.startX - plane.x;
          const dy = runway.startY - plane.y;
          const dist = Math.hypot(dx, dy);

          // Align to runway heading (NE) and creep onto centerline
          const desiredAngle = RUNWAY_HEADING_NE;
          plane.angle = turnToward(plane.angle, desiredAngle, 2.2, delta);
          plane.speed = clamp(plane.speed - delta * 12, 0, LINEUP_SPEED);
          plane.altitude = 0;

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          const angleErr = Math.abs(shortestAngleDelta(plane.angle, desiredAngle));
          if (dist < 14 && angleErr < 0.22) {
            plane.state = 'takeoff_roll';
            plane.speed = Math.max(plane.speed, LINEUP_SPEED);
            plane.stateProgress = 0;
          }
          break;
        }

        case 'takeoff_roll': {
          const { runway } = getAirportRunway(plane.airportX, plane.airportY);

          // Centerline correction in screen space (simple cross-track damping).
          const rx = plane.x - runway.centerX;
          const ry = plane.y - runway.centerY;
          const cross = dot(rx, ry, runway.vx, runway.vy);
          const desiredVecX = runway.ux + runway.vx * (-cross * 0.008);
          const desiredVecY = runway.uy + runway.vy * (-cross * 0.008);
          const desiredAngle = Math.atan2(desiredVecY, desiredVecX);
          plane.angle = turnToward(plane.angle, desiredAngle, 2.0, delta);

          // Accelerate
          plane.speed = clamp(plane.speed + delta * 70, 0, TAKEOFF_TARGET_SPEED);
          plane.altitude = 0;

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          // Rotate and lift off near the last third of the runway.
          const along = dot(rx, ry, runway.ux, runway.uy);
          const liftReady = along > RUNWAY_HALF_LENGTH * 0.55 && plane.speed >= TAKEOFF_ROTATE_SPEED;
          if (liftReady) {
            plane.state = 'climb_out';
            plane.stateProgress = 0;
            plane.targetAltitude = 1;
          }
          break;
        }

        case 'climb_out': {
          const { runway } = getAirportRunway(plane.airportX, plane.airportY);
          plane.stateProgress += delta;

          // Keep runway heading for initial climb, then gently diverge.
          const desiredAngle = runway.headingNE + Math.sin(plane.id * 17.31) * 0.08;
          plane.angle = turnToward(plane.angle, desiredAngle, 1.4, delta);

          plane.speed = clamp(plane.speed + delta * 18, TAKEOFF_ROTATE_SPEED, 160);
          plane.altitude = clamp(plane.altitude + delta * 0.55, 0, 1);

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          if (plane.altitude >= 1 && plane.stateProgress > 1.2) {
            plane.state = 'flying';
            // Small random drift away from runway heading for variety
            plane.angle = normalizeAngle(plane.angle + (Math.random() - 0.5) * 0.6);
          }
          break;
        }

        case 'flying': {
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          plane.lifeTime -= delta;

          const { airportCenter, runway } = getAirportRunway(plane.airportX, plane.airportY);
          const distToAirport = Math.hypot(plane.x - airportCenter.x, plane.y - airportCenter.y);

          // Start approach when close enough and running out of cruise time.
          if (distToAirport < 900 && plane.lifeTime < 12) {
            plane.state = 'approach';
            plane.targetAltitude = 0;
            // Bias to a stabilized approach heading (toward SW, landing from NE end)
            plane.angle = RUNWAY_HEADING_NE + Math.PI;
            // Slow down toward approach speed
            plane.speed = Math.max(plane.speed, APPROACH_SPEED);
            // Start descending early
            plane.altitude = Math.min(plane.altitude, 0.95);
          } else if (plane.lifeTime <= 0) {
            // Despawn if out of time and not on an approach
            continue;
          }

          // Cap cruise speed gently
          plane.speed = clamp(plane.speed + delta * 8, 90, 150);
          plane.altitude = clamp(plane.altitude + delta * 0.08, 0.85, 1);
          break;
        }

        case 'approach': {
          const { runway } = getAirportRunway(plane.airportX, plane.airportY);
          const landingHeading = runway.headingNE + Math.PI; // toward SW (opposite the runway NE heading)
          const forwardX = Math.cos(landingHeading);
          const forwardY = Math.sin(landingHeading);

          // Touchdown point is just past the NE threshold, then rollout toward SW.
          const touchdownX = runway.endX - runway.ux * (TILE_WIDTH * 0.65);
          const touchdownY = runway.endY - runway.uy * (TILE_WIDTH * 0.65);

          const toTdX = touchdownX - plane.x;
          const toTdY = touchdownY - plane.y;
          const distToTd = Math.hypot(toTdX, toTdY);

          // Cross-track error relative to runway centerline.
          const rx = plane.x - runway.centerX;
          const ry = plane.y - runway.centerY;
          const cross = dot(rx, ry, runway.vx, runway.vy);

          // Desired velocity: mostly forward, with a lateral component to damp cross-track.
          const desiredVecX = forwardX + runway.vx * (-cross * 0.007);
          const desiredVecY = forwardY + runway.vy * (-cross * 0.007);
          const desiredAngle = Math.atan2(desiredVecY, desiredVecX);
          plane.angle = turnToward(plane.angle, desiredAngle, 1.6, delta);

          // Speed management (stable approach)
          const targetSpeed = distToTd < 260 ? TOUCHDOWN_SPEED : APPROACH_SPEED;
          plane.speed += (targetSpeed - plane.speed) * clamp(delta * 1.6, 0, 1);
          plane.speed = clamp(plane.speed, TOUCHDOWN_SPEED, 140);

          // Glidepath: altitude decreases as we approach touchdown.
          const glideDist = 520;
          const targetAlt = clamp(distToTd / glideDist, 0, 1);
          plane.altitude += (targetAlt - plane.altitude) * clamp(delta * 1.5, 0, 1);
          plane.altitude = clamp(plane.altitude, 0, 1);

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          if (distToTd < 70 && plane.altitude < 0.2) {
            plane.state = 'flare';
            plane.stateProgress = 0;
          }
          break;
        }

        case 'flare': {
          const { runway } = getAirportRunway(plane.airportX, plane.airportY);
          const landingHeading = runway.headingNE + Math.PI;
          const forwardX = Math.cos(landingHeading);
          const forwardY = Math.sin(landingHeading);

          plane.stateProgress += delta;

          // Keep aligned with runway during flare.
          plane.angle = turnToward(plane.angle, landingHeading, 1.9, delta);

          // Gentle decel and reduced descent rate.
          plane.speed = Math.max(TOUCHDOWN_SPEED * 0.85, plane.speed - delta * 22);
          plane.altitude = Math.max(0, plane.altitude - delta * 0.14);

          plane.x += forwardX * plane.speed * delta * speedMultiplier;
          plane.y += forwardY * plane.speed * delta * speedMultiplier;

          if (plane.altitude <= 0.06 || plane.stateProgress > 0.9) {
            plane.state = 'rollout';
            plane.altitude = 0;
            plane.angle = landingHeading;
            plane.speed = Math.max(plane.speed, TOUCHDOWN_SPEED * 0.8);
            plane.stateProgress = 0;
          }
          break;
        }

        case 'rollout': {
          const { runway } = getAirportRunway(plane.airportX, plane.airportY);
          const landingHeading = runway.headingNE + Math.PI;

          // Keep on runway centerline.
          const rx = plane.x - runway.centerX;
          const ry = plane.y - runway.centerY;
          const cross = dot(rx, ry, runway.vx, runway.vy);
          const desiredVecX = Math.cos(landingHeading) + runway.vx * (-cross * 0.01);
          const desiredVecY = Math.sin(landingHeading) + runway.vy * (-cross * 0.01);
          const desiredAngle = Math.atan2(desiredVecY, desiredVecX);
          plane.angle = turnToward(plane.angle, desiredAngle, 2.2, delta);

          // Decelerate on the runway.
          plane.speed = Math.max(TAXI_OFF_SPEED, plane.speed - delta * 42);
          plane.altitude = 0;

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          const distToRunwayStart = Math.hypot(plane.x - runway.startX, plane.y - runway.startY);
          if (plane.speed <= TAXI_OFF_SPEED + 1 || distToRunwayStart < 55) {
            plane.state = 'taxi_to_gate';
            plane.stateProgress = 0;
            plane.speed = Math.min(plane.speed, TAXI_OFF_SPEED);
          }
          break;
        }

        case 'taxi_to_gate': {
          const { gate } = getAirportRunway(plane.airportX, plane.airportY);
          const dx = gate.x - plane.x;
          const dy = gate.y - plane.y;
          const dist = Math.hypot(dx, dy);

          const desiredAngle = Math.atan2(dy, dx);
          plane.angle = turnToward(plane.angle, desiredAngle, 2.8, delta);

          // Taxi speed control (slow as we approach gate)
          const targetSpeed = dist < 80 ? 10 : TAXI_OFF_SPEED;
          plane.speed += (targetSpeed - plane.speed) * clamp(delta * 2.0, 0, 1);
          plane.speed = clamp(plane.speed, 0, TAXI_OFF_SPEED);
          plane.altitude = 0;

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          // Parked at gate - remove plane.
          if (dist < 18 && plane.speed < 5) {
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





