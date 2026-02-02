'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { T, Var, Num, msg, useMessages, useGT } from 'gt-next';

// Sprite sheet configuration matching the original game
const SPRITE_SHEETS = [
  { id: 'trees', src: '/assets/coaster/trees.webp', cols: 6, rows: 6 },
  { id: 'food', src: '/assets/coaster/food.webp', cols: 5, rows: 6 },
  { id: 'stations', src: '/assets/coaster/stations.webp', cols: 5, rows: 6 },
  { id: 'shops', src: '/assets/coaster/shops.webp', cols: 5, rows: 6 },
  { id: 'fountains', src: '/assets/coaster/fountains.webp', cols: 5, rows: 6 },
  { id: 'rides_small', src: '/assets/coaster/rides_small.webp', cols: 5, rows: 6 },
  { id: 'rides_large', src: '/assets/coaster/rides_large.webp', cols: 5, rows: 6 },
  { id: 'path_furniture', src: '/assets/coaster/path_furniture.webp', cols: 5, rows: 6 },
  { id: 'queue_elements', src: '/assets/coaster/queue_elements.webp', cols: 5, rows: 6 },
  { id: 'theme_classic', src: '/assets/coaster/theme_classic.webp', cols: 5, rows: 6 },
  { id: 'theme_modern', src: '/assets/coaster/theme_modern.webp', cols: 5, rows: 6 },
  { id: 'infrastructure', src: '/assets/coaster/infrastructure.webp', cols: 5, rows: 6 },
];

