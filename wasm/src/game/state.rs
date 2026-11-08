//! Game state management

use super::tile::{Tile, Terrain};
use super::building::{Building, BuildingType};
use super::guest::Guest;
use super::coaster::{Coaster, CoasterType, TrackDirection, TrackPiece, TrackPieceType};
use super::tool::Tool;

/// Main game state
pub struct GameState {
    pub grid: Vec<Vec<Tile>>,
    pub grid_size: usize,
    
    // Time
    pub tick: u32,
    pub speed: u8,
    pub year: u32,
    pub month: u8,
    pub day: u8,
    pub hour: u8,
    pub minute: f32,
    
    // Entities
    pub guests: Vec<Guest>,
    pub coasters: Vec<Coaster>,
    pub active_coaster_id: Option<String>,
    
    // Economy
    pub cash: i64,
    pub park_rating: i32,
    
    // UI
    pub selected_tool: Tool,
    
    // Random number generator state
    rng_state: u64,
    next_guest_id: u32,
}

impl GameState {
    /// Create a new game state with the given grid size
    pub fn new(grid_size: usize) -> Self {
        let mut state = GameState {
            grid: Vec::new(),
            grid_size,
            tick: 0,
            speed: 1,
            year: 1,
            month: 3,
            day: 1,
            hour: 9,
            minute: 0.0,
            guests: Vec::new(),
            coasters: Vec::new(),
            active_coaster_id: None,
            cash: 50000,
            park_rating: 500,
            selected_tool: Tool::Select,
            rng_state: 12345,
            next_guest_id: 1,
        };
        
        state.initialize_grid();
        state.generate_lakes();
        state.setup_default_park();
        
        state
    }
    
    /// Initialize the grid with grass tiles
    fn initialize_grid(&mut self) {
        self.grid = (0..self.grid_size)
            .map(|y| {
                (0..self.grid_size)
                    .map(|x| Tile::new(x as i32, y as i32))
                    .collect()
            })
            .collect();
    }
    
    /// Generate lakes in the terrain
    fn generate_lakes(&mut self) {
        // Simple lake generation - create 2-3 round lakes
        let lake_count = 2 + (self.random() * 2.0) as usize;
        let min_dist_from_edge = (self.grid_size as f64 * 0.15).max(8.0) as i32;
        
        let mut lake_centers: Vec<(i32, i32)> = Vec::new();
        
        for _ in 0..lake_count {
            // Find a valid center
            let mut attempts = 0;
            loop {
                if attempts > 50 {
                    break;
                }
                attempts += 1;
                
                let cx = min_dist_from_edge + (self.random() * (self.grid_size as f64 - 2.0 * min_dist_from_edge as f64)) as i32;
                let cy = min_dist_from_edge + (self.random() * (self.grid_size as f64 - 2.0 * min_dist_from_edge as f64)) as i32;
                
                // Check distance from other lakes
                let min_lake_dist = (self.grid_size as f64 * 0.2).max(10.0);
                let too_close = lake_centers.iter().any(|&(lx, ly)| {
                    let dx = (cx - lx) as f64;
                    let dy = (cy - ly) as f64;
                    (dx * dx + dy * dy).sqrt() < min_lake_dist
                });
                
                if !too_close {
                    lake_centers.push((cx, cy));
                    break;
                }
            }
        }
        
        // Grow lakes from centers
        for (cx, cy) in lake_centers {
            let lake_radius = 4.0 + self.random() * 6.0;
            
            for dy in -(lake_radius as i32 + 2)..=(lake_radius as i32 + 2) {
                for dx in -(lake_radius as i32 + 2)..=(lake_radius as i32 + 2) {
                    let nx = cx + dx;
                    let ny = cy + dy;
                    
                    if nx < 0 || ny < 0 || nx >= self.grid_size as i32 || ny >= self.grid_size as i32 {
                        continue;
                    }
                    
                    let dist = ((dx * dx + dy * dy) as f64).sqrt();
                    
                    // Add some noise for natural shape
                    let noise = self.random() * 2.0 - 1.0;
                    let effective_radius = lake_radius + noise * 1.5;
                    
                    if dist <= effective_radius {
                        self.grid[ny as usize][nx as usize].terrain = Terrain::Water;
                    }
                }
            }
        }
    }

