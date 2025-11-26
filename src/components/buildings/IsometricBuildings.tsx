'use client';

import React from 'react';
import Image from 'next/image';
import { BuildingType, ZoneType } from '@/types/game';

interface BuildingProps {
  size?: number;
  level?: number;
  powered?: boolean;
  onFire?: boolean;
}

const DEFAULT_SPRITE_DIMENSIONS = { width: 1024, height: 1024 };
const SPRITE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '/assets/buildings/residential.png': { width: 1024, height: 1024 },
  '/assets/buildings/commercial.png': { width: 1536, height: 1024 },
  '/assets/buildings/industrial.png': { width: 2048, height: 2048 },
  '/assets/buildings/fire_station.png': { width: 1616, height: 1536 },
  '/assets/buildings/hospital.png': { width: 1648, height: 1748 },
  '/assets/buildings/park.png': { width: 2048, height: 2048 },
  '/assets/buildings/park_medium.png': { width: 2048, height: 2048 },
  '/assets/buildings/tennis.png': { width: 1024, height: 1024 },
  '/assets/buildings/police_station.png': { width: 2048, height: 2048 },
  '/assets/buildings/school.png': { width: 2048, height: 2048 },
  '/assets/buildings/university.png': { width: 1024, height: 1024 },
  '/assets/buildings/watertower.png': { width: 1024, height: 1024 },
  '/assets/buildings/powerplant.png': { width: 1024, height: 1024 },
  '/assets/buildings/stadium.png': { width: 1024, height: 1024 },
  '/assets/buildings/airport.png': { width: 1536, height: 1024 },
  '/assets/buildings/space.png': { width: 1024, height: 1024 },
  '/assets/buildings/trees.png': { width: 1024, height: 1024 },
  '/assets/buildings/house_medium.png': { width: 1024, height: 1024 },
  '/assets/buildings/house_small.png': { width: 2048, height: 2048 },
  '/assets/buildings/mansion.png': { width: 2048, height: 2048 },
  '/assets/buildings/shop_medium.png': { width: 2048, height: 2048 },
  '/assets/buildings/shop_small.png': { width: 2048, height: 2048 },
  '/assets/buildings/warehouse.png': { width: 2048, height: 2048 },
};

// Mapping of building types to their PNG image paths and size multipliers
const BUILDING_IMAGES: Partial<Record<BuildingType, { src: string; tileWidth: number; tileHeight: number; scale?: number; verticalOffset?: number; baseTileColor?: string }>> = {
  // Residential buildings (1x1)
  house_small: { src: '/assets/buildings/house_small.png', tileWidth: 1, tileHeight: 1, scale: 0.8, verticalOffset: 12, baseTileColor: '#8a8a8a' },
  house_medium: { src: '/assets/buildings/house_medium.png', tileWidth: 1, tileHeight: 1, scale: 0.8, verticalOffset: 12, baseTileColor: '#8a8a8a' },
  apartment_low: { src: '/assets/buildings/residential.png', tileWidth: 1, tileHeight: 1, verticalOffset: 14, baseTileColor: '#8a8a8a' },
  apartment_high: { src: '/assets/buildings/residential.png', tileWidth: 1, tileHeight: 1, verticalOffset: 18, baseTileColor: '#8a8a8a' },
  mansion: { src: '/assets/buildings/mansion.png', tileWidth: 1, tileHeight: 1, verticalOffset: -55, baseTileColor: '#8a8a8a' },
  // Commercial buildings (1x1)
  shop_small: { src: '/assets/buildings/shop_small.png', tileWidth: 1, tileHeight: 1, scale: 0.7 },
  shop_medium: { src: '/assets/buildings/shop_medium.png', tileWidth: 1, tileHeight: 1, scale: 0.74 },
  office_low: { src: '/assets/buildings/commercial.png', tileWidth: 1, tileHeight: 1 },
  office_high: { src: '/assets/buildings/commercial.png', tileWidth: 1, tileHeight: 1 },
  mall: { src: '/assets/buildings/commercial.png', tileWidth: 1, tileHeight: 1 },
  // Industrial buildings (1x1)
  factory_small: { src: '/assets/buildings/industrial.png', tileWidth: 1, tileHeight: 1 },
  factory_medium: { src: '/assets/buildings/industrial.png', tileWidth: 1, tileHeight: 1 },
  factory_large: { src: '/assets/buildings/industrial.png', tileWidth: 1, tileHeight: 1 },
  warehouse: { src: '/assets/buildings/warehouse.png', tileWidth: 1, tileHeight: 1 },
  // Service buildings (1x1)
  fire_station: { src: '/assets/buildings/fire_station.png', tileWidth: 1, tileHeight: 1 },
  hospital: { src: '/assets/buildings/hospital.png', tileWidth: 1, tileHeight: 1, scale: 0.56, verticalOffset: 15 },
  park: { src: '/assets/buildings/park.png', tileWidth: 1, tileHeight: 1, verticalOffset: -35 },
  park_large: { src: '/assets/buildings/park_medium.png', tileWidth: 3, tileHeight: 3, scale: 1.3, verticalOffset: -180 },
  tennis: { src: '/assets/buildings/tennis.png', tileWidth: 1, tileHeight: 1, scale: 0.95 },
  police_station: { src: '/assets/buildings/police_station.png', tileWidth: 1, tileHeight: 1 },
  school: { src: '/assets/buildings/school.png', tileWidth: 2, tileHeight: 2 },
  university: { src: '/assets/buildings/university.png', tileWidth: 3, tileHeight: 2 },
  // Utilities
  water_tower: { src: '/assets/buildings/watertower.png', tileWidth: 1, tileHeight: 1 },
  power_plant: { src: '/assets/buildings/powerplant.png', tileWidth: 2, tileHeight: 2 },
  // Special buildings
  stadium: { src: '/assets/buildings/stadium.png', tileWidth: 3, tileHeight: 3, scale: 0.49 },
  space_program: { src: '/assets/buildings/space.png', tileWidth: 3, tileHeight: 3 },
};

