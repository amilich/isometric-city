import { loadImage } from '@/components/game/imageLoader';

export type SpriteConfig = {
  src: string;
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const COASTER_TRACK_SPRITES: Record<string, SpriteConfig> = {
  straight: {
    src: '/assets/coaster/coaster_track_straight.png',
    scale: 1.05,
    offsetX: 0,
    offsetY: -0.15,
  },
  curve: {
    src: '/assets/coaster/coaster_track_curve.png',
    scale: 1.05,
    offsetX: 0,
    offsetY: -0.15,
  },
  station: {
    src: '/assets/coaster/coaster_track_station.png',
    scale: 1.12,
    offsetX: 0,
    offsetY: -0.22,
  },
  lift: {
    src: '/assets/coaster/coaster_track_lift.png',
    scale: 1.08,
    offsetX: 0,
    offsetY: -0.2,
  },
  brakes: {
    src: '/assets/coaster/coaster_track_brakes.png',
    scale: 1.05,
    offsetX: 0,
    offsetY: -0.18,
  },
  booster: {
    src: '/assets/coaster/coaster_track_booster.png',
    scale: 1.05,
    offsetX: 0,
    offsetY: -0.18,
  },
  loop: {
    src: '/assets/coaster/coaster_track_loop.png',
    scale: 1.25,
    offsetX: 0,
    offsetY: -0.4,
  },
  corkscrew: {
    src: '/assets/coaster/coaster_track_corkscrew.png',
    scale: 1.22,
    offsetX: 0,
    offsetY: -0.36,
  },
};

export const COASTER_RIDE_SPRITES: Record<string, SpriteConfig> = {
  carousel: {
    src: '/assets/coaster/ride_carousel.png',
    scale: 1.6,
    offsetX: 0,
    offsetY: -0.6,
  },
  ferris_wheel: {
    src: '/assets/coaster/ride_ferris_wheel.png',
    scale: 1.8,
    offsetX: 0,
    offsetY: -0.9,
  },
  swing_ride: {
    src: '/assets/coaster/ride_swing_ride.png',
    scale: 1.6,
    offsetX: 0,
    offsetY: -0.7,
  },
  junior_coaster: {
    src: '/assets/coaster/ride_junior_coaster.png',
    scale: 1.45,
    offsetX: 0,
    offsetY: -0.55,
  },
  log_flume: {
    src: '/assets/coaster/ride_log_flume.png',
    scale: 1.5,
    offsetX: 0,
    offsetY: -0.6,
  },
};

export const COASTER_STALL_SPRITES: Record<string, SpriteConfig> = {
  food_stall: {
    src: '/assets/coaster/stall_food.png',
    scale: 1.1,
    offsetX: 0,
    offsetY: -0.2,
  },
  drink_stall: {
    src: '/assets/coaster/stall_drink.png',
    scale: 1.1,
    offsetX: 0,
    offsetY: -0.2,
  },
  souvenir_stall: {
    src: '/assets/coaster/stall_souvenir.png',
    scale: 1.1,
    offsetX: 0,
    offsetY: -0.2,
  },
  toilet: {
    src: '/assets/coaster/facility_toilet.png',
    scale: 1.1,
    offsetX: 0,
    offsetY: -0.2,
  },
  information: {
    src: '/assets/coaster/facility_info.png',
    scale: 1.1,
    offsetX: 0,
    offsetY: -0.2,
  },
};

export const COASTER_TRAIN_SPRITE: SpriteConfig = {
  src: '/assets/coaster/coaster_train_car.png',
  scale: 0.7,
  offsetX: 0,
  offsetY: -0.25,
};

export const COASTER_SCENERY_SPRITES: Record<string, SpriteConfig> = {
  tree: {
    src: '/assets/coaster/scenery_tree.png',
    scale: 1.1,
    offsetX: 0,
    offsetY: -0.45,
  },
  bench: {
    src: '/assets/coaster/scenery_bench.png',
    scale: 1,
    offsetX: 0,
    offsetY: -0.2,
  },
  lamp: {
    src: '/assets/coaster/scenery_lamp.png',
    scale: 1.05,
    offsetX: 0,
    offsetY: -0.45,
  },
  fence: {
    src: '/assets/coaster/scenery_fence.png',
    scale: 1,
    offsetX: 0,
    offsetY: -0.1,
  },
};

export const COASTER_ENTRANCE_SPRITE: SpriteConfig = {
  src: '/assets/coaster/park_entrance.png',
  scale: 1.3,
  offsetX: 0,
  offsetY: -0.4,
};

export const COASTER_QUEUE_SPRITE: SpriteConfig = {
  src: '/assets/coaster/queue_barrier.png',
  scale: 1.05,
  offsetX: 0,
  offsetY: -0.15,
};

export function preloadCoasterSprites() {
  const sources = [
    ...Object.values(COASTER_TRACK_SPRITES).map((sprite) => sprite.src),
    ...Object.values(COASTER_RIDE_SPRITES).map((sprite) => sprite.src),
    ...Object.values(COASTER_STALL_SPRITES).map((sprite) => sprite.src),
    ...Object.values(COASTER_SCENERY_SPRITES).map((sprite) => sprite.src),
    COASTER_TRAIN_SPRITE.src,
    COASTER_ENTRANCE_SPRITE.src,
    COASTER_QUEUE_SPRITE.src,
  ];

  sources.forEach((src) => {
    loadImage(src);
  });
}
