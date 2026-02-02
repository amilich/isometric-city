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
            // Row 1: Evergreen
            sprites.insert("tree_pine".to_string(), SpriteInfo::new("tree_pine", 1, 0).with_offset(0.0, -20.0).with_scale(0.65));
            sprites.insert("tree_spruce".to_string(), SpriteInfo::new("tree_spruce", 1, 1).with_offset(0.0, -20.0).with_scale(0.65));
            sprites.insert("tree_fir".to_string(), SpriteInfo::new("tree_fir", 1, 2).with_offset(0.0, -20.0).with_scale(0.65));
            sprites.insert("tree_cedar".to_string(), SpriteInfo::new("tree_cedar", 1, 3).with_offset(0.0, -20.0).with_scale(0.65));
            sprites.insert("tree_redwood".to_string(), SpriteInfo::new("tree_redwood", 1, 4).with_offset(0.0, -22.0).with_scale(0.7));
            // Row 2: Tropical
            sprites.insert("tree_palm".to_string(), SpriteInfo::new("tree_palm", 2, 0).with_offset(0.0, -20.0).with_scale(0.65));
            sprites.insert("tree_banana".to_string(), SpriteInfo::new("tree_banana", 2, 1).with_offset(0.0, -18.0).with_scale(0.6));
            sprites.insert("tree_bamboo".to_string(), SpriteInfo::new("tree_bamboo", 2, 2).with_offset(0.0, -18.0).with_scale(0.55));
            sprites.insert("tree_coconut".to_string(), SpriteInfo::new("tree_coconut", 2, 3).with_offset(0.0, -20.0).with_scale(0.65));
            sprites.insert("tree_tropical".to_string(), SpriteInfo::new("tree_tropical", 2, 4).with_offset(0.0, -18.0).with_scale(0.6));
            // Row 3: Flowering
            sprites.insert("tree_cherry".to_string(), SpriteInfo::new("tree_cherry", 3, 0).with_offset(0.0, -16.0).with_scale(0.6));
            sprites.insert("tree_magnolia".to_string(), SpriteInfo::new("tree_magnolia", 3, 1).with_offset(0.0, -16.0).with_scale(0.6));
            sprites.insert("tree_dogwood".to_string(), SpriteInfo::new("tree_dogwood", 3, 2).with_offset(0.0, -16.0).with_scale(0.55));
            sprites.insert("tree_jacaranda".to_string(), SpriteInfo::new("tree_jacaranda", 3, 3).with_offset(0.0, -16.0).with_scale(0.6));
            sprites.insert("tree_wisteria".to_string(), SpriteInfo::new("tree_wisteria", 3, 4).with_offset(0.0, -16.0).with_scale(0.6));
            // Row 4: Bushes
            sprites.insert("bush_hedge".to_string(), SpriteInfo::new("bush_hedge", 4, 0).with_offset(0.0, -12.0).with_scale(0.68));
            sprites.insert("bush_flowering".to_string(), SpriteInfo::new("bush_flowering", 4, 1).with_offset(0.0, -12.0).with_scale(0.68));
            sprites.insert("topiary_ball".to_string(), SpriteInfo::new("topiary_ball", 4, 2).with_offset(0.0, -8.0).with_scale(0.45));
            sprites.insert("topiary_spiral".to_string(), SpriteInfo::new("topiary_spiral", 4, 3).with_offset(0.0, -10.0).with_scale(0.5));
            sprites.insert("topiary_animal".to_string(), SpriteInfo::new("topiary_animal", 4, 4).with_offset(0.0, -10.0).with_scale(0.5));
            // Row 5: Flowers
            sprites.insert("flowers_bed".to_string(), SpriteInfo::new("flowers_bed", 5, 0).with_offset(0.0, -8.0).with_scale(0.6));
            sprites.insert("flowers_planter".to_string(), SpriteInfo::new("flowers_planter", 5, 1).with_offset(0.0, -12.0).with_scale(0.68));
            sprites.insert("flowers_hanging".to_string(), SpriteInfo::new("flowers_hanging", 5, 2).with_offset(0.0, -15.0).with_scale(0.68));
            sprites.insert("flowers_wild".to_string(), SpriteInfo::new("flowers_wild", 5, 3).with_offset(0.0, -8.0).with_scale(0.6));
            sprites.insert("ground_cover".to_string(), SpriteInfo::new("ground_cover", 5, 4).with_offset(0.0, -3.0).with_scale(0.4));
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
                sprites.insert(name.clone(), SpriteInfo::new(&name, 2, i).with_offset(0.0, -30.0).with_scale(0.9));
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
            sprites.insert("ride_bumper_cars".to_string(), SpriteInfo::new("ride_bumper_cars", 3, 0).with_offset(0.0, 80.0).with_scale(0.6));
        },
        "rides_large" => {
            // Row 0: Ferris
            sprites.insert("ride_ferris_classic".to_string(), SpriteInfo::new("ride_ferris_classic", 0, 0).with_offset(0.0, 110.0).with_scale(0.95));
            sprites.insert("ride_ferris_modern".to_string(), SpriteInfo::new("ride_ferris_modern", 0, 1).with_offset(0.0, 110.0).with_scale(0.95));
            sprites.insert("ride_ferris_observation".to_string(), SpriteInfo::new("ride_ferris_observation", 0, 2).with_offset(0.0, 190.0).with_scale(1.0));
            // Row 1: Drop
            sprites.insert("ride_drop_tower".to_string(), SpriteInfo::new("ride_drop_tower", 1, 0).with_offset(0.0, 55.0).with_scale(0.65));
            sprites.insert("ride_space_shot".to_string(), SpriteInfo::new("ride_space_shot", 1, 1).with_offset(0.0, 55.0).with_scale(0.67));
            sprites.insert("ride_observation_tower".to_string(), SpriteInfo::new("ride_observation_tower", 1, 2).with_offset(0.0, 55.0).with_scale(0.67));
            // Row 4: Water/Transport
            sprites.insert("ride_log_flume".to_string(), SpriteInfo::new("ride_log_flume", 4, 0).with_offset(0.0, 100.0).with_scale(0.85));
            sprites.insert("ride_rapids".to_string(), SpriteInfo::new("ride_rapids", 4, 1).with_offset(0.0, 100.0).with_scale(0.85));
        },
        "shops" => {
            // Row 0: Gift shops
            sprites.insert("shop_souvenir_1".to_string(), SpriteInfo::new("shop_souvenir_1", 0, 0).with_offset(0.0, -18.0).with_scale(0.8));
            sprites.insert("shop_photo".to_string(), SpriteInfo::new("shop_photo", 0, 2).with_offset(0.0, -18.0).with_scale(0.78));
            sprites.insert("shop_ticket".to_string(), SpriteInfo::new("shop_ticket", 0, 3).with_offset(0.0, -16.0).with_scale(0.75));
            // Row 1: Toy shops
            sprites.insert("shop_toys".to_string(), SpriteInfo::new("shop_toys", 1, 0).with_offset(0.0, -18.0).with_scale(0.8));
            sprites.insert("shop_plush".to_string(), SpriteInfo::new("shop_plush", 1, 1).with_offset(0.0, -18.0).with_scale(0.8));
            // Row 5: Services
            sprites.insert("restroom".to_string(), SpriteInfo::new("restroom", 5, 0).with_offset(0.0, -18.0).with_scale(0.8));
            sprites.insert("first_aid".to_string(), SpriteInfo::new("first_aid", 5, 1).with_offset(0.0, -16.0).with_scale(0.78));
            sprites.insert("lockers".to_string(), SpriteInfo::new("lockers", 5, 2).with_offset(0.0, -16.0).with_scale(0.75));
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
                sprites.insert(name.clone(), SpriteInfo::new(&name, 2, i).with_offset(0.0, 70.0).with_scale(0.55));
            }
        },
        "path_furniture" => {
            // Row 0: Benches
            sprites.insert("bench_wooden".to_string(), SpriteInfo::new("bench_wooden", 0, 0).with_offset(0.0, -6.0).with_scale(0.45));
            sprites.insert("bench_metal".to_string(), SpriteInfo::new("bench_metal", 0, 1).with_offset(0.0, -6.0).with_scale(0.45));
            sprites.insert("bench_ornate".to_string(), SpriteInfo::new("bench_ornate", 0, 2).with_offset(0.0, -6.0).with_scale(0.45));
            // Row 1: Lamps
            sprites.insert("lamp_victorian".to_string(), SpriteInfo::new("lamp_victorian", 1, 0).with_offset(0.0, -12.0).with_scale(0.5));
            sprites.insert("lamp_modern".to_string(), SpriteInfo::new("lamp_modern", 1, 1).with_offset(0.0, -12.0).with_scale(0.5));
            // Row 2: Trash
            sprites.insert("trash_can_basic".to_string(), SpriteInfo::new("trash_can_basic", 2, 0).with_offset(0.0, -6.0).with_scale(0.42));
            sprites.insert("trash_can_fancy".to_string(), SpriteInfo::new("trash_can_fancy", 2, 1).with_offset(0.0, -6.0).with_scale(0.42));
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
        },
        _ => {}
    }
    
    sprites
}