    /// Set up a basic starter park with paths, entrance, and demo coaster
    fn setup_default_park(&mut self) {
        let mid = (self.grid_size as i32) / 2;

        // Create a main path from the edge inward
        for x in 0..8 {
            let tile_x = x as i32;
            if let Some(tile) = self.get_tile_mut(tile_x, mid) {
                tile.terrain = Terrain::Grass;
                tile.path = true;
            }
        }

        // Vertical branch path
        for offset in -4..=4 {
            let tile_y = mid + offset;
            if let Some(tile) = self.get_tile_mut(5, tile_y) {
                tile.terrain = Terrain::Grass;
                tile.path = true;
            }
        }

        // Place a park entrance building near the path
        if let Some(tile) = self.get_tile_mut(2, mid - 1) {
            tile.terrain = Terrain::Grass;
            tile.building = Some(Building::new(BuildingType::ParkEntrance));
        }

        // Place a starter food stand
        if let Some(tile) = self.get_tile_mut(6, mid - 1) {
            tile.terrain = Terrain::Grass;
            tile.building = Some(Building::new(BuildingType::FoodHotdog));
        }

        // Create a demo coaster loop for immediate rendering
        self.create_demo_coaster();
    }

    /// Create a demo coaster with a simple loop
    fn create_demo_coaster(&mut self) {
        let base_x = (self.grid_size as i32) / 2 + 6;
        let base_y = (self.grid_size as i32) / 2 - 8;
        let loop_size = 6;

        let mut track_tiles: Vec<(i32, i32)> = Vec::new();

        // Top edge
        for x in 0..loop_size {
            track_tiles.push((base_x + x, base_y));
        }
        // Right edge
        for y in 1..loop_size {
            track_tiles.push((base_x + loop_size - 1, base_y + y));
        }
        // Bottom edge
        for x in (0..(loop_size - 1)).rev() {
            track_tiles.push((base_x + x, base_y + loop_size - 1));
        }
        // Left edge
        for y in (1..(loop_size - 1)).rev() {
            track_tiles.push((base_x, base_y + y));
        }

        if track_tiles.is_empty() {
            return;
        }

        let mut coaster = Coaster::new(
            "demo-coaster".to_string(),
            "Steel Loop".to_string(),
            CoasterType::SteelSitDown,
        );

        coaster.station_tile = track_tiles[0];

        let mut track_pieces: Vec<TrackPiece> = Vec::new();
        let mut last_direction = TrackDirection::East;

        for i in 0..track_tiles.len() {
            let current = track_tiles[i];
            let next = track_tiles[(i + 1) % track_tiles.len()];
            let dx = next.0 - current.0;
            let dy = next.1 - current.1;

            let direction = match (dx, dy) {
                (1, 0) => TrackDirection::East,
                (-1, 0) => TrackDirection::West,
                (0, 1) => TrackDirection::South,
                (0, -1) => TrackDirection::North,
                _ => last_direction,
            };

            let piece_type = if i == 0 {
                TrackPieceType::Station
            } else if direction == last_direction {
                TrackPieceType::StraightFlat
            } else {
                // Determine turn direction
                let turn_left = matches!(
                    (last_direction, direction),
                    (TrackDirection::North, TrackDirection::West)
                        | (TrackDirection::West, TrackDirection::South)
                        | (TrackDirection::South, TrackDirection::East)
                        | (TrackDirection::East, TrackDirection::North)
                );

                if turn_left {
                    TrackPieceType::TurnLeftFlat
                } else {
                    TrackPieceType::TurnRightFlat
                }
            };

            let mut piece = TrackPiece::new(piece_type, direction, 0);
            piece.strut_style = coaster.coaster_type.strut_style();
            track_pieces.push(piece);
            last_direction = direction;
        }

        coaster.track_tiles = track_tiles.clone();
        coaster.track_pieces = track_pieces;
        coaster.operating = true;
        coaster.add_trains(1, 3);

        // Mark tiles
        for (x, y) in track_tiles {
            if let Some(tile) = self.get_tile_mut(x, y) {
                tile.terrain = Terrain::Grass;
                tile.has_coaster_track = true;
                tile.coaster_track_id = Some(coaster.id.clone());
            }
        }

        let coaster_id = coaster.id.clone();
        self.coasters.push(coaster);
        self.active_coaster_id = Some(coaster_id);
    }
    
