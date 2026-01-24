/**
 * IsoCoaster Game State Types
 */

import { Building, BuildingType } from './buildings';
import { Coaster, TrackPiece, TrackDirection, CoasterType, CoasterCategory } from './tracks';
import { Guest, ParkFinances, ParkStats, ParkSettings, Staff, WeatherState } from './economy';

// =============================================================================
// TOOL TYPES
// =============================================================================

export type Tool =
  // Basic tools
  | 'select'
  | 'bulldoze'
  | 'path'
  | 'queue'
  
  // Terrain/Zoning
  | 'zone_water'
  | 'zone_land'
  
  // Coaster building - track pieces
  | 'coaster_build'
  | 'coaster_track'
  | 'coaster_turn_left'
  | 'coaster_turn_right'
  | 'coaster_slope_up'
  | 'coaster_slope_down'
  | 'coaster_loop'
  | 'coaster_station'
  
  // Coaster type selection - Wooden
  | 'coaster_type_wooden_classic'
  | 'coaster_type_wooden_twister'
  
  // Coaster type selection - Steel
  | 'coaster_type_steel_sit_down'
  | 'coaster_type_steel_standup'
  | 'coaster_type_steel_inverted'
  | 'coaster_type_steel_floorless'
  | 'coaster_type_steel_wing'
  | 'coaster_type_steel_flying'
  | 'coaster_type_steel_4d'
  | 'coaster_type_steel_spinning'
  | 'coaster_type_launch_coaster'
  | 'coaster_type_hyper_coaster'
  | 'coaster_type_giga_coaster'
  
  // Coaster type selection - Water
  | 'coaster_type_water_coaster'
  
  // Coaster type selection - Specialty
  | 'coaster_type_mine_train'
  | 'coaster_type_bobsled'
  | 'coaster_type_suspended'
  
  // Trees & Vegetation
  | 'tree_oak' | 'tree_maple' | 'tree_birch' | 'tree_elm' | 'tree_willow'
  | 'tree_pine' | 'tree_spruce' | 'tree_fir' | 'tree_cedar' | 'tree_redwood'
  | 'tree_palm' | 'tree_banana' | 'tree_bamboo' | 'tree_coconut' | 'tree_tropical'
  | 'tree_cherry' | 'tree_magnolia' | 'tree_dogwood' | 'tree_jacaranda' | 'tree_wisteria'
  | 'bush_hedge' | 'bush_flowering' | 'topiary_ball' | 'topiary_spiral' | 'topiary_animal'
  | 'flowers_bed' | 'flowers_planter' | 'flowers_hanging' | 'flowers_wild' | 'ground_cover'
  
  // Path Furniture
  | 'bench_wooden' | 'bench_metal' | 'bench_ornate' | 'bench_modern' | 'bench_rustic'
  | 'lamp_victorian' | 'lamp_modern' | 'lamp_themed' | 'lamp_double' | 'lamp_pathway'
  | 'trash_can_basic' | 'trash_can_fancy' | 'trash_can_themed'
  
  // Food - American
  | 'food_hotdog' | 'food_burger' | 'food_fries' | 'food_corndog' | 'food_pretzel'
  // Food - Sweet Treats
  | 'food_icecream' | 'food_cotton_candy' | 'food_candy_apple' | 'food_churros' | 'food_funnel_cake'
  // Food - Drinks
  | 'drink_soda' | 'drink_lemonade' | 'drink_smoothie' | 'drink_coffee' | 'drink_slushie'
  // Food - Snacks
  | 'snack_popcorn' | 'snack_nachos' | 'snack_pizza' | 'snack_cookies' | 'snack_donuts'
  // Food - International
  | 'food_tacos' | 'food_noodles' | 'food_kebab' | 'food_crepes' | 'food_waffles'
  // Food - Themed Carts
  | 'cart_pirate' | 'cart_space' | 'cart_medieval' | 'cart_western' | 'cart_tropical'
  
  // Shops - Gift shops
  | 'shop_souvenir' | 'shop_emporium' | 'shop_photo' | 'shop_ticket' | 'shop_collectibles'
  // Shops - Toy shops
  | 'shop_toys' | 'shop_plush' | 'shop_apparel' | 'shop_bricks' | 'shop_rc'
  // Shops - Candy
  | 'shop_candy' | 'shop_fudge' | 'shop_jewelry' | 'shop_popcorn_shop' | 'shop_soda_fountain'
  // Shops - Games
  | 'game_ring_toss' | 'game_balloon' | 'game_shooting' | 'game_darts' | 'game_basketball'
  // Shops - Entertainment
  | 'arcade_building' | 'vr_experience' | 'photo_booth' | 'caricature' | 'face_paint'
  // Shops - Services
  | 'restroom' | 'first_aid' | 'lockers' | 'stroller_rental' | 'atm'
  
  // Fountains & Water Features
  | 'fountain_small_1' | 'fountain_small_2' | 'fountain_small_3' | 'fountain_small_4' | 'fountain_small_5'
  | 'fountain_medium_1' | 'fountain_medium_2' | 'fountain_medium_3' | 'fountain_medium_4' | 'fountain_medium_5'
  | 'fountain_large_1' | 'fountain_large_2' | 'fountain_large_3' | 'fountain_large_4' | 'fountain_large_5'
  | 'pond_small' | 'pond_medium' | 'pond_large' | 'pond_koi' | 'pond_lily'
  | 'splash_pad' | 'water_jets' | 'mist_fountain' | 'interactive_fountain' | 'dancing_fountain'
  
  // Rides Small - Kiddie
  | 'ride_kiddie_coaster' | 'ride_kiddie_train' | 'ride_kiddie_planes' | 'ride_kiddie_boats' | 'ride_kiddie_cars'
  // Rides Small - Spinning
  | 'ride_teacups' | 'ride_scrambler' | 'ride_tilt_a_whirl' | 'ride_spinning_apples' | 'ride_whirlwind'
  // Rides Small - Classic
  | 'ride_carousel' | 'ride_antique_cars' | 'ride_monorail_car' | 'ride_sky_ride_car' | 'ride_train_car'
  // Rides Small - Driving/Theater
  | 'ride_bumper_cars' | 'ride_go_karts' | 'ride_simulator' | 'ride_motion_theater' | 'ride_4d_theater'
  // Rides Small - Water
  | 'ride_bumper_boats' | 'ride_paddle_boats' | 'ride_lazy_river' | 'ride_water_play' | 'ride_splash_zone'
  // Rides Small - Dark Rides
  | 'ride_haunted_house' | 'ride_ghost_train' | 'ride_dark_ride' | 'ride_tunnel' | 'ride_themed_facade'
  
  // Rides Large - Ferris Wheels
  | 'ride_ferris_classic' | 'ride_ferris_modern' | 'ride_ferris_observation' | 'ride_ferris_double' | 'ride_ferris_led'
  // Rides Large - Drop/Tower
  | 'ride_drop_tower' | 'ride_space_shot' | 'ride_observation_tower' | 'ride_sky_swing' | 'ride_star_flyer'
  // Rides Large - Swing
  | 'ride_swing_ride' | 'ride_wave_swinger' | 'ride_flying_scooters' | 'ride_enterprise' | 'ride_loop_o_plane'
  // Rides Large - Thrill
  | 'ride_top_spin' | 'ride_frisbee' | 'ride_afterburner' | 'ride_inversion' | 'ride_meteorite'
  // Rides Large - Transport/Water
  | 'ride_log_flume' | 'ride_rapids' | 'ride_train_station' | 'ride_monorail_station' | 'ride_chairlift'
  // Rides Large - Shows
  | 'show_4d' | 'show_stunt' | 'show_dolphin' | 'show_amphitheater' | 'show_parade_float'
  
  // Infrastructure
  | 'park_entrance' | 'staff_building';

