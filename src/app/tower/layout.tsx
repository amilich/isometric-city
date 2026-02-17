import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'ISOTOWER — Tower Defense' },
  description: 'An isometric tower defense game built on the IsoCity/IsoCoaster engine. Place towers, defend your base, and survive escalating waves.',
};

export default function TowerLayout({ children }: { children: React.ReactNode }) {
  return children;
}

