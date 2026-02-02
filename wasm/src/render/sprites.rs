//! Sprite loading and management

use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use wasm_bindgen::Clamped;
use web_sys::{HtmlCanvasElement, HtmlImageElement, CanvasRenderingContext2d, ImageData};

use super::canvas::Canvas;

/// Background color to filter (red)
const BG_R: u8 = 255;
const BG_G: u8 = 0;
const BG_B: u8 = 0;
const COLOR_THRESHOLD: f64 = 155.0;

/// Sprite mapping info
#[derive(Clone)]
pub struct SpriteInfo {
    pub name: String,
    pub row: u32,
    pub col: u32,
    pub offset_x: f64,
    pub offset_y: f64,
    pub scale: f64,
    pub crop_top: u32,
    pub crop_bottom: u32,
    pub crop_left: u32,
    pub crop_right: u32,
}

impl SpriteInfo {
    pub fn new(name: &str, row: u32, col: u32) -> Self {
        SpriteInfo {
            name: name.to_string(),
            row,
            col,
            offset_x: 0.0,
            offset_y: -20.0,
            scale: 0.8,
            crop_top: 0,
            crop_bottom: 0,
            crop_left: 0,
            crop_right: 0,
        }
    }
    
    pub fn with_offset(mut self, x: f64, y: f64) -> Self {
        self.offset_x = x;
        self.offset_y = y;
        self
    }
    
    pub fn with_scale(mut self, scale: f64) -> Self {
        self.scale = scale;
        self
    }

    pub fn with_crop(mut self, top: u32, bottom: u32, left: u32, right: u32) -> Self {
        self.crop_top = top;
        self.crop_bottom = bottom;
        self.crop_left = left;
        self.crop_right = right;
        self
    }
}

/// A loaded sprite sheet
pub struct SpriteSheet {
    pub id: String,
    pub filtered_canvas: HtmlCanvasElement,
    pub width: u32,
    pub height: u32,
    pub cols: u32,
    pub rows: u32,
    pub sprites: HashMap<String, SpriteInfo>,
}

impl SpriteSheet {
    /// Get cell dimensions
    pub fn cell_size(&self) -> (u32, u32) {
        (self.width / self.cols, self.height / self.rows)
    }
    
    /// Get sprite info by name
    pub fn get_sprite(&self, name: &str) -> Option<&SpriteInfo> {
        self.sprites.get(name)
    }
}

/// Sprite manager
pub struct SpriteManager {
    pub sheets: HashMap<String, SpriteSheet>,
    pub water_canvas: Option<HtmlCanvasElement>,
}

impl SpriteManager {
    pub fn new() -> Self {
        SpriteManager {
            sheets: HashMap::new(),
            water_canvas: None,
        }
    }
    
    /// Load a sprite sheet from an image
    pub fn load_sheet(
        &mut self,
        id: &str,
        image: HtmlImageElement,
        cols: u32,
        rows: u32,
        _canvas: &Canvas,
    ) -> Result<(), JsValue> {
        let width = image.natural_width();
        let height = image.natural_height();
        
        if width == 0 || height == 0 {
            return Err(JsValue::from_str("Image not loaded"));
        }
        
        // Create offscreen canvas for filtering
        let document = web_sys::window()
            .ok_or("No window")?
            .document()
            .ok_or("No document")?;
        
        let offscreen = document
            .create_element("canvas")?
            .dyn_into::<HtmlCanvasElement>()?;
        
        offscreen.set_width(width);
        offscreen.set_height(height);
        
        let ctx = offscreen
            .get_context("2d")?
            .ok_or("No context")?
            .dyn_into::<CanvasRenderingContext2d>()?;
        
        // Draw image
        ctx.draw_image_with_html_image_element(&image, 0.0, 0.0)?;
        
        // Get image data and filter
        let image_data = ctx.get_image_data(0.0, 0.0, width as f64, height as f64)?;
        let filtered_data = filter_background(&image_data)?;
        
        // Put filtered data back
        ctx.put_image_data(&filtered_data, 0.0, 0.0)?;
        
        // Create sprite sheet with default sprite mappings
        let sprites = create_default_sprites(id, cols, rows);
        
        let sheet = SpriteSheet {
            id: id.to_string(),
            filtered_canvas: offscreen,
            width,
            height,
            cols,
            rows,
            sprites,
        };
        
        self.sheets.insert(id.to_string(), sheet);
        
        Ok(())
    }
    
    /// Load water texture
    pub fn load_water_texture(&mut self, image: HtmlImageElement) -> Result<(), JsValue> {
        let width = image.natural_width();
        let height = image.natural_height();
        
        if width == 0 || height == 0 {
            return Err(JsValue::from_str("Image not loaded"));
        }
        
        let document = web_sys::window()
            .ok_or("No window")?
            .document()
            .ok_or("No document")?;
        
        let offscreen = document
            .create_element("canvas")?
            .dyn_into::<HtmlCanvasElement>()?;
        
        offscreen.set_width(width);
        offscreen.set_height(height);
        
        let ctx = offscreen
            .get_context("2d")?
            .ok_or("No context")?
            .dyn_into::<CanvasRenderingContext2d>()?;
        
        ctx.draw_image_with_html_image_element(&image, 0.0, 0.0)?;
        
        self.water_canvas = Some(offscreen);
        
        Ok(())
    }
    
    /// Get a sprite sheet by ID
    pub fn get_sheet(&self, id: &str) -> Option<&SpriteSheet> {
        self.sheets.get(id)
    }
    
    /// Draw a sprite from a sheet
    pub fn draw_sprite(
        &self,
        canvas: &Canvas,
        sheet_id: &str,
        sprite_name: &str,
        x: f64,
        y: f64,
    ) -> Result<(), JsValue> {
        let sheet = match self.sheets.get(sheet_id) {
            Some(s) => s,
            None => return Ok(()), // Sheet not loaded yet
        };
        
        let sprite = match sheet.sprites.get(sprite_name) {
            Some(s) => s,
            None => return Ok(()), // Sprite not found
        };
        
        let (cell_w, cell_h) = sheet.cell_size();
        
        // Source rectangle
        let sx = (sprite.col * cell_w + sprite.crop_left) as f64;
        let sy = (sprite.row * cell_h + sprite.crop_top) as f64;
        let sw = (cell_w - sprite.crop_left - sprite.crop_right) as f64;
        let sh = (cell_h - sprite.crop_top - sprite.crop_bottom) as f64;
        
        // Destination rectangle
        let dw = sw * sprite.scale;
        let dh = sh * sprite.scale;
        let dx = x + sprite.offset_x - dw / 2.0;
        let dy = y + sprite.offset_y - dh;
        
        canvas.ctx().draw_image_with_html_canvas_element_and_sw_and_sh_and_dx_and_dy_and_dw_and_dh(
            &sheet.filtered_canvas,
            sx, sy, sw, sh,
            dx, dy, dw, dh
        )?;
        
        Ok(())
    }
}

/// Filter red background from image data
fn filter_background(image_data: &ImageData) -> Result<ImageData, JsValue> {
    let data = image_data.data();
    let mut filtered = data.to_vec();
    
    for i in (0..filtered.len()).step_by(4) {
        let r = filtered[i];
        let g = filtered[i + 1];
        let b = filtered[i + 2];
        
        let dr = (r as f64 - BG_R as f64).powi(2);
        let dg = (g as f64 - BG_G as f64).powi(2);
        let db = (b as f64 - BG_B as f64).powi(2);
        let distance = (dr + dg + db).sqrt();
        
        if distance <= COLOR_THRESHOLD {
            filtered[i + 3] = 0; // Make transparent
        }
    }
    
    ImageData::new_with_u8_clamped_array_and_sh(
        Clamped(&filtered),
        image_data.width(),
        image_data.height()
    )
}

