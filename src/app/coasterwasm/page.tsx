'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

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
    name: 'Basic',
    tools: [
      { id: 'select', name: 'Select', icon: '👆' },
      { id: 'bulldoze', name: 'Bulldoze', icon: '🚜' },
      { id: 'path', name: 'Path', icon: '🛤️' },
      { id: 'queue', name: 'Queue', icon: '🚧' },
    ],
  },
  {
    name: 'Trees',
    tools: [
      { id: 'tree_oak', name: 'Oak Tree', icon: '🌳' },
      { id: 'tree_maple', name: 'Maple Tree', icon: '🍁' },
      { id: 'tree_birch', name: 'Birch Tree', icon: '🌳' },
      { id: 'tree_elm', name: 'Elm Tree', icon: '🌳' },
      { id: 'tree_willow', name: 'Willow Tree', icon: '🌳' },
      { id: 'tree_pine', name: 'Pine Tree', icon: '🌲' },
      { id: 'tree_spruce', name: 'Spruce Tree', icon: '🌲' },
      { id: 'tree_fir', name: 'Fir Tree', icon: '🌲' },
      { id: 'tree_cedar', name: 'Cedar Tree', icon: '🌲' },
      { id: 'tree_redwood', name: 'Redwood Tree', icon: '🌲' },
      { id: 'tree_palm', name: 'Palm Tree', icon: '🌴' },
      { id: 'tree_banana', name: 'Banana Tree', icon: '🍌' },
      { id: 'tree_bamboo', name: 'Bamboo', icon: '🎋' },
      { id: 'tree_coconut', name: 'Coconut Tree', icon: '🥥' },
      { id: 'tree_tropical', name: 'Tropical Tree', icon: '🌴' },
      { id: 'tree_cherry', name: 'Cherry Tree', icon: '🌸' },
      { id: 'tree_magnolia', name: 'Magnolia', icon: '🌸' },
      { id: 'tree_dogwood', name: 'Dogwood Tree', icon: '🌸' },
      { id: 'tree_jacaranda', name: 'Jacaranda Tree', icon: '🌸' },
      { id: 'tree_wisteria', name: 'Wisteria Tree', icon: '🌸' },
      { id: 'bush_hedge', name: 'Hedge', icon: '🌿' },
    ],
  },
  {
    name: 'Landscaping',
    tools: [
      { id: 'bush_flowering', name: 'Flowering Bush', icon: '🌺' },
      { id: 'topiary_ball', name: 'Topiary Ball', icon: '🌳' },
      { id: 'topiary_spiral', name: 'Topiary Spiral', icon: '🌳' },
      { id: 'topiary_animal', name: 'Topiary Animal', icon: '🐾' },
      { id: 'flowers_bed', name: 'Flower Bed', icon: '🌸' },
      { id: 'flowers_planter', name: 'Flower Planter', icon: '🪴' },
      { id: 'flowers_hanging', name: 'Hanging Flowers', icon: '🌼' },
      { id: 'flowers_wild', name: 'Wildflowers', icon: '🌻' },
      { id: 'ground_cover', name: 'Ground Cover', icon: '🍃' },
    ],
  },
  {
    name: 'Furniture',
    tools: [
      { id: 'bench_wooden', name: 'Bench', icon: '🪑' },
      { id: 'bench_metal', name: 'Metal Bench', icon: '🪑' },
      { id: 'bench_ornate', name: 'Ornate Bench', icon: '🪑' },
      { id: 'bench_modern', name: 'Modern Bench', icon: '🪑' },
      { id: 'bench_rustic', name: 'Rustic Bench', icon: '🪑' },
      { id: 'lamp_victorian', name: 'Lamp', icon: '💡' },
      { id: 'lamp_modern', name: 'Modern Lamp', icon: '💡' },
      { id: 'lamp_themed', name: 'Themed Lamp', icon: '💡' },
      { id: 'lamp_double', name: 'Double Lamp', icon: '💡' },
      { id: 'lamp_pathway', name: 'Pathway Lamp', icon: '💡' },
      { id: 'trash_can_basic', name: 'Trash Can', icon: '🗑️' },
      { id: 'trash_can_fancy', name: 'Fancy Bin', icon: '🗑️' },
      { id: 'trash_can_themed', name: 'Themed Bin', icon: '🗑️' },
    ],
  },
  {
    name: 'Food',
    tools: [
      { id: 'food_hotdog', name: 'Hot Dogs', icon: '🌭' },
      { id: 'food_burger', name: 'Burgers', icon: '🍔' },
      { id: 'food_fries', name: 'Fries', icon: '🍟' },
      { id: 'food_corndog', name: 'Corn Dogs', icon: '🌭' },
      { id: 'food_pretzel', name: 'Pretzel', icon: '🥨' },
      { id: 'food_icecream', name: 'Ice Cream', icon: '🍦' },
      { id: 'food_cotton_candy', name: 'Cotton Candy', icon: '🍭' },
      { id: 'food_candy_apple', name: 'Candy Apples', icon: '🍎' },
      { id: 'food_churros', name: 'Churros', icon: '🍩' },
      { id: 'food_funnel_cake', name: 'Funnel Cake', icon: '🍰' },
      { id: 'food_crepes', name: 'Crepes', icon: '🥞' },
      { id: 'food_waffles', name: 'Waffles', icon: '🧇' },
      { id: 'food_kebab', name: 'Kebab', icon: '🥙' },
      { id: 'food_tacos', name: 'Tacos', icon: '🌮' },
      { id: 'food_noodles', name: 'Noodles', icon: '🍜' },
      { id: 'drink_soda', name: 'Drinks', icon: '🥤' },
      { id: 'drink_lemonade', name: 'Lemonade', icon: '🍋' },
      { id: 'drink_smoothie', name: 'Smoothie', icon: '🥤' },
      { id: 'drink_coffee', name: 'Coffee', icon: '☕' },
      { id: 'drink_slushie', name: 'Slushie', icon: '🥤' },
      { id: 'snack_popcorn', name: 'Popcorn', icon: '🍿' },
      { id: 'snack_nachos', name: 'Nachos', icon: '🧀' },
      { id: 'snack_pizza', name: 'Pizza', icon: '🍕' },
      { id: 'snack_cookies', name: 'Cookies', icon: '🍪' },
      { id: 'snack_donuts', name: 'Donuts', icon: '🍩' },
      { id: 'cart_pirate', name: 'Pirate Cart', icon: '🏴‍☠️' },
      { id: 'cart_space', name: 'Space Cart', icon: '🛸' },
      { id: 'cart_medieval', name: 'Medieval Cart', icon: '🛡️' },
      { id: 'cart_western', name: 'Western Cart', icon: '🤠' },
      { id: 'cart_tropical', name: 'Tropical Cart', icon: '🌺' },
    ],
  },
  {
    name: 'Shops',
    tools: [
      { id: 'shop_souvenir', name: 'Souvenirs', icon: '🎁' },
      { id: 'shop_toys', name: 'Toys', icon: '🧸' },
      { id: 'shop_photo', name: 'Photo Shop', icon: '📸' },
      { id: 'shop_ticket', name: 'Tickets', icon: '🎟️' },
      { id: 'shop_emporium', name: 'Emporium', icon: '🏬' },
      { id: 'shop_rc', name: 'RC Shop', icon: '🚁' },
      { id: 'shop_plush', name: 'Plush', icon: '🧸' },
      { id: 'shop_collectibles', name: 'Collectibles', icon: '🎁' },
      { id: 'shop_apparel', name: 'Apparel', icon: '👕' },
      { id: 'shop_bricks', name: 'Bricks', icon: '🧱' },
      { id: 'shop_candy', name: 'Candy', icon: '🍬' },
      { id: 'shop_fudge', name: 'Fudge', icon: '🍫' },
      { id: 'shop_jewelry', name: 'Jewelry', icon: '💍' },
      { id: 'shop_popcorn', name: 'Popcorn Shop', icon: '🍿' },
      { id: 'shop_soda_fountain', name: 'Soda Fountain', icon: '🥤' },
      { id: 'game_ring_toss', name: 'Ring Toss', icon: '🎯' },
      { id: 'game_balloon', name: 'Balloon Game', icon: '🎈' },
      { id: 'game_shooting', name: 'Shooting Gallery', icon: '🎯' },
      { id: 'game_darts', name: 'Darts', icon: '🎯' },
      { id: 'game_basketball', name: 'Basketball', icon: '🏀' },
      { id: 'arcade_building', name: 'Arcade', icon: '🕹️' },
      { id: 'vr_experience', name: 'VR Experience', icon: '🕶️' },
      { id: 'photo_booth', name: 'Photo Booth', icon: '📷' },
      { id: 'caricature', name: 'Caricature', icon: '🖍️' },
      { id: 'face_paint', name: 'Face Paint', icon: '🎨' },
      { id: 'restroom', name: 'Restroom', icon: '🚻' },
      { id: 'first_aid', name: 'First Aid', icon: '🏥' },
      { id: 'lockers', name: 'Lockers', icon: '🧳' },
      { id: 'stroller_rental', name: 'Stroller Rental', icon: '👶' },
      { id: 'atm', name: 'ATM', icon: '🏧' },
    ],
  },
  {
    name: 'Small Rides',
    tools: [
      { id: 'ride_kiddie_coaster', name: 'Kiddie Coaster', icon: '🎢' },
      { id: 'ride_kiddie_train', name: 'Kiddie Train', icon: '🚂' },
      { id: 'ride_kiddie_planes', name: 'Kiddie Planes', icon: '✈️' },
      { id: 'ride_kiddie_boats', name: 'Kiddie Boats', icon: '⛵' },
      { id: 'ride_kiddie_cars', name: 'Kiddie Cars', icon: '🚗' },
      { id: 'ride_teacups', name: 'Teacups', icon: '☕' },
      { id: 'ride_scrambler', name: 'Scrambler', icon: '🎢' },
      { id: 'ride_tilt_a_whirl', name: 'Tilt-a-Whirl', icon: '🎢' },
      { id: 'ride_spinning_apples', name: 'Spinning Apples', icon: '🍎' },
      { id: 'ride_whirlwind', name: 'Whirlwind', icon: '🌪️' },
      { id: 'ride_carousel', name: 'Carousel', icon: '🎠' },
      { id: 'ride_antique_cars', name: 'Antique Cars', icon: '🚙' },
      { id: 'ride_monorail_car', name: 'Monorail Car', icon: '🚝' },
      { id: 'ride_sky_ride_car', name: 'Sky Ride Car', icon: '🚡' },
      { id: 'ride_train_car', name: 'Train Car', icon: '🚋' },
      { id: 'ride_bumper_cars', name: 'Bumper Cars', icon: '🚗' },
      { id: 'ride_go_karts', name: 'Go Karts', icon: '🏎️' },
      { id: 'ride_simulator', name: 'Simulator', icon: '🕹️' },
      { id: 'ride_motion_theater', name: 'Motion Theater', icon: '🎥' },
      { id: 'ride_4d_theater', name: '4D Theater', icon: '🎬' },
      { id: 'ride_bumper_boats', name: 'Bumper Boats', icon: '🚤' },
      { id: 'ride_paddle_boats', name: 'Paddle Boats', icon: '🛶' },
      { id: 'ride_lazy_river', name: 'Lazy River', icon: '🏞️' },
      { id: 'ride_water_play', name: 'Water Play', icon: '💦' },
      { id: 'ride_splash_zone', name: 'Splash Zone', icon: '💦' },
      { id: 'ride_haunted_house', name: 'Haunted House', icon: '🏚️' },
      { id: 'ride_ghost_train', name: 'Ghost Train', icon: '👻' },
      { id: 'ride_dark_ride', name: 'Dark Ride', icon: '🎢' },
      { id: 'ride_tunnel', name: 'Tunnel Ride', icon: '🕳️' },
      { id: 'ride_themed_facade', name: 'Themed Facade', icon: '🎭' },
    ],
  },
  {
    name: 'Large Rides',
    tools: [
      { id: 'ride_ferris_classic', name: 'Ferris Wheel', icon: '🎡' },
      { id: 'ride_ferris_modern', name: 'Modern Ferris', icon: '🎡' },
      { id: 'ride_ferris_observation', name: 'Observation Ferris', icon: '🎡' },
      { id: 'ride_ferris_double', name: 'Double Ferris', icon: '🎡' },
      { id: 'ride_ferris_led', name: 'LED Ferris', icon: '🎡' },
      { id: 'ride_drop_tower', name: 'Drop Tower', icon: '🗼' },
      { id: 'ride_space_shot', name: 'Space Shot', icon: '🚀' },
      { id: 'ride_observation_tower', name: 'Observation Tower', icon: '🗼' },
      { id: 'ride_sky_swing', name: 'Sky Swing', icon: '🎢' },
      { id: 'ride_star_flyer', name: 'Star Flyer', icon: '✨' },
      { id: 'ride_swing_ride', name: 'Swing Ride', icon: '🎢' },
      { id: 'ride_wave_swinger', name: 'Wave Swinger', icon: '🌊' },
      { id: 'ride_flying_scooters', name: 'Flying Scooters', icon: '🛵' },
      { id: 'ride_enterprise', name: 'Enterprise', icon: '🎢' },
      { id: 'ride_loop_o_plane', name: 'Loop-o-Plane', icon: '🎢' },
      { id: 'ride_top_spin', name: 'Top Spin', icon: '🎢' },
      { id: 'ride_frisbee', name: 'Frisbee', icon: '🥏' },
      { id: 'ride_afterburner', name: 'Afterburner', icon: '🔥' },
      { id: 'ride_inversion', name: 'Inversion', icon: '🎢' },
      { id: 'ride_meteorite', name: 'Meteorite', icon: '☄️' },
      { id: 'ride_log_flume', name: 'Log Flume', icon: '🛶' },
      { id: 'ride_rapids', name: 'Rapids', icon: '🌊' },
      { id: 'ride_train_station', name: 'Train Station', icon: '🚉' },
      { id: 'ride_monorail_station', name: 'Monorail Station', icon: '🚉' },
      { id: 'ride_chairlift', name: 'Chairlift', icon: '🚡' },
      { id: 'show_4d', name: '4D Show', icon: '🎥' },
      { id: 'show_stunt', name: 'Stunt Show', icon: '🤸' },
      { id: 'show_dolphin', name: 'Dolphin Show', icon: '🐬' },
      { id: 'show_amphitheater', name: 'Amphitheater', icon: '🏛️' },
      { id: 'show_parade_float', name: 'Parade Float', icon: '🎉' },
    ],
  },
  {
    name: 'Fountains',
    tools: [
      { id: 'fountain_small_1', name: 'Small Fountain', icon: '⛲' },
      { id: 'fountain_small_2', name: 'Small Fountain 2', icon: '⛲' },
      { id: 'fountain_small_3', name: 'Small Fountain 3', icon: '⛲' },
      { id: 'fountain_small_4', name: 'Small Fountain 4', icon: '⛲' },
      { id: 'fountain_small_5', name: 'Small Fountain 5', icon: '⛲' },
      { id: 'fountain_medium_1', name: 'Medium Fountain', icon: '💧' },
      { id: 'fountain_medium_2', name: 'Medium Fountain 2', icon: '💧' },
      { id: 'fountain_medium_3', name: 'Medium Fountain 3', icon: '💧' },
      { id: 'fountain_medium_4', name: 'Medium Fountain 4', icon: '💧' },
      { id: 'fountain_medium_5', name: 'Medium Fountain 5', icon: '💧' },
      { id: 'fountain_large_1', name: 'Large Fountain', icon: '⛲' },
      { id: 'fountain_large_2', name: 'Large Fountain 2', icon: '⛲' },
      { id: 'fountain_large_3', name: 'Large Fountain 3', icon: '⛲' },
      { id: 'fountain_large_4', name: 'Large Fountain 4', icon: '⛲' },
      { id: 'fountain_large_5', name: 'Large Fountain 5', icon: '⛲' },
      { id: 'pond_small', name: 'Pond', icon: '🐟' },
      { id: 'pond_medium', name: 'Medium Pond', icon: '🐟' },
      { id: 'pond_large', name: 'Large Pond', icon: '🐟' },
      { id: 'pond_koi', name: 'Koi Pond', icon: '🐠' },
      { id: 'pond_lily', name: 'Lily Pond', icon: '🪷' },
      { id: 'splash_pad', name: 'Splash Pad', icon: '💦' },
      { id: 'water_jets', name: 'Water Jets', icon: '💦' },
      { id: 'mist_fountain', name: 'Mist Fountain', icon: '🌫️' },
      { id: 'interactive_fountain', name: 'Interactive Fountain', icon: '💦' },
      { id: 'dancing_fountain', name: 'Dancing Fountain', icon: '💃' },
    ],
  },
  {
    name: 'Theming',
    tools: [
      { id: 'theme_castle_tower', name: 'Castle Tower', icon: '🏰' },
      { id: 'theme_pirate_ship', name: 'Pirate Ship', icon: '🏴‍☠️' },
      { id: 'theme_temple_ruins', name: 'Temple Ruins', icon: '🛕' },
      { id: 'theme_haunted_tree', name: 'Haunted Tree', icon: '👻' },
      { id: 'theme_circus_tent', name: 'Circus Tent', icon: '🎪' },
      { id: 'theme_geometric', name: 'Geometric Art', icon: '🔷' },
    ],
  },
  {
    name: 'Queue Decor',
    tools: [
      { id: 'queue_post_metal', name: 'Queue Post', icon: '🚧' },
      { id: 'queue_rope', name: 'Queue Rope', icon: '🧵' },
      { id: 'queue_wait_sign', name: 'Wait Sign', icon: '🪧' },
      { id: 'queue_canopy', name: 'Queue Canopy', icon: '⛱️' },
    ],
  },
  {
    name: 'Stations',
    tools: [
      { id: 'station_wooden_1', name: 'Wooden Station 1', icon: '🚉' },
      { id: 'station_wooden_2', name: 'Wooden Station 2', icon: '🚉' },
      { id: 'station_wooden_3', name: 'Wooden Station 3', icon: '🚉' },
      { id: 'station_wooden_4', name: 'Wooden Station 4', icon: '🚉' },
      { id: 'station_wooden_5', name: 'Wooden Station 5', icon: '🚉' },
      { id: 'station_steel_1', name: 'Steel Station 1', icon: '🚉' },
      { id: 'station_steel_2', name: 'Steel Station 2', icon: '🚉' },
      { id: 'station_steel_3', name: 'Steel Station 3', icon: '🚉' },
      { id: 'station_steel_4', name: 'Steel Station 4', icon: '🚉' },
      { id: 'station_steel_5', name: 'Steel Station 5', icon: '🚉' },
      { id: 'station_inverted_1', name: 'Inverted Station 1', icon: '🚉' },
      { id: 'station_inverted_2', name: 'Inverted Station 2', icon: '🚉' },
      { id: 'station_inverted_3', name: 'Inverted Station 3', icon: '🚉' },
      { id: 'station_inverted_4', name: 'Inverted Station 4', icon: '🚉' },
      { id: 'station_inverted_5', name: 'Inverted Station 5', icon: '🚉' },
      { id: 'station_water_1', name: 'Water Station 1', icon: '🚉' },
      { id: 'station_water_2', name: 'Water Station 2', icon: '🚉' },
      { id: 'station_water_3', name: 'Water Station 3', icon: '🚉' },
      { id: 'station_water_4', name: 'Water Station 4', icon: '🚉' },
      { id: 'station_water_5', name: 'Water Station 5', icon: '🚉' },
      { id: 'station_mine_1', name: 'Mine Station 1', icon: '🚉' },
      { id: 'station_mine_2', name: 'Mine Station 2', icon: '🚉' },
      { id: 'station_mine_3', name: 'Mine Station 3', icon: '🚉' },
      { id: 'station_mine_4', name: 'Mine Station 4', icon: '🚉' },
      { id: 'station_mine_5', name: 'Mine Station 5', icon: '🚉' },
      { id: 'station_futuristic_1', name: 'Futuristic Station 1', icon: '🚉' },
      { id: 'station_futuristic_2', name: 'Futuristic Station 2', icon: '🚉' },
      { id: 'station_futuristic_3', name: 'Futuristic Station 3', icon: '🚉' },
      { id: 'station_futuristic_4', name: 'Futuristic Station 4', icon: '🚉' },
      { id: 'station_futuristic_5', name: 'Futuristic Station 5', icon: '🚉' },
    ],
  },
  {
    name: 'Infrastructure',
    tools: [
      { id: 'park_entrance', name: 'Park Entrance', icon: '🏰' },
      { id: 'staff_building', name: 'Staff Building', icon: '🏢' },
    ],
  },
  {
    name: 'Coaster',
    tools: [
      { id: 'coaster_station', name: 'Station', icon: '🚉' },
      { id: 'coaster_track_straight', name: 'Straight Track', icon: '➖' },
      { id: 'coaster_track_turn_left', name: 'Turn Left', icon: '↩️' },
      { id: 'coaster_track_turn_right', name: 'Turn Right', icon: '↪️' },
      { id: 'coaster_track_slope_up', name: 'Slope Up', icon: '⬆️' },
      { id: 'coaster_track_slope_down', name: 'Slope Down', icon: '⬇️' },
      { id: 'coaster_track_slope_up_medium', name: 'Slope Up (Medium)', icon: '⛰️' },
      { id: 'coaster_track_slope_down_medium', name: 'Slope Down (Medium)', icon: '⛰️' },
      { id: 'coaster_track_lift_hill', name: 'Lift Hill', icon: '⛓️' },
      { id: 'coaster_track_loop', name: 'Loop', icon: '🔄' },
      { id: 'coaster_track_corkscrew', name: 'Corkscrew', icon: '🌀' },
      { id: 'coaster_track_brakes', name: 'Brakes', icon: '🛑' },
    ],
  },
];

