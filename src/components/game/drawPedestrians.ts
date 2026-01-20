/**
 * Pedestrian drawing utilities
 * Renders pedestrians with dynamic activities and states
 * OPTIMIZED for performance with LOD (Level of Detail)
 */

import { Pedestrian, PedestrianActivity, TILE_WIDTH, TILE_HEIGHT } from './types';
import { DIRECTION_META } from './constants';
import { gridToScreen } from './utils';
import { getPedestrianOpacity, getVisiblePedestrians } from './pedestrianSystem';

// LOD thresholds - draw simpler at lower zoom
const LOD_SIMPLE_ZOOM = 0.55;  // Below this, draw very simple pedestrians (just above min zoom)
const LOD_MEDIUM_ZOOM = 0.75;  // Below this, skip some details

// Hair colors for hairstyles
const HAIR_COLORS = ['#2c1810', '#4a3728', '#8b4513', '#d4a574', '#f5deb3', '#1a1a1a', '#8b0000'];

/**
 * Get Y offset to keep pedestrians visually on the sidewalk based on direction and side
 * In isometric view, the sidewalk position varies based on which way they're walking
 * and which side of the road they're on
 */
function getSidewalkYOffset(direction: 'north' | 'south' | 'east' | 'west', sidewalkSide: 'left' | 'right'): number {
  // Offsets tuned for isometric view to keep pedestrians on sidewalk
  // Negative = move up on screen, Positive = move down on screen
  if (direction === 'north') {
    return sidewalkSide === 'left' ? -2 : -6;
  } else if (direction === 'south') {
    return sidewalkSide === 'left' ? 2 : 6;
  } else if (direction === 'east') {
    return sidewalkSide === 'left' ? -6 : -2;
  } else { // west
    return sidewalkSide === 'left' ? 6 : 2;
  }
}

/**
 * Draw hair/ponytail on a pedestrian
 * @param pedId - Pedestrian ID for consistent hair color (avoids flickering)
 */
