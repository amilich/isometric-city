/**
 * Pedestrian drawing utilities
 * Extracted from CanvasIsometricGrid for better modularity
 */

import { Tile } from '@/types/game';
import { Pedestrian, TILE_WIDTH, TILE_HEIGHT } from './types';
import { DIRECTION_META } from './constants';
import { gridToScreen } from './utils';
import { isEntityBehindBuilding } from './renderHelpers';

/**
 * Draw pedestrians with simple SVG-style sprites
 */
export function drawPedestrians(
  ctx: CanvasRenderingContext2D,
  pedestrians: Pedestrian[],
  grid: Tile[][],
  gridSize: number,
  viewBounds: { viewLeft: number; viewTop: number; viewRight: number; viewBottom: number }
): void {
  if (pedestrians.length === 0) return;

  pedestrians.forEach((ped) => {
    // Don't draw pedestrians that are inside buildings
    if (ped.state === 'inside_building') {
      return;
    }
    const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
    const centerX = screenX + TILE_WIDTH / 2;
    const centerY = screenY + TILE_HEIGHT / 2;
    const meta = DIRECTION_META[ped.direction];

    // Pedestrians at parks/recreation areas are centered on the tile
    // Pedestrians walking on roads are offset toward the edge (sidewalk)
    let pedX: number;
    let pedY: number;
    if (ped.state === 'at_park' || ped.state === 'at_recreation') {
      // Center on the park tile with slight random offset for variety
      const randomOffsetX = (ped.id % 7 - 3) * 2;
      const randomOffsetY = (ped.id % 5 - 2) * 2;
      pedX = centerX + randomOffsetX;
      pedY = centerY + randomOffsetY;
    } else {
      // Pedestrians walk on sidewalks - offset them toward the edge of the road
      const sidewalkOffset = ped.sidewalkSide === 'left' ? -12 : 12;
      pedX = centerX + meta.vec.dx * ped.progress + meta.normal.nx * sidewalkOffset;
      pedY = centerY + meta.vec.dy * ped.progress + meta.normal.ny * sidewalkOffset;
    }

    // Viewport culling
    if (
      pedX < viewBounds.viewLeft - 20 ||
      pedX > viewBounds.viewRight + 20 ||
      pedY < viewBounds.viewTop - 40 ||
      pedY > viewBounds.viewBottom + 40
    ) {
      return;
    }

    // Check if pedestrian is behind a building
    if (isEntityBehindBuilding(grid, gridSize, ped.tileX, ped.tileY)) {
      return;
    }

    ctx.save();
    ctx.translate(pedX, pedY);

    // Walking animation - bob up and down and sway
    // Reduced animation for pedestrians at parks (they're stationary)
    const animationScale = (ped.state === 'at_park' || ped.state === 'at_recreation') ? 0.3 : 1.0;
    const walkBob = Math.sin(ped.walkOffset) * 0.8 * animationScale;
    const walkSway = Math.sin(ped.walkOffset * 0.5) * 0.5 * animationScale;

    // Scale for pedestrian (smaller, more realistic)
    const scale = 0.35;

    // Draw simple stick figure pedestrian (SVG-style)
    // Head
    ctx.fillStyle = ped.skinColor;
    ctx.beginPath();
    ctx.arc(walkSway * scale, (-12 + walkBob) * scale, 3 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Body (shirt)
    ctx.fillStyle = ped.shirtColor;
    ctx.beginPath();
    ctx.ellipse(walkSway * scale, (-5 + walkBob) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (animated)
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1.5 * scale;
    ctx.lineCap = 'round';

    // Left leg
    const leftLegSwing = Math.sin(ped.walkOffset) * 3;
    ctx.beginPath();
    ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
    ctx.lineTo((walkSway - 1 + leftLegSwing) * scale, (5 + walkBob) * scale);
    ctx.stroke();

    // Right leg
    const rightLegSwing = Math.sin(ped.walkOffset + Math.PI) * 3;
    ctx.beginPath();
    ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
    ctx.lineTo((walkSway + 1 + rightLegSwing) * scale, (5 + walkBob) * scale);
    ctx.stroke();

    // Arms (animated)
    ctx.strokeStyle = ped.skinColor;
    ctx.lineWidth = 1.2 * scale;

    // Left arm
    const leftArmSwing = Math.sin(ped.walkOffset + Math.PI) * 2;
    ctx.beginPath();
    ctx.moveTo((walkSway - 2) * scale, (-6 + walkBob) * scale);
    ctx.lineTo((walkSway - 3 + leftArmSwing) * scale, (-2 + walkBob) * scale);
    ctx.stroke();

    // Right arm
    const rightArmSwing = Math.sin(ped.walkOffset) * 2;
    ctx.beginPath();
    ctx.moveTo((walkSway + 2) * scale, (-6 + walkBob) * scale);
    ctx.lineTo((walkSway + 3 + rightArmSwing) * scale, (-2 + walkBob) * scale);
    ctx.stroke();

    ctx.restore();
  });
}
