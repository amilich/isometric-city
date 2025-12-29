import { useCallback } from 'react';
import { Barge, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import {
  BARGE_COLORS,
  BARGE_MIN_ZOOM,
  BARGE_SPEED_MIN,
  BARGE_SPEED_MAX,
  MAX_BARGES,
  MAX_BARGES_MOBILE,
  BARGE_SPAWN_INTERVAL_MIN,
  BARGE_SPAWN_INTERVAL_MAX,
  BARGE_DOCK_TIME_MIN,
  BARGE_DOCK_TIME_MAX,
  BARGE_CARGO_VALUE_MIN,
  BARGE_CARGO_VALUE_MAX,
  BARGE_WAKE_SPAWN_INTERVAL,
  WAKE_MAX_AGE,
  WAKE_MIN_ZOOM_MOBILE,
} from './constants';
import { gridToScreen } from './utils';
import {
  findOceanConnectedMarinas,
  findOceanSpawnPoints,
  findAdjacentWaterTileForMarina,
  isOverWater,
} from './gridFinders';

export interface BargeSystemRefs {
  bargesRef: React.MutableRefObject<Barge[]>;
  bargeIdRef: React.MutableRefObject<number>;
  bargeSpawnTimerRef: React.MutableRefObject<number>;
}

export interface BargeSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  isMobile: boolean;
  visualHour: number;
  onBargeDelivery?: (cargoValue: number, cargoType: number) => void;
}