function drawHair(ctx: CanvasRenderingContext2D, headX: number, headY: number, headRadius: number, pedId: number): void {
  // Pick a hair color based on pedestrian ID (stable, no flickering)
  const hairColor = HAIR_COLORS[pedId % HAIR_COLORS.length];
  
  ctx.fillStyle = hairColor;
  
  // Draw hair on top of head
  ctx.beginPath();
  ctx.arc(headX, headY - headRadius * 0.3, headRadius * 1.1, Math.PI, 0);
  ctx.fill();
  
  // Draw ponytail or longer hair on side
  ctx.beginPath();
  ctx.ellipse(headX + headRadius * 0.8, headY + headRadius * 0.3, headRadius * 0.4, headRadius * 0.9, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Filter mode for drawing pedestrians
 * - 'all': Draw all visible pedestrians
 * - 'recreation': Only draw pedestrians at recreation areas (for drawing on top of parks)
 * - 'non-recreation': Only draw pedestrians NOT at recreation areas (for drawing below buildings)
 */
export type PedestrianFilterMode = 'all' | 'recreation' | 'non-recreation';

/**
 * Draw pedestrians with dynamic activities and states
 * Uses LOD (Level of Detail) for performance
 * 
 * @param filterMode - Controls which pedestrians to draw:
 *   - 'all': All visible pedestrians (default)
 *   - 'recreation': Only pedestrians at recreation areas (draw on buildings canvas)
 *   - 'non-recreation': Only walking/other pedestrians (draw on cars canvas)
 */
export function drawPedestrians(
  ctx: CanvasRenderingContext2D,
  pedestrians: Pedestrian[],
  viewBounds: { viewLeft: number; viewTop: number; viewRight: number; viewBottom: number },
  zoom: number = 1.0,
  filterMode: PedestrianFilterMode = 'all'
): void {
  // Get only visible pedestrians (not inside buildings)
  let visiblePedestrians = getVisiblePedestrians(pedestrians);
  
  // Apply filter mode
  if (filterMode === 'recreation') {
    // Include both recreation and beach activities
    visiblePedestrians = visiblePedestrians.filter(ped => 
      ped.state === 'at_recreation' || ped.state === 'at_beach'
    );
  } else if (filterMode === 'non-recreation') {
    visiblePedestrians = visiblePedestrians.filter(ped => 
      ped.state !== 'at_recreation' && ped.state !== 'at_beach'
    );
  }
  
  if (visiblePedestrians.length === 0) return;

  // Determine LOD level based on zoom
  const useSimpleLOD = zoom < LOD_SIMPLE_ZOOM;
  const useMediumLOD = zoom < LOD_MEDIUM_ZOOM;

  // Pre-set common styles to reduce state changes
  ctx.lineCap = 'round';

  for (let i = 0; i < visiblePedestrians.length; i++) {
    const ped = visiblePedestrians[i];
    // Calculate position based on state
    let pedX: number;
    let pedY: number;
    
    if (ped.state === 'at_recreation') {
      // At recreation area - position at destination with offset
      const { screenX, screenY } = gridToScreen(ped.destX, ped.destY, 0, 0);
      pedX = screenX + TILE_WIDTH / 2 + ped.activityOffsetX;
      pedY = screenY + TILE_HEIGHT / 2 + ped.activityOffsetY;
    } else if (ped.state === 'at_beach') {
      // At beach - position depends on activity (swimming in water, mat on land)
      if (ped.activity === 'beach_swimming') {
        // Swimmers are in the water tile, centered with small random offset
        const { screenX, screenY } = gridToScreen(ped.beachTileX, ped.beachTileY, 0, 0);
        pedX = screenX + TILE_WIDTH / 2 + ped.activityOffsetX * 0.5;
        pedY = screenY + TILE_HEIGHT / 2 + ped.activityOffsetY * 0.5;
      } else {
        // Mat users are on the land tile (beach), stay centered on their tile
        const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
        pedX = screenX + TILE_WIDTH / 2 + ped.activityOffsetX * 0.3;
        pedY = screenY + TILE_HEIGHT / 2 + ped.activityOffsetY * 0.3;
      }
    } else if (ped.state === 'approaching_shop') {
      // Approaching shop - stand at the entrance with offset
      const { screenX, screenY } = gridToScreen(ped.destX, ped.destY, 0, 0);
      // Position at the front of the shop with slight offset to show queuing
      pedX = screenX + TILE_WIDTH / 2 + ped.activityOffsetX;
      pedY = screenY + TILE_HEIGHT / 2 + 8 + ped.activityOffsetY; // Offset down to be at "entrance"
    } else if (ped.state === 'entering_building' || ped.state === 'exiting_building') {
      // At building entrance - position depends on if shopping
      const { screenX, screenY } = gridToScreen(ped.destX, ped.destY, 0, 0);
      if (ped.activity === 'shopping') {
        // Shoppers walk towards the door (animate position based on progress)
        const doorProgress = ped.state === 'entering_building' 
          ? ped.buildingEntryProgress 
          : 1 - ped.buildingEntryProgress;
        pedX = screenX + TILE_WIDTH / 2 + ped.activityOffsetX * (1 - doorProgress);
        // Move up towards the building as they enter
        pedY = screenY + TILE_HEIGHT / 2 + 8 * (1 - doorProgress) + ped.activityOffsetY * (1 - doorProgress);
      } else {
        pedX = screenX + TILE_WIDTH / 2;
        pedY = screenY + TILE_HEIGHT / 2;
      }
    } else if (ped.state === 'socializing') {
      // Socializing - standing still with offset to face conversation partner
      const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[ped.direction];
      const sidewalkOffset = ped.sidewalkSide === 'left' ? -10 : 10;
      // Y offset depends on direction AND which side of road to stay on sidewalk
      const yOffset = getSidewalkYOffset(ped.direction, ped.sidewalkSide);
      pedX = centerX + meta.vec.dx * ped.progress + meta.normal.nx * sidewalkOffset + ped.activityOffsetX;
      pedY = centerY + meta.vec.dy * ped.progress + meta.normal.ny * sidewalkOffset + ped.activityOffsetY + yOffset;
    } else if (ped.state === 'idle') {
      // Standing still at current position
      const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[ped.direction];
      const sidewalkOffset = ped.sidewalkSide === 'left' ? -10 : 10;
      // Y offset depends on direction AND which side of road to stay on sidewalk
      const yOffset = getSidewalkYOffset(ped.direction, ped.sidewalkSide);
      pedX = centerX + meta.vec.dx * ped.progress + meta.normal.nx * sidewalkOffset;
      pedY = centerY + meta.vec.dy * ped.progress + meta.normal.ny * sidewalkOffset + yOffset;
    } else {
      // Walking - normal position calculation
      const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[ped.direction];
      const sidewalkOffset = ped.sidewalkSide === 'left' ? -10 : 10;
      // Y offset depends on direction AND which side of road to stay on sidewalk
      const yOffset = getSidewalkYOffset(ped.direction, ped.sidewalkSide);
      pedX = centerX + meta.vec.dx * ped.progress + meta.normal.nx * sidewalkOffset;
      pedY = centerY + meta.vec.dy * ped.progress + meta.normal.ny * sidewalkOffset + yOffset;
    }

    // Viewport culling - be generous to avoid cutting off activities
    if (
      pedX < viewBounds.viewLeft - 50 ||
      pedX > viewBounds.viewRight + 50 ||
      pedY < viewBounds.viewTop - 60 ||
      pedY > viewBounds.viewBottom + 60
    ) {
      continue;
    }


    // Get opacity for enter/exit animations
    const opacity = getPedestrianOpacity(ped);
    if (opacity <= 0) continue;

    ctx.save();
    ctx.translate(pedX, pedY);
    if (opacity < 1) ctx.globalAlpha = opacity;

    // OPTIMIZED: Use simple LOD for zoomed out view
    if (useSimpleLOD) {
      drawSimplePedestrian(ctx, ped);
      ctx.restore();
      continue;
    }

    // Draw based on current activity/state
    // OPTIMIZED: Use medium detail for most activities when zoomed out
    if (useMediumLOD) {
      if (ped.state === 'at_recreation') {
        drawMediumActivityPedestrian(ctx, ped);
      } else {
        drawMediumWalkingPedestrian(ctx, ped);
      }
      ctx.restore();
      continue;
    }

    // Full detail drawing
    switch (ped.activity) {
      case 'playing_basketball':
        drawBasketballPlayer(ctx, ped);
        break;
      case 'playing_tennis':
        drawTennisPlayer(ctx, ped);
        break;
      case 'playing_soccer':
        drawSoccerPlayer(ctx, ped);
        break;
      case 'playing_baseball':
        drawBaseballPlayer(ctx, ped);
        break;
      case 'swimming':
        drawSwimmer(ctx, ped);
        break;
      case 'beach_swimming':
        drawBeachSwimmer(ctx, ped);
        break;
      case 'lying_on_mat':
        drawBeachMat(ctx, ped);
        break;
      case 'skateboarding':
        drawSkateboarder(ctx, ped);
        break;
      case 'sitting_bench':
        drawSittingPerson(ctx, ped);
        break;
      case 'picnicking':
        drawPicnicker(ctx, ped);
        break;
      case 'jogging':
        drawJogger(ctx, ped);
        break;
      case 'walking_dog':
        drawDogWalker(ctx, ped);
        break;
      case 'playground':
        drawPlaygroundKid(ctx, ped);
        break;
      case 'watching_game':
        drawSpectator(ctx, ped);
        break;
      case 'shopping':
        // Draw shopper based on their state
        if (ped.state === 'approaching_shop') {
          drawShopperQueuing(ctx, ped);
        } else if (ped.state === 'entering_building' || ped.state === 'exiting_building') {
          drawShopperAtDoor(ctx, ped);
        } else {
          // Walking with bag
          drawWalkingPedestrian(ctx, ped);
        }
        break;
      default:
        // Default walking/standing pedestrian
        if (ped.state === 'socializing') {
          drawSocializingPerson(ctx, ped);
        } else if (ped.state === 'idle') {
          drawIdlePerson(ctx, ped);
        } else if (ped.state === 'approaching_shop') {
          drawShopperQueuing(ctx, ped);
        } else {
          drawWalkingPedestrian(ctx, ped);
        }
    }

    ctx.restore();
  }
}

/**
 * Draw a very simple pedestrian (lowest LOD) - just colored dots
 */
function drawSimplePedestrian(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  // Just draw a small colored circle for the body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.arc(0, -1.7, 2.1, 0, Math.PI * 2);
  ctx.fill();
  
  // Head as tiny dot
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, -4.3, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw medium detail walking pedestrian
 */
function drawMediumWalkingPedestrian(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const walkBob = Math.sin(ped.walkOffset) * 0.5;
  const scale = 0.30;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + walkBob) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-5 + walkBob) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Simple legs (single stroke)
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  const legSwing = Math.sin(ped.walkOffset) * 2;
  ctx.beginPath();
  ctx.moveTo(0, (-1 + walkBob) * scale);
  ctx.lineTo(legSwing * scale, 5 * scale);
  ctx.moveTo(0, (-1 + walkBob) * scale);
  ctx.lineTo(-legSwing * scale, 5 * scale);
  ctx.stroke();
}

/**
 * Draw medium detail activity pedestrian
 */
function drawMediumActivityPedestrian(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.30;
  const anim = Math.sin(ped.activityAnimTimer);

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, -12 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(anim * scale, -5 * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Simple legs
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, -1 * scale);
  ctx.lineTo(-1.5 * scale, 5 * scale);
  ctx.moveTo(1 * scale, -1 * scale);
  ctx.lineTo(1.5 * scale, 5 * scale);
  ctx.stroke();

  // Activity indicator (colored dot for ball, etc.)
  if (ped.hasBall) {
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath();
    ctx.arc(4 * scale, 2 * scale, 1.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw a standard walking pedestrian - OPTIMIZED
 */
function drawWalkingPedestrian(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const walkBob = Math.sin(ped.walkOffset) * 0.8;
  const walkSway = Math.sin(ped.walkOffset * 0.5) * 0.5;
  const scale = 0.30;
  const legSwing = Math.sin(ped.walkOffset) * 3;

  // Draw head and body first (filled shapes)
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(walkSway * scale, (-12 + walkBob) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Add hair for ~50% of pedestrians (based on ID)
  if (ped.id % 2 === 0) {
    drawHair(ctx, walkSway * scale, (-12 + walkBob) * scale, 3 * scale, ped.id);
  }

  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(walkSway * scale, (-5 + walkBob) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw both legs in one path
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
  ctx.lineTo((walkSway - 1 + legSwing) * scale, (5 + walkBob) * scale);
  ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
  ctx.lineTo((walkSway + 1 - legSwing) * scale, (5 + walkBob) * scale);
  ctx.stroke();

  // Draw both arms in one path
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  const armSwing = legSwing * 0.67;
  ctx.beginPath();
  ctx.moveTo((walkSway - 2) * scale, (-6 + walkBob) * scale);
  ctx.lineTo((walkSway - 3 - armSwing) * scale, (-2 + walkBob) * scale);
  ctx.moveTo((walkSway + 2) * scale, (-6 + walkBob) * scale);
  ctx.lineTo((walkSway + 3 + armSwing) * scale, (-2 + walkBob) * scale);
  ctx.stroke();

  // Dog if walking one (simplified)
  if (ped.hasDog) {
    drawDogSimple(ctx, ped);
  }
}

/**
 * Draw a simplified dog for performance
 */
function drawDogSimple(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.26;
  const offsetX = 8;
  const offsetY = 3;
  
  // Dog as simple ellipse
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.ellipse(offsetX * scale, (offsetY + 3) * scale, 4 * scale, 2 * scale, 0, 0, Math.PI * 2);
  ctx.arc((offsetX + 4) * scale, (offsetY + 1) * scale, 2 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Leash
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 0.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, -2 * scale);
  ctx.lineTo(offsetX * scale, (offsetY + 2) * scale);
  ctx.stroke();
}

/**
 * Draw a basketball player
 */
function drawBasketballPlayer(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.32;
  const bounce = Math.abs(Math.sin(ped.activityAnimTimer * 1.5)) * 2;
  const armMove = Math.sin(ped.activityAnimTimer * 3) * 4;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + bounce) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Jersey (bright color)
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-5 + bounce) * scale, 3 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shorts
  ctx.fillStyle = ped.pantsColor;
  ctx.fillRect(-2 * scale, (-1 + bounce) * scale, 4 * scale, 3 * scale);

  // Legs - athletic stance
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, (2 + bounce) * scale);
  ctx.lineTo(-2 * scale, (6 + bounce) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, (2 + bounce) * scale);
  ctx.lineTo(2 * scale, (6 + bounce) * scale);
  ctx.stroke();

  // Arms - dribbling motion
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (-6 + bounce) * scale);
  ctx.lineTo((-3 + armMove * 0.3) * scale, (-1 + bounce) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, (-6 + bounce) * scale);
  ctx.lineTo((4 + armMove * 0.3) * scale, (2 + Math.abs(armMove)) * scale);
  ctx.stroke();

  // Basketball
  ctx.fillStyle = '#ff6b35';
  ctx.beginPath();
  ctx.arc((4 + armMove * 0.3) * scale, (4 + Math.abs(armMove) + bounce) * scale, 2 * scale, 0, Math.PI * 2);
  ctx.fill();
  // Ball lines
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 0.3 * scale;
  ctx.beginPath();
  ctx.arc((4 + armMove * 0.3) * scale, (4 + Math.abs(armMove) + bounce) * scale, 2 * scale, 0, Math.PI);
  ctx.stroke();
}

/**
 * Draw a tennis player
 */
function drawTennisPlayer(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.31;
  const swing = Math.sin(ped.activityAnimTimer * 1) * 5;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, -12 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Visor
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, -14 * scale, 4 * scale, 1 * scale, 0, 0, Math.PI);
  ctx.fill();

  // Polo shirt
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, -5 * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tennis skirt/shorts
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-2.5 * scale, -1 * scale, 5 * scale, 2.5 * scale);

  // Legs
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, 1.5 * scale);
  ctx.lineTo(-1.5 * scale, 6 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, 1.5 * scale);
  ctx.lineTo(2 * scale, 6 * scale);
  ctx.stroke();

  // Arms with racket
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  // Back arm
  ctx.beginPath();
  ctx.moveTo(-2 * scale, -6 * scale);
  ctx.lineTo(-3 * scale, -2 * scale);
  ctx.stroke();
  // Racket arm
  ctx.beginPath();
  ctx.moveTo(2 * scale, -6 * scale);
  ctx.lineTo((4 + swing * 0.5) * scale, (-8 + Math.abs(swing) * 0.3) * scale);
  ctx.stroke();

  // Tennis racket
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 0.8 * scale;
  ctx.beginPath();
  ctx.moveTo((4 + swing * 0.5) * scale, (-8 + Math.abs(swing) * 0.3) * scale);
  ctx.lineTo((7 + swing) * scale, (-12 + Math.abs(swing) * 0.5) * scale);
  ctx.stroke();
  // Racket head
  ctx.strokeStyle = '#228B22';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.ellipse((8 + swing) * scale, (-14 + Math.abs(swing) * 0.5) * scale, 2.5 * scale, 3 * scale, swing * 0.1, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Draw a soccer player
 */
function drawSoccerPlayer(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.31;
  const kick = Math.sin(ped.activityAnimTimer * 2) * 4;
  const run = Math.abs(Math.sin(ped.activityAnimTimer * 2.5));

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + run) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Jersey
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-5 + run) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shorts
  ctx.fillStyle = ped.pantsColor;
  ctx.fillRect(-2 * scale, (-1 + run) * scale, 4 * scale, 2.5 * scale);

  // Legs - kicking motion
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, (1.5 + run) * scale);
  ctx.lineTo((-1.5 - kick * 0.2) * scale, (6 + run) * scale);
  ctx.stroke();
  // Kicking leg
  ctx.beginPath();
  ctx.moveTo(1 * scale, (1.5 + run) * scale);
  ctx.lineTo((2 + kick) * scale, (4 + run - Math.abs(kick) * 0.3) * scale);
  ctx.stroke();

  // Soccer ball
  if (Math.abs(kick) > 2) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc((4 + kick * 1.5) * scale, (3 + run) * scale, 1.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.3 * scale;
    ctx.stroke();
  }

  // Arms running motion
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (-6 + run) * scale);
  ctx.lineTo((-3 - kick * 0.2) * scale, (-2 + run) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, (-6 + run) * scale);
  ctx.lineTo((3 + kick * 0.2) * scale, (-2 + run) * scale);
  ctx.stroke();
}

