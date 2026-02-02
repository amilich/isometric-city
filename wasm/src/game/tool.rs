//! Tool types for building/editing

use super::building::BuildingType;
use std::fmt;

/// Available tools
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tool {
    Select,
    Bulldoze,
    Path,
    Queue,
    
    // Trees
    TreeOak,
    TreeMaple,
    TreePine,
    TreePalm,
    TreeCherry,
    BushHedge,
    FlowersBed,
    
    // Path Furniture
    BenchWooden,
    BenchMetal,
    LampVictorian,
    LampModern,
    TrashCanBasic,
    TrashCanFancy,
    
    // Food
    FoodHotdog,
    FoodBurger,
    FoodIcecream,
    DrinkSoda,
    SnackPopcorn,
    
    // Shops
    ShopSouvenir,
    ShopToys,
    Restroom,
    FirstAid,
    
    // Fountains
    FountainSmall1,
    FountainMedium1,
    FountainLarge1,
    PondSmall,

    // Theming
    ThemeCastleTower,
    ThemePirateShip,
    ThemeTempleRuins,
    ThemeHauntedTree,
    ThemeCircusTent,
    ThemeGeometric,
    
    // Rides - Small
    RideCarousel,
    RideTeacups,
    RideBumperCars,
    
    // Rides - Large
    RideFerrisClassic,
    RideDropTower,
    RideLogFlume,
    
    // Coaster tools
    CoasterStation,
    CoasterTrackStraight,
    CoasterTrackTurnLeft,
    CoasterTrackTurnRight,
    CoasterTrackSlopeUp,
    CoasterTrackSlopeDown,
}

impl Default for Tool {
    fn default() -> Self {
        Tool::Select
    }
}

impl fmt::Display for Tool {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match self {
            Tool::Select => "select",
            Tool::Bulldoze => "bulldoze",
            Tool::Path => "path",
            Tool::Queue => "queue",
            Tool::TreeOak => "tree_oak",
            Tool::TreeMaple => "tree_maple",
            Tool::TreePine => "tree_pine",
            Tool::TreePalm => "tree_palm",
            Tool::TreeCherry => "tree_cherry",
            Tool::BushHedge => "bush_hedge",
            Tool::FlowersBed => "flowers_bed",
            Tool::BenchWooden => "bench_wooden",
            Tool::BenchMetal => "bench_metal",
            Tool::LampVictorian => "lamp_victorian",
            Tool::LampModern => "lamp_modern",
            Tool::TrashCanBasic => "trash_can_basic",
            Tool::TrashCanFancy => "trash_can_fancy",
            Tool::FoodHotdog => "food_hotdog",
            Tool::FoodBurger => "food_burger",
            Tool::FoodIcecream => "food_icecream",
            Tool::DrinkSoda => "drink_soda",
            Tool::SnackPopcorn => "snack_popcorn",
            Tool::ShopSouvenir => "shop_souvenir",
            Tool::ShopToys => "shop_toys",
            Tool::Restroom => "restroom",
            Tool::FirstAid => "first_aid",
            Tool::FountainSmall1 => "fountain_small_1",
            Tool::FountainMedium1 => "fountain_medium_1",
            Tool::FountainLarge1 => "fountain_large_1",
            Tool::PondSmall => "pond_small",
            Tool::ThemeCastleTower => "theme_castle_tower",
            Tool::ThemePirateShip => "theme_pirate_ship",
            Tool::ThemeTempleRuins => "theme_temple_ruins",
            Tool::ThemeHauntedTree => "theme_haunted_tree",
            Tool::ThemeCircusTent => "theme_circus_tent",
            Tool::ThemeGeometric => "theme_geometric",
            Tool::RideCarousel => "ride_carousel",
            Tool::RideTeacups => "ride_teacups",
            Tool::RideBumperCars => "ride_bumper_cars",
            Tool::RideFerrisClassic => "ride_ferris_classic",
            Tool::RideDropTower => "ride_drop_tower",
            Tool::RideLogFlume => "ride_log_flume",
            Tool::CoasterStation => "coaster_station",
            Tool::CoasterTrackStraight => "coaster_track_straight",
            Tool::CoasterTrackTurnLeft => "coaster_track_turn_left",
            Tool::CoasterTrackTurnRight => "coaster_track_turn_right",
            Tool::CoasterTrackSlopeUp => "coaster_track_slope_up",
            Tool::CoasterTrackSlopeDown => "coaster_track_slope_down",
        };
        write!(f, "{}", name)
    }
}

