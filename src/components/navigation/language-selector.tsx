'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { LOCALES, Locale } from '@/types/i18n';

export const LanguageSelector: React.FC = () => {
  const t = useTranslations('language');
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value as Locale;
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;

    // Replace locale in path if present, otherwise navigate to locale path
    const pathParts = pathname.split('/');
    if (LOCALES.includes(pathParts[1] as Locale)) {
      pathParts[1] = nextLocale;
      router.replace(pathParts.join('/'));
    } else {
      router.replace(`/${nextLocale}${pathname}`);
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      <Globe className="h-4 w-4 text-[#5A5A66]" aria-hidden="true" />
      <select
        value={currentLocale}
        onChange={handleLanguageChange}
        aria-label={t('select')}
        className="rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] px-3 py-2 text-sm text-[#1E1E24] focus-visible:border-[#E8837D] cursor-pointer min-h-[40px]"
      >
        <option value="en">{t('en')}</option>
        <option value="hi">{t('hi')}</option>
        <option value="kn">{t('kn')}</option>
      </select>
    </div>
  );
};
