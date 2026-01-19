/**
 * IsoCoaster Building Types
 * Defines all placeable buildings, rides, and decorations
 */

// =============================================================================
// BUILDING TYPE UNION
// =============================================================================

export type BuildingType =
  // Base tiles
  | 'empty'
  | 'grass'
  | 'water'
  | 'path'
  | 'queue'
  | 'entrance'
  
  // Coaster Stations (Sheet 1)
  | 'station_wooden_1' | 'station_wooden_2' | 'station_wooden_3' | 'station_wooden_4' | 'station_wooden_5'
  | 'station_steel_1' | 'station_steel_2' | 'station_steel_3' | 'station_steel_4' | 'station_steel_5'
  | 'station_inverted_1' | 'station_inverted_2' | 'station_inverted_3' | 'station_inverted_4' | 'station_inverted_5'
  | 'station_water_1' | 'station_water_2' | 'station_water_3' | 'station_water_4' | 'station_water_5'
  | 'station_mine_1' | 'station_mine_2' | 'station_mine_3' | 'station_mine_4' | 'station_mine_5'
  | 'station_futuristic_1' | 'station_futuristic_2' | 'station_futuristic_3' | 'station_futuristic_4' | 'station_futuristic_5'
  
  // Trees & Vegetation (Sheet 2)
  | 'tree_oak' | 'tree_maple' | 'tree_birch' | 'tree_elm' | 'tree_willow' | 'tree_deciduous_extra'
  | 'tree_pine' | 'tree_spruce' | 'tree_fir' | 'tree_cedar' | 'tree_redwood' | 'tree_evergreen_extra'
  | 'tree_palm' | 'tree_banana' | 'tree_bamboo' | 'tree_coconut' | 'tree_tropical' | 'tree_tropical_extra'
  | 'tree_cherry' | 'tree_magnolia' | 'tree_dogwood' | 'tree_jacaranda' | 'tree_wisteria' | 'tree_flowering_extra'
  | 'bush_hedge' | 'bush_flowering' | 'topiary_ball' | 'topiary_spiral' | 'topiary_animal' | 'flowers_square_bed'
  | 'flowers_bed' | 'flowers_planter' | 'flowers_hanging' | 'flowers_wild' | 'ground_cover' | 'ground_stones'
  
  // Benches, Lamps & Path Furniture (Sheet 3)
  | 'bench_wooden' | 'bench_metal' | 'bench_ornate' | 'bench_modern' | 'bench_rustic'
  | 'lamp_victorian' | 'lamp_modern' | 'lamp_themed' | 'lamp_double' | 'lamp_pathway'
  | 'trash_can_basic' | 'trash_can_fancy' | 'trash_can_themed' | 'recycling_bin' | 'trash_compactor'
  | 'planter_large' | 'planter_small' | 'planter_hanging' | 'planter_themed' | 'planter_tiered'
  | 'sign_directional' | 'sign_ride' | 'sign_info' | 'sign_welcome' | 'sign_sponsored'
  | 'path_bollard' | 'path_chain' | 'path_railing' | 'path_archway' | 'path_gate'
  
  // Fountains & Water Features (Sheet 4)
  | 'fountain_small_1' | 'fountain_small_2' | 'fountain_small_3' | 'fountain_small_4' | 'fountain_small_5'
  | 'fountain_medium_1' | 'fountain_medium_2' | 'fountain_medium_3' | 'fountain_medium_4' | 'fountain_medium_5'
  | 'fountain_large_1' | 'fountain_large_2' | 'fountain_large_3' | 'fountain_large_4' | 'fountain_large_5'
  | 'pond_small' | 'pond_medium' | 'pond_large' | 'pond_koi' | 'pond_lily'
  | 'waterfall_small' | 'waterfall_medium' | 'waterfall_large' | 'stream_section' | 'rapids_section'
  | 'splash_pad' | 'water_jets' | 'mist_fountain' | 'interactive_fountain' | 'dancing_fountain'
  
  // Food Stands (Sheet 5)
  | 'food_hotdog' | 'food_burger' | 'food_fries' | 'food_corndog' | 'food_pretzel'
  | 'food_icecream' | 'food_cotton_candy' | 'food_candy_apple' | 'food_churros' | 'food_funnel_cake'
  | 'drink_soda' | 'drink_lemonade' | 'drink_smoothie' | 'drink_coffee' | 'drink_slushie'
  | 'snack_popcorn' | 'snack_nachos' | 'snack_pizza' | 'snack_cookies' | 'snack_donuts'
  | 'food_tacos' | 'food_noodles' | 'food_kebab' | 'food_crepes' | 'food_waffles'
  | 'cart_pirate' | 'cart_space' | 'cart_medieval' | 'cart_western' | 'cart_tropical'
  
  // Shops & Retail (Sheet 6)
  | 'shop_souvenir_1' | 'shop_souvenir_2' | 'shop_photo' | 'shop_ticket' | 'shop_collectibles'
  | 'shop_toys' | 'shop_plush' | 'shop_apparel' | 'shop_bricks' | 'shop_rc'
  | 'shop_candy' | 'shop_fudge' | 'shop_jewelry' | 'shop_popcorn' | 'shop_soda_fountain'
  | 'game_ring_toss' | 'game_balloon' | 'game_shooting' | 'game_darts' | 'game_basketball'
  | 'arcade_building' | 'vr_experience' | 'photo_booth' | 'caricature' | 'face_paint'
  | 'restroom' | 'first_aid' | 'lockers' | 'stroller_rental' | 'atm'
  
  // Small Flat Rides (Sheet 7)
  | 'ride_kiddie_coaster' | 'ride_kiddie_train' | 'ride_kiddie_planes' | 'ride_kiddie_boats' | 'ride_kiddie_cars'
  | 'ride_teacups' | 'ride_scrambler' | 'ride_tilt_a_whirl' | 'ride_spinning_apples' | 'ride_whirlwind'
  | 'ride_carousel' | 'ride_antique_cars' | 'ride_monorail_car' | 'ride_sky_ride_car' | 'ride_train_car'
  | 'ride_bumper_cars' | 'ride_go_karts' | 'ride_simulator' | 'ride_motion_theater' | 'ride_4d_theater'
  | 'ride_bumper_boats' | 'ride_paddle_boats' | 'ride_lazy_river' | 'ride_water_play' | 'ride_splash_zone'
  | 'ride_haunted_house' | 'ride_ghost_train' | 'ride_dark_ride' | 'ride_tunnel' | 'ride_themed_facade'
  
  // Large Flat Rides (Sheet 8)
  | 'ride_ferris_classic' | 'ride_ferris_modern' | 'ride_ferris_observation' | 'ride_ferris_double' | 'ride_ferris_led'
  | 'ride_drop_tower' | 'ride_space_shot' | 'ride_observation_tower' | 'ride_sky_swing' | 'ride_star_flyer'
  | 'ride_swing_ride' | 'ride_wave_swinger' | 'ride_flying_scooters' | 'ride_enterprise' | 'ride_loop_o_plane'
  | 'ride_top_spin' | 'ride_frisbee' | 'ride_afterburner' | 'ride_inversion' | 'ride_meteorite'
  | 'ride_log_flume' | 'ride_rapids' | 'ride_train_station' | 'ride_monorail_station' | 'ride_chairlift'
  | 'show_4d' | 'show_stunt' | 'show_dolphin' | 'show_amphitheater' | 'show_parade_float'
  
  // Themed Decorations Classic (Sheet 9)
  | 'theme_castle_tower' | 'theme_castle_wall' | 'theme_drawbridge' | 'theme_knight_statue' | 'theme_dragon_statue'
  | 'theme_pirate_ship' | 'theme_treasure_chest' | 'theme_skull_rock' | 'theme_cannon' | 'theme_anchor'
  | 'theme_saloon' | 'theme_water_tower' | 'theme_wagon_wheel' | 'theme_cactus' | 'theme_windmill'
  | 'theme_temple_ruins' | 'theme_tiki_statue' | 'theme_safari_jeep' | 'theme_elephant_statue' | 'theme_bamboo_hut'
  | 'theme_rocket_ship' | 'theme_ufo' | 'theme_robot_statue' | 'theme_portal' | 'theme_satellite'
  | 'theme_coral_reef' | 'theme_submarine' | 'theme_diving_helmet' | 'theme_treasure' | 'theme_seashell'
  
  // Themed Decorations Modern (Sheet 10)
  | 'theme_haunted_tree' | 'theme_gravestone' | 'theme_pumpkin' | 'theme_witch_cauldron' | 'theme_skeleton'
  | 'theme_christmas_tree' | 'theme_snowman' | 'theme_presents' | 'theme_candy_cane' | 'theme_ice_sculpture'
  | 'theme_giant_egg' | 'theme_bunny_statue' | 'theme_flower_arch' | 'theme_butterfly' | 'theme_bird_bath'
  | 'theme_circus_tent' | 'theme_strongman' | 'theme_clown_statue' | 'theme_balloon_arch' | 'theme_carnival_banner'
  | 'theme_trophy' | 'theme_mascot' | 'theme_scoreboard' | 'theme_goal_post' | 'theme_checkered_flag'
  | 'theme_geometric' | 'theme_water_wall' | 'theme_led_cube' | 'theme_mirror_ball' | 'theme_kinetic'
  
  // Queue Line Elements (Sheet 11)
  | 'queue_post_metal' | 'queue_rope' | 'queue_chain' | 'queue_retractable' | 'queue_fence'
  | 'queue_canopy' | 'queue_pergola' | 'queue_tunnel' | 'queue_covered' | 'queue_mister'
  | 'queue_tv' | 'queue_game' | 'queue_prop' | 'queue_animatronic' | 'queue_photo_op'
  | 'queue_cave' | 'queue_jungle' | 'queue_space' | 'queue_castle' | 'queue_industrial'
  | 'queue_wait_sign' | 'queue_height' | 'queue_rules' | 'queue_logo' | 'queue_sponsor'
  | 'queue_fountain' | 'queue_sanitizer' | 'queue_charger' | 'queue_umbrella' | 'queue_cooling'
  
  // Park Infrastructure (Sheet 12)
  | 'infra_main_entrance' | 'infra_themed_entrance' | 'infra_vip_entrance' | 'infra_exit_gate' | 'infra_turnstile'
  | 'infra_office' | 'infra_maintenance' | 'infra_warehouse' | 'infra_security' | 'infra_break_room'
  | 'infra_guest_relations' | 'infra_lost_found' | 'infra_package_pickup' | 'infra_ticket_booth' | 'infra_season_pass'
  | 'infra_tram_stop' | 'infra_bus_stop' | 'infra_shuttle' | 'infra_golf_cart' | 'infra_utility_vehicle'
  | 'infra_generator' | 'infra_dumpster' | 'infra_loading_dock' | 'infra_container' | 'infra_utility_box'
  | 'infra_first_aid_station' | 'infra_defibrillator' | 'infra_fire_extinguisher' | 'infra_emergency_phone' | 'infra_evacuation';