// Image-based building component
const ImageBuilding: React.FC<{
  src: string;
  size?: number;
  tileWidth?: number; // How many tiles wide this building spans
  tileHeight?: number; // How many tiles tall this building spans
  alt: string;
  scale?: number; // Optional scale multiplier (default 1.0)
  verticalOffset?: number; // Optional vertical offset in pixels (positive = up, negative = down)
  baseTileColor?: string; // Optional color for the base tile underneath
}> = ({ src, size = 64, tileWidth = 1, tileHeight = 1, alt, scale = 1.0, verticalOffset = 0, baseTileColor }) => {
  // Calculate image dimensions based on tile size
  // For multi-tile buildings, scale the image accordingly
  const scaledWidth = size * tileWidth;
  const scaledHeight = getTileHeight(size) * tileHeight;
  const spriteBaseHeight = Math.max(scaledWidth, scaledHeight) * 1.8 * scale;
  const spriteDims = SPRITE_DIMENSIONS[src] ?? DEFAULT_SPRITE_DIMENSIONS;
  const aspectRatio = spriteDims.width / spriteDims.height || 1;
  const renderHeight = spriteBaseHeight;
  const renderWidth = renderHeight * aspectRatio;
  
  return (
    <div 
      style={{ 
        position: 'relative',
        width: scaledWidth,
        height: scaledHeight + renderHeight * 0.5,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      {/* Base tile underneath the building */}
      {baseTileColor && (
        <svg 
          width={scaledWidth} 
          height={scaledHeight} 
          viewBox={`0 0 ${scaledWidth} ${scaledHeight}`} 
          style={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0,
          }}
        >
          <polygon
            points={`${scaledWidth/2},0 ${scaledWidth},${scaledHeight/2} ${scaledWidth/2},${scaledHeight} 0,${scaledHeight/2}`}
            fill={baseTileColor}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={0.5}
          />
        </svg>
      )}
      <Image
        src={src}
        alt={alt}
        width={spriteDims.width}
        height={spriteDims.height}
        style={{
          width: renderWidth,
          height: renderHeight,
          objectFit: 'contain',
          position: 'absolute',
          bottom: -scaledHeight * 0.1 + verticalOffset,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
        priority
      />
    </div>
  );
};

// Isometric tile configuration
// HEIGHT_RATIO controls the tile shape
// 0.5 = standard isometric, higher = taller tiles (more top-down feel)
const TILE_WIDTH = 64;
const HEIGHT_RATIO = 0.65; // Taller tiles for more top-down view
const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;

// Helper to get tile height from width using the ratio
const getTileHeight = (w: number) => w * HEIGHT_RATIO;

// Helper to create isometric diamond points for a tile
const getTilePoints = (w: number, yOffset: number = 0) => {
  const h = getTileHeight(w);
  return `${w/2},${yOffset} ${w},${h/2 + yOffset} ${w/2},${h + yOffset} 0,${h/2 + yOffset}`;
};

// Base isometric tile shape - flat diamond
export const IsometricTile: React.FC<{ 
  color: string; 
  size?: number;
  highlight?: boolean;
  zone?: ZoneType;
}> = ({ color, size = TILE_WIDTH, highlight, zone }) => {
  const w = size;
  const h = getTileHeight(w);
  
  const zoneColors: Record<ZoneType, string> = {
    residential: 'rgba(76, 175, 80, 0.4)',
    commercial: 'rgba(33, 150, 243, 0.4)',
    industrial: 'rgba(255, 193, 7, 0.4)',
    none: 'transparent'
  };
  
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <polygon
        points={getTilePoints(w)}
        fill={zone && zone !== 'none' ? zoneColors[zone] : color}
        stroke={highlight ? '#fff' : 'rgba(0,0,0,0.3)'}
        strokeWidth={highlight ? 1.5 : 0.5}
      />
      {zone && zone !== 'none' && (
        <polygon
          points={getTilePoints(w)}
          fill="none"
          stroke={zone === 'residential' ? '#4CAF50' : zone === 'commercial' ? '#2196F3' : '#FFC107'}
          strokeWidth={1.5}
          strokeDasharray="4,2"
        />
      )}
    </svg>
  );
};

// Grass tile - flat
export const GrassTile: React.FC<BuildingProps> = ({ size = TILE_WIDTH }) => {
  const w = size;
  const h = getTileHeight(w);
  
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`grassGrad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4a7c3f" />
          <stop offset="100%" stopColor="#3d6634" />
        </linearGradient>
      </defs>
      <polygon
        points={getTilePoints(w)}
        fill={`url(#grassGrad-${size})`}
        stroke="#2d4a26"
        strokeWidth={0.5}
      />
    </svg>
  );
};

// Water tile - flat with shimmer
export const WaterTile: React.FC<BuildingProps> = ({ size = TILE_WIDTH }) => {
  const w = size;
  const h = getTileHeight(w);
  
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`waterGrad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="50%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
      </defs>
      <polygon
        points={getTilePoints(w)}
        fill={`url(#waterGrad-${size})`}
        stroke="#1e3a8a"
        strokeWidth={0.5}
      />
      <ellipse cx={w * 0.35} cy={h * 0.4} rx={w * 0.08} ry={h * 0.1} fill="#60a5fa" opacity={0.4} />
      <ellipse cx={w * 0.65} cy={h * 0.55} rx={w * 0.06} ry={h * 0.08} fill="#93c5fd" opacity={0.3} />
    </svg>
  );
};

// Road adjacency - which directions have connected roads
export interface RoadAdjacency {
  north: boolean;  // tile at x-1 (top-left edge in isometric)
  east: boolean;   // tile at y-1 (top-right edge in isometric)
  south: boolean;  // tile at x+1 (bottom-right edge in isometric)
  west: boolean;   // tile at y+1 (bottom-left edge in isometric)
}

// Road tile - adapts to adjacent roads
export const RoadTile: React.FC<BuildingProps & { adjacency?: RoadAdjacency }> = ({ 
  size = TILE_WIDTH,
  adjacency = { north: false, east: false, south: false, west: false }
}) => {
  const w = size;
  const h = getTileHeight(w);
  
  const { north, east, south, west } = adjacency;
  
  // Tile corner points (isometric diamond)
  // Top: (w/2, 0), Right: (w, h/2), Bottom: (w/2, h), Left: (0, h/2)
  
  // Road width as fraction of edge length
  const roadW = 0.4;
  
  // Edge midpoints for road connections
  // North edge (top-left): from (w/2, 0) to (0, h/2)
  const northMid = { x: w * 0.25, y: h * 0.25 };
  // East edge (top-right): from (w/2, 0) to (w, h/2)
  const eastMid = { x: w * 0.75, y: h * 0.25 };
  // South edge (bottom-right): from (w, h/2) to (w/2, h)
  const southMid = { x: w * 0.75, y: h * 0.75 };
  // West edge (bottom-left): from (0, h/2) to (w/2, h)
  const westMid = { x: w * 0.25, y: h * 0.75 };
  
  // Center of tile
  const center = { x: w * 0.5, y: h * 0.5 };
  
  // Calculate road segments as polygons extending from center to edges
  const roadSegments: string[] = [];
  const roadColor = '#4a4a4a';
  const roadColorLight = '#555';
  const roadColorDark = '#3a3a3a';
  
  // Road half-width perpendicular to each direction
  const hw = w * 0.15; // half width
  const hh = h * 0.15;
  
  if (north) {
    // Road segment to north edge (top-left)
    roadSegments.push(`
      M ${center.x - hw * 0.7} ${center.y - hh * 0.7}
      L ${w * 0.25 - hw * 0.5} ${h * 0.25 - hh * 0.5}
      L ${w * 0.25 + hw * 0.5} ${h * 0.25 + hh * 0.5}
      L ${center.x + hw * 0.7} ${center.y + hh * 0.7}
      Z
    `);
  }
  
  if (east) {
    // Road segment to east edge (top-right)
    roadSegments.push(`
      M ${center.x + hw * 0.7} ${center.y - hh * 0.7}
      L ${w * 0.75 + hw * 0.5} ${h * 0.25 - hh * 0.5}
      L ${w * 0.75 - hw * 0.5} ${h * 0.25 + hh * 0.5}
      L ${center.x - hw * 0.7} ${center.y + hh * 0.7}
      Z
    `);
  }
  
  if (south) {
    // Road segment to south edge (bottom-right)
    roadSegments.push(`
      M ${center.x + hw * 0.7} ${center.y + hh * 0.7}
      L ${w * 0.75 + hw * 0.5} ${h * 0.75 + hh * 0.5}
      L ${w * 0.75 - hw * 0.5} ${h * 0.75 - hh * 0.5}
      L ${center.x - hw * 0.7} ${center.y - hh * 0.7}
      Z
    `);
  }
  
  if (west) {
    // Road segment to west edge (bottom-left)
    roadSegments.push(`
      M ${center.x - hw * 0.7} ${center.y + hh * 0.7}
      L ${w * 0.25 - hw * 0.5} ${h * 0.75 + hh * 0.5}
      L ${w * 0.25 + hw * 0.5} ${h * 0.75 - hh * 0.5}
      L ${center.x + hw * 0.7} ${center.y - hh * 0.7}
      Z
    `);
  }
  
  // Center intersection area (always drawn)
  const centerSize = hw * 1.4;
  const centerPath = `
    M ${center.x} ${center.y - centerSize}
    L ${center.x + centerSize} ${center.y}
    L ${center.x} ${center.y + centerSize}
    L ${center.x - centerSize} ${center.y}
    Z
  `;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`roadGrad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#555" />
          <stop offset="50%" stopColor="#484848" />
          <stop offset="100%" stopColor="#3a3a3a" />
        </linearGradient>
      </defs>
      
      {/* Base grass under road */}
      <polygon
        points={getTilePoints(w)}
        fill="#3d5a35"
        stroke="#2d4a26"
        strokeWidth={0.5}
      />
      
      {/* Road segments */}
      {roadSegments.map((d, i) => (
        <path key={i} d={d} fill={`url(#roadGrad-${size})`} />
      ))}
      
      {/* Center intersection */}
      <path d={centerPath} fill={`url(#roadGrad-${size})`} />
      
      {/* Road edges/curbs */}
      {roadSegments.map((d, i) => (
        <path key={`edge-${i}`} d={d} fill="none" stroke="#333" strokeWidth={0.5} />
      ))}
      <path d={centerPath} fill="none" stroke="#333" strokeWidth={0.5} />
      
      {/* Subtle highlight on road surface */}
      <path d={centerPath} fill="#666" opacity={0.15} />
    </svg>
  );
};