    /// Simple random number generator
    pub fn random(&mut self) -> f64 {
        // xorshift64
        self.rng_state ^= self.rng_state << 13;
        self.rng_state ^= self.rng_state >> 7;
        self.rng_state ^= self.rng_state << 17;
        (self.rng_state as f64) / (u64::MAX as f64)
    }
    
    /// Advance game time by one tick
    pub fn advance_time(&mut self) {
        self.tick += 1;
        
        // Time progression - slower during day
        let is_daytime = self.hour >= 7 && self.hour < 18;
        let minute_increment = if is_daytime { 0.25 } else { 3.0 };
        
        self.minute += minute_increment;
        
        if self.minute >= 60.0 {
            self.minute -= 60.0;
            self.hour += 1;
            
            if self.hour >= 24 {
                self.hour = 0;
                self.day += 1;
                
                if self.day > 30 {
                    self.day = 1;
                    self.month += 1;
                    
                    if self.month > 12 {
                        self.month = 1;
                        self.year += 1;
                    }
                }
            }
        }
    }
    
    /// Set tool from string
    pub fn set_tool_from_string(&mut self, tool_str: &str) {
        if let Some(tool) = Tool::from_string(tool_str) {
            self.selected_tool = tool;
        }
    }
    
    /// Apply current tool at grid position
    pub fn apply_tool(&mut self, grid_x: i32, grid_y: i32) {
        if grid_x < 0 || grid_y < 0 {
            return;
        }
        
        let x = grid_x as usize;
        let y = grid_y as usize;
        
        if x >= self.grid_size || y >= self.grid_size {
            return;
        }

        let cost = self.selected_tool.cost();

        match self.selected_tool {
            Tool::Select => {
                // Just selection, no action
            }

            Tool::Bulldoze => {
                if self.cash < cost as i64 {
                    return;
                }

                let has_building = self.grid[y][x].building.is_some();
                let has_path = self.grid[y][x].path;
                let has_queue = self.grid[y][x].queue;
                let mut did_remove = false;

                if has_building {
                    self.grid[y][x].building = None;
                    did_remove = true;
                } else if has_path {
                    self.grid[y][x].path = false;
                    did_remove = true;
                } else if has_queue {
                    self.grid[y][x].queue = false;
                    self.grid[y][x].queue_ride_id = None;
                    did_remove = true;
                } else {
                    if self.clear_track_tile(grid_x, grid_y) {
                        did_remove = true;
                    } else {
                        let neighbors = [(1, 0), (-1, 0), (0, 1), (0, -1)];
                        for (dx, dy) in neighbors {
                            if self.clear_track_tile(grid_x + dx, grid_y + dy) {
                                did_remove = true;
                                break;
                            }
                        }
                    }
                }

                if did_remove {
                    self.cash -= cost as i64;
                }
            }

            Tool::Path => {
                let tile = &self.grid[y][x];
                if tile.can_place_path() && self.cash >= cost as i64 {
                    self.grid[y][x].path = true;
                    self.cash -= cost as i64;
                }
            }

            Tool::Queue => {
                let tile = &self.grid[y][x];
                if tile.can_place_path() && self.cash >= cost as i64 {
                    self.grid[y][x].queue = true;
                    self.cash -= cost as i64;
                }
            }

            Tool::CoasterStation => {
                self.place_coaster_station(grid_x, grid_y, cost);
            }

            Tool::CoasterTrackStraight => {
                self.place_coaster_track(grid_x, grid_y, TrackPieceType::StraightFlat, cost);
            }

            Tool::CoasterTrackTurnLeft => {
                self.place_coaster_track(grid_x, grid_y, TrackPieceType::TurnLeftFlat, cost);
            }

            Tool::CoasterTrackTurnRight => {
                self.place_coaster_track(grid_x, grid_y, TrackPieceType::TurnRightFlat, cost);
            }

            Tool::CoasterTrackSlopeUp => {
                self.place_coaster_track(grid_x, grid_y, TrackPieceType::SlopeUpSmall, cost);
            }

            Tool::CoasterTrackSlopeDown => {
                self.place_coaster_track(grid_x, grid_y, TrackPieceType::SlopeDownSmall, cost);
            }

            Tool::CoasterTrackSlopeUpMedium => {
                self.place_coaster_track(grid_x, grid_y, TrackPieceType::SlopeUpMedium, cost);
            }

            Tool::CoasterTrackSlopeDownMedium => {
                self.place_coaster_track(grid_x, grid_y, TrackPieceType::SlopeDownMedium, cost);
            }

            Tool::CoasterTrackLiftHill => {
                self.place_coaster_track(grid_x, grid_y, TrackPieceType::LiftHill, cost);
            }

            Tool::CoasterTrackLoop => {
                self.place_coaster_track(grid_x, grid_y, TrackPieceType::LoopVertical, cost);
            }

            Tool::CoasterTrackCorkscrew => {
                self.place_coaster_track(grid_x, grid_y, TrackPieceType::Corkscrew, cost);
            }

            Tool::CoasterTrackBrakes => {
                self.place_coaster_track(grid_x, grid_y, TrackPieceType::Brakes, cost);
            }

            _ => {
                // Building placement
                let tile = &self.grid[y][x];
                if let Some(building_type) = self.selected_tool.building_type() {
                    if tile.can_build() && self.cash >= cost as i64 {
                        self.grid[y][x].building = Some(Building::new(building_type));
                        self.cash -= cost as i64;
                    }
                }
            }
        }
    }

