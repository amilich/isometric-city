//! Coaster track rendering

use wasm_bindgen::prelude::*;
use crate::game::state::GameState;
use crate::game::coaster::{TrackPieceType, TrackDirection, StrutStyle, Coaster, TrainState};
use super::canvas::Canvas;
use super::isometric::{grid_to_screen_offset, tile_center, TILE_WIDTH, TILE_HEIGHT, HEIGHT_UNIT};

/// Render all coaster tracks
pub fn render_tracks(
    canvas: &Canvas,
    state: &GameState,
    offset_x: f64,
    offset_y: f64,
    zoom: f64,
) -> Result<(), JsValue> {
    for coaster in &state.coasters {
        render_coaster_track(canvas, coaster, offset_x, offset_y, zoom)?;
    }
    Ok(())
}

/// Render a single coaster's track
fn render_coaster_track(
    canvas: &Canvas,
    coaster: &Coaster,
    offset_x: f64,
    offset_y: f64,
    zoom: f64,
) -> Result<(), JsValue> {
    // First pass: draw supports
    for (i, &(tile_x, tile_y)) in coaster.track_tiles.iter().enumerate() {
        if i >= coaster.track_pieces.len() {
            continue;
        }
        
        let piece = &coaster.track_pieces[i];
        let (cx, cy) = tile_center(tile_x, tile_y, offset_x, offset_y);
        
        if piece.start_height > 0 {
            draw_track_supports(canvas, cx, cy, piece.start_height, &piece.strut_style, &coaster.color.supports);
        }
    }
    
    // Second pass: draw track pieces
    for (i, &(tile_x, tile_y)) in coaster.track_tiles.iter().enumerate() {
        if i >= coaster.track_pieces.len() {
            continue;
        }
        
        let piece = &coaster.track_pieces[i];
        let (cx, cy) = tile_center(tile_x, tile_y, offset_x, offset_y);
        let height_offset = piece.start_height as f64 * HEIGHT_UNIT;
        
        draw_track_piece(
            canvas,
            cx,
            cy - height_offset,
            &piece.piece_type,
            &piece.direction,
            &coaster.color.primary,
            &coaster.color.secondary,
        )?;
    }
    
    Ok(())
}

/// Draw track supports/struts
fn draw_track_supports(
    canvas: &Canvas,
    x: f64,
    y: f64,
    height: i32,
    style: &StrutStyle,
    color: &str,
) {
    let support_height = height as f64 * HEIGHT_UNIT;
    let support_width = 3.0;
    
    match style {
        StrutStyle::Wood => {
            // Wooden supports: dense cross-bracing
            canvas.set_fill_color("#8b4513"); // Brown
            canvas.set_stroke_color("#5c3010");
            canvas.set_line_width(2.0);
            
            // Main vertical posts
            canvas.fill_rect(x - 8.0, y - support_height, support_width, support_height);
            canvas.fill_rect(x + 5.0, y - support_height, support_width, support_height);
            
            // Cross braces
            let brace_count = (height / 2).max(1);
            for i in 0..brace_count {
                let brace_y = y - (i as f64 + 0.5) * HEIGHT_UNIT * 2.0;
                canvas.begin_path();
                canvas.move_to(x - 8.0, brace_y);
                canvas.line_to(x + 8.0, brace_y - HEIGHT_UNIT);
                canvas.stroke();
                
                canvas.begin_path();
                canvas.move_to(x + 8.0, brace_y);
                canvas.line_to(x - 8.0, brace_y - HEIGHT_UNIT);
                canvas.stroke();
            }
        }
        StrutStyle::Metal => {
            // Metal supports: clean industrial
            canvas.set_fill_color(color);
            canvas.set_stroke_color("#374151");
            canvas.set_line_width(1.0);
            
            // Single central column
            let col_width = 4.0;
            canvas.fill_rect(x - col_width / 2.0, y - support_height, col_width, support_height);
            
            // Top platform
            canvas.fill_rect(x - 10.0, y - support_height - 2.0, 20.0, 3.0);
        }
    }
}

