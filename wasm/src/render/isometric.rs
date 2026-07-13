//! Isometric coordinate system

/// Tile width in pixels
pub const TILE_WIDTH: f64 = 64.0;

/// Height ratio (matching original game)
pub const HEIGHT_RATIO: f64 = 0.60;

/// Tile height in pixels
pub const TILE_HEIGHT: f64 = TILE_WIDTH * HEIGHT_RATIO;

/// Height unit for elevated tracks (pixels per height level)
pub const HEIGHT_UNIT: f64 = 20.0;

/// Convert grid coordinates to screen coordinates
pub fn grid_to_screen(grid_x: i32, grid_y: i32) -> (f64, f64) {
    let screen_x = (grid_x - grid_y) as f64 * (TILE_WIDTH / 2.0);
    let screen_y = (grid_x + grid_y) as f64 * (TILE_HEIGHT / 2.0);
    (screen_x, screen_y)
}

/// Convert grid coordinates to screen coordinates with offset
pub fn grid_to_screen_offset(grid_x: i32, grid_y: i32, offset_x: f64, offset_y: f64) -> (f64, f64) {
    let (sx, sy) = grid_to_screen(grid_x, grid_y);
    (sx + offset_x, sy + offset_y)
}

/// Convert screen coordinates to grid coordinates
pub fn screen_to_grid(screen_x: f64, screen_y: f64) -> (i32, i32) {
    let grid_x = (screen_x / (TILE_WIDTH / 2.0) + screen_y / (TILE_HEIGHT / 2.0)) / 2.0;
    let grid_y = (screen_y / (TILE_HEIGHT / 2.0) - screen_x / (TILE_WIDTH / 2.0)) / 2.0;
    (grid_x.floor() as i32, grid_y.floor() as i32)
}

/// Get the tile center point in screen coordinates
pub fn tile_center(grid_x: i32, grid_y: i32, offset_x: f64, offset_y: f64) -> (f64, f64) {
    let (sx, sy) = grid_to_screen_offset(grid_x, grid_y, offset_x, offset_y);
    (sx + TILE_WIDTH / 2.0, sy + TILE_HEIGHT / 2.0)
}

/// Calculate depth for sorting (higher = rendered later/on top)
pub fn tile_depth(grid_x: i32, grid_y: i32) -> i32 {
    grid_x + grid_y
}
