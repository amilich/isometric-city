import { useCallback } from 'react';
import { Firework, FactorySmog, Cloud, CloudPuff, CloudType, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import { BuildingType } from '@/types/game';
import {
  FIREWORK_BUILDINGS,
  FIREWORK_COLORS,
  FIREWORK_PARTICLE_COUNT,
  FIREWORK_PARTICLE_SPEED,
  FIREWORK_PARTICLE_MAX_AGE,
  FIREWORK_LAUNCH_SPEED,
  FIREWORK_SPAWN_INTERVAL_MIN,
  FIREWORK_SPAWN_INTERVAL_MAX,
  FIREWORK_SHOW_DURATION,
  FIREWORK_SHOW_CHANCE,
  SMOG_PARTICLE_MAX_AGE,
  SMOG_PARTICLE_MAX_AGE_MOBILE,
  SMOG_SPAWN_INTERVAL_MEDIUM,
  SMOG_SPAWN_INTERVAL_LARGE,
  SMOG_SPAWN_INTERVAL_MOBILE_MULTIPLIER,
  SMOG_DRIFT_SPEED,
  SMOG_RISE_SPEED,
  SMOG_MAX_ZOOM,
  SMOG_FADE_ZOOM,
  SMOG_BASE_OPACITY,
  SMOG_PARTICLE_SIZE_MIN,
  SMOG_PARTICLE_SIZE_MAX,
  SMOG_PARTICLE_GROWTH,
  SMOG_MAX_PARTICLES_PER_FACTORY,
  SMOG_MAX_PARTICLES_PER_FACTORY_MOBILE,
  SMOG_MIN_ZOOM,
  FIREWORK_MIN_ZOOM,
  CLOUD_MIN_ZOOM,
  CLOUD_MAX_ZOOM,
  CLOUD_FADE_ZOOM,
  CLOUD_MAX_COVERAGE,
  CLOUD_COVERAGE_FADE_END,
  CLOUD_MAX_COUNT,
  CLOUD_MAX_COUNT_MOBILE,
  CLOUD_SPAWN_INTERVAL,
  CLOUD_SPAWN_INTERVAL_MOBILE,
  CLOUD_SPEED_MIN,
  CLOUD_SPEED_MAX,
  CLOUD_SCALE_MIN,
  CLOUD_SCALE_MAX,
  CLOUD_PUFF_COUNT_MIN,
  CLOUD_PUFF_COUNT_MAX,
  CLOUD_PUFF_SIZE_MIN,
  CLOUD_PUFF_SIZE_MAX,
  CLOUD_WIDTH,
  CLOUD_DESPAWN_MARGIN,
  CLOUD_WIND_ANGLE,
  CLOUD_LAYER_SPEEDS,
  CLOUD_LAYER_OPACITY,
  CLOUD_NIGHT_OPACITY_MULT,
  CLOUD_TYPE_WEIGHTS_BY_HOUR,
  CLOUD_TYPE_WEIGHTS_DEFAULT,
  CLOUD_TYPES_ORDERED,
  CLOUD_TYPE_CONFIG,
} from './constants';
import { gridToScreen } from './utils';
import { findFireworkBuildings, findSmogFactories } from './gridFinders';

export interface EffectsSystemRefs {
  fireworksRef: React.MutableRefObject<Firework[]>;
  fireworkIdRef: React.MutableRefObject<number>;
  fireworkSpawnTimerRef: React.MutableRefObject<number>;
  fireworkShowActiveRef: React.MutableRefObject<boolean>;
  fireworkShowStartTimeRef: React.MutableRefObject<number>;
  fireworkLastHourRef: React.MutableRefObject<number>;
  factorySmogRef: React.MutableRefObject<FactorySmog[]>;
  smogLastGridVersionRef: React.MutableRefObject<number>;
  cloudsRef: React.MutableRefObject<Cloud[]>;
  cloudIdRef: React.MutableRefObject<number>;
  cloudSpawnTimerRef: React.MutableRefObject<number>;
}

export interface EffectsSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  gridVersionRef: React.MutableRefObject<number>;
  isMobile: boolean;
}

