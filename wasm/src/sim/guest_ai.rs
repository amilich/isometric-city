//! Guest AI and behavior

use crate::game::state::GameState;
use crate::game::guest::{Guest, GuestState, Direction, TargetKind};
use crate::game::building::BuildingType;
use super::pathfinding::find_path_to_building;

const ENTRY_FEE: i32 = 20;
const RIDE_FEE: i32 = 15;
const FOOD_FEE: i32 = 12;
const SHOP_FEE: i32 = 10;

/// Update all guests
pub fn update_guests(state: &mut GameState) {
    let delta_time = 1.0; // 1 game minute per tick
    let grid_size = state.grid_size;
    
    // Clone guest IDs to avoid borrow issues
    let guest_ids: Vec<u32> = state.guests.iter().map(|g| g.id).collect();
    
    for id in guest_ids {
        if let Some(idx) = state.guests.iter().position(|g| g.id == id) {
            let mut guest = state.guests.remove(idx);
            update_guest(&mut guest, state, delta_time, grid_size);
            state.guests.push(guest);
        }
    }
    
    // Update park rating
    state.update_park_rating();
}

/// Update a single guest
fn update_guest(guest: &mut Guest, state: &mut GameState, delta_time: f32, grid_size: usize) {
    let previous_state = guest.state;
    
    // Update time in park
    guest.time_in_park += delta_time;
    
    // Update needs
    guest.hunger = (guest.hunger + delta_time * 0.01).min(100.0);
    guest.thirst = (guest.thirst + delta_time * 0.015).min(100.0);
    guest.energy = (guest.energy - delta_time * 0.005).max(0.0);
    
    // Update happiness based on needs
    let mut happiness_change = 0.0;
    if guest.hunger > 70.0 { happiness_change -= 0.1; }
    if guest.thirst > 70.0 { happiness_change -= 0.15; }
    if guest.nausea > 50.0 { happiness_change -= 0.1; }
    
    guest.happiness = (guest.happiness + happiness_change * delta_time).clamp(0.0, 100.0);
    guest.nausea = (guest.nausea - delta_time * 0.02).max(0.0);
    guest.decision_cooldown = (guest.decision_cooldown - delta_time).max(0.0);
    
    // Handle different states
    match guest.state {
        GuestState::Queuing | GuestState::Riding => {
            guest.queue_timer -= delta_time;
            if guest.queue_timer <= 0.0 {
                if guest.state == GuestState::Queuing {
                    guest.state = GuestState::Riding;
                    guest.queue_timer = 10.0 + state.random() as f32 * 20.0;
                    guest.happiness = (guest.happiness + 8.0).min(100.0);
                } else {
                    guest.state = GuestState::Walking;
                    guest.queue_ride_id = None;
                    guest.target_building_id = None;
                    guest.target_building_kind = None;
                    guest.nausea = (guest.nausea + 5.0 + state.random() as f32 * 5.0).min(100.0);
                }
            }
            guest.last_state = previous_state;
            return;
        }
        
        GuestState::Eating | GuestState::Shopping => {
            guest.queue_timer -= delta_time;
            if guest.queue_timer <= 0.0 {
                if guest.state == GuestState::Eating {
                    guest.hunger = (guest.hunger - 60.0).max(0.0);
                    guest.thirst = (guest.thirst - 40.0).max(0.0);
                    guest.happiness = (guest.happiness + 6.0).min(100.0);
                } else {
                    guest.happiness = (guest.happiness + 4.0).min(100.0);
                }
                guest.state = GuestState::Walking;
                guest.target_building_id = None;
                guest.target_building_kind = None;
            }
            guest.last_state = previous_state;
            return;
        }
        
        _ => {}
    }
    
    // Seek destinations if idle
    if matches!(guest.state, GuestState::Walking | GuestState::Entering) 
        && guest.path.is_empty() 
        && guest.target_building_id.is_none()
        && guest.decision_cooldown <= 0.0
    {
        // Decide what to do
        let roll = state.random();
        let is_hungry = guest.hunger > 50.0 || guest.thirst > 50.0;
        
        let target_kind = if is_hungry {
            if roll < 0.7 { TargetKind::Food } else { TargetKind::Shop }
        } else {
            if roll < 0.4 { TargetKind::Shop }
            else if roll < 0.8 { TargetKind::Ride }
            else { TargetKind::Food }
        };
        
        // Find destination
        if let Some((pos, building_id)) = find_destination(state, (guest.tile_x, guest.tile_y), target_kind) {
            let path = find_path_to_building(&state.grid, (guest.tile_x, guest.tile_y), pos, 200);
            if !path.is_empty() {
                guest.target_building_id = Some(building_id);
                guest.target_building_kind = Some(target_kind);
                guest.state = GuestState::Walking;
                assign_path(guest, path);
            }
        }
        
        guest.decision_cooldown = 60.0 + state.random() as f32 * 90.0;
    }
    
    // Movement
    if matches!(guest.state, GuestState::Walking | GuestState::Entering) {
        let speed = 0.02;
        guest.progress += speed;
        
        if guest.progress >= 1.0 {
            // Reached target tile
            guest.tile_x = guest.target_x;
            guest.tile_y = guest.target_y;
            guest.progress = 0.0;
            
            // Get next waypoint
            if !guest.path.is_empty() && guest.path_index < guest.path.len() {
                let (nx, ny) = guest.path[guest.path_index];
                guest.target_x = nx;
                guest.target_y = ny;
                guest.path_index += 1;
                
                // Update direction
                let dx = nx - guest.tile_x;
                let dy = ny - guest.tile_y;
                guest.direction = if dx > 0 { Direction::South }
                    else if dx < 0 { Direction::North }
                    else if dy > 0 { Direction::West }
                    else { Direction::East };
            } else {
                // Path complete
                if let Some(target_kind) = guest.target_building_kind {
                    let fee = match target_kind {
                        TargetKind::Ride => RIDE_FEE,
                        TargetKind::Food => FOOD_FEE,
                        TargetKind::Shop => SHOP_FEE,
                    };

                    if guest.cash >= fee {
                        guest.cash -= fee;
                        guest.total_spent += fee;
                        state.cash += fee as i64;

                        match target_kind {
                            TargetKind::Ride => {
                                guest.state = GuestState::Queuing;
                                guest.queue_timer = 30.0 + state.random() as f32 * 60.0;
                            }
                            TargetKind::Food => {
                                guest.state = GuestState::Eating;
                                guest.queue_timer = 8.0 + state.random() as f32 * 12.0;
                            }
                            TargetKind::Shop => {
                                guest.state = GuestState::Shopping;
                                guest.queue_timer = 6.0 + state.random() as f32 * 10.0;
                            }
                        }
                        guest.path.clear();
                        guest.path_index = 0;
                    } else {
                        guest.target_building_id = None;
                        guest.target_building_kind = None;
                        guest.state = GuestState::Walking;
                        guest.decision_cooldown = 30.0;
                        guest.path.clear();
                        guest.path_index = 0;
                    }
                } else {
                    // Wander
                    guest.state = GuestState::Walking;
                    guest.decision_cooldown = 0.0;
                    guest.path.clear();
                    guest.path_index = 0;
                    
                    // Pick random adjacent walkable tile
                    let directions = [(1, 0), (-1, 0), (0, 1), (0, -1)];
                    let mut valid_dirs = Vec::new();
                    
                    for (dx, dy) in &directions {
                        let nx = guest.tile_x + dx;
                        let ny = guest.tile_y + dy;
                        
                        if nx >= 0 && ny >= 0 && (nx as usize) < grid_size && (ny as usize) < grid_size {
                            let tile = &state.grid[ny as usize][nx as usize];
                            if tile.is_walkable() {
                                valid_dirs.push((*dx, *dy));
                            }
                        }
                    }
                    
                    if !valid_dirs.is_empty() {
                        let idx = (state.random() * valid_dirs.len() as f64) as usize % valid_dirs.len();
                        let (dx, dy) = valid_dirs[idx];
                        guest.target_x = guest.tile_x + dx;
                        guest.target_y = guest.tile_y + dy;
                    }
                }
            }
        }
    }
    
    guest.last_state = previous_state;
}

