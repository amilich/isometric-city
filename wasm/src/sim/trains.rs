//! Train physics and simulation

use crate::game::state::GameState;
use crate::game::coaster::{TrainState, TrackPieceType};

/// Speed multipliers for different game speeds
const SPEED_BOOSTS: [f32; 4] = [1.0, 1.5, 2.0, 2.5];

/// Update all coaster trains
pub fn update_trains(state: &mut GameState) {
    let speed_boost = SPEED_BOOSTS[state.speed as usize % 4];
    
    for coaster in &mut state.coasters {
        if !coaster.operating || coaster.track_pieces.is_empty() {
            continue;
        }
        
        let track_len = coaster.track_pieces.len() as f32;
        if track_len < 1.0 {
            continue;
        }
        
        // Find station index
        let station_idx = coaster.track_tiles.iter()
            .position(|&(x, y)| x == coaster.station_tile.0 && y == coaster.station_tile.1)
            .unwrap_or(0);
        
        for train in &mut coaster.trains {
            let delta = 1.0; // 1 unit per tick
            let car_spacing = 0.18;
            
            train.state_timer -= delta;
            
            match train.state {
                TrainState::Loading => {
                    if train.state_timer <= 0.0 {
                        train.state = TrainState::Dispatching;
                        train.state_timer = 2.0;
                    }
                    // Keep cars at station
                    for (i, car) in train.cars.iter_mut().enumerate() {
                        car.track_progress = (station_idx as f32 + i as f32 * car_spacing) % track_len;
                        car.velocity = 0.0;
                    }
                }
                
                TrainState::Dispatching => {
                    if train.state_timer <= 0.0 {
                        train.state = TrainState::Running;
                        train.state_timer = 0.0;
                    }
                    
                    let base_velocity = (0.02 + (1.0 - train.state_timer / 2.0) * 0.04) * speed_boost;
                    
                    for car in &mut train.cars {
                        let track_idx = (car.track_progress.floor() as usize) % coaster.track_pieces.len();
                        let piece = &coaster.track_pieces[track_idx];
                        
                        let velocity = if matches!(piece.piece_type, TrackPieceType::LoopVertical) {
                            base_velocity * 0.5
                        } else {
                            base_velocity
                        };
                        
                        car.track_progress = (car.track_progress + velocity * delta) % track_len;
                        car.velocity = velocity;
                    }
                }
                
                TrainState::Running => {
                    let lead_progress = train.cars[0].track_progress % track_len;
                    let distance_to_station = (station_idx as f32 - lead_progress + track_len) % track_len;
                    
                    if distance_to_station < 3.0 && distance_to_station > 0.5 {
                        train.state = TrainState::Braking;
                    }
                    
                    let base_velocity = 0.08 * speed_boost;
                    
                    for car in &mut train.cars {
                        let track_idx = (car.track_progress.floor() as usize) % coaster.track_pieces.len();
                        let piece = &coaster.track_pieces[track_idx];
                        
                        let velocity = if matches!(piece.piece_type, TrackPieceType::LoopVertical) {
                            base_velocity * 0.5
                        } else {
                            base_velocity
                        };
                        
                        car.track_progress = (car.track_progress + velocity * delta) % track_len;
                        car.velocity = velocity;
                    }
                }
                
                TrainState::Braking => {
                    let lead_progress = train.cars[0].track_progress % track_len;
                    let distance_to_station = (station_idx as f32 - lead_progress + track_len) % track_len;
                    
                    if distance_to_station <= 0.5 || distance_to_station > track_len - 1.0 {
                        train.state = TrainState::Loading;
                        train.state_timer = 5.0 + (coaster.id.len() as f32 % 3.0);
                    }
                    
                    let velocity = 0.03 * speed_boost;
                    
                    for car in &mut train.cars {
                        car.track_progress = (car.track_progress + velocity * delta) % track_len;
                        car.velocity = velocity;
                    }
                }
            }
            
            // Maintain car spacing
            for i in 1..train.cars.len() {
                let target = (train.cars[0].track_progress + i as f32 * car_spacing) % track_len;
                train.cars[i].track_progress = target;
            }
        }
    }
}