// Tool categories for the sidebar
const TOOL_CATEGORIES = [
  {
    name: msg('Basic'),
    tools: [
      { id: 'select', name: msg('Select'), icon: '👆' },
      { id: 'bulldoze', name: msg('Bulldoze'), icon: '🚜' },
      { id: 'path', name: msg('Path'), icon: '🛤️' },
      { id: 'queue', name: msg('Queue'), icon: '🚧' },
    ],
  },
  {
    name: msg('Trees'),
    tools: [
      { id: 'tree_oak', name: msg('Oak Tree'), icon: '🌳' },
      { id: 'tree_maple', name: msg('Maple Tree'), icon: '🍁' },
      { id: 'tree_birch', name: msg('Birch Tree'), icon: '🌳' },
      { id: 'tree_elm', name: msg('Elm Tree'), icon: '🌳' },
      { id: 'tree_willow', name: msg('Willow Tree'), icon: '🌳' },
      { id: 'tree_pine', name: msg('Pine Tree'), icon: '🌲' },
      { id: 'tree_spruce', name: msg('Spruce Tree'), icon: '🌲' },
      { id: 'tree_fir', name: msg('Fir Tree'), icon: '🌲' },
      { id: 'tree_cedar', name: msg('Cedar Tree'), icon: '🌲' },
      { id: 'tree_redwood', name: msg('Redwood Tree'), icon: '🌲' },
      { id: 'tree_palm', name: msg('Palm Tree'), icon: '🌴' },
      { id: 'tree_banana', name: msg('Banana Tree'), icon: '🍌' },
      { id: 'tree_bamboo', name: msg('Bamboo'), icon: '🎋' },
      { id: 'tree_coconut', name: msg('Coconut Tree'), icon: '🥥' },
      { id: 'tree_tropical', name: msg('Tropical Tree'), icon: '🌴' },
      { id: 'tree_cherry', name: msg('Cherry Tree'), icon: '🌸' },
      { id: 'tree_magnolia', name: msg('Magnolia'), icon: '🌸' },
      { id: 'tree_dogwood', name: msg('Dogwood Tree'), icon: '🌸' },
      { id: 'tree_jacaranda', name: msg('Jacaranda Tree'), icon: '🌸' },
      { id: 'tree_wisteria', name: msg('Wisteria Tree'), icon: '🌸' },
      { id: 'bush_hedge', name: msg('Hedge'), icon: '🌿' },
    ],
  },
  {
    name: msg('Landscaping'),
    tools: [
      { id: 'bush_flowering', name: msg('Flowering Bush'), icon: '🌺' },
      { id: 'topiary_ball', name: msg('Topiary Ball'), icon: '🌳' },
      { id: 'topiary_spiral', name: msg('Topiary Spiral'), icon: '🌳' },
      { id: 'topiary_animal', name: msg('Topiary Animal'), icon: '🐾' },
      { id: 'flowers_bed', name: msg('Flower Bed'), icon: '🌸' },
      { id: 'flowers_planter', name: msg('Flower Planter'), icon: '🪴' },
      { id: 'flowers_hanging', name: msg('Hanging Flowers'), icon: '🌼' },
      { id: 'flowers_wild', name: msg('Wildflowers'), icon: '🌻' },
      { id: 'ground_cover', name: msg('Ground Cover'), icon: '🍃' },
    ],
  },
  {
    name: msg('Furniture'),
    tools: [
      { id: 'bench_wooden', name: msg('Bench'), icon: '🪑' },
      { id: 'bench_metal', name: msg('Metal Bench'), icon: '🪑' },
      { id: 'bench_ornate', name: msg('Ornate Bench'), icon: '🪑' },
      { id: 'bench_modern', name: msg('Modern Bench'), icon: '🪑' },
      { id: 'bench_rustic', name: msg('Rustic Bench'), icon: '🪑' },
      { id: 'lamp_victorian', name: msg('Lamp'), icon: '💡' },
      { id: 'lamp_modern', name: msg('Modern Lamp'), icon: '💡' },
      { id: 'lamp_themed', name: msg('Themed Lamp'), icon: '💡' },
      { id: 'lamp_double', name: msg('Double Lamp'), icon: '💡' },
      { id: 'lamp_pathway', name: msg('Pathway Lamp'), icon: '💡' },
      { id: 'trash_can_basic', name: msg('Trash Can'), icon: '🗑️' },
      { id: 'trash_can_fancy', name: msg('Fancy Bin'), icon: '🗑️' },
      { id: 'trash_can_themed', name: msg('Themed Bin'), icon: '🗑️' },
    ],
  },
  {
    name: msg('Food'),
    tools: [
      { id: 'food_hotdog', name: msg('Hot Dogs'), icon: '🌭' },
      { id: 'food_burger', name: msg('Burgers'), icon: '🍔' },
      { id: 'food_fries', name: msg('Fries'), icon: '🍟' },
      { id: 'food_corndog', name: msg('Corn Dogs'), icon: '🌭' },
      { id: 'food_pretzel', name: msg('Pretzel'), icon: '🥨' },
      { id: 'food_icecream', name: msg('Ice Cream'), icon: '🍦' },
      { id: 'food_cotton_candy', name: msg('Cotton Candy'), icon: '🍭' },
      { id: 'food_candy_apple', name: msg('Candy Apples'), icon: '🍎' },
      { id: 'food_churros', name: msg('Churros'), icon: '🍩' },
      { id: 'food_funnel_cake', name: msg('Funnel Cake'), icon: '🍰' },
      { id: 'food_crepes', name: msg('Crepes'), icon: '🥞' },
      { id: 'food_waffles', name: msg('Waffles'), icon: '🧇' },
      { id: 'food_kebab', name: msg('Kebab'), icon: '🥙' },
      { id: 'food_tacos', name: msg('Tacos'), icon: '🌮' },
      { id: 'food_noodles', name: msg('Noodles'), icon: '🍜' },
      { id: 'drink_soda', name: msg('Drinks'), icon: '🥤' },
      { id: 'drink_lemonade', name: msg('Lemonade'), icon: '🍋' },
      { id: 'drink_smoothie', name: msg('Smoothie'), icon: '🥤' },
      { id: 'drink_coffee', name: msg('Coffee'), icon: '☕' },
      { id: 'drink_slushie', name: msg('Slushie'), icon: '🥤' },
      { id: 'snack_popcorn', name: msg('Popcorn'), icon: '🍿' },
      { id: 'snack_nachos', name: msg('Nachos'), icon: '🧀' },
      { id: 'snack_pizza', name: msg('Pizza'), icon: '🍕' },
      { id: 'snack_cookies', name: msg('Cookies'), icon: '🍪' },
      { id: 'snack_donuts', name: msg('Donuts'), icon: '🍩' },
      { id: 'cart_pirate', name: msg('Pirate Cart'), icon: '🏴‍☠️' },
      { id: 'cart_space', name: msg('Space Cart'), icon: '🛸' },
      { id: 'cart_medieval', name: msg('Medieval Cart'), icon: '🛡️' },
      { id: 'cart_western', name: msg('Western Cart'), icon: '🤠' },
      { id: 'cart_tropical', name: msg('Tropical Cart'), icon: '🌺' },
    ],
  },
  {
    name: msg('Shops'),
    tools: [
      { id: 'shop_souvenir', name: msg('Souvenirs'), icon: '🎁' },
      { id: 'shop_toys', name: msg('Toys'), icon: '🧸' },
      { id: 'shop_photo', name: msg('Photo Shop'), icon: '📸' },
      { id: 'shop_ticket', name: msg('Tickets'), icon: '🎟️' },
      { id: 'shop_emporium', name: msg('Emporium'), icon: '🏬' },
      { id: 'shop_rc', name: msg('RC Shop'), icon: '🚁' },
      { id: 'shop_plush', name: msg('Plush'), icon: '🧸' },
      { id: 'shop_collectibles', name: msg('Collectibles'), icon: '🎁' },
      { id: 'shop_apparel', name: msg('Apparel'), icon: '👕' },
      { id: 'shop_bricks', name: msg('Bricks'), icon: '🧱' },
      { id: 'shop_candy', name: msg('Candy'), icon: '🍬' },
      { id: 'shop_fudge', name: msg('Fudge'), icon: '🍫' },
      { id: 'shop_jewelry', name: msg('Jewelry'), icon: '💍' },
      { id: 'shop_popcorn', name: msg('Popcorn Shop'), icon: '🍿' },
      { id: 'shop_soda_fountain', name: msg('Soda Fountain'), icon: '🥤' },
      { id: 'game_ring_toss', name: msg('Ring Toss'), icon: '🎯' },
      { id: 'game_balloon', name: msg('Balloon Game'), icon: '🎈' },
      { id: 'game_shooting', name: msg('Shooting Gallery'), icon: '🎯' },
      { id: 'game_darts', name: msg('Darts'), icon: '🎯' },
      { id: 'game_basketball', name: msg('Basketball'), icon: '🏀' },
      { id: 'arcade_building', name: msg('Arcade'), icon: '🕹️' },
      { id: 'vr_experience', name: msg('VR Experience'), icon: '🕶️' },
      { id: 'photo_booth', name: msg('Photo Booth'), icon: '📷' },
      { id: 'caricature', name: msg('Caricature'), icon: '🖍️' },
      { id: 'face_paint', name: msg('Face Paint'), icon: '🎨' },
      { id: 'restroom', name: msg('Restroom'), icon: '🚻' },
      { id: 'first_aid', name: msg('First Aid'), icon: '🏥' },
      { id: 'lockers', name: msg('Lockers'), icon: '🧳' },
      { id: 'stroller_rental', name: msg('Stroller Rental'), icon: '👶' },
      { id: 'atm', name: msg('ATM'), icon: '🏧' },
    ],
  },
  {
    name: msg('Small Rides'),
    tools: [
      { id: 'ride_kiddie_coaster', name: msg('Kiddie Coaster'), icon: '🎢' },
      { id: 'ride_kiddie_train', name: msg('Kiddie Train'), icon: '🚂' },
      { id: 'ride_kiddie_planes', name: msg('Kiddie Planes'), icon: '✈️' },
      { id: 'ride_kiddie_boats', name: msg('Kiddie Boats'), icon: '⛵' },
      { id: 'ride_kiddie_cars', name: msg('Kiddie Cars'), icon: '🚗' },
      { id: 'ride_teacups', name: msg('Teacups'), icon: '☕' },
      { id: 'ride_scrambler', name: msg('Scrambler'), icon: '🎢' },
      { id: 'ride_tilt_a_whirl', name: msg('Tilt-a-Whirl'), icon: '🎢' },
      { id: 'ride_spinning_apples', name: msg('Spinning Apples'), icon: '🍎' },
      { id: 'ride_whirlwind', name: msg('Whirlwind'), icon: '🌪️' },
      { id: 'ride_carousel', name: msg('Carousel'), icon: '🎠' },
      { id: 'ride_antique_cars', name: msg('Antique Cars'), icon: '🚙' },
      { id: 'ride_monorail_car', name: msg('Monorail Car'), icon: '🚝' },
      { id: 'ride_sky_ride_car', name: msg('Sky Ride Car'), icon: '🚡' },
      { id: 'ride_train_car', name: msg('Train Car'), icon: '🚋' },
      { id: 'ride_bumper_cars', name: msg('Bumper Cars'), icon: '🚗' },
      { id: 'ride_go_karts', name: msg('Go Karts'), icon: '🏎️' },
      { id: 'ride_simulator', name: msg('Simulator'), icon: '🕹️' },
      { id: 'ride_motion_theater', name: msg('Motion Theater'), icon: '🎥' },
      { id: 'ride_4d_theater', name: msg('4D Theater'), icon: '🎬' },
      { id: 'ride_bumper_boats', name: msg('Bumper Boats'), icon: '🚤' },
      { id: 'ride_paddle_boats', name: msg('Paddle Boats'), icon: '🛶' },
      { id: 'ride_lazy_river', name: msg('Lazy River'), icon: '🏞️' },
      { id: 'ride_water_play', name: msg('Water Play'), icon: '💦' },
      { id: 'ride_splash_zone', name: msg('Splash Zone'), icon: '💦' },
      { id: 'ride_haunted_house', name: msg('Haunted House'), icon: '🏚️' },
      { id: 'ride_ghost_train', name: msg('Ghost Train'), icon: '👻' },
      { id: 'ride_dark_ride', name: msg('Dark Ride'), icon: '🎢' },
      { id: 'ride_tunnel', name: msg('Tunnel Ride'), icon: '🕳️' },
      { id: 'ride_themed_facade', name: msg('Themed Facade'), icon: '🎭' },
    ],
  },
  {
    name: msg('Large Rides'),
    tools: [
      { id: 'ride_ferris_classic', name: msg('Ferris Wheel'), icon: '🎡' },
      { id: 'ride_ferris_modern', name: msg('Modern Ferris'), icon: '🎡' },
      { id: 'ride_ferris_observation', name: msg('Observation Ferris'), icon: '🎡' },
      { id: 'ride_ferris_double', name: msg('Double Ferris'), icon: '🎡' },
      { id: 'ride_ferris_led', name: msg('LED Ferris'), icon: '🎡' },
      { id: 'ride_drop_tower', name: msg('Drop Tower'), icon: '🗼' },
      { id: 'ride_space_shot', name: msg('Space Shot'), icon: '🚀' },
      { id: 'ride_observation_tower', name: msg('Observation Tower'), icon: '🗼' },
      { id: 'ride_sky_swing', name: msg('Sky Swing'), icon: '🎢' },
      { id: 'ride_star_flyer', name: msg('Star Flyer'), icon: '✨' },
      { id: 'ride_swing_ride', name: msg('Swing Ride'), icon: '🎢' },
      { id: 'ride_wave_swinger', name: msg('Wave Swinger'), icon: '🌊' },
      { id: 'ride_flying_scooters', name: msg('Flying Scooters'), icon: '🛵' },
      { id: 'ride_enterprise', name: msg('Enterprise'), icon: '🎢' },
      { id: 'ride_loop_o_plane', name: msg('Loop-o-Plane'), icon: '🎢' },
      { id: 'ride_top_spin', name: msg('Top Spin'), icon: '🎢' },
      { id: 'ride_frisbee', name: msg('Frisbee'), icon: '🥏' },
      { id: 'ride_afterburner', name: msg('Afterburner'), icon: '🔥' },
      { id: 'ride_inversion', name: msg('Inversion'), icon: '🎢' },
      { id: 'ride_meteorite', name: msg('Meteorite'), icon: '☄️' },
      { id: 'ride_log_flume', name: msg('Log Flume'), icon: '🛶' },
      { id: 'ride_rapids', name: msg('Rapids'), icon: '🌊' },
      { id: 'ride_train_station', name: msg('Train Station'), icon: '🚉' },
      { id: 'ride_monorail_station', name: msg('Monorail Station'), icon: '🚉' },
      { id: 'ride_chairlift', name: msg('Chairlift'), icon: '🚡' },
      { id: 'show_4d', name: msg('4D Show'), icon: '🎥' },
      { id: 'show_stunt', name: msg('Stunt Show'), icon: '🤸' },
      { id: 'show_dolphin', name: msg('Dolphin Show'), icon: '🐬' },
      { id: 'show_amphitheater', name: msg('Amphitheater'), icon: '🏛️' },
      { id: 'show_parade_float', name: msg('Parade Float'), icon: '🎉' },
    ],
  },
  {
    name: msg('Fountains'),
    tools: [
      { id: 'fountain_small_1', name: msg('Small Fountain'), icon: '⛲' },
      { id: 'fountain_small_2', name: msg('Small Fountain 2'), icon: '⛲' },
      { id: 'fountain_small_3', name: msg('Small Fountain 3'), icon: '⛲' },
      { id: 'fountain_small_4', name: msg('Small Fountain 4'), icon: '⛲' },
      { id: 'fountain_small_5', name: msg('Small Fountain 5'), icon: '⛲' },
      { id: 'fountain_medium_1', name: msg('Medium Fountain'), icon: '💧' },
      { id: 'fountain_medium_2', name: msg('Medium Fountain 2'), icon: '💧' },
      { id: 'fountain_medium_3', name: msg('Medium Fountain 3'), icon: '💧' },
      { id: 'fountain_medium_4', name: msg('Medium Fountain 4'), icon: '💧' },
      { id: 'fountain_medium_5', name: msg('Medium Fountain 5'), icon: '💧' },
      { id: 'fountain_large_1', name: msg('Large Fountain'), icon: '⛲' },
      { id: 'fountain_large_2', name: msg('Large Fountain 2'), icon: '⛲' },
      { id: 'fountain_large_3', name: msg('Large Fountain 3'), icon: '⛲' },
      { id: 'fountain_large_4', name: msg('Large Fountain 4'), icon: '⛲' },
      { id: 'fountain_large_5', name: msg('Large Fountain 5'), icon: '⛲' },
      { id: 'pond_small', name: msg('Pond'), icon: '🐟' },
      { id: 'pond_medium', name: msg('Medium Pond'), icon: '🐟' },
      { id: 'pond_large', name: msg('Large Pond'), icon: '🐟' },
      { id: 'pond_koi', name: msg('Koi Pond'), icon: '🐠' },
      { id: 'pond_lily', name: msg('Lily Pond'), icon: '🪷' },
      { id: 'splash_pad', name: msg('Splash Pad'), icon: '💦' },
      { id: 'water_jets', name: msg('Water Jets'), icon: '💦' },
      { id: 'mist_fountain', name: msg('Mist Fountain'), icon: '🌫️' },
      { id: 'interactive_fountain', name: msg('Interactive Fountain'), icon: '💦' },
      { id: 'dancing_fountain', name: msg('Dancing Fountain'), icon: '💃' },
    ],
  },
  {
    name: msg('Theming'),
    tools: [
      { id: 'theme_castle_tower', name: msg('Castle Tower'), icon: '🏰' },
      { id: 'theme_pirate_ship', name: msg('Pirate Ship'), icon: '🏴‍☠️' },
      { id: 'theme_temple_ruins', name: msg('Temple Ruins'), icon: '🛕' },
      { id: 'theme_haunted_tree', name: msg('Haunted Tree'), icon: '👻' },
      { id: 'theme_circus_tent', name: msg('Circus Tent'), icon: '🎪' },
      { id: 'theme_geometric', name: msg('Geometric Art'), icon: '🔷' },
    ],
  },
  {
    name: msg('Queue Decor'),
    tools: [
      { id: 'queue_post_metal', name: msg('Queue Post'), icon: '🚧' },
      { id: 'queue_rope', name: msg('Queue Rope'), icon: '🧵' },
      { id: 'queue_wait_sign', name: msg('Wait Sign'), icon: '🪧' },
      { id: 'queue_canopy', name: msg('Queue Canopy'), icon: '⛱️' },
    ],
  },
  {
    name: msg('Stations'),
    tools: [
      { id: 'station_wooden_1', name: msg('Wooden Station 1'), icon: '🚉' },
      { id: 'station_wooden_2', name: msg('Wooden Station 2'), icon: '🚉' },
      { id: 'station_wooden_3', name: msg('Wooden Station 3'), icon: '🚉' },
      { id: 'station_wooden_4', name: msg('Wooden Station 4'), icon: '🚉' },
      { id: 'station_wooden_5', name: msg('Wooden Station 5'), icon: '🚉' },
      { id: 'station_steel_1', name: msg('Steel Station 1'), icon: '🚉' },
      { id: 'station_steel_2', name: msg('Steel Station 2'), icon: '🚉' },
      { id: 'station_steel_3', name: msg('Steel Station 3'), icon: '🚉' },
      { id: 'station_steel_4', name: msg('Steel Station 4'), icon: '🚉' },
      { id: 'station_steel_5', name: msg('Steel Station 5'), icon: '🚉' },
      { id: 'station_inverted_1', name: msg('Inverted Station 1'), icon: '🚉' },
      { id: 'station_inverted_2', name: msg('Inverted Station 2'), icon: '🚉' },
      { id: 'station_inverted_3', name: msg('Inverted Station 3'), icon: '🚉' },
      { id: 'station_inverted_4', name: msg('Inverted Station 4'), icon: '🚉' },
      { id: 'station_inverted_5', name: msg('Inverted Station 5'), icon: '🚉' },
      { id: 'station_water_1', name: msg('Water Station 1'), icon: '🚉' },
      { id: 'station_water_2', name: msg('Water Station 2'), icon: '🚉' },
      { id: 'station_water_3', name: msg('Water Station 3'), icon: '🚉' },
      { id: 'station_water_4', name: msg('Water Station 4'), icon: '🚉' },
      { id: 'station_water_5', name: msg('Water Station 5'), icon: '🚉' },
      { id: 'station_mine_1', name: msg('Mine Station 1'), icon: '🚉' },
      { id: 'station_mine_2', name: msg('Mine Station 2'), icon: '🚉' },
      { id: 'station_mine_3', name: msg('Mine Station 3'), icon: '🚉' },
      { id: 'station_mine_4', name: msg('Mine Station 4'), icon: '🚉' },
      { id: 'station_mine_5', name: msg('Mine Station 5'), icon: '🚉' },
      { id: 'station_futuristic_1', name: msg('Futuristic Station 1'), icon: '🚉' },
      { id: 'station_futuristic_2', name: msg('Futuristic Station 2'), icon: '🚉' },
      { id: 'station_futuristic_3', name: msg('Futuristic Station 3'), icon: '🚉' },
      { id: 'station_futuristic_4', name: msg('Futuristic Station 4'), icon: '🚉' },
      { id: 'station_futuristic_5', name: msg('Futuristic Station 5'), icon: '🚉' },
    ],
  },
  {
    name: msg('Infrastructure'),
    tools: [
      { id: 'park_entrance', name: msg('Park Entrance'), icon: '🏰' },
      { id: 'staff_building', name: msg('Staff Building'), icon: '🏢' },
    ],
  },
  {
    name: msg('Coaster'),
    tools: [
      { id: 'coaster_station', name: msg('Station'), icon: '🚉' },
      { id: 'coaster_track_straight', name: msg('Straight Track'), icon: '➖' },
      { id: 'coaster_track_turn_left', name: msg('Turn Left'), icon: '↩️' },
      { id: 'coaster_track_turn_right', name: msg('Turn Right'), icon: '↪️' },
      { id: 'coaster_track_slope_up', name: msg('Slope Up'), icon: '⬆️' },
      { id: 'coaster_track_slope_down', name: msg('Slope Down'), icon: '⬇️' },
      { id: 'coaster_track_slope_up_medium', name: msg('Slope Up (Medium)'), icon: '⛰️' },
      { id: 'coaster_track_slope_down_medium', name: msg('Slope Down (Medium)'), icon: '⛰️' },
      { id: 'coaster_track_lift_hill', name: msg('Lift Hill'), icon: '⛓️' },
      { id: 'coaster_track_loop', name: msg('Loop'), icon: '🔄' },
      { id: 'coaster_track_corkscrew', name: msg('Corkscrew'), icon: '🌀' },
      { id: 'coaster_track_brakes', name: msg('Brakes'), icon: '🛑' },
    ],
  },
];

