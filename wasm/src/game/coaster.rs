//! Coaster types and data

/// Track direction
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TrackDirection {
    North,
    East,
    South,
    West,
}

impl Default for TrackDirection {
    fn default() -> Self {
        TrackDirection::North
    }
}

/// Track piece type
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TrackPieceType {
    StraightFlat,
    TurnLeftFlat,
    TurnRightFlat,
    SlopeUpSmall,
    SlopeUpMedium,
    SlopeDownSmall,
    SlopeDownMedium,
    LoopVertical,
    Corkscrew,
    Station,
    LiftHill,
    Brakes,
}

impl Default for TrackPieceType {
    fn default() -> Self {
        TrackPieceType::StraightFlat
    }
}

/// Support strut style
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum StrutStyle {
    Wood,
    Metal,
}

impl Default for StrutStyle {
    fn default() -> Self {
        StrutStyle::Metal
    }
}

/// Coaster type
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum CoasterType {
    WoodenClassic,
    WoodenTwister,
    SteelSitDown,
    SteelInverted,
    SteelFloorless,
    SteelWing,
    SteelFlying,
    MineTrain,
    WaterCoaster,
    LaunchCoaster,
    HyperCoaster,
    GigaCoaster,
}

impl Default for CoasterType {
    fn default() -> Self {
        CoasterType::SteelSitDown
    }
}

impl CoasterType {
    /// Get the strut style for this coaster type
    pub fn strut_style(&self) -> StrutStyle {
        match self {
            CoasterType::WoodenClassic | CoasterType::WoodenTwister => StrutStyle::Wood,
            _ => StrutStyle::Metal,
        }
    }
    
    /// Get primary color for this coaster type
    pub fn default_primary_color(&self) -> &'static str {
        match self {
            CoasterType::WoodenClassic => "#8B4513",
            CoasterType::WoodenTwister => "#A0522D",
            CoasterType::SteelSitDown => "#dc2626",
            CoasterType::SteelInverted => "#2563eb",
            CoasterType::SteelFloorless => "#059669",
            CoasterType::SteelWing => "#ea580c",
            CoasterType::SteelFlying => "#0891b2",
            CoasterType::MineTrain => "#92400e",
            CoasterType::WaterCoaster => "#0ea5e9",
            CoasterType::LaunchCoaster => "#e11d48",
            CoasterType::HyperCoaster => "#0d9488",
            CoasterType::GigaCoaster => "#4f46e5",
        }
    }
    
    /// Get secondary color for this coaster type  
    pub fn default_secondary_color(&self) -> &'static str {
        match self {
            CoasterType::WoodenClassic => "#D2691E",
            CoasterType::WoodenTwister => "#CD853F",
            CoasterType::SteelSitDown => "#fbbf24",
            CoasterType::SteelInverted => "#60a5fa",
            CoasterType::SteelFloorless => "#34d399",
            CoasterType::SteelWing => "#fb923c",
            CoasterType::SteelFlying => "#22d3ee",
            CoasterType::MineTrain => "#fcd34d",
            CoasterType::WaterCoaster => "#38bdf8",
            CoasterType::LaunchCoaster => "#fda4af",
            CoasterType::HyperCoaster => "#5eead4",
            CoasterType::GigaCoaster => "#a5b4fc",
        }
    }

    /// Get supports color for this coaster type
    pub fn default_support_color(&self) -> &'static str {
        match self {
            CoasterType::WoodenClassic => "#5C3317",
            CoasterType::WoodenTwister => "#654321",
            CoasterType::SteelSitDown => "#374151",
            CoasterType::SteelInverted => "#1e3a8a",
            CoasterType::SteelFloorless => "#064e3b",
            CoasterType::SteelWing => "#7c2d12",
            CoasterType::SteelFlying => "#164e63",
            CoasterType::MineTrain => "#451a03",
            CoasterType::WaterCoaster => "#0c4a6e",
            CoasterType::LaunchCoaster => "#9f1239",
            CoasterType::HyperCoaster => "#134e4a",
            CoasterType::GigaCoaster => "#312e81",
        }
    }
}

/// A single track piece
#[derive(Clone)]
pub struct TrackPiece {
    pub piece_type: TrackPieceType,
    pub direction: TrackDirection,
    pub start_height: i32,
    pub end_height: i32,
    pub chain_lift: bool,
    pub strut_style: StrutStyle,
}