/// Create default sprite mappings for a sheet
fn create_default_sprites(sheet_id: &str, _cols: u32, _rows: u32) -> HashMap<String, SpriteInfo> {
    let mut sprites = HashMap::new();
    
    match sheet_id {
        "trees" => {
            // Row 0: Deciduous
            sprites.insert("tree_oak".to_string(), SpriteInfo::new("tree_oak", 0, 0).with_offset(0.0, -18.0).with_scale(0.65));
            sprites.insert("tree_maple".to_string(), SpriteInfo::new("tree_maple", 0, 1).with_offset(0.0, -18.0).with_scale(0.65));
            sprites.insert("tree_birch".to_string(), SpriteInfo::new("tree_birch", 0, 2).with_offset(0.0, -18.0).with_scale(0.6));
            sprites.insert("tree_elm".to_string(), SpriteInfo::new("tree_elm", 0, 3).with_offset(0.0, -18.0).with_scale(0.65));
            sprites.insert("tree_willow".to_string(), SpriteInfo::new("tree_willow", 0, 4).with_offset(0.0, -20.0).with_scale(0.7));
            sprites.insert("tree_deciduous_extra".to_string(), SpriteInfo::new("tree_deciduous_extra", 0, 5).with_offset(0.0, -18.0).with_scale(0.65));
            // Row 1: Evergreen
            sprites.insert("tree_pine".to_string(), SpriteInfo::new("tree_pine", 1, 0).with_offset(0.0, -20.0).with_scale(0.65));
            sprites.insert("tree_spruce".to_string(), SpriteInfo::new("tree_spruce", 1, 1).with_offset(0.0, -20.0).with_scale(0.65));
            sprites.insert("tree_fir".to_string(), SpriteInfo::new("tree_fir", 1, 2).with_offset(0.0, -20.0).with_scale(0.65));
            sprites.insert("tree_cedar".to_string(), SpriteInfo::new("tree_cedar", 1, 3).with_offset(0.0, -20.0).with_scale(0.65));
            sprites.insert("tree_redwood".to_string(), SpriteInfo::new("tree_redwood", 1, 4).with_offset(0.0, -22.0).with_scale(0.7));
            sprites.insert("tree_evergreen_extra".to_string(), SpriteInfo::new("tree_evergreen_extra", 1, 5).with_offset(0.0, -20.0).with_scale(0.65));
            // Row 2: Tropical
            sprites.insert("tree_palm".to_string(), SpriteInfo::new("tree_palm", 2, 0).with_offset(0.0, -20.0).with_scale(0.65));
            sprites.insert("tree_banana".to_string(), SpriteInfo::new("tree_banana", 2, 1).with_offset(0.0, -18.0).with_scale(0.6));
            sprites.insert("tree_bamboo".to_string(), SpriteInfo::new("tree_bamboo", 2, 2).with_offset(0.0, -18.0).with_scale(0.55));
            sprites.insert("tree_coconut".to_string(), SpriteInfo::new("tree_coconut", 2, 3).with_offset(0.0, -20.0).with_scale(0.65));
            sprites.insert("tree_tropical".to_string(), SpriteInfo::new("tree_tropical", 2, 4).with_offset(0.0, -18.0).with_scale(0.6));
            sprites.insert("tree_tropical_extra".to_string(), SpriteInfo::new("tree_tropical_extra", 2, 5).with_offset(0.0, -18.0).with_scale(0.6));
            // Row 3: Flowering
            sprites.insert("tree_cherry".to_string(), SpriteInfo::new("tree_cherry", 3, 0).with_offset(0.0, -16.0).with_scale(0.6));
            sprites.insert("tree_magnolia".to_string(), SpriteInfo::new("tree_magnolia", 3, 1).with_offset(0.0, -16.0).with_scale(0.6));
            sprites.insert("tree_dogwood".to_string(), SpriteInfo::new("tree_dogwood", 3, 2).with_offset(0.0, -16.0).with_scale(0.55));
            sprites.insert("tree_jacaranda".to_string(), SpriteInfo::new("tree_jacaranda", 3, 3).with_offset(0.0, -16.0).with_scale(0.6));
            sprites.insert("tree_wisteria".to_string(), SpriteInfo::new("tree_wisteria", 3, 4).with_offset(0.0, -16.0).with_scale(0.6));
            sprites.insert("tree_flowering_extra".to_string(), SpriteInfo::new("tree_flowering_extra", 3, 5).with_offset(0.0, -16.0).with_scale(0.6));
            // Row 4: Bushes
            sprites.insert("bush_hedge".to_string(), SpriteInfo::new("bush_hedge", 4, 0).with_offset(0.0, -12.0).with_scale(0.68));
            sprites.insert("bush_flowering".to_string(), SpriteInfo::new("bush_flowering", 4, 1).with_offset(0.0, -12.0).with_scale(0.68));
            sprites.insert("topiary_ball".to_string(), SpriteInfo::new("topiary_ball", 4, 2).with_offset(0.0, -8.0).with_scale(0.45));
            sprites.insert("topiary_spiral".to_string(), SpriteInfo::new("topiary_spiral", 4, 3).with_offset(0.0, -10.0).with_scale(0.5));
            sprites.insert("topiary_animal".to_string(), SpriteInfo::new("topiary_animal", 4, 4).with_offset(0.0, -10.0).with_scale(0.5));
            sprites.insert("flowers_square_bed".to_string(), SpriteInfo::new("flowers_square_bed", 4, 5).with_offset(0.0, -8.0).with_scale(0.6));
            // Row 5: Flowers
            sprites.insert("flowers_bed".to_string(), SpriteInfo::new("flowers_bed", 5, 0).with_offset(0.0, -8.0).with_scale(0.6));
            sprites.insert("flowers_planter".to_string(), SpriteInfo::new("flowers_planter", 5, 1).with_offset(0.0, -12.0).with_scale(0.68));
            sprites.insert("flowers_hanging".to_string(), SpriteInfo::new("flowers_hanging", 5, 2).with_offset(0.0, -15.0).with_scale(0.68));
            sprites.insert("flowers_wild".to_string(), SpriteInfo::new("flowers_wild", 5, 3).with_offset(0.0, -8.0).with_scale(0.6));
            sprites.insert("ground_cover".to_string(), SpriteInfo::new("ground_cover", 5, 4).with_offset(0.0, -3.0).with_scale(0.4));
            sprites.insert("ground_stones".to_string(), SpriteInfo::new("ground_stones", 5, 5).with_offset(0.0, -3.0).with_scale(0.4));
        },
        "food" => {
            // Row 0: American
            sprites.insert("food_hotdog".to_string(), SpriteInfo::new("food_hotdog", 0, 0).with_offset(0.0, -22.0).with_scale(0.41));
            sprites.insert("food_burger".to_string(), SpriteInfo::new("food_burger", 0, 1).with_offset(0.0, -22.0).with_scale(0.41));
            sprites.insert("food_fries".to_string(), SpriteInfo::new("food_fries", 0, 2).with_offset(0.0, -22.0).with_scale(0.39));
            sprites.insert("food_corndog".to_string(), SpriteInfo::new("food_corndog", 0, 3).with_offset(0.0, -22.0).with_scale(0.39));
            sprites.insert("food_pretzel".to_string(), SpriteInfo::new("food_pretzel", 0, 4).with_offset(0.0, -22.0).with_scale(0.39));
            // Row 1: Sweet
            sprites.insert("food_icecream".to_string(), SpriteInfo::new("food_icecream", 1, 0).with_offset(0.0, -22.0).with_scale(0.41));
            sprites.insert("food_cotton_candy".to_string(), SpriteInfo::new("food_cotton_candy", 1, 1).with_offset(0.0, -22.0).with_scale(0.39));
            sprites.insert("food_candy_apple".to_string(), SpriteInfo::new("food_candy_apple", 1, 2).with_offset(0.0, -22.0).with_scale(0.39));
            sprites.insert("food_churros".to_string(), SpriteInfo::new("food_churros", 1, 3).with_offset(0.0, -22.0).with_scale(0.39));
            sprites.insert("food_funnel_cake".to_string(), SpriteInfo::new("food_funnel_cake", 1, 4).with_offset(0.0, -22.0).with_scale(0.41));
            // Row 2: Drinks
            sprites.insert("drink_soda".to_string(), SpriteInfo::new("drink_soda", 2, 0).with_offset(0.0, -22.0).with_scale(0.39));
            sprites.insert("drink_lemonade".to_string(), SpriteInfo::new("drink_lemonade", 2, 1).with_offset(0.0, -22.0).with_scale(0.41));
            sprites.insert("drink_smoothie".to_string(), SpriteInfo::new("drink_smoothie", 2, 2).with_offset(0.0, -22.0).with_scale(0.39));
            sprites.insert("drink_coffee".to_string(), SpriteInfo::new("drink_coffee", 2, 3).with_offset(0.0, -22.0).with_scale(0.39));
            sprites.insert("drink_slushie".to_string(), SpriteInfo::new("drink_slushie", 2, 4).with_offset(0.0, -22.0).with_scale(0.39));
            // Row 3: Snacks
            sprites.insert("snack_popcorn".to_string(), SpriteInfo::new("snack_popcorn", 3, 0).with_offset(0.0, -22.0).with_scale(0.41));
            sprites.insert("snack_nachos".to_string(), SpriteInfo::new("snack_nachos", 3, 1).with_offset(0.0, -22.0).with_scale(0.39));
            sprites.insert("snack_pizza".to_string(), SpriteInfo::new("snack_pizza", 3, 2).with_offset(0.0, -24.0).with_scale(0.42));
            sprites.insert("snack_cookies".to_string(), SpriteInfo::new("snack_cookies", 3, 3).with_offset(0.0, -22.0).with_scale(0.39));
            sprites.insert("snack_donuts".to_string(), SpriteInfo::new("snack_donuts", 3, 4).with_offset(0.0, -22.0).with_scale(0.39));
            // Row 4: International
            sprites.insert("food_tacos".to_string(), SpriteInfo::new("food_tacos", 4, 0).with_offset(0.0, -22.0).with_scale(0.41));
            sprites.insert("food_noodles".to_string(), SpriteInfo::new("food_noodles", 4, 1).with_offset(0.0, -22.0).with_scale(0.41));
            sprites.insert("food_kebab".to_string(), SpriteInfo::new("food_kebab", 4, 2).with_offset(0.0, -22.0).with_scale(0.39));
            sprites.insert("food_crepes".to_string(), SpriteInfo::new("food_crepes", 4, 3).with_offset(0.0, -22.0).with_scale(0.39));
            sprites.insert("food_waffles".to_string(), SpriteInfo::new("food_waffles", 4, 4).with_offset(0.0, -22.0).with_scale(0.39));
            // Row 5: Themed carts
            sprites.insert("cart_pirate".to_string(), SpriteInfo::new("cart_pirate", 5, 0).with_offset(0.0, -24.0).with_scale(0.43));
            sprites.insert("cart_space".to_string(), SpriteInfo::new("cart_space", 5, 1).with_offset(0.0, -24.0).with_scale(0.43));
            sprites.insert("cart_medieval".to_string(), SpriteInfo::new("cart_medieval", 5, 2).with_offset(0.0, -24.0).with_scale(0.43));
            sprites.insert("cart_western".to_string(), SpriteInfo::new("cart_western", 5, 3).with_offset(0.0, -24.0).with_scale(0.43));
            sprites.insert("cart_tropical".to_string(), SpriteInfo::new("cart_tropical", 5, 4).with_offset(0.0, -24.0).with_scale(0.43));
        },
        "stations" => {
            // Row 0: Wooden
            for i in 0..5 {
                let name = format!("station_wooden_{}", i + 1);
                sprites.insert(name.clone(), SpriteInfo::new(&name, 0, i).with_offset(0.0, -30.0).with_scale(0.9));
            }
            // Row 1: Steel
            for i in 0..5 {
                let name = format!("station_steel_{}", i + 1);
                sprites.insert(name.clone(), SpriteInfo::new(&name, 1, i).with_offset(0.0, -30.0).with_scale(0.9));
            }
            // Row 2: Inverted
            for i in 0..5 {
                let name = format!("station_inverted_{}", i + 1);
                let offset_y = if i == 4 { -28.0 } else { -30.0 };
                let scale = if i == 4 { 0.88 } else { 0.9 };
                sprites.insert(name.clone(), SpriteInfo::new(&name, 2, i).with_offset(0.0, offset_y).with_scale(scale));
            }
            // Row 3: Water
            for i in 0..5 {
                let name = format!("station_water_{}", i + 1);
                let offset_x = if i == 4 { -3.0 } else { 0.0 };
                let scale = if i == 4 { 0.88 } else { 0.9 };
                sprites.insert(name.clone(), SpriteInfo::new(&name, 3, i).with_offset(offset_x, -30.0).with_scale(scale));
            }
            // Row 4: Mine
            for i in 0..5 {
                let name = format!("station_mine_{}", i + 1);
                sprites.insert(name.clone(), SpriteInfo::new(&name, 4, i).with_offset(0.0, -30.0).with_scale(0.9));
            }
            // Row 5: Futuristic
            for i in 0..5 {
                let name = format!("station_futuristic_{}", i + 1);
                sprites.insert(name.clone(), SpriteInfo::new(&name, 5, i).with_offset(0.0, -32.0).with_scale(0.92));
            }
        },
        "rides_small" => {
            // Row 0: Kiddie
            sprites.insert("ride_kiddie_coaster".to_string(), SpriteInfo::new("ride_kiddie_coaster", 0, 0).with_offset(0.0, 70.0).with_scale(0.55));
            sprites.insert("ride_kiddie_train".to_string(), SpriteInfo::new("ride_kiddie_train", 0, 1).with_offset(0.0, 70.0).with_scale(0.52));
            sprites.insert("ride_kiddie_planes".to_string(), SpriteInfo::new("ride_kiddie_planes", 0, 2).with_offset(0.0, 70.0).with_scale(0.55));
            sprites.insert("ride_kiddie_boats".to_string(), SpriteInfo::new("ride_kiddie_boats", 0, 3).with_offset(0.0, 70.0).with_scale(0.52));
            sprites.insert("ride_kiddie_cars".to_string(), SpriteInfo::new("ride_kiddie_cars", 0, 4).with_offset(0.0, 70.0).with_scale(0.52));
            // Row 1: Spinning
            sprites.insert("ride_teacups".to_string(), SpriteInfo::new("ride_teacups", 1, 0).with_offset(0.0, 70.0).with_scale(0.6));
            sprites.insert("ride_scrambler".to_string(), SpriteInfo::new("ride_scrambler", 1, 1).with_offset(0.0, 70.0).with_scale(0.6));
            sprites.insert("ride_tilt_a_whirl".to_string(), SpriteInfo::new("ride_tilt_a_whirl", 1, 2).with_offset(0.0, 70.0).with_scale(0.6));
            sprites.insert("ride_spinning_apples".to_string(), SpriteInfo::new("ride_spinning_apples", 1, 3).with_offset(0.0, 70.0).with_scale(0.6));
            sprites.insert("ride_whirlwind".to_string(), SpriteInfo::new("ride_whirlwind", 1, 4).with_offset(0.0, 70.0).with_scale(0.6));
            // Row 2: Classic
            sprites.insert("ride_carousel".to_string(), SpriteInfo::new("ride_carousel", 2, 0).with_offset(0.0, 70.0).with_scale(0.6));
            sprites.insert("ride_antique_cars".to_string(), SpriteInfo::new("ride_antique_cars", 2, 1).with_offset(0.0, 80.0).with_scale(0.52));
            sprites.insert("ride_monorail_car".to_string(), SpriteInfo::new("ride_monorail_car", 2, 2).with_offset(0.0, 55.0).with_scale(0.5));
            sprites.insert("ride_sky_ride_car".to_string(), SpriteInfo::new("ride_sky_ride_car", 2, 3).with_offset(0.0, 55.0).with_scale(0.5));
            sprites.insert("ride_train_car".to_string(), SpriteInfo::new("ride_train_car", 2, 4).with_offset(0.0, 55.0).with_scale(0.5));
            sprites.insert("ride_bumper_cars".to_string(), SpriteInfo::new("ride_bumper_cars", 3, 0).with_offset(0.0, 80.0).with_scale(0.6));
            sprites.insert("ride_go_karts".to_string(), SpriteInfo::new("ride_go_karts", 3, 1).with_offset(0.0, 150.0).with_scale(0.6));
            sprites.insert("ride_simulator".to_string(), SpriteInfo::new("ride_simulator", 3, 2).with_offset(0.0, 70.0).with_scale(0.55));
            sprites.insert("ride_motion_theater".to_string(), SpriteInfo::new("ride_motion_theater", 3, 3).with_offset(0.0, 105.0).with_scale(0.55));
            sprites.insert("ride_4d_theater".to_string(), SpriteInfo::new("ride_4d_theater", 3, 4).with_offset(0.0, 105.0).with_scale(0.55));
            // Row 4: Water rides
            sprites.insert("ride_bumper_boats".to_string(), SpriteInfo::new("ride_bumper_boats", 4, 0).with_offset(0.0, 80.0).with_scale(0.52));
            sprites.insert("ride_paddle_boats".to_string(), SpriteInfo::new("ride_paddle_boats", 4, 1).with_offset(0.0, 80.0).with_scale(0.5));
            sprites.insert("ride_lazy_river".to_string(), SpriteInfo::new("ride_lazy_river", 4, 2).with_offset(0.0, 80.0).with_scale(0.55));
            sprites.insert("ride_water_play".to_string(), SpriteInfo::new("ride_water_play", 4, 3).with_offset(0.0, 200.0).with_scale(0.65));
            sprites.insert("ride_splash_zone".to_string(), SpriteInfo::new("ride_splash_zone", 4, 4).with_offset(0.0, 70.0).with_scale(0.55));
            // Row 5: Dark rides
            sprites.insert("ride_haunted_house".to_string(), SpriteInfo::new("ride_haunted_house", 5, 0).with_offset(0.0, 100.0).with_scale(0.85));
            sprites.insert("ride_ghost_train".to_string(), SpriteInfo::new("ride_ghost_train", 5, 1).with_offset(0.0, 100.0).with_scale(0.85));
            sprites.insert("ride_dark_ride".to_string(), SpriteInfo::new("ride_dark_ride", 5, 2).with_offset(0.0, 100.0).with_scale(0.85));
            sprites.insert("ride_tunnel".to_string(), SpriteInfo::new("ride_tunnel", 5, 3).with_offset(0.0, 70.0).with_scale(0.6));
            sprites.insert("ride_themed_facade".to_string(), SpriteInfo::new("ride_themed_facade", 5, 4).with_offset(0.0, 100.0).with_scale(0.85));
        },
        "rides_large" => {
            // Row 0: Ferris
            sprites.insert("ride_ferris_classic".to_string(), SpriteInfo::new("ride_ferris_classic", 0, 0).with_offset(0.0, 110.0).with_scale(0.95));
            sprites.insert("ride_ferris_modern".to_string(), SpriteInfo::new("ride_ferris_modern", 0, 1).with_offset(0.0, 110.0).with_scale(0.95));
            sprites.insert("ride_ferris_observation".to_string(), SpriteInfo::new("ride_ferris_observation", 0, 2).with_offset(0.0, 190.0).with_scale(1.0));
            sprites.insert("ride_ferris_double".to_string(), SpriteInfo::new("ride_ferris_double", 0, 3).with_offset(0.0, 110.0).with_scale(0.97));
            sprites.insert("ride_ferris_led".to_string(), SpriteInfo::new("ride_ferris_led", 0, 4).with_offset(0.0, 110.0).with_scale(1.0));
            // Row 1: Drop
            sprites.insert("ride_drop_tower".to_string(), SpriteInfo::new("ride_drop_tower", 1, 0).with_offset(0.0, 55.0).with_scale(0.65));
            sprites.insert("ride_space_shot".to_string(), SpriteInfo::new("ride_space_shot", 1, 1).with_offset(0.0, 55.0).with_scale(0.67));
            sprites.insert("ride_observation_tower".to_string(), SpriteInfo::new("ride_observation_tower", 1, 2).with_offset(0.0, 55.0).with_scale(0.67));
            sprites.insert("ride_sky_swing".to_string(), SpriteInfo::new("ride_sky_swing", 1, 3).with_offset(0.0, 65.0).with_scale(0.62));
            sprites.insert("ride_star_flyer".to_string(), SpriteInfo::new("ride_star_flyer", 1, 4).with_offset(0.0, 60.0).with_scale(0.65));
            // Row 2: Swing rides
            sprites.insert("ride_swing_ride".to_string(), SpriteInfo::new("ride_swing_ride", 2, 0).with_offset(0.0, 100.0).with_scale(0.65));
            sprites.insert("ride_wave_swinger".to_string(), SpriteInfo::new("ride_wave_swinger", 2, 1).with_offset(0.0, 100.0).with_scale(0.68));
            sprites.insert("ride_flying_scooters".to_string(), SpriteInfo::new("ride_flying_scooters", 2, 2).with_offset(0.0, 70.0).with_scale(0.58));
            sprites.insert("ride_enterprise".to_string(), SpriteInfo::new("ride_enterprise", 2, 3).with_offset(0.0, 100.0).with_scale(0.68));
            sprites.insert("ride_loop_o_plane".to_string(), SpriteInfo::new("ride_loop_o_plane", 2, 4).with_offset(0.0, 70.0).with_scale(0.6));
            // Row 3: Thrill rides
            sprites.insert("ride_top_spin".to_string(), SpriteInfo::new("ride_top_spin", 3, 0).with_offset(0.0, 70.0).with_scale(0.6));
            sprites.insert("ride_frisbee".to_string(), SpriteInfo::new("ride_frisbee", 3, 1).with_offset(0.0, 80.0).with_scale(0.62));
            sprites.insert("ride_afterburner".to_string(), SpriteInfo::new("ride_afterburner", 3, 2).with_offset(0.0, 70.0).with_scale(0.6));
            sprites.insert("ride_inversion".to_string(), SpriteInfo::new("ride_inversion", 3, 3).with_offset(0.0, 70.0).with_scale(0.62));
            sprites.insert("ride_meteorite".to_string(), SpriteInfo::new("ride_meteorite", 3, 4).with_offset(0.0, 70.0).with_scale(0.6));
            // Row 4: Water/Transport
            sprites.insert("ride_log_flume".to_string(), SpriteInfo::new("ride_log_flume", 4, 0).with_offset(0.0, 100.0).with_scale(0.85));
            sprites.insert("ride_rapids".to_string(), SpriteInfo::new("ride_rapids", 4, 1).with_offset(0.0, 100.0).with_scale(0.85));
            sprites.insert("ride_train_station".to_string(), SpriteInfo::new("ride_train_station", 4, 2).with_offset(0.0, 80.0).with_scale(0.6));
            sprites.insert("ride_monorail_station".to_string(), SpriteInfo::new("ride_monorail_station", 4, 3).with_offset(0.0, 80.0).with_scale(0.6));
            sprites.insert("ride_chairlift".to_string(), SpriteInfo::new("ride_chairlift", 4, 4).with_offset(0.0, 70.0).with_scale(0.55));
            // Row 5: Shows
            sprites.insert("show_4d".to_string(), SpriteInfo::new("show_4d", 5, 0).with_offset(0.0, 100.0).with_scale(0.65));
            sprites.insert("show_stunt".to_string(), SpriteInfo::new("show_stunt", 5, 1).with_offset(0.0, 150.0).with_scale(0.58));
            sprites.insert("show_dolphin".to_string(), SpriteInfo::new("show_dolphin", 5, 2).with_offset(0.0, 215.0).with_scale(0.68));
            sprites.insert("show_amphitheater".to_string(), SpriteInfo::new("show_amphitheater", 5, 3).with_offset(0.0, 220.0).with_scale(0.7));
            sprites.insert("show_parade_float".to_string(), SpriteInfo::new("show_parade_float", 5, 4).with_offset(0.0, 70.0).with_scale(0.55));
        },
        "shops" => {
            // Row 0: Gift shops
            sprites.insert("shop_souvenir_1".to_string(), SpriteInfo::new("shop_souvenir_1", 0, 0).with_offset(0.0, -18.0).with_scale(0.8));
            sprites.insert("shop_souvenir_2".to_string(), SpriteInfo::new("shop_souvenir_2", 0, 1).with_offset(0.0, -18.0).with_scale(0.8));
            sprites.insert("shop_photo".to_string(), SpriteInfo::new("shop_photo", 0, 2).with_offset(0.0, -18.0).with_scale(0.78));
            sprites.insert("shop_ticket".to_string(), SpriteInfo::new("shop_ticket", 0, 3).with_offset(0.0, -16.0).with_scale(0.75));
            sprites.insert("shop_collectibles".to_string(), SpriteInfo::new("shop_collectibles", 0, 4).with_offset(0.0, -18.0).with_scale(0.8));
            // Row 1: Toy shops
            sprites.insert("shop_toys".to_string(), SpriteInfo::new("shop_toys", 1, 0).with_offset(0.0, -18.0).with_scale(0.8));
            sprites.insert("shop_plush".to_string(), SpriteInfo::new("shop_plush", 1, 1).with_offset(0.0, -18.0).with_scale(0.8));
            sprites.insert("shop_apparel".to_string(), SpriteInfo::new("shop_apparel", 1, 2).with_offset(0.0, -20.0).with_scale(0.82));
            sprites.insert("shop_bricks".to_string(), SpriteInfo::new("shop_bricks", 1, 3).with_offset(0.0, -18.0).with_scale(0.8));
            sprites.insert("shop_rc".to_string(), SpriteInfo::new("shop_rc", 1, 4).with_offset(0.0, -16.0).with_scale(0.78));
            // Row 2: Candy shops
            sprites.insert("shop_candy".to_string(), SpriteInfo::new("shop_candy", 2, 0).with_offset(0.0, -18.0).with_scale(0.8));
            sprites.insert("shop_fudge".to_string(), SpriteInfo::new("shop_fudge", 2, 1).with_offset(0.0, -16.0).with_scale(0.78));
            sprites.insert("shop_jewelry".to_string(), SpriteInfo::new("shop_jewelry", 2, 2).with_offset(0.0, -16.0).with_scale(0.78));
            sprites.insert("shop_popcorn".to_string(), SpriteInfo::new("shop_popcorn", 2, 3).with_offset(0.0, -16.0).with_scale(0.75));
            sprites.insert("shop_soda_fountain".to_string(), SpriteInfo::new("shop_soda_fountain", 2, 4).with_offset(0.0, -16.0).with_scale(0.78));
            // Row 3: Carnival games
            sprites.insert("game_ring_toss".to_string(), SpriteInfo::new("game_ring_toss", 3, 0).with_offset(0.0, -12.0).with_scale(0.68));
            sprites.insert("game_balloon".to_string(), SpriteInfo::new("game_balloon", 3, 1).with_offset(0.0, -12.0).with_scale(0.68));
            sprites.insert("game_shooting".to_string(), SpriteInfo::new("game_shooting", 3, 2).with_offset(0.0, -14.0).with_scale(0.7));
            sprites.insert("game_darts".to_string(), SpriteInfo::new("game_darts", 3, 3).with_offset(0.0, -12.0).with_scale(0.68));
            sprites.insert("game_basketball".to_string(), SpriteInfo::new("game_basketball", 3, 4).with_offset(0.0, -14.0).with_scale(0.72));
            // Row 4: Entertainment
            sprites.insert("arcade_building".to_string(), SpriteInfo::new("arcade_building", 4, 0).with_offset(0.0, -20.0).with_scale(0.82));
            sprites.insert("vr_experience".to_string(), SpriteInfo::new("vr_experience", 4, 1).with_offset(0.0, -18.0).with_scale(0.8));
            sprites.insert("photo_booth".to_string(), SpriteInfo::new("photo_booth", 4, 2).with_offset(0.0, -12.0).with_scale(0.68));
            sprites.insert("caricature".to_string(), SpriteInfo::new("caricature", 4, 3).with_offset(0.0, -12.0).with_scale(0.65));
            sprites.insert("face_paint".to_string(), SpriteInfo::new("face_paint", 4, 4).with_offset(0.0, -12.0).with_scale(0.65));
            // Row 5: Services
            sprites.insert("restroom".to_string(), SpriteInfo::new("restroom", 5, 0).with_offset(0.0, -18.0).with_scale(0.8));
            sprites.insert("first_aid".to_string(), SpriteInfo::new("first_aid", 5, 1).with_offset(0.0, -16.0).with_scale(0.78));
            sprites.insert("lockers".to_string(), SpriteInfo::new("lockers", 5, 2).with_offset(0.0, -16.0).with_scale(0.75));
            sprites.insert("stroller_rental".to_string(), SpriteInfo::new("stroller_rental", 5, 3).with_offset(0.0, -12.0).with_scale(0.68));
            sprites.insert("atm".to_string(), SpriteInfo::new("atm", 5, 4).with_offset(0.0, -8.0).with_scale(0.55));
        },
        "fountains" => {
            // Row 0: Small
            for i in 0..5 {
                let name = format!("fountain_small_{}", i + 1);
                sprites.insert(name.clone(), SpriteInfo::new(&name, 0, i).with_offset(0.0, -10.0).with_scale(0.55));
            }
            // Row 1: Medium
            for i in 0..5 {
                let name = format!("fountain_medium_{}", i + 1);
                sprites.insert(name.clone(), SpriteInfo::new(&name, 1, i).with_offset(0.0, -15.0).with_scale(0.7));
            }
            // Row 2: Large
            for i in 0..5 {
                let name = format!("fountain_large_{}", i + 1);
                let (offset_x, scale) = if i == 3 { (-2.0, 0.52) } else { (0.0, 0.55) };
                sprites.insert(name.clone(), SpriteInfo::new(&name, 2, i).with_offset(offset_x, 70.0).with_scale(scale));
            }
            // Row 3: Ponds
            sprites.insert("pond_small".to_string(), SpriteInfo::new("pond_small", 3, 0).with_offset(0.0, -5.0).with_scale(0.55));
            sprites.insert("pond_medium".to_string(), SpriteInfo::new("pond_medium", 3, 1).with_offset(0.0, -5.0).with_scale(0.65));
            sprites.insert("pond_large".to_string(), SpriteInfo::new("pond_large", 3, 2).with_offset(0.0, 70.0).with_scale(0.5));
            sprites.insert("pond_koi".to_string(), SpriteInfo::new("pond_koi", 3, 3).with_offset(0.0, -5.0).with_scale(0.65));
            sprites.insert("pond_lily".to_string(), SpriteInfo::new("pond_lily", 3, 4).with_offset(0.0, -5.0).with_scale(0.6));
            // Row 4: Waterfalls & streams
            sprites.insert("waterfall_small".to_string(), SpriteInfo::new("waterfall_small", 4, 0).with_offset(0.0, -10.0).with_scale(0.6));
            sprites.insert("waterfall_medium".to_string(), SpriteInfo::new("waterfall_medium", 4, 1).with_offset(0.0, -12.0).with_scale(0.7));
            sprites.insert("waterfall_large".to_string(), SpriteInfo::new("waterfall_large", 4, 2).with_offset(0.0, -15.0).with_scale(0.8));
            sprites.insert("stream_section".to_string(), SpriteInfo::new("stream_section", 4, 3).with_offset(0.0, -5.0).with_scale(0.55));
            sprites.insert("rapids_section".to_string(), SpriteInfo::new("rapids_section", 4, 4).with_offset(0.0, -5.0).with_scale(0.6));
            // Row 5: Interactive water
            sprites.insert("splash_pad".to_string(), SpriteInfo::new("splash_pad", 5, 0).with_offset(0.0, -5.0).with_scale(0.6));
            sprites.insert("water_jets".to_string(), SpriteInfo::new("water_jets", 5, 1).with_offset(0.0, -8.0).with_scale(0.6));
            sprites.insert("mist_fountain".to_string(), SpriteInfo::new("mist_fountain", 5, 2).with_offset(0.0, -8.0).with_scale(0.6));
            sprites.insert("interactive_fountain".to_string(), SpriteInfo::new("interactive_fountain", 5, 3).with_offset(0.0, -10.0).with_scale(0.65));
            sprites.insert("dancing_fountain".to_string(), SpriteInfo::new("dancing_fountain", 5, 4).with_offset(0.0, 70.0).with_scale(0.5));
        },
        "path_furniture" => {
            // Row 0: Benches
            sprites.insert("bench_wooden".to_string(), SpriteInfo::new("bench_wooden", 0, 0).with_offset(0.0, -6.0).with_scale(0.45));
            sprites.insert("bench_metal".to_string(), SpriteInfo::new("bench_metal", 0, 1).with_offset(0.0, -6.0).with_scale(0.45));
            sprites.insert("bench_ornate".to_string(), SpriteInfo::new("bench_ornate", 0, 2).with_offset(0.0, -6.0).with_scale(0.45));
            sprites.insert("bench_modern".to_string(), SpriteInfo::new("bench_modern", 0, 3).with_offset(0.0, -6.0).with_scale(0.45));
            sprites.insert("bench_rustic".to_string(), SpriteInfo::new("bench_rustic", 0, 4).with_offset(0.0, -6.0).with_scale(0.45));
            // Row 1: Lamps
            sprites.insert("lamp_victorian".to_string(), SpriteInfo::new("lamp_victorian", 1, 0).with_offset(0.0, -12.0).with_scale(0.5));
            sprites.insert("lamp_modern".to_string(), SpriteInfo::new("lamp_modern", 1, 1).with_offset(0.0, -12.0).with_scale(0.5));
            sprites.insert("lamp_themed".to_string(), SpriteInfo::new("lamp_themed", 1, 2).with_offset(0.0, -12.0).with_scale(0.5));
            sprites.insert("lamp_double".to_string(), SpriteInfo::new("lamp_double", 1, 3).with_offset(0.0, -12.0).with_scale(0.52));
            sprites.insert(
                "lamp_pathway".to_string(),
                SpriteInfo::new("lamp_pathway", 1, 4)
                    .with_offset(0.0, -8.0)
                    .with_scale(0.45)
                    .with_crop(40, 30, 25, 0),
            );
            // Row 2: Trash
            sprites.insert("trash_can_basic".to_string(), SpriteInfo::new("trash_can_basic", 2, 0).with_offset(0.0, -6.0).with_scale(0.42));
            sprites.insert("trash_can_fancy".to_string(), SpriteInfo::new("trash_can_fancy", 2, 1).with_offset(0.0, -6.0).with_scale(0.42));
            sprites.insert("trash_can_themed".to_string(), SpriteInfo::new("trash_can_themed", 2, 2).with_offset(0.0, -6.0).with_scale(0.42));
            sprites.insert("recycling_bin".to_string(), SpriteInfo::new("recycling_bin", 2, 3).with_offset(0.0, -6.0).with_scale(0.45));
            sprites.insert("trash_compactor".to_string(), SpriteInfo::new("trash_compactor", 2, 4).with_offset(0.0, -8.0).with_scale(0.5));
            // Row 3: Planters
            sprites.insert("planter_large".to_string(), SpriteInfo::new("planter_large", 3, 0).with_offset(0.0, -10.0).with_scale(0.55));
            sprites.insert("planter_small".to_string(), SpriteInfo::new("planter_small", 3, 1).with_offset(0.0, -8.0).with_scale(0.5));
            sprites.insert("planter_hanging".to_string(), SpriteInfo::new("planter_hanging", 3, 2).with_offset(0.0, -10.0).with_scale(0.5));
            sprites.insert("planter_themed".to_string(), SpriteInfo::new("planter_themed", 3, 3).with_offset(0.0, -10.0).with_scale(0.55));
            sprites.insert("planter_tiered".to_string(), SpriteInfo::new("planter_tiered", 3, 4).with_offset(0.0, -12.0).with_scale(0.55));
            // Row 4: Signs
            sprites.insert("sign_directional".to_string(), SpriteInfo::new("sign_directional", 4, 0).with_offset(0.0, -10.0).with_scale(0.5));
            sprites.insert("sign_ride".to_string(), SpriteInfo::new("sign_ride", 4, 1).with_offset(0.0, -10.0).with_scale(0.5));
            sprites.insert("sign_info".to_string(), SpriteInfo::new("sign_info", 4, 2).with_offset(0.0, -8.0).with_scale(0.48));
            sprites.insert("sign_welcome".to_string(), SpriteInfo::new("sign_welcome", 4, 3).with_offset(-4.0, -12.0).with_scale(0.55));
            sprites.insert("sign_sponsored".to_string(), SpriteInfo::new("sign_sponsored", 4, 4).with_offset(0.0, -10.0).with_scale(0.5));
            // Row 5: Path decorations
            sprites.insert("path_bollard".to_string(), SpriteInfo::new("path_bollard", 5, 0).with_offset(0.0, -5.0).with_scale(0.4));
            sprites.insert("path_chain".to_string(), SpriteInfo::new("path_chain", 5, 1).with_offset(0.0, -5.0).with_scale(0.45));
            sprites.insert("path_railing".to_string(), SpriteInfo::new("path_railing", 5, 2).with_offset(0.0, -5.0).with_scale(0.45));
            sprites.insert("path_archway".to_string(), SpriteInfo::new("path_archway", 5, 3).with_offset(-3.0, -15.0).with_scale(0.6));
            sprites.insert("path_gate".to_string(), SpriteInfo::new("path_gate", 5, 4).with_offset(0.0, -10.0).with_scale(0.55));
        },
        "infrastructure" => {
            // Row 0: Entrances
            sprites.insert("infra_main_entrance".to_string(), SpriteInfo::new("infra_main_entrance", 0, 0).with_offset(-8.0, -22.0).with_scale(0.82));
            sprites.insert("infra_themed_entrance".to_string(), SpriteInfo::new("infra_themed_entrance", 0, 1).with_offset(-6.0, -24.0).with_scale(0.84));
            sprites.insert("infra_vip_entrance".to_string(), SpriteInfo::new("infra_vip_entrance", 0, 2).with_offset(-5.0, -22.0).with_scale(0.8));
            sprites.insert("infra_exit_gate".to_string(), SpriteInfo::new("infra_exit_gate", 0, 3).with_offset(0.0, -22.0).with_scale(0.78));
            sprites.insert("infra_turnstile".to_string(), SpriteInfo::new("infra_turnstile", 0, 4).with_offset(0.0, -12.0).with_scale(0.6));
            // Row 1: Admin
            sprites.insert("infra_office".to_string(), SpriteInfo::new("infra_office", 1, 0).with_offset(-6.0, -14.0).with_scale(0.72));
            sprites.insert("infra_maintenance".to_string(), SpriteInfo::new("infra_maintenance", 1, 1).with_offset(0.0, -20.0).with_scale(0.78));
            sprites.insert("infra_warehouse".to_string(), SpriteInfo::new("infra_warehouse", 1, 2).with_offset(0.0, -22.0).with_scale(0.82));
            sprites.insert("infra_security".to_string(), SpriteInfo::new("infra_security", 1, 3).with_offset(0.0, -18.0).with_scale(0.75));
            sprites.insert("infra_break_room".to_string(), SpriteInfo::new("infra_break_room", 1, 4).with_offset(0.0, -18.0).with_scale(0.75));
            // Row 2: Guest services
            sprites.insert("infra_guest_relations".to_string(), SpriteInfo::new("infra_guest_relations", 2, 0).with_offset(0.0, -18.0).with_scale(0.78));
            sprites.insert("infra_lost_found".to_string(), SpriteInfo::new("infra_lost_found", 2, 1).with_offset(0.0, -16.0).with_scale(0.72));
            sprites.insert("infra_package_pickup".to_string(), SpriteInfo::new("infra_package_pickup", 2, 2).with_offset(0.0, -16.0).with_scale(0.72));
            sprites.insert("infra_ticket_booth".to_string(), SpriteInfo::new("infra_ticket_booth", 2, 3).with_offset(0.0, -14.0).with_scale(0.68));
            sprites.insert("infra_season_pass".to_string(), SpriteInfo::new("infra_season_pass", 2, 4).with_offset(0.0, -14.0).with_scale(0.68));
            // Row 3: Transport
            sprites.insert("infra_tram_stop".to_string(), SpriteInfo::new("infra_tram_stop", 3, 0).with_offset(0.0, -16.0).with_scale(0.7));
            sprites.insert("infra_bus_stop".to_string(), SpriteInfo::new("infra_bus_stop", 3, 1).with_offset(0.0, -14.0).with_scale(0.65));
            sprites.insert("infra_shuttle".to_string(), SpriteInfo::new("infra_shuttle", 3, 2).with_offset(0.0, -10.0).with_scale(0.6));
            sprites.insert("infra_golf_cart".to_string(), SpriteInfo::new("infra_golf_cart", 3, 3).with_offset(0.0, -8.0).with_scale(0.55));
            sprites.insert("infra_utility_vehicle".to_string(), SpriteInfo::new("infra_utility_vehicle", 3, 4).with_offset(0.0, -10.0).with_scale(0.58));
            // Row 4: Utilities
            sprites.insert("infra_generator".to_string(), SpriteInfo::new("infra_generator", 4, 0).with_offset(0.0, -12.0).with_scale(0.6));
            sprites.insert("infra_dumpster".to_string(), SpriteInfo::new("infra_dumpster", 4, 1).with_offset(0.0, -10.0).with_scale(0.55));
            sprites.insert("infra_loading_dock".to_string(), SpriteInfo::new("infra_loading_dock", 4, 2).with_offset(0.0, -14.0).with_scale(0.68));
            sprites.insert("infra_container".to_string(), SpriteInfo::new("infra_container", 4, 3).with_offset(0.0, -12.0).with_scale(0.62));
            sprites.insert("infra_utility_box".to_string(), SpriteInfo::new("infra_utility_box", 4, 4).with_offset(0.0, -6.0).with_scale(0.48));
            // Row 5: Safety
            sprites.insert("infra_first_aid_station".to_string(), SpriteInfo::new("infra_first_aid_station", 5, 0).with_offset(0.0, -14.0).with_scale(0.65));
            sprites.insert("infra_defibrillator".to_string(), SpriteInfo::new("infra_defibrillator", 5, 1).with_offset(0.0, -6.0).with_scale(0.45));
            sprites.insert("infra_fire_extinguisher".to_string(), SpriteInfo::new("infra_fire_extinguisher", 5, 2).with_offset(0.0, -6.0).with_scale(0.42));
            sprites.insert("infra_emergency_phone".to_string(), SpriteInfo::new("infra_emergency_phone", 5, 3).with_offset(0.0, -8.0).with_scale(0.48));
            sprites.insert("infra_evacuation".to_string(), SpriteInfo::new("infra_evacuation", 5, 4).with_offset(0.0, -10.0).with_scale(0.52));
        },
        "theme_classic" => {
            // Row 0: Medieval/Fantasy
            sprites.insert("theme_castle_tower".to_string(), SpriteInfo::new("theme_castle_tower", 0, 0).with_offset(0.0, -25.0).with_scale(0.8));
            sprites.insert("theme_castle_wall".to_string(), SpriteInfo::new("theme_castle_wall", 0, 1).with_offset(0.0, -18.0).with_scale(0.75));
            sprites.insert("theme_drawbridge".to_string(), SpriteInfo::new("theme_drawbridge", 0, 2).with_offset(0.0, -20.0).with_scale(0.78));
            sprites.insert("theme_knight_statue".to_string(), SpriteInfo::new("theme_knight_statue", 0, 3).with_offset(0.0, -15.0).with_scale(0.6));
            sprites.insert("theme_dragon_statue".to_string(), SpriteInfo::new("theme_dragon_statue", 0, 4).with_offset(0.0, -20.0).with_scale(0.7));
            // Row 1: Pirate
            sprites.insert("theme_pirate_ship".to_string(), SpriteInfo::new("theme_pirate_ship", 1, 0).with_offset(0.0, -22.0).with_scale(0.8));
            sprites.insert("theme_treasure_chest".to_string(), SpriteInfo::new("theme_treasure_chest", 1, 1).with_offset(0.0, -8.0).with_scale(0.5));
            sprites.insert("theme_skull_rock".to_string(), SpriteInfo::new("theme_skull_rock", 1, 2).with_offset(0.0, -18.0).with_scale(0.7));
            sprites.insert("theme_cannon".to_string(), SpriteInfo::new("theme_cannon", 1, 3).with_offset(0.0, -10.0).with_scale(0.55));
            sprites.insert("theme_anchor".to_string(), SpriteInfo::new("theme_anchor", 1, 4).with_offset(0.0, -10.0).with_scale(0.55));
            // Row 2: Old West
            sprites.insert("theme_saloon".to_string(), SpriteInfo::new("theme_saloon", 2, 0).with_offset(0.0, -20.0).with_scale(0.78));
            sprites.insert("theme_water_tower".to_string(), SpriteInfo::new("theme_water_tower", 2, 1).with_offset(0.0, -22.0).with_scale(0.8));
            sprites.insert("theme_wagon_wheel".to_string(), SpriteInfo::new("theme_wagon_wheel", 2, 2).with_offset(0.0, -8.0).with_scale(0.5));
            sprites.insert("theme_cactus".to_string(), SpriteInfo::new("theme_cactus", 2, 3).with_offset(0.0, -10.0).with_scale(0.55));
            sprites.insert("theme_windmill".to_string(), SpriteInfo::new("theme_windmill", 2, 4).with_offset(0.0, -22.0).with_scale(0.8));
            // Row 3: Jungle/Safari
            sprites.insert("theme_temple_ruins".to_string(), SpriteInfo::new("theme_temple_ruins", 3, 0).with_offset(0.0, -22.0).with_scale(0.8));
            sprites.insert("theme_tiki_statue".to_string(), SpriteInfo::new("theme_tiki_statue", 3, 1).with_offset(0.0, -12.0).with_scale(0.6));
            sprites.insert("theme_safari_jeep".to_string(), SpriteInfo::new("theme_safari_jeep", 3, 2).with_offset(0.0, -10.0).with_scale(0.6));
            sprites.insert("theme_elephant_statue".to_string(), SpriteInfo::new("theme_elephant_statue", 3, 3).with_offset(0.0, -18.0).with_scale(0.7));
            sprites.insert("theme_bamboo_hut".to_string(), SpriteInfo::new("theme_bamboo_hut", 3, 4).with_offset(0.0, -15.0).with_scale(0.68));
            // Row 4: Space/Sci-Fi
            sprites.insert("theme_rocket_ship".to_string(), SpriteInfo::new("theme_rocket_ship", 4, 0).with_offset(0.0, -25.0).with_scale(0.8));
            sprites.insert("theme_ufo".to_string(), SpriteInfo::new("theme_ufo", 4, 1).with_offset(0.0, -15.0).with_scale(0.7));
            sprites.insert("theme_robot_statue".to_string(), SpriteInfo::new("theme_robot_statue", 4, 2).with_offset(0.0, -18.0).with_scale(0.68));
            sprites.insert("theme_portal".to_string(), SpriteInfo::new("theme_portal", 4, 3).with_offset(0.0, -18.0).with_scale(0.72));
            sprites.insert("theme_satellite".to_string(), SpriteInfo::new("theme_satellite", 4, 4).with_offset(0.0, -15.0).with_scale(0.65));
            // Row 5: Underwater/Ocean
            sprites.insert("theme_coral_reef".to_string(), SpriteInfo::new("theme_coral_reef", 5, 0).with_offset(0.0, -8.0).with_scale(0.55));
            sprites.insert("theme_submarine".to_string(), SpriteInfo::new("theme_submarine", 5, 1).with_offset(0.0, -15.0).with_scale(0.7));
            sprites.insert("theme_diving_helmet".to_string(), SpriteInfo::new("theme_diving_helmet", 5, 2).with_offset(0.0, -10.0).with_scale(0.58));
            sprites.insert("theme_treasure".to_string(), SpriteInfo::new("theme_treasure", 5, 3).with_offset(0.0, -8.0).with_scale(0.52));
            sprites.insert("theme_seashell".to_string(), SpriteInfo::new("theme_seashell", 5, 4).with_offset(0.0, -6.0).with_scale(0.48));
        },
        "theme_modern" => {
            // Row 0: Halloween
            sprites.insert("theme_haunted_tree".to_string(), SpriteInfo::new("theme_haunted_tree", 0, 0).with_offset(0.0, -18.0).with_scale(0.68));
            sprites.insert("theme_gravestone".to_string(), SpriteInfo::new("theme_gravestone", 0, 1).with_offset(0.0, -8.0).with_scale(0.5));
            sprites.insert("theme_pumpkin".to_string(), SpriteInfo::new("theme_pumpkin", 0, 2).with_offset(0.0, -6.0).with_scale(0.48));
            sprites.insert("theme_witch_cauldron".to_string(), SpriteInfo::new("theme_witch_cauldron", 0, 3).with_offset(0.0, -10.0).with_scale(0.55));
            sprites.insert("theme_skeleton".to_string(), SpriteInfo::new("theme_skeleton", 0, 4).with_offset(0.0, -15.0).with_scale(0.6));
            // Row 1: Christmas/Winter
            sprites.insert("theme_christmas_tree".to_string(), SpriteInfo::new("theme_christmas_tree", 1, 0).with_offset(0.0, -20.0).with_scale(0.7));
            sprites.insert("theme_snowman".to_string(), SpriteInfo::new("theme_snowman", 1, 1).with_offset(0.0, -12.0).with_scale(0.58));
            sprites.insert("theme_presents".to_string(), SpriteInfo::new("theme_presents", 1, 2).with_offset(0.0, -6.0).with_scale(0.48));
            sprites.insert("theme_candy_cane".to_string(), SpriteInfo::new("theme_candy_cane", 1, 3).with_offset(0.0, -12.0).with_scale(0.55));
            sprites.insert("theme_ice_sculpture".to_string(), SpriteInfo::new("theme_ice_sculpture", 1, 4).with_offset(0.0, -15.0).with_scale(0.65));
            // Row 2: Spring/Easter
            sprites.insert("theme_giant_egg".to_string(), SpriteInfo::new("theme_giant_egg", 2, 0).with_offset(0.0, -12.0).with_scale(0.58));
            sprites.insert("theme_bunny_statue".to_string(), SpriteInfo::new("theme_bunny_statue", 2, 1).with_offset(0.0, -12.0).with_scale(0.58));
            sprites.insert("theme_flower_arch".to_string(), SpriteInfo::new("theme_flower_arch", 2, 2).with_offset(0.0, -18.0).with_scale(0.72));
            sprites.insert("theme_butterfly".to_string(), SpriteInfo::new("theme_butterfly", 2, 3).with_offset(0.0, -10.0).with_scale(0.52));
            sprites.insert("theme_bird_bath".to_string(), SpriteInfo::new("theme_bird_bath", 2, 4).with_offset(0.0, -10.0).with_scale(0.55));
            // Row 3: Circus/Carnival
            sprites.insert("theme_circus_tent".to_string(), SpriteInfo::new("theme_circus_tent", 3, 0).with_offset(0.0, -25.0).with_scale(0.82));
            sprites.insert("theme_strongman".to_string(), SpriteInfo::new("theme_strongman", 3, 1).with_offset(0.0, -12.0).with_scale(0.58));
            sprites.insert("theme_clown_statue".to_string(), SpriteInfo::new("theme_clown_statue", 3, 2).with_offset(0.0, -12.0).with_scale(0.58));
            sprites.insert("theme_balloon_arch".to_string(), SpriteInfo::new("theme_balloon_arch", 3, 3).with_offset(0.0, -18.0).with_scale(0.72));
            sprites.insert("theme_carnival_banner".to_string(), SpriteInfo::new("theme_carnival_banner", 3, 4).with_offset(0.0, -15.0).with_scale(0.65));
            // Row 4: Sports
            sprites.insert("theme_trophy".to_string(), SpriteInfo::new("theme_trophy", 4, 0).with_offset(0.0, -12.0).with_scale(0.55));
            sprites.insert("theme_mascot".to_string(), SpriteInfo::new("theme_mascot", 4, 1).with_offset(0.0, -15.0).with_scale(0.62));
            sprites.insert("theme_scoreboard".to_string(), SpriteInfo::new("theme_scoreboard", 4, 2).with_offset(0.0, -18.0).with_scale(0.72));
            sprites.insert("theme_goal_post".to_string(), SpriteInfo::new("theme_goal_post", 4, 3).with_offset(0.0, -18.0).with_scale(0.7));
            sprites.insert("theme_checkered_flag".to_string(), SpriteInfo::new("theme_checkered_flag", 4, 4).with_offset(3.0, -12.0).with_scale(0.55));
            // Row 5: Modern art
            sprites.insert("theme_geometric".to_string(), SpriteInfo::new("theme_geometric", 5, 0).with_offset(0.0, -15.0).with_scale(0.65));
            sprites.insert("theme_water_wall".to_string(), SpriteInfo::new("theme_water_wall", 5, 1).with_offset(0.0, -18.0).with_scale(0.72));
            sprites.insert("theme_led_cube".to_string(), SpriteInfo::new("theme_led_cube", 5, 2).with_offset(0.0, -15.0).with_scale(0.65));
            sprites.insert("theme_mirror_ball".to_string(), SpriteInfo::new("theme_mirror_ball", 5, 3).with_offset(0.0, -12.0).with_scale(0.6));
            sprites.insert("theme_kinetic".to_string(), SpriteInfo::new("theme_kinetic", 5, 4).with_offset(0.0, -18.0).with_scale(0.68));
        },
        "queue_elements" => {
            // Row 0: Barriers
            sprites.insert("queue_post_metal".to_string(), SpriteInfo::new("queue_post_metal", 0, 0).with_offset(0.0, -8.0).with_scale(0.42));
            sprites.insert("queue_rope".to_string(), SpriteInfo::new("queue_rope", 0, 1).with_offset(0.0, -6.0).with_scale(0.45));
            sprites.insert("queue_chain".to_string(), SpriteInfo::new("queue_chain", 0, 2).with_offset(0.0, -6.0).with_scale(0.45));
            sprites.insert("queue_retractable".to_string(), SpriteInfo::new("queue_retractable", 0, 3).with_offset(0.0, -8.0).with_scale(0.45));
            sprites.insert("queue_fence".to_string(), SpriteInfo::new("queue_fence", 0, 4).with_offset(0.0, -8.0).with_scale(0.48));
            // Row 1: Queue covers
            sprites.insert("queue_canopy".to_string(), SpriteInfo::new("queue_canopy", 1, 0).with_offset(0.0, -15.0).with_scale(0.68));
            sprites.insert("queue_pergola".to_string(), SpriteInfo::new("queue_pergola", 1, 1).with_offset(0.0, -15.0).with_scale(0.68));
            sprites.insert("queue_tunnel".to_string(), SpriteInfo::new("queue_tunnel", 1, 2).with_offset(0.0, -18.0).with_scale(0.72));
            sprites.insert("queue_covered".to_string(), SpriteInfo::new("queue_covered", 1, 3).with_offset(0.0, -15.0).with_scale(0.68));
            sprites.insert("queue_mister".to_string(), SpriteInfo::new("queue_mister", 1, 4).with_offset(0.0, -12.0).with_scale(0.6));
            // Row 2: Queue entertainment
            sprites.insert("queue_tv".to_string(), SpriteInfo::new("queue_tv", 2, 0).with_offset(0.0, -10.0).with_scale(0.55));
            sprites.insert("queue_game".to_string(), SpriteInfo::new("queue_game", 2, 1).with_offset(0.0, -12.0).with_scale(0.6));
            sprites.insert("queue_prop".to_string(), SpriteInfo::new("queue_prop", 2, 2).with_offset(0.0, -12.0).with_scale(0.58));
            sprites.insert("queue_animatronic".to_string(), SpriteInfo::new("queue_animatronic", 2, 3).with_offset(0.0, -15.0).with_scale(0.65));
            sprites.insert("queue_photo_op".to_string(), SpriteInfo::new("queue_photo_op", 2, 4).with_offset(0.0, -15.0).with_scale(0.68));
            // Row 3: Themed queue
            sprites.insert("queue_cave".to_string(), SpriteInfo::new("queue_cave", 3, 0).with_offset(0.0, -18.0).with_scale(0.72));
            sprites.insert("queue_jungle".to_string(), SpriteInfo::new("queue_jungle", 3, 1).with_offset(0.0, -18.0).with_scale(0.7));
            sprites.insert("queue_space".to_string(), SpriteInfo::new("queue_space", 3, 2).with_offset(0.0, -18.0).with_scale(0.72));
            sprites.insert("queue_castle".to_string(), SpriteInfo::new("queue_castle", 3, 3).with_offset(0.0, -20.0).with_scale(0.75));
            sprites.insert("queue_industrial".to_string(), SpriteInfo::new("queue_industrial", 3, 4).with_offset(0.0, -18.0).with_scale(0.7));
            // Row 4: Queue signage
            sprites.insert("queue_wait_sign".to_string(), SpriteInfo::new("queue_wait_sign", 4, 0).with_offset(0.0, -10.0).with_scale(0.5));
            sprites.insert("queue_height".to_string(), SpriteInfo::new("queue_height", 4, 1).with_offset(0.0, -10.0).with_scale(0.5));
            sprites.insert("queue_rules".to_string(), SpriteInfo::new("queue_rules", 4, 2).with_offset(0.0, -10.0).with_scale(0.5));
            sprites.insert("queue_logo".to_string(), SpriteInfo::new("queue_logo", 4, 3).with_offset(0.0, -10.0).with_scale(0.52));
            sprites.insert("queue_sponsor".to_string(), SpriteInfo::new("queue_sponsor", 4, 4).with_offset(0.0, -10.0).with_scale(0.52));
            // Row 5: Queue amenities
            sprites.insert("queue_fountain".to_string(), SpriteInfo::new("queue_fountain", 5, 0).with_offset(0.0, -8.0).with_scale(0.48));
            sprites.insert("queue_sanitizer".to_string(), SpriteInfo::new("queue_sanitizer", 5, 1).with_offset(0.0, -6.0).with_scale(0.42));
            sprites.insert("queue_charger".to_string(), SpriteInfo::new("queue_charger", 5, 2).with_offset(0.0, -6.0).with_scale(0.42));
            sprites.insert("queue_umbrella".to_string(), SpriteInfo::new("queue_umbrella", 5, 3).with_offset(0.0, -10.0).with_scale(0.5));
            sprites.insert("queue_cooling".to_string(), SpriteInfo::new("queue_cooling", 5, 4).with_offset(0.0, -10.0).with_scale(0.52));
        },
        _ => {}
    }
    
    sprites
}
