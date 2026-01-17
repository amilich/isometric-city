import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Coaster Park — Theme Park Tycoon',
  description: 'Design and manage a thriving rollercoaster theme park.',
};

export default function CoasterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