/**
 * Draw a baseball player
 */
function drawBaseballPlayer(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.31;
  const swing = Math.sin(ped.activityAnimTimer * 1) * 6;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, -12 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Baseball cap
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.arc(0, -13 * scale, 3.5 * scale, Math.PI, 0);
  ctx.fill();
  // Cap bill
  ctx.fillRect(-4 * scale, -13 * scale, 4 * scale, 1 * scale);

  // Uniform
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, -5 * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pants
  ctx.fillStyle = ped.pantsColor;
  ctx.fillRect(-2 * scale, -1 * scale, 4 * scale, 4 * scale);

  // Legs
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, 3 * scale);
  ctx.lineTo(-1.5 * scale, 7 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, 3 * scale);
  ctx.lineTo(1.5 * scale, 7 * scale);
  ctx.stroke();

  // Arms and bat
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, -6 * scale);
  ctx.lineTo((-1 + swing * 0.3) * scale, (-9) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, -6 * scale);
  ctx.lineTo((1 + swing * 0.5) * scale, (-9) * scale);
  ctx.stroke();

  // Bat
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo((swing * 0.4) * scale, -9 * scale);
  ctx.lineTo((swing * 1.2) * scale, -16 * scale);
  ctx.stroke();
}

/**
 * Draw a swimmer
 */
