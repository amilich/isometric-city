import type { Metadata } from 'next';
import { getGT } from 'gt-next/server';

export async function generateMetadata(): Promise<Metadata> {
  const gt = await getGT();

  return {
    title: gt('Coaster Park — Theme Park Tycoon'),
    description: gt('Design and manage a thriving rollercoaster theme park.'),
  };
}

export default function CoasterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
