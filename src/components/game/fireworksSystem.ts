import { MutableRefObject } from 'react';
import { Firework, WorldRenderState } from '@/components/game/types';
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
  TILE_WIDTH,
  TILE_HEIGHT,
} from '@/components/game/constants';
import { findFireworkBuildings } from '@/components/game/gridFinders';
import { gridToScreen } from '@/components/game/utils';

export interface FireworkSystemRefs {
  worldStateRef: MutableRefObject<WorldRenderState>;
  fireworksRef: MutableRefObject<Firework[]>;
  fireworkIdRef: MutableRefObject<number>;
  fireworkSpawnTimerRef: MutableRefObject<number>;
  fireworkShowActiveRef: MutableRefObject<boolean>;
  fireworkShowStartTimeRef: MutableRefObject<number>;
  fireworkLastHourRef: MutableRefObject<number>;
}

export function updateFireworks(
  refs: FireworkSystemRefs,
  delta: number,
  currentHour: number,
  isMobile: boolean
): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = refs.worldStateRef.current;

  if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
    return;
  }

  if (isMobile) {
    refs.fireworksRef.current = [];
    return;
  }

  const isNight = currentHour >= 20 || currentHour < 5;

  if (currentHour !== refs.fireworkLastHourRef.current) {
    const wasNight = refs.fireworkLastHourRef.current >= 20 || (refs.fireworkLastHourRef.current >= 0 && refs.fireworkLastHourRef.current < 5);
    refs.fireworkLastHourRef.current = currentHour;

    if (currentHour === 20 && !wasNight) {
      if (Math.random() < FIREWORK_SHOW_CHANCE) {
        const fireworkBuildings = findFireworkBuildings(currentGrid, currentGridSize, FIREWORK_BUILDINGS);
        if (fireworkBuildings.length > 0) {
          refs.fireworkShowActiveRef.current = true;
          refs.fireworkShowStartTimeRef.current = 0;
        }
      }
    }

    if (!isNight && wasNight) {
      refs.fireworkShowActiveRef.current = false;
      refs.fireworksRef.current = [];
    }
  }

  if (!isNight || !refs.fireworkShowActiveRef.current) {
    if (refs.fireworksRef.current.length > 0 && !refs.fireworkShowActiveRef.current) {
      refs.fireworksRef.current = [];
    }
    return;
  }

  refs.fireworkShowStartTimeRef.current += delta;

  if (refs.fireworkShowStartTimeRef.current > FIREWORK_SHOW_DURATION) {
    refs.fireworkShowActiveRef.current = false;
    return;
  }

  const fireworkBuildings = findFireworkBuildings(currentGrid, currentGridSize, FIREWORK_BUILDINGS);
  if (fireworkBuildings.length === 0) {
    refs.fireworkShowActiveRef.current = false;
    return;
  }

  const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

  refs.fireworkSpawnTimerRef.current -= delta;
  if (refs.fireworkSpawnTimerRef.current <= 0) {
    const building = fireworkBuildings[Math.floor(Math.random() * fireworkBuildings.length)];

    const { screenX, screenY } = gridToScreen(building.x, building.y, 0, 0);

    const launchX = screenX + TILE_WIDTH / 2 + (Math.random() - 0.5) * TILE_WIDTH * 0.5;
    const launchY = screenY + TILE_HEIGHT / 2;

    const targetY = launchY - 50 - Math.random() * 50;

    refs.fireworksRef.current.push({
      id: refs.fireworkIdRef.current++,
      x: launchX,
      y: launchY,
      vx: (Math.random() - 0.5) * 20,
      vy: -FIREWORK_LAUNCH_SPEED,
      state: 'launching',
      targetY: targetY,
      color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
      particles: [],
      age: 0,
      sourceTileX: building.x,
      sourceTileY: building.y,
    });

    refs.fireworkSpawnTimerRef.current = FIREWORK_SPAWN_INTERVAL_MIN + Math.random() * (FIREWORK_SPAWN_INTERVAL_MAX - FIREWORK_SPAWN_INTERVAL_MIN);
  }

  const updatedFireworks: Firework[] = [];

  for (const firework of refs.fireworksRef.current) {
    firework.age += delta;

    switch (firework.state) {
      case 'launching': {
        firework.x += firework.vx * delta * speedMultiplier;
        firework.y += firework.vy * delta * speedMultiplier;

        if (firework.y <= firework.targetY) {
          firework.state = 'exploding';
          firework.age = 0;

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
        let allFaded = true;
        for (const particle of firework.particles) {
          particle.trail.push({ x: particle.x, y: particle.y, age: 0 });
          while (particle.trail.length > 8) {
            particle.trail.shift();
          }
          for (const tp of particle.trail) {
            tp.age += delta;
          }
          particle.trail = particle.trail.filter(tp => tp.age < 0.3);

          particle.age += delta;
          particle.x += particle.vx * delta * speedMultiplier;
          particle.y += particle.vy * delta * speedMultiplier;

          particle.vy += 150 * delta;

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
        if (firework.age > 0.5) {
          continue;
        }
        break;
      }
    }

    updatedFireworks.push(firework);
  }

  refs.fireworksRef.current = updatedFireworks;
}

export function drawFireworks(
  ctx: CanvasRenderingContext2D,
  fireworks: Firework[],
  offset: { x: number; y: number },
  zoom: number
): void {
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;

  if (fireworks.length === 0) {
    return;
  }

  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);

  const viewWidth = canvas.width / (dpr * zoom);
  const viewHeight = canvas.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom - 100;
  const viewTop = -offset.y / zoom - 200;
  const viewRight = viewWidth - offset.x / zoom + 100;
  const viewBottom = viewHeight - offset.y / zoom + 100;

  for (const firework of fireworks) {
    if (firework.x < viewLeft || firework.x > viewRight || firework.y < viewTop || firework.y > viewBottom) {
      continue;
    }

    if (firework.state === 'launching') {
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

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(firework.x, firework.y, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = firework.color;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(firework.x, firework.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

    } else if (firework.state === 'exploding' || firework.state === 'fading') {
      for (const particle of firework.particles) {
        const alpha = Math.max(0, 1 - particle.age / particle.maxAge);
        if (alpha <= 0) continue;

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

        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
        ctx.fill();

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
}
