//! IsoCoaster WASM - WebAssembly version of the theme park game
//! 
//! This module provides the main game entry point and WASM bindings.

use wasm_bindgen::prelude::*;
use js_sys::Reflect;
use web_sys::{HtmlCanvasElement, HtmlImageElement};

pub mod game;
pub mod render;
pub mod sim;

use game::state::GameState;
use game::tool::Tool;
use render::canvas::Canvas;
use render::isometric::{grid_to_screen, TILE_HEIGHT, TILE_WIDTH};
use render::sprites::SpriteManager;

/// Console logging macro for debugging
#[macro_export]
macro_rules! console_log {
    ($($t:tt)*) => {
        web_sys::console::log_1(&format!($($t)*).into())
    };
}

/// The main game struct exposed to JavaScript
#[wasm_bindgen]
pub struct Game {
    state: GameState,
    canvas: Canvas,
    sprites: SpriteManager,
    tick_count: u32,
    pixel_ratio: f64,
    
    // Viewport state
    offset_x: f64,
    offset_y: f64,
    zoom: f64,
    
    // Input state
    is_dragging: bool,
    drag_start_x: f64,
    drag_start_y: f64,
    last_mouse_x: f64,
    last_mouse_y: f64,
}

#[wasm_bindgen]
impl Game {
    /// Create a new game instance
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement, grid_size: usize, pixel_ratio: f64) -> Result<Game, JsValue> {
        // Set panic hook for better error messages
        console_error_panic_hook::set_once();
        
        let canvas_obj = Canvas::new(canvas)?;
        let state = GameState::new(grid_size);
        let sprites = SpriteManager::new();
        let ratio = if pixel_ratio > 0.0 { pixel_ratio } else { 1.0 };
        
        // Calculate initial offset to center the grid
        let center_x = canvas_obj.width() as f64 / 2.0 / ratio;
        let center_y = 100.0; // Start near top
        
        console_log!("IsoCoaster WASM initialized with {}x{} grid", grid_size, grid_size);
        
        Ok(Game {
            state,
            canvas: canvas_obj,
            sprites,
            tick_count: 0,
            pixel_ratio: ratio,
            offset_x: center_x,
            offset_y: center_y,
            zoom: 1.0,
            is_dragging: false,
            drag_start_x: 0.0,
            drag_start_y: 0.0,
            last_mouse_x: 0.0,
            last_mouse_y: 0.0,
        })
    }
    
    /// Load a sprite sheet image
    pub fn load_sprite_sheet(&mut self, id: &str, image: HtmlImageElement, dimensions: JsValue) -> Result<(), JsValue> {
        let cols = Reflect::get(&dimensions, &JsValue::from_str("cols"))?
            .as_f64()
            .ok_or_else(|| JsValue::from_str("Sprite sheet cols missing"))? as u32;
        let rows = Reflect::get(&dimensions, &JsValue::from_str("rows"))?
            .as_f64()
            .ok_or_else(|| JsValue::from_str("Sprite sheet rows missing"))? as u32;

        self.sprites.load_sheet(id, image, cols, rows, &self.canvas)?;
        console_log!("Loaded sprite sheet: {} ({}x{})", id, cols, rows);
        Ok(())
    }
    
    /// Load the water texture
    pub fn load_water_texture(&mut self, image: HtmlImageElement) -> Result<(), JsValue> {
        self.sprites.load_water_texture(image)?;
        console_log!("Loaded water texture");
        Ok(())
    }
    
    /// Advance game simulation by one tick
    pub fn tick(&mut self) {
        if self.state.speed == 0 {
            return;
        }

        self.tick_count = self.tick_count.wrapping_add(1);

        // Advance game time
        self.state.advance_time();

        // Update guests
        sim::guest_ai::update_guests(&mut self.state);

        // Spawn new guests
        sim::guest_ai::spawn_guests(&mut self.state);

        // Update coaster trains
        sim::trains::update_trains(&mut self.state);
    }
    
    /// Render the current game state
    pub fn render(&mut self) -> Result<(), JsValue> {
        self.canvas.clear();
        
        // Apply zoom and offset transformations
        self.canvas.save();
        let render_result = (|| {
            self.canvas.scale(self.zoom * self.pixel_ratio, self.zoom * self.pixel_ratio)?;
            
            // Render terrain (grass, water, paths)
            render::terrain::render_terrain(
                &self.canvas,
                &self.state,
                self.offset_x / self.zoom,
                self.offset_y / self.zoom,
                self.zoom,
                &self.sprites,
            )?;
            
            // Render buildings
            render::buildings::render_buildings(
                &self.canvas,
                &self.state,
                self.offset_x / self.zoom,
                self.offset_y / self.zoom,
                self.zoom,
                &self.sprites,
            )?;
            
            // Render coaster tracks
            render::tracks::render_tracks(
                &self.canvas,
                &self.state,
                self.offset_x / self.zoom,
                self.offset_y / self.zoom,
                self.zoom,
                &self.sprites,
            )?;
            
            // Render trains
            render::tracks::render_trains(
                &self.canvas,
                &self.state,
                self.offset_x / self.zoom,
                self.offset_y / self.zoom,
                self.zoom,
                self.tick_count,
            )?;
            
            // Render guests
            render::guests::render_guests(
                &self.canvas,
                &self.state,
                self.offset_x / self.zoom,
                self.offset_y / self.zoom,
                self.zoom,
                self.tick_count,
            )?;
            
            Ok(())
        })();

        self.canvas.restore();
        
        render_result
    }

    fn find_nearest_track_tile(&self, world_x: f64, world_y: f64) -> Option<(i32, i32)> {
        let mut best_tile: Option<(i32, i32, f64)> = None;
        let max_distance = TILE_WIDTH * 0.9;
        let max_distance_sq = max_distance * max_distance;

        for coaster in &self.state.coasters {
            for &(tile_x, tile_y) in &coaster.track_tiles {
                let (screen_x, screen_y) = grid_to_screen(tile_x, tile_y);
                let center_x = screen_x + TILE_WIDTH / 2.0;
                let center_y = screen_y + TILE_HEIGHT / 2.0;
                let dx = world_x - center_x;
                let dy = world_y - center_y;
                let distance_sq = dx * dx + dy * dy;

                if distance_sq <= max_distance_sq {
                    match best_tile {
                        Some((_, _, best_distance)) if distance_sq >= best_distance => {}
                        _ => best_tile = Some((tile_x, tile_y, distance_sq)),
                    }
                }
            }
        }

        best_tile.map(|(tile_x, tile_y, _)| (tile_x, tile_y))
    }
    
    /// Handle mouse click at screen coordinates
    pub fn handle_click(&mut self, screen_x: f64, screen_y: f64) {
        // Convert screen coords to grid coords
        let adjusted_x = screen_x / self.zoom - self.offset_x / self.zoom;
        let adjusted_y = screen_y / self.zoom - self.offset_y / self.zoom;
        
        let (grid_x, grid_y) = render::isometric::screen_to_grid(adjusted_x, adjusted_y);
        
        if grid_x >= 0 && grid_y >= 0 
            && (grid_x as usize) < self.state.grid_size 
            && (grid_y as usize) < self.state.grid_size 
        {
            if matches!(self.state.selected_tool, Tool::Bulldoze) {
                if let Some(tile) = self.state.get_tile(grid_x, grid_y) {
                    let is_empty = tile.building.is_none()
                        && !tile.path
                        && !tile.queue
                        && !tile.has_coaster_track;
                    if is_empty {
                        if let Some((track_x, track_y)) =
                            self.find_nearest_track_tile(adjusted_x, adjusted_y)
                        {
                            self.state.apply_tool(track_x, track_y);
                            return;
                        }
                    }
                }
            }

            // Apply current tool
            self.state.apply_tool(grid_x, grid_y);
        }
    }
    
    /// Handle mouse down for dragging
    pub fn handle_mouse_down(&mut self, x: f64, y: f64) {
        self.is_dragging = true;
        self.drag_start_x = x;
        self.drag_start_y = y;
        self.last_mouse_x = x;
        self.last_mouse_y = y;
    }
    
    /// Handle mouse move for panning
    pub fn handle_mouse_move(&mut self, x: f64, y: f64) {
        if self.is_dragging {
            let dx = x - self.last_mouse_x;
            let dy = y - self.last_mouse_y;
            self.offset_x += dx;
            self.offset_y += dy;
        }
        self.last_mouse_x = x;
        self.last_mouse_y = y;
    }
    
    /// Handle mouse up
    pub fn handle_mouse_up(&mut self, x: f64, y: f64) {
        // If we didn't drag much, treat as click
        let dx = (x - self.drag_start_x).abs();
        let dy = (y - self.drag_start_y).abs();
        if dx < 5.0 && dy < 5.0 {
            self.handle_click(x, y);
        }
        self.is_dragging = false;
    }
    
    /// Handle mouse wheel for zooming
    pub fn handle_wheel(&mut self, delta_y: f64, mouse_x: f64, mouse_y: f64) {
        let zoom_factor = if delta_y > 0.0 { 0.9 } else { 1.1 };
        let new_zoom = (self.zoom * zoom_factor).clamp(0.3, 2.5);
        
        // Zoom toward mouse position
        let scale_change = new_zoom / self.zoom;
        self.offset_x = mouse_x - (mouse_x - self.offset_x) * scale_change;
        self.offset_y = mouse_y - (mouse_y - self.offset_y) * scale_change;
        
        self.zoom = new_zoom;
    }
    
    /// Set the current tool
    pub fn set_tool(&mut self, tool: &str) {
        self.state.set_tool_from_string(tool);
    }
    
    /// Set game speed (0 = paused, 1 = normal, 2 = fast, 3 = fastest)
    pub fn set_speed(&mut self, speed: u8) {
        self.state.speed = speed.min(3);
    }
    
    /// Get current game speed
    pub fn get_speed(&self) -> u8 {
        self.state.speed
    }
    
    /// Get current cash balance
    pub fn get_cash(&self) -> i64 {
        self.state.cash
    }
    
    /// Get guest count
    pub fn get_guest_count(&self) -> usize {
        self.state.guests.len()
    }
    
    /// Get park rating
    pub fn get_park_rating(&self) -> i32 {
        self.state.park_rating
    }
    
    /// Get current time as string (e.g., "Year 1, March 15, 10:30")
    pub fn get_time_string(&self) -> String {
        let month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let month_name = month_names.get(self.state.month as usize - 1).unwrap_or(&"???");
        format!(
            "Year {}, {} {}, {:02}:{:02}",
            self.state.year,
            month_name,
            self.state.day,
            self.state.hour,
            self.state.minute as u8
        )
    }
    
    /// Get grid size
    pub fn get_grid_size(&self) -> usize {
        self.state.grid_size
    }
    
    /// Get current tool name
    pub fn get_current_tool(&self) -> String {
        self.state.selected_tool.to_string()
    }
    
    /// Resize canvas
    pub fn resize(&mut self, width: u32, height: u32, pixel_ratio: f64) {
        let ratio = if pixel_ratio > 0.0 { pixel_ratio } else { 1.0 };
        let scaled_width = ((width as f64) * ratio).round() as u32;
        let scaled_height = ((height as f64) * ratio).round() as u32;
        self.pixel_ratio = ratio;
        self.canvas.resize(scaled_width, scaled_height);
    }
}

// Include console_error_panic_hook for better error messages
mod console_error_panic_hook {
    use std::panic;
    use std::sync::Once;

    static SET_HOOK: Once = Once::new();

    pub fn set_once() {
        SET_HOOK.call_once(|| {
            panic::set_hook(Box::new(|panic_info| {
                let msg = panic_info.to_string();
                web_sys::console::error_1(&msg.into());
            }));
        });
    }
}