export function useBargeSystem(
  refs: BargeSystemRefs,
  systemState: BargeSystemState
) {
  const { bargesRef, bargeIdRef, bargeSpawnTimerRef } = refs;
  const { worldStateRef, isMobile, visualHour, onBargeDelivery } = systemState;

  // Find ocean-connected marinas callback
  const findOceanMarinasCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findOceanConnectedMarinas(currentGrid, currentGridSize);
  }, [worldStateRef]);

  // Find ocean spawn points callback
  const findOceanSpawnPointsCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findOceanSpawnPoints(currentGrid, currentGridSize);
  }, [worldStateRef]);

  // Find adjacent water tile for marina (2x2 building) callback
  const findAdjacentWaterTileForMarinaCallback = useCallback((marinaX: number, marinaY: number) => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findAdjacentWaterTileForMarina(currentGrid, currentGridSize, marinaX, marinaY);
  }, [worldStateRef]);

  // Check if screen position is over water callback
  const isOverWaterCallback = useCallback((screenX: number, screenY: number): boolean => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return isOverWater(currentGrid, currentGridSize, screenX, screenY);
  }, [worldStateRef]);

  // Update barges - spawn from ocean edges, navigate to marinas, and return
  const updateBarges = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Clear barges if zoomed out too far
    if (currentZoom < BARGE_MIN_ZOOM) {
      bargesRef.current = [];
      return;
    }

    // Find ocean-connected marinas and spawn points
    const oceanMarinas = findOceanMarinasCallback();
    const spawnPoints = findOceanSpawnPointsCallback();
    
    // No barges if no ocean marinas or no spawn points
    if (oceanMarinas.length === 0 || spawnPoints.length === 0) {
      bargesRef.current = [];
      return;
    }

    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer - use lower limit on mobile
    const maxBarges = isMobile ? MAX_BARGES_MOBILE : MAX_BARGES;
    bargeSpawnTimerRef.current -= delta;
    if (bargesRef.current.length < maxBarges && bargeSpawnTimerRef.current <= 0) {
      // Pick a random spawn point on ocean edge
      const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
      
      // Pick a random ocean-connected marina as destination
      const targetMarina = oceanMarinas[Math.floor(Math.random() * oceanMarinas.length)];
      
      // Find the water tile adjacent to the marina (2x2) for docking position
      const waterTile = findAdjacentWaterTileForMarinaCallback(targetMarina.x, targetMarina.y);
      if (waterTile) {
        const { screenX: targetScreenX, screenY: targetScreenY } = gridToScreen(waterTile.x, waterTile.y, 0, 0);
        
        // Calculate angle from spawn to target
        const angle = Math.atan2(
          targetScreenY + TILE_HEIGHT / 2 - spawnPoint.screenY,
          targetScreenX + TILE_WIDTH / 2 - spawnPoint.screenX
        );
        
        bargesRef.current.push({
          id: bargeIdRef.current++,
          x: spawnPoint.screenX,
          y: spawnPoint.screenY,
          angle: angle,
          targetAngle: angle,
          state: 'approaching',
          speed: BARGE_SPEED_MIN + Math.random() * (BARGE_SPEED_MAX - BARGE_SPEED_MIN),
          spawnEdge: spawnPoint.edge,
          spawnScreenX: spawnPoint.screenX,
          spawnScreenY: spawnPoint.screenY,
          targetMarinaX: targetMarina.x,
          targetMarinaY: targetMarina.y,
          targetScreenX: targetScreenX + TILE_WIDTH / 2,
          targetScreenY: targetScreenY + TILE_HEIGHT / 2,
          age: 0,
          color: BARGE_COLORS[Math.floor(Math.random() * BARGE_COLORS.length)],
          wake: [],
          wakeSpawnProgress: 0,
          cargoType: Math.floor(Math.random() * 3), // 0 = containers, 1 = bulk, 2 = tanker
          cargoValue: Math.floor(BARGE_CARGO_VALUE_MIN + Math.random() * (BARGE_CARGO_VALUE_MAX - BARGE_CARGO_VALUE_MIN)),
          dockTime: 0,
          maxDockTime: BARGE_DOCK_TIME_MIN + Math.random() * (BARGE_DOCK_TIME_MAX - BARGE_DOCK_TIME_MIN),
        });
      }
      
      // Set next spawn time
      bargeSpawnTimerRef.current = BARGE_SPAWN_INTERVAL_MIN + Math.random() * (BARGE_SPAWN_INTERVAL_MAX - BARGE_SPAWN_INTERVAL_MIN);
    }

    // Update existing barges
    const updatedBarges: Barge[] = [];
    
    for (const barge of bargesRef.current) {
      barge.age += delta;
      
      // Update wake particles
      const wakeMaxAge = isMobile ? 0.8 : WAKE_MAX_AGE;
      barge.wake = barge.wake
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / wakeMaxAge) }))
        .filter(p => p.age < wakeMaxAge);
      
      // Distance to target
      const distToTarget = Math.hypot(barge.x - barge.targetScreenX, barge.y - barge.targetScreenY);
      
      // Calculate next position
      let nextX = barge.x;
      let nextY = barge.y;
      
      switch (barge.state) {
        case 'approaching': {
          // Navigate toward marina
          const angleToTarget = Math.atan2(barge.targetScreenY - barge.y, barge.targetScreenX - barge.x);
          barge.targetAngle = angleToTarget;
          
          // Smooth turning (barges turn slowly)
          let angleDiff = barge.targetAngle - barge.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          barge.angle += angleDiff * Math.min(1, delta * 1.0); // Slower turn rate than boats
          
          // Calculate next position
          nextX = barge.x + Math.cos(barge.angle) * barge.speed * delta * speedMultiplier;
          nextY = barge.y + Math.sin(barge.angle) * barge.speed * delta * speedMultiplier;
          
          // Check if approaching dock
          if (distToTarget < 80) {
            barge.state = 'docking';
          }
          
          // Safety: remove barges that have been approaching too long
          if (barge.age > 120) {
            continue;
          }
          break;
        }
        
        case 'docking': {
          // Slow down and approach dock
          barge.speed = Math.max(3, barge.speed - delta * 3);
          
          const angleToTarget = Math.atan2(barge.targetScreenY - barge.y, barge.targetScreenX - barge.x);
          barge.targetAngle = angleToTarget;
          
          // Smooth turning
          let angleDiff = barge.targetAngle - barge.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          barge.angle += angleDiff * Math.min(1, delta * 1.5);
          
          nextX = barge.x + Math.cos(barge.angle) * barge.speed * delta * speedMultiplier;
          nextY = barge.y + Math.sin(barge.angle) * barge.speed * delta * speedMultiplier;
          
          // Check if docked
          if (distToTarget < 25) {
            barge.state = 'docked';
            barge.dockTime = 0;
            barge.wake = []; // Clear wake when docked
          }
          break;
        }
        
        case 'docked': {
          // Wait at dock for loading/unloading
          barge.dockTime += delta * speedMultiplier;
          
          if (barge.dockTime >= barge.maxDockTime) {
            barge.state = 'departing';
            barge.speed = 3; // Start slow
            barge.age = 0; // Reset age for departure timer
            
            // Set target back to spawn point
            barge.targetScreenX = barge.spawnScreenX;
            barge.targetScreenY = barge.spawnScreenY;
            
            // Cargo delivery complete - trigger economic effect
            if (onBargeDelivery) {
              onBargeDelivery(barge.cargoValue, barge.cargoType);
            }
          }
          break;
        }
        
        case 'departing': {
          // Accelerate away from dock
          barge.speed = Math.min(BARGE_SPEED_MAX, barge.speed + delta * 2);
          
          const angleToSpawn = Math.atan2(barge.targetScreenY - barge.y, barge.targetScreenX - barge.x);
          barge.targetAngle = angleToSpawn;
          
          // Smooth turning
          let angleDiff = barge.targetAngle - barge.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          barge.angle += angleDiff * Math.min(1, delta * 1.0);
          
          nextX = barge.x + Math.cos(barge.angle) * barge.speed * delta * speedMultiplier;
          nextY = barge.y + Math.sin(barge.angle) * barge.speed * delta * speedMultiplier;
          
          // Switch to leaving state after some time
          if (barge.age > 3) {
            barge.state = 'leaving';
          }
          break;
        }
        
        case 'leaving': {
          // Navigate back to edge
          const angleToSpawn = Math.atan2(barge.targetScreenY - barge.y, barge.targetScreenX - barge.x);
          barge.targetAngle = angleToSpawn;
          
          // Smooth turning
          let angleDiff = barge.targetAngle - barge.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          barge.angle += angleDiff * Math.min(1, delta * 1.0);
          
          nextX = barge.x + Math.cos(barge.angle) * barge.speed * delta * speedMultiplier;
          nextY = barge.y + Math.sin(barge.angle) * barge.speed * delta * speedMultiplier;
          
          // Remove when reaching edge (or close to it)
          const distToSpawn = Math.hypot(barge.x - barge.spawnScreenX, barge.y - barge.spawnScreenY);
          if (distToSpawn < 50) {
            continue; // Remove this barge
          }
          
          // Safety: remove barges that have been leaving too long
          if (barge.age > 60) {
            continue;
          }
          break;
        }
      }
      
      // Check if next position is over water (skip for docked barges)
      if (barge.state !== 'docked') {
        if (!isOverWaterCallback(nextX, nextY)) {
          // Next position would be on land - remove the barge
          continue;
        }
        
        // Update position
        barge.x = nextX;
        barge.y = nextY;
        
        // Add wake particles when moving
        const wakeSpawnInterval = isMobile ? 0.08 : BARGE_WAKE_SPAWN_INTERVAL;
        barge.wakeSpawnProgress += delta;
        if (barge.wakeSpawnProgress >= wakeSpawnInterval) {
          barge.wakeSpawnProgress -= wakeSpawnInterval;

          // Add two wake particles behind the barge (wider wake for larger vessel)
          const behindBarge = -12;
          const wakeWidth = 8;
          barge.wake.push({
            x: barge.x + Math.cos(barge.angle) * behindBarge + Math.cos(barge.angle + Math.PI/2) * wakeWidth,
            y: barge.y + Math.sin(barge.angle) * behindBarge + Math.sin(barge.angle + Math.PI/2) * wakeWidth,
            age: 0,
            opacity: 1
          });
          barge.wake.push({
            x: barge.x + Math.cos(barge.angle) * behindBarge + Math.cos(barge.angle - Math.PI/2) * wakeWidth,
            y: barge.y + Math.sin(barge.angle) * behindBarge + Math.sin(barge.angle - Math.PI/2) * wakeWidth,
            age: 0,
            opacity: 1
          });
        }
      }
      
      updatedBarges.push(barge);
    }
    
    bargesRef.current = updatedBarges;
  }, [worldStateRef, bargesRef, bargeIdRef, bargeSpawnTimerRef, findOceanMarinasCallback, findOceanSpawnPointsCallback, findAdjacentWaterTileForMarinaCallback, isOverWaterCallback, isMobile, onBargeDelivery]);

  // Draw barges with wakes
  const drawBarges = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Don't draw barges if zoomed out
    if (currentZoom < BARGE_MIN_ZOOM) {
      return;
    }
    
    // Early exit if no barges
    if (!currentGrid || currentGridSize <= 0 || bargesRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - 150;
    const viewTop = -currentOffset.y / currentZoom - 150;
    const viewRight = viewWidth - currentOffset.x / currentZoom + 150;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + 150;
    
    // Hide wakes on mobile when zoomed out
    const showWakes = !isMobile || currentZoom >= WAKE_MIN_ZOOM_MOBILE;
    
    for (const barge of bargesRef.current) {
      // Draw wake particles first (behind barge)
      if (showWakes && barge.wake.length > 0) {
        for (const particle of barge.wake) {
          // Skip if outside viewport
          if (particle.x < viewLeft || particle.x > viewRight || particle.y < viewTop || particle.y > viewBottom) {
            continue;
          }
          
          // Wake particles expand and fade over time (larger than boat wakes)
          const size = 2 + particle.age * 3;
          const opacity = particle.opacity * 0.5;
          
          ctx.fillStyle = `rgba(200, 220, 255, ${opacity})`;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // Skip barge rendering if outside viewport
      if (barge.x < viewLeft || barge.x > viewRight || barge.y < viewTop || barge.y > viewBottom) {
        continue;
      }
      
      ctx.save();
      ctx.translate(barge.x, barge.y);
      ctx.rotate(barge.angle);
      
      // Barges are larger than boats
      const scale = 0.9;
      ctx.scale(scale, scale);
      
      // Draw foam/splash at stern when moving
      if (barge.state !== 'docked') {
        const foamOpacity = Math.min(0.6, barge.speed / 15);
        ctx.fillStyle = `rgba(255, 255, 255, ${foamOpacity})`;
        ctx.beginPath();
        ctx.ellipse(-18, 0, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Draw barge hull (large rectangular cargo ship shape)
      ctx.fillStyle = barge.color;
      ctx.beginPath();
      // Hull - more rectangular than boats
      ctx.moveTo(20, 0); // Bow
      ctx.lineTo(15, -10); // Starboard bow
      ctx.lineTo(-18, -10); // Starboard stern
      ctx.lineTo(-20, -8); // Stern corner
      ctx.lineTo(-20, 8); // Stern corner
      ctx.lineTo(-18, 10); // Port stern
      ctx.lineTo(15, 10); // Port bow
      ctx.lineTo(20, 0); // Back to bow
      ctx.closePath();
      ctx.fill();
      
      // Hull outline
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      
      // Deck (lighter color)
      ctx.fillStyle = '#555555';
      ctx.fillRect(-15, -8, 30, 16);
      
      // Draw cargo based on type
      if (barge.cargoType === 0) {
        // Containers - stacked colorful boxes
        const containerColors = ['#c0392b', '#27ae60', '#2980b9', '#f39c12'];
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 3; col++) {
            ctx.fillStyle = containerColors[(row * 3 + col) % containerColors.length];
            ctx.fillRect(-12 + col * 8, -6 + row * 6, 7, 5);
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 0.3;
            ctx.strokeRect(-12 + col * 8, -6 + row * 6, 7, 5);
          }
        }
      } else if (barge.cargoType === 1) {
        // Bulk cargo - mound of material
        ctx.fillStyle = '#8b7355';
        ctx.beginPath();
        ctx.moveTo(-12, 6);
        ctx.quadraticCurveTo(-8, -4, 0, -5);
        ctx.quadraticCurveTo(8, -4, 12, 6);
        ctx.lineTo(-12, 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#5c4d3d';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      } else {
        // Tanker - cylindrical tanks
        ctx.fillStyle = '#3498db';
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.ellipse(-6 + i * 12, 0, 5, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#2980b9';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
      
      // Bridge/wheelhouse at stern
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(-16, -4, 6, 8);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.4;
      ctx.strokeRect(-16, -4, 6, 8);
      
      // Windows on bridge
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(-15, -2, 4, 2);
      
      // Mast/antenna
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-13, -4);
      ctx.lineTo(-13, -12);
      ctx.stroke();
      
      // Navigation lights at night
      const isNight = visualHour >= 20 || visualHour < 6;
      if (isNight) {
        // White masthead light
        ctx.fillStyle = '#ffffff';
        // PERF: Skip shadowBlur on mobile - very expensive
        if (!isMobile) {
          ctx.shadowColor = '#ffffcc';
          ctx.shadowBlur = 15;
        }
        ctx.beginPath();
        ctx.arc(-13, -13, isMobile ? 1.8 : 1.2, 0, Math.PI * 2);
        ctx.fill();
        
        // Red port light (left side)
        ctx.fillStyle = '#ff3333';
        if (!isMobile) {
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.arc(-15, 8, isMobile ? 1.2 : 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Green starboard light (right side)
        ctx.fillStyle = '#33ff33';
        if (!isMobile) {
          ctx.shadowColor = '#00ff00';
          ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.arc(-15, -8, isMobile ? 1.2 : 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Stern light (white)
        ctx.fillStyle = '#ffffff';
        if (!isMobile) {
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 8;
        }
        ctx.beginPath();
        ctx.arc(-20, 0, isMobile ? 1 : 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
      }
      
      ctx.restore();
    }
    
    ctx.restore();
  }, [worldStateRef, bargesRef, visualHour, isMobile]);

  return {
    updateBarges,
    drawBarges,
  };
}
