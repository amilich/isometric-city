//! Building types and data

/// Building type enumeration
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BuildingType {
    Empty,
    
    // Trees
    TreeOak,
    TreeMaple,
    TreeBirch,
    TreeElm,
    TreeWillow,
    TreePine,
    TreeSpruce,
    TreeFir,
    TreeCedar,
    TreeRedwood,
    TreePalm,
    TreeBanana,
    TreeBamboo,
    TreeCoconut,
    TreeTropical,
    TreeCherry,
    TreeMagnolia,
    TreeDogwood,
    TreeJacaranda,
    TreeWisteria,
    BushHedge,
    BushFlowering,
    TopiaryBall,
    TopiarySpiral,
    TopiaryAnimal,
    FlowersBed,
    FlowersPlanter,
    FlowersHanging,
    FlowersWild,
    GroundCover,
    
    // Path Furniture
    BenchWooden,
    BenchMetal,
    BenchOrnate,
    BenchModern,
    BenchRustic,
    LampVictorian,
    LampModern,
    LampThemed,
    LampDouble,
    LampPathway,
    TrashCanBasic,
    TrashCanFancy,
    TrashCanThemed,
    
    // Food
    FoodHotdog,
    FoodBurger,
    FoodFries,
    FoodCorndog,
    FoodPretzel,
    FoodIcecream,
    FoodCottonCandy,
    FoodCandyApple,
    FoodChurros,
    FoodFunnelCake,
    DrinkSoda,
    DrinkLemonade,
    DrinkSmoothie,
    DrinkCoffee,
    DrinkSlushie,
    SnackPopcorn,
    SnackNachos,
    SnackPizza,
    SnackCookies,
    SnackDonuts,
    FoodTacos,
    FoodNoodles,
    FoodKebab,
    FoodCrepes,
    FoodWaffles,
    CartPirate,
    CartSpace,
    CartMedieval,
    CartWestern,
    CartTropical,
    
    // Shops
    ShopSouvenir,
    ShopEmporium,
    ShopPhoto,
    ShopTicket,
    ShopCollectibles,
    ShopToys,
    ShopPlush,
    ShopApparel,
    ShopBricks,
    ShopRc,
    ShopCandy,
    ShopFudge,
    ShopJewelry,
    ShopPopcornShop,
    ShopSodaFountain,
    GameRingToss,
    GameBalloon,
    GameShooting,
    GameDarts,
    GameBasketball,
    ArcadeBuilding,
    VrExperience,
    PhotoBooth,
    Caricature,
    FacePaint,
    Restroom,
    FirstAid,
    Lockers,
    StrollerRental,
    Atm,
    
    // Fountains
    FountainSmall1,
    FountainSmall2,
    FountainSmall3,
    FountainSmall4,
    FountainSmall5,
    FountainMedium1,
    FountainMedium2,
    FountainMedium3,
    FountainMedium4,
    FountainMedium5,
    FountainLarge1,
    FountainLarge2,
    FountainLarge3,
    FountainLarge4,
    FountainLarge5,
    PondSmall,
    PondMedium,
    PondLarge,
    PondKoi,
    PondLily,
    SplashPad,
    WaterJets,
    MistFountain,
    InteractiveFountain,
    DancingFountain,
    
    // Rides Small
    RideKiddieCoaster,
    RideKiddieTrain,
    RideKiddiePlanes,
    RideKiddieBoats,
    RideKiddieCars,
    RideTeacups,
    RideScrambler,
    RideTiltAWhirl,
    RideSpinningApples,
    RideWhirlwind,
    RideCarousel,
    RideAntiqueCars,
    RideMonorailCar,
    RideSkyRideCar,
    RideTrainCar,
    RideBumperCars,
    RideGoKarts,
    RideSimulator,
    RideMotionTheater,
    Ride4dTheater,
    RideBumperBoats,
    RidePaddleBoats,
    RideLazyRiver,
    RideWaterPlay,
    RideSplashZone,
    RideHauntedHouse,
    RideGhostTrain,
    RideDarkRide,
    RideTunnel,
    RideThemedFacade,
    
    // Rides Large
    RideFerrisClassic,
    RideFerrisModern,
    RideFerrisObservation,
    RideFerrisDouble,
    RideFerrisLed,
    RideDropTower,
    RideSpaceShot,
    RideObservationTower,
    RideSkySwing,
    RideStarFlyer,
    RideSwingRide,
    RideWaveSwinger,
    RideFlyingScooters,
    RideEnterprise,
    RideLoopOPlane,
    RideTopSpin,
    RideFrisbee,
    RideAfterburner,
    RideInversion,
    RideMeteorite,
    RideLogFlume,
    RideRapids,
    RideTrainStation,
    RideMonorailStation,
    RideChairlift,
    Show4d,
    ShowStunt,
    ShowDolphin,
    ShowAmphitheater,
    ShowParadeFloat,

    // Theming
    ThemeCastleTower,
    ThemePirateShip,
    ThemeTempleRuins,
    ThemeHauntedTree,
    ThemeCircusTent,
    ThemeGeometric,

    // Queue Decor
    QueuePostMetal,
    QueueRope,
    QueueWaitSign,
    QueueCanopy,
    
    // Coaster Stations
    StationWooden1,
    StationWooden2,
    StationWooden3,
    StationWooden4,
    StationWooden5,
    StationSteel1,
    StationSteel2,
    StationSteel3,
    StationSteel4,
    StationSteel5,
    StationInverted1,
    StationInverted2,
    StationInverted3,
    StationInverted4,
    StationInverted5,
    StationWater1,
    StationWater2,
    StationWater3,
    StationWater4,
    StationWater5,
    StationMine1,
    StationMine2,
    StationMine3,
    StationMine4,
    StationMine5,
    StationFuturistic1,
    StationFuturistic2,
    StationFuturistic3,
    StationFuturistic4,
    StationFuturistic5,
    
    // Infrastructure
    ParkEntrance,
    StaffBuilding,
}

