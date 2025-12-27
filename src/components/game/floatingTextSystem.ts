import { useCallback } from 'react';
import { FloatingText, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import { gridToScreen } from './utils';

export interface FloatingTextSystemRefs {
  floatingTextsRef: React.MutableRefObject<FloatingText[]>;
  floatingTextIdRef: React.MutableRefObject<number>;
}

export interface FloatingTextSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  isMobile: boolean;
}

export function useFloatingTextSystem(
  refs: FloatingTextSystemRefs,
  systemState: FloatingTextSystemState
) {
  const { floatingTextsRef, floatingTextIdRef } = refs;
  const { worldStateRef } = systemState;

  const spawnFloatingText = useCallback((tileX: number, tileY: number, text: string, color: string) => {
    floatingTextsRef.current.push({
      id: floatingTextIdRef.current++,
      tileX,
      tileY,
      text,
      color,
      age: 0,
      maxAge: 2.0, // 2 seconds duration
      offsetY: 0,
      opacity: 1,
    });
  }, [floatingTextsRef, floatingTextIdRef]);

  const updateFloatingText = useCallback((delta: number) => {
    const texts = floatingTextsRef.current;
    if (texts.length === 0) return;

    // Filter out expired texts
    floatingTextsRef.current = texts.filter(text => {
      text.age += delta;
      
      // Animate upward
      // Ease out: starts fast, slows down
      const progress = text.age / text.maxAge;
      text.offsetY = -40 * (1 - Math.pow(1 - progress, 2)); // Move up 40 pixels total
      
      // Fade out in the last 30% of life
      if (progress > 0.7) {
        text.opacity = 1 - (progress - 0.7) / 0.3;
      }

      return text.age < text.maxAge;
    });
  }, [floatingTextsRef]);

  const drawFloatingText = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset, zoom, grid, gridSize } = worldStateRef.current;
    if (!grid || gridSize === 0 || floatingTextsRef.current.length === 0) return;

    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Geist Mono", monospace';
    // Add shadow/outline for readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    for (const text of floatingTextsRef.current) {
      const { screenX, screenY } = gridToScreen(text.tileX, text.tileY, 0, 0);
      
      // Position above the tile center
      const x = screenX + TILE_WIDTH / 2;
      const y = screenY + text.offsetY;

      ctx.globalAlpha = text.opacity;
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, x, y);
    }

    ctx.restore();
  }, [worldStateRef, floatingTextsRef]);

  return {
    spawnFloatingText,
    updateFloatingText,
    drawFloatingText,
  };
}
