import type { Metadata, Viewport } from 'next';
import { Playfair_Display, DM_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
  ),
  title: 'ISOCITY — Metropolis Builder',
  description: 'A richly detailed isometric city builder. Build your metropolis and manage resources with cars, planes, helicopters, boats, trains, citizens, and more.',
  openGraph: {
    title: 'ISOCITY — Metropolis Builder',
    description: 'A richly detailed isometric city builder. Build your metropolis and manage resources with cars, planes, helicopters, boats, trains, citizens, and more.',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1179,
        height: 1406,
        type: 'image/png',
        alt: 'ISOCITY - Isometric city builder game screenshot',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ISOCITY — Metropolis Builder',
    description: 'A richly detailed isometric city builder. Build your metropolis and manage resources with cars, planes, helicopters, boats, trains, citizens, and more.',
    images: [
      {
        url: '/opengraph-image',
        width: 1179,
        height: 1406,
        alt: 'ISOCITY - Isometric city builder game screenshot',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IsoCity',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f1219',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${playfair.variable} ${dmSans.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/assets/buildings/residential.png" />
      </head>
      <body className="bg-background text-foreground antialiased font-sans overflow-hidden">{children}<Analytics /></body>
    </html>
  );
}