// Tree - small vertical element on tile
export const TreeTile: React.FC<BuildingProps> = ({ size = TILE_WIDTH }) => {
  const w = size;
  const h = getTileHeight(w);
  const treeH = h * 0.8; // Tree height above ground
  const totalH = h + treeH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`treeGrass-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4a7c3f" />
          <stop offset="100%" stopColor="#3d6634" />
        </linearGradient>
        <radialGradient id={`canopy-${size}`} cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
      </defs>
      {/* Ground tile */}
      <polygon
        points={`${w/2},${treeH} ${w},${treeH + h/2} ${w/2},${totalH} 0,${treeH + h/2}`}
        fill={`url(#treeGrass-${size})`}
        stroke="#2d4a26"
        strokeWidth={0.5}
      />
      {/* Trunk */}
      <rect x={w/2 - 2} y={treeH - h * 0.3} width={4} height={h * 0.35} fill="#78350f" />
      {/* Canopy - ellipse for top-down view */}
      <ellipse cx={w/2} cy={treeH - h * 0.4} rx={w * 0.15} ry={h * 0.35} fill={`url(#canopy-${size})`} />
    </svg>
  );
};

// Helper: Create an isometric box (building base)
interface BoxProps {
  w: number;       // tile width
  h: number;       // tile height (half of width for 2:1)
  depth: number;   // how tall the box is (vertical pixels)
  topColor: string;
  leftColor: string;
  rightColor: string;
  yOffset?: number;
}

const IsometricBox: React.FC<BoxProps> = ({ w, h, depth, topColor, leftColor, rightColor, yOffset = 0 }) => {
  // Top face
  const topPoints = `${w/2},${yOffset} ${w},${h/2 + yOffset} ${w/2},${h + yOffset} 0,${h/2 + yOffset}`;
  // Left face
  const leftPoints = `0,${h/2 + yOffset} ${w/2},${h + yOffset} ${w/2},${h + depth + yOffset} 0,${h/2 + depth + yOffset}`;
  // Right face
  const rightPoints = `${w},${h/2 + yOffset} ${w/2},${h + yOffset} ${w/2},${h + depth + yOffset} ${w},${h/2 + depth + yOffset}`;
  
  return (
    <>
      <polygon points={leftPoints} fill={leftColor} />
      <polygon points={rightPoints} fill={rightColor} />
      <polygon points={topPoints} fill={topColor} />
    </>
  );
};

// Small house (residential level 1)
export const SmallHouse: React.FC<BuildingProps> = ({ size = TILE_WIDTH, powered = true }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 0.6;
  const roofH = h * 0.3;
  const totalH = h + buildingH + roofH;
  const groundY = roofH + buildingH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#4a7c3f" stroke="#2d4a26" strokeWidth={0.5} />
      {/* Building base */}
      <IsometricBox w={w * 0.7} h={h * 0.7} depth={buildingH} topColor="#FFE082" leftColor="#FFD54F" rightColor="#FFECB3" yOffset={roofH} />
      {/* Roof */}
      <polygon points={`${w * 0.35},0 ${w * 0.7},${h * 0.175} ${w * 0.35},${roofH} 0,${h * 0.175}`} fill="#8D6E63" />
      <polygon points={`${w * 0.35},${roofH} ${w * 0.7},${h * 0.175} ${w * 0.7},${h * 0.35 + roofH * 0.5} ${w * 0.35},${roofH + h * 0.175}`} fill="#6D4C41" />
      {/* Window */}
      <rect x={w * 0.4} y={roofH + buildingH * 0.3} width={w * 0.12} height={buildingH * 0.3} fill={powered ? "#FFF59D" : "#555"} />
      {/* Door */}
      <rect x={w * 0.15} y={roofH + buildingH * 0.4} width={w * 0.1} height={buildingH * 0.5} fill="#5D4037" />
      {!powered && <circle cx={w * 0.35} cy={roofH * 0.5} r={3} fill="#F44336" />}
    </svg>
  );
};

