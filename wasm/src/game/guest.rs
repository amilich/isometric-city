//! Guest types and data

/// Guest state in the park
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum GuestState {
    Entering,
    Walking,
    Queuing,
    Riding,
    Eating,
    Shopping,
    Leaving,
    ExitingBuilding,
}

impl Default for GuestState {
    fn default() -> Self {
        GuestState::Entering
    }
}

/// Direction the guest is facing
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Direction {
    North,
    East,
    South,
    West,
}

impl Default for Direction {
    fn default() -> Self {
        Direction::South
    }
}

/// Guest color palette
#[derive(Clone)]
pub struct GuestColors {
    pub skin: String,
    pub shirt: String,
    pub pants: String,
    pub hat: String,
}

/// Available color palettes (matching original game)
pub const SKIN_COLORS: [&str; 7] = [
    "#ffd5b4", "#f5c9a6", "#e5b898", "#d4a574", 
    "#c49462", "#a67b5b", "#8b6b4a"
];

pub const SHIRT_COLORS: [&str; 9] = [
    "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6",
    "#8b5cf6", "#ec4899", "#06b6d4", "#f43f5e"
];

pub const PANTS_COLORS: [&str; 6] = [
    "#1e293b", "#475569", "#64748b", "#0f172a", "#1e3a5a", "#422006"
];

pub const HAT_COLORS: [&str; 7] = [
    "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ffffff"
];

/// A guest in the park
#[derive(Clone)]
pub struct Guest {
    pub id: u32,
    
    // Position
    pub tile_x: i32,
    pub tile_y: i32,
    pub target_x: i32,
    pub target_y: i32,
    pub progress: f32,
    pub direction: Direction,
    
    // State
    pub state: GuestState,
    pub last_state: GuestState,
    pub target_building_id: Option<String>,
    pub target_building_kind: Option<TargetKind>,
    
    // Path
    pub path: Vec<(i32, i32)>,
    pub path_index: usize,
    
    // Queue/ride
    pub queue_ride_id: Option<String>,
    pub queue_timer: f32,
    
    // Needs (0-100)
    pub hunger: f32,
    pub thirst: f32,
    pub bathroom: f32,
    pub energy: f32,
    pub happiness: f32,
    pub nausea: f32,
    
    // Money
    pub cash: i32,
    pub total_spent: i32,
    
    // Tracking
    pub time_in_park: f32,
    pub decision_cooldown: f32,
    
    // Visual
    pub colors: GuestColors,
    pub has_hat: bool,
    pub walk_offset: f32,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TargetKind {
    Ride,
    Food,
    Shop,
}

impl Guest {
    /// Create a new guest at the given entrance position
    pub fn new(id: u32, entrance_x: i32, entrance_y: i32, grid_size: usize, rng: &mut impl FnMut() -> f64) -> Self {
        // Determine target direction based on entrance edge
        let (target_x, target_y, direction) = {
            let size = grid_size as i32;
            if entrance_x == 0 {
                (entrance_x + 1, entrance_y, Direction::South)
            } else if entrance_x == size - 1 {
                (entrance_x - 1, entrance_y, Direction::North)
            } else if entrance_y == 0 {
                (entrance_x, entrance_y + 1, Direction::West)
            } else if entrance_y == size - 1 {
                (entrance_x, entrance_y - 1, Direction::East)
            } else {
                (entrance_x, entrance_y + 1, Direction::South)
            }
        };
        
        // Random colors
        let skin_idx = (rng() * SKIN_COLORS.len() as f64) as usize;
        let shirt_idx = (rng() * SHIRT_COLORS.len() as f64) as usize;
        let pants_idx = (rng() * PANTS_COLORS.len() as f64) as usize;
        let hat_idx = (rng() * HAT_COLORS.len() as f64) as usize;
        
        Guest {
            id,
            tile_x: entrance_x,
            tile_y: entrance_y,
            target_x,
            target_y,
            progress: 0.0,
            direction,
            state: GuestState::Entering,
            last_state: GuestState::Entering,
            target_building_id: None,
            target_building_kind: None,
            path: Vec::new(),
            path_index: 0,
            queue_ride_id: None,
            queue_timer: 0.0,
            hunger: 20.0 + rng() as f32 * 30.0,
            thirst: 20.0 + rng() as f32 * 30.0,
            bathroom: 10.0 + rng() as f32 * 20.0,
            energy: 80.0 + rng() as f32 * 20.0,
            happiness: 70.0 + rng() as f32 * 30.0,
            nausea: 0.0,
            cash: 30 + (rng() * 70.0) as i32,
            total_spent: 0,
            time_in_park: 0.0,
            decision_cooldown: 20.0 + rng() as f32 * 40.0,
            colors: GuestColors {
                skin: SKIN_COLORS[skin_idx % SKIN_COLORS.len()].to_string(),
                shirt: SHIRT_COLORS[shirt_idx % SHIRT_COLORS.len()].to_string(),
                pants: PANTS_COLORS[pants_idx % PANTS_COLORS.len()].to_string(),
                hat: HAT_COLORS[hat_idx % HAT_COLORS.len()].to_string(),
            },
            has_hat: rng() > 0.7,
            walk_offset: rng() as f32 * std::f32::consts::PI * 2.0,
        }
    }
}
