import { useCallback } from 'react';
import { Train, WorldRenderState, TILE_HEIGHT, TILE_WIDTH } from './types';
import {
  TRAIN_COLORS,
  TRAIN_DWELL_TIME,
  TRAIN_MAX_TRAINS,
  TRAIN_MIN_STATIONS,
  TRAIN_SPAWN_INTERVAL,
  TRAIN_SPEED_RANGE,
} from './constants';
import { gridToScreen, isRailTile, findPathOnRails } from './utils';
import { findRailStations } from './gridFinders';
import { isEntityBehindBuilding, calculateViewportBounds } from './renderHelpers';

export interface TrainSystemRefs {
  trainsRef: React.MutableRefObject<Train[]>;
  trainIdRef: React.MutableRefObject<number>;
  trainSpawnTimerRef: React.MutableRefObject<number>;
}

export interface TrainSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  gridVersionRef: React.MutableRefObject<number>;
  isMobile: boolean;
}

export function useTrainSystem(
  refs: TrainSystemRefs,
  systemState: TrainSystemState
) {
  const { trainsRef, trainIdRef, trainSpawnTimerRef } = refs;
  const { worldStateRef, isMobile } = systemState;

  const spawnTrain = useCallback((stations: { x: number; y: number }[]) => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid) return false;

    const originIndex = Math.floor(Math.random() * stations.length);
    let destIndex = Math.floor(Math.random() * stations.length);
    if (destIndex === originIndex) {
      destIndex = (destIndex + 1) % stations.length;
    }
    const origin = stations[originIndex];
    const destination = stations[destIndex];

    const path = findPathOnRails(currentGrid, currentGridSize, origin.x, origin.y, destination.x, destination.y);
    if (!path || path.length < 2) {
      return false;
    }

    const speed =
      TRAIN_SPEED_RANGE.min +
      Math.random() * (TRAIN_SPEED_RANGE.max - TRAIN_SPEED_RANGE.min);

    trainsRef.current.push({
      id: trainIdRef.current++,
      path,
      pathIndex: 0,
      progress: 0,
      speed,
      direction: 1,
      color: TRAIN_COLORS[Math.floor(Math.random() * TRAIN_COLORS.length)],
      length: Math.floor(2 + Math.random() * 2), // 2-3 cars
      state: 'moving',
      dwellTimer: TRAIN_DWELL_TIME,
      fromStation: origin,
      toStation: destination,
    });

    return true;
  }, [trainsRef, trainIdRef, worldStateRef]);

  const updateTrains = useCallback((delta: number) => {
    const {
      grid: currentGrid,
      gridSize: currentGridSize,
      speed: currentSpeed,
    } = worldStateRef.current;

    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    const stations = findRailStations(currentGrid, currentGridSize);
    if (stations.length < TRAIN_MIN_STATIONS) {
      trainsRef.current = [];
      return;
    }

    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.6 : 2.2;

    trainSpawnTimerRef.current -= delta;
    if (
      trainsRef.current.length < TRAIN_MAX_TRAINS &&
      trainSpawnTimerRef.current <= 0
    ) {
      if (spawnTrain(stations)) {
        const spawnDelayJitter = isMobile ? 1 : 0.5;
        trainSpawnTimerRef.current =
          TRAIN_SPAWN_INTERVAL + Math.random() * spawnDelayJitter;
      } else {
        trainSpawnTimerRef.current = 2; // retry soon if failed
      }
    }

    const updatedTrains: Train[] = [];
    for (const train of trainsRef.current) {
      if (train.path.length < 2) continue;

      // Validate current tile still has rail
      const currentTile = train.path[train.pathIndex];
      if (!isRailTile(currentGrid, currentGridSize, currentTile.x, currentTile.y)) {
        continue;
      }

      if (train.state === 'dwell') {
        train.dwellTimer -= delta;
        if (train.dwellTimer <= 0) {
          // Determine direction based on position
          if (train.pathIndex <= 0) {
            train.direction = 1;
          } else if (train.pathIndex >= train.path.length - 1) {
            train.direction = -1;
          }
          train.state = 'moving';
          train.progress = 0;
          train.dwellTimer = TRAIN_DWELL_TIME;
        }
        updatedTrains.push(train);
        continue;
      }

      let nextIndex = train.pathIndex + train.direction;
      if (nextIndex < 0 || nextIndex >= train.path.length) {
        train.state = 'dwell';
        train.progress = 0;
        train.dwellTimer = TRAIN_DWELL_TIME;
        updatedTrains.push(train);
        continue;
      }

      train.progress += train.speed * delta * speedMultiplier;

      while (train.progress >= 1) {
        train.pathIndex = nextIndex;
        train.progress -= 1;
        nextIndex = train.pathIndex + train.direction;

        if (nextIndex < 0 || nextIndex >= train.path.length) {
          train.progress = 0;
          train.state = 'dwell';
          train.dwellTimer = TRAIN_DWELL_TIME;
          break;
        }
      }

      updatedTrains.push(train);
    }

    trainsRef.current = updatedTrains;
  }, [worldStateRef, trainsRef, trainSpawnTimerRef, spawnTrain, isMobile]);

  const drawTrains = useCallback((ctx: CanvasRenderingContext2D) => {
    const {
      offset: currentOffset,
      zoom: currentZoom,
      grid: currentGrid,
      gridSize: currentGridSize,
    } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;

    if (!currentGrid || currentGridSize <= 0 || trainsRef.current.length === 0) {
      return;
    }

    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

    const viewport = calculateViewportBounds(canvas, currentOffset, currentZoom, dpr, {
      left: TILE_WIDTH,
      right: TILE_WIDTH,
      top: TILE_HEIGHT * 2,
      bottom: TILE_HEIGHT * 2,
    });

    for (const train of trainsRef.current) {
      if (train.path.length < 2) continue;
      const startIndex = train.pathIndex;
      let nextIndex = startIndex + train.direction;
      if (nextIndex < 0 || nextIndex >= train.path.length) {
        nextIndex = startIndex;
      }

      const startTile = train.path[startIndex];
      const endTile = train.path[nextIndex];

      const startScreen = gridToScreen(startTile.x, startTile.y, 0, 0);
      const endScreen = gridToScreen(endTile.x, endTile.y, 0, 0);

      const startCenterX = startScreen.screenX + TILE_WIDTH / 2;
      const startCenterY = startScreen.screenY + TILE_HEIGHT / 2;
      const endCenterX = endScreen.screenX + TILE_WIDTH / 2;
      const endCenterY = endScreen.screenY + TILE_HEIGHT / 2;

      const centerX =
        startCenterX + (endCenterX - startCenterX) * train.progress;
      const centerY =
        startCenterY + (endCenterY - startCenterY) * train.progress;

      if (
        centerX < viewport.viewLeft - 120 ||
        centerX > viewport.viewRight + 120 ||
        centerY < viewport.viewTop - 120 ||
        centerY > viewport.viewBottom + 120
      ) {
        continue;
      }

      if (
        isEntityBehindBuilding(
          currentGrid,
          currentGridSize,
          Math.round(centerX / TILE_WIDTH),
          Math.round(centerY / TILE_HEIGHT)
        )
      ) {
        continue;
      }

      const angle = Math.atan2(endCenterY - startCenterY, endCenterX - startCenterX);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);

      const carLength = TILE_WIDTH * 0.35;
      const carWidth = TILE_WIDTH * 0.12;
      const spacing = carLength * 0.8;

      for (let i = 0; i < train.length; i++) {
        const offset = -i * spacing;
        ctx.save();
        ctx.translate(offset, 0);
        ctx.fillStyle = train.color;
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-carLength / 2, -carWidth);
        ctx.lineTo(carLength / 2, -carWidth);
        ctx.lineTo(carLength / 2 + carWidth * 0.8, 0);
        ctx.lineTo(carLength / 2, carWidth);
        ctx.lineTo(-carLength / 2, carWidth);
        ctx.lineTo(-carLength / 2 - carWidth * 0.8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(-carLength / 4, -carWidth * 0.6, carLength / 2, carWidth * 1.2);
        ctx.restore();
      }

      // Headlights
      if (train.direction === 1) {
        ctx.fillStyle = 'rgba(255,255,200,0.7)';
        ctx.beginPath();
        ctx.arc(carLength / 2 + 2, 0, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,255,200,0.7)';
        ctx.beginPath();
        ctx.arc(-carLength / 2 - 2, 0, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
  }, [worldStateRef, trainsRef]);

  return {
    updateTrains,
    drawTrains,
  };
}