// Medium house (residential level 2)
export const MediumHouse: React.FC<BuildingProps> = ({ size = TILE_WIDTH, powered = true }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 0.8;
  const roofH = h * 0.35;
  const totalH = h + buildingH + roofH;
  const groundY = roofH + buildingH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#4a7c3f" stroke="#2d4a26" strokeWidth={0.5} />
      {/* Building */}
      <IsometricBox w={w * 0.8} h={h * 0.8} depth={buildingH} topColor="#BBDEFB" leftColor="#90CAF9" rightColor="#E3F2FD" yOffset={roofH} />
      {/* Roof */}
      <polygon points={`${w * 0.4},0 ${w * 0.8},${h * 0.2} ${w * 0.4},${roofH} 0,${h * 0.2}`} fill="#546E7A" />
      <polygon points={`${w * 0.4},${roofH} ${w * 0.8},${h * 0.2} ${w * 0.8},${h * 0.4 + roofH * 0.3} ${w * 0.4},${roofH + h * 0.2}`} fill="#37474F" />
      {/* Windows */}
      <rect x={w * 0.45} y={roofH + buildingH * 0.2} width={w * 0.1} height={buildingH * 0.25} fill={powered ? "#FFF59D" : "#555"} />
      <rect x={w * 0.6} y={roofH + buildingH * 0.2} width={w * 0.1} height={buildingH * 0.25} fill={powered ? "#FFF59D" : "#555"} />
      <rect x={w * 0.45} y={roofH + buildingH * 0.55} width={w * 0.1} height={buildingH * 0.25} fill={powered ? "#BBDEFB" : "#555"} />
      <rect x={w * 0.6} y={roofH + buildingH * 0.55} width={w * 0.1} height={buildingH * 0.25} fill={powered ? "#BBDEFB" : "#555"} />
      {/* Garage */}
      <rect x={w * 0.08} y={roofH + buildingH * 0.5} width={w * 0.15} height={buildingH * 0.4} fill="#795548" />
      {!powered && <circle cx={w * 0.4} cy={roofH * 0.4} r={3} fill="#F44336" />}
    </svg>
  );
};

// Apartment low (residential level 3)
export const ApartmentLow: React.FC<BuildingProps> = ({ size = TILE_WIDTH, powered = true }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 1.5;
  const totalH = h + buildingH;
  const groundY = buildingH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#4a7c3f" stroke="#2d4a26" strokeWidth={0.5} />
      {/* Building */}
      <IsometricBox w={w * 0.85} h={h * 0.85} depth={buildingH} topColor="#CFD8DC" leftColor="#90A4AE" rightColor="#ECEFF1" yOffset={0} />
      {/* Windows - right face */}
      {[0.15, 0.35, 0.55, 0.75].map((yFrac, i) => (
        <g key={i}>
          <rect x={w * 0.5} y={buildingH * yFrac} width={w * 0.08} height={buildingH * 0.12} fill={powered ? "#FFF59D" : "#444"} />
          <rect x={w * 0.62} y={buildingH * yFrac} width={w * 0.08} height={buildingH * 0.12} fill={powered ? "#BBDEFB" : "#444"} />
          <rect x={w * 0.74} y={buildingH * yFrac} width={w * 0.06} height={buildingH * 0.12} fill={powered ? "#FFF59D" : "#444"} />
        </g>
      ))}
      {/* Entrance */}
      <rect x={w * 0.1} y={buildingH * 0.7} width={w * 0.12} height={buildingH * 0.25} fill="#455A64" />
      {!powered && <circle cx={w * 0.42} cy={8} r={4} fill="#F44336" />}
    </svg>
  );
};

// Apartment high (residential level 4-5)
export const ApartmentHigh: React.FC<BuildingProps> = ({ size = TILE_WIDTH, level = 4, powered = true }) => {
  const w = size;
  const h = getTileHeight(w);
  const floors = level === 5 ? 8 : 6;
  const buildingH = h * (0.3 * floors);
  const totalH = h + buildingH;
  const groundY = buildingH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#4a7c3f" stroke="#2d4a26" strokeWidth={0.5} />
      {/* Building */}
      <IsometricBox w={w * 0.8} h={h * 0.8} depth={buildingH} topColor="#C5CAE9" leftColor="#7986CB" rightColor="#E8EAF6" yOffset={0} />
      {/* Rooftop structure */}
      <rect x={w * 0.35} y={-5} width={w * 0.1} height={8} fill="#5C6BC0" />
      {/* Windows */}
      {Array.from({ length: floors }, (_, i) => (
        <g key={i}>
          <rect x={w * 0.48} y={buildingH * (0.08 + i * 0.13)} width={w * 0.06} height={buildingH * 0.08} fill={powered ? (i % 2 === 0 ? "#FFF59D" : "#BBDEFB") : "#333"} />
          <rect x={w * 0.58} y={buildingH * (0.08 + i * 0.13)} width={w * 0.06} height={buildingH * 0.08} fill={powered ? "#BBDEFB" : "#333"} />
          <rect x={w * 0.68} y={buildingH * (0.08 + i * 0.13)} width={w * 0.06} height={buildingH * 0.08} fill={powered ? "#FFF59D" : "#333"} />
        </g>
      ))}
      {/* Entrance */}
      <rect x={w * 0.08} y={buildingH * 0.75} width={w * 0.12} height={buildingH * 0.2} fill="#303F9F" />
      {!powered && <circle cx={w * 0.4} cy={6} r={4} fill="#F44336" />}
    </svg>
  );
};

// Small shop (commercial level 1)
export const SmallShop: React.FC<BuildingProps> = ({ size = TILE_WIDTH, powered = true }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 0.7;
  const totalH = h + buildingH;
  const groundY = buildingH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#4a7c3f" stroke="#2d4a26" strokeWidth={0.5} />
      {/* Building */}
      <IsometricBox w={w * 0.75} h={h * 0.75} depth={buildingH} topColor="#B3E5FC" leftColor="#4FC3F7" rightColor="#E1F5FE" yOffset={0} />
      {/* Awning */}
      <polygon points={`${w * 0.375},${buildingH * 0.3} ${w * 0.75},${buildingH * 0.3 + h * 0.1875} ${w * 0.75},${buildingH * 0.45 + h * 0.1875} ${w * 0.375},${buildingH * 0.45}`} fill="#F44336" />
      {/* Shop window */}
      <rect x={w * 0.42} y={buildingH * 0.45} width={w * 0.25} height={buildingH * 0.35} fill={powered ? "#E3F2FD" : "#444"} stroke="#0288D1" strokeWidth={0.5} />
      {/* Sign */}
      <rect x={w * 0.45} y={buildingH * 0.15} width={w * 0.15} height={buildingH * 0.1} fill="#FFF" />
      {!powered && <circle cx={w * 0.375} cy={6} r={3} fill="#F44336" />}
    </svg>
  );
};

// Office low (commercial level 2-3)
export const OfficeLow: React.FC<BuildingProps> = ({ size = TILE_WIDTH, powered = true }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 1.2;
  const totalH = h + buildingH;
  const groundY = buildingH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#4a7c3f" stroke="#2d4a26" strokeWidth={0.5} />
      {/* Building */}
      <IsometricBox w={w * 0.85} h={h * 0.85} depth={buildingH} topColor="#BDBDBD" leftColor="#757575" rightColor="#E0E0E0" yOffset={0} />
      {/* Glass windows - blue tint */}
      {[0.15, 0.35, 0.55, 0.75].map((yFrac, i) => (
        <rect key={i} x={w * 0.48} y={buildingH * yFrac} width={w * 0.3} height={buildingH * 0.14} fill={powered ? "#29B6F6" : "#333"} opacity={0.9} />
      ))}
      {/* Entrance */}
      <rect x={w * 0.12} y={buildingH * 0.7} width={w * 0.15} height={buildingH * 0.25} fill="#37474F" />
      {!powered && <circle cx={w * 0.42} cy={6} r={4} fill="#F44336" />}
    </svg>
  );
};

