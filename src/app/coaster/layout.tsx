import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Coaster Park — Tycoon Builder',
  description: 'Build thrilling roller coasters, manage guests, and run your own theme park.',
};

export default function CoasterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