// =============================================================================
// TOOL INFO
// =============================================================================

export interface ToolInfo {
  name: string;
  cost: number;
  description: string;
  size?: { width: number; height: number };
  category: ToolCategory;
}

export type ToolCategory =
  | 'tools'
  | 'paths'
  | 'terrain'
  | 'coasters'
  | 'trees'
  | 'flowers'
  | 'furniture'
  | 'fountains'
  | 'food'
  | 'shops'
  | 'rides_small'
  | 'rides_large'
  | 'theming'
  | 'infrastructure';

export const TOOL_INFO: Record<Tool, ToolInfo> = {
  select: { name: 'Select', cost: 0, description: 'Select and inspect', category: 'tools' },
  bulldoze: { name: 'Bulldoze', cost: 10, description: 'Remove objects', category: 'tools' },
  path: { name: 'Path', cost: 10, description: 'Build guest walkways', category: 'paths' },
  queue: { name: 'Queue Line', cost: 15, description: 'Build ride queues', category: 'paths' },
  
  // Terrain/Zoning
  zone_water: { name: 'Water Terraform', cost: 500, description: 'Terraform land into water', category: 'terrain' },
  zone_land: { name: 'Land Terraform', cost: 500, description: 'Terraform water into land', category: 'terrain' },
  
  coaster_build: { name: 'Coaster Build Mode', cost: 0, description: 'Start building a coaster', category: 'coasters' },
  coaster_track: { name: 'Track: Straight', cost: 20, description: 'Place straight track segments', category: 'coasters' },
  coaster_turn_left: { name: 'Track: Left Turn', cost: 25, description: 'Place a left turn segment', category: 'coasters' },
  coaster_turn_right: { name: 'Track: Right Turn', cost: 25, description: 'Place a right turn segment', category: 'coasters' },
  coaster_slope_up: { name: 'Track: Slope Up', cost: 30, description: 'Place a rising track segment', category: 'coasters' },
  coaster_slope_down: { name: 'Track: Slope Down', cost: 30, description: 'Place a descending track segment', category: 'coasters' },
  coaster_loop: { name: 'Track: Loop', cost: 150, description: 'Place a vertical loop element', category: 'coasters' },
  coaster_station: { name: 'Coaster Station', cost: 500, description: 'Place coaster station', category: 'coasters', size: { width: 1, height: 1 } },
  
  // Wooden Coasters
  coaster_type_wooden_classic: { name: 'Classic Wooden', cost: 50, description: 'Traditional wooden coaster with airtime hills', category: 'coasters' },
  coaster_type_wooden_twister: { name: 'Wooden Twister', cost: 60, description: 'Wooden coaster with aggressive turns', category: 'coasters' },
  
  // Steel Coasters
  coaster_type_steel_sit_down: { name: 'Steel Sit-Down', cost: 80, description: 'Classic steel coaster with inversions', category: 'coasters' },
  coaster_type_steel_standup: { name: 'Stand-Up Coaster', cost: 90, description: 'Riders stand during the ride', category: 'coasters' },
  coaster_type_steel_inverted: { name: 'Inverted Coaster', cost: 100, description: 'Suspended beneath the track with inversions', category: 'coasters' },
  coaster_type_steel_floorless: { name: 'Floorless Coaster', cost: 110, description: 'Steel coaster with no floor beneath riders', category: 'coasters' },
  coaster_type_steel_wing: { name: 'Wing Coaster', cost: 130, description: 'Seats extend out beside the track', category: 'coasters' },
  coaster_type_steel_flying: { name: 'Flying Coaster', cost: 140, description: 'Riders are suspended face-down', category: 'coasters' },
  coaster_type_steel_4d: { name: '4D Coaster', cost: 200, description: 'Seats rotate independently during ride', category: 'coasters' },
  coaster_type_steel_spinning: { name: 'Spinning Coaster', cost: 70, description: 'Cars spin freely during the ride', category: 'coasters' },
  coaster_type_launch_coaster: { name: 'Launch Coaster', cost: 150, description: 'Launched from station at high speed', category: 'coasters' },
  coaster_type_hyper_coaster: { name: 'Hyper Coaster', cost: 120, description: 'Tall, fast coaster focused on airtime', category: 'coasters' },
  coaster_type_giga_coaster: { name: 'Giga Coaster', cost: 180, description: 'Massive coaster exceeding 300 feet', category: 'coasters' },
  
  // Water Coasters
  coaster_type_water_coaster: { name: 'Water Coaster', cost: 100, description: 'Coaster with water splashdown sections', category: 'coasters' },
  
  // Specialty Coasters
  coaster_type_mine_train: { name: 'Mine Train', cost: 55, description: 'Family coaster themed as mine carts', category: 'coasters' },
  coaster_type_bobsled: { name: 'Bobsled Coaster', cost: 60, description: 'Coaster running in a half-pipe track', category: 'coasters' },
  coaster_type_suspended: { name: 'Suspended Swinging', cost: 85, description: 'Cars swing freely below the track', category: 'coasters' },
  
  // Trees (sample - will be expanded)
  tree_oak: { name: 'Oak Tree', cost: 30, description: 'Deciduous shade tree', category: 'trees' },
  tree_maple: { name: 'Maple Tree', cost: 30, description: 'Colorful maple tree', category: 'trees' },
  tree_birch: { name: 'Birch Tree', cost: 25, description: 'White bark birch', category: 'trees' },
  tree_elm: { name: 'Elm Tree', cost: 30, description: 'Classic elm tree', category: 'trees' },
  tree_willow: { name: 'Willow Tree', cost: 40, description: 'Weeping willow', category: 'trees' },
  tree_pine: { name: 'Pine Tree', cost: 25, description: 'Evergreen pine', category: 'trees' },
  tree_spruce: { name: 'Spruce Tree', cost: 25, description: 'Blue spruce', category: 'trees' },
  tree_fir: { name: 'Fir Tree', cost: 25, description: 'Douglas fir', category: 'trees' },
  tree_cedar: { name: 'Cedar Tree', cost: 35, description: 'Aromatic cedar', category: 'trees' },
  tree_redwood: { name: 'Redwood', cost: 50, description: 'Giant redwood', category: 'trees' },
  tree_palm: { name: 'Palm Tree', cost: 40, description: 'Tropical palm', category: 'trees' },
  tree_banana: { name: 'Banana Tree', cost: 35, description: 'Tropical banana plant', category: 'trees' },
  tree_bamboo: { name: 'Bamboo', cost: 20, description: 'Bamboo cluster', category: 'trees' },
  tree_coconut: { name: 'Coconut Palm', cost: 45, description: 'Tropical coconut palm', category: 'trees' },
  tree_tropical: { name: 'Tropical Tree', cost: 40, description: 'Exotic tropical tree', category: 'trees' },
  tree_cherry: { name: 'Cherry Blossom', cost: 50, description: 'Beautiful cherry blossom', category: 'trees' },
  tree_magnolia: { name: 'Magnolia', cost: 45, description: 'Flowering magnolia', category: 'trees' },
  tree_dogwood: { name: 'Dogwood', cost: 40, description: 'Flowering dogwood', category: 'trees' },
  tree_jacaranda: { name: 'Jacaranda', cost: 50, description: 'Purple jacaranda', category: 'trees' },
  tree_wisteria: { name: 'Wisteria', cost: 55, description: 'Cascading wisteria', category: 'trees' },
  bush_hedge: { name: 'Hedge', cost: 15, description: 'Trimmed hedge', category: 'trees' },
  bush_flowering: { name: 'Flowering Bush', cost: 20, description: 'Colorful flowering bush', category: 'trees' },
  topiary_ball: { name: 'Topiary Ball', cost: 35, description: 'Sculpted ball topiary', category: 'trees' },
  topiary_spiral: { name: 'Topiary Spiral', cost: 45, description: 'Spiral topiary', category: 'trees' },
  topiary_animal: { name: 'Animal Topiary', cost: 60, description: 'Animal-shaped topiary', category: 'trees' },
  flowers_bed: { name: 'Flower Bed', cost: 20, description: 'Colorful flower bed', category: 'flowers' },
  flowers_planter: { name: 'Flower Planter', cost: 25, description: 'Planter with flowers', category: 'flowers' },
  flowers_hanging: { name: 'Hanging Flowers', cost: 30, description: 'Hanging flower basket', category: 'flowers' },
  flowers_wild: { name: 'Wildflowers', cost: 15, description: 'Natural wildflowers', category: 'flowers' },
  ground_cover: { name: 'Ground Cover', cost: 10, description: 'Low ground cover plants', category: 'flowers' },
  
  // Path furniture
  bench_wooden: { name: 'Wooden Bench', cost: 50, description: 'Classic wooden bench', category: 'furniture' },
  bench_metal: { name: 'Metal Bench', cost: 60, description: 'Modern metal bench', category: 'furniture' },
  bench_ornate: { name: 'Ornate Bench', cost: 80, description: 'Decorative bench', category: 'furniture' },
  bench_modern: { name: 'Modern Bench', cost: 70, description: 'Contemporary bench', category: 'furniture' },
  bench_rustic: { name: 'Rustic Bench', cost: 55, description: 'Rustic log bench', category: 'furniture' },
  lamp_victorian: { name: 'Victorian Lamp', cost: 100, description: 'Classic street lamp', category: 'furniture' },
  lamp_modern: { name: 'Modern Lamp', cost: 80, description: 'Contemporary lamp', category: 'furniture' },
  lamp_themed: { name: 'Themed Lamp', cost: 120, description: 'Themed decorative lamp', category: 'furniture' },
  lamp_double: { name: 'Double Lamp', cost: 150, description: 'Double-headed lamp', category: 'furniture' },
  lamp_pathway: { name: 'Pathway Light', cost: 60, description: 'Low pathway light', category: 'furniture' },
  trash_can_basic: { name: 'Trash Can', cost: 30, description: 'Basic trash can', category: 'furniture' },
  trash_can_fancy: { name: 'Fancy Trash Can', cost: 50, description: 'Decorative trash can', category: 'furniture' },
  trash_can_themed: { name: 'Themed Trash Can', cost: 70, description: 'Themed trash can', category: 'furniture' },
  
  // Fountains - Small
  fountain_small_1: { name: 'Small Fountain', cost: 150, description: 'Simple small fountain', category: 'fountains' },
  fountain_small_2: { name: 'Small Tiered Fountain', cost: 175, description: 'Small tiered fountain', category: 'fountains' },
  fountain_small_3: { name: 'Small Classic Fountain', cost: 180, description: 'Classic small fountain', category: 'fountains' },
  fountain_small_4: { name: 'Small Modern Fountain', cost: 200, description: 'Modern small fountain', category: 'fountains' },
  fountain_small_5: { name: 'Small Ornate Fountain', cost: 220, description: 'Ornate small fountain', category: 'fountains' },
  
  // Fountains - Medium
  fountain_medium_1: { name: 'Medium Fountain', cost: 350, description: 'Standard medium fountain', category: 'fountains' },
  fountain_medium_2: { name: 'Medium Tiered Fountain', cost: 400, description: 'Tiered medium fountain', category: 'fountains' },
  fountain_medium_3: { name: 'Medium Classic Fountain', cost: 425, description: 'Classic medium fountain', category: 'fountains' },
  fountain_medium_4: { name: 'Medium Modern Fountain', cost: 450, description: 'Modern medium fountain', category: 'fountains' },
  fountain_medium_5: { name: 'Medium Ornate Fountain', cost: 500, description: 'Ornate medium fountain', category: 'fountains' },
  
  // Fountains - Large
  fountain_large_1: { name: 'Large Fountain', cost: 800, description: 'Grand large fountain', category: 'fountains', size: { width: 2, height: 2 } },
  fountain_large_2: { name: 'Large Tiered Fountain', cost: 900, description: 'Tiered large fountain', category: 'fountains', size: { width: 2, height: 2 } },
  fountain_large_3: { name: 'Large Classic Fountain', cost: 950, description: 'Classic large fountain', category: 'fountains', size: { width: 2, height: 2 } },
  fountain_large_4: { name: 'Large Modern Fountain', cost: 1000, description: 'Modern large fountain', category: 'fountains', size: { width: 2, height: 2 } },
  fountain_large_5: { name: 'Large Ornate Fountain', cost: 1200, description: 'Ornate large fountain', category: 'fountains', size: { width: 2, height: 2 } },
  
  // Ponds
  pond_small: { name: 'Small Pond', cost: 200, description: 'Small decorative pond', category: 'fountains' },
  pond_medium: { name: 'Medium Pond', cost: 350, description: 'Medium decorative pond', category: 'fountains' },
  pond_large: { name: 'Large Pond', cost: 500, description: 'Large decorative pond', category: 'fountains', size: { width: 2, height: 2 } },
  pond_koi: { name: 'Koi Pond', cost: 600, description: 'Pond with koi fish', category: 'fountains' },
  pond_lily: { name: 'Lily Pond', cost: 400, description: 'Pond with water lilies', category: 'fountains' },
  
  // Interactive Water Features
  splash_pad: { name: 'Splash Pad', cost: 450, description: 'Interactive splash zone', category: 'fountains' },
  water_jets: { name: 'Water Jets', cost: 300, description: 'Jumping water jets', category: 'fountains' },
  mist_fountain: { name: 'Mist Fountain', cost: 350, description: 'Cooling mist fountain', category: 'fountains' },
  interactive_fountain: { name: 'Interactive Fountain', cost: 550, description: 'Guest-activated fountain', category: 'fountains' },
  dancing_fountain: { name: 'Dancing Fountain', cost: 800, description: 'Choreographed water show', category: 'fountains', size: { width: 2, height: 2 } },
  
  // Food - American
  food_hotdog: { name: 'Hot Dog Stand', cost: 200, description: 'Sells hot dogs', category: 'food' },
  food_burger: { name: 'Burger Stand', cost: 250, description: 'Sells burgers', category: 'food' },
  food_fries: { name: 'Fries Stand', cost: 180, description: 'Sells french fries', category: 'food' },
  food_corndog: { name: 'Corn Dog Stand', cost: 200, description: 'Sells corn dogs', category: 'food' },
  food_pretzel: { name: 'Pretzel Stand', cost: 180, description: 'Sells soft pretzels', category: 'food' },
  // Food - Sweet Treats
  food_icecream: { name: 'Ice Cream Stand', cost: 200, description: 'Sells ice cream', category: 'food' },
  food_cotton_candy: { name: 'Cotton Candy', cost: 150, description: 'Sells cotton candy', category: 'food' },
  food_candy_apple: { name: 'Candy Apple', cost: 150, description: 'Sells candy apples', category: 'food' },
  food_churros: { name: 'Churros Stand', cost: 180, description: 'Sells churros', category: 'food' },
  food_funnel_cake: { name: 'Funnel Cake', cost: 200, description: 'Sells funnel cakes', category: 'food' },
  // Food - Drinks
  drink_soda: { name: 'Soda Stand', cost: 150, description: 'Sells cold drinks', category: 'food' },
  drink_lemonade: { name: 'Lemonade Stand', cost: 150, description: 'Fresh lemonade', category: 'food' },
  drink_smoothie: { name: 'Smoothie Stand', cost: 180, description: 'Fruit smoothies', category: 'food' },
  drink_coffee: { name: 'Coffee Stand', cost: 180, description: 'Coffee and espresso', category: 'food' },
  drink_slushie: { name: 'Slushie Stand', cost: 150, description: 'Frozen slushies', category: 'food' },
  // Food - Snacks
  snack_popcorn: { name: 'Popcorn Stand', cost: 180, description: 'Sells popcorn', category: 'food' },
  snack_nachos: { name: 'Nachos Stand', cost: 200, description: 'Sells nachos', category: 'food' },
  snack_pizza: { name: 'Pizza Stand', cost: 250, description: 'Sells pizza slices', category: 'food' },
  snack_cookies: { name: 'Cookie Stand', cost: 150, description: 'Fresh baked cookies', category: 'food' },
  snack_donuts: { name: 'Donut Stand', cost: 180, description: 'Sells donuts', category: 'food' },
  // Food - International
  food_tacos: { name: 'Taco Stand', cost: 220, description: 'Sells tacos', category: 'food' },
  food_noodles: { name: 'Noodle Stand', cost: 220, description: 'Asian noodles', category: 'food' },
  food_kebab: { name: 'Kebab Stand', cost: 220, description: 'Grilled kebabs', category: 'food' },
  food_crepes: { name: 'Crepe Stand', cost: 200, description: 'French crepes', category: 'food' },
  food_waffles: { name: 'Waffle Stand', cost: 200, description: 'Belgian waffles', category: 'food' },
  // Food - Themed Carts
  cart_pirate: { name: 'Pirate Food Cart', cost: 300, description: 'Themed pirate cart', category: 'food' },
  cart_space: { name: 'Space Food Cart', cost: 300, description: 'Themed space cart', category: 'food' },
  cart_medieval: { name: 'Medieval Food Cart', cost: 300, description: 'Themed medieval cart', category: 'food' },
  cart_western: { name: 'Western Food Cart', cost: 300, description: 'Themed western cart', category: 'food' },
  cart_tropical: { name: 'Tropical Food Cart', cost: 300, description: 'Themed tropical cart', category: 'food' },
  
  // Shops - Gift shops
  shop_souvenir: { name: 'Souvenir Shop', cost: 400, description: 'Sells souvenirs', category: 'shops' },
  shop_emporium: { name: 'Emporium', cost: 600, description: 'Large gift shop', category: 'shops' },
  shop_photo: { name: 'Photo Shop', cost: 300, description: 'On-ride photo sales', category: 'shops' },
  shop_ticket: { name: 'Ticket Booth', cost: 200, description: 'Ticket sales', category: 'shops' },
  shop_collectibles: { name: 'Collectibles', cost: 450, description: 'Sells collectibles', category: 'shops' },
  // Shops - Toy shops
  shop_toys: { name: 'Toy Shop', cost: 350, description: 'Sells toys and plushies', category: 'shops' },
  shop_plush: { name: 'Plush Shop', cost: 350, description: 'Stuffed animals', category: 'shops' },
  shop_apparel: { name: 'Apparel Shop', cost: 400, description: 'Park clothing', category: 'shops' },
  shop_bricks: { name: 'Brick Shop', cost: 400, description: 'Building toys', category: 'shops' },
  shop_rc: { name: 'RC Shop', cost: 350, description: 'Remote control toys', category: 'shops' },
  // Shops - Candy
  shop_candy: { name: 'Candy Shop', cost: 350, description: 'Sells candy', category: 'shops' },
  shop_fudge: { name: 'Fudge Shop', cost: 350, description: 'Fresh fudge', category: 'shops' },
  shop_jewelry: { name: 'Jewelry Shop', cost: 400, description: 'Costume jewelry', category: 'shops' },
  shop_popcorn_shop: { name: 'Popcorn Shop', cost: 300, description: 'Gourmet popcorn', category: 'shops' },
  shop_soda_fountain: { name: 'Soda Fountain', cost: 350, description: 'Retro soda shop', category: 'shops' },
  // Shops - Games
  game_ring_toss: { name: 'Ring Toss', cost: 250, description: 'Ring toss game', category: 'shops' },
  game_balloon: { name: 'Balloon Pop', cost: 250, description: 'Balloon dart game', category: 'shops' },
  game_shooting: { name: 'Shooting Gallery', cost: 300, description: 'Target shooting', category: 'shops' },
  game_darts: { name: 'Darts Game', cost: 250, description: 'Dart throwing', category: 'shops' },
  game_basketball: { name: 'Basketball Toss', cost: 300, description: 'Basketball game', category: 'shops' },
  // Shops - Entertainment
  arcade_building: { name: 'Arcade', cost: 500, description: 'Video game arcade', category: 'shops' },
  vr_experience: { name: 'VR Experience', cost: 600, description: 'Virtual reality', category: 'shops' },
  photo_booth: { name: 'Photo Booth', cost: 200, description: 'Instant photos', category: 'shops' },
  caricature: { name: 'Caricature Artist', cost: 150, description: 'Portrait drawings', category: 'shops' },
  face_paint: { name: 'Face Painting', cost: 150, description: 'Face painting booth', category: 'shops' },
  // Shops - Services
  restroom: { name: 'Restroom', cost: 300, description: 'Guest restroom', category: 'shops' },
  first_aid: { name: 'First Aid', cost: 400, description: 'Medical station', category: 'shops' },
  lockers: { name: 'Lockers', cost: 350, description: 'Storage lockers', category: 'shops' },
  stroller_rental: { name: 'Stroller Rental', cost: 250, description: 'Rent strollers', category: 'shops' },
  atm: { name: 'ATM', cost: 150, description: 'Cash machine', category: 'shops' },
  
  // Rides Small - Kiddie
  ride_kiddie_coaster: { name: 'Kiddie Coaster', cost: 3000, description: 'Mini roller coaster', category: 'rides_small', size: { width: 2, height: 2 } },
  ride_kiddie_train: { name: 'Kiddie Train', cost: 2500, description: 'Small train ride', category: 'rides_small', size: { width: 2, height: 2 } },
  ride_kiddie_planes: { name: 'Kiddie Planes', cost: 2500, description: 'Flying airplanes', category: 'rides_small', size: { width: 2, height: 2 } },
  ride_kiddie_boats: { name: 'Kiddie Boats', cost: 2500, description: 'Boat ride for kids', category: 'rides_small', size: { width: 2, height: 2 } },
  ride_kiddie_cars: { name: 'Kiddie Cars', cost: 2500, description: 'Car ride for kids', category: 'rides_small', size: { width: 2, height: 2 } },
  // Rides Small - Spinning
  ride_teacups: { name: 'Teacups', cost: 4000, description: 'Spinning teacups', category: 'rides_small', size: { width: 2, height: 2 } },
  ride_scrambler: { name: 'Scrambler', cost: 4500, description: 'Scrambler ride', category: 'rides_small', size: { width: 2, height: 2 } },
  ride_tilt_a_whirl: { name: 'Tilt-A-Whirl', cost: 4500, description: 'Tilting spinner', category: 'rides_small', size: { width: 2, height: 2 } },
  ride_spinning_apples: { name: 'Spinning Apples', cost: 4000, description: 'Apple basket spin', category: 'rides_small', size: { width: 2, height: 2 } },
  ride_whirlwind: { name: 'Whirlwind', cost: 5000, description: 'Fast spinner', category: 'rides_small', size: { width: 2, height: 2 } },
  // Rides Small - Classic
  ride_carousel: { name: 'Carousel', cost: 5000, description: 'Classic merry-go-round', category: 'rides_small', size: { width: 2, height: 2 } },
  ride_antique_cars: { name: 'Antique Cars', cost: 4500, description: 'Vintage car ride', category: 'rides_small', size: { width: 3, height: 2 } },
  ride_monorail_car: { name: 'Monorail', cost: 6000, description: 'Monorail segment', category: 'rides_small', size: { width: 2, height: 1 } },
  ride_sky_ride_car: { name: 'Sky Ride', cost: 5000, description: 'Gondola ride', category: 'rides_small', size: { width: 2, height: 1 } },
  ride_train_car: { name: 'Park Train', cost: 5000, description: 'Steam train ride', category: 'rides_small', size: { width: 2, height: 1 } },
  // Rides Small - Driving/Theater
  ride_bumper_cars: { name: 'Bumper Cars', cost: 6000, description: 'Classic bumper cars', category: 'rides_small', size: { width: 3, height: 2 } },
  ride_go_karts: { name: 'Go-Karts', cost: 8000, description: 'Racing go-karts', category: 'rides_small', size: { width: 4, height: 3 } },
  ride_simulator: { name: 'Motion Simulator', cost: 8000, description: 'Flight simulator', category: 'rides_small', size: { width: 2, height: 2 } },
  ride_motion_theater: { name: '3D Theater', cost: 7000, description: '3D movie experience', category: 'rides_small', size: { width: 3, height: 2 } },
  ride_4d_theater: { name: '4D Theater', cost: 9000, description: '4D movie experience', category: 'rides_small', size: { width: 3, height: 2 } },
  // Rides Small - Water
  ride_bumper_boats: { name: 'Bumper Boats', cost: 5000, description: 'Water bumper boats', category: 'rides_small', size: { width: 3, height: 2 } },
  ride_paddle_boats: { name: 'Paddle Boats', cost: 4000, description: 'Pedal boats', category: 'rides_small', size: { width: 3, height: 2 } },
  ride_lazy_river: { name: 'Lazy River', cost: 8000, description: 'Floating river', category: 'rides_small', size: { width: 3, height: 2 } },
  ride_water_play: { name: 'Water Playground', cost: 6000, description: 'Splash area', category: 'rides_small', size: { width: 3, height: 3 } },
  ride_splash_zone: { name: 'Splash Zone', cost: 5000, description: 'Fountain play area', category: 'rides_small', size: { width: 2, height: 2 } },
  // Rides Small - Dark Rides
  ride_haunted_house: { name: 'Haunted House', cost: 10000, description: 'Spooky dark ride', category: 'rides_small', size: { width: 3, height: 3 } },
  ride_ghost_train: { name: 'Ghost Train', cost: 9000, description: 'Scary train ride', category: 'rides_small', size: { width: 3, height: 3 } },
  ride_dark_ride: { name: 'Dark Ride', cost: 8000, description: 'Themed dark ride', category: 'rides_small', size: { width: 3, height: 3 } },
  ride_tunnel: { name: 'Tunnel Ride', cost: 6000, description: 'Mine tunnel ride', category: 'rides_small', size: { width: 2, height: 2 } },
  ride_themed_facade: { name: 'Castle Facade', cost: 10000, description: 'Themed castle entrance', category: 'rides_small', size: { width: 3, height: 3 } },
  
  // Rides Large - Ferris Wheels
  ride_ferris_classic: { name: 'Classic Ferris Wheel', cost: 12000, description: 'Traditional ferris wheel', category: 'rides_large', size: { width: 3, height: 3 } },
  ride_ferris_modern: { name: 'Modern Ferris Wheel', cost: 15000, description: 'Modern observation wheel', category: 'rides_large', size: { width: 3, height: 3 } },
  ride_ferris_observation: { name: 'Observation Wheel', cost: 20000, description: 'Giant observation wheel', category: 'rides_large', size: { width: 4, height: 4 } },
  ride_ferris_double: { name: 'Double Ferris Wheel', cost: 18000, description: 'Twin ferris wheels', category: 'rides_large', size: { width: 3, height: 3 } },
  ride_ferris_led: { name: 'LED Ferris Wheel', cost: 22000, description: 'Light-up wheel', category: 'rides_large', size: { width: 3, height: 3 } },
  // Rides Large - Drop/Tower
  ride_drop_tower: { name: 'Drop Tower', cost: 20000, description: 'Thrilling drop ride', category: 'rides_large', size: { width: 2, height: 2 } },
  ride_space_shot: { name: 'Space Shot', cost: 18000, description: 'Launch tower', category: 'rides_large', size: { width: 2, height: 2 } },
  ride_observation_tower: { name: 'Observation Tower', cost: 15000, description: 'Viewing tower', category: 'rides_large', size: { width: 2, height: 2 } },
  ride_sky_swing: { name: 'Sky Swing', cost: 16000, description: 'High swing ride', category: 'rides_large', size: { width: 2, height: 2 } },
  ride_star_flyer: { name: 'Star Flyer', cost: 18000, description: 'Rotating tower swing', category: 'rides_large', size: { width: 2, height: 2 } },
  // Rides Large - Swing
  ride_swing_ride: { name: 'Swing Ride', cost: 12000, description: 'Flying swings', category: 'rides_large', size: { width: 3, height: 3 } },
  ride_wave_swinger: { name: 'Wave Swinger', cost: 14000, description: 'Tilting swings', category: 'rides_large', size: { width: 3, height: 3 } },
  ride_flying_scooters: { name: 'Flying Scooters', cost: 10000, description: 'Controlled swings', category: 'rides_large', size: { width: 2, height: 2 } },
  ride_enterprise: { name: 'Enterprise', cost: 15000, description: 'Spinning wheel', category: 'rides_large', size: { width: 3, height: 3 } },
  ride_loop_o_plane: { name: 'Loop-O-Plane', cost: 12000, description: 'Looping ride', category: 'rides_large', size: { width: 2, height: 2 } },
  // Rides Large - Thrill
  ride_top_spin: { name: 'Top Spin', cost: 16000, description: 'Flipping ride', category: 'rides_large', size: { width: 2, height: 2 } },
  ride_frisbee: { name: 'Frisbee', cost: 18000, description: 'Giant pendulum', category: 'rides_large', size: { width: 3, height: 2 } },
  ride_afterburner: { name: 'Afterburner', cost: 17000, description: 'Spinning loop', category: 'rides_large', size: { width: 2, height: 2 } },
  ride_inversion: { name: 'Inversion', cost: 20000, description: 'Inverting thrill', category: 'rides_large', size: { width: 2, height: 2 } },
  ride_meteorite: { name: 'Meteorite', cost: 15000, description: 'Spinning disc', category: 'rides_large', size: { width: 2, height: 2 } },
  // Rides Large - Transport/Water
  ride_log_flume: { name: 'Log Flume', cost: 25000, description: 'Water splash ride', category: 'rides_large', size: { width: 3, height: 3 } },
  ride_rapids: { name: 'River Rapids', cost: 28000, description: 'White water ride', category: 'rides_large', size: { width: 3, height: 3 } },
  ride_train_station: { name: 'Train Station', cost: 8000, description: 'Park train station', category: 'rides_large', size: { width: 3, height: 2 } },
  ride_monorail_station: { name: 'Monorail Station', cost: 10000, description: 'Monorail station', category: 'rides_large', size: { width: 3, height: 2 } },
  ride_chairlift: { name: 'Chairlift', cost: 8000, description: 'Sky lift tower', category: 'rides_large', size: { width: 2, height: 2 } },
  // Rides Large - Shows
  show_4d: { name: '4D Show', cost: 12000, description: '4D theater building', category: 'rides_large', size: { width: 3, height: 3 } },
  show_stunt: { name: 'Stunt Show', cost: 15000, description: 'Stunt show arena', category: 'rides_large', size: { width: 3, height: 3 } },
  show_dolphin: { name: 'Dolphin Show', cost: 20000, description: 'Marine show stadium', category: 'rides_large', size: { width: 4, height: 4 } },
  show_amphitheater: { name: 'Amphitheater', cost: 18000, description: 'Outdoor theater', category: 'rides_large', size: { width: 4, height: 4 } },
  show_parade_float: { name: 'Parade Float', cost: 8000, description: 'Parade display', category: 'rides_large', size: { width: 2, height: 2 } },
  
  // Infrastructure
  park_entrance: { name: 'Park Entrance', cost: 1000, description: 'Main park entrance', category: 'infrastructure', size: { width: 3, height: 1 } },
  staff_building: { name: 'Staff Building', cost: 500, description: 'Staff facilities', category: 'infrastructure', size: { width: 2, height: 2 } },
};