impl TrackPiece {
    pub fn new(piece_type: TrackPieceType, direction: TrackDirection, height: i32) -> Self {
        let (start_h, end_h) = match piece_type {
            TrackPieceType::SlopeUpSmall | TrackPieceType::LiftHill => (height, height + 1),
            TrackPieceType::SlopeUpMedium => (height, height + 2),
            TrackPieceType::SlopeDownSmall => (height, height - 1),
            TrackPieceType::SlopeDownMedium => (height, height - 2),
            _ => (height, height),
        };
        
        TrackPiece {
            piece_type,
            direction,
            start_height: start_h,
            end_height: end_h,
            chain_lift: false,
            strut_style: StrutStyle::Metal,
        }
    }
}

/// Coaster color scheme
#[derive(Clone)]
pub struct CoasterColor {
    pub primary: String,
    pub secondary: String,
    pub supports: String,
}

impl Default for CoasterColor {
    fn default() -> Self {
        CoasterColor {
            primary: "#3b82f6".to_string(),
            secondary: "#1e293b".to_string(),
            supports: "#6b7280".to_string(),
        }
    }
}

/// Train state
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TrainState {
    Loading,
    Dispatching,
    Running,
    Braking,
}

impl Default for TrainState {
    fn default() -> Self {
        TrainState::Loading
    }
}

/// A single train car
#[derive(Clone)]
pub struct TrainCar {
    pub track_progress: f32,
    pub velocity: f32,
}

impl TrainCar {
    pub fn new(progress: f32) -> Self {
        TrainCar {
            track_progress: progress,
            velocity: 0.0,
        }
    }
}

/// A train on the coaster
#[derive(Clone)]
pub struct Train {
    pub id: u32,
    pub cars: Vec<TrainCar>,
    pub state: TrainState,
    pub state_timer: f32,
}

impl Train {
    pub fn new(id: u32, num_cars: usize, start_progress: f32, track_len: f32) -> Self {
        let car_spacing = 0.18;
        let cars = (0..num_cars)
            .map(|i| {
                let mut progress = start_progress - i as f32 * car_spacing;
                if progress < 0.0 {
                    progress = (progress % track_len + track_len) % track_len;
                }
                TrainCar::new(progress)
            })
            .collect();
        
        Train {
            id,
            cars,
            state: TrainState::Loading,
            state_timer: 5.0,
        }
    }
}

/// A complete coaster
#[derive(Clone)]
pub struct Coaster {
    pub id: String,
    pub name: String,
    pub coaster_type: CoasterType,
    pub color: CoasterColor,
    pub track_tiles: Vec<(i32, i32)>,
    pub track_pieces: Vec<TrackPiece>,
    pub station_tile: (i32, i32),
    pub trains: Vec<Train>,
    pub operating: bool,
    pub excitement: f32,
    pub intensity: f32,
    pub nausea: f32,
}

impl Coaster {
    pub fn new(id: String, name: String, coaster_type: CoasterType) -> Self {
        let color = CoasterColor {
            primary: coaster_type.default_primary_color().to_string(),
            secondary: coaster_type.default_secondary_color().to_string(),
            supports: coaster_type.default_support_color().to_string(),
        };
        
        Coaster {
            id,
            name,
            coaster_type,
            color,
            track_tiles: Vec::new(),
            track_pieces: Vec::new(),
            station_tile: (0, 0),
            trains: Vec::new(),
            operating: false,
            excitement: 0.0,
            intensity: 0.0,
            nausea: 0.0,
        }
    }
    
    /// Check if track forms a complete loop
    pub fn is_complete(&self) -> bool {
        if self.track_tiles.len() < 4 {
            return false;
        }
        
        let len = self.track_tiles.len();
        for i in 0..len {
            let (ax, ay) = self.track_tiles[i];
            let (bx, by) = self.track_tiles[(i + 1) % len];
            let dx = (ax - bx).abs();
            let dy = (ay - by).abs();
            if !((dx == 1 && dy == 0) || (dx == 0 && dy == 1)) {
                return false;
            }
        }

        true
    }
    
    /// Add trains to the coaster
    pub fn add_trains(&mut self, count: usize, cars_per_train: usize) {
        let track_len = self.track_pieces.len() as f32;
        if track_len < 1.0 {
            return;
        }
        
        self.trains.clear();
        for i in 0..count {
            let start_progress = (i as f32 * track_len / count as f32) % track_len;
            self.trains
                .push(Train::new(i as u32, cars_per_train, start_progress, track_len));
        }
    }
}
