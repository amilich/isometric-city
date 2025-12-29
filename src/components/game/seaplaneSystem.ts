import { useCallback } from 'react';
import { Seaplane, WorldRenderState, TILE_WIDTH, TILE_HEIGHT, WakeParticle } from './types';
import {
  SEAPLANE_MIN_POPULATION,
  SEAPLANE_MIN_BAY_SIZE,
  SEAPLANE_COLORS,
  MAX_SEAPLANES,
  MAX_SEAPLANES_MOBILE,
  SEAPLANE_SPAWN_INTERVAL_MIN,
  SEAPLANE_SPAWN_INTERVAL_MAX,
  SEAPLANE_TAXI_TIME_MIN,
  SEAPLANE_TAXI_TIME_MAX,
  SEAPLANE_DOCK_TIME_MIN,
  SEAPLANE_DOCK_TIME_MAX,
  SEAPLANE_FLIGHT_TIME_MIN,
  SEAPLANE_FLIGHT_TIME_MAX,
  SEAPLANE_WATER_SPEED,
  SEAPLANE_DOCK_APPROACH_SPEED,
  SEAPLANE_TAKEOFF_SPEED,
  SEAPLANE_FLIGHT_SPEED_MIN,
  SEAPLANE_FLIGHT_SPEED_MAX,
  SEAPLANE_MIN_ZOOM,
  SEAPLANE_MAX_FLIGHTS,
  CONTRAIL_MAX_AGE,
  CONTRAIL_SPAWN_INTERVAL,
  WAKE_MAX_AGE,
  WAKE_SPAWN_INTERVAL,
} from './constants';
import { findBays, getRandomBayTile, isOverWater, BayInfo, findMarinasAndPiers, findAdjacentWaterTile, DockInfo } from './gridFinders';
import { gridToScreen } from './utils';

export interface SeaplaneSystemRefs {
  seaplanesRef: React.MutableRefObject<Seaplane[]>;
  seaplaneIdRef: React.MutableRefObject<number>;
  seaplaneSpawnTimerRef: React.MutableRefObject<number>;
}

export interface SeaplaneSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  gridVersionRef: React.MutableRefObject<number>;
  cachedPopulationRef: React.MutableRefObject<{ count: number; gridVersion: number }>;
  isMobile: boolean;
}

// Helper to find docks within a bay's water tiles
function findDocksInBay(
  docks: DockInfo[],
  bayWaterTiles: { x: number; y: number }[],
  grid: import('@/types/game').Tile[][],
  gridSize: number
): { dock: DockInfo; waterTile: { x: number; y: number } }[] {
  const bayTileSet = new Set(bayWaterTiles.map(t => `${t.x},${t.y}`));
  const result: { dock: DockInfo; waterTile: { x: number; y: number } }[] = [];
  
  for (const dock of docks) {
    // Find adjacent water tile for this dock
    const waterTile = findAdjacentWaterTile(grid, gridSize, dock.x, dock.y);
    if (waterTile && bayTileSet.has(`${waterTile.x},${waterTile.y}`)) {
      result.push({ dock, waterTile });
    }
  }
  
  return result;
}

