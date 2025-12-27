// Procedural sprite extensions
// -----------------------------------------------------------------------------
// The built-in procedural generator can draw a decent set of placeholder
// buildings/parks/utility sprites.
//
// This module adds a lightweight extension point so you can "inject" your own
// procedurally generated assets without having to fork `proceduralSpriteSheets.ts`.
//
// Usage:
//   registerProceduralPrefixRenderer('my', ({ ctx, key, variant, x, y, w, h, rng }) => {
//     // draw into the cell... (Canvas 2D)
//     return true; // handled
//   })
//
// Then reference your sprite as `my:some_asset_key` from a SpritePack's
// `spriteOrder` or variants.

import type { ProceduralSpriteSheetVariant } from '@/lib/proceduralSpriteSheets';

export type ProceduralPrefixRenderArgs = {
  /** Raw sprite key passed to the generator (may include a prefix like "my:foo"). */
  spriteKey: string;
  /** Prefix portion (the part before ':'). */
  prefix: string;
  /** Base key portion (the part after ':'). */
  key: string;
  variant: ProceduralSpriteSheetVariant;
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  w: number;
  h: number;
  rng: () => number;
};

/**
 * A prefix renderer can draw directly into the cell and return `true` to mark the
 * sprite as handled. Returning `false`/`undefined` will fall back to the built-in
 * generator.
 */
export type ProceduralPrefixRenderer = (args: ProceduralPrefixRenderArgs) => boolean | void;

const prefixRenderers = new Map<string, ProceduralPrefixRenderer>();

// Exact-key overrides (optional)
// -----------------------------------------------------------------------------
// In many cases you want to replace an existing sprite (e.g. 'house_small')
// without changing a SpritePack's spriteOrder to add a prefix. These renderers
// are looked up by the full spriteKey string and get first priority.
const spriteKeyRenderers = new Map<string, ProceduralPrefixRenderer>();

export function registerProceduralPrefixRenderer(prefix: string, renderer: ProceduralPrefixRenderer): void {
  prefixRenderers.set(prefix, renderer);
}

export function unregisterProceduralPrefixRenderer(prefix: string): void {
  prefixRenderers.delete(prefix);
}

export function getProceduralPrefixRenderer(prefix: string): ProceduralPrefixRenderer | undefined {
  return prefixRenderers.get(prefix);
}

export function listProceduralPrefixRenderers(): string[] {
  return Array.from(prefixRenderers.keys());
}

/**
 * Register a renderer for a specific sprite key (exact match).
 *
 * This is useful when you want to override a built-in procedural sprite without
 * having to edit a SpritePack's `spriteOrder` to add a prefix.
 *
 * The renderer should return `true` when it has fully handled drawing the cell.
 * Returning `false`/`undefined` will fall back to other extension points and the
 * built-in generator.
 */
export function registerProceduralSpriteRenderer(spriteKey: string, renderer: ProceduralPrefixRenderer): void {
  spriteKeyRenderers.set(spriteKey, renderer);
}

export function unregisterProceduralSpriteRenderer(spriteKey: string): void {
  spriteKeyRenderers.delete(spriteKey);
}

export function getProceduralSpriteRenderer(spriteKey: string): ProceduralPrefixRenderer | undefined {
  return spriteKeyRenderers.get(spriteKey);
}

export function listProceduralSpriteRenderers(): string[] {
  return Array.from(spriteKeyRenderers.keys());
}

export function clearProceduralSpriteRenderers(): void {
  spriteKeyRenderers.clear();
}
