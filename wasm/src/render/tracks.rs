//! Coaster track rendering

use wasm_bindgen::prelude::*;
use crate::game::state::GameState;
use crate::game::coaster::{TrackPiece, TrackPieceType, TrackDirection, StrutStyle, Coaster, CoasterType};
use super::canvas::Canvas;
use super::isometric::{tile_center, TILE_WIDTH, TILE_HEIGHT, HEIGHT_UNIT};
use super::sprites::SpriteManager;

const TRACK_WIDTH: f64 = 5.0;
const RAIL_WIDTH: f64 = 2.0;
const TIE_LENGTH: f64 = 8.0;
const TIE_SPACING: f64 = 8.0;
const TIE_COLOR_METAL: &str = "#2d3748";
const TIE_COLOR_WOOD: &str = "#654321";

fn track_direction_vector(direction: &TrackDirection) -> (f64, f64) {
    let (base_x, base_y): (f64, f64) = match direction {
        TrackDirection::North | TrackDirection::South => (1.0, 0.6),
        TrackDirection::East | TrackDirection::West => (-1.0, 0.6),
    };
    let len = (base_x * base_x + base_y * base_y).sqrt();
    (base_x / len, base_y / len)
}

fn track_length() -> f64 {
    let half_w = TILE_WIDTH * 0.25;
    let half_h = TILE_HEIGHT * 0.25;
    (half_w * half_w + half_h * half_h).sqrt() * 2.0
}

/// Render all coaster tracks
pub fn render_tracks(
    canvas: &Canvas,
    state: &GameState,
    offset_x: f64,
    offset_y: f64,
    _zoom: f64,
    sprites: &SpriteManager,
) -> Result<(), JsValue> {
    for coaster in &state.coasters {
        render_coaster_track(canvas, coaster, offset_x, offset_y, sprites)?;
    }
    Ok(())
}

/// Render a single coaster's track
fn render_coaster_track(
    canvas: &Canvas,
    coaster: &Coaster,
    offset_x: f64,
    offset_y: f64,
    sprites: &SpriteManager,
) -> Result<(), JsValue> {
    // First pass: draw supports
    for (i, &(tile_x, tile_y)) in coaster.track_tiles.iter().enumerate() {
        if i >= coaster.track_pieces.len() {
            continue;
        }
        
        let piece = &coaster.track_pieces[i];
        let (cx, cy) = tile_center(tile_x, tile_y, offset_x, offset_y);
        
        let support_height = piece.start_height.max(piece.end_height);
        if support_height > 0 {
            draw_track_supports(canvas, cx, cy, support_height, &piece.strut_style, &coaster.color.supports);
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
            piece,
            &coaster.color.primary,
        )?;

        if piece.piece_type == TrackPieceType::Station {
            let sprite_name = station_sprite_for_type(&coaster.coaster_type);
            sprites.draw_sprite(canvas, "stations", sprite_name, cx, cy - height_offset)?;
        }
    }
    
    Ok(())
}