/// Find a destination of the given type
fn find_destination(
    state: &GameState,
    start: (i32, i32),
    target_kind: TargetKind,
) -> Option<((i32, i32), String)> {
    let predicate = |building_type: &BuildingType| -> bool {
        match target_kind {
            TargetKind::Food => building_type.is_food(),
            TargetKind::Shop => building_type.is_shop(),
            TargetKind::Ride => building_type.is_ride(),
        }
    };
    
    // Find all matching buildings
    let mut candidates = Vec::new();
    
    for y in 0..state.grid_size {
        for x in 0..state.grid_size {
            if let Some(ref building) = state.grid[y][x].building {
                if predicate(&building.building_type) {
                    let id = format!("{},{}", x, y);
                    candidates.push(((x as i32, y as i32), id));
                }
            }
        }
    }
    
    if candidates.is_empty() {
        return None;
    }
    
    // Pick random one (could optimize to pick nearest)
    let mut rng_state = (start.0 as u64).wrapping_mul(7919) + (start.1 as u64).wrapping_mul(6271);
    rng_state ^= rng_state << 13;
    rng_state ^= rng_state >> 7;
    let idx = (rng_state as usize) % candidates.len();
    
    Some(candidates[idx].clone())
}

/// Assign path to guest
fn assign_path(guest: &mut Guest, path: Vec<(i32, i32)>) {
    guest.path = path;
    guest.path_index = 0;
    
    if !guest.path.is_empty() {
        // Skip first point if it's current position
        if guest.path[0] == (guest.tile_x, guest.tile_y) {
            guest.path_index = 1;
        }
        
        if guest.path_index < guest.path.len() {
            let (nx, ny) = guest.path[guest.path_index];
            guest.target_x = nx;
            guest.target_y = ny;
            guest.path_index += 1;
        }
    }
}

/// Spawn new guests at entrances
pub fn spawn_guests(state: &mut GameState) {
    // Don't spawn at night
    if state.hour < 9 || state.hour > 21 {
        return;
    }
    
    // Cap maximum guests
    let max_guests = 500;
    if state.guests.len() >= max_guests {
        return;
    }
    
    // Spawn rate based on rating and time
    let base_rate = 0.02;
    let rating_bonus = state.park_rating as f64 / 1000.0 * 0.03;
    let peak_bonus = if state.hour >= 11 && state.hour <= 15 { 0.02 } else { 0.0 };
    
    let spawn_chance = base_rate + rating_bonus + peak_bonus;
    
    if state.random() < spawn_chance {
        let entrances = state.find_entrance_tiles();
        
        if !entrances.is_empty() {
            let idx = (state.random() * entrances.len() as f64) as usize % entrances.len();
            let (ex, ey) = entrances[idx];
            
            let id = state.next_guest_id();
            let grid_size = state.grid_size;
            
            // Create RNG closure
            let mut rng = || state.random();
            let guest = Guest::new(id, ex, ey, grid_size, &mut rng);
            
            if guest.cash >= ENTRY_FEE {
                let mut guest = guest;
                guest.cash -= ENTRY_FEE;
                guest.total_spent += ENTRY_FEE;
                state.cash += ENTRY_FEE as i64;
                state.guests.push(guest);
            }
        }
    }
}