// =============================================================================
// BUILDING INTERFACE
// =============================================================================

export interface Building {
  type: BuildingType;
  level: number;
  variant: number; // For buildings with multiple visual variants
  excitement: number; // Ride excitement rating (0-10)
  intensity: number; // Ride intensity rating (0-10)
  nausea: number; // Ride nausea rating (0-10)
  capacity: number; // Guests per cycle
  cycleTime: number; // Seconds per ride cycle
  price: number; // Ticket price for this ride
  operating: boolean; // Is the ride currently running
  broken: boolean; // Is the ride broken down
  age: number; // Age in game days
  constructionProgress: number; // 0-100
}

// =============================================================================
// BUILDING CATEGORIES (for UI organization)
// =============================================================================

export const COASTER_STATIONS: BuildingType[] = [
  'station_wooden_1', 'station_wooden_2', 'station_wooden_3', 'station_wooden_4', 'station_wooden_5',
  'station_steel_1', 'station_steel_2', 'station_steel_3', 'station_steel_4', 'station_steel_5',
  'station_inverted_1', 'station_inverted_2', 'station_inverted_3', 'station_inverted_4', 'station_inverted_5',
  'station_water_1', 'station_water_2', 'station_water_3', 'station_water_4', 'station_water_5',
  'station_mine_1', 'station_mine_2', 'station_mine_3', 'station_mine_4', 'station_mine_5',
  'station_futuristic_1', 'station_futuristic_2', 'station_futuristic_3', 'station_futuristic_4', 'station_futuristic_5',
];

