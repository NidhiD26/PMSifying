import type { Metadata, Viewport } from 'next';
import { Outfit, Inter } from 'next/font/google';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from './providers';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "PMSify — Privacy-First Women's Health Ecosystem",
  description: 'Offline-first, dignified women health tracking and anonymous community ecosystem.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#2D1B2D',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${outfit.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-[#FDFBF7] text-[#1E1E24] antialiased">
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
