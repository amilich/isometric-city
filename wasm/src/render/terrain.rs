//! Terrain rendering

use wasm_bindgen::prelude::*;
use crate::game::state::GameState;
use crate::game::tile::Terrain;
use super::canvas::Canvas;
use super::isometric::{grid_to_screen_offset, TILE_WIDTH, TILE_HEIGHT};
use super::sprites::SpriteManager;

/// Grass tile colors (matching original)
pub const GRASS_TOP: &str = "#4a7c3f";
pub const GRASS_STROKE: &str = "#2d4a26";

/// Water tile colors (fallback)
pub const WATER_BASE: &str = "#0ea5e9";
pub const WATER_STROKE: &str = "#0284c7";

/// Path tile colors
pub const PATH_SURFACE: &str = "#9ca3af";
pub const PATH_EDGE: &str = "#6b7280";

/// Queue line colors
pub const QUEUE_SURFACE: &str = "#a8a29e";
pub const QUEUE_EDGE: &str = "#78716c";

/// Beach colors for water edges
pub const BEACH_FILL: &str = "#d4a574";
pub const BEACH_CURB: &str = "#b8956a";
const BEACH_WIDTH_RATIO: f64 = 0.04;
const BEACH_CURB_WIDTH: f64 = 1.5;
const BEACH_CORNER_FACTOR: f64 = 0.707;

/// Render all terrain tiles
pub fn render_terrain(
    canvas: &Canvas,
    state: &GameState,
    offset_x: f64,
    offset_y: f64,
    zoom: f64,
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
            let (screen_x, screen_y) = grid_to_screen_offset(x as i32, y as i32, offset_x, offset_y);
            
            // Draw base terrain
            match tile.terrain {
                Terrain::Grass => {
                    draw_grass_tile(canvas, screen_x, screen_y, zoom);
                }
                Terrain::Water => {
                    draw_water_tile(canvas, screen_x, screen_y, x as i32, y as i32, state, sprites);

                    if zoom >= 0.4 {
                        let adjacent_land = AdjacentLand {
                            north: x > 0 && state.grid[y][x - 1].terrain != Terrain::Water,
                            east: y > 0 && state.grid[y - 1][x].terrain != Terrain::Water,
                            south: x + 1 < grid_size && state.grid[y][x + 1].terrain != Terrain::Water,
                            west: y + 1 < grid_size && state.grid[y + 1][x].terrain != Terrain::Water,
                        };

                        if adjacent_land.north || adjacent_land.east || adjacent_land.south || adjacent_land.west {
                            draw_beach_on_water(canvas, screen_x, screen_y, adjacent_land);
                        }
                    }
                }
                Terrain::Sand => {
                    draw_sand_tile(canvas, screen_x, screen_y, zoom);
                }
                Terrain::Rock => {
                    draw_rock_tile(canvas, screen_x, screen_y, zoom);
                }
            }
            
            // Draw path overlay
            if tile.path {
                draw_path_tile(canvas, screen_x, screen_y, x as i32, y as i32, state);
            }
            
            // Draw queue overlay
            if tile.queue {
                draw_queue_tile(canvas, screen_x, screen_y);
            }
            
            // Draw entrance gate at edge path tiles
            if tile.path && tile.is_edge(grid_size) {
                draw_entrance_gate(canvas, screen_x, screen_y, x as i32, y as i32, grid_size);
            }
        }
    }
    
    Ok(())
}

/// Draw a grass tile
fn draw_grass_tile(canvas: &Canvas, x: f64, y: f64, zoom: f64) {
    canvas.fill_isometric_tile(x, y, GRASS_TOP);
    
    if zoom >= 0.6 {
        canvas.stroke_isometric_tile(x, y, GRASS_STROKE, 0.5);
    }
}