// =============================================================================
// TILE TYPE
// =============================================================================

export interface Tile {
  x: number;
  y: number;
  terrain: 'grass' | 'water' | 'sand' | 'rock';
  building: Building;
  path: boolean;
  queue: boolean;
  queueRideId: string | null;
  hasCoasterTrack: boolean;
  coasterTrackId: string | null;
  trackPiece: TrackPiece | null;
  elevation: number; // For terrain height
}

// =============================================================================
// NOTIFICATION TYPE
// =============================================================================

export interface Notification {
  id: string;
  title: string;
  description: string;
  icon: 'info' | 'warning' | 'success' | 'error' | 'guest' | 'ride' | 'money';
  timestamp: number;
  tileX?: number;
  tileY?: number;
}

// =============================================================================
// GAME STATE
// =============================================================================

export interface GameState {
  id: string;
  
  // Grid
  grid: Tile[][];
  gridSize: number;
  
  // Time
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  tick: number;
  speed: 0 | 1 | 2 | 3;
  
  // Weather
  weather: WeatherState;
  
  // Park
  settings: ParkSettings;
  stats: ParkStats;
  finances: ParkFinances;
  
  // Entities
  guests: Guest[];
  staff: Staff[];
  coasters: Coaster[];
  
  // UI State
  selectedTool: Tool;
  activePanel: 'none' | 'finances' | 'guests' | 'rides' | 'staff' | 'settings';
  notifications: Notification[];
  
  // Active coaster building (if any)
  buildingCoasterId: string | null;
  buildingCoasterPath: { x: number; y: number }[];
  buildingCoasterHeight: number;
  buildingCoasterLastDirection: TrackDirection | null;
  buildingCoasterType: CoasterType | null; // The type of coaster currently being built
  
  // Version for save compatibility
  gameVersion: number;
}

// =============================================================================
// DEFAULT BUILDING
// =============================================================================

export function createEmptyBuilding(): Building {
  return {
    type: 'empty',
    level: 0,
    variant: 0,
    excitement: 0,
    intensity: 0,
    nausea: 0,
    capacity: 0,
    cycleTime: 0,
    price: 0,
    operating: false,
    broken: false,
    age: 0,
    constructionProgress: 100,
  };
}

// =============================================================================
// DEFAULT TILE
// =============================================================================

export function createEmptyTile(x: number, y: number): Tile {
  return {
    x,
    y,
    terrain: 'grass',
    building: createEmptyBuilding(),
    path: false,
    queue: false,
    queueRideId: null,
    hasCoasterTrack: false,
    coasterTrackId: null,
    trackPiece: null,
    elevation: 0,
  };
}