export const TREES: BuildingType[] = [
  'tree_oak', 'tree_maple', 'tree_birch', 'tree_elm', 'tree_willow', 'tree_deciduous_extra',
  'tree_pine', 'tree_spruce', 'tree_fir', 'tree_cedar', 'tree_redwood', 'tree_evergreen_extra',
  'tree_palm', 'tree_banana', 'tree_bamboo', 'tree_coconut', 'tree_tropical', 'tree_tropical_extra',
  'tree_cherry', 'tree_magnolia', 'tree_dogwood', 'tree_jacaranda', 'tree_wisteria', 'tree_flowering_extra',
  'bush_hedge', 'bush_flowering', 'topiary_ball', 'topiary_spiral', 'topiary_animal', 'flowers_square_bed',
  'flowers_bed', 'flowers_planter', 'flowers_hanging', 'flowers_wild', 'ground_cover', 'ground_stones',
];

export const PATH_FURNITURE: BuildingType[] = [
  'bench_wooden', 'bench_metal', 'bench_ornate', 'bench_modern', 'bench_rustic',
  'lamp_victorian', 'lamp_modern', 'lamp_themed', 'lamp_double', 'lamp_pathway',
  'trash_can_basic', 'trash_can_fancy', 'trash_can_themed', 'recycling_bin', 'trash_compactor',
  'planter_large', 'planter_small', 'planter_hanging', 'planter_themed', 'planter_tiered',
  'sign_directional', 'sign_ride', 'sign_info', 'sign_welcome', 'sign_sponsored',
  'path_bollard', 'path_chain', 'path_railing', 'path_archway', 'path_gate',
];

