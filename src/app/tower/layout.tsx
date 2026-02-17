import type { Metadata } from 'next';
import { getGT } from 'gt-next/server';

export async function generateMetadata(): Promise<Metadata> {
  const gt = await getGT();

  return {
    title: { absolute: gt('{brandName} — Tower Defense', { brandName: 'ISOTOWER' }) },
    description: gt('An isometric tower defense game built on the IsoCity/IsoCoaster engine. Place towers, defend your base, and survive escalating waves.'),
  };
}

export default function TowerLayout({ children }: { children: React.ReactNode }) {
  return children;
}

