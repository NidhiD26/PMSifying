'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { LanguageSelector } from './language-selector';
import { Shield } from 'lucide-react';

export const HeaderBar: React.FC = () => {
  const t = useTranslations('privacy');

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2D8D0] bg-[#FDFBF7]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-[#2E8B57]" />
        <span className="text-xs font-medium text-[#5A5A66] hidden sm:inline">
          {t('offlineNotice')}
        </span>
        <span className="text-xs font-medium text-[#2E8B57] sm:hidden">
          100% Offline Local Vault
        </span>
      </div>
      <div className="flex items-center gap-4">
        <LanguageSelector />
      </div>
    </header>
  );
};