function drawSwimmer(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.22; // Smaller scale for pool swimmers
  const swim = Math.sin(ped.activityAnimTimer * 2);
  const bob = Math.sin(ped.activityAnimTimer * 1) * 1.5;

  // Water effect around swimmer
  ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 2 * scale, 8 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head poking out of water
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-3 + bob) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Swim cap
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.arc(0, (-4 + bob) * scale, 3 * scale, Math.PI, 0);
  ctx.fill();

  // Goggles
  ctx.fillStyle = '#333333';
  ctx.fillRect(-3 * scale, (-3 + bob) * scale, 6 * scale, 1 * scale);

  // Arms doing stroke
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  // Left arm
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (0 + bob) * scale);
  ctx.lineTo((-5 + swim * 3) * scale, (-2 + swim * 2) * scale);
  ctx.stroke();
  // Right arm
  ctx.beginPath();
  ctx.moveTo(2 * scale, (0 + bob) * scale);
  ctx.lineTo((5 - swim * 3) * scale, (-2 - swim * 2) * scale);
  ctx.stroke();

  // Splash effect
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  const splashSize = Math.abs(swim) * 2;
  ctx.beginPath();
  ctx.arc((-5 + swim * 3) * scale, 0, splashSize * scale, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw a skateboarder
 */
function drawSkateboarder(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.23; // Smaller scale for skate park
  const ride = Math.sin(ped.activityAnimTimer * 1.5);
  const bob = Math.abs(ride) * 1.5;

  // Skateboard
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(-5 * scale, (5 + bob) * scale, 10 * scale, 1.5 * scale);
  // Wheels
  ctx.fillStyle = '#333333';
  ctx.beginPath();
  ctx.arc(-3 * scale, (7 + bob) * scale, 1 * scale, 0, Math.PI * 2);
  ctx.arc(3 * scale, (7 + bob) * scale, 1 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(ride * scale, (-10 + bob) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Helmet
  ctx.fillStyle = '#333333';
  ctx.beginPath();
  ctx.arc(ride * scale, (-11 + bob) * scale, 3.5 * scale, Math.PI, 0);
  ctx.fill();

  // Body - crouched
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(ride * scale, (-4 + bob) * scale, 2.5 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bent legs
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo((-1 + ride) * scale, (0 + bob) * scale);
  ctx.quadraticCurveTo((-3 + ride) * scale, (3 + bob) * scale, (-2 + ride) * scale, (5 + bob) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((1 + ride) * scale, (0 + bob) * scale);
  ctx.quadraticCurveTo((3 + ride) * scale, (3 + bob) * scale, (2 + ride) * scale, (5 + bob) * scale);
  ctx.stroke();

  // Arms out for balance
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo((-2 + ride) * scale, (-5 + bob) * scale);
  ctx.lineTo((-6 - ride) * scale, (-3 + bob) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((2 + ride) * scale, (-5 + bob) * scale);
  ctx.lineTo((6 + ride) * scale, (-3 + bob) * scale);
  ctx.stroke();
}

/**
 * Draw a person sitting on a bench
 */
function drawSittingPerson(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.22; // Smaller scale to fit better on bench
  const breathe = Math.sin(ped.activityAnimTimer * 0.5) * 0.3;

  // Bench
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(-6 * scale, 2 * scale, 12 * scale, 2 * scale);
  // Bench legs
  ctx.fillRect(-5 * scale, 4 * scale, 1.5 * scale, 3 * scale);
  ctx.fillRect(3.5 * scale, 4 * scale, 1.5 * scale, 3 * scale);

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-8 + breathe) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Hair for variety
  if (ped.id % 2 === 0) {
    drawHair(ctx, 0, (-8 + breathe) * scale, 3 * scale, ped.id);
  }

  // Hat if has one
  if (ped.hasHat) {
    ctx.fillStyle = ped.hatColor;
    ctx.beginPath();
    ctx.ellipse(0, (-11 + breathe) * scale, 4 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Body - seated
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-2 + breathe) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs - bent at 90 degrees
  ctx.fillStyle = ped.pantsColor;
  // Thighs (horizontal)
  ctx.fillRect(-2 * scale, 1 * scale, 4 * scale, 2 * scale);
  // Lower legs (hanging down)
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, 3 * scale);
  ctx.lineTo(-1 * scale, 7 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, 3 * scale);
  ctx.lineTo(1 * scale, 7 * scale);
  ctx.stroke();

  // Arms resting
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (-3 + breathe) * scale);
  ctx.lineTo(-4 * scale, 1 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, (-3 + breathe) * scale);
  ctx.lineTo(4 * scale, 1 * scale);
  ctx.stroke();
}

/**
 * Draw someone having a picnic
 */
// Muted pastel blanket colors
const BLANKET_COLORS = [
  { main: '#d4a5a5', accent: '#f5e6e6' },  // Dusty rose
  { main: '#a5c4d4', accent: '#e6f0f5' },  // Soft blue
  { main: '#b5d4a5', accent: '#e6f5e6' },  // Sage green
  { main: '#d4cfa5', accent: '#f5f3e6' },  // Muted yellow
  { main: '#c4a5d4', accent: '#f0e6f5' },  // Lavender
  { main: '#d4b5a5', accent: '#f5ece6' },  // Warm beige
];

function drawPicnicker(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.22; // Smaller scale for park activities

  // Picnic blanket - muted pastel colors based on pedestrian ID
  const blanketColor = BLANKET_COLORS[ped.id % BLANKET_COLORS.length];
  ctx.fillStyle = blanketColor.main;
  ctx.fillRect(-8 * scale, 0, 16 * scale, 8 * scale);
  // Blanket pattern
  ctx.fillStyle = blanketColor.accent;
  ctx.fillRect(-6 * scale, 2 * scale, 4 * scale, 4 * scale);
  ctx.fillRect(2 * scale, 2 * scale, 4 * scale, 4 * scale);

  // Person sitting cross-legged
  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, -8 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Add hair for ~50% of pedestrians
  if (ped.id % 2 === 0) {
    drawHair(ctx, 0, -8 * scale, 3 * scale, ped.id);
  }

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, -2 * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crossed legs
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, 2 * scale);
  ctx.lineTo(2 * scale, 5 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, 2 * scale);
  ctx.lineTo(-2 * scale, 5 * scale);
  ctx.stroke();

  // Picnic basket
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(5 * scale, 1 * scale, 4 * scale, 3 * scale);
}

/**
 * Draw a jogger
 */
function drawJogger(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.20; // Small scale for park joggers
  const run = ped.walkOffset;
  const bounce = Math.abs(Math.sin(run * 2)) * 2;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + bounce) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Add hair for ~50% of pedestrians (ponytail bouncing)
  if (ped.id % 2 === 0) {
    drawHair(ctx, 0, (-12 + bounce) * scale, 3 * scale, ped.id);
  }

  // Headband
  ctx.fillStyle = ped.shirtColor;
  ctx.fillRect(-3 * scale, (-13 + bounce) * scale, 6 * scale, 1.5 * scale);

  // Athletic top
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-5 + bounce) * scale, 2.3 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Running shorts
  ctx.fillStyle = ped.pantsColor;
  ctx.fillRect(-2 * scale, (-1 + bounce) * scale, 4 * scale, 2 * scale);

  // Legs - running stride
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  const leftLeg = Math.sin(run) * 5;
  const rightLeg = Math.sin(run + Math.PI) * 5;
  ctx.beginPath();
  ctx.moveTo(0, (1 + bounce) * scale);
  ctx.lineTo(leftLeg * scale, (6 + bounce) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, (1 + bounce) * scale);
  ctx.lineTo(rightLeg * scale, (6 + bounce) * scale);
  ctx.stroke();

  // Arms - pumping motion
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  const leftArm = Math.sin(run + Math.PI) * 3;
  const rightArm = Math.sin(run) * 3;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (-6 + bounce) * scale);
  ctx.lineTo((-3 + leftArm) * scale, (-2 + bounce) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, (-6 + bounce) * scale);
  ctx.lineTo((3 + rightArm) * scale, (-2 + bounce) * scale);
  ctx.stroke();
}