impl Default for BuildingType {
    fn default() -> Self {
        BuildingType::Empty
    }
}

impl BuildingType {
    /// Get the sprite sheet ID for this building type
    pub fn sprite_sheet_id(&self) -> Option<&'static str> {
        match self {
            BuildingType::Empty => None,
            
            // Trees
            BuildingType::TreeOak | BuildingType::TreeMaple | BuildingType::TreeBirch |
            BuildingType::TreeElm | BuildingType::TreeWillow | BuildingType::TreePine |
            BuildingType::TreeSpruce | BuildingType::TreeFir | BuildingType::TreeCedar |
            BuildingType::TreeRedwood | BuildingType::TreePalm | BuildingType::TreeBanana |
            BuildingType::TreeBamboo | BuildingType::TreeCoconut | BuildingType::TreeTropical |
            BuildingType::TreeCherry | BuildingType::TreeMagnolia | BuildingType::TreeDogwood |
            BuildingType::TreeJacaranda | BuildingType::TreeWisteria | BuildingType::BushHedge |
            BuildingType::BushFlowering | BuildingType::TopiaryBall | BuildingType::TopiarySpiral |
            BuildingType::TopiaryAnimal | BuildingType::FlowersBed | BuildingType::FlowersPlanter |
            BuildingType::FlowersHanging | BuildingType::FlowersWild | BuildingType::GroundCover => Some("trees"),
            
            // Path Furniture
            BuildingType::BenchWooden | BuildingType::BenchMetal | BuildingType::BenchOrnate |
            BuildingType::BenchModern | BuildingType::BenchRustic | BuildingType::LampVictorian |
            BuildingType::LampModern | BuildingType::LampThemed | BuildingType::LampDouble |
            BuildingType::LampPathway | BuildingType::TrashCanBasic | BuildingType::TrashCanFancy |
            BuildingType::TrashCanThemed => Some("path_furniture"),
            
            // Food
            BuildingType::FoodHotdog | BuildingType::FoodBurger | BuildingType::FoodFries |
            BuildingType::FoodCorndog | BuildingType::FoodPretzel | BuildingType::FoodIcecream |
            BuildingType::FoodCottonCandy | BuildingType::FoodCandyApple | BuildingType::FoodChurros |
            BuildingType::FoodFunnelCake | BuildingType::DrinkSoda | BuildingType::DrinkLemonade |
            BuildingType::DrinkSmoothie | BuildingType::DrinkCoffee | BuildingType::DrinkSlushie |
            BuildingType::SnackPopcorn | BuildingType::SnackNachos | BuildingType::SnackPizza |
            BuildingType::SnackCookies | BuildingType::SnackDonuts | BuildingType::FoodTacos |
            BuildingType::FoodNoodles | BuildingType::FoodKebab | BuildingType::FoodCrepes |
            BuildingType::FoodWaffles | BuildingType::CartPirate | BuildingType::CartSpace |
            BuildingType::CartMedieval | BuildingType::CartWestern | BuildingType::CartTropical => Some("food"),
            
            // Shops
            BuildingType::ShopSouvenir | BuildingType::ShopEmporium | BuildingType::ShopPhoto |
            BuildingType::ShopTicket | BuildingType::ShopCollectibles | BuildingType::ShopToys |
            BuildingType::ShopPlush | BuildingType::ShopApparel | BuildingType::ShopBricks |
            BuildingType::ShopRc | BuildingType::ShopCandy | BuildingType::ShopFudge |
            BuildingType::ShopJewelry | BuildingType::ShopPopcornShop | BuildingType::ShopSodaFountain |
            BuildingType::GameRingToss | BuildingType::GameBalloon | BuildingType::GameShooting |
            BuildingType::GameDarts | BuildingType::GameBasketball | BuildingType::ArcadeBuilding |
            BuildingType::VrExperience | BuildingType::PhotoBooth | BuildingType::Caricature |
            BuildingType::FacePaint | BuildingType::Restroom | BuildingType::FirstAid |
            BuildingType::Lockers | BuildingType::StrollerRental | BuildingType::Atm => Some("shops"),
            
            // Fountains
            BuildingType::FountainSmall1 | BuildingType::FountainSmall2 | BuildingType::FountainSmall3 |
            BuildingType::FountainSmall4 | BuildingType::FountainSmall5 | BuildingType::FountainMedium1 |
            BuildingType::FountainMedium2 | BuildingType::FountainMedium3 | BuildingType::FountainMedium4 |
            BuildingType::FountainMedium5 | BuildingType::FountainLarge1 | BuildingType::FountainLarge2 |
            BuildingType::FountainLarge3 | BuildingType::FountainLarge4 | BuildingType::FountainLarge5 |
            BuildingType::PondSmall | BuildingType::PondMedium | BuildingType::PondLarge |
            BuildingType::PondKoi | BuildingType::PondLily | BuildingType::SplashPad |
            BuildingType::WaterJets | BuildingType::MistFountain | BuildingType::InteractiveFountain |
            BuildingType::DancingFountain => Some("fountains"),
            
            // Rides Small
            BuildingType::RideKiddieCoaster | BuildingType::RideKiddieTrain | BuildingType::RideKiddiePlanes |
            BuildingType::RideKiddieBoats | BuildingType::RideKiddieCars | BuildingType::RideTeacups |
            BuildingType::RideScrambler | BuildingType::RideTiltAWhirl | BuildingType::RideSpinningApples |
            BuildingType::RideWhirlwind | BuildingType::RideCarousel | BuildingType::RideAntiqueCars |
            BuildingType::RideMonorailCar | BuildingType::RideSkyRideCar | BuildingType::RideTrainCar |
            BuildingType::RideBumperCars | BuildingType::RideGoKarts | BuildingType::RideSimulator |
            BuildingType::RideMotionTheater | BuildingType::Ride4dTheater | BuildingType::RideBumperBoats |
            BuildingType::RidePaddleBoats | BuildingType::RideLazyRiver | BuildingType::RideWaterPlay |
            BuildingType::RideSplashZone | BuildingType::RideHauntedHouse | BuildingType::RideGhostTrain |
            BuildingType::RideDarkRide | BuildingType::RideTunnel | BuildingType::RideThemedFacade => Some("rides_small"),
            
            // Rides Large
            BuildingType::RideFerrisClassic | BuildingType::RideFerrisModern | BuildingType::RideFerrisObservation |
            BuildingType::RideFerrisDouble | BuildingType::RideFerrisLed | BuildingType::RideDropTower |
            BuildingType::RideSpaceShot | BuildingType::RideObservationTower | BuildingType::RideSkySwing |
            BuildingType::RideStarFlyer | BuildingType::RideSwingRide | BuildingType::RideWaveSwinger |
            BuildingType::RideFlyingScooters | BuildingType::RideEnterprise | BuildingType::RideLoopOPlane |
            BuildingType::RideTopSpin | BuildingType::RideFrisbee | BuildingType::RideAfterburner |
            BuildingType::RideInversion | BuildingType::RideMeteorite | BuildingType::RideLogFlume |
            BuildingType::RideRapids | BuildingType::RideTrainStation | BuildingType::RideMonorailStation |
            BuildingType::RideChairlift | BuildingType::Show4d | BuildingType::ShowStunt |
            BuildingType::ShowDolphin | BuildingType::ShowAmphitheater | BuildingType::ShowParadeFloat => Some("rides_large"),

            // Theming
            BuildingType::ThemeCastleTower | BuildingType::ThemePirateShip | BuildingType::ThemeTempleRuins => {
                Some("theme_classic")
            }
            BuildingType::ThemeHauntedTree | BuildingType::ThemeCircusTent | BuildingType::ThemeGeometric => {
                Some("theme_modern")
            }

            // Queue Decor
            BuildingType::QueuePostMetal | BuildingType::QueueRope | BuildingType::QueueWaitSign |
            BuildingType::QueueCanopy => Some("queue_elements"),
            
            // Stations
            BuildingType::StationWooden1 | BuildingType::StationWooden2 | BuildingType::StationWooden3 |
            BuildingType::StationWooden4 | BuildingType::StationWooden5 | BuildingType::StationSteel1 |
            BuildingType::StationSteel2 | BuildingType::StationSteel3 | BuildingType::StationSteel4 |
            BuildingType::StationSteel5 | BuildingType::StationInverted1 | BuildingType::StationInverted2 |
            BuildingType::StationInverted3 | BuildingType::StationInverted4 | BuildingType::StationInverted5 |
            BuildingType::StationWater1 | BuildingType::StationWater2 | BuildingType::StationWater3 |
            BuildingType::StationWater4 | BuildingType::StationWater5 | BuildingType::StationMine1 |
            BuildingType::StationMine2 | BuildingType::StationMine3 | BuildingType::StationMine4 |
            BuildingType::StationMine5 | BuildingType::StationFuturistic1 | BuildingType::StationFuturistic2 |
            BuildingType::StationFuturistic3 | BuildingType::StationFuturistic4 | BuildingType::StationFuturistic5 => Some("stations"),
            
            // Infrastructure
            BuildingType::ParkEntrance | BuildingType::StaffBuilding => Some("infrastructure"),
        }
    }
    
    /// Get the sprite name for lookup
    pub fn sprite_name(&self) -> &'static str {
        match self {
            BuildingType::Empty => "",
            BuildingType::TreeOak => "tree_oak",
            BuildingType::TreeMaple => "tree_maple",
            BuildingType::TreeBirch => "tree_birch",
            BuildingType::TreeElm => "tree_elm",
            BuildingType::TreeWillow => "tree_willow",
            BuildingType::TreePine => "tree_pine",
            BuildingType::TreeSpruce => "tree_spruce",
            BuildingType::TreeFir => "tree_fir",
            BuildingType::TreeCedar => "tree_cedar",
            BuildingType::TreeRedwood => "tree_redwood",
            BuildingType::TreePalm => "tree_palm",
            BuildingType::TreeBanana => "tree_banana",
            BuildingType::TreeBamboo => "tree_bamboo",
            BuildingType::TreeCoconut => "tree_coconut",
            BuildingType::TreeTropical => "tree_tropical",
            BuildingType::TreeCherry => "tree_cherry",
            BuildingType::TreeMagnolia => "tree_magnolia",
            BuildingType::TreeDogwood => "tree_dogwood",
            BuildingType::TreeJacaranda => "tree_jacaranda",
            BuildingType::TreeWisteria => "tree_wisteria",
            BuildingType::BushHedge => "bush_hedge",
            BuildingType::BushFlowering => "bush_flowering",
            BuildingType::TopiaryBall => "topiary_ball",
            BuildingType::TopiarySpiral => "topiary_spiral",
            BuildingType::TopiaryAnimal => "topiary_animal",
            BuildingType::FlowersBed => "flowers_bed",
            BuildingType::FlowersPlanter => "flowers_planter",
            BuildingType::FlowersHanging => "flowers_hanging",
            BuildingType::FlowersWild => "flowers_wild",
            BuildingType::GroundCover => "ground_cover",
            BuildingType::BenchWooden => "bench_wooden",
            BuildingType::BenchMetal => "bench_metal",
            BuildingType::BenchOrnate => "bench_ornate",
            BuildingType::BenchModern => "bench_modern",
            BuildingType::BenchRustic => "bench_rustic",
            BuildingType::LampVictorian => "lamp_victorian",
            BuildingType::LampModern => "lamp_modern",
            BuildingType::LampThemed => "lamp_themed",
            BuildingType::LampDouble => "lamp_double",
            BuildingType::LampPathway => "lamp_pathway",
            BuildingType::TrashCanBasic => "trash_can_basic",
            BuildingType::TrashCanFancy => "trash_can_fancy",
            BuildingType::TrashCanThemed => "trash_can_themed",
            BuildingType::FoodHotdog => "food_hotdog",
            BuildingType::FoodBurger => "food_burger",
            BuildingType::FoodFries => "food_fries",
            BuildingType::FoodCorndog => "food_corndog",
            BuildingType::FoodPretzel => "food_pretzel",
            BuildingType::FoodIcecream => "food_icecream",
            BuildingType::FoodCottonCandy => "food_cotton_candy",
            BuildingType::FoodCandyApple => "food_candy_apple",
            BuildingType::FoodChurros => "food_churros",
            BuildingType::FoodFunnelCake => "food_funnel_cake",
            BuildingType::DrinkSoda => "drink_soda",
            BuildingType::DrinkLemonade => "drink_lemonade",
            BuildingType::DrinkSmoothie => "drink_smoothie",
            BuildingType::DrinkCoffee => "drink_coffee",
            BuildingType::DrinkSlushie => "drink_slushie",
            BuildingType::SnackPopcorn => "snack_popcorn",
            BuildingType::SnackNachos => "snack_nachos",
            BuildingType::SnackPizza => "snack_pizza",
            BuildingType::SnackCookies => "snack_cookies",
            BuildingType::SnackDonuts => "snack_donuts",
            BuildingType::FoodTacos => "food_tacos",
            BuildingType::FoodNoodles => "food_noodles",
            BuildingType::FoodKebab => "food_kebab",
            BuildingType::FoodCrepes => "food_crepes",
            BuildingType::FoodWaffles => "food_waffles",
            BuildingType::CartPirate => "cart_pirate",
            BuildingType::CartSpace => "cart_space",
            BuildingType::CartMedieval => "cart_medieval",
            BuildingType::CartWestern => "cart_western",
            BuildingType::CartTropical => "cart_tropical",
            BuildingType::ShopSouvenir => "shop_souvenir_1",
            BuildingType::ShopEmporium => "shop_souvenir_2",
            BuildingType::ShopPhoto => "shop_photo",
            BuildingType::ShopTicket => "shop_ticket",
            BuildingType::ShopCollectibles => "shop_collectibles",
            BuildingType::ShopToys => "shop_toys",
            BuildingType::ShopPlush => "shop_plush",
            BuildingType::ShopApparel => "shop_apparel",
            BuildingType::ShopBricks => "shop_bricks",
            BuildingType::ShopRc => "shop_rc",
            BuildingType::ShopCandy => "shop_candy",
            BuildingType::ShopFudge => "shop_fudge",
            BuildingType::ShopJewelry => "shop_jewelry",
            BuildingType::ShopPopcornShop => "shop_popcorn",
            BuildingType::ShopSodaFountain => "shop_soda_fountain",
            BuildingType::GameRingToss => "game_ring_toss",
            BuildingType::GameBalloon => "game_balloon",
            BuildingType::GameShooting => "game_shooting",
            BuildingType::GameDarts => "game_darts",
            BuildingType::GameBasketball => "game_basketball",
            BuildingType::ArcadeBuilding => "arcade_building",
            BuildingType::VrExperience => "vr_experience",
            BuildingType::PhotoBooth => "photo_booth",
            BuildingType::Caricature => "caricature",
            BuildingType::FacePaint => "face_paint",
            BuildingType::Restroom => "restroom",
            BuildingType::FirstAid => "first_aid",
            BuildingType::Lockers => "lockers",
            BuildingType::StrollerRental => "stroller_rental",
            BuildingType::Atm => "atm",
            BuildingType::FountainSmall1 => "fountain_small_1",
            BuildingType::FountainSmall2 => "fountain_small_2",
            BuildingType::FountainSmall3 => "fountain_small_3",
            BuildingType::FountainSmall4 => "fountain_small_4",
            BuildingType::FountainSmall5 => "fountain_small_5",
            BuildingType::FountainMedium1 => "fountain_medium_1",
            BuildingType::FountainMedium2 => "fountain_medium_2",
            BuildingType::FountainMedium3 => "fountain_medium_3",
            BuildingType::FountainMedium4 => "fountain_medium_4",
            BuildingType::FountainMedium5 => "fountain_medium_5",
            BuildingType::FountainLarge1 => "fountain_large_1",
            BuildingType::FountainLarge2 => "fountain_large_2",
            BuildingType::FountainLarge3 => "fountain_large_3",
            BuildingType::FountainLarge4 => "fountain_large_4",
            BuildingType::FountainLarge5 => "fountain_large_5",
            BuildingType::PondSmall => "pond_small",
            BuildingType::PondMedium => "pond_medium",
            BuildingType::PondLarge => "pond_large",
            BuildingType::PondKoi => "pond_koi",
            BuildingType::PondLily => "pond_lily",
            BuildingType::SplashPad => "splash_pad",
            BuildingType::WaterJets => "water_jets",
            BuildingType::MistFountain => "mist_fountain",
            BuildingType::InteractiveFountain => "interactive_fountain",
            BuildingType::DancingFountain => "dancing_fountain",
            BuildingType::RideKiddieCoaster => "ride_kiddie_coaster",
            BuildingType::RideKiddieTrain => "ride_kiddie_train",
            BuildingType::RideKiddiePlanes => "ride_kiddie_planes",
            BuildingType::RideKiddieBoats => "ride_kiddie_boats",
            BuildingType::RideKiddieCars => "ride_kiddie_cars",
            BuildingType::RideTeacups => "ride_teacups",
            BuildingType::RideScrambler => "ride_scrambler",
            BuildingType::RideTiltAWhirl => "ride_tilt_a_whirl",
            BuildingType::RideSpinningApples => "ride_spinning_apples",
            BuildingType::RideWhirlwind => "ride_whirlwind",
            BuildingType::RideCarousel => "ride_carousel",
            BuildingType::RideAntiqueCars => "ride_antique_cars",
            BuildingType::RideMonorailCar => "ride_monorail_car",
            BuildingType::RideSkyRideCar => "ride_sky_ride_car",
            BuildingType::RideTrainCar => "ride_train_car",
            BuildingType::RideBumperCars => "ride_bumper_cars",
            BuildingType::RideGoKarts => "ride_go_karts",
            BuildingType::RideSimulator => "ride_simulator",
            BuildingType::RideMotionTheater => "ride_motion_theater",
            BuildingType::Ride4dTheater => "ride_4d_theater",
            BuildingType::RideBumperBoats => "ride_bumper_boats",
            BuildingType::RidePaddleBoats => "ride_paddle_boats",
            BuildingType::RideLazyRiver => "ride_lazy_river",
            BuildingType::RideWaterPlay => "ride_water_play",
            BuildingType::RideSplashZone => "ride_splash_zone",
            BuildingType::RideHauntedHouse => "ride_haunted_house",
            BuildingType::RideGhostTrain => "ride_ghost_train",
            BuildingType::RideDarkRide => "ride_dark_ride",
            BuildingType::RideTunnel => "ride_tunnel",
            BuildingType::RideThemedFacade => "ride_themed_facade",
            BuildingType::RideFerrisClassic => "ride_ferris_classic",
            BuildingType::RideFerrisModern => "ride_ferris_modern",
            BuildingType::RideFerrisObservation => "ride_ferris_observation",
            BuildingType::RideFerrisDouble => "ride_ferris_double",
            BuildingType::RideFerrisLed => "ride_ferris_led",
            BuildingType::RideDropTower => "ride_drop_tower",
            BuildingType::RideSpaceShot => "ride_space_shot",
            BuildingType::RideObservationTower => "ride_observation_tower",
            BuildingType::RideSkySwing => "ride_sky_swing",
            BuildingType::RideStarFlyer => "ride_star_flyer",
            BuildingType::RideSwingRide => "ride_swing_ride",
            BuildingType::RideWaveSwinger => "ride_wave_swinger",
            BuildingType::RideFlyingScooters => "ride_flying_scooters",
            BuildingType::RideEnterprise => "ride_enterprise",
            BuildingType::RideLoopOPlane => "ride_loop_o_plane",
            BuildingType::RideTopSpin => "ride_top_spin",
            BuildingType::RideFrisbee => "ride_frisbee",
            BuildingType::RideAfterburner => "ride_afterburner",
            BuildingType::RideInversion => "ride_inversion",
            BuildingType::RideMeteorite => "ride_meteorite",
            BuildingType::RideLogFlume => "ride_log_flume",
            BuildingType::RideRapids => "ride_rapids",
            BuildingType::RideTrainStation => "ride_train_station",
            BuildingType::RideMonorailStation => "ride_monorail_station",
            BuildingType::RideChairlift => "ride_chairlift",
            BuildingType::Show4d => "show_4d",
            BuildingType::ShowStunt => "show_stunt",
            BuildingType::ShowDolphin => "show_dolphin",
            BuildingType::ShowAmphitheater => "show_amphitheater",
            BuildingType::ShowParadeFloat => "show_parade_float",
            BuildingType::ThemeCastleTower => "theme_castle_tower",
            BuildingType::ThemePirateShip => "theme_pirate_ship",
            BuildingType::ThemeTempleRuins => "theme_temple_ruins",
            BuildingType::ThemeHauntedTree => "theme_haunted_tree",
            BuildingType::ThemeCircusTent => "theme_circus_tent",
            BuildingType::ThemeGeometric => "theme_geometric",
            BuildingType::QueuePostMetal => "queue_post_metal",
            BuildingType::QueueRope => "queue_rope",
            BuildingType::QueueWaitSign => "queue_wait_sign",
            BuildingType::QueueCanopy => "queue_canopy",
            BuildingType::StationWooden1 => "station_wooden_1",
            BuildingType::StationWooden2 => "station_wooden_2",
            BuildingType::StationWooden3 => "station_wooden_3",
            BuildingType::StationWooden4 => "station_wooden_4",
            BuildingType::StationWooden5 => "station_wooden_5",
            BuildingType::StationSteel1 => "station_steel_1",
            BuildingType::StationSteel2 => "station_steel_2",
            BuildingType::StationSteel3 => "station_steel_3",
            BuildingType::StationSteel4 => "station_steel_4",
            BuildingType::StationSteel5 => "station_steel_5",
            BuildingType::StationInverted1 => "station_inverted_1",
            BuildingType::StationInverted2 => "station_inverted_2",
            BuildingType::StationInverted3 => "station_inverted_3",
            BuildingType::StationInverted4 => "station_inverted_4",
            BuildingType::StationInverted5 => "station_inverted_5",
            BuildingType::StationWater1 => "station_water_1",
            BuildingType::StationWater2 => "station_water_2",
            BuildingType::StationWater3 => "station_water_3",
            BuildingType::StationWater4 => "station_water_4",
            BuildingType::StationWater5 => "station_water_5",
            BuildingType::StationMine1 => "station_mine_1",
            BuildingType::StationMine2 => "station_mine_2",
            BuildingType::StationMine3 => "station_mine_3",
            BuildingType::StationMine4 => "station_mine_4",
            BuildingType::StationMine5 => "station_mine_5",
            BuildingType::StationFuturistic1 => "station_futuristic_1",
            BuildingType::StationFuturistic2 => "station_futuristic_2",
            BuildingType::StationFuturistic3 => "station_futuristic_3",
            BuildingType::StationFuturistic4 => "station_futuristic_4",
            BuildingType::StationFuturistic5 => "station_futuristic_5",
            BuildingType::ParkEntrance => "infra_main_entrance",
            BuildingType::StaffBuilding => "infra_office",
        }
    }
    
    /// Get the cost of this building
    pub fn cost(&self) -> i32 {
        match self {
            BuildingType::Empty => 0,
            // Trees
            BuildingType::TreeOak | BuildingType::TreeMaple | BuildingType::TreeElm => 30,
            BuildingType::TreeBirch => 25,
            BuildingType::TreeWillow => 40,
            BuildingType::TreePine | BuildingType::TreeSpruce | BuildingType::TreeFir => 25,
            BuildingType::TreeCedar => 35,
            BuildingType::TreeRedwood => 50,
            BuildingType::TreePalm | BuildingType::TreeTropical => 40,
            BuildingType::TreeBanana => 35,
            BuildingType::TreeBamboo => 20,
            BuildingType::TreeCoconut => 45,
            BuildingType::TreeCherry | BuildingType::TreeJacaranda => 50,
            BuildingType::TreeMagnolia => 45,
            BuildingType::TreeDogwood => 40,
            BuildingType::TreeWisteria => 55,
            BuildingType::BushHedge => 15,
            BuildingType::BushFlowering => 20,
            BuildingType::TopiaryBall => 35,
            BuildingType::TopiarySpiral => 45,
            BuildingType::TopiaryAnimal => 60,
            BuildingType::FlowersBed => 20,
            BuildingType::FlowersPlanter => 25,
            BuildingType::FlowersHanging => 30,
            BuildingType::FlowersWild => 15,
            BuildingType::GroundCover => 10,
            // Furniture
            BuildingType::BenchWooden => 50,
            BuildingType::BenchMetal => 60,
            BuildingType::BenchOrnate => 80,
            BuildingType::BenchModern => 70,
            BuildingType::BenchRustic => 55,
            BuildingType::LampVictorian => 100,
            BuildingType::LampModern => 80,
            BuildingType::LampThemed => 120,
            BuildingType::LampDouble => 150,
            BuildingType::LampPathway => 60,
            BuildingType::TrashCanBasic => 30,
            BuildingType::TrashCanFancy => 50,
            BuildingType::TrashCanThemed => 70,
            // Food
            BuildingType::FoodHotdog | BuildingType::FoodBurger => 200,
            BuildingType::FoodFries | BuildingType::FoodCorndog | BuildingType::FoodPretzel => 180,
            BuildingType::FoodIcecream | BuildingType::FoodFunnelCake => 200,
            BuildingType::FoodCottonCandy | BuildingType::FoodCandyApple | BuildingType::FoodChurros => 150,
            BuildingType::DrinkSoda | BuildingType::DrinkLemonade | BuildingType::DrinkSlushie => 150,
            BuildingType::DrinkSmoothie | BuildingType::DrinkCoffee => 180,
            BuildingType::SnackPopcorn => 180,
            BuildingType::SnackNachos => 200,
            BuildingType::SnackPizza => 250,
            BuildingType::SnackCookies | BuildingType::SnackDonuts => 150,
            BuildingType::FoodTacos | BuildingType::FoodNoodles | BuildingType::FoodKebab => 220,
            BuildingType::FoodCrepes | BuildingType::FoodWaffles => 200,
            BuildingType::CartPirate | BuildingType::CartSpace | BuildingType::CartMedieval |
            BuildingType::CartWestern | BuildingType::CartTropical => 300,
            // Shops
            BuildingType::ShopSouvenir => 400,
            BuildingType::ShopEmporium => 600,
            BuildingType::ShopPhoto => 300,
            BuildingType::ShopTicket => 200,
            BuildingType::ShopCollectibles => 450,
            BuildingType::ShopToys | BuildingType::ShopPlush => 350,
            BuildingType::ShopApparel => 400,
            BuildingType::ShopBricks | BuildingType::ShopRc => 350,
            BuildingType::ShopCandy | BuildingType::ShopFudge => 350,
            BuildingType::ShopJewelry => 400,
            BuildingType::ShopPopcornShop => 300,
            BuildingType::ShopSodaFountain => 350,
            BuildingType::GameRingToss | BuildingType::GameBalloon | BuildingType::GameDarts => 250,
            BuildingType::GameShooting | BuildingType::GameBasketball => 300,
            BuildingType::ArcadeBuilding => 500,
            BuildingType::VrExperience => 600,
            BuildingType::PhotoBooth => 200,
            BuildingType::Caricature | BuildingType::FacePaint => 150,
            BuildingType::Restroom => 300,
            BuildingType::FirstAid => 400,
            BuildingType::Lockers => 350,
            BuildingType::StrollerRental => 250,
            BuildingType::Atm => 150,
            // Fountains
            BuildingType::FountainSmall1 | BuildingType::FountainSmall2 | BuildingType::FountainSmall3 |
            BuildingType::FountainSmall4 | BuildingType::FountainSmall5 => 150,
            BuildingType::FountainMedium1 | BuildingType::FountainMedium2 | BuildingType::FountainMedium3 |
            BuildingType::FountainMedium4 | BuildingType::FountainMedium5 => 350,
            BuildingType::FountainLarge1 | BuildingType::FountainLarge2 | BuildingType::FountainLarge3 |
            BuildingType::FountainLarge4 | BuildingType::FountainLarge5 => 800,
            BuildingType::PondSmall => 200,
            BuildingType::PondMedium => 350,
            BuildingType::PondLarge => 500,
            BuildingType::PondKoi => 600,
            BuildingType::PondLily => 400,
            BuildingType::SplashPad => 450,
            BuildingType::WaterJets => 300,
            BuildingType::MistFountain => 350,
            BuildingType::InteractiveFountain => 550,
            BuildingType::DancingFountain => 800,
            // Rides
            BuildingType::RideKiddieCoaster => 3000,
            BuildingType::RideKiddieTrain | BuildingType::RideKiddiePlanes | 
            BuildingType::RideKiddieBoats | BuildingType::RideKiddieCars => 2500,
            BuildingType::RideTeacups => 4000,
            BuildingType::RideScrambler | BuildingType::RideTiltAWhirl => 4500,
            BuildingType::RideSpinningApples => 4000,
            BuildingType::RideWhirlwind => 5000,
            BuildingType::RideCarousel => 5000,
            BuildingType::RideAntiqueCars => 4500,
            BuildingType::RideMonorailCar | BuildingType::RideSkyRideCar | BuildingType::RideTrainCar => 5000,
            BuildingType::RideBumperCars => 6000,
            BuildingType::RideGoKarts => 8000,
            BuildingType::RideSimulator => 8000,
            BuildingType::RideMotionTheater => 7000,
            BuildingType::Ride4dTheater => 9000,
            BuildingType::RideBumperBoats => 5000,
            BuildingType::RidePaddleBoats => 4000,
            BuildingType::RideLazyRiver => 8000,
            BuildingType::RideWaterPlay => 6000,
            BuildingType::RideSplashZone => 5000,
            BuildingType::RideHauntedHouse => 10000,
            BuildingType::RideGhostTrain => 9000,
            BuildingType::RideDarkRide => 8000,
            BuildingType::RideTunnel => 6000,
            BuildingType::RideThemedFacade => 10000,
            BuildingType::RideFerrisClassic => 12000,
            BuildingType::RideFerrisModern => 15000,
            BuildingType::RideFerrisObservation => 20000,
            BuildingType::RideFerrisDouble => 18000,
            BuildingType::RideFerrisLed => 22000,
            BuildingType::RideDropTower => 20000,
            BuildingType::RideSpaceShot => 18000,
            BuildingType::RideObservationTower => 15000,
            BuildingType::RideSkySwing => 16000,
            BuildingType::RideStarFlyer => 18000,
            BuildingType::RideSwingRide => 12000,
            BuildingType::RideWaveSwinger => 14000,
            BuildingType::RideFlyingScooters => 10000,
            BuildingType::RideEnterprise => 15000,
            BuildingType::RideLoopOPlane => 12000,
            BuildingType::RideTopSpin => 16000,
            BuildingType::RideFrisbee => 18000,
            BuildingType::RideAfterburner => 17000,
            BuildingType::RideInversion => 20000,
            BuildingType::RideMeteorite => 15000,
            BuildingType::RideLogFlume => 25000,
            BuildingType::RideRapids => 28000,
            BuildingType::RideTrainStation => 8000,
            BuildingType::RideMonorailStation => 10000,
            BuildingType::RideChairlift => 8000,
            BuildingType::Show4d => 12000,
            BuildingType::ShowStunt => 15000,
            BuildingType::ShowDolphin => 20000,
            BuildingType::ShowAmphitheater => 18000,
            BuildingType::ShowParadeFloat => 8000,
            // Theming
            BuildingType::ThemeCastleTower => 800,
            BuildingType::ThemePirateShip => 700,
            BuildingType::ThemeTempleRuins => 650,
            BuildingType::ThemeHauntedTree => 400,
            BuildingType::ThemeCircusTent => 800,
            BuildingType::ThemeGeometric => 450,
            // Queue Decor
            BuildingType::QueuePostMetal => 60,
            BuildingType::QueueRope => 40,
            BuildingType::QueueWaitSign => 80,
            BuildingType::QueueCanopy => 200,
            // Stations
            BuildingType::StationWooden1 | BuildingType::StationWooden2 | BuildingType::StationWooden3 |
            BuildingType::StationWooden4 | BuildingType::StationWooden5 => 500,
            BuildingType::StationSteel1 | BuildingType::StationSteel2 | BuildingType::StationSteel3 |
            BuildingType::StationSteel4 | BuildingType::StationSteel5 => 500,
            BuildingType::StationInverted1 | BuildingType::StationInverted2 | BuildingType::StationInverted3 |
            BuildingType::StationInverted4 | BuildingType::StationInverted5 => 500,
            BuildingType::StationWater1 | BuildingType::StationWater2 | BuildingType::StationWater3 |
            BuildingType::StationWater4 | BuildingType::StationWater5 => 500,
            BuildingType::StationMine1 | BuildingType::StationMine2 | BuildingType::StationMine3 |
            BuildingType::StationMine4 | BuildingType::StationMine5 => 500,
            BuildingType::StationFuturistic1 | BuildingType::StationFuturistic2 | BuildingType::StationFuturistic3 |
            BuildingType::StationFuturistic4 | BuildingType::StationFuturistic5 => 500,
            // Infrastructure
            BuildingType::ParkEntrance => 1000,
            BuildingType::StaffBuilding => 500,
        }
    }
    
    /// Check if this is a food building
    pub fn is_food(&self) -> bool {
        matches!(self,
            BuildingType::FoodHotdog | BuildingType::FoodBurger | BuildingType::FoodFries |
            BuildingType::FoodCorndog | BuildingType::FoodPretzel | BuildingType::FoodIcecream |
            BuildingType::FoodCottonCandy | BuildingType::FoodCandyApple | BuildingType::FoodChurros |
            BuildingType::FoodFunnelCake | BuildingType::DrinkSoda | BuildingType::DrinkLemonade |
            BuildingType::DrinkSmoothie | BuildingType::DrinkCoffee | BuildingType::DrinkSlushie |
            BuildingType::SnackPopcorn | BuildingType::SnackNachos | BuildingType::SnackPizza |
            BuildingType::SnackCookies | BuildingType::SnackDonuts | BuildingType::FoodTacos |
            BuildingType::FoodNoodles | BuildingType::FoodKebab | BuildingType::FoodCrepes |
            BuildingType::FoodWaffles | BuildingType::CartPirate | BuildingType::CartSpace |
            BuildingType::CartMedieval | BuildingType::CartWestern | BuildingType::CartTropical
        )
    }
    
    /// Check if this is a shop building
    pub fn is_shop(&self) -> bool {
        matches!(self,
            BuildingType::ShopSouvenir | BuildingType::ShopEmporium | BuildingType::ShopPhoto |
            BuildingType::ShopTicket | BuildingType::ShopCollectibles | BuildingType::ShopToys |
            BuildingType::ShopPlush | BuildingType::ShopApparel | BuildingType::ShopBricks |
            BuildingType::ShopRc | BuildingType::ShopCandy | BuildingType::ShopFudge |
            BuildingType::ShopJewelry | BuildingType::ShopPopcornShop | BuildingType::ShopSodaFountain |
            BuildingType::GameRingToss | BuildingType::GameBalloon | BuildingType::GameShooting |
            BuildingType::GameDarts | BuildingType::GameBasketball | BuildingType::ArcadeBuilding |
            BuildingType::VrExperience | BuildingType::PhotoBooth | BuildingType::Caricature |
            BuildingType::FacePaint | BuildingType::Restroom | BuildingType::FirstAid |
            BuildingType::Lockers | BuildingType::StrollerRental | BuildingType::Atm
        )
    }
    
    /// Check if this is a ride building
    pub fn is_ride(&self) -> bool {
        matches!(self,
            BuildingType::RideKiddieCoaster | BuildingType::RideKiddieTrain | BuildingType::RideKiddiePlanes |
            BuildingType::RideKiddieBoats | BuildingType::RideKiddieCars | BuildingType::RideTeacups |
            BuildingType::RideScrambler | BuildingType::RideTiltAWhirl | BuildingType::RideSpinningApples |
            BuildingType::RideWhirlwind | BuildingType::RideCarousel | BuildingType::RideAntiqueCars |
            BuildingType::RideMonorailCar | BuildingType::RideSkyRideCar | BuildingType::RideTrainCar |
            BuildingType::RideBumperCars | BuildingType::RideGoKarts | BuildingType::RideSimulator |
            BuildingType::RideMotionTheater | BuildingType::Ride4dTheater | BuildingType::RideBumperBoats |
            BuildingType::RidePaddleBoats | BuildingType::RideLazyRiver | BuildingType::RideWaterPlay |
            BuildingType::RideSplashZone | BuildingType::RideHauntedHouse | BuildingType::RideGhostTrain |
            BuildingType::RideDarkRide | BuildingType::RideTunnel | BuildingType::RideThemedFacade |
            BuildingType::RideFerrisClassic | BuildingType::RideFerrisModern | BuildingType::RideFerrisObservation |
            BuildingType::RideFerrisDouble | BuildingType::RideFerrisLed | BuildingType::RideDropTower |
            BuildingType::RideSpaceShot | BuildingType::RideObservationTower | BuildingType::RideSkySwing |
            BuildingType::RideStarFlyer | BuildingType::RideSwingRide | BuildingType::RideWaveSwinger |
            BuildingType::RideFlyingScooters | BuildingType::RideEnterprise | BuildingType::RideLoopOPlane |
            BuildingType::RideTopSpin | BuildingType::RideFrisbee | BuildingType::RideAfterburner |
            BuildingType::RideInversion | BuildingType::RideMeteorite | BuildingType::RideLogFlume |
            BuildingType::RideRapids | BuildingType::RideTrainStation | BuildingType::RideMonorailStation |
            BuildingType::RideChairlift | BuildingType::Show4d | BuildingType::ShowStunt |
            BuildingType::ShowDolphin | BuildingType::ShowAmphitheater | BuildingType::ShowParadeFloat
        )
    }

    /// Check if this building should render a grey base tile
    pub fn needs_grey_base(&self) -> bool {
        self.is_food()
            || self.is_shop()
            || self.is_ride()
            || matches!(
                self,
                BuildingType::FountainLarge1
                    | BuildingType::FountainLarge2
                    | BuildingType::FountainLarge3
                    | BuildingType::FountainLarge4
                    | BuildingType::FountainLarge5
                    | BuildingType::PondLarge
                    | BuildingType::DancingFountain
                    | BuildingType::ParkEntrance
                    | BuildingType::StaffBuilding
            )
    }
}

/// A placed building instance
#[derive(Clone)]
pub struct Building {
    pub building_type: BuildingType,
}

impl Building {
    pub fn new(building_type: BuildingType) -> Self {
        Building {
            building_type,
        }
    }
}