fn station_sprite_for_type(coaster_type: &CoasterType) -> &'static str {
    match coaster_type {
        CoasterType::WoodenClassic | CoasterType::WoodenTwister => "station_wooden_1",
        CoasterType::SteelInverted | CoasterType::SteelFlying => "station_inverted_1",
        CoasterType::WaterCoaster => "station_water_1",
        CoasterType::MineTrain => "station_mine_1",
        _ => "station_steel_1",
    }
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
    piece: &TrackPiece,
    primary_color: &str,
) -> Result<(), JsValue> {
    let height_delta = (piece.end_height - piece.start_height) as f64 * HEIGHT_UNIT;

    match piece.piece_type {
        TrackPieceType::StraightFlat => {
            draw_straight_track(canvas, x, y, &piece.direction, &piece.strut_style, primary_color)?;
        }
        TrackPieceType::Station => {
            draw_station_track(canvas, x, y, &piece.direction, &piece.strut_style, primary_color)?;
        }
        TrackPieceType::TurnLeftFlat => {
            draw_curved_track(canvas, x, y, &piece.direction, true, primary_color)?;
        }
        TrackPieceType::TurnRightFlat => {
            draw_curved_track(canvas, x, y, &piece.direction, false, primary_color)?;
        }
        TrackPieceType::SlopeUpSmall | TrackPieceType::SlopeUpMedium | TrackPieceType::LiftHill => {
            draw_slope_track(canvas, x, y, &piece.direction, height_delta, primary_color)?;
            if matches!(piece.piece_type, TrackPieceType::LiftHill) {
                draw_chain_lift(canvas, x, y, &piece.direction)?;
            }
        }
        TrackPieceType::SlopeDownSmall | TrackPieceType::SlopeDownMedium => {
            draw_slope_track(canvas, x, y, &piece.direction, height_delta, primary_color)?;
        }
        TrackPieceType::LoopVertical => {
            draw_loop_track(canvas, x, y, primary_color)?;
        }
        TrackPieceType::Brakes => {
            draw_brake_track(canvas, x, y, &piece.direction, &piece.strut_style, primary_color)?;
        }
        TrackPieceType::Corkscrew => {
            draw_corkscrew_track(canvas, x, y, &piece.direction, primary_color)?;
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
    strut_style: &StrutStyle,
    primary_color: &str,
) -> Result<(), JsValue> {
    let rail_width = RAIL_WIDTH;
    let rail_spacing = TRACK_WIDTH;
    let track_length = track_length();
    
    let (dx, dy) = track_direction_vector(direction);
    let perp_x = -dy;
    let perp_y = dx;

    let start_x = x - track_length / 2.0 * dx;
    let start_y = y - track_length / 2.0 * dy;
    let end_x = x + track_length / 2.0 * dx;
    let end_y = y + track_length / 2.0 * dy;
    
    // Draw ties (cross pieces)
    let tie_color = match strut_style {
        StrutStyle::Wood => TIE_COLOR_WOOD,
        StrutStyle::Metal => TIE_COLOR_METAL,
    };
    canvas.set_stroke_color(tie_color);
    canvas.set_line_width(1.5);
    canvas.ctx().set_line_cap("butt");
    let tie_count = (track_length / TIE_SPACING).floor().max(3.0) as i32;
    for i in 0..tie_count {
        let t = (i as f64 + 0.5) / tie_count as f64;
        let tie_x = start_x + (end_x - start_x) * t;
        let tie_y = start_y + (end_y - start_y) * t;
        let half = TIE_LENGTH / 2.0;

        canvas.begin_path();
        canvas.move_to(tie_x - perp_x * half, tie_y - perp_y * half);
        canvas.line_to(tie_x + perp_x * half, tie_y + perp_y * half);
        canvas.stroke();
    }
    
    // Draw rails
    canvas.set_stroke_color(primary_color);
    canvas.set_line_width(rail_width);
    canvas.ctx().set_line_cap("round");
    
    // Left rail
    canvas.begin_path();
    canvas.move_to(start_x - perp_x * rail_spacing / 2.0, start_y - perp_y * rail_spacing / 2.0);
    canvas.line_to(end_x - perp_x * rail_spacing / 2.0, end_y - perp_y * rail_spacing / 2.0);
    canvas.stroke();
    
    // Right rail
    canvas.begin_path();
    canvas.move_to(start_x + perp_x * rail_spacing / 2.0, start_y + perp_y * rail_spacing / 2.0);
    canvas.line_to(end_x + perp_x * rail_spacing / 2.0, end_y + perp_y * rail_spacing / 2.0);
    canvas.stroke();
    
    Ok(())
}

/// Draw station track segment with platform
fn draw_station_track(
    canvas: &Canvas,
    x: f64,
    y: f64,
    direction: &TrackDirection,
    strut_style: &StrutStyle,
    primary_color: &str,
) -> Result<(), JsValue> {
    // Platform base
    let platform_width = TILE_WIDTH * 0.7;
    let platform_height = TILE_HEIGHT * 0.3;

    canvas.set_fill_color("#6b7280");
    canvas.begin_path();
    canvas.move_to(x, y - platform_height / 2.0);
    canvas.line_to(x + platform_width / 2.0, y);
    canvas.line_to(x, y + platform_height / 2.0);
    canvas.line_to(x - platform_width / 2.0, y);
    canvas.close_path();
    canvas.fill();

    // Draw rails on top
    draw_straight_track(canvas, x, y, direction, strut_style, primary_color)
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
    height_delta: f64,
    primary_color: &str,
) -> Result<(), JsValue> {
    let rail_spacing = 8.0;
    let track_length = track_length();
    let height_change = -height_delta;
    
    let (dx, dy) = track_direction_vector(direction);
    let perp_x = -dy;
    let perp_y = dx;

    let start_x = x - track_length / 2.0 * dx;
    let start_y = y - track_length / 2.0 * dy;
    let end_x = x + track_length / 2.0 * dx;
    let end_y = y + track_length / 2.0 * dy + height_change;
    
    canvas.set_stroke_color(primary_color);
    canvas.set_line_width(2.0);
    canvas.ctx().set_line_cap("round");
    
    // Left rail (sloped)
    canvas.begin_path();
    canvas.move_to(start_x - perp_x * rail_spacing / 2.0, start_y - perp_y * rail_spacing / 2.0);
    canvas.line_to(end_x - perp_x * rail_spacing / 2.0, end_y - perp_y * rail_spacing / 2.0);
    canvas.stroke();
    
    // Right rail (sloped)
    canvas.begin_path();
    canvas.move_to(start_x + perp_x * rail_spacing / 2.0, start_y + perp_y * rail_spacing / 2.0);
    canvas.line_to(end_x + perp_x * rail_spacing / 2.0, end_y + perp_y * rail_spacing / 2.0);
    canvas.stroke();
    
    Ok(())
}

/// Draw chain lift details on a slope
fn draw_chain_lift(
    canvas: &Canvas,
    x: f64,
    y: f64,
    direction: &TrackDirection,
) -> Result<(), JsValue> {
    let chain_color = "#9ca3af";
    let track_length = track_length() * 0.9;

    let (dx, dy) = track_direction_vector(direction);
    let start_x = x - track_length / 2.0 * dx;
    let start_y = y - track_length / 2.0 * dy;
    let end_x = x + track_length / 2.0 * dx;
    let end_y = y + track_length / 2.0 * dy;

    canvas.set_stroke_color(chain_color);
    canvas.set_line_width(1.0);
    canvas.ctx().set_line_cap("round");

    let link_count = 6;
    for i in 0..link_count {
        let t = (i as f64 + 0.5) / link_count as f64;
        let link_x = start_x + (end_x - start_x) * t;
        let link_y = start_y + (end_y - start_y) * t;
        canvas.begin_path();
        canvas.arc(link_x, link_y, 1.0, 0.0, std::f64::consts::PI * 2.0)?;
        canvas.stroke();
    }

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

/// Draw brake segment with red markers
fn draw_brake_track(
    canvas: &Canvas,
    x: f64,
    y: f64,
    direction: &TrackDirection,
    strut_style: &StrutStyle,
    primary_color: &str,
) -> Result<(), JsValue> {
    draw_straight_track(canvas, x, y, direction, strut_style, primary_color)?;

    let marker_color = "#b91c1c";
    let track_length = TILE_WIDTH * 0.6;

    let (dx, dy) = match direction {
        TrackDirection::North | TrackDirection::South => (1.0, 0.6),
        TrackDirection::East | TrackDirection::West => (-1.0, 0.6),
    };

    canvas.set_stroke_color(marker_color);
    canvas.set_line_width(2.0);

    for i in 0..3 {
        let t = (i as f64 + 1.0) / 4.0;
        let mark_x = x - track_length / 2.0 * dx + track_length * dx * t;
        let mark_y = y - track_length / 2.0 * dy + track_length * dy * t;
        canvas.begin_path();
        canvas.move_to(mark_x - 4.0, mark_y - 2.0);
        canvas.line_to(mark_x + 4.0, mark_y + 2.0);
        canvas.stroke();
    }

    Ok(())
}

/// Draw a simple corkscrew (S-curve)
fn draw_corkscrew_track(
    canvas: &Canvas,
    x: f64,
    y: f64,
    direction: &TrackDirection,
    color: &str,
) -> Result<(), JsValue> {
    let radius = TILE_WIDTH * 0.25;
    let offset = TILE_WIDTH * 0.15;

    canvas.set_stroke_color(color);
    canvas.set_line_width(3.0);

    let (sign_x, sign_y) = match direction {
        TrackDirection::North | TrackDirection::South => (1.0, 1.0),
        TrackDirection::East | TrackDirection::West => (-1.0, 1.0),
    };

    canvas.begin_path();
    canvas.arc(x - offset * sign_x, y - offset * sign_y, radius, std::f64::consts::PI, std::f64::consts::PI * 2.0)?;
    canvas.stroke();

    canvas.begin_path();
    canvas.arc(x + offset * sign_x, y + offset * sign_y, radius, 0.0, std::f64::consts::PI)?;
    canvas.stroke();

    Ok(())
}

/// Render all trains on coasters
pub fn render_trains(
    canvas: &Canvas,
    state: &GameState,
    offset_x: f64,
    offset_y: f64,
    _zoom: f64,
    _tick: u32,
) -> Result<(), JsValue> {
    for coaster in &state.coasters {
        if !coaster.operating || coaster.track_pieces.is_empty() {
            continue;
        }
        
        render_coaster_trains(canvas, coaster, offset_x, offset_y)?;
    }
    Ok(())
}

/// Render trains for a single coaster
fn render_coaster_trains(
    canvas: &Canvas,
    coaster: &Coaster,
    offset_x: f64,
    offset_y: f64,
) -> Result<(), JsValue> {
    let track_len = coaster.track_pieces.len() as f32;
    if track_len < 1.0 {
        return Ok(());
    }
    
    for train in &coaster.trains {
        for (car_idx, car) in train.cars.iter().enumerate().rev() {
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