/// Draw a water tile
fn draw_water_tile(
    canvas: &Canvas,
    x: f64,
    y: f64,
    grid_x: i32,
    grid_y: i32,
    _state: &GameState,
    sprites: &SpriteManager,
) {
    // Check if we have water texture
    if let Some(water_canvas) = &sprites.water_canvas {
        // Save context for clipping
        canvas.save();
        
        // Clip to tile shape
        canvas.draw_isometric_tile(x, y);
        canvas.clip();
        
        // Calculate texture offset for variety
        let seed_x = ((grid_x * 7919 + grid_y * 6271) % 1000) as f64 / 1000.0;
        let seed_y = ((grid_x * 4177 + grid_y * 9311) % 1000) as f64 / 1000.0;
        
        let tile_center_x = x + TILE_WIDTH / 2.0;
        let tile_center_y = y + TILE_HEIGHT / 2.0;
        
        // Draw water texture
        let dest_size = TILE_WIDTH * 1.2;
        let jitter_x = (seed_x - 0.5) * TILE_WIDTH * 0.3;
        let jitter_y = (seed_y - 0.5) * TILE_HEIGHT * 0.3;
        
        canvas.set_alpha(0.9);
        
        // Draw the water texture centered on tile
        let _ = canvas.ctx().draw_image_with_html_canvas_element_and_dw_and_dh(
            water_canvas,
            tile_center_x - dest_size / 2.0 + jitter_x,
            tile_center_y - dest_size / 2.0 + jitter_y,
            dest_size,
            dest_size
        );
        
        canvas.set_alpha(1.0);
        canvas.restore();
    } else {
        // Fallback: solid color
        canvas.fill_isometric_tile(x, y, WATER_BASE);
    }
}

/// Draw a sand tile
fn draw_sand_tile(canvas: &Canvas, x: f64, y: f64, zoom: f64) {
    canvas.fill_isometric_tile(x, y, "#e5c07b");
    if zoom >= 0.6 {
        canvas.stroke_isometric_tile(x, y, "#c9a85c", 0.5);
    }
}

/// Draw a rock tile
fn draw_rock_tile(canvas: &Canvas, x: f64, y: f64, zoom: f64) {
    canvas.fill_isometric_tile(x, y, "#6b7280");
    if zoom >= 0.6 {
        canvas.stroke_isometric_tile(x, y, "#4b5563", 0.5);
    }
}

/// Draw a path tile
fn draw_path_tile(canvas: &Canvas, x: f64, y: f64, grid_x: i32, grid_y: i32, state: &GameState) {
    let w = TILE_WIDTH;
    let h = TILE_HEIGHT;
    
    // Draw path surface with slight inset
    let inset = 4.0;
    canvas.set_fill_color(PATH_SURFACE);
    canvas.begin_path();
    canvas.move_to(x + w / 2.0, y + inset);
    canvas.line_to(x + w - inset, y + h / 2.0);
    canvas.line_to(x + w / 2.0, y + h - inset);
    canvas.line_to(x + inset, y + h / 2.0);
    canvas.close_path();
    canvas.fill();
    
    // Draw edge
    canvas.set_stroke_color(PATH_EDGE);
    canvas.set_line_width(1.0);
    canvas.stroke();
    
    // Check for adjacent paths and draw connections
    let size = state.grid_size as i32;
    let dirs = [(1, 0), (-1, 0), (0, 1), (0, -1)];
    
    for (dx, dy) in dirs {
        let nx = grid_x + dx;
        let ny = grid_y + dy;
        
        if nx >= 0 && ny >= 0 && nx < size && ny < size {
            let neighbor = &state.grid[ny as usize][nx as usize];
            if neighbor.path || neighbor.queue {
                // Draw connection (thicker line toward neighbor)
                canvas.set_stroke_color(PATH_SURFACE);
                canvas.set_line_width(8.0);
                canvas.begin_path();
                canvas.move_to(x + w / 2.0, y + h / 2.0);
                
                let end_x = x + w / 2.0 + (dx - dy) as f64 * (w / 4.0);
                let end_y = y + h / 2.0 + (dx + dy) as f64 * (h / 4.0);
                canvas.line_to(end_x, end_y);
                canvas.stroke();
            }
        }
    }
}

/// Draw a queue tile
fn draw_queue_tile(canvas: &Canvas, x: f64, y: f64) {
    let w = TILE_WIDTH;
    let h = TILE_HEIGHT;
    
    // Draw queue surface (slightly different color from path)
    let inset = 4.0;
    canvas.set_fill_color(QUEUE_SURFACE);
    canvas.begin_path();
    canvas.move_to(x + w / 2.0, y + inset);
    canvas.line_to(x + w - inset, y + h / 2.0);
    canvas.line_to(x + w / 2.0, y + h - inset);
    canvas.line_to(x + inset, y + h / 2.0);
    canvas.close_path();
    canvas.fill();
    
    // Draw edge
    canvas.set_stroke_color(QUEUE_EDGE);
    canvas.set_line_width(1.0);
    canvas.stroke();
    
    // Draw queue posts at corners
    let post_color = "#44403c";
    canvas.set_fill_color(post_color);
    
    // Corner posts
    let post_size = 2.0;
    let _ = canvas.arc(x + w / 2.0, y + 6.0, post_size, 0.0, std::f64::consts::PI * 2.0);
    canvas.fill();
    let _ = canvas.arc(x + w - 6.0, y + h / 2.0, post_size, 0.0, std::f64::consts::PI * 2.0);
    canvas.fill();
}

