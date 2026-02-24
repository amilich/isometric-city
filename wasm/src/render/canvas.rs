//! Canvas rendering wrapper

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};

use super::isometric::{TILE_WIDTH, TILE_HEIGHT};

/// Wrapper around the 2D canvas context
pub struct Canvas {
    ctx: CanvasRenderingContext2d,
    canvas: HtmlCanvasElement,
    width: u32,
    height: u32,
}

impl Canvas {
    /// Create a new canvas wrapper
    pub fn new(canvas: HtmlCanvasElement) -> Result<Self, JsValue> {
        let ctx = canvas
            .get_context("2d")?
            .ok_or("Failed to get 2d context")?
            .dyn_into::<CanvasRenderingContext2d>()?;
        
        let width = canvas.width();
        let height = canvas.height();
        
        // Disable image smoothing for crisp pixel art
        ctx.set_image_smoothing_enabled(false);
        
        Ok(Canvas {
            ctx,
            canvas,
            width,
            height,
        })
    }
    
    /// Get canvas width
    pub fn width(&self) -> u32 {
        self.width
    }
    
    /// Get canvas height
    pub fn height(&self) -> u32 {
        self.height
    }
    
    /// Get the raw context
    pub fn ctx(&self) -> &CanvasRenderingContext2d {
        &self.ctx
    }
    
    /// Resize canvas
    pub fn resize(&mut self, width: u32, height: u32) {
        self.canvas.set_width(width);
        self.canvas.set_height(height);
        self.width = width;
        self.height = height;
        self.ctx.set_image_smoothing_enabled(false);
    }
    
    /// Clear the canvas
    pub fn clear(&self) {
        self.ctx.clear_rect(0.0, 0.0, self.width as f64, self.height as f64);
    }
    
    /// Save canvas state
    pub fn save(&self) {
        self.ctx.save();
    }
    
    /// Restore canvas state
    pub fn restore(&self) {
        self.ctx.restore();
    }
    
    /// Scale canvas
    pub fn scale(&self, x: f64, y: f64) -> Result<(), JsValue> {
        self.ctx.scale(x, y)
    }
    
    /// Set fill color
    pub fn set_fill_color(&self, color: &str) {
        self.ctx.set_fill_style_str(color);
    }
    
    /// Set stroke color
    pub fn set_stroke_color(&self, color: &str) {
        self.ctx.set_stroke_style_str(color);
    }
    
    /// Set line width
    pub fn set_line_width(&self, width: f64) {
        self.ctx.set_line_width(width);
    }
    
    /// Set global alpha
    pub fn set_alpha(&self, alpha: f64) {
        self.ctx.set_global_alpha(alpha);
    }
    
    /// Fill rectangle
    pub fn fill_rect(&self, x: f64, y: f64, w: f64, h: f64) {
        self.ctx.fill_rect(x, y, w, h);
    }
    
    /// Stroke rectangle
    pub fn stroke_rect(&self, x: f64, y: f64, w: f64, h: f64) {
        self.ctx.stroke_rect(x, y, w, h);
    }
    
    /// Begin path
    pub fn begin_path(&self) {
        self.ctx.begin_path();
    }
    
    /// Move to point
    pub fn move_to(&self, x: f64, y: f64) {
        self.ctx.move_to(x, y);
    }
    
    /// Line to point
    pub fn line_to(&self, x: f64, y: f64) {
        self.ctx.line_to(x, y);
    }
    
    /// Close path
    pub fn close_path(&self) {
        self.ctx.close_path();
    }
    
    /// Fill current path
    pub fn fill(&self) {
        self.ctx.fill();
    }
    
    /// Stroke current path
    pub fn stroke(&self) {
        self.ctx.stroke();
    }
    
    /// Draw arc
    pub fn arc(&self, x: f64, y: f64, radius: f64, start_angle: f64, end_angle: f64) -> Result<(), JsValue> {
        self.ctx.arc(x, y, radius, start_angle, end_angle)
    }
    
    /// Draw ellipse
    pub fn ellipse(&self, x: f64, y: f64, rx: f64, ry: f64, rotation: f64, start: f64, end: f64) -> Result<(), JsValue> {
        self.ctx.ellipse(x, y, rx, ry, rotation, start, end)
    }
    
    /// Draw isometric diamond tile
    pub fn draw_isometric_tile(&self, x: f64, y: f64) {
        let w = TILE_WIDTH;
        let h = TILE_HEIGHT;
        
        self.begin_path();
        self.move_to(x + w / 2.0, y);
        self.line_to(x + w, y + h / 2.0);
        self.line_to(x + w / 2.0, y + h);
        self.line_to(x, y + h / 2.0);
        self.close_path();
    }
    
    /// Draw isometric tile with fill color
    pub fn fill_isometric_tile(&self, x: f64, y: f64, color: &str) {
        self.set_fill_color(color);
        self.draw_isometric_tile(x, y);
        self.fill();
    }
    
    /// Draw isometric tile with stroke
    pub fn stroke_isometric_tile(&self, x: f64, y: f64, color: &str, width: f64) {
        self.set_stroke_color(color);
        self.set_line_width(width);
        self.draw_isometric_tile(x, y);
        self.stroke();
    }
    
    /// Draw quadratic bezier curve
    pub fn quadratic_curve_to(&self, cpx: f64, cpy: f64, x: f64, y: f64) {
        self.ctx.quadratic_curve_to(cpx, cpy, x, y);
    }
    
    /// Draw bezier curve
    pub fn bezier_curve_to(&self, cp1x: f64, cp1y: f64, cp2x: f64, cp2y: f64, x: f64, y: f64) {
        self.ctx.bezier_curve_to(cp1x, cp1y, cp2x, cp2y, x, y);
    }
    
    /// Set text properties
    pub fn set_font(&self, font: &str) {
        self.ctx.set_font(font);
    }
    
    /// Fill text
    pub fn fill_text(&self, text: &str, x: f64, y: f64) -> Result<(), JsValue> {
        self.ctx.fill_text(text, x, y)
    }
    
    /// Clip to current path
    pub fn clip(&self) {
        self.ctx.clip();
    }
}
