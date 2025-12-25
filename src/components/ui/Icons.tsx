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
export function RailStationIcon(props: IconProps) { return <MaterialIcon name="train" {...props} />; }
export function SubwayStationIcon(props: IconProps) { return <MaterialIcon name="transfer_within_a_station" {...props} />; }
export function SearchIcon(props: IconProps) { return <MaterialIcon name="search" {...props} />; }
export function ExitIcon(props: IconProps) { return <MaterialIcon name="logout" {...props} />; }
export function ChevronRightIcon(props: IconProps) { return <MaterialIcon name="chevron_right" {...props} />; }

// Sports & Recreation
export function ParkIcon(props: IconProps) { return <MaterialIcon name="park" {...props} />; }
export function TennisIcon(props: IconProps) { return <MaterialIcon name="sports_tennis" {...props} />; }
export function BasketballIcon(props: IconProps) { return <MaterialIcon name="sports_basketball" {...props} />; }
export function SoccerIcon(props: IconProps) { return <MaterialIcon name="sports_soccer" {...props} />; }
export function BaseballIcon(props: IconProps) { return <MaterialIcon name="sports_baseball" {...props} />; }
export function FootballIcon(props: IconProps) { return <MaterialIcon name="sports_football" {...props} />; }
export function PoolIcon(props: IconProps) { return <MaterialIcon name="pool" {...props} />; }
export function SkateIcon(props: IconProps) { return <MaterialIcon name="skateboarding" {...props} />; }
export function GolfIcon(props: IconProps) { return <MaterialIcon name="golf_course" {...props} />; }
export function KartIcon(props: IconProps) { return <MaterialIcon name="toys" {...props} />; } // Go-kart approximation
export function CampingIcon(props: IconProps) { return <MaterialIcon name="camping" {...props} />; }
export function MountainIcon(props: IconProps) { return <MaterialIcon name="landscape" {...props} />; }
export function BoatIcon(props: IconProps) { return <MaterialIcon name="sailing" {...props} />; }
export function FarmIcon(props: IconProps) { return <MaterialIcon name="agriculture" {...props} />; }
export function OfficeIcon(props: IconProps) { return <MaterialIcon name="business" {...props} />; }
export function RocketIcon(props: IconProps) { return <MaterialIcon name="rocket_launch" {...props} />; }
export function CommunityIcon(props: IconProps) { return <MaterialIcon name="diversity_3" {...props} />; }

function ZoneIcon({ name, color, size = 20, className }: IconProps & { name: string, color: string }) {
  return (
    <span 
      className={`material-symbols-rounded select-none ${className}`} 
      style={{ fontSize: `${size}px`, color: color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {name}
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
  zone_residential: (props) => <ZoneIcon {...props} name="home" color="#22c55e" />, 
  zone_commercial: (props) => <ZoneIcon {...props} name="store" color="#38bdf8" />, 
  zone_industrial: (props) => <ZoneIcon {...props} name="factory" color="#f59e0b" />, 
  zone_dezone: (props) => <ZoneIcon {...props} name="format_color_reset" color="#94a3b8" />, 
  
  // Services
  police_station: SafetyIcon,
  fire_station: FireIcon,
  hospital: HealthIcon,
  school: EducationIcon,
  university: EducationIcon,
  
  // Parks
  park: ParkIcon,
  park_large: ParkIcon,
  tennis: TennisIcon,
  playground_small: (props) => <MaterialIcon name="child_care" {...props} />,
  playground_large: (props) => <MaterialIcon name="child_friendly" {...props} />,
  community_garden: (props) => <MaterialIcon name="yard" {...props} />,
  pond_park: (props) => <MaterialIcon name="water" {...props} />,
  park_gate: (props) => <MaterialIcon name="door_front" {...props} />,
  greenhouse_garden: (props) => <MaterialIcon name="potted_plant" {...props} />,

  // Sports
  basketball_courts: BasketballIcon,
  soccer_field_small: SoccerIcon,
  baseball_field_small: BaseballIcon,
  football_field: FootballIcon,
  baseball_stadium: BaseballIcon,
  swimming_pool: PoolIcon,
  skate_park: SkateIcon,
  bleachers_field: (props) => <MaterialIcon name="stadium" {...props} />,
  
  // Recreation
  mini_golf_course: GolfIcon,
  go_kart_track: KartIcon,
  amphitheater: (props) => <MaterialIcon name="theater_comedy" {...props} />,
  roller_coaster_small: AmusementParkIcon,
  campground: CampingIcon,
  cabin_house: (props) => <MaterialIcon name="cabin" {...props} />,
  mountain_lodge: (props) => <MaterialIcon name="chalet" {...props} />,
  mountain_trailhead: (props) => <MaterialIcon name="hiking" {...props} />,
  
  // Waterfront
  marina_docks_small: BoatIcon,
  pier_large: (props) => <MaterialIcon name="anchor" {...props} />,
  
  // Community
  community_center: CommunityIcon,
  animal_pens_farm: FarmIcon,
  office_building_small: OfficeIcon,
  
  // Utilities
  power_plant: PowerIcon,
  water_tower: WaterIcon,
  subway_station: SubwayStationIcon,
  rail_station: RailStationIcon,
  
  // Special
  stadium: TrophyIcon,
  museum: MuseumIcon,
  airport: PlaneIcon,
  space_program: RocketIcon,
  city_hall: CityHallIcon,
  amusement_park: AmusementParkIcon,
};
