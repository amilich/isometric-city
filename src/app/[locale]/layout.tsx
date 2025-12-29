import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';

import type { Metadata, Viewport } from 'next';
import { Playfair_Display, DM_Sans, Quicksand } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import '@/app/globals.css';

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
  manifest: '/manifest.json',
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
    startupImage: [
      {
        url: '/icons/icon-512x512.png',
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icons/icon-512x512.png' },
    ],
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

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export default async function RootLayout({
  children,
  params
}: Props) {
  const {locale} = await params;
  
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }
 
  const messages = await getMessages();
 
  return (
    <html lang={locale} className={`dark ${playfair.variable} ${dmSans.variable} ${quicksand.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="application-name" content="MyCity" />
        <meta name="msapplication-TileColor" content="#0f1219" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    })
                    .catch(function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className="bg-background text-foreground antialiased font-sans overflow-hidden">
        <NextIntlClientProvider messages={messages}>
          {children}
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

