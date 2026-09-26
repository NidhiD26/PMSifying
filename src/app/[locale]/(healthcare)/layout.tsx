import * as React from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LanguageSelector } from '@/components/navigation/language-selector';

export default async function HealthcarePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('nav');
  const tHealthcare = await getTranslations('healthcare');

  const links = [
    { href: '/asha', label: t('asha') },
    { href: '/doctor', label: t('doctor') },
    { href: '/health-camps', label: t('healthCamps') },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col">
      <header className="border-b border-[#E2D8D0] bg-[#2D1B2D] text-[#FDFBF7] px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="font-bold text-lg text-[#FDFBF7] hover:underline flex items-center gap-2"
          >
            PMSify
          </Link>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8837D]/20 text-[#E8837D] font-medium">
            {tHealthcare('badge')}
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-sm">
          <nav aria-label={tHealthcare('badge')} className="flex items-center gap-3 sm:gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[#FDFBF7]/85 hover:text-[#FDFBF7] hover:underline min-h-[40px] flex items-center"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="[&_select]:bg-[#3D283D] [&_select]:text-[#FDFBF7] [&_select]:border-[#4A3350] [&_svg]:text-[#FDFBF7]/70">
            <LanguageSelector />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">{children}</main>

      <footer className="border-t border-[#E2D8D0] px-4 sm:px-6 py-4">
        <p className="text-xs text-[#5A5A66] leading-relaxed max-w-3xl">{tHealthcare('footerNote')}</p>
      </footer>
    </div>
  );
}