/// Draw a track piece
fn draw_track_piece(
    canvas: &Canvas,
    x: f64,
    y: f64,
    piece_type: &TrackPieceType,
    direction: &TrackDirection,
    primary_color: &str,
    secondary_color: &str,
) -> Result<(), JsValue> {
    match piece_type {
        TrackPieceType::StraightFlat | TrackPieceType::Station => {
            draw_straight_track(canvas, x, y, direction, primary_color, secondary_color)?;
        }
        TrackPieceType::TurnLeftFlat => {
            draw_curved_track(canvas, x, y, direction, true, primary_color)?;
        }
        TrackPieceType::TurnRightFlat => {
            draw_curved_track(canvas, x, y, direction, false, primary_color)?;
        }
        TrackPieceType::SlopeUpSmall | TrackPieceType::SlopeUpMedium | TrackPieceType::LiftHill => {
            draw_slope_track(canvas, x, y, direction, true, primary_color, secondary_color)?;
        }
        TrackPieceType::SlopeDownSmall | TrackPieceType::SlopeDownMedium => {
            draw_slope_track(canvas, x, y, direction, false, primary_color, secondary_color)?;
        }
        TrackPieceType::LoopVertical => {
            draw_loop_track(canvas, x, y, primary_color)?;
        }
        _ => {
            // Default: draw straight
            draw_straight_track(canvas, x, y, direction, primary_color, secondary_color)?;
        }
    }
    
    Ok(())
}

/// Draw straight track segment
fn draw_straight_track(
    canvas: &Canvas,
    x: f64,
    y: f64,
    direction: &TrackDirection,
    primary_color: &str,
    secondary_color: &str,
) -> Result<(), JsValue> {
    let rail_width = 2.0;
    let rail_spacing = 8.0;
    let track_length = TILE_WIDTH * 0.8;
    
    // Calculate direction vectors
    let (dx, dy) = match direction {
        TrackDirection::North | TrackDirection::South => (1.0, 0.6),
        TrackDirection::East | TrackDirection::West => (-1.0, 0.6),
    };
    
    // Draw ties (cross pieces)
    canvas.set_fill_color(secondary_color);
    let tie_count = 4;
    for i in 0..tie_count {
        let t = (i as f64 + 0.5) / tie_count as f64;
        let tie_x = x - track_length / 2.0 * dx + track_length * dx * t;
        let tie_y = y - track_length / 2.0 * dy + track_length * dy * t;
        
        canvas.fill_rect(tie_x - 6.0, tie_y - 1.5, 12.0, 3.0);
    }
    
    // Draw rails
    canvas.set_stroke_color(primary_color);
    canvas.set_line_width(rail_width);
    
    // Left rail
    canvas.begin_path();
    canvas.move_to(x - track_length / 2.0 * dx - rail_spacing / 2.0, y - track_length / 2.0 * dy);
    canvas.line_to(x + track_length / 2.0 * dx - rail_spacing / 2.0, y + track_length / 2.0 * dy);
    canvas.stroke();
    
    // Right rail
    canvas.begin_path();
    canvas.move_to(x - track_length / 2.0 * dx + rail_spacing / 2.0, y - track_length / 2.0 * dy);
    canvas.line_to(x + track_length / 2.0 * dx + rail_spacing / 2.0, y + track_length / 2.0 * dy);
    canvas.stroke();
    
    Ok(())
}