impl Tool {
    /// Parse tool from string
    pub fn from_string(s: &str) -> Option<Tool> {
        match s {
            "select" => Some(Tool::Select),
            "bulldoze" => Some(Tool::Bulldoze),
            "path" => Some(Tool::Path),
            "queue" => Some(Tool::Queue),
            "tree_oak" => Some(Tool::TreeOak),
            "tree_maple" => Some(Tool::TreeMaple),
            "tree_pine" => Some(Tool::TreePine),
            "tree_palm" => Some(Tool::TreePalm),
            "tree_cherry" => Some(Tool::TreeCherry),
            "bush_hedge" => Some(Tool::BushHedge),
            "flowers_bed" => Some(Tool::FlowersBed),
            "bench_wooden" => Some(Tool::BenchWooden),
            "bench_metal" => Some(Tool::BenchMetal),
            "lamp_victorian" => Some(Tool::LampVictorian),
            "lamp_modern" => Some(Tool::LampModern),
            "trash_can_basic" => Some(Tool::TrashCanBasic),
            "trash_can_fancy" => Some(Tool::TrashCanFancy),
            "food_hotdog" => Some(Tool::FoodHotdog),
            "food_burger" => Some(Tool::FoodBurger),
            "food_icecream" => Some(Tool::FoodIcecream),
            "drink_soda" => Some(Tool::DrinkSoda),
            "snack_popcorn" => Some(Tool::SnackPopcorn),
            "shop_souvenir" => Some(Tool::ShopSouvenir),
            "shop_toys" => Some(Tool::ShopToys),
            "restroom" => Some(Tool::Restroom),
            "first_aid" => Some(Tool::FirstAid),
            "fountain_small_1" => Some(Tool::FountainSmall1),
            "fountain_medium_1" => Some(Tool::FountainMedium1),
            "fountain_large_1" => Some(Tool::FountainLarge1),
            "pond_small" => Some(Tool::PondSmall),
            "theme_castle_tower" => Some(Tool::ThemeCastleTower),
            "theme_pirate_ship" => Some(Tool::ThemePirateShip),
            "theme_temple_ruins" => Some(Tool::ThemeTempleRuins),
            "theme_haunted_tree" => Some(Tool::ThemeHauntedTree),
            "theme_circus_tent" => Some(Tool::ThemeCircusTent),
            "theme_geometric" => Some(Tool::ThemeGeometric),
            "ride_carousel" => Some(Tool::RideCarousel),
            "ride_teacups" => Some(Tool::RideTeacups),
            "ride_bumper_cars" => Some(Tool::RideBumperCars),
            "ride_ferris_classic" => Some(Tool::RideFerrisClassic),
            "ride_drop_tower" => Some(Tool::RideDropTower),
            "ride_log_flume" => Some(Tool::RideLogFlume),
            "coaster_station" => Some(Tool::CoasterStation),
            "coaster_track_straight" => Some(Tool::CoasterTrackStraight),
            "coaster_track_turn_left" => Some(Tool::CoasterTrackTurnLeft),
            "coaster_track_turn_right" => Some(Tool::CoasterTrackTurnRight),
            "coaster_track_slope_up" => Some(Tool::CoasterTrackSlopeUp),
            "coaster_track_slope_down" => Some(Tool::CoasterTrackSlopeDown),
            _ => None,
        }
    }
    