/// Draw entrance gate at edge tiles
fn draw_entrance_gate(canvas: &Canvas, x: f64, y: f64, grid_x: i32, grid_y: i32, grid_size: usize) {
    let w = TILE_WIDTH;
    let h = TILE_HEIGHT;
    let size = grid_size as i32;
    
    // Determine which edge this is on
    let at_north = grid_x == 0;
    let at_east = grid_y == 0;
    let at_south = grid_x == size - 1;
    let at_west = grid_y == size - 1;
    
    if !at_north && !at_east && !at_south && !at_west {
        return;
    }
    
    // Gate arch colors
    let arch_stone = "#78716c";
    let arch_dark = "#57534e";
    let gate_color = "#b91c1c";
    
    // Draw simple arch
    canvas.set_fill_color(arch_stone);
    
    let arch_width = 20.0;
    let arch_height = 25.0;
    
    // Position based on edge
    let (arch_x, arch_y) = if at_north {
        (x + w / 2.0, y + h / 4.0)
    } else if at_south {
        (x + w / 2.0, y + 3.0 * h / 4.0)
    } else if at_east {
        (x + 3.0 * w / 4.0, y + h / 2.0)
    } else {
        (x + w / 4.0, y + h / 2.0)
    };
    
    // Draw arch posts
    canvas.fill_rect(arch_x - arch_width / 2.0 - 3.0, arch_y - arch_height, 6.0, arch_height);
    canvas.fill_rect(arch_x + arch_width / 2.0 - 3.0, arch_y - arch_height, 6.0, arch_height);
    
    // Draw arch top
    canvas.set_fill_color(arch_dark);
    canvas.fill_rect(arch_x - arch_width / 2.0 - 3.0, arch_y - arch_height - 4.0, arch_width + 6.0, 4.0);
    
    // Draw gate bars
    canvas.set_fill_color(gate_color);
    canvas.set_line_width(2.0);
    for i in 0..3 {
        let bar_x = arch_x - arch_width / 4.0 + i as f64 * arch_width / 4.0;
        canvas.fill_rect(bar_x - 1.0, arch_y - arch_height + 5.0, 2.0, arch_height - 10.0);
    }
}

#[derive(Clone, Copy)]
struct AdjacentLand {
    north: bool,
    east: bool,
    south: bool,
    west: bool,
}

#[derive(Clone, Copy)]
struct Point {
    x: f64,
    y: f64,
}

fn get_diamond_corners(x: f64, y: f64) -> (Point, Point, Point, Point) {
    let top = Point { x: x + TILE_WIDTH / 2.0, y };
    let right = Point { x: x + TILE_WIDTH, y: y + TILE_HEIGHT / 2.0 };
    let bottom = Point { x: x + TILE_WIDTH / 2.0, y: y + TILE_HEIGHT };
    let left = Point { x, y: y + TILE_HEIGHT / 2.0 };
    (top, right, bottom, left)
}

fn get_shortened_inner_endpoint(
    corner: Point,
    other_corner: Point,
    inward_dx: f64,
    inward_dy: f64,
    beach_width: f64,
) -> Point {
    let shorten_dist = beach_width * BEACH_CORNER_FACTOR;

    let edge_dx = corner.x - other_corner.x;
    let edge_dy = corner.y - other_corner.y;
    let edge_len = (edge_dx * edge_dx + edge_dy * edge_dy).sqrt();
    let edge_dir_x = edge_dx / edge_len;
    let edge_dir_y = edge_dy / edge_len;

    let shortened_outer_x = corner.x - edge_dir_x * shorten_dist;
    let shortened_outer_y = corner.y - edge_dir_y * shorten_dist;

    Point {
        x: shortened_outer_x + inward_dx * beach_width,
        y: shortened_outer_y + inward_dy * beach_width,
    }
}