/// Draw curved track segment
fn draw_curved_track(
    canvas: &Canvas,
    x: f64,
    y: f64,
    direction: &TrackDirection,
    turn_left: bool,
    color: &str,
) -> Result<(), JsValue> {
    let radius = TILE_WIDTH * 0.4;
    
    canvas.set_stroke_color(color);
    canvas.set_line_width(3.0);
    
    // Draw curved rail using arc
    let start_angle: f64;
    let end_angle: f64;
    
    match (direction, turn_left) {
        (TrackDirection::North, true) | (TrackDirection::West, false) => {
            start_angle = 0.0;
            end_angle = std::f64::consts::FRAC_PI_2;
        }
        (TrackDirection::East, true) | (TrackDirection::North, false) => {
            start_angle = std::f64::consts::FRAC_PI_2;
            end_angle = std::f64::consts::PI;
        }
        (TrackDirection::South, true) | (TrackDirection::East, false) => {
            start_angle = std::f64::consts::PI;
            end_angle = std::f64::consts::PI * 1.5;
        }
        _ => {
            start_angle = std::f64::consts::PI * 1.5;
            end_angle = std::f64::consts::PI * 2.0;
        }
    }
    
    // Inner rail
    canvas.begin_path();
    canvas.arc(x, y, radius - 4.0, start_angle, end_angle)?;
    canvas.stroke();
    
    // Outer rail
    canvas.begin_path();
    canvas.arc(x, y, radius + 4.0, start_angle, end_angle)?;
    canvas.stroke();
    
    Ok(())
}

/// Draw slope track segment
fn draw_slope_track(
    canvas: &Canvas,
    x: f64,
    y: f64,
    direction: &TrackDirection,
    going_up: bool,
    primary_color: &str,
    secondary_color: &str,
) -> Result<(), JsValue> {
    let rail_spacing = 8.0;
    let track_length = TILE_WIDTH * 0.8;
    let height_change = if going_up { -HEIGHT_UNIT } else { HEIGHT_UNIT };
    
    let (dx, dy) = match direction {
        TrackDirection::North | TrackDirection::South => (1.0, 0.6),
        TrackDirection::East | TrackDirection::West => (-1.0, 0.6),
    };
    
    canvas.set_stroke_color(primary_color);
    canvas.set_line_width(2.0);
    
    // Left rail (sloped)
    canvas.begin_path();
    canvas.move_to(x - track_length / 2.0 * dx - rail_spacing / 2.0, y - track_length / 2.0 * dy);
    canvas.line_to(x + track_length / 2.0 * dx - rail_spacing / 2.0, y + track_length / 2.0 * dy + height_change);
    canvas.stroke();
    
    // Right rail (sloped)
    canvas.begin_path();
    canvas.move_to(x - track_length / 2.0 * dx + rail_spacing / 2.0, y - track_length / 2.0 * dy);
    canvas.line_to(x + track_length / 2.0 * dx + rail_spacing / 2.0, y + track_length / 2.0 * dy + height_change);
    canvas.stroke();
    
    Ok(())
}

/// Draw vertical loop
fn draw_loop_track(
    canvas: &Canvas,
    x: f64,
    y: f64,
    color: &str,
) -> Result<(), JsValue> {
    let radius = 20.0;
    
    canvas.set_stroke_color(color);
    canvas.set_line_width(3.0);
    
    // Draw full circle (loop)
    canvas.begin_path();
    canvas.arc(x, y - radius, radius, 0.0, std::f64::consts::PI * 2.0)?;
    canvas.stroke();
    
    // Inner rail
    canvas.begin_path();
    canvas.arc(x, y - radius, radius - 4.0, 0.0, std::f64::consts::PI * 2.0)?;
    canvas.stroke();
    
    Ok(())
}

/// Render all trains on coasters
pub fn render_trains(
    canvas: &Canvas,
    state: &GameState,
    offset_x: f64,
    offset_y: f64,
    zoom: f64,
    tick: u32,
) -> Result<(), JsValue> {
    for coaster in &state.coasters {
        if !coaster.operating || coaster.track_pieces.is_empty() {
            continue;
        }
        
        render_coaster_trains(canvas, coaster, offset_x, offset_y, zoom, tick)?;
    }
    Ok(())
}

