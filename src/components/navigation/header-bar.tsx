'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { LanguageSelector } from './language-selector';
import { Shield } from 'lucide-react';

export const HeaderBar: React.FC = () => {
  const t = useTranslations('privacy');

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#E2D8D0] bg-[#FDFBF7]/90 px-4 py-3.5 backdrop-blur-md sm:px-6 sm:py-4">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-[#2E8B57]" />
        <span className="text-xs font-medium text-[#5A5A66] hidden sm:inline">
          {t('offlineNotice')}
        </span>
        <span className="text-xs font-medium text-[#2E8B57] sm:hidden">
          {t('offlineVault')}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <LanguageSelector />
      </div>
    </header>
  );
};
