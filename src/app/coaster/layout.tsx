import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://iso-coaster.com'),
  title: {
    default: 'ISOROLLERCOASTER — Theme Park Builder',
    template: 'ISOROLLERCOASTER — %s',
    absolute: 'ISOROLLERCOASTER — Theme Park Builder',
  },
  description: 'Build the ultimate theme park with thrilling roller coasters, exciting rides, and happy guests!',
  openGraph: {
    title: 'ISOROLLERCOASTER — Theme Park Builder',
    description: 'Build the ultimate theme park with thrilling roller coasters, exciting rides, and happy guests!',
    type: 'website',
    siteName: 'IsoRollerCoaster',
    images: [
      {
        url: '/coaster/opengraph-image.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'IsoRollerCoaster - Theme park builder game screenshot'
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ISOROLLERCOASTER — Theme Park Builder',
    description: 'Build the ultimate theme park with thrilling roller coasters, exciting rides, and happy guests!',
    images: ['/coaster/opengraph-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IsoRollerCoaster',
  },
};

export default function CoasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