    fn place_coaster_station(&mut self, grid_x: i32, grid_y: i32, cost: i32) {
        if self.cash < cost as i64 {
            return;
        }

        let tile = match self.get_tile(grid_x, grid_y) {
            Some(tile) => tile,
            None => return,
        };

        if tile.terrain == Terrain::Water || tile.building.is_some() || tile.has_coaster_track {
            return;
        }

        let coaster_id = format!("coaster-{}", self.coasters.len() + 1);
        let mut coaster = Coaster::new(
            coaster_id.clone(),
            format!("Custom Coaster {}", self.coasters.len() + 1),
            CoasterType::SteelSitDown,
        );
        coaster.station_tile = (grid_x, grid_y);

        let mut piece = TrackPiece::new(TrackPieceType::Station, TrackDirection::East, 0);
        piece.strut_style = coaster.coaster_type.strut_style();
        coaster.track_tiles.push((grid_x, grid_y));
        coaster.track_pieces.push(piece);

        self.coasters.push(coaster);
        self.active_coaster_id = Some(coaster_id.clone());

        if let Some(tile) = self.get_tile_mut(grid_x, grid_y) {
            tile.has_coaster_track = true;
            tile.coaster_track_id = Some(coaster_id);
        }

        self.cash -= cost as i64;
    }

    fn place_coaster_track(&mut self, grid_x: i32, grid_y: i32, piece_type: TrackPieceType, cost: i32) {
        if self.cash < cost as i64 {
            return;
        }

        let tile = match self.get_tile(grid_x, grid_y) {
            Some(tile) => tile,
            None => return,
        };

        if tile.terrain == Terrain::Water || tile.building.is_some() || tile.has_coaster_track {
            return;
        }

        let coaster_id = {
            let coaster = match self.get_active_coaster_mut() {
                Some(coaster) => coaster,
                None => return,
            };

            if coaster.track_tiles.is_empty() {
                return;
            }

            let last_tile = *coaster.track_tiles.last().unwrap();
            let dx = grid_x - last_tile.0;
            let dy = grid_y - last_tile.1;

            if dx.abs() + dy.abs() != 1 {
                return;
            }

            let direction = match (dx, dy) {
                (1, 0) => TrackDirection::East,
                (-1, 0) => TrackDirection::West,
                (0, 1) => TrackDirection::South,
                (0, -1) => TrackDirection::North,
                _ => TrackDirection::East,
            };

            let start_height = coaster
                .track_pieces
                .last()
                .map(|piece| piece.end_height)
                .unwrap_or(0);

            let mut piece = TrackPiece::new(piece_type, direction, start_height);
            piece.strut_style = coaster.coaster_type.strut_style();

            coaster.track_tiles.push((grid_x, grid_y));
            coaster.track_pieces.push(piece);

            if coaster.is_complete() {
                coaster.operating = true;
                coaster.add_trains(1, 3);
            }

            coaster.id.clone()
        };

        if let Some(tile) = self.get_tile_mut(grid_x, grid_y) {
            tile.has_coaster_track = true;
            tile.coaster_track_id = Some(coaster_id);
        }

        self.cash -= cost as i64;
    }