export default function CoasterWasmPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing WASM...');
  const [error, setError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState('select');
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState({ cash: 50000, guests: 0, rating: 500, time: 'Year 1, Mar 1, 09:00' });
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Basic');

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
        setLoadingMessage('Loading WASM module...');
        
        // Dynamic import of WASM module
        const wasm = await import('../../../wasm/pkg/isocoaster_wasm');
        await wasm.default();
        
        if (!mounted) return;
        
        setLoadingMessage('Creating game...');
        
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
        setLoadingMessage('Loading sprites...');
        
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
        
        setLoadingMessage('Starting game loop...');
        
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
  }, [loadImage]);

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
      <div className="h-screen w-screen bg-gradient-to-br from-red-950 via-red-900 to-red-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl text-white mb-4">Error Loading Game</h1>
          <p className="text-red-300 mb-8">{error}</p>
          <a href="/coaster" className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded">
            Go to Regular Version
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-900 flex">
      {/* Sidebar */}
      <div className="w-60 bg-slate-800 border-r border-slate-700 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-xl font-bold text-white">IsoCoaster</h1>
          <p className="text-xs text-slate-400">WebAssembly Edition</p>
        </div>

        {/* Stats */}
        <div className="p-4 border-b border-slate-700 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Cash:</span>
            <span className="text-green-400">${stats.cash.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Guests:</span>
            <span className="text-blue-400">{stats.guests}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Rating:</span>
            <span className="text-yellow-400">{stats.rating}</span>
          </div>
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
            <div key={category.name} className="border-b border-slate-700">
              <button
                onClick={() => setExpandedCategory(
                  expandedCategory === category.name ? null : category.name
                )}
                className="w-full p-3 flex justify-between items-center text-sm text-slate-300 hover:bg-slate-700"
              >
                <span>{category.name}</span>
                <span className="text-slate-500">
                  {expandedCategory === category.name ? '▼' : '▶'}
                </span>
              </button>
              
              {expandedCategory === category.name && (
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
                      <span>{tool.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <a
            href="/coaster"
            className="block text-center text-sm text-slate-400 hover:text-white"
          >
            ← Back to Regular Version
          </a>
        </div>
      </div>

      {/* Main canvas area */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-teal-950 to-emerald-950 flex flex-col items-center justify-center z-50">
            <h1 className="text-4xl font-light text-white mb-8">IsoCoaster WASM</h1>
            <div className="text-white/60 mb-4">{loadingMessage}</div>
            <div className="w-64 h-2 bg-white/10 rounded overflow-hidden">
              <div className="h-full bg-emerald-500 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
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