/**
 * Draw a dog walker - just uses the regular walking function which handles dogs
 */
function drawDogWalker(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  drawWalkingPedestrian(ctx, ped);
}

/**
 * Draw a kid on playground
 */
function drawPlaygroundKid(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.20; // Small - it's a kid on playground
  const swing = Math.sin(ped.activityAnimTimer * 1.5) * 8;
  const sway = Math.cos(ped.activityAnimTimer * 1.5) * 3;

  // Swing set hint
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, -20 * scale);
  ctx.lineTo((-2 + sway) * scale, (-8 + Math.abs(swing) * 0.2) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, -20 * scale);
  ctx.lineTo((2 + sway) * scale, (-8 + Math.abs(swing) * 0.2) * scale);
  ctx.stroke();

  // Kid's head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(sway * scale, (-10 + Math.abs(swing) * 0.2) * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(sway * scale, (-4 + Math.abs(swing) * 0.1) * scale, 2 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs - kicking while swinging
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(sway * scale, (-1 + Math.abs(swing) * 0.1) * scale);
  ctx.lineTo((sway + swing * 0.3) * scale, (4) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sway * scale, (-1 + Math.abs(swing) * 0.1) * scale);
  ctx.lineTo((sway + swing * 0.2) * scale, (4) * scale);
  ctx.stroke();

  // Arms holding ropes
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo((sway - 1.5) * scale, (-5 + Math.abs(swing) * 0.15) * scale);
  ctx.lineTo((-2 + sway) * scale, (-8 + Math.abs(swing) * 0.2) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((sway + 1.5) * scale, (-5 + Math.abs(swing) * 0.15) * scale);
  ctx.lineTo((2 + sway) * scale, (-8 + Math.abs(swing) * 0.2) * scale);
  ctx.stroke();
}

