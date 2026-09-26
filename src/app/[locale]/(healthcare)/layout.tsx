import * as React from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LanguageSelector } from '@/components/navigation/language-selector';
import { HEALTHCARE_NAV } from '@/lib/navigation/nav-config';
import { withLocale } from '@/lib/navigation/locale-path';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';

export default async function HealthcarePortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations('nav');
  const tHealthcare = await getTranslations('healthcare');

  const { locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const links = HEALTHCARE_NAV.map((item) => ({
    href: withLocale(item.href, locale),
    label: t(item.labelKey),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-[#FDFBF7]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2D8D0] bg-[#2D1B2D] px-4 py-4 text-[#FDFBF7] sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href={withLocale('/', locale)}
            className="flex items-center gap-2 text-lg font-bold text-[#FDFBF7] hover:underline"
          >
            PMSify
          </Link>
          <span className="rounded-full bg-[#E8837D]/20 px-2 py-0.5 text-xs font-medium text-[#E8837D]">
            {tHealthcare('badge')}
          </span>
        </div>

        <div className="flex items-center gap-3 text-sm sm:gap-4">
          <nav aria-label={tHealthcare('badge')} className="flex items-center gap-3 sm:gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-[40px] items-center text-[#FDFBF7]/85 hover:text-[#FDFBF7] hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="[&_select]:border-[#4A3350] [&_select]:bg-[#3D283D] [&_select]:text-[#FDFBF7] [&_svg]:text-[#FDFBF7]/70">
            <LanguageSelector />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>

      <footer className="border-t border-[#E2D8D0] px-4 py-4 sm:px-6">
        <p className="max-w-3xl text-xs leading-relaxed text-[#5A5A66]">
          {tHealthcare('footerNote')}
        </p>
      </footer>
    </div>
  );
}