    /// Get the building type this tool places
    pub fn building_type(&self) -> Option<BuildingType> {
        match self {
            Tool::Select | Tool::Bulldoze | Tool::Path | Tool::Queue => None,
            Tool::CoasterStation | Tool::CoasterTrackStraight | Tool::CoasterTrackTurnLeft |
            Tool::CoasterTrackTurnRight | Tool::CoasterTrackSlopeUp | Tool::CoasterTrackSlopeDown => None,
            
            Tool::TreeOak => Some(BuildingType::TreeOak),
            Tool::TreeMaple => Some(BuildingType::TreeMaple),
            Tool::TreePine => Some(BuildingType::TreePine),
            Tool::TreePalm => Some(BuildingType::TreePalm),
            Tool::TreeCherry => Some(BuildingType::TreeCherry),
            Tool::BushHedge => Some(BuildingType::BushHedge),
            Tool::FlowersBed => Some(BuildingType::FlowersBed),
            Tool::BenchWooden => Some(BuildingType::BenchWooden),
            Tool::BenchMetal => Some(BuildingType::BenchMetal),
            Tool::LampVictorian => Some(BuildingType::LampVictorian),
            Tool::LampModern => Some(BuildingType::LampModern),
            Tool::TrashCanBasic => Some(BuildingType::TrashCanBasic),
            Tool::TrashCanFancy => Some(BuildingType::TrashCanFancy),
            Tool::FoodHotdog => Some(BuildingType::FoodHotdog),
            Tool::FoodBurger => Some(BuildingType::FoodBurger),
            Tool::FoodIcecream => Some(BuildingType::FoodIcecream),
            Tool::DrinkSoda => Some(BuildingType::DrinkSoda),
            Tool::SnackPopcorn => Some(BuildingType::SnackPopcorn),
            Tool::ShopSouvenir => Some(BuildingType::ShopSouvenir),
            Tool::ShopToys => Some(BuildingType::ShopToys),
            Tool::Restroom => Some(BuildingType::Restroom),
            Tool::FirstAid => Some(BuildingType::FirstAid),
            Tool::FountainSmall1 => Some(BuildingType::FountainSmall1),
            Tool::FountainMedium1 => Some(BuildingType::FountainMedium1),
            Tool::FountainLarge1 => Some(BuildingType::FountainLarge1),
            Tool::PondSmall => Some(BuildingType::PondSmall),
            Tool::ThemeCastleTower => Some(BuildingType::ThemeCastleTower),
            Tool::ThemePirateShip => Some(BuildingType::ThemePirateShip),
            Tool::ThemeTempleRuins => Some(BuildingType::ThemeTempleRuins),
            Tool::ThemeHauntedTree => Some(BuildingType::ThemeHauntedTree),
            Tool::ThemeCircusTent => Some(BuildingType::ThemeCircusTent),
            Tool::ThemeGeometric => Some(BuildingType::ThemeGeometric),
            Tool::RideCarousel => Some(BuildingType::RideCarousel),
            Tool::RideTeacups => Some(BuildingType::RideTeacups),
            Tool::RideBumperCars => Some(BuildingType::RideBumperCars),
            Tool::RideFerrisClassic => Some(BuildingType::RideFerrisClassic),
            Tool::RideDropTower => Some(BuildingType::RideDropTower),
            Tool::RideLogFlume => Some(BuildingType::RideLogFlume),
        }
    }
    
    /// Get cost of using this tool
    pub fn cost(&self) -> i32 {
        match self {
            Tool::Select => 0,
            Tool::Bulldoze => 10,
            Tool::Path => 10,
            Tool::Queue => 15,
            Tool::CoasterStation | Tool::CoasterTrackStraight | Tool::CoasterTrackTurnLeft |
            Tool::CoasterTrackTurnRight | Tool::CoasterTrackSlopeUp | Tool::CoasterTrackSlopeDown => 50,
            _ => self.building_type().map(|b| b.cost()).unwrap_or(0),
        }
    }
}
