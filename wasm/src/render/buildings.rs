//! Building rendering

use wasm_bindgen::prelude::*;
use crate::game::state::GameState;
use crate::game::building::BuildingType;
use super::canvas::Canvas;
use super::isometric::tile_center;
use super::sprites::SpriteManager;

/// Render all buildings
pub fn render_buildings(
    canvas: &Canvas,
    state: &GameState,
    offset_x: f64,
    offset_y: f64,
    _zoom: f64,
    sprites: &SpriteManager,
) -> Result<(), JsValue> {
    let grid_size = state.grid_size;
    
    // Render in isometric order (back to front)
    for sum in 0..((grid_size * 2) as i32) {
        for x in 0..grid_size {
            let y = sum as usize - x;
            if y >= grid_size {
                continue;
            }
            
            let tile = &state.grid[y][x];
            
            if let Some(ref building) = tile.building {
                if building.building_type == BuildingType::Empty {
                    continue;
                }
                
                let (cx, cy) = tile_center(x as i32, y as i32, offset_x, offset_y);
                
                // Try to draw sprite
                if let Some(sheet_id) = building.building_type.sprite_sheet_id() {
                    let sprite_name = building.building_type.sprite_name();
                    sprites.draw_sprite(canvas, sheet_id, sprite_name, cx, cy)?;
                } else {
                    // Fallback: draw placeholder
                    draw_placeholder_building(canvas, cx, cy, &building.building_type);
                }
            }
        }
    }
    
    Ok(())
}

/// Draw a placeholder building when sprite not available
fn draw_placeholder_building(canvas: &Canvas, x: f64, y: f64, building_type: &BuildingType) {
    let (color, height) = get_placeholder_style(building_type);
    
    // Draw isometric box
    let w = 24.0;
    let h = 16.0;
    let d = height;
    
    // Top face
    canvas.set_fill_color(color);
    canvas.begin_path();
    canvas.move_to(x, y - d);
    canvas.line_to(x + w / 2.0, y - d + h / 2.0);
    canvas.line_to(x, y - d + h);
    canvas.line_to(x - w / 2.0, y - d + h / 2.0);
    canvas.close_path();
    canvas.fill();
    
    // Left face
    let left_color = darken_color(color);
    canvas.set_fill_color(&left_color);
    canvas.begin_path();
    canvas.move_to(x - w / 2.0, y - d + h / 2.0);
    canvas.line_to(x, y - d + h);
    canvas.line_to(x, y + h);
    canvas.line_to(x - w / 2.0, y + h / 2.0);
    canvas.close_path();
    canvas.fill();
    
    // Right face
    let right_color = lighten_color(color);
    canvas.set_fill_color(&right_color);
    canvas.begin_path();
    canvas.move_to(x + w / 2.0, y - d + h / 2.0);
    canvas.line_to(x, y - d + h);
    canvas.line_to(x, y + h);
    canvas.line_to(x + w / 2.0, y + h / 2.0);
    canvas.close_path();
    canvas.fill();
}

/// Get placeholder color and height for building type
fn get_placeholder_style(building_type: &BuildingType) -> (&str, f64) {
    if building_type.is_food() {
        ("#f97316", 15.0) // Orange for food
    } else if building_type.is_shop() {
        ("#8b5cf6", 18.0) // Purple for shops
    } else if building_type.is_ride() {
        ("#ef4444", 25.0) // Red for rides
    } else {
        ("#22c55e", 12.0) // Green for trees/scenery
    }
}

/// Darken a hex color
fn darken_color(color: &str) -> String {
    // Simple darkening - just return a darker shade
    match color {
        "#f97316" => "#c2410c".to_string(),
        "#8b5cf6" => "#6d28d9".to_string(),
        "#ef4444" => "#b91c1c".to_string(),
        "#22c55e" => "#15803d".to_string(),
        _ => "#333333".to_string(),
    }
}

/// Lighten a hex color
fn lighten_color(color: &str) -> String {
    match color {
        "#f97316" => "#fdba74".to_string(),
        "#8b5cf6" => "#c4b5fd".to_string(),
        "#ef4444" => "#fca5a5".to_string(),
        "#22c55e" => "#86efac".to_string(),
        _ => "#666666".to_string(),
    }
}
