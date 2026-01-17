import { msg } from 'gt-next';
import { RideCategory, RideType } from '@/games/coaster/types';

export type RideDefinition = {
  type: RideType;
  name: string;
  category: RideCategory;
  size: { width: number; height: number };
  excitement: number;
  intensity: number;
  nausea: number;
  rideTime: number;
  capacity: number;
  color: string;
  basePrice: number;
};

export const RIDE_DEFINITIONS: Record<RideType, RideDefinition> = {
  carousel: {
    type: 'carousel',
    name: msg('Carousel'),
    category: 'gentle',
    size: { width: 2, height: 2 },
    excitement: 20,
    intensity: 10,
    nausea: 5,
    rideTime: 60,
    capacity: 12,
    color: '#f9a8d4',
    basePrice: 2,
  },
  ferris_wheel: {
    type: 'ferris_wheel',
    name: msg('Ferris Wheel'),
    category: 'gentle',
    size: { width: 2, height: 2 },
    excitement: 35,
    intensity: 15,
    nausea: 10,
    rideTime: 90,
    capacity: 16,
    color: '#60a5fa',
    basePrice: 3,
  },
  bumper_cars: {
    type: 'bumper_cars',
    name: msg('Bumper Cars'),
    category: 'thrill',
    size: { width: 2, height: 2 },
    excitement: 45,
    intensity: 35,
    nausea: 15,
    rideTime: 50,
    capacity: 20,
    color: '#facc15',
    basePrice: 4,
  },
  swing_ride: {
    type: 'swing_ride',
    name: msg('Swing Ride'),
    category: 'gentle',
    size: { width: 1, height: 1 },
    excitement: 30,
    intensity: 20,
    nausea: 15,
    rideTime: 45,
    capacity: 8,
    color: '#a855f7',
    basePrice: 2,
  },
  haunted_house: {
    type: 'haunted_house',
    name: msg('Haunted House'),
    category: 'thrill',
    size: { width: 2, height: 2 },
    excitement: 40,
    intensity: 15,
    nausea: 10,
    rideTime: 70,
    capacity: 10,
    color: '#4b5563',
    basePrice: 3,
  },
  spiral_slide: {
    type: 'spiral_slide',
    name: msg('Spiral Slide'),
    category: 'gentle',
    size: { width: 1, height: 1 },
    excitement: 15,
    intensity: 10,
    nausea: 5,
    rideTime: 30,
    capacity: 6,
    color: '#34d399',
    basePrice: 1,
  },
  coaster_wooden: {
    type: 'coaster_wooden',
    name: msg('Wooden Coaster'),
    category: 'coaster',
    size: { width: 4, height: 4 },
    excitement: 70,
    intensity: 60,
    nausea: 40,
    rideTime: 120,
    capacity: 24,
    color: '#f97316',
    basePrice: 6,
  },
  coaster_steel: {
    type: 'coaster_steel',
    name: msg('Steel Coaster'),
    category: 'coaster',
    size: { width: 4, height: 4 },
    excitement: 80,
    intensity: 70,
    nausea: 45,
    rideTime: 130,
    capacity: 24,
    color: '#ef4444',
    basePrice: 6,
  },
};