// Office high (commercial level 4-5)
export const OfficeHigh: React.FC<BuildingProps> = ({ size = TILE_WIDTH, level = 4, powered = true }) => {
  const w = size;
  const h = getTileHeight(w);
  const floors = level === 5 ? 10 : 7;
  const buildingH = h * (0.25 * floors);
  const totalH = h + buildingH + 10;
  const groundY = buildingH + 10;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#4a7c3f" stroke="#2d4a26" strokeWidth={0.5} />
      {/* Building - glass tower */}
      <IsometricBox w={w * 0.75} h={h * 0.75} depth={buildingH} topColor="#00ACC1" leftColor="#00838F" rightColor="#4DD0E1" yOffset={10} />
      {/* Spire */}
      <polygon points={`${w * 0.375},0 ${w * 0.35},10 ${w * 0.4},10`} fill="#B0BEC5" />
      {/* Window grid */}
      {Array.from({ length: floors }, (_, i) => (
        <g key={i}>
          {[0.44, 0.54, 0.64].map((xFrac, j) => (
            <rect key={j} x={w * xFrac} y={10 + buildingH * (0.05 + i * 0.09)} width={w * 0.06} height={buildingH * 0.06} fill={powered ? (i % 2 === j % 2 ? "#E0F7FA" : "#80DEEA") : "#222"} />
          ))}
        </g>
      ))}
      {!powered && <circle cx={w * 0.375} cy={15} r={4} fill="#F44336" />}
    </svg>
  );
};

// Factory small (industrial level 1)
export const FactorySmall: React.FC<BuildingProps> = ({ size = TILE_WIDTH, powered = true }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 0.8;
  const stackH = h * 0.6;
  const totalH = h + buildingH + stackH;
  const groundY = buildingH + stackH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#795548" stroke="#5D4037" strokeWidth={0.5} />
      {/* Building */}
      <IsometricBox w={w * 0.8} h={h * 0.8} depth={buildingH} topColor="#6D4C41" leftColor="#5D4037" rightColor="#8D6E63" yOffset={stackH} />
      {/* Smokestack */}
      <rect x={w * 0.55} y={0} width={w * 0.1} height={stackH + buildingH * 0.3} fill="#424242" />
      <ellipse cx={w * 0.6} cy={0} rx={w * 0.05} ry={3} fill="#616161" />
      {/* Smoke */}
      {powered && (
        <>
          <ellipse cx={w * 0.6} cy={-8} rx={6} ry={4} fill="#9E9E9E" opacity={0.5} />
          <ellipse cx={w * 0.62} cy={-16} rx={8} ry={5} fill="#BDBDBD" opacity={0.3} />
        </>
      )}
      {/* Door */}
      <rect x={w * 0.52} y={stackH + buildingH * 0.5} width={w * 0.12} height={buildingH * 0.4} fill="#3E2723" />
      {!powered && <circle cx={w * 0.4} cy={stackH + 8} r={3} fill="#F44336" />}
    </svg>
  );
};

// Factory large (industrial level 3-5)
export const FactoryLarge: React.FC<BuildingProps> = ({ size = TILE_WIDTH, level = 3, powered = true }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 1.0;
  const stackH = h * 0.9;
  const stacks = level >= 4 ? 3 : 2;
  const totalH = h + buildingH + stackH;
  const groundY = buildingH + stackH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#5D4037" stroke="#3E2723" strokeWidth={0.5} />
      {/* Building */}
      <IsometricBox w={w * 0.9} h={h * 0.9} depth={buildingH} topColor="#546E7A" leftColor="#455A64" rightColor="#78909C" yOffset={stackH} />
      {/* Smokestacks */}
      {Array.from({ length: stacks }, (_, i) => (
        <g key={i}>
          <rect x={w * (0.45 + i * 0.15)} y={0} width={w * 0.08} height={stackH + buildingH * 0.2} fill="#616161" />
          <ellipse cx={w * (0.49 + i * 0.15)} cy={0} rx={w * 0.04} ry={2} fill="#757575" />
          {powered && (
            <>
              <ellipse cx={w * (0.49 + i * 0.15)} cy={-6 - i * 4} rx={6} ry={4} fill="#9E9E9E" opacity={0.4} />
              <ellipse cx={w * (0.51 + i * 0.15)} cy={-14 - i * 6} rx={8} ry={5} fill="#BDBDBD" opacity={0.25} />
            </>
          )}
        </g>
      ))}
      {/* Windows */}
      <rect x={w * 0.5} y={stackH + buildingH * 0.2} width={w * 0.2} height={buildingH * 0.25} fill={powered ? "#FFF9C4" : "#333"} />
      <rect x={w * 0.5} y={stackH + buildingH * 0.55} width={w * 0.2} height={buildingH * 0.25} fill={powered ? "#FFF9C4" : "#333"} />
      {/* Large door */}
      <rect x={w * 0.72} y={stackH + buildingH * 0.5} width={w * 0.12} height={buildingH * 0.4} fill="#37474F" />
      {!powered && <circle cx={w * 0.45} cy={stackH + 8} r={4} fill="#F44336" />}
    </svg>
  );
};

// Warehouse (industrial)
export const Warehouse: React.FC<BuildingProps> = ({ size = TILE_WIDTH, powered = true }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 0.6;
  const totalH = h + buildingH;
  const groundY = buildingH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#795548" stroke="#5D4037" strokeWidth={0.5} />
      {/* Building */}
      <IsometricBox w={w * 0.85} h={h * 0.85} depth={buildingH} topColor="#FFB300" leftColor="#FF8F00" rightColor="#FFA000" yOffset={0} />
      {/* Loading door */}
      <rect x={w * 0.5} y={buildingH * 0.3} width={w * 0.2} height={buildingH * 0.6} fill="#5D4037" />
      <line x1={w * 0.6} y1={buildingH * 0.3} x2={w * 0.6} y2={buildingH * 0.9} stroke="#3E2723" strokeWidth={0.5} />
      {!powered && <circle cx={w * 0.42} cy={6} r={3} fill="#F44336" />}
    </svg>
  );
};