/**
 * Draw a spectator watching a game
 */
function drawSpectator(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.22; // Smaller scale for park/stadium spectators
  const cheer = Math.sin(ped.activityAnimTimer * 2);
  const cheerUp = cheer > 0.7;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + (cheerUp ? -1 : 0)) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Add hair for ~50% of pedestrians (instead of cap)
  if (ped.id % 2 === 0) {
    drawHair(ctx, 0, (-12 + (cheerUp ? -1 : 0)) * scale, 3 * scale, ped.id);
  } else {
    // Team cap/hat for others
    ctx.fillStyle = ped.shirtColor;
    ctx.beginPath();
    ctx.arc(0, (-13 + (cheerUp ? -1 : 0)) * scale, 3.5 * scale, Math.PI, 0);
    ctx.fill();
  }

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, -5 * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pants
  ctx.fillStyle = ped.pantsColor;
  ctx.fillRect(-2 * scale, -1 * scale, 4 * scale, 3 * scale);

  // Legs
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, 2 * scale);
  ctx.lineTo(-1.5 * scale, 7 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, 2 * scale);
  ctx.lineTo(1.5 * scale, 7 * scale);
  ctx.stroke();

  // Arms - raised when cheering
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  if (cheerUp) {
    // Arms up!
    ctx.beginPath();
    ctx.moveTo(-2 * scale, -6 * scale);
    ctx.lineTo(-4 * scale, -14 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2 * scale, -6 * scale);
    ctx.lineTo(4 * scale, -14 * scale);
    ctx.stroke();
  } else {
    // Arms at sides
    ctx.beginPath();
    ctx.moveTo(-2 * scale, -6 * scale);
    ctx.lineTo(-3 * scale, -1 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2 * scale, -6 * scale);
    ctx.lineTo(3 * scale, -1 * scale);
    ctx.stroke();
  }
}

/**
 * Draw a socializing person (facing another person)
 */
function drawSocializingPerson(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.30;
  const gesture = Math.sin(ped.activityAnimTimer * 1) * 2;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, -12 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Add hair for ~50% of pedestrians
  if (ped.id % 2 === 0) {
    drawHair(ctx, 0, -12 * scale, 3 * scale, ped.id);
  }

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, -5 * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (standing)
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, -1 * scale);
  ctx.lineTo(-1.5 * scale, 5 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, -1 * scale);
  ctx.lineTo(1.5 * scale, 5 * scale);
  ctx.stroke();

  // Arms - gesturing while talking
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, -6 * scale);
  ctx.lineTo((-4 + gesture) * scale, (-4 + Math.abs(gesture) * 0.5) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, -6 * scale);
  ctx.lineTo((4 - gesture) * scale, (-4 + Math.abs(gesture) * 0.5) * scale);
  ctx.stroke();

  // Speech indicator (small dots)
  if (Math.sin(ped.activityAnimTimer * 2.5) > 0) {
    ctx.fillStyle = '#666666';
    ctx.beginPath();
    ctx.arc(5 * scale, -14 * scale, 0.8 * scale, 0, Math.PI * 2);
    ctx.arc(7 * scale, -15 * scale, 0.6 * scale, 0, Math.PI * 2);
    ctx.arc(8.5 * scale, -15.5 * scale, 0.4 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw an idle person
 */
function drawIdlePerson(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.30;
  const breathe = Math.sin(ped.activityAnimTimer * 0.5) * 0.3;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + breathe) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Add hair for ~50% of pedestrians
  if (ped.id % 2 === 0 && !ped.hasHat) {
    drawHair(ctx, 0, (-12 + breathe) * scale, 3 * scale, ped.id);
  }

  // Hat if has one
  if (ped.hasHat) {
    ctx.fillStyle = ped.hatColor;
    ctx.beginPath();
    ctx.ellipse(0, (-15 + breathe) * scale, 4 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-5 + breathe) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (standing)
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, (-1 + breathe) * scale);
  ctx.lineTo(-1 * scale, (5 + breathe) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, (-1 + breathe) * scale);
  ctx.lineTo(1 * scale, (5 + breathe) * scale);
  ctx.stroke();

  // Arms at rest
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (-6 + breathe) * scale);
  ctx.lineTo(-2.5 * scale, (-1 + breathe) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, (-6 + breathe) * scale);
  ctx.lineTo(2.5 * scale, (-1 + breathe) * scale);
  ctx.stroke();

  // Bag if carrying
  if (ped.hasBag) {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(3 * scale, (-4 + breathe) * scale, 2 * scale, 3 * scale);
  }
}

// ============================================================================
// Shop Activity Drawing Functions
// ============================================================================

/**
 * Draw a shopper queuing/waiting at a shop entrance
 */
