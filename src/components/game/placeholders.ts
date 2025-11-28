// ============================================================================
// PLACEHOLDER BUILDING COLORS
// ============================================================================
// Colors for rendering buildings before sprites are loaded
// Based on zone/category for visual consistency

export interface PlaceholderColor {
  top: string;
  left: string;
  right: string;
  height: number;
}

export const PLACEHOLDER_COLORS: Record<string, PlaceholderColor> = {
  // Residential - greens
  house_small: { top: '#4ade80', left: '#22c55e', right: '#86efac', height: 0.6 },
  house_medium: { top: '#4ade80', left: '#22c55e', right: '#86efac', height: 0.8 },
  mansion: { top: '#22c55e', left: '#16a34a', right: '#4ade80', height: 1.0 },
  apartment_low: { top: '#22c55e', left: '#16a34a', right: '#4ade80', height: 1.2 },
  apartment_high: { top: '#16a34a', left: '#15803d', right: '#22c55e', height: 1.8 },
  // Commercial - blues
  shop_small: { top: '#60a5fa', left: '#3b82f6', right: '#93c5fd', height: 0.5 },
  shop_medium: { top: '#60a5fa', left: '#3b82f6', right: '#93c5fd', height: 0.7 },
  office_low: { top: '#3b82f6', left: '#2563eb', right: '#60a5fa', height: 1.3 },
  office_high: { top: '#2563eb', left: '#1d4ed8', right: '#3b82f6', height: 2.0 },
  mall: { top: '#1d4ed8', left: '#1e40af', right: '#2563eb', height: 1.0 },
  // Industrial - oranges/ambers
  factory_small: { top: '#fbbf24', left: '#f59e0b', right: '#fcd34d', height: 0.6 },
  factory_medium: { top: '#f59e0b', left: '#d97706', right: '#fbbf24', height: 0.9 },
  factory_large: { top: '#d97706', left: '#b45309', right: '#f59e0b', height: 1.2 },
  warehouse: { top: '#fbbf24', left: '#f59e0b', right: '#fcd34d', height: 0.7 },
  // Services - purples/pinks
  police_station: { top: '#818cf8', left: '#6366f1', right: '#a5b4fc', height: 0.8 },
  fire_station: { top: '#f87171', left: '#ef4444', right: '#fca5a5', height: 0.8 },
  hospital: { top: '#f472b6', left: '#ec4899', right: '#f9a8d4', height: 1.2 },
  school: { top: '#c084fc', left: '#a855f7', right: '#d8b4fe', height: 0.8 },
  university: { top: '#a855f7', left: '#9333ea', right: '#c084fc', height: 1.0 },
  // Parks - teals
  park: { top: '#2dd4bf', left: '#14b8a6', right: '#5eead4', height: 0.2 },
  park_large: { top: '#14b8a6', left: '#0d9488', right: '#2dd4bf', height: 0.3 },
  tennis: { top: '#5eead4', left: '#2dd4bf', right: '#99f6e4', height: 0.2 },
  tree: { top: '#22c55e', left: '#16a34a', right: '#4ade80', height: 0.5 },
  // Utilities - grays
  power_plant: { top: '#9ca3af', left: '#6b7280', right: '#d1d5db', height: 1.0 },
  water_tower: { top: '#60a5fa', left: '#3b82f6', right: '#93c5fd', height: 1.4 },
  subway_station: { top: '#6b7280', left: '#4b5563', right: '#9ca3af', height: 0.5 },
  rail_station: { top: '#6b7280', left: '#4b5563', right: '#9ca3af', height: 0.5 },
  // Special - golds
  stadium: { top: '#fbbf24', left: '#f59e0b', right: '#fcd34d', height: 0.8 },
  museum: { top: '#e879f9', left: '#d946ef', right: '#f0abfc', height: 0.9 },
  airport: { top: '#9ca3af', left: '#6b7280', right: '#d1d5db', height: 0.4 },
  space_program: { top: '#f1f5f9', left: '#e2e8f0', right: '#f8fafc', height: 1.5 },
  city_hall: { top: '#fbbf24', left: '#f59e0b', right: '#fcd34d', height: 1.2 },
  amusement_park: { top: '#fb7185', left: '#f43f5e', right: '#fda4af', height: 0.8 },
  // Default for unknown/park buildings
  default: { top: '#9ca3af', left: '#6b7280', right: '#d1d5db', height: 0.6 },
};

/**
 * Draw a placeholder isometric building box when sprites aren't loaded yet.
 * Uses simple colored 3D boxes that match the zone/category.
 */
export function drawPlaceholderBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  buildingType: string,
  tileWidth: number,
  tileHeight: number
): void {
  const colors = PLACEHOLDER_COLORS[buildingType] || PLACEHOLDER_COLORS.default;
  const boxHeight = tileHeight * colors.height;
  
  const w = tileWidth;
  const h = tileHeight;
  const cx = x + w / 2;
  const topY = y - boxHeight;
  
  // Draw left face (darker)
  ctx.fillStyle = colors.left;
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(cx, y + h);
  ctx.lineTo(cx, topY + h);
  ctx.lineTo(x, topY + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Draw right face (lighter)
  ctx.fillStyle = colors.right;
  ctx.beginPath();
  ctx.moveTo(x + w, y + h / 2);
  ctx.lineTo(cx, y + h);
  ctx.lineTo(cx, topY + h);
  ctx.lineTo(x + w, topY + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Draw top face
  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(x + w, topY + h / 2);
  ctx.lineTo(cx, topY + h);
  ctx.lineTo(x, topY + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Add subtle edge lines
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(x + w, topY + h / 2);
  ctx.lineTo(cx, topY + h);
  ctx.lineTo(x, topY + h / 2);
  ctx.closePath();
  ctx.stroke();
}
