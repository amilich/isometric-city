import { Tool } from '@/games/coaster/types';
import { CoasterType } from '@/games/coaster/types/tracks';

// Map coaster type selection tools to their coaster type.
export const COASTER_TYPE_TOOL_MAP: Partial<Record<Tool, CoasterType>> = {
  coaster_type_wooden_classic: 'wooden_classic',
  coaster_type_wooden_twister: 'wooden_twister',
  coaster_type_steel_sit_down: 'steel_sit_down',
  coaster_type_steel_standup: 'steel_standup',
  coaster_type_steel_inverted: 'steel_inverted',
  coaster_type_steel_floorless: 'steel_floorless',
  coaster_type_steel_wing: 'steel_wing',
  coaster_type_steel_flying: 'steel_flying',
  coaster_type_steel_4d: 'steel_4d',
  coaster_type_steel_spinning: 'steel_spinning',
  coaster_type_launch_coaster: 'launch_coaster',
  coaster_type_hyper_coaster: 'hyper_coaster',
  coaster_type_giga_coaster: 'giga_coaster',
  coaster_type_water_coaster: 'water_coaster',
  coaster_type_mine_train: 'mine_train',
  coaster_type_bobsled: 'bobsled',
  coaster_type_suspended: 'suspended',
};

// Primary colors for each coaster type (for UI display).
export const COASTER_TYPE_PRIMARY_COLORS: Record<CoasterType, string> = {
  wooden_classic: '#8B4513',
  wooden_twister: '#A0522D',
  steel_sit_down: '#dc2626',
  steel_standup: '#7c3aed',
  steel_inverted: '#2563eb',
  steel_floorless: '#059669',
  steel_wing: '#ea580c',
  steel_flying: '#0891b2',
  steel_4d: '#be123c',
  steel_spinning: '#65a30d',
  launch_coaster: '#e11d48',
  hyper_coaster: '#0d9488',
  giga_coaster: '#4f46e5',
  water_coaster: '#0ea5e9',
  mine_train: '#92400e',
  bobsled: '#1d4ed8',
  suspended: '#b45309',
};

export const TRACK_BUILD_TOOLS: Tool[] = [
  'coaster_build',
  'coaster_track',
  'coaster_turn_left',
  'coaster_turn_right',
  'coaster_slope_up',
  'coaster_slope_down',
  'coaster_loop',
  'coaster_station',
];