    fn remove_coaster_track_piece(&mut self, coaster_id: &str, grid_x: i32, grid_y: i32) {
        if let Some(coaster) = self.coasters.iter_mut().find(|c| c.id == coaster_id) {
            let mut new_tiles = Vec::new();
            let mut new_pieces = Vec::new();
            let mut removed_station = false;

            for (idx, &(tx, ty)) in coaster.track_tiles.iter().enumerate() {
                if tx == grid_x && ty == grid_y {
                    if coaster.station_tile == (tx, ty) {
                        removed_station = true;
                    }
                    continue;
                }

                if let Some(piece) = coaster.track_pieces.get(idx) {
                    new_tiles.push((tx, ty));
                    new_pieces.push(piece.clone());
                }
            }

            coaster.track_tiles = new_tiles;
            coaster.track_pieces = new_pieces;

            if removed_station {
                if let Some(&(tx, ty)) = coaster.track_tiles.first() {
                    coaster.station_tile = (tx, ty);
                }
            }

            if coaster.track_tiles.len() < 2 || !coaster.is_complete() {
                coaster.operating = false;
                coaster.trains.clear();
            }
        }
    }

    fn clear_track_tile(&mut self, grid_x: i32, grid_y: i32) -> bool {
        if !self.in_bounds(grid_x, grid_y) {
            return false;
        }

        let track_id = self.grid[grid_y as usize][grid_x as usize].coaster_track_id.clone();
        if !self.grid[grid_y as usize][grid_x as usize].has_coaster_track {
            return false;
        }

        self.grid[grid_y as usize][grid_x as usize].has_coaster_track = false;
        self.grid[grid_y as usize][grid_x as usize].coaster_track_id = None;

        if let Some(track_id) = track_id {
            self.remove_coaster_track_piece(&track_id, grid_x, grid_y);
        }

        true
    }

    fn get_active_coaster_mut(&mut self) -> Option<&mut Coaster> {
        let active_id = self.active_coaster_id.clone();
        if let Some(id) = active_id {
            self.coasters.iter_mut().find(|coaster| coaster.id == id)
        } else {
            self.coasters.first_mut()
        }
    }
    
    /// Get next guest ID
    pub fn next_guest_id(&mut self) -> u32 {
        let id = self.next_guest_id;
        self.next_guest_id += 1;
        id
    }
    
    /// Get tile at position
    pub fn get_tile(&self, x: i32, y: i32) -> Option<&Tile> {
        if x < 0 || y < 0 {
            return None;
        }
        self.grid.get(y as usize).and_then(|row| row.get(x as usize))
    }
    
    /// Get mutable tile at position
    pub fn get_tile_mut(&mut self, x: i32, y: i32) -> Option<&mut Tile> {
        if x < 0 || y < 0 {
            return None;
        }
        self.grid.get_mut(y as usize).and_then(|row| row.get_mut(x as usize))
    }
    
    /// Check if position is within grid bounds
    pub fn in_bounds(&self, x: i32, y: i32) -> bool {
        x >= 0 && y >= 0 && (x as usize) < self.grid_size && (y as usize) < self.grid_size
    }
    
    /// Find entrance tiles (path tiles at grid edges)
    pub fn find_entrance_tiles(&self) -> Vec<(i32, i32)> {
        let mut entrances = Vec::new();
        let size = self.grid_size as i32;
        
        for i in 0..self.grid_size {
            let i = i as i32;
            
            // North edge (x=0)
            if self.grid[i as usize][0].path {
                entrances.push((0, i));
            }
            // South edge (x=size-1)
            if self.grid[i as usize][(size - 1) as usize].path {
                entrances.push((size - 1, i));
            }
            // East edge (y=0)
            if self.grid[0][i as usize].path {
                entrances.push((i, 0));
            }
            // West edge (y=size-1)
            if self.grid[(size - 1) as usize][i as usize].path {
                entrances.push((i, size - 1));
            }
        }
        
        entrances
    }
    
    /// Calculate park rating based on guest happiness
    pub fn update_park_rating(&mut self) {
        if self.guests.is_empty() {
            return;
        }
        
        let avg_happiness: f32 = self.guests.iter().map(|g| g.happiness).sum::<f32>() 
            / self.guests.len() as f32;
        
        self.park_rating = (avg_happiness * 10.0).min(1000.0) as i32;
    }
}