fn draw_beach_edge_on_water(
    canvas: &Canvas,
    start: Point,
    end: Point,
    inward_dx: f64,
    inward_dy: f64,
    beach_width: f64,
    shorten_start: bool,
    shorten_end: bool,
) {
    let shorten_dist = beach_width * BEACH_CORNER_FACTOR;
    let edge_dx = end.x - start.x;
    let edge_dy = end.y - start.y;
    let edge_len = (edge_dx * edge_dx + edge_dy * edge_dy).sqrt();
    let edge_dir_x = edge_dx / edge_len;
    let edge_dir_y = edge_dy / edge_len;

    let mut actual_start = start;
    let mut actual_end = end;

    if shorten_start && edge_len > shorten_dist * 2.0 {
        actual_start = Point {
            x: start.x + edge_dir_x * shorten_dist,
            y: start.y + edge_dir_y * shorten_dist,
        };
    }
    if shorten_end && edge_len > shorten_dist * 2.0 {
        actual_end = Point {
            x: end.x - edge_dir_x * shorten_dist,
            y: end.y - edge_dir_y * shorten_dist,
        };
    }

    canvas.set_fill_color(BEACH_FILL);
    canvas.begin_path();
    canvas.move_to(actual_start.x, actual_start.y);
    canvas.line_to(actual_end.x, actual_end.y);
    canvas.line_to(
        actual_end.x + inward_dx * beach_width,
        actual_end.y + inward_dy * beach_width,
    );
    canvas.line_to(
        actual_start.x + inward_dx * beach_width,
        actual_start.y + inward_dy * beach_width,
    );
    canvas.close_path();
    canvas.fill();

    canvas.set_stroke_color(BEACH_CURB);
    canvas.set_line_width(BEACH_CURB_WIDTH);
    canvas.begin_path();
    canvas.move_to(
        actual_start.x + inward_dx * beach_width,
        actual_start.y + inward_dy * beach_width,
    );
    canvas.line_to(
        actual_end.x + inward_dx * beach_width,
        actual_end.y + inward_dy * beach_width,
    );
    canvas.stroke();
}

fn draw_beach_corner_on_water(
    canvas: &Canvas,
    corner: Point,
    edge1_corner: Point,
    edge1_inward: (f64, f64),
    edge2_corner: Point,
    edge2_inward: (f64, f64),
    beach_width: f64,
) {
    let inner1 = get_shortened_inner_endpoint(
        corner,
        edge1_corner,
        edge1_inward.0,
        edge1_inward.1,
        beach_width,
    );
    let inner2 = get_shortened_inner_endpoint(
        corner,
        edge2_corner,
        edge2_inward.0,
        edge2_inward.1,
        beach_width,
    );

    canvas.set_fill_color(BEACH_FILL);
    canvas.begin_path();
    canvas.move_to(corner.x, corner.y);
    canvas.line_to(inner1.x, inner1.y);
    canvas.line_to(inner2.x, inner2.y);
    canvas.close_path();
    canvas.fill();
}

fn draw_beach_on_water(canvas: &Canvas, x: f64, y: f64, adjacent: AdjacentLand) {
    if !adjacent.north && !adjacent.east && !adjacent.south && !adjacent.west {
        return;
    }

    let beach_width = TILE_WIDTH * BEACH_WIDTH_RATIO * 2.5;
    let (top, right, bottom, left) = get_diamond_corners(x, y);

    let north_inward = (0.707, 0.707);
    let east_inward = (-0.707, 0.707);
    let south_inward = (-0.707, -0.707);
    let west_inward = (0.707, -0.707);

    if adjacent.north {
        draw_beach_edge_on_water(
            canvas,
            left,
            top,
            north_inward.0,
            north_inward.1,
            beach_width,
            adjacent.west,
            adjacent.east,
        );
    }

    if adjacent.east {
        draw_beach_edge_on_water(
            canvas,
            top,
            right,
            east_inward.0,
            east_inward.1,
            beach_width,
            adjacent.north,
            adjacent.south,
        );
    }

    if adjacent.south {
        draw_beach_edge_on_water(
            canvas,
            right,
            bottom,
            south_inward.0,
            south_inward.1,
            beach_width,
            adjacent.east,
            adjacent.west,
        );
    }

    if adjacent.west {
        draw_beach_edge_on_water(
            canvas,
            bottom,
            left,
            west_inward.0,
            west_inward.1,
            beach_width,
            adjacent.south,
            adjacent.north,
        );
    }

    if adjacent.north && adjacent.east {
        draw_beach_corner_on_water(
            canvas,
            top,
            left,
            north_inward,
            right,
            east_inward,
            beach_width,
        );
    }

    if adjacent.east && adjacent.south {
        draw_beach_corner_on_water(
            canvas,
            right,
            top,
            east_inward,
            bottom,
            south_inward,
            beach_width,
        );
    }

    if adjacent.south && adjacent.west {
        draw_beach_corner_on_water(
            canvas,
            bottom,
            right,
            south_inward,
            left,
            west_inward,
            beach_width,
        );
    }

    if adjacent.west && adjacent.north {
        draw_beach_corner_on_water(
            canvas,
            left,
            bottom,
            west_inward,
            top,
            north_inward,
            beach_width,
        );
    }
}
