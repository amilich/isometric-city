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
pub const QUEUE_SURFACE: &str = "#a1a1aa";
pub const QUEUE_SURFACE_EDGE: &str = "#71717a";
pub const QUEUE_POST_BASE: &str = "#52525b";
pub const QUEUE_POST_POLE: &str = "#a1a1aa";
pub const QUEUE_POST_TOP: &str = "#d4d4d8";
pub const QUEUE_POST_SHADOW: &str = "rgba(0,0,0,0.3)";
pub const QUEUE_BELT_COLOR: &str = "#dc2626";
pub const QUEUE_BELT_SHADOW: &str = "rgba(0,0,0,0.15)";

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
    for sum in 0..(grid_size * 2) {
        for x in 0..grid_size {
            if x > sum {
                continue;
            }
            let y = sum - x;
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

                // Draw entrance gate at edge path tiles
                if tile.is_edge(grid_size) {
                    draw_entrance_gate(canvas, screen_x, screen_y, x as i32, y as i32, grid_size);
                }
            }
            
            // Draw queue overlay
            if tile.queue {
                draw_queue_tile(canvas, screen_x, screen_y, x as i32, y as i32, state);
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
    let cx = x + w / 2.0;
    let cy = y + h / 2.0;

    draw_grass_tile(canvas, x, y, 1.0);

    let size = state.grid_size as i32;
    let has_path = |gx: i32, gy: i32| -> bool {
        if gx < 0 || gy < 0 || gx >= size || gy >= size {
            return false;
        }
        let tile = &state.grid[gy as usize][gx as usize];
        tile.path || tile.queue
    };

    let has_visitable_building = |gx: i32, gy: i32| -> bool {
        if gx < 0 || gy < 0 || gx >= size || gy >= size {
            return false;
        }
        let tile = &state.grid[gy as usize][gx as usize];
        if let Some(building) = &tile.building {
            building.building_type.is_food() || building.building_type.is_shop()
        } else {
            false
        }
    };

    let north = has_path(grid_x - 1, grid_y);
    let east = has_path(grid_x, grid_y - 1);
    let south = has_path(grid_x + 1, grid_y);
    let west = has_path(grid_x, grid_y + 1);

    let north_building = has_visitable_building(grid_x - 1, grid_y);
    let east_building = has_visitable_building(grid_x, grid_y - 1);
    let south_building = has_visitable_building(grid_x + 1, grid_y);
    let west_building = has_visitable_building(grid_x, grid_y + 1);

    let path_width_ratio = 0.18;
    let path_w = w * path_width_ratio;
    let half_width = path_w * 0.5;
    let edge_stop = 1.15;

    let north_edge_x = x + w * 0.25;
    let north_edge_y = y + h * 0.25;
    let east_edge_x = x + w * 0.75;
    let east_edge_y = y + h * 0.25;
    let south_edge_x = x + w * 0.75;
    let south_edge_y = y + h * 0.75;
    let west_edge_x = x + w * 0.25;
    let west_edge_y = y + h * 0.75;

    let north_len = ((north_edge_x - cx).powi(2) + (north_edge_y - cy).powi(2)).sqrt();
    let east_len = ((east_edge_x - cx).powi(2) + (east_edge_y - cy).powi(2)).sqrt();
    let south_len = ((south_edge_x - cx).powi(2) + (south_edge_y - cy).powi(2)).sqrt();
    let west_len = ((west_edge_x - cx).powi(2) + (west_edge_y - cy).powi(2)).sqrt();

    let north_dx = (north_edge_x - cx) / north_len;
    let north_dy = (north_edge_y - cy) / north_len;
    let east_dx = (east_edge_x - cx) / east_len;
    let east_dy = (east_edge_y - cy) / east_len;
    let south_dx = (south_edge_x - cx) / south_len;
    let south_dy = (south_edge_y - cy) / south_len;
    let west_dx = (west_edge_x - cx) / west_len;
    let west_dy = (west_edge_y - cy) / west_len;

    let get_perp = |dx: f64, dy: f64| -> (f64, f64) { (-dy, dx) };

    let draw_segment = |dir_dx: f64, dir_dy: f64, edge_x: f64, edge_y: f64| {
        let (perp_x, perp_y) = get_perp(dir_dx, dir_dy);
        let stop_x = cx + (edge_x - cx) * edge_stop;
        let stop_y = cy + (edge_y - cy) * edge_stop;

        canvas.set_fill_color(PATH_SURFACE);
        canvas.begin_path();
        canvas.move_to(cx + perp_x * half_width, cy + perp_y * half_width);
        canvas.line_to(stop_x + perp_x * half_width, stop_y + perp_y * half_width);
        canvas.line_to(stop_x - perp_x * half_width, stop_y - perp_y * half_width);
        canvas.line_to(cx - perp_x * half_width, cy - perp_y * half_width);
        canvas.close_path();
        canvas.fill();

    };

    if north {
        draw_segment(north_dx, north_dy, north_edge_x, north_edge_y);
    }
    if east {
        draw_segment(east_dx, east_dy, east_edge_x, east_edge_y);
    }
    if south {
        draw_segment(south_dx, south_dy, south_edge_x, south_edge_y);
    }
    if west {
        draw_segment(west_dx, west_dy, west_edge_x, west_edge_y);
    }

    if north_building && !north {
        draw_segment(north_dx, north_dy, north_edge_x, north_edge_y);
    }
    if east_building && !east {
        draw_segment(east_dx, east_dy, east_edge_x, east_edge_y);
    }
    if south_building && !south {
        draw_segment(south_dx, south_dy, south_edge_x, south_edge_y);
    }
    if west_building && !west {
        draw_segment(west_dx, west_dy, west_edge_x, west_edge_y);
    }

    // Draw edge lines after all segments for crisp edges
    let draw_edges = |dir_dx: f64, dir_dy: f64, edge_x: f64, edge_y: f64| {
        let (perp_x, perp_y) = get_perp(dir_dx, dir_dy);
        let stop_x = cx + (edge_x - cx) * edge_stop;
        let stop_y = cy + (edge_y - cy) * edge_stop;

        canvas.set_stroke_color(PATH_EDGE);
        canvas.set_line_width(0.8);
        canvas.begin_path();
        canvas.move_to(cx + perp_x * half_width, cy + perp_y * half_width);
        canvas.line_to(stop_x + perp_x * half_width, stop_y + perp_y * half_width);
        canvas.stroke();

        canvas.begin_path();
        canvas.move_to(cx - perp_x * half_width, cy - perp_y * half_width);
        canvas.line_to(stop_x - perp_x * half_width, stop_y - perp_y * half_width);
        canvas.stroke();
    };

    if north {
        draw_edges(north_dx, north_dy, north_edge_x, north_edge_y);
    }
    if east {
        draw_edges(east_dx, east_dy, east_edge_x, east_edge_y);
    }
    if south {
        draw_edges(south_dx, south_dy, south_edge_x, south_edge_y);
    }
    if west {
        draw_edges(west_dx, west_dy, west_edge_x, west_edge_y);
    }

    let connection_count = (north as i32 + east as i32 + south as i32 + west as i32) as i32;
    if connection_count == 0 {
        canvas.set_fill_color(PATH_SURFACE);
        canvas.begin_path();
        let _ = canvas.arc(cx, cy, half_width, 0.0, std::f64::consts::PI * 2.0);
        canvas.fill();
    }
}

/// Draw a queue tile
fn draw_queue_tile(canvas: &Canvas, x: f64, y: f64, grid_x: i32, grid_y: i32, state: &GameState) {
    let w = TILE_WIDTH;
    let h = TILE_HEIGHT;
    let cx = x + w / 2.0;
    let cy = y + h / 2.0;

    draw_grass_tile(canvas, x, y, 1.0);

    let size = state.grid_size as i32;
    let has_queue = |gx: i32, gy: i32| -> bool {
        if gx < 0 || gy < 0 || gx >= size || gy >= size {
            return false;
        }
        state.grid[gy as usize][gx as usize].queue
    };

    let has_path = |gx: i32, gy: i32| -> bool {
        if gx < 0 || gy < 0 || gx >= size || gy >= size {
            return false;
        }
        state.grid[gy as usize][gx as usize].path
    };

    let north = has_queue(grid_x - 1, grid_y) || has_path(grid_x - 1, grid_y);
    let east = has_queue(grid_x, grid_y - 1) || has_path(grid_x, grid_y - 1);
    let south = has_queue(grid_x + 1, grid_y) || has_path(grid_x + 1, grid_y);
    let west = has_queue(grid_x, grid_y + 1) || has_path(grid_x, grid_y + 1);

    let queue_width_ratio = 0.14;
    let queue_w = w * queue_width_ratio;
    let half_width = queue_w * 0.5;
    let barrier_offset = half_width * 0.85;
    let edge_stop = 1.15;

    let north_edge_x = x + w * 0.25;
    let north_edge_y = y + h * 0.25;
    let east_edge_x = x + w * 0.75;
    let east_edge_y = y + h * 0.25;
    let south_edge_x = x + w * 0.75;
    let south_edge_y = y + h * 0.75;
    let west_edge_x = x + w * 0.25;
    let west_edge_y = y + h * 0.75;

    let north_len = ((north_edge_x - cx).powi(2) + (north_edge_y - cy).powi(2)).sqrt();
    let east_len = ((east_edge_x - cx).powi(2) + (east_edge_y - cy).powi(2)).sqrt();
    let south_len = ((south_edge_x - cx).powi(2) + (south_edge_y - cy).powi(2)).sqrt();
    let west_len = ((west_edge_x - cx).powi(2) + (west_edge_y - cy).powi(2)).sqrt();

    let north_dx = (north_edge_x - cx) / north_len;
    let north_dy = (north_edge_y - cy) / north_len;
    let east_dx = (east_edge_x - cx) / east_len;
    let east_dy = (east_edge_y - cy) / east_len;
    let south_dx = (south_edge_x - cx) / south_len;
    let south_dy = (south_edge_y - cy) / south_len;
    let west_dx = (west_edge_x - cx) / west_len;
    let west_dy = (west_edge_y - cy) / west_len;

    let get_perp = |dx: f64, dy: f64| -> (f64, f64) { (-dy, dx) };

    let draw_surface = |dir_dx: f64, dir_dy: f64, edge_x: f64, edge_y: f64| {
        let (perp_x, perp_y) = get_perp(dir_dx, dir_dy);
        let stop_x = cx + (edge_x - cx) * edge_stop;
        let stop_y = cy + (edge_y - cy) * edge_stop;

        canvas.set_fill_color(QUEUE_SURFACE);
        canvas.begin_path();
        canvas.move_to(cx + perp_x * half_width, cy + perp_y * half_width);
        canvas.line_to(stop_x + perp_x * half_width, stop_y + perp_y * half_width);
        canvas.line_to(stop_x - perp_x * half_width, stop_y - perp_y * half_width);
        canvas.line_to(cx - perp_x * half_width, cy - perp_y * half_width);
        canvas.close_path();
        canvas.fill();
    };

    if north {
        draw_surface(north_dx, north_dy, north_edge_x, north_edge_y);
    }
    if east {
        draw_surface(east_dx, east_dy, east_edge_x, east_edge_y);
    }
    if south {
        draw_surface(south_dx, south_dy, south_edge_x, south_edge_y);
    }
    if west {
        draw_surface(west_dx, west_dy, west_edge_x, west_edge_y);
    }

    let connection_count = (north as i32 + east as i32 + south as i32 + west as i32) as i32;
    if connection_count == 0 {
        canvas.set_fill_color(QUEUE_SURFACE);
        canvas.begin_path();
        let _ = canvas.arc(cx, cy, half_width, 0.0, std::f64::consts::PI * 2.0);
        canvas.fill();
    }

    let draw_edge_lines = |dir_dx: f64, dir_dy: f64, edge_x: f64, edge_y: f64| {
        let (perp_x, perp_y) = get_perp(dir_dx, dir_dy);
        let stop_x = cx + (edge_x - cx) * edge_stop;
        let stop_y = cy + (edge_y - cy) * edge_stop;

        canvas.set_stroke_color(QUEUE_SURFACE_EDGE);
        canvas.set_line_width(0.5);
        canvas.begin_path();
        canvas.move_to(cx + perp_x * half_width, cy + perp_y * half_width);
        canvas.line_to(stop_x + perp_x * half_width, stop_y + perp_y * half_width);
        canvas.stroke();

        canvas.begin_path();
        canvas.move_to(cx - perp_x * half_width, cy - perp_y * half_width);
        canvas.line_to(stop_x - perp_x * half_width, stop_y - perp_y * half_width);
        canvas.stroke();
    };

    if north {
        draw_edge_lines(north_dx, north_dy, north_edge_x, north_edge_y);
    }
    if east {
        draw_edge_lines(east_dx, east_dy, east_edge_x, east_edge_y);
    }
    if south {
        draw_edge_lines(south_dx, south_dy, south_edge_x, south_edge_y);
    }
    if west {
        draw_edge_lines(west_dx, west_dy, west_edge_x, west_edge_y);
    }

    let draw_barrier = |x1: f64, y1: f64, x2: f64, y2: f64| {
        canvas.set_stroke_color(QUEUE_BELT_SHADOW);
        canvas.set_line_width(2.0);
        canvas.ctx().set_line_cap("round");
        canvas.begin_path();
        canvas.move_to(x1 + 0.5, y1 + 1.0);
        canvas.line_to(x2 + 0.5, y2 + 1.0);
        canvas.stroke();

        canvas.set_stroke_color(QUEUE_BELT_COLOR);
        canvas.set_line_width(1.5);
        canvas.begin_path();
        canvas.move_to(x1, y1);
        canvas.line_to(x2, y2);
        canvas.stroke();
    };

    let draw_post = |px: f64, py: f64| {
        let post_h = 5.0;
        let post_r = 1.0;

        canvas.set_stroke_color(QUEUE_POST_SHADOW);
        canvas.set_line_width(2.0);
        canvas.begin_path();
        canvas.move_to(px + 0.5, py + 1.0);
        canvas.line_to(px + 0.5, py - post_h + 1.0);
        canvas.stroke();

        canvas.set_stroke_color(QUEUE_POST_POLE);
        canvas.set_line_width(1.5);
        canvas.begin_path();
        canvas.move_to(px, py);
        canvas.line_to(px, py - post_h);
        canvas.stroke();

        canvas.set_fill_color(QUEUE_POST_TOP);
        canvas.begin_path();
        let _ = canvas.arc(px, py - post_h, post_r, 0.0, std::f64::consts::PI * 2.0);
        canvas.fill();

        canvas.set_fill_color(QUEUE_POST_BASE);
        canvas.begin_path();
        let _ = canvas.arc(px, py + 0.2, post_r + 0.3, 0.0, std::f64::consts::PI * 2.0);
        canvas.fill();
    };

    let draw_edge_barriers = |dir_dx: f64, dir_dy: f64, edge_x: f64, edge_y: f64| {
        let (perp_x, perp_y) = get_perp(dir_dx, dir_dy);
        let stop_x = cx + (edge_x - cx) * edge_stop;
        let stop_y = cy + (edge_y - cy) * edge_stop;

        let left_start_x = cx + perp_x * barrier_offset;
        let left_start_y = cy + perp_y * barrier_offset;
        let left_end_x = stop_x + perp_x * barrier_offset;
        let left_end_y = stop_y + perp_y * barrier_offset;
        draw_barrier(left_start_x, left_start_y, left_end_x, left_end_y);
        draw_post(left_start_x, left_start_y);
        draw_post(left_end_x, left_end_y);

        let right_start_x = cx - perp_x * barrier_offset;
        let right_start_y = cy - perp_y * barrier_offset;
        let right_end_x = stop_x - perp_x * barrier_offset;
        let right_end_y = stop_y - perp_y * barrier_offset;
        draw_barrier(right_start_x, right_start_y, right_end_x, right_end_y);
        draw_post(right_start_x, right_start_y);
        draw_post(right_end_x, right_end_y);
    };

    if north {
        draw_edge_barriers(north_dx, north_dy, north_edge_x, north_edge_y);
    }
    if east {
        draw_edge_barriers(east_dx, east_dy, east_edge_x, east_edge_y);
    }
    if south {
        draw_edge_barriers(south_dx, south_dy, south_edge_x, south_edge_y);
    }
    if west {
        draw_edge_barriers(west_dx, west_dy, west_edge_x, west_edge_y);
    }
}

/// Draw entrance gate at edge tiles
fn draw_entrance_gate(canvas: &Canvas, x: f64, y: f64, grid_x: i32, grid_y: i32, grid_size: usize) {
    let w = TILE_WIDTH;
    let h = TILE_HEIGHT;
    let size = grid_size as i32;

    let at_north = grid_x == 0;
    let at_east = grid_y == 0;
    let at_south = grid_x == size - 1;
    let at_west = grid_y == size - 1;

    if !at_north && !at_east && !at_south && !at_west {
        return;
    }

    let arch_stone = "#78716c";
    let arch_highlight = "#a8a29e";
    let arch_shadow = "#57534e";
    let post_base = "#44403c";
    let gate_color = "#b91c1c";
    let gate_highlight = "#dc2626";
    let sign_color = "#fef3c7";
    let sign_text = "#1c1917";
    let flag_pole = "#d6d3d1";
    let flag_red = "#dc2626";
    let flag_yellow = "#fbbf24";

    canvas.save();

    let post_height = 32.0;
    let post_width = 3.0;
    let arch_thickness = 4.0;

    let primary_edge = if at_north {
        "north"
    } else if at_east {
        "east"
    } else if at_south {
        "south"
    } else {
        "west"
    };

    let tile_center_x = x + w * 0.5;
    let tile_center_y = y + h * 0.5;

    let (edge_mid_x, edge_mid_y) = match primary_edge {
        "north" => (x + w * 0.25, y + h * 0.25),
        "east" => (x + w * 0.75, y + h * 0.25),
        "south" => (x + w * 0.75, y + h * 0.75),
        _ => (x + w * 0.25, y + h * 0.75),
    };

    let edge_to_center_ratio = 0.35;
    let center_x = edge_mid_x + (tile_center_x - edge_mid_x) * edge_to_center_ratio;
    let center_y = edge_mid_y + (tile_center_y - edge_mid_y) * edge_to_center_ratio;

    let post_offset = 9.0;
    let (left_post_x, left_post_y, right_post_x, right_post_y) = match primary_edge {
        "north" | "south" => (
            center_x + post_offset * 0.85,
            center_y - post_offset * 0.5,
            center_x - post_offset * 0.85,
            center_y + post_offset * 0.5,
        ),
        _ => (
            center_x - post_offset * 0.85,
            center_y - post_offset * 0.5,
            center_x + post_offset * 0.85,
            center_y + post_offset * 0.5,
        ),
    };

    draw_gate_post(canvas, left_post_x, left_post_y, post_width, post_height, arch_stone, arch_highlight, post_base);
    draw_gate_post(canvas, right_post_x, right_post_y, post_width, post_height, arch_stone, arch_highlight, post_base);

    canvas.set_fill_color(arch_stone);
    canvas.fill_rect(
        left_post_x.min(right_post_x),
        (left_post_y.min(right_post_y)) - post_height,
        (left_post_x - right_post_x).abs(),
        arch_thickness,
    );

    canvas.set_fill_color(arch_shadow);
    canvas.fill_rect(
        left_post_x.min(right_post_x),
        (left_post_y.min(right_post_y)) - post_height - arch_thickness,
        (left_post_x - right_post_x).abs(),
        arch_thickness,
    );

    let sign_width = 16.0;
    let sign_height = 6.0;
    let sign_x = center_x - sign_width / 2.0;
    let sign_y = center_y - post_height + 6.0;
    canvas.set_fill_color(sign_color);
    canvas.fill_rect(sign_x, sign_y, sign_width, sign_height);
    canvas.set_stroke_color(arch_shadow);
    canvas.set_line_width(0.5);
    canvas.stroke_rect(sign_x, sign_y, sign_width, sign_height);
    canvas.set_fill_color(sign_text);
    canvas.set_font("4px sans-serif");
    let _ = canvas.fill_text("ENTR", sign_x + 2.0, sign_y + 4.5);

    // Gate bars
    canvas.set_fill_color(gate_color);
    for i in 0..3 {
        let bar_x = center_x - 4.0 + i as f64 * 4.0;
        canvas.fill_rect(bar_x, center_y - post_height + 10.0, 1.5, post_height - 14.0);
    }
    canvas.set_fill_color(gate_highlight);
    canvas.fill_rect(center_x - 4.0, center_y - post_height + 10.0, 1.0, post_height - 14.0);

    // Flags
    canvas.set_stroke_color(flag_pole);
    canvas.set_line_width(1.0);
    canvas.begin_path();
    canvas.move_to(left_post_x - 2.0, left_post_y - post_height - 2.0);
    canvas.line_to(left_post_x - 2.0, left_post_y - post_height - 10.0);
    canvas.stroke();
    canvas.set_fill_color(flag_red);
    canvas.begin_path();
    canvas.move_to(left_post_x - 2.0, left_post_y - post_height - 10.0);
    canvas.line_to(left_post_x - 6.0, left_post_y - post_height - 8.0);
    canvas.line_to(left_post_x - 2.0, left_post_y - post_height - 6.0);
    canvas.close_path();
    canvas.fill();
    canvas.set_fill_color(flag_yellow);
    canvas.begin_path();
    canvas.move_to(left_post_x - 2.0, left_post_y - post_height - 10.0);
    canvas.line_to(left_post_x - 4.5, left_post_y - post_height - 8.5);
    canvas.line_to(left_post_x - 2.0, left_post_y - post_height - 7.0);
    canvas.close_path();
    canvas.fill();

    canvas.restore();
}

fn draw_gate_post(
    canvas: &Canvas,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    stone: &str,
    highlight: &str,
    base: &str,
) {
    canvas.set_fill_color(stone);
    canvas.fill_rect(x - width / 2.0, y - height, width, height);
    canvas.set_fill_color(highlight);
    canvas.fill_rect(x - width / 2.0, y - height, 1.0, height);
    canvas.set_fill_color(highlight);
    canvas.fill_rect(x - width / 2.0 - 1.0, y - height - 2.0, width + 2.0, 3.0);
    canvas.set_fill_color(base);
    canvas.fill_rect(x - width / 2.0 - 1.0, y - 2.0, width + 2.0, 3.0);
    canvas.set_fill_color(stone);
    canvas.begin_path();
    let _ = canvas.arc(x, y - height - 3.0, 2.0, 0.0, std::f64::consts::PI * 2.0);
    canvas.fill();
    canvas.set_fill_color(highlight);
    canvas.begin_path();
    let _ = canvas.arc(x - 0.5, y - height - 3.5, 0.8, 0.0, std::f64::consts::PI * 2.0);
    canvas.fill();
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
