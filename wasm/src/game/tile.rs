//! Tile and terrain types

use super::building::Building;

/// Terrain type for a tile
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Terrain {
    Grass,
    Water,
    Sand,
    Rock,
}

impl Default for Terrain {
    fn default() -> Self {
        Terrain::Grass
    }
}

/// A single tile on the game grid
#[derive(Clone)]
pub struct Tile {
    pub x: i32,
    pub y: i32,
    pub terrain: Terrain,
    pub building: Option<Building>,
    pub path: bool,
    pub queue: bool,
    pub queue_ride_id: Option<String>,
    pub has_coaster_track: bool,
    pub coaster_track_id: Option<String>,
    pub elevation: i32,
}

impl Tile {
    pub fn new(x: i32, y: i32) -> Self {
        Tile {
            x,
            y,
            terrain: Terrain::Grass,
            building: None,
            path: false,
            queue: false,
            queue_ride_id: None,
            has_coaster_track: false,
            coaster_track_id: None,
            elevation: 0,
        }
    }
    
    pub fn new_water(x: i32, y: i32) -> Self {
        let mut tile = Self::new(x, y);
        tile.terrain = Terrain::Water;
        tile
    }
    
    /// Check if this tile can have a building placed on it
    pub fn can_build(&self) -> bool {
        self.terrain == Terrain::Grass 
            && self.building.is_none() 
            && !self.path 
            && !self.queue
            && !self.has_coaster_track
    }
    
    /// Check if this tile can have a path placed on it
    pub fn can_place_path(&self) -> bool {
        self.terrain == Terrain::Grass
            && self.building.is_none()
            && !self.has_coaster_track
    }
    
    /// Check if guests can walk on this tile
    pub fn is_walkable(&self) -> bool {
        self.path || self.queue
    }
    
    /// Check if this tile is at a map edge
    pub fn is_edge(&self, grid_size: usize) -> bool {
        let size = grid_size as i32;
        self.x == 0 || self.y == 0 || self.x == size - 1 || self.y == size - 1
    }
}