// Power plant
export const PowerPlant: React.FC<BuildingProps> = ({ size = TILE_WIDTH }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 1.0;
  const towerH = h * 1.2;
  const totalH = h + buildingH + towerH * 0.5;
  const groundY = buildingH + towerH * 0.5;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#616161" stroke="#424242" strokeWidth={0.5} />
      {/* Main building */}
      <IsometricBox w={w * 0.7} h={h * 0.7} depth={buildingH} topColor="#616161" leftColor="#424242" rightColor="#757575" yOffset={towerH * 0.5} />
      {/* Cooling tower - curved shape */}
      <ellipse cx={w * 0.7} cy={towerH * 0.5 + buildingH * 0.5} rx={w * 0.18} ry={h * 0.15} fill="#78909C" />
      <path d={`M ${w * 0.52} ${towerH * 0.5 + buildingH * 0.5} Q ${w * 0.62} ${-towerH * 0.2} ${w * 0.7} 0 Q ${w * 0.78} ${-towerH * 0.2} ${w * 0.88} ${towerH * 0.5 + buildingH * 0.5}`} fill="#90A4AE" stroke="#455A64" strokeWidth={0.5} />
      <ellipse cx={w * 0.7} cy={0} rx={w * 0.12} ry={h * 0.1} fill="#B0BEC5" />
      {/* Steam */}
      <ellipse cx={w * 0.7} cy={-10} rx={w * 0.15} ry={h * 0.12} fill="#ECEFF1" opacity={0.5} />
      <ellipse cx={w * 0.72} cy={-22} rx={w * 0.18} ry={h * 0.14} fill="#F5F5F5" opacity={0.3} />
      {/* Lightning bolt */}
      <polygon points={`${w * 0.28},${towerH * 0.5 + buildingH * 0.25} ${w * 0.35},${towerH * 0.5 + buildingH * 0.25} ${w * 0.32},${towerH * 0.5 + buildingH * 0.45} ${w * 0.38},${towerH * 0.5 + buildingH * 0.45} ${w * 0.28},${towerH * 0.5 + buildingH * 0.75} ${w * 0.31},${towerH * 0.5 + buildingH * 0.55} ${w * 0.26},${towerH * 0.5 + buildingH * 0.55}`} fill="#FDD835" stroke="#F57F17" strokeWidth={0.5} />
    </svg>
  );
};

// Water tower
export const WaterTower: React.FC<BuildingProps> = ({ size = TILE_WIDTH }) => {
  const w = size;
  const h = getTileHeight(w);
  const towerH = h * 1.4;
  const totalH = h + towerH;
  const groundY = towerH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#4a7c3f" stroke="#2d4a26" strokeWidth={0.5} />
      {/* Legs */}
      <rect x={w * 0.3} y={towerH * 0.35} width={3} height={towerH * 0.7} fill="#4a5568" />
      <rect x={w * 0.5 - 1.5} y={towerH * 0.35} width={3} height={towerH * 0.7} fill="#4a5568" />
      <rect x={w * 0.7 - 3} y={towerH * 0.35} width={3} height={towerH * 0.7} fill="#4a5568" />
      {/* Cross braces */}
      <line x1={w * 0.3} y1={towerH * 0.55} x2={w * 0.7} y2={towerH * 0.75} stroke="#4a5568" strokeWidth={1.5} />
      <line x1={w * 0.7} y1={towerH * 0.55} x2={w * 0.3} y2={towerH * 0.75} stroke="#4a5568" strokeWidth={1.5} />
      {/* Tank */}
      <ellipse cx={w/2} cy={towerH * 0.35} rx={w * 0.22} ry={h * 0.15} fill="#0ea5e9" stroke="#0284c7" strokeWidth={1} />
      <rect x={w * 0.28} y={towerH * 0.1} width={w * 0.44} height={towerH * 0.25} fill="#0ea5e9" stroke="#0284c7" strokeWidth={1} />
      <ellipse cx={w/2} cy={towerH * 0.1} rx={w * 0.22} ry={h * 0.15} fill="#38bdf8" stroke="#0284c7" strokeWidth={1} />
      {/* Water drop */}
      <path d={`M${w/2} ${towerH * 0.15} Q${w/2 + 6} ${towerH * 0.22} ${w/2} ${towerH * 0.28} Q${w/2 - 6} ${towerH * 0.22} ${w/2} ${towerH * 0.15}`} fill="white" opacity={0.4} />
    </svg>
  );
};

// Police station
export const PoliceStation: React.FC<BuildingProps> = ({ size = TILE_WIDTH }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 0.9;
  const totalH = h + buildingH;
  const groundY = buildingH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#4a7c3f" stroke="#2d4a26" strokeWidth={0.5} />
      {/* Building */}
      <IsometricBox w={w * 0.85} h={h * 0.85} depth={buildingH} topColor="#1976D2" leftColor="#1565C0" rightColor="#2196F3" yOffset={0} />
      {/* Badge */}
      <polygon points={`${w * 0.55},${buildingH * 0.2} ${w * 0.65},${buildingH * 0.25} ${w * 0.65},${buildingH * 0.45} ${w * 0.6},${buildingH * 0.55} ${w * 0.55},${buildingH * 0.45} ${w * 0.5},${buildingH * 0.55} ${w * 0.45},${buildingH * 0.45} ${w * 0.45},${buildingH * 0.25}`} fill="#FFC107" stroke="#FF8F00" strokeWidth={0.5} />
      {/* Star on badge */}
      <text x={w * 0.55} y={buildingH * 0.4} fontSize="6" fill="#0D47A1" textAnchor="middle" fontWeight="bold">*</text>
      {/* Entrance */}
      <rect x={w * 0.12} y={buildingH * 0.55} width={w * 0.15} height={buildingH * 0.4} fill="#0D47A1" />
      {/* Flag */}
      <line x1={w * 0.8} y1={buildingH * 0.1} x2={w * 0.8} y2={-10} stroke="#757575" strokeWidth={1} />
      <polygon points={`${w * 0.8},-10 ${w * 0.8},-2 ${w * 0.92},-6`} fill="#F44336" />
    </svg>
  );
};

// Fire station
export const FireStation: React.FC<BuildingProps> = ({ size = TILE_WIDTH }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 0.9;
  const towerH = h * 0.5;
  const totalH = h + buildingH + towerH;
  const groundY = buildingH + towerH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#4a7c3f" stroke="#2d4a26" strokeWidth={0.5} />
      {/* Main building */}
      <IsometricBox w={w * 0.85} h={h * 0.85} depth={buildingH} topColor="#D32F2F" leftColor="#C62828" rightColor="#E53935" yOffset={towerH} />
      {/* Garage door */}
      <rect x={w * 0.5} y={towerH + buildingH * 0.35} width={w * 0.25} height={buildingH * 0.55} fill="#424242" />
      <line x1={w * 0.5} y1={towerH + buildingH * 0.5} x2={w * 0.75} y2={towerH + buildingH * 0.5} stroke="#616161" strokeWidth={0.5} />
      <line x1={w * 0.5} y1={towerH + buildingH * 0.65} x2={w * 0.75} y2={towerH + buildingH * 0.65} stroke="#616161" strokeWidth={0.5} />
      {/* Tower */}
      <rect x={w * 0.15} y={0} width={w * 0.15} height={towerH + buildingH * 0.3} fill="#E53935" stroke="#B71C1C" strokeWidth={0.5} />
      {/* Bell */}
      <ellipse cx={w * 0.225} cy={-3} rx={5} ry={4} fill="#FFC107" stroke="#FF8F00" strokeWidth={0.5} />
    </svg>
  );
};

