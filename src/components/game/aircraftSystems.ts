import { useCallback } from 'react';
import { Airplane, Helicopter, WorldRenderState, TILE_WIDTH, TILE_HEIGHT, PlaneType } from './types';
import {
  AIRPLANE_MIN_POPULATION,
  AIRPLANE_COLORS,
  CONTRAIL_MAX_AGE,
  CONTRAIL_SPAWN_INTERVAL,
  GROUND_TRAIL_MAX_AGE,
  GROUND_TRAIL_SPAWN_INTERVAL,
  HELICOPTER_MIN_POPULATION,
  HELICOPTER_COLORS,
  ROTOR_WASH_MAX_AGE,
  ROTOR_WASH_SPAWN_INTERVAL,
  PLANE_TYPES,
} from './constants';
import { gridToScreen } from './utils';
import { findAirports, findHeliports } from './gridFinders';
import { getBuildingSize, getRoadAdjacency, requiresWaterAdjacency } from '@/lib/simulation';

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

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const normalizeAngle = (angle: number) => {
      let a = angle % (Math.PI * 2);
      if (a < 0) a += Math.PI * 2;
      return a;
    };
    const lerpAngle = (from: number, to: number, t: number) => {
      let diff = to - from;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return normalizeAngle(from + diff * t);
    };
    const clampAngleDelta = (from: number, to: number, maxDelta: number) => {
      let diff = to - from;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return clamp(diff, -maxDelta, maxDelta);
    };
    const tileCenter = (gx: number, gy: number) => {
      const { screenX, screenY } = gridToScreen(gx, gy, 0, 0);
      return { x: screenX + TILE_WIDTH / 2, y: screenY + TILE_HEIGHT / 2 };
    };
    const vecLen = (x: number, y: number) => Math.hypot(x, y);
    const vecNorm = (x: number, y: number) => {
      const l = Math.hypot(x, y) || 1;
      return { x: x / l, y: y / l };
    };
    const dot = (ax: number, ay: number, bx: number, by: number) => ax * bx + ay * by;

    const computeAirportGeometry = (airportX: number, airportY: number) => {
      const size = getBuildingSize('airport');
      const tile = currentGrid[airportY]?.[airportX];
      if (!tile) return null;

      // Match the render-time flip logic in CanvasIsometricGrid.tsx
      const defaultMirroredBuildings: string[] = [];
      const isDefaultMirrored = defaultMirroredBuildings.includes('airport');
      const isWaterfrontAsset = requiresWaterAdjacency('airport');
      const shouldRoadMirror = (() => {
        if (isWaterfrontAsset) return false;
        const roadCheck = getRoadAdjacency(currentGrid, airportX, airportY, size.width, size.height, currentGridSize);
        if (roadCheck.hasRoad) return roadCheck.shouldFlip;
        const mirrorSeed = (airportX * 47 + airportY * 83) % 100;
        return mirrorSeed < 50;
      })();
      const baseFlipped = isDefaultMirrored ? !tile.building.flipped : tile.building.flipped === true;
      const isFlipped = baseFlipped !== shouldRoadMirror; // XOR

      // Runway is drawn along the top-right (east) diagonal in the default asset.
      // When the sprite is horizontally mirrored, the runway aligns to the top-left (north) diagonal.
      if (!isFlipped) {
        // Default: runway centerline along grid "east" (y axis / left-most column).
        const runwayXOffset = 0; // left-most column of the 4x4 footprint
        const runwayA = tileCenter(airportX + runwayXOffset, airportY + size.height - 1); // "south" end
        const runwayB = tileCenter(airportX + runwayXOffset, airportY); // "north" end

        // Keep taxi points INSIDE the footprint
        const apronMid = tileCenter(airportX + 2, airportY + 2);
        const holdShortA = tileCenter(airportX + 1, airportY + 2); // near runwayA
        const holdShortB = tileCenter(airportX + 1, airportY + 1); // near runwayB
        const gate = tileCenter(airportX + size.width - 1, airportY + 1);

        return { runwayA, runwayB, gate, apronMid, holdShortA, holdShortB };
      }

      // Flipped: runway centerline along grid "north" (x axis, decreasing x visually).
      const runwayYOffset = 0; // top-most row of the 4x4 footprint
      const runwayA = tileCenter(airportX + size.width - 1, airportY + runwayYOffset); // "east" end
      const runwayB = tileCenter(airportX, airportY + runwayYOffset); // "west" end

      // Keep taxi points INSIDE the footprint
      const apronMid = tileCenter(airportX + 2, airportY + 2);
      const holdShortA = tileCenter(airportX + 2, airportY + 1); // near runwayA
      const holdShortB = tileCenter(airportX + 1, airportY + 1); // near runwayB
      const gate = tileCenter(airportX + 1, airportY + size.height - 1);

      return { runwayA, runwayB, gate, apronMid, holdShortA, holdShortB };
    };

    const buildTaxiOutPath = (
      geom: NonNullable<ReturnType<typeof computeAirportGeometry>>,
      runwayStart: { x: number; y: number }
    ) => {
      const distToA = Math.hypot(runwayStart.x - geom.runwayA.x, runwayStart.y - geom.runwayA.y);
      const distToB = Math.hypot(runwayStart.x - geom.runwayB.x, runwayStart.y - geom.runwayB.y);
      const holdShort = distToA <= distToB ? geom.holdShortA : geom.holdShortB;
      return [geom.gate, geom.apronMid, holdShort, runwayStart];
    };

    const buildTaxiInPath = (
      geom: NonNullable<ReturnType<typeof computeAirportGeometry>>,
      runwayExit: { x: number; y: number }
    ) => {
      // Simple, footprint-safe taxi path back to the gate.
      // (Avoids any perpendicular "hold" points that can drift outside the airport bounds.)
      return [runwayExit, geom.apronMid, geom.gate];
    };

    const steerAndMoveToward = (plane: Airplane, target: { x: number; y: number }, maxTurnRate: number, maxSpeed: number, accel: number) => {
      const dx = target.x - plane.x;
      const dy = target.y - plane.y;
      const desired = Math.atan2(dy, dx);
      const turn = clampAngleDelta(plane.angle, desired, maxTurnRate * delta * speedMultiplier);
      plane.angle = normalizeAngle(plane.angle + turn);
      plane.speed = Math.min(maxSpeed, plane.speed + accel * delta * speedMultiplier);
      plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
      plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
    };

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
      
      // Decide if taking off or arriving from distance
      const isTakingOff = Math.random() < 0.5;
      
      if (isTakingOff) {
        // Taxi out + runway-aligned takeoff from the airport
        const geom = computeAirportGeometry(airport.x, airport.y);
        if (!geom) {
          airplaneSpawnTimerRef.current = 2 + Math.random() * 5;
          return;
        }

        const { runwayA, runwayB, gate } = geom;
        const useAB = Math.random() < 0.5;
        const runwayStart = useAB ? runwayA : runwayB;
        const runwayEnd = useAB ? runwayB : runwayA;
        const taxiPath = buildTaxiOutPath(geom, runwayStart);
        const initialAngle = Math.atan2(taxiPath[1].y - gate.y, taxiPath[1].x - gate.x);

        const planeType = PLANE_TYPES[Math.floor(Math.random() * PLANE_TYPES.length)] as PlaneType;
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: gate.x,
          y: gate.y,
          angle: initialAngle,
          state: 'taxi_out',
          speed: 0,
          altitude: 0,
          targetAltitude: 1,
          airportX: airport.x,
          airportY: airport.y,
          stateProgress: 0,
          contrail: [],
          groundTrail: [],
          groundTrailSpawnProgress: 0,
          lifeTime: 30 + Math.random() * 20, // 30-50 seconds of flight
          phaseTime: 0,
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
          planeType: planeType,
          runwayStartX: runwayStart.x,
          runwayStartY: runwayStart.y,
          runwayEndX: runwayEnd.x,
          runwayEndY: runwayEnd.y,
          gateX: gate.x,
          gateY: gate.y,
          taxiPath,
          taxiPathIndex: 1,
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
        const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(airport.x, airport.y, 0, 0);
        const airportCenterX = airportScreenX + TILE_WIDTH * 2;
        const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
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
          groundTrail: [],
          groundTrailSpawnProgress: 0,
          lifeTime: 30 + Math.random() * 20,
          phaseTime: 0,
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
          planeType: planeType,
          runwayStartX: 0,
          runwayStartY: 0,
          runwayEndX: 0,
          runwayEndY: 0,
          gateX: 0,
          gateY: 0,
          taxiPath: [],
          taxiPathIndex: 0,
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

      // Update ground trail particles - shorter duration on mobile
      const groundTrailMaxAge = isMobile ? 0.55 : GROUND_TRAIL_MAX_AGE;
      const groundTrailSpawnInterval = isMobile ? 0.06 : GROUND_TRAIL_SPAWN_INTERVAL;
      plane.groundTrail = plane.groundTrail
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / groundTrailMaxAge) }))
        .filter(p => p.age < groundTrailMaxAge);
      
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

      // Add ground trail when rolling fast on the runway
      const isRolling =
        (plane.state === 'takeoff_roll' || plane.state === 'rollout') &&
        plane.altitude < 0.15 &&
        plane.speed > 30;
      if (isRolling) {
        plane.groundTrailSpawnProgress += delta;
        if (plane.groundTrailSpawnProgress >= groundTrailSpawnInterval) {
          plane.groundTrailSpawnProgress -= groundTrailSpawnInterval;
          const behind = 10 + plane.speed * 0.06;
          plane.groundTrail.push({
            x: plane.x - Math.cos(plane.angle) * behind,
            y: plane.y - Math.sin(plane.angle) * behind + 5,
            age: 0,
            opacity: 1,
          });
        }
      } else {
        // Let spawn progress decay so it doesn't burst when re-entering roll states
        plane.groundTrailSpawnProgress = Math.max(0, plane.groundTrailSpawnProgress - delta * 2);
      }
      
      // Update based on state
      switch (plane.state) {
        case 'taxi_out': {
          const TAXI_SPEED = 26;
          const TAXI_ACCEL = 22;
          const TAXI_TURN_RATE = 2.6; // rad/sec

          // (Re)build taxi path if missing (e.g., from older saved states)
          if (plane.taxiPath.length === 0) {
            const geom = computeAirportGeometry(plane.airportX, plane.airportY);
            if (!geom) continue;
            const { runwayA, runwayB, gate } = geom;
            const useAB = Math.random() < 0.5;
            const runwayStart = useAB ? runwayA : runwayB;
            const runwayEnd = useAB ? runwayB : runwayA;
            plane.runwayStartX = runwayStart.x;
            plane.runwayStartY = runwayStart.y;
            plane.runwayEndX = runwayEnd.x;
            plane.runwayEndY = runwayEnd.y;
            plane.gateX = gate.x;
            plane.gateY = gate.y;
            plane.taxiPath = buildTaxiOutPath(geom, runwayStart);
            plane.taxiPathIndex = 1;
            plane.x = gate.x;
            plane.y = gate.y;
            plane.angle = Math.atan2(plane.taxiPath[1].y - gate.y, plane.taxiPath[1].x - gate.x);
            plane.speed = 0;
          }

          const target = plane.taxiPath[plane.taxiPathIndex];
          steerAndMoveToward(plane, target, TAXI_TURN_RATE, TAXI_SPEED, TAXI_ACCEL);

          const dist = Math.hypot(plane.x - target.x, plane.y - target.y);
          if (dist < 10) {
            plane.taxiPathIndex += 1;
            if (plane.taxiPathIndex >= plane.taxiPath.length) {
              // Line up for takeoff roll
              plane.state = 'takeoff_roll';
              plane.phaseTime = 0;
              plane.speed = Math.max(10, plane.speed);
              plane.altitude = 0;
              plane.targetAltitude = 1;
              plane.x = plane.runwayStartX;
              plane.y = plane.runwayStartY;
              plane.angle = Math.atan2(plane.runwayEndY - plane.runwayStartY, plane.runwayEndX - plane.runwayStartX);
              // Clear taxi data to reduce memory
              plane.taxiPath = [];
              plane.taxiPathIndex = 0;
            }
          }

          break;
        }

        case 'takeoff_roll': {
          const TAKEOFF_MAX_SPEED = 155;
          const TAKEOFF_ACCEL = 55;
          const RUNWAY_TURN_RATE = 1.2; // rad/sec (tight alignment)

          const desired = Math.atan2(plane.runwayEndY - plane.runwayStartY, plane.runwayEndX - plane.runwayStartX);
          plane.angle = normalizeAngle(plane.angle + clampAngleDelta(plane.angle, desired, RUNWAY_TURN_RATE * delta * speedMultiplier));

          plane.speed = Math.min(TAKEOFF_MAX_SPEED, plane.speed + TAKEOFF_ACCEL * delta * speedMultiplier);
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.altitude = 0;

          const runwayDx = plane.runwayEndX - plane.runwayStartX;
          const runwayDy = plane.runwayEndY - plane.runwayStartY;
          const h = vecNorm(runwayDx, runwayDy);
          const runwayLen = vecLen(runwayDx, runwayDy);
          const along = dot(plane.x - plane.runwayStartX, plane.y - plane.runwayStartY, h.x, h.y);

          // Rotate/climb once we're past ~70% of the runway and fast enough
          if (along > runwayLen * 0.7 && plane.speed > 85) {
            plane.state = 'climb_out';
            plane.phaseTime = 0;
            plane.targetAltitude = 1;
          }

          // If we overshoot (short runway tuning), force climb out
          if (along > runwayLen + 80) {
            plane.state = 'climb_out';
            plane.phaseTime = 0;
            plane.targetAltitude = 1;
          }

          break;
        }

        case 'climb_out': {
          const CLIMB_RATE = 0.45;
          const CLIMB_ACCEL = 18;
          const CLIMB_MAX_SPEED = 160;

          plane.phaseTime += delta;
          plane.altitude = Math.min(1, plane.altitude + CLIMB_RATE * delta);
          plane.speed = Math.min(CLIMB_MAX_SPEED, plane.speed + CLIMB_ACCEL * delta * speedMultiplier);

          // Keep runway heading initially, then slowly allow a gentle random turn as we climb out
          const runwayHeading = Math.atan2(plane.runwayEndY - plane.runwayStartY, plane.runwayEndX - plane.runwayStartX);
          const drift = (Math.sin((plane.id % 1000) + plane.phaseTime * 0.35) * 0.08) * Math.min(1, plane.altitude * 1.2);
          const desired = runwayHeading + drift;
          const TURN_RATE = 0.8;
          plane.angle = normalizeAngle(plane.angle + clampAngleDelta(plane.angle, desired, TURN_RATE * delta * speedMultiplier));

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          if (plane.altitude >= 1) {
            plane.state = 'flying';
            plane.phaseTime = 0;
          }
          break;
        }

        case 'flying': {
          // Cruise
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.lifeTime -= delta;

          const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(plane.airportX, plane.airportY, 0, 0);
          const airportCenterX = airportScreenX + TILE_WIDTH * 2;
          const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
          const distToAirport = Math.hypot(plane.x - airportCenterX, plane.y - airportCenterY);

          // Start approach earlier so we can align to runway centerline
          if (distToAirport < 900 && plane.lifeTime < 14) {
            const geom = computeAirportGeometry(plane.airportX, plane.airportY);
            if (geom) {
              const { runwayA, runwayB, gate } = geom;
              plane.gateX = gate.x;
              plane.gateY = gate.y;

              // Choose landing direction based on which extended runway end is closer
              const runwayDx = runwayB.x - runwayA.x;
              const runwayDy = runwayB.y - runwayA.y;
              const runwayLen = vecLen(runwayDx, runwayDy);

              const option1Start = runwayB; // touchdown
              const option1End = runwayA; // rollout end
              const h1 = vecNorm(option1End.x - option1Start.x, option1End.y - option1Start.y);
              const fix1 = { x: option1Start.x - h1.x * (runwayLen * 1.2), y: option1Start.y - h1.y * (runwayLen * 1.2) };

              const option2Start = runwayA;
              const option2End = runwayB;
              const h2 = { x: -h1.x, y: -h1.y };
              const fix2 = { x: option2Start.x - h2.x * (runwayLen * 1.2), y: option2Start.y - h2.y * (runwayLen * 1.2) };

              const d1 = Math.hypot(plane.x - fix1.x, plane.y - fix1.y);
              const d2 = Math.hypot(plane.x - fix2.x, plane.y - fix2.y);
              const use1 = d1 <= d2;

              const touchdown = use1 ? option1Start : option2Start;
              const rolloutEnd = use1 ? option1End : option2End;

              plane.runwayStartX = touchdown.x;
              plane.runwayStartY = touchdown.y;
              plane.runwayEndX = rolloutEnd.x;
              plane.runwayEndY = rolloutEnd.y;
              plane.state = 'approach';
              plane.phaseTime = 0;
              // Slow down a bit for approach
              plane.speed = Math.max(75, Math.min(plane.speed, 115));
              plane.targetAltitude = 0;
              // Nudge angle toward runway to reduce snapping
              const runwayAngle = Math.atan2(plane.runwayEndY - plane.runwayStartY, plane.runwayEndX - plane.runwayStartX);
              plane.angle = normalizeAngle(lerpAngle(plane.angle, runwayAngle, 0.35));
            }
          } else if (plane.lifeTime <= 0) {
            continue;
          }

          break;
        }

        case 'approach': {
          // Fly a stabilized approach on the extended runway centerline, descending into flare
          const runwayDx = plane.runwayEndX - plane.runwayStartX;
          const runwayDy = plane.runwayEndY - plane.runwayStartY;
          const h = vecNorm(runwayDx, runwayDy);
          const p = { x: -h.y, y: h.x };
          const runwayLen = vecLen(runwayDx, runwayDy);
          const approachDist = runwayLen * 1.25;
          const fix = { x: plane.runwayStartX - h.x * approachDist, y: plane.runwayStartY - h.y * approachDist };

          // Cross-track correction to keep the plane on centerline
          const relX = plane.x - plane.runwayStartX;
          const relY = plane.y - plane.runwayStartY;
          const cross = dot(relX, relY, p.x, p.y);
          const correction = clamp(cross * 0.02, -1.8, 1.8);
          plane.x += -p.x * correction * 60 * delta * speedMultiplier;
          plane.y += -p.y * correction * 60 * delta * speedMultiplier;

          // Align to runway heading
          const desired = Math.atan2(runwayDy, runwayDx);
          const TURN_RATE = 0.7;
          plane.angle = normalizeAngle(plane.angle + clampAngleDelta(plane.angle, desired, TURN_RATE * delta * speedMultiplier));

          // Approach speed and descent profile based on distance to touchdown
          const distToTouchdown = Math.hypot(plane.x - plane.runwayStartX, plane.y - plane.runwayStartY);
          const targetSpeed = distToTouchdown > 220 ? 95 : 82;
          plane.speed = lerp(plane.speed, targetSpeed, 0.06);
          plane.speed = clamp(plane.speed, 65, 120);

          // Smooth descent: 1 at/above fix, then down to ~0.18 before flare
          const distFromFix = Math.hypot(plane.x - fix.x, plane.y - fix.y);
          const descentT = clamp(distFromFix / approachDist, 0, 1);
          const targetAlt = clamp(descentT, 0.18, 1);
          plane.altitude = lerp(plane.altitude, targetAlt, 0.04);

          // Move forward
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          if (distToTouchdown < 90 && plane.altitude < 0.22) {
            plane.state = 'flare';
            plane.phaseTime = 0;
          }

          // Safety: if we drift too far away, go back to flying and despawn later
          if (distToTouchdown > 2400) {
            plane.state = 'flying';
          }

          break;
        }

        case 'flare': {
          plane.phaseTime += delta;

          const runwayDx = plane.runwayEndX - plane.runwayStartX;
          const runwayDy = plane.runwayEndY - plane.runwayStartY;
          const desired = Math.atan2(runwayDy, runwayDx);
          plane.angle = normalizeAngle(plane.angle + clampAngleDelta(plane.angle, desired, 0.9 * delta * speedMultiplier));

          // Reduce descent rate and speed, then touch down
          plane.speed = lerp(plane.speed, 72, 0.08);
          plane.altitude = Math.max(0, plane.altitude - delta * 0.28);

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          if (plane.phaseTime > 0.85 || plane.altitude <= 0.02) {
            plane.state = 'rollout';
            plane.phaseTime = 0;
            plane.altitude = 0;
            // Snap to the touchdown point to avoid "hovering" above runway
            plane.x = lerp(plane.x, plane.runwayStartX, 0.35);
            plane.y = lerp(plane.y, plane.runwayStartY, 0.35);
          }
          break;
        }

        case 'rollout': {
          const runwayDx = plane.runwayEndX - plane.runwayStartX;
          const runwayDy = plane.runwayEndY - plane.runwayStartY;
          const h = vecNorm(runwayDx, runwayDy);
          const runwayLen = vecLen(runwayDx, runwayDy);
          const desired = Math.atan2(runwayDy, runwayDx);
          plane.angle = normalizeAngle(plane.angle + clampAngleDelta(plane.angle, desired, 1.0 * delta * speedMultiplier));

          // Braking roll
          const BRAKE_DECEL = 65;
          plane.speed = Math.max(18, plane.speed - BRAKE_DECEL * delta * speedMultiplier);
          plane.altitude = 0;

          // Keep centered
          const p = { x: -h.y, y: h.x };
          const relX = plane.x - plane.runwayStartX;
          const relY = plane.y - plane.runwayStartY;
          const cross = dot(relX, relY, p.x, p.y);
          plane.x += -p.x * clamp(cross * 0.03, -2, 2) * 40 * delta * speedMultiplier;
          plane.y += -p.y * clamp(cross * 0.03, -2, 2) * 40 * delta * speedMultiplier;

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          const along = dot(plane.x - plane.runwayStartX, plane.y - plane.runwayStartY, h.x, h.y);

          // Exit near the end of the runway or once slow enough
          if (along > runwayLen * 0.82 || plane.speed <= 22) {
            plane.state = 'taxi_in';
            plane.phaseTime = 0;
            plane.speed = Math.min(24, Math.max(10, plane.speed));

            const geom = computeAirportGeometry(plane.airportX, plane.airportY);
            if (geom) {
              plane.gateX = geom.gate.x;
              plane.gateY = geom.gate.y;
              const runwayExit = { x: plane.x, y: plane.y };
              plane.taxiPath = buildTaxiInPath(geom, runwayExit);
              plane.taxiPathIndex = 1;
            } else {
              // Fallback: taxi directly to cached gate
              plane.taxiPath = [{ x: plane.x, y: plane.y }, { x: plane.gateX, y: plane.gateY }];
              plane.taxiPathIndex = 1;
            }
          }

          break;
        }

        case 'taxi_in': {
          const TAXI_SPEED = 22;
          const TAXI_ACCEL = 18;
          const TAXI_TURN_RATE = 2.4;

          if (plane.taxiPath.length === 0) {
            // Fall back: taxi directly to the gate if something went wrong
            plane.taxiPath = [{ x: plane.x, y: plane.y }, { x: plane.gateX, y: plane.gateY }];
            plane.taxiPathIndex = 1;
          }

          const target = plane.taxiPath[plane.taxiPathIndex];
          steerAndMoveToward(plane, target, TAXI_TURN_RATE, TAXI_SPEED, TAXI_ACCEL);

          const dist = Math.hypot(plane.x - target.x, plane.y - target.y);
          if (dist < 12) {
            plane.taxiPathIndex += 1;
            if (plane.taxiPathIndex >= plane.taxiPath.length) {
              // Arrived at gate - remove plane (arrivals complete their trip here)
              continue;
            }
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