export function useEffectsSystems(
  refs: EffectsSystemRefs,
  systemState: EffectsSystemState
) {
  const {
    fireworksRef,
    fireworkIdRef,
    fireworkSpawnTimerRef,
    fireworkShowActiveRef,
    fireworkShowStartTimeRef,
    fireworkLastHourRef,
    factorySmogRef,
    smogLastGridVersionRef,
    cloudsRef,
    cloudIdRef,
    cloudSpawnTimerRef,
  } = refs;

  const { worldStateRef, gridVersionRef, isMobile } = systemState;

  // Find firework buildings callback
  const findFireworkBuildingsCallback = useCallback((): { x: number; y: number; type: BuildingType }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findFireworkBuildings(currentGrid, currentGridSize, FIREWORK_BUILDINGS);
  }, [worldStateRef]);

  // Find smog factories callback
  const findSmogFactoriesCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findSmogFactories(currentGrid, currentGridSize);
  }, [worldStateRef]);

  // Update fireworks - spawn, animate, and manage lifecycle
  const updateFireworks = useCallback((delta: number, currentHour: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;

    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Disable fireworks on mobile for performance
    if (isMobile) {
      fireworksRef.current = [];
      return;
    }
    
    // Clear fireworks when zoomed out too far (for large map performance)
    if (currentZoom < FIREWORK_MIN_ZOOM) {
      fireworksRef.current = [];
      return;
    }

    // Check if it's night time (hour >= 20 or hour < 5)
    const isNight = currentHour >= 20 || currentHour < 5;
    
    // Detect transition to night - decide if this will be a firework night
    if (currentHour !== fireworkLastHourRef.current) {
      const wasNight = fireworkLastHourRef.current >= 20 || (fireworkLastHourRef.current >= 0 && fireworkLastHourRef.current < 5);
      fireworkLastHourRef.current = currentHour;
      
      // If we just transitioned into night (hour 20)
      if (currentHour === 20 && !wasNight) {
        // Roll for firework show
        if (Math.random() < FIREWORK_SHOW_CHANCE) {
          const fireworkBuildings = findFireworkBuildingsCallback();
          if (fireworkBuildings.length > 0) {
            fireworkShowActiveRef.current = true;
            fireworkShowStartTimeRef.current = 0;
          }
        }
      }
      
      // End firework show if transitioning out of night
      if (!isNight && wasNight) {
        fireworkShowActiveRef.current = false;
        fireworksRef.current = [];
      }
    }

    // No fireworks during day or if no show is active
    if (!isNight || !fireworkShowActiveRef.current) {
      // Clear any remaining fireworks
      if (fireworksRef.current.length > 0 && !fireworkShowActiveRef.current) {
        fireworksRef.current = [];
      }
      return;
    }

    // Update show timer
    fireworkShowStartTimeRef.current += delta;
    
    // End show after duration
    if (fireworkShowStartTimeRef.current > FIREWORK_SHOW_DURATION) {
      fireworkShowActiveRef.current = false;
      return;
    }

    // Find buildings that can launch fireworks
    const fireworkBuildings = findFireworkBuildingsCallback();
    if (fireworkBuildings.length === 0) {
      fireworkShowActiveRef.current = false;
      return;
    }

    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    fireworkSpawnTimerRef.current -= delta;
    if (fireworkSpawnTimerRef.current <= 0) {
      // Pick a random building to launch from
      const building = fireworkBuildings[Math.floor(Math.random() * fireworkBuildings.length)];
      
      // Get building screen position
      const { screenX, screenY } = gridToScreen(building.x, building.y, 0, 0);
      
      // Add some randomness to launch position within the building
      const launchX = screenX + TILE_WIDTH / 2 + (Math.random() - 0.5) * TILE_WIDTH * 0.5;
      const launchY = screenY + TILE_HEIGHT / 2;
      
      // Target height (how high the firework goes before exploding)
      const targetY = launchY - 50 - Math.random() * 50;
      
      // Create firework
      fireworksRef.current.push({
        id: fireworkIdRef.current++,
        x: launchX,
        y: launchY,
        vx: (Math.random() - 0.5) * 20, // Slight horizontal variance
        vy: -FIREWORK_LAUNCH_SPEED,
        state: 'launching',
        targetY: targetY,
        color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
        particles: [],
        age: 0,
        sourceTileX: building.x,
        sourceTileY: building.y,
      });
      
      // Reset spawn timer with random interval
      fireworkSpawnTimerRef.current = FIREWORK_SPAWN_INTERVAL_MIN + Math.random() * (FIREWORK_SPAWN_INTERVAL_MAX - FIREWORK_SPAWN_INTERVAL_MIN);
    }

    // Update existing fireworks
    const updatedFireworks: Firework[] = [];
    
    for (const firework of fireworksRef.current) {
      // eslint-disable-next-line react-hooks/immutability -- intentional mutation for game animation performance
      firework.age += delta;
      
      switch (firework.state) {
        case 'launching': {
          // Move upward
          firework.x += firework.vx * delta * speedMultiplier;
          firework.y += firework.vy * delta * speedMultiplier;
          
          // Check if reached target height
          if (firework.y <= firework.targetY) {
            firework.state = 'exploding';
            firework.age = 0;
            
            // Create explosion particles
            const particleCount = FIREWORK_PARTICLE_COUNT;
            for (let i = 0; i < particleCount; i++) {
              const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.3;
              const speed = FIREWORK_PARTICLE_SPEED * (0.5 + Math.random() * 0.5);
              
              firework.particles.push({
                x: firework.x,
                y: firework.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                age: 0,
                maxAge: FIREWORK_PARTICLE_MAX_AGE * (0.7 + Math.random() * 0.3),
                color: firework.color,
                size: 2 + Math.random() * 2,
                trail: [],
              });
            }
          }
          break;
        }
        
        case 'exploding': {
          // Update particles
          let allFaded = true;
          for (const particle of firework.particles) {
            // Add current position to trail before updating
            particle.trail.push({ x: particle.x, y: particle.y, age: 0 });
            // Limit trail length
            while (particle.trail.length > 8) {
              particle.trail.shift();
            }
            // Age trail particles
            for (const tp of particle.trail) {
              tp.age += delta;
            }
            // Remove old trail particles
            particle.trail = particle.trail.filter(tp => tp.age < 0.3);
            
            particle.age += delta;
            particle.x += particle.vx * delta * speedMultiplier;
            particle.y += particle.vy * delta * speedMultiplier;
            
            // Apply gravity
            particle.vy += 150 * delta;
            
            // Apply drag
            particle.vx *= 0.98;
            particle.vy *= 0.98;
            
            if (particle.age < particle.maxAge) {
              allFaded = false;
            }
          }
          
          if (allFaded) {
            firework.state = 'fading';
            firework.age = 0;
          }
          break;
        }
        
        case 'fading': {
          // Remove firework after fading
          if (firework.age > 0.5) {
            continue; // Don't add to updated list
          }
          break;
        }
      }
      
      updatedFireworks.push(firework);
    }
    
    fireworksRef.current = updatedFireworks;
  }, [worldStateRef, fireworksRef, fireworkIdRef, fireworkSpawnTimerRef, fireworkShowActiveRef, fireworkShowStartTimeRef, fireworkLastHourRef, findFireworkBuildingsCallback, isMobile]);

  // Draw fireworks
  const drawFireworks = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Early exit if no fireworks
    if (!currentGrid || currentGridSize <= 0 || fireworksRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - 100;
    const viewTop = -currentOffset.y / currentZoom - 200;
    const viewRight = viewWidth - currentOffset.x / currentZoom + 100;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + 100;
    
    for (const firework of fireworksRef.current) {
      // Skip if outside viewport
      if (firework.x < viewLeft || firework.x > viewRight || firework.y < viewTop || firework.y > viewBottom) {
        continue;
      }
      
      if (firework.state === 'launching') {
        // Draw launching trail
        const gradient = ctx.createLinearGradient(
          firework.x, firework.y,
          firework.x - firework.vx * 0.1, firework.y - firework.vy * 0.1
        );
        gradient.addColorStop(0, firework.color);
        gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(firework.x, firework.y);
        ctx.lineTo(
          firework.x - firework.vx * 0.08,
          firework.y - firework.vy * 0.08
        );
        ctx.stroke();
        
        // Draw the firework head (bright point)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(firework.x, firework.y, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect
        ctx.fillStyle = firework.color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(firework.x, firework.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
      } else if (firework.state === 'exploding' || firework.state === 'fading') {
        // Draw particles
        for (const particle of firework.particles) {
          const alpha = Math.max(0, 1 - particle.age / particle.maxAge);
          if (alpha <= 0) continue;
          
          // Draw particle trail
          if (particle.trail.length > 1) {
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = particle.size * 0.5;
            ctx.lineCap = 'round';
            ctx.globalAlpha = alpha * 0.3;
            
            ctx.beginPath();
            ctx.moveTo(particle.trail[0].x, particle.trail[0].y);
            for (let i = 1; i < particle.trail.length; i++) {
              ctx.lineTo(particle.trail[i].x, particle.trail[i].y);
            }
            ctx.lineTo(particle.x, particle.y);
            ctx.stroke();
          }
          
          // Draw particle
          ctx.globalAlpha = alpha;
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
          ctx.fill();
          
          // Bright center
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = alpha * 0.7;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * alpha * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    
    ctx.restore();
  }, [worldStateRef, fireworksRef]);

  // Update smog particles - spawn new particles and update existing ones
  const updateSmog = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }
    
    // Clear smog when zoomed out too far (for large map performance)
    if (currentZoom < SMOG_MIN_ZOOM) {
      factorySmogRef.current = [];
      return;
    }
    
    // Skip smog updates entirely when zoomed in enough that it won't be visible
    if (currentZoom > SMOG_FADE_ZOOM) {
      return;
    }
    
    const speedMultiplier = [0, 1, 2, 4][currentSpeed] || 1;
    const adjustedDelta = delta * speedMultiplier;
    
    // Mobile performance optimizations
    const maxParticles = isMobile ? SMOG_MAX_PARTICLES_PER_FACTORY_MOBILE : SMOG_MAX_PARTICLES_PER_FACTORY;
    const particleMaxAge = isMobile ? SMOG_PARTICLE_MAX_AGE_MOBILE : SMOG_PARTICLE_MAX_AGE;
    const spawnMultiplier = isMobile ? SMOG_SPAWN_INTERVAL_MOBILE_MULTIPLIER : 1;
    
    // Rebuild factory list if grid has changed
    const currentGridVersion = gridVersionRef.current;
    if (smogLastGridVersionRef.current !== currentGridVersion) {
      smogLastGridVersionRef.current = currentGridVersion;
      
      const factories = findSmogFactoriesCallback();
      
      // Create new smog entries for factories, preserving existing particles where possible
      const existingSmogMap = new Map<string, FactorySmog>();
      for (const smog of factorySmogRef.current) {
        existingSmogMap.set(`${smog.tileX},${smog.tileY}`, smog);
      }
      
      factorySmogRef.current = factories.map(factory => {
        const key = `${factory.x},${factory.y}`;
        const existing = existingSmogMap.get(key);
        
        // Calculate screen position for the factory (chimney position)
        const { screenX, screenY } = gridToScreen(factory.x, factory.y, 0, 0);
        // Offset to chimney position (varies by factory size) - positioned near rooftop/smokestacks
        const chimneyOffsetX = factory.type === 'factory_large' ? TILE_WIDTH * 1.2 : TILE_WIDTH * 0.6;
        const chimneyOffsetY = factory.type === 'factory_large' ? -TILE_HEIGHT * 1.2 : -TILE_HEIGHT * 0.7;
        
        if (existing && existing.buildingType === factory.type) {
          // Update screen position but keep particles
          existing.screenX = screenX + chimneyOffsetX;
          existing.screenY = screenY + chimneyOffsetY;
          return existing;
        }
        
        return {
          tileX: factory.x,
          tileY: factory.y,
          screenX: screenX + chimneyOffsetX,
          screenY: screenY + chimneyOffsetY,
          buildingType: factory.type,
          particles: [],
          spawnTimer: Math.random(), // Randomize initial spawn timing
        };
      });
    }
    
    // Update each factory's smog
    for (const smog of factorySmogRef.current) {
      // Update spawn timer with mobile multiplier
      const baseSpawnInterval = smog.buildingType === 'factory_large' 
        ? SMOG_SPAWN_INTERVAL_LARGE 
        : SMOG_SPAWN_INTERVAL_MEDIUM;
      const spawnInterval = baseSpawnInterval * spawnMultiplier;
      
      // eslint-disable-next-line react-hooks/immutability -- intentional mutation for game animation performance
      smog.spawnTimer += adjustedDelta;
      
      // Spawn new particles (only if below particle limit)
      while (smog.spawnTimer >= spawnInterval && smog.particles.length < maxParticles) {
        smog.spawnTimer -= spawnInterval;
        
        // Calculate spawn position with some randomness around the chimney
        const spawnX = smog.screenX + (Math.random() - 0.5) * 8;
        const spawnY = smog.screenY + (Math.random() - 0.5) * 4;
        
        // Random initial velocity with upward and slight horizontal drift
        const vx = (Math.random() - 0.5) * SMOG_DRIFT_SPEED * 2;
        const vy = -SMOG_RISE_SPEED * (0.8 + Math.random() * 0.4);
        
        // Random particle properties
        const size = SMOG_PARTICLE_SIZE_MIN + Math.random() * (SMOG_PARTICLE_SIZE_MAX - SMOG_PARTICLE_SIZE_MIN);
        const maxAge = particleMaxAge * (0.7 + Math.random() * 0.6);
        
        smog.particles.push({
          x: spawnX,
          y: spawnY,
          vx,
          vy,
          age: 0,
          maxAge,
          size,
          opacity: SMOG_BASE_OPACITY * (0.8 + Math.random() * 0.4),
        });
      }
      
      // Reset spawn timer if we hit the particle limit to prevent buildup
      if (smog.particles.length >= maxParticles) {
        smog.spawnTimer = 0;
      }
      
      // Update existing particles
      smog.particles = smog.particles.filter(particle => {
        particle.age += adjustedDelta;
        
        if (particle.age >= particle.maxAge) {
          return false; // Remove old particles
        }
        
        // Update position with drift
        particle.x += particle.vx * adjustedDelta;
        particle.y += particle.vy * adjustedDelta;
        
        // Slow down horizontal drift over time
        particle.vx *= 0.995;
        
        // Slow down vertical rise as particle ages
        particle.vy *= 0.998;
        
        // Grow particle size over time
        particle.size += SMOG_PARTICLE_GROWTH * adjustedDelta;
        
        return true;
      });
    }
  }, [worldStateRef, gridVersionRef, factorySmogRef, smogLastGridVersionRef, findSmogFactoriesCallback, isMobile]);

  // Draw smog particles
  const drawSmog = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Early exit if no factories or zoom is too high (smog fades when zoomed in)
    if (!currentGrid || currentGridSize <= 0 || factorySmogRef.current.length === 0) {
      return;
    }
    
    // Calculate zoom-based opacity modifier
    // Smog is fully visible below SMOG_MAX_ZOOM, fades between MAX and FADE, invisible above FADE
    let zoomOpacity = 1;
    if (currentZoom > SMOG_FADE_ZOOM) {
      return; // Don't draw at all when fully zoomed in
    } else if (currentZoom > SMOG_MAX_ZOOM) {
      // Fade out between MAX and FADE zoom levels
      zoomOpacity = 1 - (currentZoom - SMOG_MAX_ZOOM) / (SMOG_FADE_ZOOM - SMOG_MAX_ZOOM);
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    // Calculate viewport bounds
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - 100;
    const viewTop = -currentOffset.y / currentZoom - 200;
    const viewRight = viewWidth - currentOffset.x / currentZoom + 100;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + 100;
    
    // Draw all smog particles
    for (const smog of factorySmogRef.current) {
      for (const particle of smog.particles) {
        // Skip if outside viewport
        if (particle.x < viewLeft || particle.x > viewRight || 
            particle.y < viewTop || particle.y > viewBottom) {
          continue;
        }
        
        // Calculate age-based opacity (fade in quickly, fade out slowly)
        const ageRatio = particle.age / particle.maxAge;
        let ageOpacity: number;
        if (ageRatio < 0.1) {
          // Quick fade in
          ageOpacity = ageRatio / 0.1;
        } else {
          // Slow fade out
          ageOpacity = 1 - ((ageRatio - 0.1) / 0.9);
        }
        
        const finalOpacity = particle.opacity * ageOpacity * zoomOpacity;
        if (finalOpacity <= 0.01) continue;
        
        // Draw smog particle as a soft, slightly gray circle
        ctx.fillStyle = `rgba(100, 100, 110, ${finalOpacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add a lighter inner glow for depth
        const innerSize = particle.size * 0.6;
        ctx.fillStyle = `rgba(140, 140, 150, ${finalOpacity * 0.5})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y - particle.size * 0.1, innerSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    ctx.restore();
  }, [worldStateRef, factorySmogRef]);

  // Pick cloud type based on time-of-day weights (climate diversity)
  const pickCloudType = useCallback((currentHour: number): CloudType => {
    const hour = Math.floor(currentHour) % 24;
    const weights = CLOUD_TYPE_WEIGHTS_BY_HOUR[hour] ?? CLOUD_TYPE_WEIGHTS_DEFAULT;
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < CLOUD_TYPES_ORDERED.length; i++) {
      r -= weights[i];
      if (r <= 0) return CLOUD_TYPES_ORDERED[i];
    }
    return CLOUD_TYPES_ORDERED[0];
  }, []);

  // Small jitter helper - keeps patterns coherent while adding natural variation
  const jitter = (base: number, range: number) => base + (Math.random() - 0.5) * range;

  // Generate cloud puffs with proper geometric patterns - coherent, natural grouping per type
  const generateCloudPuffs = useCallback((cloudType: CloudType): CloudPuff[] => {
    const cfg = CLOUD_TYPE_CONFIG[cloudType];
    const [sxMin, sxMax] = cfg.puffStretchX;
    const [syMin, syMax] = cfg.puffStretchY;
    const stretchX = () => sxMin + Math.random() * (sxMax - sxMin);
    const stretchY = () => syMin + Math.random() * (syMax - syMin);
    const puffs: CloudPuff[] = [];

    switch (cloudType) {
      case 'cumulus': {
        // Coherent cotton-ball cluster: 1 large center, ring of medium, outer accents. Heavy overlap.
        // Center (dominant)
        puffs.push({ offsetX: jitter(0, 6), offsetY: jitter(0, 5), size: jitter(42, 10), opacity: 0.9, stretchX: undefined, stretchY: undefined });
        // Inner ring (4–5 medium, tight cluster around center)
        const innerCount = 4 + Math.floor(Math.random() * 2);
        for (let i = 0; i < innerCount; i++) {
          const angle = (i / innerCount) * Math.PI * 2 + 0.3;
          const dist = jitter(18, 6);
          puffs.push({
            offsetX: Math.cos(angle) * dist + jitter(0, 5),
            offsetY: Math.sin(angle) * dist * 0.7 + jitter(0, 4),
            size: jitter(32, 8),
            opacity: 0.75 + Math.random() * 0.2,
          });
        }
        // Outer accents (2–3 smaller, extend the cluster naturally)
        const outerCount = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < outerCount; i++) {
          const angle = (i / outerCount) * Math.PI * 2 + 0.7;
          const dist = jitter(38, 8);
          puffs.push({
            offsetX: Math.cos(angle) * dist + jitter(0, 6),
            offsetY: Math.sin(angle) * dist * 0.6 + jitter(0, 5),
            size: jitter(24, 6),
            opacity: 0.6 + Math.random() * 0.25,
          });
        }
        break;
      }

      case 'stratus': {
        // Horizontal band/layer: row of wide flat puffs, heavily overlapping. Y tight, X spans wide.
        const count = 7 + Math.floor(Math.random() * 4);
        const span = 130;
        for (let i = 0; i < count; i++) {
          const t = count > 1 ? i / (count - 1) - 0.5 : 0;
          puffs.push({
            offsetX: t * span + jitter(0, 10),
            offsetY: jitter(2, 6),
            size: jitter(48, 12),
            opacity: 0.7 + Math.random() * 0.2,
            stretchX: stretchX(),
            stretchY: stretchY(),
          });
        }
        break;
      }

      case 'cirrus': {
        // Wispy line: 3–4 elongated puffs along a gentle curve (not scattered)
        const points = [[-40, 3], [-15, -1], [10, 2], [38, -2]]; // gentle S-curve
        const n = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
          const [ox, oy] = points[i];
          puffs.push({
            offsetX: jitter(ox, 8),
            offsetY: jitter(oy, 4),
            size: jitter(28, 6),
            opacity: 0.5 + Math.random() * 0.3,
            stretchX: stretchX(),
            stretchY: stretchY(),
          });
        }
        break;
      }

      case 'cumulonimbus': {
        // Vertical tower: base (dark) at bottom, middle transition, bright anvil on top
        // Base row (2–3 large, portion: base)
        puffs.push({ offsetX: jitter(-18, 6), offsetY: jitter(22, 5), size: jitter(38, 8), opacity: 0.85, portion: 'base' });
        puffs.push({ offsetX: jitter(12, 6), offsetY: jitter(18, 5), size: jitter(36, 8), opacity: 0.85, portion: 'base' });
        // Middle (2 medium, mix)
        puffs.push({ offsetX: jitter(-8, 5), offsetY: jitter(6, 4), size: jitter(32, 6), opacity: 0.8, portion: 'base' });
        puffs.push({ offsetX: jitter(10, 5), offsetY: jitter(2, 4), size: jitter(30, 6), opacity: 0.8, portion: 'top' });
        // Anvil top (1–2 smaller, portion: top)
        puffs.push({ offsetX: jitter(0, 8), offsetY: jitter(-12, 4), size: jitter(28, 6), opacity: 0.9, portion: 'top' });
        puffs.push({ offsetX: jitter(-15, 6), offsetY: jitter(-8, 4), size: jitter(24, 4), opacity: 0.85, portion: 'top' });
        break;
      }

      case 'altocumulus': {
        // Mackerel / regular pattern: 2 offset rows, rhythmic spacing (not random scatter)
        const row1X = [-50, -25, 0, 25, 50];
        const row2X = [-38, -12, 12, 38]; // half-phase offset
        for (const x of row1X) {
          puffs.push({
            offsetX: jitter(x, 6),
            offsetY: jitter(-5, 3),
            size: jitter(26, 6),
            opacity: 0.65 + Math.random() * 0.2,
            stretchX: stretchX(),
            stretchY: stretchY(),
          });
        }
        for (const x of row2X) {
          puffs.push({
            offsetX: jitter(x, 6),
            offsetY: jitter(6, 3),
            size: jitter(24, 5),
            opacity: 0.6 + Math.random() * 0.2,
            stretchX: stretchX(),
            stretchY: stretchY(),
          });
        }
        break;
      }

      default: {
        // Fallback: simple cluster similar to cumulus
        puffs.push({ offsetX: 0, offsetY: 0, size: 40, opacity: 0.85 });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          puffs.push({ offsetX: Math.cos(a) * 20 + jitter(0, 5), offsetY: Math.sin(a) * 14 + jitter(0, 4), size: jitter(30, 6), opacity: 0.7 });
        }
      }
    }

    return puffs;
  }, []);

  // Spawn a new cloud - at random upwind edge, or at overridePosition (for cloud groups).
  // overrideCloudType: when spawning a companion in a group, use same type as lead for coherent banks.
  const spawnCloud = useCallback((currentHour: number, opts?: { position?: { x: number; y: number }; cloudType?: CloudType }) => {
    const { canvasSize, zoom, offset } = worldStateRef.current;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    
    const cloudType = opts?.cloudType ?? pickCloudType(currentHour);
    const cfg = CLOUD_TYPE_CONFIG[cloudType];
    
    const viewWidth = canvasSize.width / (dpr * zoom);
    const viewHeight = canvasSize.height / (dpr * zoom);
    const viewLeft = -offset.x / zoom;
    const viewTop = -offset.y / zoom;
    
    const windX = Math.cos(CLOUD_WIND_ANGLE);
    const windY = Math.sin(CLOUD_WIND_ANGLE);
    
    // Use override (for group companion) or compute from edge
    let spawnX: number;
    let spawnY: number;
    if (opts?.position) {
      spawnX = opts.position.x;
      spawnY = opts.position.y;
    } else if (Math.random() < 0.5) {
      spawnX = viewLeft - CLOUD_WIDTH;
      spawnY = viewTop + Math.random() * viewHeight;
    } else {
      spawnX = viewLeft + Math.random() * viewWidth * 0.5;
      spawnY = viewTop + viewHeight + CLOUD_WIDTH * 0.5;
    }
    
    const layer = cfg.layerRestriction >= 0 ? cfg.layerRestriction : Math.floor(Math.random() * 3);
    const speed = (CLOUD_SPEED_MIN + Math.random() * (CLOUD_SPEED_MAX - CLOUD_SPEED_MIN)) * cfg.speedMult;
    const scale = cfg.scaleMin + Math.random() * (cfg.scaleMax - cfg.scaleMin);
    const opacity = cfg.opacityMin + Math.random() * (cfg.opacityMax - cfg.opacityMin);
    
    const cloud: Cloud = {
      id: cloudIdRef.current++,
      x: spawnX,
      y: spawnY,
      vx: windX * speed * CLOUD_LAYER_SPEEDS[layer],
      vy: windY * speed * CLOUD_LAYER_SPEEDS[layer],
      scale,
      opacity: opacity * CLOUD_LAYER_OPACITY[layer],
      puffs: generateCloudPuffs(cloudType),
      layer,
      cloudType,
    };
    
    cloudsRef.current.push(cloud);
    return { x: spawnX, y: spawnY, cloudType }; // For potential group companion (same type)
  }, [worldStateRef, cloudIdRef, cloudsRef, generateCloudPuffs, pickCloudType]);

  // Update clouds - spawn new ones and move existing
  const updateClouds = useCallback((delta: number, currentHour: number) => {
    const { canvasSize, zoom, offset, speed: gameSpeed } = worldStateRef.current;
    
    // Don't update when game is paused
    if (gameSpeed === 0) {
      return;
    }
    
    // Skip clouds when very zoomed out
    if (zoom < CLOUD_MIN_ZOOM) {
      cloudsRef.current = [];
      return;
    }
    
    const maxClouds = isMobile ? CLOUD_MAX_COUNT_MOBILE : CLOUD_MAX_COUNT;
    const spawnInterval = isMobile ? CLOUD_SPAWN_INTERVAL_MOBILE : CLOUD_SPAWN_INTERVAL;
    
    // Spawn new clouds (type varies by time of day). Sometimes spawn in pairs for natural cloud banks/groups.
    cloudSpawnTimerRef.current += delta;
    if (cloudSpawnTimerRef.current >= spawnInterval && cloudsRef.current.length < maxClouds) {
      cloudSpawnTimerRef.current = 0;
      const pos = spawnCloud(currentHour);
      // 28% chance to spawn a companion cloud nearby for natural cloud banks (same type implied by same hour/weights)
      if (cloudsRef.current.length < maxClouds && Math.random() < 0.28) {
        // Companion upwind and slightly offset (so they drift as a loose group)
        // Wind is NE: offset backwards (SW) = negative in wind direction
        const windX = Math.cos(CLOUD_WIND_ANGLE);
        const windY = Math.sin(CLOUD_WIND_ANGLE);
        const alongWind = -(55 + Math.random() * 35); // 55–90px upwind
        const perp = (Math.random() - 0.5) * 44;      // ±22px perpendicular
        const companionX = pos.x + windX * alongWind + (-windY) * perp;
        const companionY = pos.y + windY * alongWind + windX * perp;
        spawnCloud(currentHour, { position: { x: companionX, y: companionY }, cloudType: pos.cloudType });
        // Slightly longer gap after a group so we get rhythm: clear patches between banks
        cloudSpawnTimerRef.current = -spawnInterval * 0.4;
      }
    }
    
    // Update existing clouds
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const viewWidth = canvasSize.width / (dpr * zoom);
    const viewHeight = canvasSize.height / (dpr * zoom);
    const viewLeft = -offset.x / zoom;
    const viewTop = -offset.y / zoom;
    const viewRight = viewLeft + viewWidth;
    const viewBottom = viewTop + viewHeight;
    
    cloudsRef.current = cloudsRef.current.filter(cloud => {
      // Move cloud
      cloud.x += cloud.vx * delta;
      cloud.y += cloud.vy * delta;
      
      // Remove if too far past viewport
      if (cloud.x > viewRight + CLOUD_DESPAWN_MARGIN ||
          cloud.y < viewTop - CLOUD_DESPAWN_MARGIN) {
        return false;
      }
      
      return true;
    });
  }, [worldStateRef, cloudsRef, cloudSpawnTimerRef, isMobile, spawnCloud]);

  // Get gradient color stops for a cloud type and portion (for cumulonimbus base/top)
  const getCloudGradientStops = (cloudType: CloudType, portion: 'base' | 'top' | undefined, puffOpacity: number): [number, string][] => {
    switch (cloudType) {
      case 'cumulus':
        // Bright white, fair-weather
        return [
          [0, `rgba(255, 255, 255, ${puffOpacity})`],
          [0.4, `rgba(250, 250, 252, ${puffOpacity * 0.9})`],
          [0.7, `rgba(245, 245, 250, ${puffOpacity * 0.5})`],
          [1, `rgba(240, 240, 248, 0)`],
        ];
      case 'stratus':
        // Gray overcast, flat layered
        return [
          [0, `rgba(220, 222, 228, ${puffOpacity})`],
          [0.35, `rgba(200, 204, 212, ${puffOpacity * 0.9})`],
          [0.65, `rgba(185, 190, 200, ${puffOpacity * 0.5})`],
          [1, `rgba(175, 180, 192, 0)`],
        ];
      case 'cirrus':
        // Wispy, faint icy white, high altitude
        return [
          [0, `rgba(255, 255, 255, ${puffOpacity * 0.9})`],
          [0.3, `rgba(248, 250, 255, ${puffOpacity * 0.6})`],
          [0.6, `rgba(240, 245, 252, ${puffOpacity * 0.25})`],
          [1, `rgba(235, 240, 250, 0)`],
        ];
      case 'cumulonimbus':
        // Storm cloud: dark base, bright anvil top
        if (portion === 'base') {
          return [
            [0, `rgba(120, 125, 140, ${puffOpacity})`],
            [0.3, `rgba(100, 108, 125, ${puffOpacity * 0.9})`],
            [0.6, `rgba(85, 92, 110, ${puffOpacity * 0.5})`],
            [1, `rgba(70, 78, 95, 0)`],
          ];
        }
        // Top / anvil: bright white
        return [
          [0, `rgba(255, 255, 255, ${puffOpacity})`],
          [0.4, `rgba(248, 248, 252, ${puffOpacity * 0.85})`],
          [0.7, `rgba(240, 242, 248, ${puffOpacity * 0.4})`],
          [1, `rgba(235, 238, 245, 0)`],
        ];
      case 'altocumulus':
        // Patchy mackerel sky, gray-white
        return [
          [0, `rgba(238, 240, 245, ${puffOpacity})`],
          [0.4, `rgba(225, 228, 235, ${puffOpacity * 0.85})`],
          [0.7, `rgba(210, 215, 225, ${puffOpacity * 0.45})`],
          [1, `rgba(200, 206, 218, 0)`],
        ];
      default:
        return [[0, `rgba(255,255,255,${puffOpacity})`], [1, `rgba(240,240,245,0)`]];
    }
  };

  // Draw a single puff (circle or ellipse based on stretch)
  const drawPuff = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, stretchX: number, stretchY: number, gradient: CanvasGradient) => {
    ctx.fillStyle = gradient;
    ctx.beginPath();
    const rx = radius * stretchX;
    const ry = radius * stretchY;
    if (Math.abs(rx - ry) < 0.5) {
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    } else {
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  };

  // Draw clouds - distinct rendering per cloud type for climate diversity
  const drawClouds = useCallback((ctx: CanvasRenderingContext2D, currentHour: number) => {
    const { offset: currentOffset, zoom: currentZoom, canvasSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    
    // Skip if no clouds or zoomed out too far
    if (cloudsRef.current.length === 0 || currentZoom < CLOUD_MIN_ZOOM) {
      return;
    }
    
    // Zoom-based fade: when zoomed in enough (focusing on city), clouds fade out
    // Fully visible when zoom <= CLOUD_MAX_ZOOM, fade to 0 between MAX and FADE, invisible above FADE
    let zoomOpacity = 1;
    if (currentZoom > CLOUD_FADE_ZOOM) {
      return; // Don't draw at all when fully zoomed in
    } else if (currentZoom > CLOUD_MAX_ZOOM) {
      zoomOpacity = 1 - (currentZoom - CLOUD_MAX_ZOOM) / (CLOUD_FADE_ZOOM - CLOUD_MAX_ZOOM);
    }
    
    // Night opacity modifier
    const isNight = currentHour >= 20 || currentHour < 6;
    const isDusk = currentHour >= 18 && currentHour < 20;
    const isDawn = currentHour >= 6 && currentHour < 8;
    let nightMult = 1.0;
    if (isNight) nightMult = CLOUD_NIGHT_OPACITY_MULT;
    else if (isDusk) nightMult = 1.0 - (1.0 - CLOUD_NIGHT_OPACITY_MULT) * ((currentHour - 18) / 2);
    else if (isDawn) nightMult = CLOUD_NIGHT_OPACITY_MULT + (1.0 - CLOUD_NIGHT_OPACITY_MULT) * ((currentHour - 6) / 2);
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - CLOUD_WIDTH;
    const viewTop = -currentOffset.y / currentZoom - CLOUD_WIDTH;
    const viewRight = viewWidth - currentOffset.x / currentZoom + CLOUD_WIDTH;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + CLOUD_WIDTH;
    const viewportArea = viewWidth * viewHeight;
    
    const sortedClouds = [...cloudsRef.current].sort((a, b) => a.layer - b.layer);
    
    // Estimate cloud coverage: sum approximate area of visible clouds / viewport area
    // When coverage exceeds CLOUD_MAX_COVERAGE, fade clouds so they don't obscure the city
    let totalCloudArea = 0;
    for (const cloud of sortedClouds) {
      if (cloud.x < viewLeft || cloud.x > viewRight || cloud.y < viewTop || cloud.y > viewBottom) continue;
      // Approximate each cloud's footprint: max puff extent squared (puffs overlap so we undercount)
      let maxExtent = 0;
      for (const puff of cloud.puffs) {
        const rx = puff.size * cloud.scale * (puff.stretchX ?? 1);
        const ry = puff.size * cloud.scale * (puff.stretchY ?? 1);
        const extent = Math.sqrt(puff.offsetX * puff.offsetX + puff.offsetY * puff.offsetY) + Math.max(rx, ry);
        if (extent > maxExtent) maxExtent = extent;
      }
      totalCloudArea += Math.PI * maxExtent * maxExtent; // circular footprint
    }
    const coverage = viewportArea > 0 ? totalCloudArea / viewportArea : 0;
    let coverageOpacity = 1;
    if (coverage > CLOUD_MAX_COVERAGE) {
      const fadeRange = CLOUD_COVERAGE_FADE_END - CLOUD_MAX_COVERAGE;
      coverageOpacity = Math.max(0, 1 - (coverage - CLOUD_MAX_COVERAGE) / fadeRange);
    }
    
    for (const cloud of sortedClouds) {
      if (cloud.x < viewLeft || cloud.x > viewRight || cloud.y < viewTop || cloud.y > viewBottom) continue;
      
      const finalOpacity = cloud.opacity * nightMult * zoomOpacity * coverageOpacity;
      
      // Draw each puff with type-specific colors and shape
      for (const puff of cloud.puffs) {
        const puffX = cloud.x + puff.offsetX * cloud.scale;
        const puffY = cloud.y + puff.offsetY * cloud.scale;
        const puffSize = puff.size * cloud.scale;
        const puffOpacity = finalOpacity * puff.opacity;
        const stretchX = puff.stretchX ?? 1;
        const stretchY = puff.stretchY ?? 1;
        const maxRadius = Math.max(puffSize * stretchX, puffSize * stretchY);
        
        if (puffOpacity <= 0.01) continue;
        
        const stops = getCloudGradientStops(cloud.cloudType, puff.portion, puffOpacity);
        const gradient = ctx.createRadialGradient(puffX, puffY, 0, puffX, puffY, maxRadius);
        for (const [pos, color] of stops) gradient.addColorStop(pos, color);
        
        drawPuff(ctx, puffX, puffY, puffSize, stretchX, stretchY, gradient);
      }
      
      // Shadow/depth (skip for cirrus - too wispy; reduce for stratus)
      const shadowMult = cloud.cloudType === 'cirrus' ? 0 : cloud.cloudType === 'stratus' ? 0.1 : 0.15;
      if (shadowMult > 0) {
        const shadowY = cloud.y + 8 * cloud.scale;
        for (const puff of cloud.puffs) {
          const puffX = cloud.x + puff.offsetX * cloud.scale;
          const puffY = shadowY + puff.offsetY * cloud.scale;
          const puffSize = puff.size * cloud.scale * 0.9;
          const stretchX = puff.stretchX ?? 1;
          const stretchY = puff.stretchY ?? 1;
          const shadowOpacity = finalOpacity * puff.opacity * shadowMult;
          if (shadowOpacity <= 0.01) continue;
          
          const grad = ctx.createRadialGradient(puffX, puffY, 0, puffX, puffY, puffSize * Math.max(stretchX, stretchY));
          grad.addColorStop(0, `rgba(160, 168, 185, ${shadowOpacity})`);
          grad.addColorStop(0.5, `rgba(175, 182, 198, ${shadowOpacity * 0.5})`);
          grad.addColorStop(1, `rgba(190, 195, 208, 0)`);
          drawPuff(ctx, puffX, puffY, puffSize, stretchX, stretchY, grad);
        }
      }
    }
    
    ctx.restore();
  }, [worldStateRef, cloudsRef]);

  return {
    updateFireworks,
    drawFireworks,
    updateSmog,
    drawSmog,
    updateClouds,
    drawClouds,
    findFireworkBuildingsCallback,
    findSmogFactoriesCallback,
  };
}