/// Render trains for a single coaster
fn render_coaster_trains(
    canvas: &Canvas,
    coaster: &Coaster,
    offset_x: f64,
    offset_y: f64,
    zoom: f64,
    tick: u32,
) -> Result<(), JsValue> {
    let track_len = coaster.track_pieces.len() as f32;
    if track_len < 1.0 {
        return Ok(());
    }
    
    for train in &coaster.trains {
        for (car_idx, car) in train.cars.iter().enumerate() {
            // Calculate position on track
            let progress = car.track_progress % track_len;
            let track_idx = progress.floor() as usize;
            let local_progress = progress.fract() as f64;
            
            if track_idx >= coaster.track_tiles.len() {
                continue;
            }
            
            let (tile_x, tile_y) = coaster.track_tiles[track_idx];
            let next_idx = (track_idx + 1) % coaster.track_tiles.len();
            let (next_x, next_y) = coaster.track_tiles[next_idx];
            
            // Interpolate position
            let (sx1, sy1) = tile_center(tile_x, tile_y, offset_x, offset_y);
            let (sx2, sy2) = tile_center(next_x, next_y, offset_x, offset_y);
            
            let car_x = sx1 + (sx2 - sx1) * local_progress;
            let car_y = sy1 + (sy2 - sy1) * local_progress;
            
            // Adjust for track height
            let height_offset = if track_idx < coaster.track_pieces.len() {
                coaster.track_pieces[track_idx].start_height as f64 * HEIGHT_UNIT
            } else {
                0.0
            };
            
            draw_train_car(canvas, car_x, car_y - height_offset, car_idx == 0, &coaster.color.primary)?;
        }
    }
    
    Ok(())
}

/// Draw a single train car
fn draw_train_car(
    canvas: &Canvas,
    x: f64,
    y: f64,
    is_front: bool,
    color: &str,
) -> Result<(), JsValue> {
    let car_w = 10.0;
    let car_h = 6.0;
    let car_d = 5.0;
    
    // Car body (simple isometric box)
    // Top
    canvas.set_fill_color(color);
    canvas.begin_path();
    canvas.move_to(x, y - car_d);
    canvas.line_to(x + car_w / 2.0, y - car_d + car_h / 4.0);
    canvas.line_to(x, y - car_d + car_h / 2.0);
    canvas.line_to(x - car_w / 2.0, y - car_d + car_h / 4.0);
    canvas.close_path();
    canvas.fill();
    
    // Left side
    canvas.set_fill_color("#1e293b");
    canvas.begin_path();
    canvas.move_to(x - car_w / 2.0, y - car_d + car_h / 4.0);
    canvas.line_to(x, y - car_d + car_h / 2.0);
    canvas.line_to(x, y + car_h / 2.0);
    canvas.line_to(x - car_w / 2.0, y + car_h / 4.0);
    canvas.close_path();
    canvas.fill();
    
    // Right side
    canvas.set_fill_color("#374151");
    canvas.begin_path();
    canvas.move_to(x + car_w / 2.0, y - car_d + car_h / 4.0);
    canvas.line_to(x, y - car_d + car_h / 2.0);
    canvas.line_to(x, y + car_h / 2.0);
    canvas.line_to(x + car_w / 2.0, y + car_h / 4.0);
    canvas.close_path();
    canvas.fill();
    
    // Front car gets a windshield
    if is_front {
        canvas.set_fill_color("#94a3b8");
        canvas.begin_path();
        canvas.move_to(x, y - car_d + 1.0);
        canvas.line_to(x + 3.0, y - car_d + 2.5);
        canvas.line_to(x, y - car_d + 4.0);
        canvas.line_to(x - 3.0, y - car_d + 2.5);
        canvas.close_path();
        canvas.fill();
    }
    
    // Wheels
    canvas.set_fill_color("#1f2937");
    canvas.begin_path();
    let _ = canvas.arc(x - 3.0, y + 1.0, 1.5, 0.0, std::f64::consts::PI * 2.0);
    canvas.fill();
    canvas.begin_path();
    let _ = canvas.arc(x + 3.0, y + 1.0, 1.5, 0.0, std::f64::consts::PI * 2.0);
    canvas.fill();
    
    Ok(())
}