// Hospital
export const Hospital: React.FC<BuildingProps> = ({ size = TILE_WIDTH }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 1.4;
  const totalH = h + buildingH;
  const groundY = buildingH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#FFFFFF" stroke="#E0E0E0" strokeWidth={0.5} />
      {/* Building */}
      <IsometricBox w={w * 0.9} h={h * 0.9} depth={buildingH} topColor="#BDBDBD" leftColor="#9E9E9E" rightColor="#E0E0E0" yOffset={0} />
      {/* Red cross */}
      <rect x={w * 0.52} y={buildingH * 0.15} width={w * 0.06} height={buildingH * 0.3} fill="#F44336" />
      <rect x={w * 0.46} y={buildingH * 0.22} width={w * 0.18} height={buildingH * 0.08} fill="#F44336" />
      {/* Windows */}
      {[0.5, 0.7].map((yFrac, i) => (
        <g key={i}>
          <rect x={w * 0.48} y={buildingH * yFrac} width={w * 0.08} height={buildingH * 0.1} fill="#E3F2FD" stroke="#90CAF9" strokeWidth={0.3} />
          <rect x={w * 0.62} y={buildingH * yFrac} width={w * 0.08} height={buildingH * 0.1} fill="#E3F2FD" stroke="#90CAF9" strokeWidth={0.3} />
        </g>
      ))}
      {/* Entrance canopy */}
      <polygon points={`${w * 0.12},${buildingH * 0.7} ${w * 0.25},${buildingH * 0.7 - h * 0.05} ${w * 0.25},${buildingH * 0.65 - h * 0.05} ${w * 0.12},${buildingH * 0.65}`} fill="#E53935" />
      <rect x={w * 0.14} y={buildingH * 0.72} width={w * 0.08} height={buildingH * 0.22} fill="#455A64" />
      {/* Helipad */}
      <ellipse cx={w * 0.45} cy={-2} rx={w * 0.12} ry={h * 0.08} fill="#9E9E9E" stroke="#757575" strokeWidth={0.5} />
      <text x={w * 0.45} y={1} fontSize="7" fill="#F44336" textAnchor="middle" fontWeight="bold">H</text>
    </svg>
  );
};

// School
export const School: React.FC<BuildingProps> = ({ size = TILE_WIDTH }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 0.85;
  const towerH = h * 0.5;
  const totalH = h + buildingH + towerH;
  const groundY = buildingH + towerH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#4a7c3f" stroke="#2d4a26" strokeWidth={0.5} />
      {/* Building */}
      <IsometricBox w={w * 0.85} h={h * 0.85} depth={buildingH} topColor="#FF8A65" leftColor="#FF7043" rightColor="#FFAB91" yOffset={towerH} />
      {/* Windows */}
      {[0.2, 0.5].map((yFrac, i) => (
        <g key={i}>
          <rect x={w * 0.48} y={towerH + buildingH * yFrac} width={w * 0.08} height={buildingH * 0.2} fill="#E3F2FD" stroke="#E64A19" strokeWidth={0.3} />
          <rect x={w * 0.6} y={towerH + buildingH * yFrac} width={w * 0.08} height={buildingH * 0.2} fill="#E3F2FD" stroke="#E64A19" strokeWidth={0.3} />
          <rect x={w * 0.72} y={towerH + buildingH * yFrac} width={w * 0.06} height={buildingH * 0.2} fill="#E3F2FD" stroke="#E64A19" strokeWidth={0.3} />
        </g>
      ))}
      {/* Clock tower */}
      <rect x={w * 0.2} y={0} width={w * 0.15} height={towerH + buildingH * 0.2} fill="#FFAB91" stroke="#E64A19" strokeWidth={0.5} />
      <polygon points={`${w * 0.2},0 ${w * 0.275},-8 ${w * 0.35},0`} fill="#BF360C" />
      {/* Clock */}
      <circle cx={w * 0.275} cy={towerH * 0.4} r={5} fill="#FFF" stroke="#E64A19" strokeWidth={0.5} />
      <line x1={w * 0.275} y1={towerH * 0.4} x2={w * 0.275} y2={towerH * 0.25} stroke="#333" strokeWidth={0.5} />
      <line x1={w * 0.275} y1={towerH * 0.4} x2={w * 0.3} y2={towerH * 0.45} stroke="#333" strokeWidth={0.5} />
      {/* Flag */}
      <line x1={w * 0.85} y1={towerH + buildingH * 0.3} x2={w * 0.85} y2={towerH - 5} stroke="#5D4037" strokeWidth={1} />
      <polygon points={`${w * 0.85},${towerH - 5} ${w * 0.85},${towerH + 3} ${w * 0.95},${towerH - 1}`} fill="#2196F3" />
    </svg>
  );
};


// Park
export const Park: React.FC<BuildingProps> = ({ size = TILE_WIDTH }) => {
  const w = size;
  const h = getTileHeight(w);
  const treeH = h * 0.7;
  const totalH = h + treeH;
  const groundY = treeH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`parkTree-${size}`} cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#81C784" />
          <stop offset="100%" stopColor="#388E3C" />
        </radialGradient>
      </defs>
      {/* Ground - grass */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#7CB342" stroke="#558B2F" strokeWidth={0.5} />
      {/* Path */}
      <path d={`M ${w * 0.25},${groundY + h * 0.45} Q ${w * 0.5},${groundY + h * 0.15} ${w * 0.75},${groundY + h * 0.45}`} fill="none" stroke="#D7CCC8" strokeWidth={3} />
      {/* Tree 1 - center */}
      <rect x={w/2 - 2} y={treeH * 0.4} width={4} height={treeH * 0.5} fill="#5D4037" />
      <ellipse cx={w/2} cy={treeH * 0.35} rx={w * 0.14} ry={treeH * 0.4} fill={`url(#parkTree-${size})`} />
      {/* Tree 2 */}
      <rect x={w * 0.72} y={treeH * 0.5} width={3} height={treeH * 0.4} fill="#6D4C41" />
      <ellipse cx={w * 0.735} cy={treeH * 0.45} rx={w * 0.1} ry={treeH * 0.32} fill="#66BB6A" />
      {/* Tree 3 */}
      <rect x={w * 0.22} y={treeH * 0.55} width={3} height={treeH * 0.35} fill="#5D4037" />
      <ellipse cx={w * 0.235} cy={treeH * 0.5} rx={w * 0.09} ry={treeH * 0.28} fill="#4CAF50" />
      {/* Bench */}
      <rect x={w * 0.52} y={groundY + h * 0.2} width={w * 0.12} height={3} fill="#8D6E63" />
      {/* Flowers */}
      <circle cx={w * 0.35} cy={groundY + h * 0.35} r={2} fill="#E91E63" />
      <circle cx={w * 0.4} cy={groundY + h * 0.3} r={2} fill="#FF5722" />
      <circle cx={w * 0.32} cy={groundY + h * 0.28} r={2} fill="#FFC107" />
    </svg>
  );
};

