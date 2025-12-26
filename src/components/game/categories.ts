import { Tool } from '@/types/game';

export interface ToolCategory {
  key: string;
  label: string;
  tools: Tool[];
  shortcut?: string;
  forceOpenUpward?: boolean;
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  { 
    key: 'services', 
    label: 'Services', 
    tools: ['police_station', 'fire_station', 'hospital', 'school', 'university'],
    shortcut: 's'
  },
  { 
    key: 'parks', 
    label: 'Parks', 
    tools: ['park', 'park_large', 'tennis', 'playground_small', 'playground_large', 'community_garden', 'pond_park', 'park_gate', 'greenhouse_garden'],
    shortcut: 'p'
  },
  { 
    key: 'sports', 
    label: 'Sports', 
    tools: ['basketball_courts', 'soccer_field_small', 'baseball_field_small', 'football_field', 'baseball_stadium', 'swimming_pool', 'skate_park', 'bleachers_field'],
    shortcut: 'a' // 'S' is taken, 'A' for Athletics/Sports
  },
  { 
    key: 'recreation', 
    label: 'Recreation', 
    tools: ['mini_golf_course', 'go_kart_track', 'amphitheater', 'roller_coaster_small', 'campground', 'cabin_house', 'mountain_lodge', 'mountain_trailhead'],
    shortcut: 'e' // 'R' is Road. 'E' for Entertainment/Recreation?
  },
  { 
    key: 'waterfront', 
    label: 'Waterfront', 
    tools: ['marina_docks_small', 'pier_large'],
    shortcut: 'w'
  },
  { 
    key: 'community', 
    label: 'Community', 
    tools: ['community_center', 'animal_pens_farm', 'office_building_small'],
    shortcut: 'c'
  },
  { 
    key: 'utilities', 
    label: 'Utilities', 
    tools: ['power_plant', 'water_tower', 'subway_station', 'rail_station'],
    forceOpenUpward: true,
    shortcut: 'u'
  },
  { 
    key: 'special', 
    label: 'Special', 
    tools: ['stadium', 'museum', 'airport', 'space_program', 'city_hall', 'amusement_park'],
    forceOpenUpward: true,
    shortcut: 'z' // 'S' taken. 'Z' for special?
  },
];
