import { getGT } from 'gt-next/server';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const gt = await getGT();

  return {
    title: 'IsoCoaster',
    description: gt(
      'Build the ultimate theme park with thrilling roller coasters, exciting rides, and happy guests!'
    ),
  };
}

export default function CoasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