function drawShopperQueuing(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.28;
  const sway = Math.sin(ped.walkOffset * 0.3) * 0.5;
  const lookAround = Math.sin(ped.activityAnimTimer * 0.5) * 2;

  // Head - looking around
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(lookAround * scale, -12 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Hair for variety
  if (ped.id % 2 === 0) {
    const hairColor = ['#2c1810', '#4a3728', '#8b4513', '#d4a574', '#f5deb3', '#1a1a1a'][ped.id % 6];
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(lookAround * scale, -13 * scale, 3 * scale, Math.PI, 0);
    ctx.fill();
  }

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(sway * scale, -5 * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs - standing
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo((-1 + sway) * scale, -1 * scale);
  ctx.lineTo((-1.2 + sway) * scale, 5 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((1 + sway) * scale, -1 * scale);
  ctx.lineTo((1.2 + sway) * scale, 5 * scale);
  ctx.stroke();

  // Arms - one arm checking phone/wallet
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo((-2 + sway) * scale, -6 * scale);
  ctx.lineTo((-3 + sway) * scale, -2 * scale);
  ctx.stroke();
  // Other arm holding phone/wallet
  ctx.beginPath();
  ctx.moveTo((2 + sway) * scale, -6 * scale);
  ctx.lineTo((2 + sway) * scale, -3 * scale);
  ctx.stroke();
  
  // Phone in hand
  ctx.fillStyle = '#333333';
  ctx.fillRect((1.5 + sway) * scale, -4 * scale, 1.5 * scale, 2.5 * scale);
  ctx.fillStyle = '#4488ff';
  ctx.fillRect((1.6 + sway) * scale, -3.8 * scale, 1.2 * scale, 2 * scale);
}

/**
 * Draw a shopper walking through shop door (entering or exiting)
 */
function drawShopperAtDoor(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.28;
  const walkBob = Math.sin(ped.walkOffset) * 0.5;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + walkBob) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  if (ped.id % 2 === 0) {
    const hairColor = ['#2c1810', '#4a3728', '#8b4513', '#d4a574', '#f5deb3', '#1a1a1a'][ped.id % 6];
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(0, (-13 + walkBob) * scale, 3 * scale, Math.PI, 0);
    ctx.fill();
  }

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-5 + walkBob) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs - walking slowly
  const legSwing = Math.sin(ped.walkOffset) * 1.5;
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(0, (-1 + walkBob) * scale);
  ctx.lineTo((-1 + legSwing) * scale, (5 + walkBob) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, (-1 + walkBob) * scale);
  ctx.lineTo((1 - legSwing) * scale, (5 + walkBob) * scale);
  ctx.stroke();

  // Arms - swinging slightly
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  const armSwing = legSwing * 0.5;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (-6 + walkBob) * scale);
  ctx.lineTo((-3 - armSwing) * scale, (-2 + walkBob) * scale);
  ctx.stroke();

  // If exiting with bag, show shopping bag
  if (ped.hasBag && ped.state === 'exiting_building') {
    // Shopping bag in hand
    ctx.fillStyle = '#e74c3c'; // Red shopping bag
    ctx.fillRect((2) * scale, (-4 + walkBob) * scale, 3 * scale, 4 * scale);
    // Bag handles
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 0.5 * scale;
    ctx.beginPath();
    ctx.moveTo((2.5) * scale, (-4 + walkBob) * scale);
    ctx.lineTo((2.5) * scale, (-5 + walkBob) * scale);
    ctx.moveTo((4.5) * scale, (-4 + walkBob) * scale);
    ctx.lineTo((4.5) * scale, (-5 + walkBob) * scale);
    ctx.stroke();
    
    // Arm holding bag
    ctx.strokeStyle = ped.skinColor;
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath();
    ctx.moveTo(2 * scale, (-6 + walkBob) * scale);
    ctx.lineTo((3) * scale, (-4 + walkBob) * scale);
    ctx.stroke();
  } else {
    // Regular arm
    ctx.beginPath();
    ctx.moveTo(2 * scale, (-6 + walkBob) * scale);
    ctx.lineTo((3 + armSwing) * scale, (-2 + walkBob) * scale);
    ctx.stroke();
  }
}

// ============================================================================
// Beach Activity Drawing Functions
// ============================================================================

/**
 * Draw a beach swimmer (person swimming in open water near shore)
 * Different from pool swimmer - more realistic ocean swimming
 */