export default function CoasterWasmPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);

  const gt = useGT();
  const m = useMessages();

  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState('select');
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState({ cash: 50000, guests: 0, rating: 500, time: 'Year 1, Mar 1, 09:00' });
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Initialize translated states after hooks are available
  useEffect(() => {
    setLoadingMessage(gt('Initializing WASM...'));
    setExpandedCategory(m(TOOL_CATEGORIES[0].name));
  }, [gt, m]);

  // Load sprite image
  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${src}`));
      img.src = src;
    });
  }, []);

  // Initialize game
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setLoadingMessage(gt('Loading WASM module...'));

        // Dynamic import of WASM module
        const wasm = await import('../../../wasm/pkg/isocoaster_wasm');
        await wasm.default();

        if (!mounted) return;

        setLoadingMessage(gt('Creating game...'));

        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error('Canvas not found');
        }
        
        // Set canvas size
        const dpr = window.devicePixelRatio || 1;
        const width = window.innerWidth - 240;
        const height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        
        // Create game instance
        const game = new wasm.Game(canvas, 50, dpr); // 50x50 grid
        gameRef.current = game;
        
        // Load sprite sheets
        setLoadingMessage(gt('Loading sprites...'));
        
        for (const sheet of SPRITE_SHEETS) {
          try {
            const img = await loadImage(sheet.src);
            game.load_sprite_sheet(sheet.id, img, { cols: sheet.cols, rows: sheet.rows });
          } catch (e) {
            console.warn(`Failed to load sprite sheet ${sheet.id}:`, e);
          }
        }
        
        // Load water texture
        try {
          const waterImg = await loadImage('/assets/water.png');
          game.load_water_texture(waterImg);
        } catch (e) {
          console.warn('Failed to load water texture:', e);
        }
        
        if (!mounted) return;
        
        setLoadingMessage(gt('Starting game loop...'));
        
        // Start game loop
        let lastTick = performance.now();
        const speedIntervals = [0, 50, 25, 16]; // match original speed timing
        
        function gameLoop(time: number) {
          if (!mounted || !gameRef.current) return;
          
          const game = gameRef.current;
          
          // Tick based on speed
          const currentSpeed = game.get_speed();
          if (currentSpeed > 0) {
            const interval = speedIntervals[currentSpeed] ?? 50;
            if (time - lastTick >= interval) {
              game.tick();
              lastTick = time;
            }
          }
          
          // Always render
          try {
            game.render();
          } catch (e) {
            console.error('Render error:', e);
          }
          
          // Update stats every 500ms
          if (Math.floor(time / 500) !== Math.floor((time - 16) / 500)) {
            setStats({
              cash: game.get_cash(),
              guests: game.get_guest_count(),
              rating: game.get_park_rating(),
              time: game.get_time_string(),
            });
            setSpeed(game.get_speed());
          }
          
          animationRef.current = requestAnimationFrame(gameLoop);
        }
        
        animationRef.current = requestAnimationFrame(gameLoop);
        setLoading(false);
        
      } catch (e) {
        console.error('Init error:', e);
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Unknown error');
        }
      }
    }

    init();

    return () => {
      mounted = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [loadImage, gt]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas && gameRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const width = window.innerWidth - 240;
        const height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        gameRef.current.resize(width, height, dpr);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (gameRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        gameRef.current.handle_mouse_down(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (gameRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        gameRef.current.handle_mouse_move(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (gameRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        gameRef.current.handle_mouse_up(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (gameRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        gameRef.current.handle_wheel(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  // Handle tool selection
  const handleToolSelect = (toolId: string) => {
    setSelectedTool(toolId);
    if (gameRef.current) {
      gameRef.current.set_tool(toolId);
    }
  };

  // Handle speed change
  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (gameRef.current) {
      gameRef.current.set_speed(newSpeed);
    }
  };

  if (error) {
    return (
      <T>
        <div className="h-screen w-screen bg-gradient-to-br from-red-950 via-red-900 to-red-950 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl text-white mb-4">Error Loading Game</h1>
            <p className="text-red-300 mb-8"><Var>{error}</Var></p>
            <a href="/coaster" className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded">
              Go to Regular Version
            </a>
          </div>
        </div>
      </T>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-900 flex">
      {/* Sidebar */}
      <div className="w-60 bg-slate-800 border-r border-slate-700 flex flex-col h-full">
        {/* Header */}
        <T>
          <div className="p-4 border-b border-slate-700">
            <h1 className="text-xl font-bold text-white">IsoCoaster</h1>
            <p className="text-xs text-slate-400">WebAssembly Edition</p>
          </div>
        </T>

        {/* Stats */}
        <div className="p-4 border-b border-slate-700 space-y-2">
          <T>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Cash:</span>
              <span className="text-green-400">$<Num>{stats.cash}</Num></span>
            </div>
          </T>
          <T>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Guests:</span>
              <span className="text-blue-400"><Num>{stats.guests}</Num></span>
            </div>
          </T>
          <T>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Rating:</span>
              <span className="text-yellow-400"><Num>{stats.rating}</Num></span>
            </div>
          </T>
          <div className="text-xs text-slate-500 text-center pt-1">
            {stats.time}
          </div>
        </div>

        {/* Speed controls */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map(s => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`flex-1 py-1 text-sm rounded ${
                  speed === s
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {s === 0 ? '⏸' : '▶'.repeat(s)}
              </button>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div className="flex-1 overflow-y-auto">
          {TOOL_CATEGORIES.map(category => (
            <div key={m(category.name)} className="border-b border-slate-700">
              <button
                onClick={() => setExpandedCategory(
                  expandedCategory === m(category.name) ? null : m(category.name)
                )}
                className="w-full p-3 flex justify-between items-center text-sm text-slate-300 hover:bg-slate-700"
              >
                <span>{m(category.name)}</span>
                <span className="text-slate-500">
                  {expandedCategory === m(category.name) ? '▼' : '▶'}
                </span>
              </button>

              {expandedCategory === m(category.name) && (
                <div className="pb-2 px-2">
                  {category.tools.map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => handleToolSelect(tool.id)}
                      className={`w-full p-2 text-left text-sm rounded flex items-center gap-2 ${
                        selectedTool === tool.id
                          ? 'bg-blue-500 text-white'
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span>{tool.icon}</span>
                      <span>{m(tool.name)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <T>
          <div className="p-4 border-t border-slate-700">
            <a
              href="/coaster"
              className="block text-center text-sm text-slate-400 hover:text-white"
            >
              Back to Regular Version
            </a>
          </div>
        </T>
      </div>

      {/* Main canvas area */}
      <div className="flex-1 relative">
        {loading && (
          <T>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-teal-950 to-emerald-950 flex flex-col items-center justify-center z-50">
              <h1 className="text-4xl font-light text-white mb-8">IsoCoaster WASM</h1>
              <div className="text-white/60 mb-4"><Var>{loadingMessage}</Var></div>
              <div className="w-64 h-2 bg-white/10 rounded overflow-hidden">
                <div className="h-full bg-emerald-500 animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </T>
        )}
        
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="block"
          style={{ cursor: selectedTool === 'select' ? 'default' : 'crosshair' }}
        />
      </div>
    </div>
  );
}
