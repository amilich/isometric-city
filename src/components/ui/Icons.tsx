'use client';

import React from 'react';
import { Tool } from '@/types/game';

type IconProps = { size?: number; className?: string };

const baseStroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function SelectIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M5 5h14v14H5z" />
      <path {...baseStroke} d="M5 5l14 14" />
    </svg>
  );
}

export function BulldozeIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M4 4l16 16M20 4L4 20" />
      <path {...baseStroke} d="M7 17h10" />
    </svg>
  );
}

export function PlayIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M8 5v14l10-7z" />
    </svg>
  );
}

export function PauseIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M8 5v14M16 5v14" />
    </svg>
  );
}

export function FastForwardIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M4 5l7 7-7 7zM13 5l7 7-7 7z" />
    </svg>
  );
}

export function CloseIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}

export function RoadIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Road surface */}
      <rect {...baseStroke} x="6" y="4" width="12" height="16" rx="1" />
      {/* Center lane divider */}
      <path {...baseStroke} d="M12 6v12" strokeDasharray="2 2" />
      {/* Side edges */}
      <path {...baseStroke} d="M6 8h12M6 16h12" />
    </svg>
  );
}

export function TreeIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 3c3 2 4 4.5 4 6.5A4 4 0 0 1 12 14a4 4 0 0 1-4-4.5C8 7.5 9 5 12 3z" />
      <path {...baseStroke} d="M12 14v5" />
      <path {...baseStroke} d="M9 20h6" />
    </svg>
  );
}

export function FireIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 3s2 3 2 5-2 4-2 4-2-2-2-4 2-5 2-5z" />
      <path {...baseStroke} d="M12 12c-2 1-3 3-3 4.5a3 3 0 0 0 6 0C15 15 14 13 12 12z" />
    </svg>
  );
}

export function PowerIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M13 2l-4 10h4l-2 10 8-12h-5l3-8z" />
    </svg>
  );
}

export function WaterIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />
      <path {...baseStroke} d="M9 15c.5.8 1.5 1.2 3 1.2 1.5 0 2.5-.4 3-1.2" />
    </svg>
  );
}

export function PopulationIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <circle {...baseStroke} cx="9" cy="8" r="3" />
      <path {...baseStroke} d="M4 19c0-3 2.5-5 5-5s5 2 5 5" />
      <circle {...baseStroke} cx="17" cy="10" r="2" />
      <path {...baseStroke} d="M15 19c0-2 1.2-3.3 2.5-3.8" />
    </svg>
  );
}

export function JobsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
      <path {...baseStroke} d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path {...baseStroke} d="M10 14h4" />
    </svg>
  );
}

export function MoneyIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect {...baseStroke} x="4" y="6" width="16" height="12" rx="2" />
      <path {...baseStroke} d="M12 9v6M9 12h6" />
    </svg>
  );
}

export function HappyIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <circle {...baseStroke} cx="12" cy="12" r="9" />
      <path {...baseStroke} d="M9 10h.01M15 10h.01M8 14c1 1 2.5 1.5 4 1.5s3-.5 4-1.5" />
    </svg>
  );
}

export function HealthIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <circle {...baseStroke} cx="12" cy="12" r="8.5" />
      <path {...baseStroke} d="M12 9v6M9 12h6" />
    </svg>
  );
}

export function MedicalCrossIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 2v20M2 12h20" />
      <circle {...baseStroke} cx="12" cy="12" r="10" />
    </svg>
  );
}

export function EducationIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M3 9l9-5 9 5-9 5-9-5z" />
      <path {...baseStroke} d="M12 14v7" />
      <path {...baseStroke} d="M7 12v4c0 1 2 2 5 2s5-1 5-2v-4" />
    </svg>
  );
}

export function SafetyIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 3l8 4v5c0 4.5-3.5 7.8-8 9-4.5-1.2-8-4.5-8-9V7z" />
      <path {...baseStroke} d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function EnvironmentIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 3c3 3 6 6 6 10a6 6 0 0 1-12 0c0-4 3-7 6-10z" />
      <path {...baseStroke} d="M12 10v6M9 14h6" />
    </svg>
  );
}

export function BudgetIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M4 7h16v10H4z" />
      <path {...baseStroke} d="M8 11h4M8 15h8" />
      <circle {...baseStroke} cx="16" cy="9" r="1.2" />
    </svg>
  );
}

export function ChartIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M4 19h16" />
      <path {...baseStroke} d="M7 15l3-4 4 3 3-5" />
      <path {...baseStroke} d="M7 10h.01M10 11h.01M14 14h.01M17 9h.01" />
    </svg>
  );
}

export function TrophyIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M8 4h8v4a4 4 0 0 1-8 0z" />
      <path {...baseStroke} d="M10 14h4M9 19h6" />
      <path {...baseStroke} d="M6 6h-2v2a3 3 0 0 0 3 3" />
      <path {...baseStroke} d="M18 6h2v2a3 3 0 0 1-3 3" />
    </svg>
  );
}

export function AdvisorIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 3l7 4-7 4-7-4z" />
      <path {...baseStroke} d="M5 11v5l7 4 7-4v-5" />
    </svg>
  );
}

