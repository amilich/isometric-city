import { StaffType } from '@/games/coaster/types';

export type StaffDefinition = {
  type: StaffType;
  name: string;
  hiringFee: number;
  wage: number;
  description: string;
};

export const STAFF_DEFINITIONS: StaffDefinition[] = [
  {
    type: 'handyman',
    name: 'Handyman',
    hiringFee: 100,
    wage: 50,
    description: 'Keeps paths clean and guests happy.',
  },
  {
    type: 'mechanic',
    name: 'Mechanic',
    hiringFee: 150,
    wage: 70,
    description: 'Inspects and repairs rides.',
  },
  {
    type: 'security',
    name: 'Security',
    hiringFee: 120,
    wage: 60,
    description: 'Maintains safety and order.',
  },
  {
    type: 'entertainer',
    name: 'Entertainer',
    hiringFee: 80,
    wage: 40,
    description: 'Boosts guest morale around the park.',
  },
];

export const STAFF_TYPE_COLORS: Record<StaffType, string> = {
  handyman: '#38bdf8',
  mechanic: '#f97316',
  security: '#facc15',
  entertainer: '#a855f7',
};

export function getStaffPatrolColor(staffId: number): string {
  const hue = (staffId * 47) % 360;
  return `hsl(${hue} 75% 60%)`;
}
