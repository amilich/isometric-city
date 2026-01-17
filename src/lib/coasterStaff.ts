import { StaffType } from '@/games/coaster/types';
import { msg } from 'gt-next';

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
    name: msg('Handyman'),
    hiringFee: 100,
    wage: 50,
    description: msg('Keeps paths clean and guests happy.'),
  },
  {
    type: 'mechanic',
    name: msg('Mechanic'),
    hiringFee: 150,
    wage: 70,
    description: msg('Inspects and repairs rides.'),
  },
  {
    type: 'security',
    name: msg('Security'),
    hiringFee: 120,
    wage: 60,
    description: msg('Maintains safety and order.'),
  },
  {
    type: 'entertainer',
    name: msg('Entertainer'),
    hiringFee: 80,
    wage: 40,
    description: msg('Boosts guest morale around the park.'),
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