export function SettingsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <circle {...baseStroke} cx="12" cy="12" r="3" />
      <path {...baseStroke} d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function AlertIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 4l8 14H4z" />
      <path {...baseStroke} d="M12 10v4M12 17h.01" />
    </svg>
  );
}

export function InfoIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <circle {...baseStroke} cx="12" cy="12" r="9" />
      <path {...baseStroke} d="M12 10v6M12 7h.01" />
    </svg>
  );
}

export function BudgetSheetIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M6 4h9l3 3v13H6z" />
      <path {...baseStroke} d="M9 10h6M9 14h6M9 18h3" />
    </svg>
  );
}

export function PlaneIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M3 13l18-8-7 14-3-4-5 3z" />
    </svg>
  );
}

export function MuseumIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M4 20h16v-2H4z" />
      <path {...baseStroke} d="M6 18V8l6-4 6 4v10" />
      <path {...baseStroke} d="M8 12h2M14 12h2M10 16h4" />
    </svg>
  );
}

export function CityHallIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Building base */}
      <path {...baseStroke} d="M4 20h16v-8H4z" />
      {/* Columns */}
      <path {...baseStroke} d="M6 12V8M10 12V8M14 12V8M18 12V8" />
      {/* Dome/roof */}
      <path {...baseStroke} d="M4 8l8-4 8 4" />
      {/* Flag */}
      <path {...baseStroke} d="M12 4v2M12 4l2 1-2 1" />
    </svg>
  );
}

export function AmusementParkIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Ferris wheel circle */}
      <circle {...baseStroke} cx="12" cy="12" r="7" />
      {/* Center hub */}
      <circle {...baseStroke} cx="12" cy="12" r="1.5" />
      {/* Spokes */}
      <path {...baseStroke} d="M12 5l0 7M19 12l-7 0M12 19l0-7M5 12l7 0" />
      {/* Base/platform */}
      <path {...baseStroke} d="M6 20h12" />
      <path {...baseStroke} d="M8 20v-1M16 20v-1" />
    </svg>
  );
}

export function ShareIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Share nodes */}
      <circle {...baseStroke} cx="18" cy="5" r="3" />
      <circle {...baseStroke} cx="6" cy="12" r="3" />
      <circle {...baseStroke} cx="18" cy="19" r="3" />
      {/* Connecting lines */}
      <path {...baseStroke} d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

export function CheckIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function SubwayIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Train car body */}
      <rect {...baseStroke} x="4" y="8" width="16" height="10" rx="3" />
      {/* Windows */}
      <rect {...baseStroke} x="6" y="10" width="4" height="4" rx="1" />
      <rect {...baseStroke} x="14" y="10" width="4" height="4" rx="1" />
      {/* Wheels */}
      <circle {...baseStroke} cx="8" cy="19" r="1.5" />
      <circle {...baseStroke} cx="16" cy="19" r="1.5" />
      {/* Pantograph/top */}
      <path {...baseStroke} d="M10 8V5M14 8V5M10 5h4" />
    </svg>
  );
}

export function RailIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Two parallel rails */}
      <path {...baseStroke} d="M6 4v16" />
      <path {...baseStroke} d="M18 4v16" />
      {/* Cross ties */}
      <path {...baseStroke} d="M4 6h16" />
      <path {...baseStroke} d="M4 10h16" />
      <path {...baseStroke} d="M4 14h16" />
      <path {...baseStroke} d="M4 18h16" />
    </svg>
  );
}

export function SubwayStationIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Station entrance */}
      <path {...baseStroke} d="M4 19h16" />
      <path {...baseStroke} d="M6 19V9l6-4 6 4v10" />
      {/* Stairs going down */}
      <path {...baseStroke} d="M9 19v-3h2v-2h2v-2h2v7" />
      {/* "M" for Metro */}
      <path {...baseStroke} d="M8 10l2 2 2-2" />
    </svg>
  );
}

function ZoneIcon({ color, size = 18, className }: IconProps & { color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="3" fill={color} opacity="0.18" stroke="currentColor" strokeWidth="1.6" />
      <path {...baseStroke} d="M8 16l8-8" />
    </svg>
  );
}

export const ToolIcons: Partial<Record<Tool, React.FC<IconProps>>> = {
  select: SelectIcon,
  bulldoze: BulldozeIcon,
  road: RoadIcon,
  rail: RailIcon,
  subway: SubwayIcon,
  tree: TreeIcon,
  zone_residential: (props) => <ZoneIcon {...props} color="#22c55e" />, 
  zone_commercial: (props) => <ZoneIcon {...props} color="#38bdf8" />, 
  zone_industrial: (props) => <ZoneIcon {...props} color="#f59e0b" />, 
  zone_dezone: (props) => <ZoneIcon {...props} color="#94a3b8" />,
  zone_water: (props) => <ZoneIcon {...props} color="#06b6d4" />,
  zone_land: (props) => <ZoneIcon {...props} color="#059669" />,
  police_station: SafetyIcon,
  fire_station: FireIcon,
  hospital: HealthIcon,
  school: EducationIcon,
  university: EducationIcon,
  park: TreeIcon,
  power_plant: PowerIcon,
  water_tower: WaterIcon,
  subway_station: SubwayStationIcon,
  stadium: TrophyIcon,
  museum: MuseumIcon,
  airport: PlaneIcon,
  city_hall: CityHallIcon,
  amusement_park: AmusementParkIcon,
};

