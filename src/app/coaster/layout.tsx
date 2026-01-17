import { getGT } from 'gt-next/server';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const gt = await getGT();

  return {
    title: gt('Coaster Park — Tycoon Builder'),
    description: gt('Build thrilling roller coasters, manage guests, and run your own theme park.'),
  };
}

export default function CoasterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