// Mall
export const Mall: React.FC<BuildingProps> = ({ size = TILE_WIDTH, powered = true }) => {
  const w = size;
  const h = getTileHeight(w);
  const buildingH = h * 1.1;
  const domeH = h * 0.3;
  const totalH = h + buildingH + domeH;
  const groundY = buildingH + domeH;
  
  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block' }}>
      {/* Ground/parking */}
      <polygon points={`${w/2},${groundY} ${w},${groundY + h/2} ${w/2},${totalH} 0,${groundY + h/2}`} fill="#757575" stroke="#616161" strokeWidth={0.5} />
      {/* Building */}
      <IsometricBox w={w * 0.9} h={h * 0.9} depth={buildingH} topColor="#E0E0E0" leftColor="#BDBDBD" rightColor="#F5F5F5" yOffset={domeH} />
      {/* Glass dome */}
      <path d={`M ${w * 0.35} ${domeH} Q ${w * 0.45} ${-domeH * 0.5} ${w * 0.55} ${domeH}`} fill="#80DEEA" stroke="#26C6DA" strokeWidth={0.5} opacity={0.8} />
      {/* Store fronts */}
      {[0.3, 0.5, 0.7].map((yFrac, i) => (
        <rect key={i} x={w * 0.5} y={domeH + buildingH * yFrac} width={w * 0.08} height={buildingH * 0.15} fill={powered ? "#FFF9C4" : "#333"} stroke="#0097A7" strokeWidth={0.3} />
      ))}
      {/* Mall sign */}
      <rect x={w * 0.52} y={domeH + buildingH * 0.1} width={w * 0.25} height={buildingH * 0.08} fill="#FF5722" />
      {/* Entrance */}
      <rect x={w * 0.12} y={domeH + buildingH * 0.6} width={w * 0.15} height={buildingH * 0.35} fill="#006064" />
      {/* Parking lines */}
      <line x1={w * 0.7} y1={groundY + h * 0.2} x2={w * 0.8} y2={groundY + h * 0.15} stroke="#FFF" strokeWidth={0.5} />
      <line x1={w * 0.75} y1={groundY + h * 0.25} x2={w * 0.85} y2={groundY + h * 0.2} stroke="#FFF" strokeWidth={0.5} />
      {!powered && <circle cx={w * 0.45} cy={domeH + 8} r={4} fill="#F44336" />}
    </svg>
  );
};

// Empty zoned tile
export const EmptyZonedTile: React.FC<{ zone: ZoneType; size?: number; highlight?: boolean }> = ({ zone, size = TILE_WIDTH, highlight }) => {
  return <IsometricTile color="#4a7c3f" size={size} zone={zone} highlight={highlight} />;
};

// Fire overlay
const FireOverlay: React.FC<{ size: number }> = ({ size }) => {
  const w = size;
  const h = getTileHeight(w);
  return (
    <svg 
      width={w} 
      height={h * 2} 
      viewBox={`0 0 ${w} ${h * 2}`} 
      style={{ position: 'absolute', top: -h, left: 0, pointerEvents: 'none' }}
    >
      <defs>
        <radialGradient id="fireGlow" cx="50%" cy="80%" r="60%">
          <stop offset="0%" stopColor="#ff6b00" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ff0000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={w/2} cy={h} rx={w/3} ry={h * 0.8} fill="url(#fireGlow)">
        <animate attributeName="ry" values={`${h * 0.8};${h * 0.9};${h * 0.8}`} dur="0.3s" repeatCount="indefinite" />
      </ellipse>
      <path 
        d={`M${w/2} ${h * 0.3} Q${w/2 + 8} ${h * 0.5} ${w/2 + 5} ${h} Q${w/2 + 10} ${h * 1.3} ${w/2} ${h * 1.6} Q${w/2 - 10} ${h * 1.3} ${w/2 - 5} ${h} Q${w/2 - 8} ${h * 0.5} ${w/2} ${h * 0.3}`}
        fill="#ff4500"
        opacity="0.9"
      >
        <animate attributeName="opacity" values="0.9;1;0.7;0.9" dur="0.2s" repeatCount="indefinite" />
      </path>
      <path 
        d={`M${w/2} ${h * 0.5} Q${w/2 + 4} ${h * 0.7} ${w/2 + 2} ${h} Q${w/2 + 5} ${h * 1.2} ${w/2} ${h * 1.4} Q${w/2 - 5} ${h * 1.2} ${w/2 - 2} ${h} Q${w/2 - 4} ${h * 0.7} ${w/2} ${h * 0.5}`}
        fill="#ffff00"
        opacity="0.8"
      />
    </svg>
  );
};

// Building renderer
export const BuildingRenderer: React.FC<{
  buildingType: BuildingType;
  level?: number;
  powered?: boolean;
  zone?: ZoneType;
  highlight?: boolean;
  size?: number;
  onFire?: boolean;
  roadAdjacency?: RoadAdjacency;
}> = ({ buildingType, level = 1, powered = true, zone = 'none', highlight = false, size = TILE_WIDTH, onFire = false, roadAdjacency }) => {
  const renderBuilding = () => {
    // Check if we have a PNG image for this building type
    const imageConfig = BUILDING_IMAGES[buildingType];
    if (imageConfig) {
      return <ImageBuilding src={imageConfig.src} size={size} tileWidth={imageConfig.tileWidth} tileHeight={imageConfig.tileHeight} alt={buildingType} scale={imageConfig.scale} verticalOffset={imageConfig.verticalOffset} baseTileColor={imageConfig.baseTileColor} />;
    }
    
    // Fallback to SVG-based buildings for types without images
    switch (buildingType) {
      case 'empty':
      case 'grass':
        return zone !== 'none' ? <EmptyZonedTile zone={zone} size={size} highlight={highlight} /> : <GrassTile size={size} />;
      case 'water':
        return <WaterTile size={size} />;
      case 'tree':
        return <TreeTile size={size} />;
      case 'road':
        return <RoadTile size={size} adjacency={roadAdjacency} />;
      case 'shop_small':
        return <SmallShop size={size} powered={powered} />;
      case 'shop_medium':
        return <OfficeLow size={size} powered={powered} />;
      case 'office_low':
        return <OfficeLow size={size} powered={powered} />;
      case 'office_high':
        return <OfficeHigh size={size} level={level} powered={powered} />;
      case 'mall':
        return <Mall size={size} powered={powered} />;
      case 'power_plant':
        return <PowerPlant size={size} />;
      case 'water_tower':
        return <WaterTower size={size} />;
      case 'stadium':
        return <Mall size={size} powered={powered} />; // Placeholder
      case 'museum':
        return <Mall size={size} powered={powered} />; // Placeholder
      case 'airport':
        return <FactoryLarge size={size} level={5} powered={powered} />; // Placeholder
      default:
        return <GrassTile size={size} />;
    }
  };
  
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {renderBuilding()}
      {onFire && <FireOverlay size={size} />}
    </div>
  );
};

export default BuildingRenderer;
