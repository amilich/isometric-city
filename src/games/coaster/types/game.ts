/**
 * IsoCoaster Game State Types
 */

import { msg } from 'gt-next';
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
  select: { name: msg('Select'), cost: 0, description: msg('Select and inspect'), category: 'tools' },
  bulldoze: { name: msg('Bulldoze'), cost: 10, description: msg('Remove objects'), category: 'tools' },
  path: { name: msg('Path'), cost: 10, description: msg('Build guest walkways'), category: 'paths' },
  queue: { name: msg('Queue Line'), cost: 15, description: msg('Build ride queues'), category: 'paths' },

  // Terrain/Zoning
  zone_water: { name: msg('Water Terraform'), cost: 500, description: msg('Terraform land into water'), category: 'terrain' },
  zone_land: { name: msg('Land Terraform'), cost: 500, description: msg('Terraform water into land'), category: 'terrain' },

  coaster_build: { name: msg('Coaster Build Mode'), cost: 0, description: msg('Start building a coaster'), category: 'coasters' },
  coaster_track: { name: msg('Track: Straight'), cost: 20, description: msg('Place straight track segments'), category: 'coasters' },
  coaster_turn_left: { name: msg('Track: Left Turn'), cost: 25, description: msg('Place a left turn segment'), category: 'coasters' },
  coaster_turn_right: { name: msg('Track: Right Turn'), cost: 25, description: msg('Place a right turn segment'), category: 'coasters' },
  coaster_slope_up: { name: msg('Track: Slope Up'), cost: 30, description: msg('Place a rising track segment'), category: 'coasters' },
  coaster_slope_down: { name: msg('Track: Slope Down'), cost: 30, description: msg('Place a descending track segment'), category: 'coasters' },
  coaster_loop: { name: msg('Track: Loop'), cost: 150, description: msg('Place a vertical loop element'), category: 'coasters' },
  coaster_station: { name: msg('Coaster Station'), cost: 500, description: msg('Place coaster station'), category: 'coasters', size: { width: 1, height: 1 } },

  // Wooden Coasters
  coaster_type_wooden_classic: { name: msg('Classic Wooden'), cost: 50, description: msg('Traditional wooden coaster with airtime hills'), category: 'coasters' },
  coaster_type_wooden_twister: { name: msg('Wooden Twister'), cost: 60, description: msg('Wooden coaster with aggressive turns'), category: 'coasters' },

  // Steel Coasters
  coaster_type_steel_sit_down: { name: msg('Steel Sit-Down'), cost: 80, description: msg('Classic steel coaster with inversions'), category: 'coasters' },
  coaster_type_steel_standup: { name: msg('Stand-Up Coaster'), cost: 90, description: msg('Riders stand during the ride'), category: 'coasters' },
  coaster_type_steel_inverted: { name: msg('Inverted Coaster'), cost: 100, description: msg('Suspended beneath the track with inversions'), category: 'coasters' },
  coaster_type_steel_floorless: { name: msg('Floorless Coaster'), cost: 110, description: msg('Steel coaster with no floor beneath riders'), category: 'coasters' },
  coaster_type_steel_wing: { name: msg('Wing Coaster'), cost: 130, description: msg('Seats extend out beside the track'), category: 'coasters' },
  coaster_type_steel_flying: { name: msg('Flying Coaster'), cost: 140, description: msg('Riders are suspended face-down'), category: 'coasters' },
  coaster_type_steel_4d: { name: msg('4D Coaster'), cost: 200, description: msg('Seats rotate independently during ride'), category: 'coasters' },
  coaster_type_steel_spinning: { name: msg('Spinning Coaster'), cost: 70, description: msg('Cars spin freely during the ride'), category: 'coasters' },
  coaster_type_launch_coaster: { name: msg('Launch Coaster'), cost: 150, description: msg('Launched from station at high speed'), category: 'coasters' },
  coaster_type_hyper_coaster: { name: msg('Hyper Coaster'), cost: 120, description: msg('Tall, fast coaster focused on airtime'), category: 'coasters' },
  coaster_type_giga_coaster: { name: msg('Giga Coaster'), cost: 180, description: msg('Massive coaster exceeding 300 feet'), category: 'coasters' },

  // Water Coasters
  coaster_type_water_coaster: { name: msg('Water Coaster'), cost: 100, description: msg('Coaster with water splashdown sections'), category: 'coasters' },

  // Specialty Coasters
  coaster_type_mine_train: { name: msg('Mine Train'), cost: 55, description: msg('Family coaster themed as mine carts'), category: 'coasters' },
  coaster_type_bobsled: { name: msg('Bobsled Coaster'), cost: 60, description: msg('Coaster running in a half-pipe track'), category: 'coasters' },
  coaster_type_suspended: { name: msg('Suspended Swinging'), cost: 85, description: msg('Cars swing freely below the track'), category: 'coasters' },

  // Trees (sample - will be expanded)
  tree_oak: { name: msg('Oak Tree'), cost: 30, description: msg('Deciduous shade tree'), category: 'trees' },
  tree_maple: { name: msg('Maple Tree'), cost: 30, description: msg('Colorful maple tree'), category: 'trees' },
  tree_birch: { name: msg('Birch Tree'), cost: 25, description: msg('White bark birch'), category: 'trees' },
  tree_elm: { name: msg('Elm Tree'), cost: 30, description: msg('Classic elm tree'), category: 'trees' },
  tree_willow: { name: msg('Willow Tree'), cost: 40, description: msg('Weeping willow'), category: 'trees' },
  tree_pine: { name: msg('Pine Tree'), cost: 25, description: msg('Evergreen pine'), category: 'trees' },
  tree_spruce: { name: msg('Spruce Tree'), cost: 25, description: msg('Blue spruce'), category: 'trees' },
  tree_fir: { name: msg('Fir Tree'), cost: 25, description: msg('Douglas fir'), category: 'trees' },
  tree_cedar: { name: msg('Cedar Tree'), cost: 35, description: msg('Aromatic cedar'), category: 'trees' },
  tree_redwood: { name: msg('Redwood'), cost: 50, description: msg('Giant redwood'), category: 'trees' },
  tree_palm: { name: msg('Palm Tree'), cost: 40, description: msg('Tropical palm'), category: 'trees' },
  tree_banana: { name: msg('Banana Tree'), cost: 35, description: msg('Tropical banana plant'), category: 'trees' },
  tree_bamboo: { name: msg('Bamboo'), cost: 20, description: msg('Bamboo cluster'), category: 'trees' },
  tree_coconut: { name: msg('Coconut Palm'), cost: 45, description: msg('Tropical coconut palm'), category: 'trees' },
  tree_tropical: { name: msg('Tropical Tree'), cost: 40, description: msg('Exotic tropical tree'), category: 'trees' },
  tree_cherry: { name: msg('Cherry Blossom'), cost: 50, description: msg('Beautiful cherry blossom'), category: 'trees' },
  tree_magnolia: { name: msg('Magnolia'), cost: 45, description: msg('Flowering magnolia'), category: 'trees' },
  tree_dogwood: { name: msg('Dogwood'), cost: 40, description: msg('Flowering dogwood'), category: 'trees' },
  tree_jacaranda: { name: msg('Jacaranda'), cost: 50, description: msg('Purple jacaranda'), category: 'trees' },
  tree_wisteria: { name: msg('Wisteria'), cost: 55, description: msg('Cascading wisteria'), category: 'trees' },
  bush_hedge: { name: msg('Hedge'), cost: 15, description: msg('Trimmed hedge'), category: 'trees' },
  bush_flowering: { name: msg('Flowering Bush'), cost: 20, description: msg('Colorful flowering bush'), category: 'trees' },
  topiary_ball: { name: msg('Topiary Ball'), cost: 35, description: msg('Sculpted ball topiary'), category: 'trees' },
  topiary_spiral: { name: msg('Topiary Spiral'), cost: 45, description: msg('Spiral topiary'), category: 'trees' },
  topiary_animal: { name: msg('Animal Topiary'), cost: 60, description: msg('Animal-shaped topiary'), category: 'trees' },
  flowers_bed: { name: msg('Flower Bed'), cost: 20, description: msg('Colorful flower bed'), category: 'flowers' },
  flowers_planter: { name: msg('Flower Planter'), cost: 25, description: msg('Planter with flowers'), category: 'flowers' },
  flowers_hanging: { name: msg('Hanging Flowers'), cost: 30, description: msg('Hanging flower basket'), category: 'flowers' },
  flowers_wild: { name: msg('Wildflowers'), cost: 15, description: msg('Natural wildflowers'), category: 'flowers' },
  ground_cover: { name: msg('Ground Cover'), cost: 10, description: msg('Low ground cover plants'), category: 'flowers' },

  // Path furniture
  bench_wooden: { name: msg('Wooden Bench'), cost: 50, description: msg('Classic wooden bench'), category: 'furniture' },
  bench_metal: { name: msg('Metal Bench'), cost: 60, description: msg('Modern metal bench'), category: 'furniture' },
  bench_ornate: { name: msg('Ornate Bench'), cost: 80, description: msg('Decorative bench'), category: 'furniture' },
  bench_modern: { name: msg('Modern Bench'), cost: 70, description: msg('Contemporary bench'), category: 'furniture' },
  bench_rustic: { name: msg('Rustic Bench'), cost: 55, description: msg('Rustic log bench'), category: 'furniture' },
  lamp_victorian: { name: msg('Victorian Lamp'), cost: 100, description: msg('Classic street lamp'), category: 'furniture' },
  lamp_modern: { name: msg('Modern Lamp'), cost: 80, description: msg('Contemporary lamp'), category: 'furniture' },
  lamp_themed: { name: msg('Themed Lamp'), cost: 120, description: msg('Themed decorative lamp'), category: 'furniture' },
  lamp_double: { name: msg('Double Lamp'), cost: 150, description: msg('Double-headed lamp'), category: 'furniture' },
  lamp_pathway: { name: msg('Pathway Light'), cost: 60, description: msg('Low pathway light'), category: 'furniture' },
  trash_can_basic: { name: msg('Trash Can'), cost: 30, description: msg('Basic trash can'), category: 'furniture' },
  trash_can_fancy: { name: msg('Fancy Trash Can'), cost: 50, description: msg('Decorative trash can'), category: 'furniture' },
  trash_can_themed: { name: msg('Themed Trash Can'), cost: 70, description: msg('Themed trash can'), category: 'furniture' },

  // Fountains - Small
  fountain_small_1: { name: msg('Small Fountain'), cost: 150, description: msg('Simple small fountain'), category: 'fountains' },
  fountain_small_2: { name: msg('Small Tiered Fountain'), cost: 175, description: msg('Small tiered fountain'), category: 'fountains' },
  fountain_small_3: { name: msg('Small Classic Fountain'), cost: 180, description: msg('Classic small fountain'), category: 'fountains' },
  fountain_small_4: { name: msg('Small Modern Fountain'), cost: 200, description: msg('Modern small fountain'), category: 'fountains' },
  fountain_small_5: { name: msg('Small Ornate Fountain'), cost: 220, description: msg('Ornate small fountain'), category: 'fountains' },

  // Fountains - Medium
  fountain_medium_1: { name: msg('Medium Fountain'), cost: 350, description: msg('Standard medium fountain'), category: 'fountains' },
  fountain_medium_2: { name: msg('Medium Tiered Fountain'), cost: 400, description: msg('Tiered medium fountain'), category: 'fountains' },
  fountain_medium_3: { name: msg('Medium Classic Fountain'), cost: 425, description: msg('Classic medium fountain'), category: 'fountains' },
  fountain_medium_4: { name: msg('Medium Modern Fountain'), cost: 450, description: msg('Modern medium fountain'), category: 'fountains' },
  fountain_medium_5: { name: msg('Medium Ornate Fountain'), cost: 500, description: msg('Ornate medium fountain'), category: 'fountains' },

  // Fountains - Large
  fountain_large_1: { name: msg('Large Fountain'), cost: 800, description: msg('Grand large fountain'), category: 'fountains', size: { width: 2, height: 2 } },
  fountain_large_2: { name: msg('Large Tiered Fountain'), cost: 900, description: msg('Tiered large fountain'), category: 'fountains', size: { width: 2, height: 2 } },
  fountain_large_3: { name: msg('Large Classic Fountain'), cost: 950, description: msg('Classic large fountain'), category: 'fountains', size: { width: 2, height: 2 } },
  fountain_large_4: { name: msg('Large Modern Fountain'), cost: 1000, description: msg('Modern large fountain'), category: 'fountains', size: { width: 2, height: 2 } },
  fountain_large_5: { name: msg('Large Ornate Fountain'), cost: 1200, description: msg('Ornate large fountain'), category: 'fountains', size: { width: 2, height: 2 } },

  // Ponds
  pond_small: { name: msg('Small Pond'), cost: 200, description: msg('Small decorative pond'), category: 'fountains' },
  pond_medium: { name: msg('Medium Pond'), cost: 350, description: msg('Medium decorative pond'), category: 'fountains' },
  pond_large: { name: msg('Large Pond'), cost: 500, description: msg('Large decorative pond'), category: 'fountains', size: { width: 2, height: 2 } },
  pond_koi: { name: msg('Koi Pond'), cost: 600, description: msg('Pond with koi fish'), category: 'fountains' },
  pond_lily: { name: msg('Lily Pond'), cost: 400, description: msg('Pond with water lilies'), category: 'fountains' },

  // Interactive Water Features
  splash_pad: { name: msg('Splash Pad'), cost: 450, description: msg('Interactive splash zone'), category: 'fountains' },
  water_jets: { name: msg('Water Jets'), cost: 300, description: msg('Jumping water jets'), category: 'fountains' },
  mist_fountain: { name: msg('Mist Fountain'), cost: 350, description: msg('Cooling mist fountain'), category: 'fountains' },
  interactive_fountain: { name: msg('Interactive Fountain'), cost: 550, description: msg('Guest-activated fountain'), category: 'fountains' },
  dancing_fountain: { name: msg('Dancing Fountain'), cost: 800, description: msg('Choreographed water show'), category: 'fountains', size: { width: 2, height: 2 } },

  // Food - American
  food_hotdog: { name: msg('Hot Dog Stand'), cost: 200, description: msg('Sells hot dogs'), category: 'food' },
  food_burger: { name: msg('Burger Stand'), cost: 250, description: msg('Sells burgers'), category: 'food' },
  food_fries: { name: msg('Fries Stand'), cost: 180, description: msg('Sells french fries'), category: 'food' },
  food_corndog: { name: msg('Corn Dog Stand'), cost: 200, description: msg('Sells corn dogs'), category: 'food' },
  food_pretzel: { name: msg('Pretzel Stand'), cost: 180, description: msg('Sells soft pretzels'), category: 'food' },
  // Food - Sweet Treats
  food_icecream: { name: msg('Ice Cream Stand'), cost: 200, description: msg('Sells ice cream'), category: 'food' },
  food_cotton_candy: { name: msg('Cotton Candy'), cost: 150, description: msg('Sells cotton candy'), category: 'food' },
  food_candy_apple: { name: msg('Candy Apple'), cost: 150, description: msg('Sells candy apples'), category: 'food' },
  food_churros: { name: msg('Churros Stand'), cost: 180, description: msg('Sells churros'), category: 'food' },
  food_funnel_cake: { name: msg('Funnel Cake'), cost: 200, description: msg('Sells funnel cakes'), category: 'food' },
  // Food - Drinks
  drink_soda: { name: msg('Soda Stand'), cost: 150, description: msg('Sells cold drinks'), category: 'food' },
  drink_lemonade: { name: msg('Lemonade Stand'), cost: 150, description: msg('Fresh lemonade'), category: 'food' },
  drink_smoothie: { name: msg('Smoothie Stand'), cost: 180, description: msg('Fruit smoothies'), category: 'food' },
  drink_coffee: { name: msg('Coffee Stand'), cost: 180, description: msg('Coffee and espresso'), category: 'food' },
  drink_slushie: { name: msg('Slushie Stand'), cost: 150, description: msg('Frozen slushies'), category: 'food' },
  // Food - Snacks
  snack_popcorn: { name: msg('Popcorn Stand'), cost: 180, description: msg('Sells popcorn'), category: 'food' },
  snack_nachos: { name: msg('Nachos Stand'), cost: 200, description: msg('Sells nachos'), category: 'food' },
  snack_pizza: { name: msg('Pizza Stand'), cost: 250, description: msg('Sells pizza slices'), category: 'food' },
  snack_cookies: { name: msg('Cookie Stand'), cost: 150, description: msg('Fresh baked cookies'), category: 'food' },
  snack_donuts: { name: msg('Donut Stand'), cost: 180, description: msg('Sells donuts'), category: 'food' },
  // Food - International
  food_tacos: { name: msg('Taco Stand'), cost: 220, description: msg('Sells tacos'), category: 'food' },
  food_noodles: { name: msg('Noodle Stand'), cost: 220, description: msg('Asian noodles'), category: 'food' },
  food_kebab: { name: msg('Kebab Stand'), cost: 220, description: msg('Grilled kebabs'), category: 'food' },
  food_crepes: { name: msg('Crepe Stand'), cost: 200, description: msg('French crepes'), category: 'food' },
  food_waffles: { name: msg('Waffle Stand'), cost: 200, description: msg('Belgian waffles'), category: 'food' },
  // Food - Themed Carts
  cart_pirate: { name: msg('Pirate Food Cart'), cost: 300, description: msg('Themed pirate cart'), category: 'food' },
  cart_space: { name: msg('Space Food Cart'), cost: 300, description: msg('Themed space cart'), category: 'food' },
  cart_medieval: { name: msg('Medieval Food Cart'), cost: 300, description: msg('Themed medieval cart'), category: 'food' },
  cart_western: { name: msg('Western Food Cart'), cost: 300, description: msg('Themed western cart'), category: 'food' },
  cart_tropical: { name: msg('Tropical Food Cart'), cost: 300, description: msg('Themed tropical cart'), category: 'food' },

  // Shops - Gift shops
  shop_souvenir: { name: msg('Souvenir Shop'), cost: 400, description: msg('Sells souvenirs'), category: 'shops' },
  shop_emporium: { name: msg('Emporium'), cost: 600, description: msg('Large gift shop'), category: 'shops' },
  shop_photo: { name: msg('Photo Shop'), cost: 300, description: msg('On-ride photo sales'), category: 'shops' },
  shop_ticket: { name: msg('Ticket Booth'), cost: 200, description: msg('Ticket sales'), category: 'shops' },
  shop_collectibles: { name: msg('Collectibles'), cost: 450, description: msg('Sells collectibles'), category: 'shops' },
  // Shops - Toy shops
  shop_toys: { name: msg('Toy Shop'), cost: 350, description: msg('Sells toys and plushies'), category: 'shops' },
  shop_plush: { name: msg('Plush Shop'), cost: 350, description: msg('Stuffed animals'), category: 'shops' },
  shop_apparel: { name: msg('Apparel Shop'), cost: 400, description: msg('Park clothing'), category: 'shops' },
  shop_bricks: { name: msg('Brick Shop'), cost: 400, description: msg('Building toys'), category: 'shops' },
  shop_rc: { name: msg('RC Shop'), cost: 350, description: msg('Remote control toys'), category: 'shops' },
  // Shops - Candy
  shop_candy: { name: msg('Candy Shop'), cost: 350, description: msg('Sells candy'), category: 'shops' },
  shop_fudge: { name: msg('Fudge Shop'), cost: 350, description: msg('Fresh fudge'), category: 'shops' },
  shop_jewelry: { name: msg('Jewelry Shop'), cost: 400, description: msg('Costume jewelry'), category: 'shops' },
  shop_popcorn_shop: { name: msg('Popcorn Shop'), cost: 300, description: msg('Gourmet popcorn'), category: 'shops' },
  shop_soda_fountain: { name: msg('Soda Fountain'), cost: 350, description: msg('Retro soda shop'), category: 'shops' },
  // Shops - Games
  game_ring_toss: { name: msg('Ring Toss'), cost: 250, description: msg('Ring toss game'), category: 'shops' },
  game_balloon: { name: msg('Balloon Pop'), cost: 250, description: msg('Balloon dart game'), category: 'shops' },
  game_shooting: { name: msg('Shooting Gallery'), cost: 300, description: msg('Target shooting'), category: 'shops' },
  game_darts: { name: msg('Darts Game'), cost: 250, description: msg('Dart throwing'), category: 'shops' },
  game_basketball: { name: msg('Basketball Toss'), cost: 300, description: msg('Basketball game'), category: 'shops' },
  // Shops - Entertainment
  arcade_building: { name: msg('Arcade'), cost: 500, description: msg('Video game arcade'), category: 'shops' },
  vr_experience: { name: msg('VR Experience'), cost: 600, description: msg('Virtual reality'), category: 'shops' },
  photo_booth: { name: msg('Photo Booth'), cost: 200, description: msg('Instant photos'), category: 'shops' },
  caricature: { name: msg('Caricature Artist'), cost: 150, description: msg('Portrait drawings'), category: 'shops' },
  face_paint: { name: msg('Face Painting'), cost: 150, description: msg('Face painting booth'), category: 'shops' },
  // Shops - Services
  restroom: { name: msg('Restroom'), cost: 300, description: msg('Guest restroom'), category: 'shops' },
  first_aid: { name: msg('First Aid'), cost: 400, description: msg('Medical station'), category: 'shops' },
  lockers: { name: msg('Lockers'), cost: 350, description: msg('Storage lockers'), category: 'shops' },
  stroller_rental: { name: msg('Stroller Rental'), cost: 250, description: msg('Rent strollers'), category: 'shops' },
  atm: { name: msg('ATM'), cost: 150, description: msg('Cash machine'), category: 'shops' },

  // Rides Small - Kiddie
  ride_kiddie_coaster: { name: msg('Kiddie Coaster'), cost: 3000, description: msg('Mini roller coaster'), category: 'rides_small', size: { width: 2, height: 2 } },
  ride_kiddie_train: { name: msg('Kiddie Train'), cost: 2500, description: msg('Small train ride'), category: 'rides_small', size: { width: 2, height: 2 } },
  ride_kiddie_planes: { name: msg('Kiddie Planes'), cost: 2500, description: msg('Flying airplanes'), category: 'rides_small', size: { width: 2, height: 2 } },
  ride_kiddie_boats: { name: msg('Kiddie Boats'), cost: 2500, description: msg('Boat ride for kids'), category: 'rides_small', size: { width: 2, height: 2 } },
  ride_kiddie_cars: { name: msg('Kiddie Cars'), cost: 2500, description: msg('Car ride for kids'), category: 'rides_small', size: { width: 2, height: 2 } },
  // Rides Small - Spinning
  ride_teacups: { name: msg('Teacups'), cost: 4000, description: msg('Spinning teacups'), category: 'rides_small', size: { width: 2, height: 2 } },
  ride_scrambler: { name: msg('Scrambler'), cost: 4500, description: msg('Scrambler ride'), category: 'rides_small', size: { width: 2, height: 2 } },
  ride_tilt_a_whirl: { name: msg('Tilt-A-Whirl'), cost: 4500, description: msg('Tilting spinner'), category: 'rides_small', size: { width: 2, height: 2 } },
  ride_spinning_apples: { name: msg('Spinning Apples'), cost: 4000, description: msg('Apple basket spin'), category: 'rides_small', size: { width: 2, height: 2 } },
  ride_whirlwind: { name: msg('Whirlwind'), cost: 5000, description: msg('Fast spinner'), category: 'rides_small', size: { width: 2, height: 2 } },
  // Rides Small - Classic
  ride_carousel: { name: msg('Carousel'), cost: 5000, description: msg('Classic merry-go-round'), category: 'rides_small', size: { width: 2, height: 2 } },
  ride_antique_cars: { name: msg('Antique Cars'), cost: 4500, description: msg('Vintage car ride'), category: 'rides_small', size: { width: 3, height: 2 } },
  ride_monorail_car: { name: msg('Monorail'), cost: 6000, description: msg('Monorail segment'), category: 'rides_small', size: { width: 2, height: 1 } },
  ride_sky_ride_car: { name: msg('Sky Ride'), cost: 5000, description: msg('Gondola ride'), category: 'rides_small', size: { width: 2, height: 1 } },
  ride_train_car: { name: msg('Park Train'), cost: 5000, description: msg('Steam train ride'), category: 'rides_small', size: { width: 2, height: 1 } },
  // Rides Small - Driving/Theater
  ride_bumper_cars: { name: msg('Bumper Cars'), cost: 6000, description: msg('Classic bumper cars'), category: 'rides_small', size: { width: 3, height: 2 } },
  ride_go_karts: { name: msg('Go-Karts'), cost: 8000, description: msg('Racing go-karts'), category: 'rides_small', size: { width: 4, height: 3 } },
  ride_simulator: { name: msg('Motion Simulator'), cost: 8000, description: msg('Flight simulator'), category: 'rides_small', size: { width: 2, height: 2 } },
  ride_motion_theater: { name: msg('3D Theater'), cost: 7000, description: msg('3D movie experience'), category: 'rides_small', size: { width: 3, height: 2 } },
  ride_4d_theater: { name: msg('4D Theater'), cost: 9000, description: msg('4D movie experience'), category: 'rides_small', size: { width: 3, height: 2 } },
  // Rides Small - Water
  ride_bumper_boats: { name: msg('Bumper Boats'), cost: 5000, description: msg('Water bumper boats'), category: 'rides_small', size: { width: 3, height: 2 } },
  ride_paddle_boats: { name: msg('Paddle Boats'), cost: 4000, description: msg('Pedal boats'), category: 'rides_small', size: { width: 3, height: 2 } },
  ride_lazy_river: { name: msg('Lazy River'), cost: 8000, description: msg('Floating river'), category: 'rides_small', size: { width: 3, height: 2 } },
  ride_water_play: { name: msg('Water Playground'), cost: 6000, description: msg('Splash area'), category: 'rides_small', size: { width: 3, height: 3 } },
  ride_splash_zone: { name: msg('Splash Zone'), cost: 5000, description: msg('Fountain play area'), category: 'rides_small', size: { width: 2, height: 2 } },
  // Rides Small - Dark Rides
  ride_haunted_house: { name: msg('Haunted House'), cost: 10000, description: msg('Spooky dark ride'), category: 'rides_small', size: { width: 3, height: 3 } },
  ride_ghost_train: { name: msg('Ghost Train'), cost: 9000, description: msg('Scary train ride'), category: 'rides_small', size: { width: 3, height: 3 } },
  ride_dark_ride: { name: msg('Dark Ride'), cost: 8000, description: msg('Themed dark ride'), category: 'rides_small', size: { width: 3, height: 3 } },
  ride_tunnel: { name: msg('Tunnel Ride'), cost: 6000, description: msg('Mine tunnel ride'), category: 'rides_small', size: { width: 2, height: 2 } },
  ride_themed_facade: { name: msg('Castle Facade'), cost: 10000, description: msg('Themed castle entrance'), category: 'rides_small', size: { width: 3, height: 3 } },

  // Rides Large - Ferris Wheels
  ride_ferris_classic: { name: msg('Classic Ferris Wheel'), cost: 12000, description: msg('Traditional ferris wheel'), category: 'rides_large', size: { width: 3, height: 3 } },
  ride_ferris_modern: { name: msg('Modern Ferris Wheel'), cost: 15000, description: msg('Modern observation wheel'), category: 'rides_large', size: { width: 3, height: 3 } },
  ride_ferris_observation: { name: msg('Observation Wheel'), cost: 20000, description: msg('Giant observation wheel'), category: 'rides_large', size: { width: 4, height: 4 } },
  ride_ferris_double: { name: msg('Double Ferris Wheel'), cost: 18000, description: msg('Twin ferris wheels'), category: 'rides_large', size: { width: 3, height: 3 } },
  ride_ferris_led: { name: msg('LED Ferris Wheel'), cost: 22000, description: msg('Light-up wheel'), category: 'rides_large', size: { width: 3, height: 3 } },
  // Rides Large - Drop/Tower
  ride_drop_tower: { name: msg('Drop Tower'), cost: 20000, description: msg('Thrilling drop ride'), category: 'rides_large', size: { width: 2, height: 2 } },
  ride_space_shot: { name: msg('Space Shot'), cost: 18000, description: msg('Launch tower'), category: 'rides_large', size: { width: 2, height: 2 } },
  ride_observation_tower: { name: msg('Observation Tower'), cost: 15000, description: msg('Viewing tower'), category: 'rides_large', size: { width: 2, height: 2 } },
  ride_sky_swing: { name: msg('Sky Swing'), cost: 16000, description: msg('High swing ride'), category: 'rides_large', size: { width: 2, height: 2 } },
  ride_star_flyer: { name: msg('Star Flyer'), cost: 18000, description: msg('Rotating tower swing'), category: 'rides_large', size: { width: 2, height: 2 } },
  // Rides Large - Swing
  ride_swing_ride: { name: msg('Swing Ride'), cost: 12000, description: msg('Flying swings'), category: 'rides_large', size: { width: 3, height: 3 } },
  ride_wave_swinger: { name: msg('Wave Swinger'), cost: 14000, description: msg('Tilting swings'), category: 'rides_large', size: { width: 3, height: 3 } },
  ride_flying_scooters: { name: msg('Flying Scooters'), cost: 10000, description: msg('Controlled swings'), category: 'rides_large', size: { width: 2, height: 2 } },
  ride_enterprise: { name: msg('Enterprise'), cost: 15000, description: msg('Spinning wheel'), category: 'rides_large', size: { width: 3, height: 3 } },
  ride_loop_o_plane: { name: msg('Loop-O-Plane'), cost: 12000, description: msg('Looping ride'), category: 'rides_large', size: { width: 2, height: 2 } },
  // Rides Large - Thrill
  ride_top_spin: { name: msg('Top Spin'), cost: 16000, description: msg('Flipping ride'), category: 'rides_large', size: { width: 2, height: 2 } },
  ride_frisbee: { name: msg('Frisbee'), cost: 18000, description: msg('Giant pendulum'), category: 'rides_large', size: { width: 3, height: 2 } },
  ride_afterburner: { name: msg('Afterburner'), cost: 17000, description: msg('Spinning loop'), category: 'rides_large', size: { width: 2, height: 2 } },
  ride_inversion: { name: msg('Inversion'), cost: 20000, description: msg('Inverting thrill'), category: 'rides_large', size: { width: 2, height: 2 } },
  ride_meteorite: { name: msg('Meteorite'), cost: 15000, description: msg('Spinning disc'), category: 'rides_large', size: { width: 2, height: 2 } },
  // Rides Large - Transport/Water
  ride_log_flume: { name: msg('Log Flume'), cost: 25000, description: msg('Water splash ride'), category: 'rides_large', size: { width: 3, height: 3 } },
  ride_rapids: { name: msg('River Rapids'), cost: 28000, description: msg('White water ride'), category: 'rides_large', size: { width: 3, height: 3 } },
  ride_train_station: { name: msg('Train Station'), cost: 8000, description: msg('Park train station'), category: 'rides_large', size: { width: 3, height: 2 } },
  ride_monorail_station: { name: msg('Monorail Station'), cost: 10000, description: msg('Monorail station'), category: 'rides_large', size: { width: 3, height: 2 } },
  ride_chairlift: { name: msg('Chairlift'), cost: 8000, description: msg('Sky lift tower'), category: 'rides_large', size: { width: 2, height: 2 } },
  // Rides Large - Shows
  show_4d: { name: msg('4D Show'), cost: 12000, description: msg('4D theater building'), category: 'rides_large', size: { width: 3, height: 3 } },
  show_stunt: { name: msg('Stunt Show'), cost: 15000, description: msg('Stunt show arena'), category: 'rides_large', size: { width: 3, height: 3 } },
  show_dolphin: { name: msg('Dolphin Show'), cost: 20000, description: msg('Marine show stadium'), category: 'rides_large', size: { width: 4, height: 4 } },
  show_amphitheater: { name: msg('Amphitheater'), cost: 18000, description: msg('Outdoor theater'), category: 'rides_large', size: { width: 4, height: 4 } },
  show_parade_float: { name: msg('Parade Float'), cost: 8000, description: msg('Parade display'), category: 'rides_large', size: { width: 2, height: 2 } },

  // Infrastructure
  park_entrance: { name: msg('Park Entrance'), cost: 1000, description: msg('Main park entrance'), category: 'infrastructure', size: { width: 3, height: 1 } },
  staff_building: { name: msg('Staff Building'), cost: 500, description: msg('Staff facilities'), category: 'infrastructure', size: { width: 2, height: 2 } },
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
