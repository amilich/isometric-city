import { Tool } from '@/games/coaster/types';
import { CoasterType } from '@/games/coaster/types/tracks';

export const DIRECT_TOOLS: Tool[] = ['select', 'bulldoze'];

export const SUBMENU_CATEGORIES: { key: string; label: string; tools: Tool[] }[] = [
  {
    key: 'paths',
    label: 'Paths',
    tools: ['path', 'queue'],
  },
  {
    key: 'terrain',
    label: 'Terrain',
    tools: ['zone_water', 'zone_land'],
  },
  {
    key: 'trees',
    label: 'Trees',
    tools: [
      'tree_oak', 'tree_maple', 'tree_pine', 'tree_palm', 'tree_cherry',
      'bush_hedge', 'bush_flowering', 'topiary_ball',
    ],
  },
  {
    key: 'flowers',
    label: 'Flowers',
    tools: ['flowers_bed', 'flowers_planter', 'flowers_wild', 'ground_cover'],
  },
  {
    key: 'furniture',
    label: 'Furniture',
    tools: [
      'bench_wooden', 'bench_metal', 'bench_ornate',
      'lamp_victorian', 'lamp_modern', 'lamp_pathway',
      'trash_can_basic', 'trash_can_fancy',
    ],
  },
  {
    key: 'fountains',
    label: 'Fountains',
    tools: [
      'fountain_small_1', 'fountain_small_2', 'fountain_small_3',
      'fountain_medium_1', 'fountain_medium_2', 'fountain_medium_3',
      'fountain_large_1', 'fountain_large_2', 'fountain_large_3',
      'pond_small', 'pond_medium', 'pond_koi',
      'splash_pad', 'water_jets', 'dancing_fountain',
    ],
  },
  {
    key: 'food',
    label: 'Food & Drink',
    tools: [
      // American
      'food_hotdog', 'food_burger', 'food_fries', 'food_corndog', 'food_pretzel',
      // Sweet Treats
      'food_icecream', 'food_cotton_candy', 'food_candy_apple', 'food_churros', 'food_funnel_cake',
      // Drinks
      'drink_soda', 'drink_lemonade', 'drink_smoothie', 'drink_coffee', 'drink_slushie',
      // Snacks
      'snack_popcorn', 'snack_nachos', 'snack_pizza', 'snack_cookies', 'snack_donuts',
      // International
      'food_tacos', 'food_noodles', 'food_kebab', 'food_crepes', 'food_waffles',
      // Themed
      'cart_pirate', 'cart_space', 'cart_medieval', 'cart_western', 'cart_tropical',
    ],
  },
  {
    key: 'shops',
    label: 'Shops & Services',
    tools: [
      // Gift shops
      'shop_souvenir', 'shop_emporium', 'shop_photo', 'shop_ticket', 'shop_collectibles',
      // Toy shops
      'shop_toys', 'shop_plush', 'shop_apparel', 'shop_bricks', 'shop_rc',
      // Candy
      'shop_candy', 'shop_fudge', 'shop_jewelry', 'shop_popcorn_shop', 'shop_soda_fountain',
      // Games
      'game_ring_toss', 'game_balloon', 'game_shooting', 'game_darts', 'game_basketball',
      // Entertainment
      'arcade_building', 'vr_experience', 'photo_booth', 'caricature', 'face_paint',
      // Services
      'restroom', 'first_aid', 'lockers', 'stroller_rental', 'atm',
    ],
  },
  {
    key: 'rides_small',
    label: 'Small Rides',
    tools: [
      // Kiddie
      'ride_kiddie_coaster', 'ride_kiddie_train', 'ride_kiddie_planes', 'ride_kiddie_boats', 'ride_kiddie_cars',
      // Spinning
      'ride_teacups', 'ride_scrambler', 'ride_tilt_a_whirl', 'ride_spinning_apples', 'ride_whirlwind',
      // Classic
      'ride_carousel', 'ride_antique_cars', 'ride_monorail_car', 'ride_sky_ride_car', 'ride_train_car',
      // Theater
      'ride_bumper_cars', 'ride_go_karts', 'ride_simulator', 'ride_motion_theater', 'ride_4d_theater',
      // Water
      'ride_bumper_boats', 'ride_paddle_boats', 'ride_lazy_river', 'ride_water_play', 'ride_splash_zone',
      // Dark Rides
      'ride_haunted_house', 'ride_ghost_train', 'ride_dark_ride', 'ride_tunnel', 'ride_themed_facade',
    ],
  },
  {
    key: 'rides_large',
    label: 'Large Rides',
    tools: [
      // Ferris Wheels
      'ride_ferris_classic', 'ride_ferris_modern', 'ride_ferris_observation', 'ride_ferris_double', 'ride_ferris_led',
      // Drop/Tower
      'ride_drop_tower', 'ride_space_shot', 'ride_observation_tower', 'ride_sky_swing', 'ride_star_flyer',
      // Swing
      'ride_swing_ride', 'ride_wave_swinger', 'ride_flying_scooters', 'ride_enterprise', 'ride_loop_o_plane',
      // Thrill
      'ride_top_spin', 'ride_frisbee', 'ride_afterburner', 'ride_inversion', 'ride_meteorite',
      // Transport/Water
      'ride_log_flume', 'ride_rapids', 'ride_train_station', 'ride_monorail_station', 'ride_chairlift',
      // Shows
      'show_4d', 'show_stunt', 'show_dolphin', 'show_amphitheater', 'show_parade_float',
    ],
  },
  {
    key: 'coasters_wooden',
    label: 'Wooden Coasters',
    tools: [
      'coaster_type_wooden_classic',
      'coaster_type_wooden_twister',
    ],
  },
  {
    key: 'coasters_steel',
    label: 'Steel Coasters',
    tools: [
      'coaster_type_steel_sit_down',
      'coaster_type_steel_standup',
      'coaster_type_steel_inverted',
      'coaster_type_steel_floorless',
      'coaster_type_steel_wing',
      'coaster_type_steel_flying',
      'coaster_type_steel_4d',
      'coaster_type_steel_spinning',
      'coaster_type_launch_coaster',
      'coaster_type_hyper_coaster',
      'coaster_type_giga_coaster',
    ],
  },
  {
    key: 'coasters_water',
    label: 'Water Coasters',
    tools: [
      'coaster_type_water_coaster',
    ],
  },
  {
    key: 'coasters_specialty',
    label: 'Specialty Coasters',
    tools: [
      'coaster_type_mine_train',
      'coaster_type_bobsled',
      'coaster_type_suspended',
    ],
  },
  {
    key: 'coasters_track',
    label: 'Coaster Track',
    tools: [
      'coaster_build',
      'coaster_track',
      'coaster_turn_left',
      'coaster_turn_right',
      'coaster_slope_up',
      'coaster_slope_down',
      'coaster_loop',
      'coaster_station',
    ],
  },
  {
    key: 'infrastructure',
    label: 'Infrastructure',
    tools: ['park_entrance', 'staff_building'],
  },
];

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
