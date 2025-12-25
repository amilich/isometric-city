'use client';

import React from 'react';
import { Tool } from '@/types/game';

type IconProps = { size?: number; className?: string };

const MaterialIcon = ({ name, size = 20, className = '' }: IconProps & { name: string }) => {
  return (
    <span 
      className={`material-symbols-rounded select-none ${className}`} 
      style={{ fontSize: `${size}px`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {name}
    </span>
  );
};

export function SelectIcon(props: IconProps) { return <MaterialIcon name="near_me" {...props} />; }
export function BulldozeIcon(props: IconProps) { return <MaterialIcon name="cleaning_services" {...props} />; }
export function PlayIcon(props: IconProps) { return <MaterialIcon name="play_arrow" {...props} />; }
export function PauseIcon(props: IconProps) { return <MaterialIcon name="pause" {...props} />; }
export function FastForwardIcon(props: IconProps) { return <MaterialIcon name="fast_forward" {...props} />; }
export function CloseIcon(props: IconProps) { return <MaterialIcon name="close" {...props} />; }
export function RoadIcon(props: IconProps) { return <MaterialIcon name="add_road" {...props} />; }
export function TreeIcon(props: IconProps) { return <MaterialIcon name="forest" {...props} />; }
export function FireIcon(props: IconProps) { return <MaterialIcon name="local_fire_department" {...props} />; }
export function PowerIcon(props: IconProps) { return <MaterialIcon name="bolt" {...props} />; }
export function WaterIcon(props: IconProps) { return <MaterialIcon name="water_drop" {...props} />; }
export function PopulationIcon(props: IconProps) { return <MaterialIcon name="groups" {...props} />; }
export function JobsIcon(props: IconProps) { return <MaterialIcon name="work" {...props} />; }
export function MoneyIcon(props: IconProps) { return <MaterialIcon name="payments" {...props} />; }
export function HappyIcon(props: IconProps) { return <MaterialIcon name="sentiment_satisfied" {...props} />; }
export function HealthIcon(props: IconProps) { return <MaterialIcon name="health_and_safety" {...props} />; }
export function MedicalCrossIcon(props: IconProps) { return <MaterialIcon name="local_hospital" {...props} />; }
export function EducationIcon(props: IconProps) { return <MaterialIcon name="school" {...props} />; }
export function SafetyIcon(props: IconProps) { return <MaterialIcon name="local_police" {...props} />; }
export function EnvironmentIcon(props: IconProps) { return <MaterialIcon name="eco" {...props} />; }
export function BudgetIcon(props: IconProps) { return <MaterialIcon name="account_balance_wallet" {...props} />; }
export function ChartIcon(props: IconProps) { return <MaterialIcon name="monitoring" {...props} />; }
export function TrophyIcon(props: IconProps) { return <MaterialIcon name="emoji_events" {...props} />; }
export function AdvisorIcon(props: IconProps) { return <MaterialIcon name="support_agent" {...props} />; }
export function SettingsIcon(props: IconProps) { return <MaterialIcon name="settings" {...props} />; }
export function AlertIcon(props: IconProps) { return <MaterialIcon name="warning" {...props} />; }
export function InfoIcon(props: IconProps) { return <MaterialIcon name="info" {...props} />; }
export function BudgetSheetIcon(props: IconProps) { return <MaterialIcon name="receipt_long" {...props} />; }
export function PlaneIcon(props: IconProps) { return <MaterialIcon name="flight" {...props} />; }
export function MuseumIcon(props: IconProps) { return <MaterialIcon name="museum" {...props} />; }
export function CityHallIcon(props: IconProps) { return <MaterialIcon name="account_balance" {...props} />; }
export function AmusementParkIcon(props: IconProps) { return <MaterialIcon name="attractions" {...props} />; }
export function ShareIcon(props: IconProps) { return <MaterialIcon name="share" {...props} />; }
export function CheckIcon(props: IconProps) { return <MaterialIcon name="check" {...props} />; }
export function SubwayIcon(props: IconProps) { return <MaterialIcon name="subway" {...props} />; }
export function RailIcon(props: IconProps) { return <MaterialIcon name="directions_railway" {...props} />; }
export function SubwayStationIcon(props: IconProps) { return <MaterialIcon name="transfer_within_a_station" {...props} />; }
export function SearchIcon(props: IconProps) { return <MaterialIcon name="search" {...props} />; }
export function ExitIcon(props: IconProps) { return <MaterialIcon name="logout" {...props} />; }
export function ChevronRightIcon(props: IconProps) { return <MaterialIcon name="chevron_right" {...props} />; }

function ZoneIcon({ color, size = 20, className }: IconProps & { color: string }) {
  return (
    <span 
      className={`material-symbols-rounded select-none ${className}`} 
      style={{ fontSize: `${size}px`, color: color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      square
    </span>
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