export const FOOD_STANDS: BuildingType[] = [
  'food_hotdog', 'food_burger', 'food_fries', 'food_corndog', 'food_pretzel',
  'food_icecream', 'food_cotton_candy', 'food_candy_apple', 'food_churros', 'food_funnel_cake',
  'drink_soda', 'drink_lemonade', 'drink_smoothie', 'drink_coffee', 'drink_slushie',
  'snack_popcorn', 'snack_nachos', 'snack_pizza', 'snack_cookies', 'snack_donuts',
  'food_tacos', 'food_noodles', 'food_kebab', 'food_crepes', 'food_waffles',
  'cart_pirate', 'cart_space', 'cart_medieval', 'cart_western', 'cart_tropical',
];

export const SHOPS: BuildingType[] = [
  'shop_souvenir_1', 'shop_souvenir_2', 'shop_photo', 'shop_ticket', 'shop_collectibles',
  'shop_toys', 'shop_plush', 'shop_apparel', 'shop_bricks', 'shop_rc',
  'shop_candy', 'shop_fudge', 'shop_jewelry', 'shop_popcorn', 'shop_soda_fountain',
  'game_ring_toss', 'game_balloon', 'game_shooting', 'game_darts', 'game_basketball',
  'arcade_building', 'vr_experience', 'photo_booth', 'caricature', 'face_paint',
  'restroom', 'first_aid', 'lockers', 'stroller_rental', 'atm',
];

export const SMALL_RIDES: BuildingType[] = [
  'ride_kiddie_coaster', 'ride_kiddie_train', 'ride_kiddie_planes', 'ride_kiddie_boats', 'ride_kiddie_cars',
  'ride_teacups', 'ride_scrambler', 'ride_tilt_a_whirl', 'ride_spinning_apples', 'ride_whirlwind',
  'ride_carousel', 'ride_antique_cars', 'ride_monorail_car', 'ride_sky_ride_car', 'ride_train_car',
  'ride_bumper_cars', 'ride_go_karts', 'ride_simulator', 'ride_motion_theater', 'ride_4d_theater',
  'ride_bumper_boats', 'ride_paddle_boats', 'ride_lazy_river', 'ride_water_play', 'ride_splash_zone',
  'ride_haunted_house', 'ride_ghost_train', 'ride_dark_ride', 'ride_tunnel', 'ride_themed_facade',
];

export const LARGE_RIDES: BuildingType[] = [
  'ride_ferris_classic', 'ride_ferris_modern', 'ride_ferris_observation', 'ride_ferris_double', 'ride_ferris_led',
  'ride_drop_tower', 'ride_space_shot', 'ride_observation_tower', 'ride_sky_swing', 'ride_star_flyer',
  'ride_swing_ride', 'ride_wave_swinger', 'ride_flying_scooters', 'ride_enterprise', 'ride_loop_o_plane',
  'ride_top_spin', 'ride_frisbee', 'ride_afterburner', 'ride_inversion', 'ride_meteorite',
  'ride_log_flume', 'ride_rapids', 'ride_train_station', 'ride_monorail_station', 'ride_chairlift',
  'show_4d', 'show_stunt', 'show_dolphin', 'show_amphitheater', 'show_parade_float',
];

// =============================================================================
// BUILDING STATS
// =============================================================================

export interface BuildingStats {
  cost: number; // Build cost
  upkeep: number; // Monthly upkeep cost
  size: { width: number; height: number }; // Tile size
  excitement: number; // Base excitement (0-10)
  intensity: number; // Base intensity (0-10)
  nausea: number; // Base nausea (0-10)
  capacity: number; // Guests per cycle (for rides)
  cycleTime: number; // Seconds per cycle
  category: 'station' | 'tree' | 'furniture' | 'fountain' | 'food' | 'shop' | 'ride_small' | 'ride_large' | 'theme' | 'queue' | 'infrastructure' | 'path';
}

// Default stats for buildings (will be expanded as sprites are created)
export const DEFAULT_BUILDING_STATS: BuildingStats = {
  cost: 100,
  upkeep: 10,
  size: { width: 1, height: 1 },
  excitement: 0,
  intensity: 0,
  nausea: 0,
  capacity: 0,
  cycleTime: 0,
  category: 'furniture',
};
