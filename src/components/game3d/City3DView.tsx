'use client';

// True-3D view of the city: a perspective camera over real extruded geometry,
// as opposed to the fixed isometric projection used by CanvasIsometricGrid.
//
// Controls: left-drag pans (or paints with a build tool selected), right-drag
// orbits, wheel zooms, click selects/builds.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { TOOL_INFO } from '@/types/game';
import { Camera3D, FIELD_OF_VIEW, MAX_DISTANCE, MAX_PITCH, MIN_DISTANCE, MIN_PITCH } from './camera3d';
import { CarSystem3D } from './carSystem3d';
import { buildCityMesh } from './meshBuilder';
import { computeAtmosphere } from './atmosphere';
import { HighlightRect, MAX_CAR_INSTANCES, Renderer3D } from './renderer3d';

const MESH_REBUILD_INTERVAL_MS = 450;
/** Effect cleanup used on early-exit paths that allocate nothing. */
const NO_CLEANUP = () => {
  // nothing to tear down
};
const INSTANCE_FLOATS = 10;

interface City3DViewProps {
  selectedTile: { x: number; y: number } | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  isMobile?: boolean;
}

type DragMode = 'none' | 'pan' | 'orbit' | 'paint';

export const City3DView = ({ selectedTile, setSelectedTile, isMobile = false }: City3DViewProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { latestStateRef, placeAtTile, visualHour } = useGame();

  const [error, setError] = useState<string | null>(null);
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);

  const rendererRef = useRef<Renderer3D | null>(null);
  const cameraRef = useRef<Camera3D | null>(null);
  const carsRef = useRef(new CarSystem3D());
  const instanceDataRef = useRef(new Float32Array(MAX_CAR_INSTANCES * INSTANCE_FLOATS));

  const hourRef = useRef(visualHour);
  const hoveredRef = useRef<{ x: number; y: number } | null>(null);
  const selectedRef = useRef<{ x: number; y: number } | null>(selectedTile);

  // The render loop reads these outside of React, so mirror them into refs.
  useEffect(() => {
    hourRef.current = visualHour;
  }, [visualHour]);
  useEffect(() => {
    selectedRef.current = selectedTile;
  }, [selectedTile]);

  const dragRef = useRef<{ mode: DragMode; lastX: number; lastY: number; moved: boolean; pointerId: number }>(
    { mode: 'none', lastX: 0, lastY: 0, moved: false, pointerId: -1 }
  );
  const lastPaintedRef = useRef<string | null>(null);

  const getCamera = useCallback(() => {
    if (cameraRef.current == null) {
      cameraRef.current = new Camera3D(
        latestStateRef.current.gridSize / 2,
        latestStateRef.current.gridSize / 2,
        isMobile ? 55 : 45
      );
    }
    return cameraRef.current;
  }, [isMobile, latestStateRef]);

  /** Convert a client point to a tile under the cursor, or null. */
  const tileAtPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const camera = getCamera();
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
    const ground = camera.screenToGround(ndcX, ndcY, 0.05);
    if (!ground) return null;
    const size = latestStateRef.current.gridSize;
    const x = Math.floor(ground.x);
    const y = Math.floor(ground.z);
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    return { x, y };
  }, [getCamera, latestStateRef]);

  // --- Renderer lifecycle ---------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return NO_CLEANUP;
    let renderer: Renderer3D;
    try {
      renderer = new Renderer3D(canvas);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialise WebGL2';
      queueMicrotask(() => setError(message));
      return NO_CLEANUP;
    }
    rendererRef.current = renderer;

    let frame = 0;
    let disposed = false;
    let lastTime = performance.now();
    let lastMeshBuild = 0;
    let lastMeshGrid: unknown = null;
    let elapsed = 0;

    const resize = () => {
      const container = containerRef.current;
      if (!container) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(container.clientWidth * dpr);
      const height = Math.round(container.clientHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      renderer.resize(width, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);

    const deckHeightAt = (x: number, y: number) => {
      const grid = latestStateRef.current.grid;
      const row = grid[y];
      if (!row || !row[x]) return 0.06;
      return row[x].building.type === 'bridge' ? 0.55 : 0.06;
    };

    const loop = () => {
      if (disposed) return;
      frame = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += dt;

      const gameState = latestStateRef.current;
      const camera = getCamera();
      camera.clampToGrid(gameState.gridSize);

      if (gameState.grid !== lastMeshGrid && now - lastMeshBuild > MESH_REBUILD_INTERVAL_MS) {
        lastMeshGrid = gameState.grid;
        lastMeshBuild = now;
        renderer.setMesh(buildCityMesh({ grid: gameState.grid, gridSize: gameState.gridSize }));
        carsRef.current.refreshRoads(gameState.grid, gameState.gridSize);
      }

      carsRef.current.update(dt, gameState.grid, gameState.gridSize, isMobile ? 220 : MAX_CAR_INSTANCES);
      const carCount = carsRef.current.writeInstances(instanceDataRef.current, deckHeightAt);

      const highlights: HighlightRect[] = [];
      const selected = selectedRef.current;
      if (selected) {
        highlights.push({ x: selected.x, y: selected.y, width: 1, height: 1, color: [1, 1, 1, 0.35] });
      }
      const hovered = hoveredRef.current;
      if (hovered) {
        const tool = gameState.selectedTool;
        const footprint = TOOL_INFO[tool]?.size ?? 1;
        const isBulldoze = tool === 'bulldoze';
        highlights.push({
          x: hovered.x,
          y: hovered.y,
          width: footprint,
          height: footprint,
          color: isBulldoze ? [1, 0.35, 0.3, 0.45] : [0.4, 0.95, 0.6, 0.35],
        });
      }

      renderer.render({
        camera,
        atmosphere: computeAtmosphere(hourRef.current),
        time: elapsed,
        carInstances: instanceDataRef.current,
        carCount,
        highlights,
      });
    };
    frame = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [getCamera, isMobile, latestStateRef]);

  // --- Pointer interaction --------------------------------------------------
  const applyTool = useCallback((clientX: number, clientY: number) => {
    const tile = tileAtPointer(clientX, clientY);
    if (!tile) return;
    const key = `${tile.x},${tile.y}`;
    if (lastPaintedRef.current === key) return;
    lastPaintedRef.current = key;
    placeAtTile(tile.x, tile.y);
  }, [placeAtTile, tileAtPointer]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const tool = latestStateRef.current.selectedTool;
    const orbit = event.button === 2 || event.button === 1 || event.shiftKey;
    const mode: DragMode = orbit ? 'orbit' : tool === 'select' ? 'pan' : 'paint';
    dragRef.current = { mode, lastX: event.clientX, lastY: event.clientY, moved: false, pointerId: event.pointerId };
    lastPaintedRef.current = null;
    if (mode === 'paint') applyTool(event.clientX, event.clientY);
  }, [applyTool, latestStateRef]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const camera = getCamera();
    const drag = dragRef.current;
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;

    if (drag.mode === 'orbit') {
      camera.yaw += dx * 0.006;
      camera.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, camera.pitch + dy * 0.005));
      return;
    }

    if (drag.mode === 'pan') {
      // Screen pixels -> world units at the focal plane
      const rect = canvas.getBoundingClientRect();
      const worldPerPixel = (2 * Math.tan(FIELD_OF_VIEW / 2) * camera.distance) / Math.max(1, rect.height);
      camera.pan(-dx * worldPerPixel, dy * worldPerPixel / Math.max(0.25, Math.sin(camera.pitch)));
      return;
    }

    if (drag.mode === 'paint') {
      applyTool(event.clientX, event.clientY);
      return;
    }

    const tile = tileAtPointer(event.clientX, event.clientY);
    hoveredRef.current = tile;
    setHoveredTile((previous) => (previous?.x === tile?.x && previous?.y === tile?.y ? previous : tile));
  }, [applyTool, getCamera, tileAtPointer]);

  const endDrag = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'pan' && !drag.moved) {
      const tile = tileAtPointer(event.clientX, event.clientY);
      setSelectedTile(tile);
    }
    dragRef.current = { mode: 'none', lastX: 0, lastY: 0, moved: false, pointerId: -1 };
    lastPaintedRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [setSelectedTile, tileAtPointer]);

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const camera = getCamera();
    const factor = Math.exp(event.deltaY * 0.0016);
    camera.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, camera.distance * factor));
  }, [getCamera]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return NO_CLEANUP;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Keyboard: rotate with Q/E, tilt with R/F
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const camera = getCamera();
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      switch (event.key.toLowerCase()) {
        case 'q': camera.yaw -= 0.12; break;
        case 'e': camera.yaw += 0.12; break;
        case 'r': camera.pitch = Math.min(MAX_PITCH, camera.pitch + 0.08); break;
        case 'f': camera.pitch = Math.max(MIN_PITCH, camera.pitch - 0.08); break;
        default: return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [getCamera]);

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-200 text-sm p-6 text-center">
        3D view unavailable: {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => { hoveredRef.current = null; setHoveredTile(null); }}
        onContextMenu={(event) => event.preventDefault()}
      />
      <div className="absolute bottom-3 left-3 rounded-md bg-slate-900/70 px-3 py-2 text-[11px] leading-4 text-slate-200 pointer-events-none">
        <div>Drag to pan · Right-drag to orbit · Scroll to zoom</div>
        {hoveredTile && <div className="text-slate-400">Tile {hoveredTile.x}, {hoveredTile.y}</div>}
      </div>
    </div>
  );
};
