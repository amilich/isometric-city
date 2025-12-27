// User procedural assets entrypoint
// -----------------------------------------------------------------------------
// This file is intended for *your project* to register any procedural sprite
// renderers (Canvas 2D) without editing the core generator.
//
// By default, this is a no-op. Add your own registrations below.
//
// Example (prefix-based):
//   registerProceduralPrefixRenderer('my', ({ ctx, key, x, y, w, h }) => {
//     // draw...
//     return true;
//   });
//
// Example (exact key override):
//   registerProceduralSpriteRenderer('house_small', (args) => {
//     // draw...
//     return true;
//   });

import {
  registerProceduralPrefixRenderer,
  registerProceduralSpriteRenderer,
} from '@/lib/proceduralSpriteExtensions';

let didRegister = false;

export function registerProceduralUserAssets(): void {
  if (didRegister) return;
  didRegister = true;

  // Stub registrations so the imports stay "used" (and to show the pattern).
  // These have no effect unless you reference matching sprite keys.
  registerProceduralPrefixRenderer('user', () => false);
  registerProceduralSpriteRenderer('__user_noop__', () => false);

  // If you'd rather do exact-key overrides, replace the no-op above with:
  // registerProceduralSpriteRenderer('house_small', (args) => {
  //   const { ctx, x, y, w, h } = args;
  //   ctx.save();
  //   ctx.fillStyle = '#22c55e';
  //   ctx.fillRect(x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.6);
  //   ctx.restore();
  //   return true;
  // });
}
