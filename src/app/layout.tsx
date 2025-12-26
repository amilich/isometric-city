import type { Metadata, Viewport } from 'next';
import { Playfair_Display, DM_Sans, Quicksand } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react'; // Fixed
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

const quicksand = Quicksand({
  subsets: ['latin'],
  variable: '--font-quicksand',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
  ),
  title: 'Truncgil MyCity — Kendi Şehrini Oluştur',
  description: 'Detaylı izometrik bir şehir kurma oyunu. Metropolünü inşa et ve kaynakları arabalar, uçaklar, helikopterler, gemiler, trenler, vatandaşlar ve daha fazlası ile yönet.',
  openGraph: {
    title: 'Truncgil MyCity — Kendi Şehrini Oluştur',
    description: 'Detaylı izometrik bir şehir kurma oyunu. Metropolünü inşa et ve kaynakları arabalar, uçaklar, helikopterler, gemiler, trenler, vatandaşlar ve daha fazlası ile yönet.',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1179,
        height: 1406,
        type: 'image/png',
        alt: 'Truncgil MyCity - İzometrik şehir kurma oyunu ekran görüntüsü',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Truncgil MyCity — Kendi Şehrini Oluştur',
    description: 'Detaylı izometrik bir şehir kurma oyunu. Metropolünü inşa et ve kaynakları arabalar, uçaklar, helikopterler, gemiler, trenler, vatandaşlar ve daha fazlası ile yönet.',
    images: [
      {
        url: '/opengraph-image',
        width: 1179,
        height: 1406,
        alt: 'Truncgil MyCity - Isometric city builder game screenshot',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Truncgil MyCity',
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
    <html lang="en" className={`dark ${playfair.variable} ${dmSans.variable} ${quicksand.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/assets/buildings/residential.png" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      </head>
      <body className="bg-background text-foreground antialiased font-sans overflow-hidden">{children}<Analytics /></body>
    </html>
  );
}
