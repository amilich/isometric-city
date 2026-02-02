//! Game state management

use super::tile::{Tile, Terrain};
use super::building::{Building, BuildingType};
use super::guest::Guest;
use super::coaster::Coaster;
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
            cash: 50000,
            park_rating: 500,
            selected_tool: Tool::Select,
            rng_state: 12345,
            next_guest_id: 1,
        };
        
        state.initialize_grid();
        state.generate_lakes();
        
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
        
        let tile = &self.grid[y][x];
        let cost = self.selected_tool.cost();
        
        match self.selected_tool {
            Tool::Select => {
                // Just selection, no action
            }
            
            Tool::Bulldoze => {
                let tile = &mut self.grid[y][x];
                if tile.building.is_some() {
                    tile.building = None;
                    // Refund partial cost (could be added)
                } else if tile.path {
                    tile.path = false;
                } else if tile.queue {
                    tile.queue = false;
                    tile.queue_ride_id = None;
                }
            }
            
            Tool::Path => {
                if tile.can_place_path() && self.cash >= cost as i64 {
                    self.grid[y][x].path = true;
                    self.cash -= cost as i64;
                }
            }
            
            Tool::Queue => {
                if tile.can_place_path() && self.cash >= cost as i64 {
                    self.grid[y][x].queue = true;
                    self.cash -= cost as i64;
                }
            }
            
            _ => {
                // Building placement
                if let Some(building_type) = self.selected_tool.building_type() {
                    if tile.can_build() && self.cash >= cost as i64 {
                        self.grid[y][x].building = Some(Building::new(building_type));
                        self.cash -= cost as i64;
                    }
                }
            }
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
