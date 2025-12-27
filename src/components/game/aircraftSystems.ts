/* eslint-disable react-hooks/immutability */
import { useCallback } from 'react';
import { Airplane, Helicopter, WorldRenderState, TILE_WIDTH, TILE_HEIGHT, PlaneType } from './types';
import {
  AIRPLANE_MIN_POPULATION,
  AIRPLANE_COLORS,
  CONTRAIL_MAX_AGE,
  CONTRAIL_SPAWN_INTERVAL,
  AIRPLANE_SPAWN_INTERVAL_MIN,
  AIRPLANE_SPAWN_INTERVAL_MAX,
  AIRPLANE_TAKEOFF_PROBABILITY,
  AIRPLANE_TAXI_SPEED,
  AIRPLANE_TAXI_TURN_RATE,
  AIRPLANE_TAKEOFF_ROLL_SPEED_START,
  AIRPLANE_TAKEOFF_ROLL_SPEED_TARGET,
  AIRPLANE_TAKEOFF_ACCEL,
  AIRPLANE_ROTATE_DISTANCE,
  AIRPLANE_CLIMB_RATE,
  AIRPLANE_DESCENT_RATE,
  AIRPLANE_FLARE_RATE,
  AIRPLANE_CRUISE_SPEED_MIN,
  AIRPLANE_CRUISE_SPEED_MAX,
  AIRPLANE_LANDING_APPROACH_SPEED,
  AIRPLANE_LANDING_ROLLOUT_MIN_SPEED,
  AIRPLANE_BRAKE_DECEL,
  AIRPORT_RUNWAY_BASE_HEADING,
  AIRPORT_RUNWAY_LENGTH,
  AIRPORT_RUNWAY_OFFSET_X,
  AIRPORT_RUNWAY_OFFSET_Y,
  AIRPORT_RUNWAY_APPROACH_DISTANCE,
  AIRPORT_GROUND_MAX_RADIUS,
  GROUND_TRAIL_MAX_AGE,
  GROUND_TRAIL_SPAWN_INTERVAL,
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
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }
    
    // Clear airplanes if zoomed out too far (for large map performance)
    if (currentZoom < AIRPLANE_MIN_ZOOM_FAR) {
      airplanesRef.current = [];
      return;
    }

    const clampAngle = (a: number) => {
      let out = a % (Math.PI * 2);
      if (out < 0) out += Math.PI * 2;
      return out;
    };

    const angleDiff = (target: number, current: number) => {
      let diff = clampAngle(target) - clampAngle(current);
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return diff;
    };

    const turnToward = (currentAngle: number, desiredAngle: number, maxTurnRate: number, dt: number) => {
      const diff = angleDiff(desiredAngle, currentAngle);
      const maxDelta = maxTurnRate * dt;
      const clamped = Math.max(-maxDelta, Math.min(maxDelta, diff));
      return clampAngle(currentAngle + clamped);
    };

    const computeAirportIsFlipped = (airportX: number, airportY: number): boolean => {
      const tile = currentGrid[airportY]?.[airportX];
      if (!tile) return false;

      // Airports should never be mirrored (keep runway/taxi geometry stable).
      return false;

      const buildingSize = getBuildingSize('airport');
      const isWaterfrontAsset = requiresWaterAdjacency('airport');

      // Mirrors are chosen during rendering based on road adjacency, otherwise a deterministic random.
      // Keep this in sync with CanvasIsometricGrid's flip logic so runway direction matches the sprite on-screen.
      let shouldRoadMirror = false;
      if (!isWaterfrontAsset) {
        const roadCheck = getRoadAdjacency(currentGrid, airportX, airportY, buildingSize.width, buildingSize.height, currentGridSize);
        if (roadCheck.hasRoad) {
          shouldRoadMirror = roadCheck.shouldFlip;
        } else {
          const mirrorSeed = (airportX * 47 + airportY * 83) % 100;
          shouldRoadMirror = mirrorSeed < 50;
        }
      }

      const baseFlipped = tile.building.flipped === true;
      return baseFlipped !== shouldRoadMirror; // XOR
    };

    const getAirportRunway = (airportX: number, airportY: number) => {
      const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(airportX, airportY, 0, 0);

      // "Gate" point: this is intentionally biased toward the terminal/apron (not geometric center),
      // matching the old airplane spawn location so planes start near the terminal.
      const gateX = airportScreenX + TILE_WIDTH * 2;
      const gateY = airportScreenY + TILE_HEIGHT * 2;

      const isFlipped = computeAirportIsFlipped(airportX, airportY);
      const runwayDir = isFlipped ? Math.PI - AIRPORT_RUNWAY_BASE_HEADING : AIRPORT_RUNWAY_BASE_HEADING;

      const ux = Math.cos(runwayDir);
      const uy = Math.sin(runwayDir);
      
      // Runway center in screen space. Mirroring swaps X direction only.
      // NOTE: The airport sprite’s runway sits on the +X side when unflipped.
      const runwayCenterX = gateX + (isFlipped ? -1 : 1) * AIRPORT_RUNWAY_OFFSET_X;
      const runwayCenterY = gateY + AIRPORT_RUNWAY_OFFSET_Y;

      const halfLen = AIRPORT_RUNWAY_LENGTH * 0.5;

      const startX = runwayCenterX - ux * halfLen;
      const startY = runwayCenterY - uy * halfLen;
      const endX = runwayCenterX + ux * halfLen;
      const endY = runwayCenterY + uy * halfLen;

      // Taxi targets/positions should never drift outside the airport *footprint*.
      // Clamp to the 4x4 isometric diamond footprint (slightly inset for safety).
      const clampToAirportFootprint = (x: number, y: number) => {
        // Airport is a 4x4 isometric diamond footprint.
        // gridToScreen(origin) is the top-left of the footprint's bounding box.
        const size = 4;
        const inset = 0.80; // intentionally conservative (keeps taxi inside the visible asset)
        const rX = (size * TILE_WIDTH) / 2 * inset;
        const rY = (size * TILE_HEIGHT) / 2 * inset;
        const cX = airportScreenX + (size * TILE_WIDTH) / 2;
        const cY = airportScreenY + (size * TILE_HEIGHT) / 2;

        const dx = x - cX;
        const dy = y - cY;
        const v = Math.abs(dx) / rX + Math.abs(dy) / rY;
        if (v <= 1 || v === 0) return { x, y };
        const s = 1 / v;
        return { x: cX + dx * s, y: cY + dy * s };
      };

      // Use a runway lineup point that is guaranteed to be *inside* the runway (past the start/threshold),
      // so the taxi→takeoff transition never overshoots beyond the runway.
      const lineupX = startX + ux * 22;
      const lineupY = startY + uy * 22;
      const clampedLineup = clampToAirportFootprint(lineupX, lineupY);

      // Add a short "turn point" near the gate so planes start turning early instead of
      // doing a long straight taxi before lining up.
      const gateToRunwayDx = runwayCenterX - gateX;
      const gateToRunwayDy = runwayCenterY - gateY;
      const gateToRunwayD = Math.hypot(gateToRunwayDx, gateToRunwayDy) || 1;
      const lateralNx = gateToRunwayDx / gateToRunwayD;
      const lateralNy = gateToRunwayDy / gateToRunwayD;
      const taxiTurnX = gateX + lateralNx * 58;
      const taxiTurnY = gateY + lateralNy * 58;
      const clampedTurn = clampToAirportFootprint(taxiTurnX, taxiTurnY);

      return {
        gateX,
        gateY,
        runwayDir,
        startX,
        startY,
        endX,
        endY,
        runwayCenterX,
        runwayCenterY,
        taxiLineupX: clampedLineup.x,
        taxiLineupY: clampedLineup.y,
        taxiTurnX: clampedTurn.x,
        taxiTurnY: clampedTurn.y,
        clampToAirportFootprint,
      };
    };

    const pickLandingPlan = (plane: Airplane) => {
      const rw = getAirportRunway(plane.airportX, plane.airportY);
      const dirA = clampAngle(rw.runwayDir);
      const dirB = clampAngle(rw.runwayDir + Math.PI);

      const scoreForDir = (dir: number) => {
        const ux = Math.cos(dir);
        const uy = Math.sin(dir);

        // Touchdown a bit past the near threshold (so there is rollout remaining).
        const touchdownX = rw.runwayCenterX - ux * (AIRPORT_RUNWAY_LENGTH * 0.28);
        const touchdownY = rw.runwayCenterY - uy * (AIRPORT_RUNWAY_LENGTH * 0.28);

        const approachX = touchdownX - ux * AIRPORT_RUNWAY_APPROACH_DISTANCE;
        const approachY = touchdownY - uy * AIRPORT_RUNWAY_APPROACH_DISTANCE;

        const rolloutEndX = touchdownX + ux * (AIRPORT_RUNWAY_LENGTH * 0.58);
        const rolloutEndY = touchdownY + uy * (AIRPORT_RUNWAY_LENGTH * 0.58);

        const desiredApproachAngle = Math.atan2(approachY - plane.y, approachX - plane.x);
        const turnPenalty = Math.abs(angleDiff(desiredApproachAngle, plane.angle));
        const distPenalty = Math.hypot(approachX - plane.x, approachY - plane.y) * 0.0015;
        return {
          score: turnPenalty + distPenalty,
          dir,
          approachX,
          approachY,
          touchdownX,
          touchdownY,
          rolloutEndX,
          rolloutEndY,
          gateX: rw.gateX,
          gateY: rw.gateY,
        };
      };

      const a = scoreForDir(dirA);
      const b = scoreForDir(dirB);
      return a.score <= b.score ? a : b;
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
      
      const runway = getAirportRunway(airport.x, airport.y);
      
      // Decide if taking off or arriving from distance (bias toward takeoff for more taxiing activity)
      const isTakingOff = Math.random() < AIRPLANE_TAKEOFF_PROBABILITY;
      
      if (isTakingOff) {
        // Start at the terminal/apron, then taxi to runway and take off along runway heading.
        const planeType = PLANE_TYPES[Math.floor(Math.random() * PLANE_TYPES.length)] as PlaneType;
        const taxiStartAngle = clampAngle(Math.atan2(runway.taxiTurnY - runway.gateY, runway.taxiTurnX - runway.gateX));
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: runway.gateX,
          y: runway.gateY,
          // Face the taxi aim point immediately to avoid drifting outside before turning.
          angle: taxiStartAngle,
          targetAngle: taxiStartAngle,
          state: 'taxi_to_runway',
          speed: AIRPLANE_TAXI_SPEED,
          altitude: 0,
          targetAltitude: 1,
          airportX: airport.x,
          airportY: airport.y,
          stateProgress: 0,
          contrail: [],
          groundTrail: [],
          lifeTime: 28 + Math.random() * 22, // 28-50 seconds of activity
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
          planeType: planeType,
          taxiStage: 0,
          targetX: runway.taxiTurnX,
          targetY: runway.taxiTurnY,
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
        
        // Aim roughly toward the airport's runway area (not the terminal), we will refine during landing.
        const angleToAirport = Math.atan2(runway.runwayCenterY - startY, runway.runwayCenterX - startX);
        const planeType = PLANE_TYPES[Math.floor(Math.random() * PLANE_TYPES.length)] as PlaneType;
        
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: startX,
          y: startY,
          angle: clampAngle(angleToAirport),
          state: 'flying',
          speed: AIRPLANE_CRUISE_SPEED_MIN + Math.random() * (AIRPLANE_CRUISE_SPEED_MAX - AIRPLANE_CRUISE_SPEED_MIN),
          altitude: 1,
          targetAltitude: 1,
          airportX: airport.x,
          airportY: airport.y,
          stateProgress: 0,
          contrail: [],
          groundTrail: [],
          lifeTime: 26 + Math.random() * 26,
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
          planeType: planeType,
        });
      }
      
      airplaneSpawnTimerRef.current =
        AIRPLANE_SPAWN_INTERVAL_MIN +
        Math.random() * (AIRPLANE_SPAWN_INTERVAL_MAX - AIRPLANE_SPAWN_INTERVAL_MIN);
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

      // Update ground trail particles (tire smoke) - short-lived
      const groundMaxAge = isMobile ? 0.6 : GROUND_TRAIL_MAX_AGE;
      const groundSpawnInterval = isMobile ? 0.08 : GROUND_TRAIL_SPAWN_INTERVAL;
      plane.groundTrail = (plane.groundTrail || [])
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / groundMaxAge) }))
        .filter(p => p.age < groundMaxAge);
      
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

      // Add ground trail particles when rolling fast on the runway (takeoff/landing)
      if (plane.altitude < 0.15 && (plane.state === 'takeoff_roll' || plane.state === 'rollout') && plane.speed > 35) {
        plane.stateProgress += delta;
        if (plane.stateProgress >= groundSpawnInterval) {
          plane.stateProgress -= groundSpawnInterval;
          const behindOffset = 18;
          const jitter = (Math.random() - 0.5) * 5;
          const trailX = plane.x - Math.cos(plane.angle) * behindOffset + jitter;
          const trailY = plane.y - Math.sin(plane.angle) * behindOffset + jitter * 0.6;
          plane.groundTrail!.push({ x: trailX, y: trailY, age: 0, opacity: 1 });
        }
      }
      
      // Update based on state
      switch (plane.state) {
        case 'taxi_to_runway': {
          const runway = getAirportRunway(plane.airportX, plane.airportY);
          const stage = plane.taxiStage ?? 0;
          const targetX =
            plane.targetX ??
            (stage === 0 ? runway.taxiTurnX : runway.taxiLineupX);
          const targetY =
            plane.targetY ??
            (stage === 0 ? runway.taxiTurnY : runway.taxiLineupY);

          const desiredAngle = Math.atan2(targetY - plane.y, targetX - plane.x);
          const headingError = Math.abs(angleDiff(desiredAngle, plane.angle));

          // "Turn-first" taxi: if we're not aligned, slow down (or pivot in place) so we don't overshoot.
          const pivotInPlace = headingError > 1.25; // ~72°
          const alignment = Math.max(0, 1 - headingError / 1.25); // 1..0
          const taxiSpeed = pivotInPlace ? 0 : Math.max(6, AIRPLANE_TAXI_SPEED * (0.25 + 0.75 * alignment));

          plane.angle = turnToward(plane.angle, desiredAngle, AIRPLANE_TAXI_TURN_RATE * 1.35, delta);
          plane.speed = taxiSpeed;
          plane.altitude = 0;

          const step = plane.speed * delta * speedMultiplier;
          const distBeforeMove = Math.hypot(targetX - plane.x, targetY - plane.y);
          if (distBeforeMove <= step && distBeforeMove > 0) {
            // Prevent overshoot: snap to taxi target this frame.
            plane.x = targetX;
            plane.y = targetY;
          } else {
            plane.x += Math.cos(plane.angle) * step;
            plane.y += Math.sin(plane.angle) * step;
          }

          // Hard clamp taxi motion to the airport footprint region.
          // This prevents even small overshoot steps from drifting outside the asset.
          const clampedPos = runway.clampToAirportFootprint(plane.x, plane.y);
          plane.x = clampedPos.x;
          plane.y = clampedPos.y;

          const dist = Math.hypot(targetX - plane.x, targetY - plane.y);
          if (dist < 18 && (plane.taxiStage ?? 0) === 0) {
            // Advance to hold-short/lineup point (short segment).
            plane.taxiStage = 1;
            plane.targetX = runway.taxiLineupX;
            plane.targetY = runway.taxiLineupY;
          } else if (dist < 14 && (plane.taxiStage ?? 0) === 1) {
            // Snap perfectly onto runway centerline before takeoff roll.
            plane.x = runway.taxiLineupX;
            plane.y = runway.taxiLineupY;
            plane.state = 'takeoff_roll';
            plane.runwayDir = runway.runwayDir;
            plane.angle = runway.runwayDir;
            plane.speed = AIRPLANE_TAKEOFF_ROLL_SPEED_START;
            plane.stateProgress = 0;
            plane.taxiStage = undefined;
          }
          break;
        }

        case 'takeoff_roll': {
          const runway = getAirportRunway(plane.airportX, plane.airportY);
          const dir = plane.runwayDir ?? runway.runwayDir;
          plane.angle = turnToward(plane.angle, dir, 1.2, delta);
          plane.altitude = 0;
          plane.speed = Math.min(AIRPLANE_TAKEOFF_ROLL_SPEED_TARGET, plane.speed + AIRPLANE_TAKEOFF_ACCEL * delta);

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          // Rotate once we've rolled far enough down the runway.
          const ux = Math.cos(dir);
          const uy = Math.sin(dir);
          const along = (plane.x - runway.startX) * ux + (plane.y - runway.startY) * uy;
          if (along >= AIRPLANE_ROTATE_DISTANCE && plane.speed >= AIRPLANE_LANDING_APPROACH_SPEED) {
            plane.state = 'climbout';
            plane.targetAltitude = 1;
            plane.stateProgress = 0;
          }
          break;
        }

        case 'climbout': {
          const dir = plane.runwayDir ?? AIRPORT_RUNWAY_BASE_HEADING;
          plane.angle = turnToward(plane.angle, dir, 0.9, delta);
          plane.speed = Math.min(AIRPLANE_CRUISE_SPEED_MAX, plane.speed + AIRPLANE_TAKEOFF_ACCEL * 0.55 * delta);
          plane.altitude = Math.min(1, plane.altitude + AIRPLANE_CLIMB_RATE * delta);

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          if (plane.altitude >= 0.98) {
            plane.state = 'flying';
            // Once airborne, wander slightly so flights don't all stack.
            plane.angle = clampAngle(plane.angle + (Math.random() - 0.5) * 0.25);
            plane.speed =
              AIRPLANE_CRUISE_SPEED_MIN + Math.random() * (AIRPLANE_CRUISE_SPEED_MAX - AIRPLANE_CRUISE_SPEED_MIN);
          }
          break;
        }

        case 'flying': {
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          plane.lifeTime -= delta;

          const runway = getAirportRunway(plane.airportX, plane.airportY);
          const distToAirport = Math.hypot(plane.x - runway.runwayCenterX, plane.y - runway.runwayCenterY);

          // Start landing planning when close-ish and time is running out.
          if (distToAirport < 700 && plane.lifeTime < 12) {
            const plan = pickLandingPlan(plane);
            plane.runwayDir = plan.dir;
            plane.approachX = plan.approachX;
            plane.approachY = plan.approachY;
            plane.touchdownX = plan.touchdownX;
            plane.touchdownY = plan.touchdownY;
            plane.rolloutEndX = plan.rolloutEndX;
            plane.rolloutEndY = plan.rolloutEndY;
            plane.targetX = plan.approachX;
            plane.targetY = plan.approachY;
            plane.state = 'approach';
            plane.targetAltitude = 0.55;
            plane.speed = Math.max(plane.speed, AIRPLANE_LANDING_APPROACH_SPEED);
            plane.stateProgress = 0;
          } else if (plane.lifeTime <= 0) {
            // If it never got close enough to land, despawn.
            continue;
          } else {
            // Gentle drift so cruising doesn't look robotic
            plane.angle = clampAngle(plane.angle + (Math.random() - 0.5) * 0.03 * delta);
          }
          break;
        }

        case 'approach': {
          const tx = plane.approachX ?? plane.targetX;
          const ty = plane.approachY ?? plane.targetY;
          if (tx === undefined || ty === undefined) {
            plane.state = 'flying';
            break;
          }

          const desiredAngle = Math.atan2(ty - plane.y, tx - plane.x);
          plane.angle = turnToward(plane.angle, desiredAngle, 0.75, delta);

          // Descend toward a mid-altitude on approach.
          plane.altitude = Math.max(plane.targetAltitude, plane.altitude - AIRPLANE_DESCENT_RATE * 0.35 * delta);
          plane.speed = Math.max(AIRPLANE_LANDING_APPROACH_SPEED, plane.speed - 18 * delta);

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          const dist = Math.hypot(tx - plane.x, ty - plane.y);
          if (dist < 90) {
            plane.state = 'final';
            plane.targetAltitude = 0;
            plane.speed = AIRPLANE_LANDING_APPROACH_SPEED;
            plane.stateProgress = 0;
          }
          break;
        }

        case 'final': {
          const runway = getAirportRunway(plane.airportX, plane.airportY);
          const dir = plane.runwayDir ?? runway.runwayDir;

          const tx = plane.touchdownX ?? runway.runwayCenterX;
          const ty = plane.touchdownY ?? runway.runwayCenterY;

          // Lock onto runway centerline on short final.
          plane.angle = turnToward(plane.angle, dir, 0.95, delta);
          plane.speed = Math.max(70, plane.speed - 22 * delta);
          plane.altitude = Math.max(0, plane.altitude - AIRPLANE_DESCENT_RATE * delta);

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          const dist = Math.hypot(tx - plane.x, ty - plane.y);
          if (dist < 70 && plane.altitude < 0.18) {
            plane.state = 'flare';
            plane.stateProgress = 0;
          }
          break;
        }

        case 'flare': {
          const runway = getAirportRunway(plane.airportX, plane.airportY);
          const dir = plane.runwayDir ?? runway.runwayDir;
          plane.angle = turnToward(plane.angle, dir, 1.0, delta);

          // Quick flare to settle onto runway.
          plane.altitude = Math.max(0, plane.altitude - AIRPLANE_FLARE_RATE * delta);
          plane.speed = Math.max(55, plane.speed - 30 * delta);

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          if (plane.altitude <= 0.01) {
            plane.altitude = 0;
            plane.state = 'rollout';
            plane.stateProgress = 0;
          }
          break;
        }

        case 'rollout': {
          const runway = getAirportRunway(plane.airportX, plane.airportY);
          const dir = plane.runwayDir ?? runway.runwayDir;
          plane.angle = turnToward(plane.angle, dir, 0.9, delta);
          plane.altitude = 0;
          plane.speed = Math.max(AIRPLANE_LANDING_ROLLOUT_MIN_SPEED, plane.speed - AIRPLANE_BRAKE_DECEL * delta);

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          const ex = plane.rolloutEndX ?? runway.endX;
          const ey = plane.rolloutEndY ?? runway.endY;
          const distToEnd = Math.hypot(ex - plane.x, ey - plane.y);

          if (plane.speed <= AIRPLANE_TAXI_SPEED + 2 || distToEnd < 40) {
            plane.state = 'taxi_to_gate';
            plane.targetX = runway.gateX;
            plane.targetY = runway.gateY;
            plane.speed = AIRPLANE_TAXI_SPEED;
            plane.stateProgress = 0;
          }
          break;
        }

        case 'taxi_to_gate': {
          const runway = getAirportRunway(plane.airportX, plane.airportY);
          const targetX = plane.targetX ?? runway.gateX;
          const targetY = plane.targetY ?? runway.gateY;

          const desiredAngle = Math.atan2(targetY - plane.y, targetX - plane.x);
          const headingError = Math.abs(angleDiff(desiredAngle, plane.angle));
          const pivotInPlace = headingError > 1.25;
          const alignment = Math.max(0, 1 - headingError / 1.25);
          const taxiSpeed = pivotInPlace ? 0 : Math.max(6, AIRPLANE_TAXI_SPEED * (0.25 + 0.75 * alignment));

          plane.angle = turnToward(plane.angle, desiredAngle, AIRPLANE_TAXI_TURN_RATE * 1.35, delta);
          plane.altitude = 0;
          plane.speed = taxiSpeed;

          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;

          // Hard clamp taxi motion to the airport footprint region.
          const clampedPos = runway.clampToAirportFootprint(plane.x, plane.y);
          plane.x = clampedPos.x;
          plane.y = clampedPos.y;

          if (Math.hypot(targetX - plane.x, targetY - plane.y) < 22) {
            // Parked at gate – despawn (could later be extended to stay parked).
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





