//! Guest rendering

use wasm_bindgen::prelude::*;
use crate::game::state::GameState;
use crate::game::guest::{Guest, GuestState};
use super::canvas::Canvas;
use super::isometric::{grid_to_screen_offset, TILE_WIDTH, TILE_HEIGHT};

/// Render all guests
pub fn render_guests(
    canvas: &Canvas,
    state: &GameState,
    offset_x: f64,
    offset_y: f64,
    _zoom: f64,
    tick: u32,
) -> Result<(), JsValue> {
    // Sort guests by depth for proper rendering
    let mut sorted_guests: Vec<&Guest> = state.guests.iter().collect();
    sorted_guests.sort_by_key(|g| g.tile_x + g.tile_y);
    
    for guest in sorted_guests {
        render_guest(canvas, guest, offset_x, offset_y, tick)?;
    }
    
    Ok(())
}

/// Render a single guest
fn render_guest(
    canvas: &Canvas,
    guest: &Guest,
    offset_x: f64,
    offset_y: f64,
    tick: u32,
) -> Result<(), JsValue> {
    // Calculate interpolated position
    let (start_x, start_y) = grid_to_screen_offset(guest.tile_x, guest.tile_y, offset_x, offset_y);
    let (end_x, end_y) = grid_to_screen_offset(guest.target_x, guest.target_y, offset_x, offset_y);
    
    let progress = guest.progress as f64;
    let mut x = start_x + (end_x - start_x) * progress + TILE_WIDTH / 2.0;
    let mut y = start_y + (end_y - start_y) * progress + TILE_HEIGHT / 2.0;
    
    // For entering guests, offset start position outward
    if guest.state == GuestState::Entering && guest.progress < 0.5 {
        let offset_amount = TILE_WIDTH * 0.6;
        let dx = start_x - end_x;
        let dy = start_y - end_y;
        let dist = (dx * dx + dy * dy).sqrt();
        
        if dist > 0.0 {
            x += (dx / dist) * offset_amount * (0.5 - progress as f64);
            y += (dy / dist) * offset_amount * (0.5 - progress as f64);
        }
    }
    
    // Walking animation
    let walk_cycle = ((tick as f64 * 0.2 + guest.walk_offset as f64) * 2.0).sin();
    let bob_y = walk_cycle.abs() * 0.5;
    
    // Draw shadow
    canvas.set_fill_color("rgba(0, 0, 0, 0.2)");
    canvas.begin_path();
    canvas.ellipse(x, y + 0.5, 1.25, 0.75, 0.0, 0.0, std::f64::consts::PI * 2.0)?;
    canvas.fill();
    
    let guest_y = y - 3.0 - bob_y;
    
    // Draw legs/pants
    canvas.set_fill_color(&guest.colors.pants);
    canvas.fill_rect(x - 0.75, guest_y + 1.5, 0.5, 1.5);
    canvas.fill_rect(x + 0.25, guest_y + 1.5, 0.5, 1.5);
    
    // Draw torso
    canvas.set_fill_color(&guest.colors.shirt);
    canvas.fill_rect(x - 1.0, guest_y - 0.5, 2.0, 2.0);
    
    // Draw head
    canvas.set_fill_color(&guest.colors.skin);
    canvas.begin_path();
    canvas.arc(x, guest_y - 1.5, 1.0, 0.0, std::f64::consts::PI * 2.0)?;
    canvas.fill();
    
    // Draw hat (if has one)
    if guest.has_hat {
        canvas.set_fill_color(&guest.colors.hat);
        canvas.fill_rect(x - 1.25, guest_y - 2.75, 2.5, 0.75);
        canvas.fill_rect(x - 0.75, guest_y - 3.5, 1.5, 0.75);
    }
    
    // Draw animated arms
    let arm_swing = walk_cycle * 0.75;
    canvas.set_fill_color(&guest.colors.shirt);
    canvas.fill_rect(x - 1.5, guest_y + arm_swing, 0.5, 1.25);
    canvas.fill_rect(x + 1.0, guest_y - arm_swing, 0.5, 1.25);
    
    Ok(())
}