export function useSeaplaneSystem(
  refs: SeaplaneSystemRefs,
  systemState: SeaplaneSystemState
) {
  const { seaplanesRef, seaplaneIdRef, seaplaneSpawnTimerRef } = refs;
  const { worldStateRef, gridVersionRef, cachedPopulationRef, isMobile } = systemState;

  // Find bays callback
  const findBaysCallback = useCallback((): BayInfo[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findBays(currentGrid, currentGridSize, SEAPLANE_MIN_BAY_SIZE);
  }, [worldStateRef]);

  // Find marinas and piers callback
  const findDocksCallback = useCallback((): DockInfo[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findMarinasAndPiers(currentGrid, currentGridSize);
  }, [worldStateRef]);

  // Check if screen position is over water callback
  const isOverWaterCallback = useCallback((screenX: number, screenY: number): boolean => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return isOverWater(currentGrid, currentGridSize, screenX, screenY);
  }, [worldStateRef]);

  // Update seaplanes - spawn, move, and manage lifecycle
  const updateSeaplanes = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Clear seaplanes if zoomed out too far
    if (currentZoom < SEAPLANE_MIN_ZOOM) {
      seaplanesRef.current = [];
      return;
    }

    // Find bays and docks
    const bays = findBaysCallback();
    const allDocks = findDocksCallback();
    
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

    // No seaplanes if no bays or insufficient population
    if (bays.length === 0 || totalPopulation < SEAPLANE_MIN_POPULATION) {
      seaplanesRef.current = [];
      return;
    }

    // Calculate max seaplanes based on population and bay count - lower on mobile
    const maxSeaplaneLimit = isMobile ? MAX_SEAPLANES_MOBILE : MAX_SEAPLANES;
    const minSeaplanes = isMobile ? 1 : 3;
    const populationBased = Math.floor(totalPopulation / 2000);
    const bayBased = Math.floor(bays.length * 5);
    const maxSeaplanes = Math.min(maxSeaplaneLimit, Math.max(minSeaplanes, Math.min(populationBased, bayBased)));
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    seaplaneSpawnTimerRef.current -= delta;
    if (seaplanesRef.current.length < maxSeaplanes && seaplaneSpawnTimerRef.current <= 0) {
      // Pick a random bay
      const bay = bays[Math.floor(Math.random() * bays.length)];
      
      // Find docks in this bay
      const docksInBay = findDocksInBay(allDocks, bay.waterTiles, currentGrid, currentGridSize);
      
      // Pick a random dock if available
      let dockTileX: number | null = null;
      let dockTileY: number | null = null;
      let dockScreenX: number | null = null;
      let dockScreenY: number | null = null;
      let initialState: 'taxiing_to_dock' | 'taxiing_water' = 'taxiing_water';
      let spawnTile = getRandomBayTile(bay);
      
      if (docksInBay.length > 0) {
        const chosenDock = docksInBay[Math.floor(Math.random() * docksInBay.length)];
        dockTileX = chosenDock.waterTile.x;
        dockTileY = chosenDock.waterTile.y;
        const dockScreenPos = gridToScreen(chosenDock.waterTile.x, chosenDock.waterTile.y, 0, 0);
        dockScreenX = dockScreenPos.screenX + TILE_WIDTH / 2;
        dockScreenY = dockScreenPos.screenY + TILE_HEIGHT / 2;
        
        // 60% chance to start by taxiing to dock, 40% chance to taxi around first
        initialState = Math.random() < 0.6 ? 'taxiing_to_dock' : 'taxiing_water';
      }
      
      // Random initial angle
      const angle = Math.random() * Math.PI * 2;
      
      seaplanesRef.current.push({
        id: seaplaneIdRef.current++,
        x: spawnTile.screenX,
        y: spawnTile.screenY,
        angle: angle,
        targetAngle: angle,
        state: initialState,
        speed: SEAPLANE_WATER_SPEED * (0.8 + Math.random() * 0.4),
        altitude: 0,
        targetAltitude: 0,
        bayTileX: bay.centerX,
        bayTileY: bay.centerY,
        bayScreenX: bay.screenX,
        bayScreenY: bay.screenY,
        stateProgress: 0,
        contrail: [],
        wake: [],
        wakeSpawnProgress: 0,
        lifeTime: SEAPLANE_FLIGHT_TIME_MIN + Math.random() * (SEAPLANE_FLIGHT_TIME_MAX - SEAPLANE_FLIGHT_TIME_MIN),
        taxiTime: SEAPLANE_TAXI_TIME_MIN + Math.random() * (SEAPLANE_TAXI_TIME_MAX - SEAPLANE_TAXI_TIME_MIN),
        color: SEAPLANE_COLORS[Math.floor(Math.random() * SEAPLANE_COLORS.length)],
        dockTileX,
        dockTileY,
        dockScreenX,
        dockScreenY,
        dockTime: SEAPLANE_DOCK_TIME_MIN + Math.random() * (SEAPLANE_DOCK_TIME_MAX - SEAPLANE_DOCK_TIME_MIN),
        flightCount: 0,
      });
      
      // Set next spawn time
      seaplaneSpawnTimerRef.current = SEAPLANE_SPAWN_INTERVAL_MIN + Math.random() * (SEAPLANE_SPAWN_INTERVAL_MAX - SEAPLANE_SPAWN_INTERVAL_MIN);
    }

    // Update existing seaplanes
    const updatedSeaplanes: Seaplane[] = [];
    
    for (const seaplane of seaplanesRef.current) {
      // Update contrail particles when at altitude
      const contrailMaxAge = isMobile ? 0.8 : CONTRAIL_MAX_AGE;
      const contrailSpawnInterval = isMobile ? 0.06 : CONTRAIL_SPAWN_INTERVAL;
      seaplane.contrail = seaplane.contrail
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / contrailMaxAge) }))
        .filter(p => p.age < contrailMaxAge);
      
      // Update wake particles when on water
      const wakeMaxAge = isMobile ? 0.6 : WAKE_MAX_AGE;
      seaplane.wake = seaplane.wake
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / wakeMaxAge) }))
        .filter(p => p.age < wakeMaxAge);

      // Add contrail particles at high altitude
      if (seaplane.altitude > 0.7) {
        seaplane.stateProgress += delta;
        if (seaplane.stateProgress >= contrailSpawnInterval) {
          seaplane.stateProgress -= contrailSpawnInterval;
          // Single contrail particle - offset behind plane
          const behindOffset = 25; // Distance behind the plane
          const downOffset = -2; // Vertical offset up
          const contrailX = seaplane.x - Math.cos(seaplane.angle) * behindOffset;
          const contrailY = seaplane.y - Math.sin(seaplane.angle) * behindOffset + downOffset;
          seaplane.contrail.push({ x: contrailX, y: contrailY, age: 0, opacity: 1 });
        }
      }

      // Calculate next position
      let nextX = seaplane.x;
      let nextY = seaplane.y;

      switch (seaplane.state) {
        case 'taxiing_to_dock': {
          // Taxi toward the dock/marina
          if (seaplane.dockScreenX === null || seaplane.dockScreenY === null) {
            // No dock, switch to regular taxiing
            seaplane.state = 'taxiing_water';
            break;
          }
          
          // Safety check: if we're not over water, despawn (stuck on land)
          if (!isOverWaterCallback(seaplane.x, seaplane.y)) {
            // Stuck on land, despawn
            continue;
          }
          
          const distToDock = Math.hypot(seaplane.x - seaplane.dockScreenX, seaplane.y - seaplane.dockScreenY);
          const angleToDock = Math.atan2(seaplane.dockScreenY - seaplane.y, seaplane.dockScreenX - seaplane.x);
          
          // Normalize angle
          seaplane.targetAngle = angleToDock;
          
          // Smooth turning toward dock
          let angleDiff = seaplane.targetAngle - seaplane.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          const turnRate = Math.PI * delta * 2.0;
          seaplane.angle += Math.max(-turnRate, Math.min(turnRate, angleDiff));
          
          // Slow down as we approach
          if (distToDock < 60) {
            seaplane.speed = Math.max(SEAPLANE_DOCK_APPROACH_SPEED * 0.5, seaplane.speed - delta * 15);
          } else if (distToDock < 100) {
            seaplane.speed = Math.max(SEAPLANE_DOCK_APPROACH_SPEED, seaplane.speed - delta * 8);
          }
          
          nextX = seaplane.x + Math.cos(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          nextY = seaplane.y + Math.sin(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          
          // Check if we're over water
          if (!isOverWaterCallback(nextX, nextY)) {
            nextX = seaplane.x;
            nextY = seaplane.y;
          }
          
          // Spawn wake particles
          const wakeSpawnInterval = isMobile ? 0.08 : WAKE_SPAWN_INTERVAL;
          seaplane.wakeSpawnProgress += delta;
          if (seaplane.wakeSpawnProgress >= wakeSpawnInterval) {
            seaplane.wakeSpawnProgress -= wakeSpawnInterval;
            const behindSeaplane = -8;
            seaplane.wake.push({
              x: seaplane.x + Math.cos(seaplane.angle) * behindSeaplane,
              y: seaplane.y + Math.sin(seaplane.angle) * behindSeaplane,
              age: 0,
              opacity: 1
            });
          }
          
          // Transition to docked when close enough
          if (distToDock < 25) {
            seaplane.state = 'docked';
            seaplane.speed = 0;
            seaplane.wake = []; // Clear wake when docked
            seaplane.dockTime = SEAPLANE_DOCK_TIME_MIN + Math.random() * (SEAPLANE_DOCK_TIME_MAX - SEAPLANE_DOCK_TIME_MIN);
          }
          break;
        }
        
        case 'docked': {
          // Stay docked at marina/pier
          seaplane.dockTime -= delta;
          seaplane.speed = 0;
          
          // Safety check: if dock position is no longer over water, despawn
          if (seaplane.dockScreenX !== null && seaplane.dockScreenY !== null) {
            if (!isOverWaterCallback(seaplane.dockScreenX, seaplane.dockScreenY)) {
              // Dock is no longer over water (e.g., marina was demolished), despawn
              continue;
            }
          }
          
          // Keep position at dock
          if (seaplane.dockScreenX !== null && seaplane.dockScreenY !== null) {
            nextX = seaplane.dockScreenX;
            nextY = seaplane.dockScreenY;
          }
          
          // Time to undock and taxi before takeoff
          if (seaplane.dockTime <= 0) {
            seaplane.state = 'taxiing_water';
            seaplane.speed = SEAPLANE_WATER_SPEED * (0.8 + Math.random() * 0.4);
            seaplane.taxiTime = SEAPLANE_TAXI_TIME_MIN + Math.random() * (SEAPLANE_TAXI_TIME_MAX - SEAPLANE_TAXI_TIME_MIN);
            // Point away from dock toward bay center
            const angleToBay = Math.atan2(seaplane.bayScreenY - seaplane.y, seaplane.bayScreenX - seaplane.x);
            seaplane.angle = angleToBay + (Math.random() - 0.5) * 0.5;
            seaplane.targetAngle = seaplane.angle;
          }
          break;
        }
        
        case 'taxiing_water': {
          // Taxi around on water like a boat
          seaplane.taxiTime -= delta;
          
          // Safety check: if we're not over water, despawn (stuck on land)
          if (!isOverWaterCallback(seaplane.x, seaplane.y)) {
            // Stuck on land, despawn
            continue;
          }
          
          // Normalize current angle to 0-2PI to prevent wraparound issues
          let normalizedAngle = seaplane.angle % (Math.PI * 2);
          if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
          seaplane.angle = normalizedAngle;
          
          // Normalize target angle
          let normalizedTargetAngle = seaplane.targetAngle % (Math.PI * 2);
          if (normalizedTargetAngle < 0) normalizedTargetAngle += Math.PI * 2;
          seaplane.targetAngle = normalizedTargetAngle;
          
          // Calculate distance from bay center
          const distFromCenter = Math.hypot(seaplane.x - seaplane.bayScreenX, seaplane.y - seaplane.bayScreenY);
          const angleToBayCenter = Math.atan2(seaplane.bayScreenY - seaplane.y, seaplane.bayScreenX - seaplane.x);
          
          // Normalize angleToBayCenter
          let normalizedAngleToCenter = angleToBayCenter % (Math.PI * 2);
          if (normalizedAngleToCenter < 0) normalizedAngleToCenter += Math.PI * 2;
          
          // If too far from center (>100px), steer back toward center
          if (distFromCenter > 100) {
            seaplane.targetAngle = normalizedAngleToCenter + (Math.random() - 0.5) * 0.5; // Slight randomness
            // Normalize again after adding randomness
            seaplane.targetAngle = seaplane.targetAngle % (Math.PI * 2);
            if (seaplane.targetAngle < 0) seaplane.targetAngle += Math.PI * 2;
          } else if (distFromCenter > 50) {
            // When moderately close to center, allow gentle random turning but less frequently
            if (Math.random() < 0.01) {
              // Smaller random turns to prevent flickering
              seaplane.targetAngle = seaplane.angle + (Math.random() - 0.5) * Math.PI / 4; // Reduced from PI/2
              // Normalize
              seaplane.targetAngle = seaplane.targetAngle % (Math.PI * 2);
              if (seaplane.targetAngle < 0) seaplane.targetAngle += Math.PI * 2;
            }
          } else {
            // When very close to center (<50px), DON'T target center anymore
            // This prevents flickering when crossing over the center point
            // Instead, just do occasional gentle random turns like a boat idling
            if (Math.random() < 0.005) { // Very infrequent turns
              seaplane.targetAngle = seaplane.angle + (Math.random() - 0.5) * Math.PI / 6; // Very gentle turns
              // Normalize
              seaplane.targetAngle = seaplane.targetAngle % (Math.PI * 2);
              if (seaplane.targetAngle < 0) seaplane.targetAngle += Math.PI * 2;
            }
            // Keep current targetAngle to maintain stability - don't chase the center
          }
          
          // Check if we're approaching the water boundary (look ahead)
          const lookAheadDist = seaplane.speed * 0.5; // Look ahead half a second
          const lookAheadX = seaplane.x + Math.cos(seaplane.angle) * lookAheadDist;
          const lookAheadY = seaplane.y + Math.sin(seaplane.angle) * lookAheadDist;
          const approachingBoundary = !isOverWaterCallback(lookAheadX, lookAheadY);
          
          // If approaching boundary, immediately target bay center
          if (approachingBoundary) {
            seaplane.targetAngle = normalizedAngleToCenter;
          }
          
          // Smooth turning with maximum rate limit to prevent rapid flipping
          let angleDiff = seaplane.targetAngle - seaplane.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          
          // Turn faster when approaching boundary, otherwise smooth turning
          const baseTurnRate = approachingBoundary ? 3.0 : 1.5; // Faster turn near boundary
          const maxAngleChange = Math.PI * delta * baseTurnRate;
          const clampedAngleDiff = Math.max(-maxAngleChange, Math.min(maxAngleChange, angleDiff));
          seaplane.angle += clampedAngleDiff;
          
          // Normalize angle after update
          seaplane.angle = seaplane.angle % (Math.PI * 2);
          if (seaplane.angle < 0) seaplane.angle += Math.PI * 2;
          
          // Move forward slowly
          nextX = seaplane.x + Math.cos(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          nextY = seaplane.y + Math.sin(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          
          // Final boundary check - don't actually leave water
          if (!isOverWaterCallback(nextX, nextY)) {
            // Stop and turn toward bay center
            seaplane.targetAngle = normalizedAngleToCenter;
            nextX = seaplane.x;
            nextY = seaplane.y;
          }
          
          // Spawn wake particles
          const wakeSpawnInterval = isMobile ? 0.08 : WAKE_SPAWN_INTERVAL;
          seaplane.wakeSpawnProgress += delta;
          if (seaplane.wakeSpawnProgress >= wakeSpawnInterval) {
            seaplane.wakeSpawnProgress -= wakeSpawnInterval;
            const behindSeaplane = -8;
            seaplane.wake.push({
              x: seaplane.x + Math.cos(seaplane.angle) * behindSeaplane,
              y: seaplane.y + Math.sin(seaplane.angle) * behindSeaplane,
              age: 0,
              opacity: 1
            });
          }
          
          // Time to take off - head toward bay center first
          if (seaplane.taxiTime <= 0) {
            seaplane.state = 'taking_off';
            seaplane.speed = SEAPLANE_TAKEOFF_SPEED;
            // Take off toward bay center (so we stay over water longer)
            seaplane.angle = angleToBayCenter + (Math.random() - 0.5) * 0.8; // Slight randomness
            seaplane.targetAngle = seaplane.angle;
          }
          break;
        }
        
        case 'taking_off': {
          // Accelerate and climb (faster takeoff)
          seaplane.speed = Math.min(SEAPLANE_FLIGHT_SPEED_MAX, seaplane.speed + delta * 50);
          seaplane.altitude = Math.min(1, seaplane.altitude + delta * 0.6);
          
          nextX = seaplane.x + Math.cos(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          nextY = seaplane.y + Math.sin(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          
          // Still spawn wake while on water
          if (seaplane.altitude < 0.3) {
            const wakeSpawnInterval = isMobile ? 0.04 : WAKE_SPAWN_INTERVAL / 2; // More frequent during takeoff
            seaplane.wakeSpawnProgress += delta;
            if (seaplane.wakeSpawnProgress >= wakeSpawnInterval) {
              seaplane.wakeSpawnProgress -= wakeSpawnInterval;
              const behindSeaplane = -10;
              seaplane.wake.push({
                x: seaplane.x + Math.cos(seaplane.angle) * behindSeaplane,
                y: seaplane.y + Math.sin(seaplane.angle) * behindSeaplane,
                age: 0,
                opacity: 1
              });
            }
          }
          
          // Transition to flying when at altitude
          if (seaplane.altitude >= 1) {
            seaplane.state = 'flying';
            seaplane.speed = SEAPLANE_FLIGHT_SPEED_MIN + Math.random() * (SEAPLANE_FLIGHT_SPEED_MAX - SEAPLANE_FLIGHT_SPEED_MIN);
            seaplane.flightCount++;
          }
          break;
        }
        
        case 'flying': {
          // Fly at cruising altitude
          nextX = seaplane.x + Math.cos(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          nextY = seaplane.y + Math.sin(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          
          seaplane.lifeTime -= delta;
          
          // Safety: Check if seaplane is too far from its bay (could have flown off map)
          const distFromBayFlying = Math.hypot(seaplane.x - seaplane.bayScreenX, seaplane.y - seaplane.bayScreenY);
          // Despawn if more than ~20 tiles away (screen units)
          const maxFlyingDistance = TILE_WIDTH * 25;
          if (distFromBayFlying > maxFlyingDistance) {
            // Too far from bay, despawn to prevent getting lost/stuck
            continue;
          }
          
          // Time to land - head back to bay
          if (seaplane.lifeTime <= 5) {
            const distToBay = distFromBayFlying;
            
            // Smoothly turn toward bay (prevents sudden angle jumps)
            const angleToBay = Math.atan2(seaplane.bayScreenY - seaplane.y, seaplane.bayScreenX - seaplane.x);
            let flyingAngleDiff = angleToBay - seaplane.angle;
            while (flyingAngleDiff > Math.PI) flyingAngleDiff -= Math.PI * 2;
            while (flyingAngleDiff < -Math.PI) flyingAngleDiff += Math.PI * 2;
            // Smooth turn toward bay
            const flyingTurnRate = Math.PI * delta * 0.8; // Max ~144 degrees per second
            seaplane.angle += Math.max(-flyingTurnRate, Math.min(flyingTurnRate, flyingAngleDiff));
            
            // Start landing approach when close to bay
            if (distToBay < 300) {
              // Validate bay center is still over water before landing
              if (isOverWaterCallback(seaplane.bayScreenX, seaplane.bayScreenY)) {
                seaplane.state = 'landing';
                seaplane.targetAltitude = 0;
              } else {
                // Bay no longer valid, despawn
                continue;
              }
            }
          } else if (seaplane.lifeTime <= 0) {
            // Out of time - despawn
            continue;
          }
          
          // Gentle course corrections while flying
          if (Math.random() < 0.01) {
            seaplane.angle += (Math.random() - 0.5) * 0.2;
          }
          break;
        }
        
        case 'landing': {
          // Descend and slow down
          seaplane.speed = Math.max(SEAPLANE_TAKEOFF_SPEED, seaplane.speed - delta * 15);
          seaplane.altitude = Math.max(0, seaplane.altitude - delta * 0.25);
          
          // Safety check: if bay is no longer valid water, despawn before landing on land
          if (!isOverWaterCallback(seaplane.bayScreenX, seaplane.bayScreenY)) {
            // Bay is no longer water, despawn
            continue;
          }
          
          // Smoothly adjust angle toward bay center (prevents sudden jumps)
          const angleToBay = Math.atan2(seaplane.bayScreenY - seaplane.y, seaplane.bayScreenX - seaplane.x);
          let landingAngleDiff = angleToBay - seaplane.angle;
          while (landingAngleDiff > Math.PI) landingAngleDiff -= Math.PI * 2;
          while (landingAngleDiff < -Math.PI) landingAngleDiff += Math.PI * 2;
          // Smooth turn toward landing target
          const landingTurnRate = Math.PI * delta * 0.5; // Max ~90 degrees per second
          seaplane.angle += Math.max(-landingTurnRate, Math.min(landingTurnRate, landingAngleDiff));
          
          nextX = seaplane.x + Math.cos(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          nextY = seaplane.y + Math.sin(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          
          // Transition to splashdown when very low
          if (seaplane.altitude <= 0.1) {
            // Final check: only transition if current position is still approaching water
            seaplane.state = 'splashdown';
          }
          break;
        }
        
        case 'splashdown': {
          // Touch down on water and decelerate
          seaplane.altitude = 0;
          seaplane.speed = Math.max(0, seaplane.speed - delta * 25);
          
          nextX = seaplane.x + Math.cos(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          nextY = seaplane.y + Math.sin(seaplane.angle) * seaplane.speed * delta * speedMultiplier;
          
          // Check if over water during splashdown
          if (!isOverWaterCallback(nextX, nextY)) {
            // Stop if not over water
            nextX = seaplane.x;
            nextY = seaplane.y;
            seaplane.speed = 0;
          }
          
          // Spawn wake during splashdown
          if (seaplane.speed > 5) {
            const wakeSpawnInterval = isMobile ? 0.04 : WAKE_SPAWN_INTERVAL / 2;
            seaplane.wakeSpawnProgress += delta;
            if (seaplane.wakeSpawnProgress >= wakeSpawnInterval) {
              seaplane.wakeSpawnProgress -= wakeSpawnInterval;
              const behindSeaplane = -10;
              seaplane.wake.push({
                x: seaplane.x + Math.cos(seaplane.angle) * behindSeaplane,
                y: seaplane.y + Math.sin(seaplane.angle) * behindSeaplane,
                age: 0,
                opacity: 1
              });
            }
          }
          
          // When stopped, decide next action based on flight count
          if (seaplane.speed <= 1) {
            // Check if we've completed enough flights to despawn
            if (seaplane.flightCount >= SEAPLANE_MAX_FLIGHTS) {
              // Seaplane has done enough flights, remove it
              continue;
            }
            
            // Check if we're actually over water - if not, despawn (landed on land/outside map)
            if (!isOverWaterCallback(seaplane.x, seaplane.y)) {
              // Landed on land or outside map, despawn
              continue;
            }
            
            // Otherwise, continue the cycle - taxi to dock or taxi around
            if (seaplane.dockScreenX !== null && seaplane.dockScreenY !== null) {
              // Has a dock, taxi to it
              seaplane.state = 'taxiing_to_dock';
              seaplane.speed = SEAPLANE_WATER_SPEED * (0.8 + Math.random() * 0.4);
            } else {
              // No dock, just taxi around then take off again
              seaplane.state = 'taxiing_water';
              seaplane.speed = SEAPLANE_WATER_SPEED * (0.8 + Math.random() * 0.4);
              seaplane.taxiTime = SEAPLANE_TAXI_TIME_MIN + Math.random() * (SEAPLANE_TAXI_TIME_MAX - SEAPLANE_TAXI_TIME_MIN);
            }
            
            // Reset flight time for next flight
            seaplane.lifeTime = SEAPLANE_FLIGHT_TIME_MIN + Math.random() * (SEAPLANE_FLIGHT_TIME_MAX - SEAPLANE_FLIGHT_TIME_MIN);
          }
          break;
        }
      }
      
      // Update position
      seaplane.x = nextX;
      seaplane.y = nextY;
      
      updatedSeaplanes.push(seaplane);
    }
    
    seaplanesRef.current = updatedSeaplanes;
  }, [worldStateRef, gridVersionRef, cachedPopulationRef, seaplanesRef, seaplaneIdRef, seaplaneSpawnTimerRef, findBaysCallback, findDocksCallback, isOverWaterCallback, isMobile]);

  return {
    updateSeaplanes,
    findBaysCallback,
    findDocksCallback,
  };
}
