import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IsoCoaster',
  description: 'Build the ultimate theme park with thrilling roller coasters, exciting rides, and happy guests!',
};

export default function CoasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