function drawBeachSwimmer(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.24;
  const swim = Math.sin(ped.activityAnimTimer * 1.8);
  const bob = Math.sin(ped.activityAnimTimer * 1.2) * 1.5;
  const wave = Math.sin(ped.activityAnimTimer * 0.8) * 0.5;

  // Water ripples around swimmer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 2 * scale, 10 * scale + Math.abs(swim) * 2, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Darker water effect
  ctx.fillStyle = 'rgba(30, 100, 180, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 1 * scale, 9 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head bobbing in water
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(wave * scale, (-2 + bob) * scale, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Wet hair
  const hairColor = HAIR_COLORS[ped.id % HAIR_COLORS.length];
  ctx.fillStyle = hairColor;
  ctx.beginPath();
  ctx.arc(wave * scale, (-3.5 + bob) * scale, 3 * scale, Math.PI, 0);
  ctx.fill();

  // Swimming arms - freestyle stroke motion
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 2 * scale;
  
  // Left arm
  const leftArmPhase = ped.activityAnimTimer * 1.8;
  const leftArmUp = Math.sin(leftArmPhase) > 0;
  if (leftArmUp) {
    // Arm coming out of water
    ctx.beginPath();
    ctx.moveTo((-3 + wave) * scale, (0 + bob) * scale);
    ctx.quadraticCurveTo(
      (-6 + Math.sin(leftArmPhase) * 4) * scale,
      (-3 + Math.cos(leftArmPhase) * 2 + bob) * scale,
      (-8 + Math.sin(leftArmPhase) * 2) * scale,
      (1 + bob) * scale
    );
    ctx.stroke();
  }
  
  // Right arm (offset phase)
  const rightArmPhase = ped.activityAnimTimer * 1.8 + Math.PI;
  const rightArmUp = Math.sin(rightArmPhase) > 0;
  if (rightArmUp) {
    ctx.beginPath();
    ctx.moveTo((3 + wave) * scale, (0 + bob) * scale);
    ctx.quadraticCurveTo(
      (6 + Math.sin(rightArmPhase) * 4) * scale,
      (-3 + Math.cos(rightArmPhase) * 2 + bob) * scale,
      (8 + Math.sin(rightArmPhase) * 2) * scale,
      (1 + bob) * scale
    );
    ctx.stroke();
  }

  // Splash effects when arm enters water
  if (Math.sin(leftArmPhase) < -0.8) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc((-7 + wave) * scale, (1 + bob) * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  if (Math.sin(rightArmPhase) < -0.8) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc((7 + wave) * scale, (1 + bob) * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Kick splash behind
  const kickSplash = Math.abs(Math.sin(ped.activityAnimTimer * 3.5)) * 0.4;
  if (kickSplash > 0.2) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 6 * scale, 4 * scale, 2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw a person lying on a beach mat/towel
 */
function drawBeachMat(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.22;
  const breathe = Math.sin(ped.activityAnimTimer * 0.3) * 0.3;
  
  // Determine mat orientation based on beach edge
  // The mat should be parallel to the water's edge
  let matAngle = 0;
  switch (ped.beachEdge) {
    case 'north':
      matAngle = Math.PI / 4; // 45 degrees
      break;
    case 'east':
      matAngle = -Math.PI / 4;
      break;
    case 'south':
      matAngle = Math.PI / 4;
      break;
    case 'west':
      matAngle = -Math.PI / 4;
      break;
  }
  
  ctx.save();
  ctx.rotate(matAngle);
  
  // Beach mat/towel - colorful striped design
  const matWidth = 20 * scale;
  const matHeight = 10 * scale;
  
  // Mat shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.beginPath();
  ctx.ellipse(1 * scale, 2 * scale, matWidth * 0.55, matHeight * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Main mat color
  ctx.fillStyle = ped.matColor;
  ctx.fillRect(-matWidth / 2, -matHeight / 2, matWidth, matHeight);
  
  // Stripes on mat
  const stripeColor = adjustColorBrightness(ped.matColor, -30);
  ctx.fillStyle = stripeColor;
  ctx.fillRect(-matWidth / 2, -matHeight / 2 + matHeight * 0.2, matWidth, matHeight * 0.15);
  ctx.fillRect(-matWidth / 2, -matHeight / 2 + matHeight * 0.55, matWidth, matHeight * 0.15);
  ctx.fillRect(-matWidth / 2, -matHeight / 2 + matHeight * 0.85, matWidth, matHeight * 0.15);
  
  // Mat border/fringe
  ctx.strokeStyle = adjustColorBrightness(ped.matColor, -50);
  ctx.lineWidth = 0.5 * scale;
  ctx.strokeRect(-matWidth / 2, -matHeight / 2, matWidth, matHeight);

  // Person lying face down or on back (random based on ID)
  const faceDown = ped.id % 2 === 0;
  
  if (faceDown) {
    // Lying face down - sunbathing
    // Body (torso) - horizontal
    ctx.fillStyle = ped.shirtColor;
    ctx.beginPath();
    ctx.ellipse(0, breathe * scale, 3 * scale, 5 * scale, Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.fillStyle = ped.skinColor;
    ctx.beginPath();
    ctx.arc(-6 * scale, breathe * scale, 2.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair on back of head
    const hairColor = HAIR_COLORS[ped.id % HAIR_COLORS.length];
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(-6 * scale, breathe * scale, 2.5 * scale, Math.PI * 0.3, Math.PI * 1.7);
    ctx.fill();
    
    // Arms stretched out or by sides
    ctx.strokeStyle = ped.skinColor;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(-2 * scale, (breathe - 2) * scale);
    ctx.lineTo(-8 * scale, (breathe - 3) * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2 * scale, (breathe + 2) * scale);
    ctx.lineTo(-8 * scale, (breathe + 3) * scale);
    ctx.stroke();
    
    // Legs
    ctx.fillStyle = ped.pantsColor;
    ctx.beginPath();
    ctx.ellipse(5 * scale, breathe * scale, 2 * scale, 3 * scale, Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Feet
    ctx.fillStyle = ped.skinColor;
    ctx.beginPath();
    ctx.arc(8 * scale, (breathe - 1) * scale, 1 * scale, 0, Math.PI * 2);
    ctx.arc(8 * scale, (breathe + 1) * scale, 1 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Lying on back - relaxing
    // Body (torso) - horizontal
    ctx.fillStyle = ped.shirtColor;
    ctx.beginPath();
    ctx.ellipse(0, breathe * scale, 3 * scale, 5 * scale, Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.fillStyle = ped.skinColor;
    ctx.beginPath();
    ctx.arc(-6 * scale, breathe * scale, 2.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    
    // Face details (simple)
    ctx.fillStyle = '#333';
    ctx.beginPath();
    // Eyes closed
    ctx.moveTo(-7 * scale, (breathe - 0.5) * scale);
    ctx.lineTo(-6.5 * scale, (breathe - 0.5) * scale);
    ctx.moveTo(-5.5 * scale, (breathe - 0.5) * scale);
    ctx.lineTo(-5 * scale, (breathe - 0.5) * scale);
    ctx.stroke();
    
    // Arms by sides
    ctx.strokeStyle = ped.skinColor;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(-2 * scale, (breathe - 2.5) * scale);
    ctx.lineTo(3 * scale, (breathe - 4) * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2 * scale, (breathe + 2.5) * scale);
    ctx.lineTo(3 * scale, (breathe + 4) * scale);
    ctx.stroke();
    
    // Legs
    ctx.fillStyle = ped.pantsColor;
    ctx.beginPath();
    ctx.ellipse(5 * scale, breathe * scale, 2 * scale, 3 * scale, Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Feet
    ctx.fillStyle = ped.skinColor;
    ctx.beginPath();
    ctx.arc(8 * scale, (breathe - 1.5) * scale, 1 * scale, 0, Math.PI * 2);
    ctx.arc(8 * scale, (breathe + 1.5) * scale, 1 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Adjust color brightness
 */
function adjustColorBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
