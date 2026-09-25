import type { Metadata, Viewport } from 'next';
import { Outfit, Inter } from 'next/font/google';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales, isValidLocale } from '@/i18n/config';
import { Providers } from '../providers';
import '../globals.css';

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

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
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
