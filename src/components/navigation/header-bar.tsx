'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { LanguageSelector } from './language-selector';
import { ShieldCheck, Heart } from 'lucide-react';
import { stripLocalePrefix } from '@/lib/navigation/locale-path';

export const HeaderBar: React.FC = () => {
  const tPrivacy = useTranslations('privacy');
  const tNav = useTranslations('nav');
  const pathname = usePathname() ?? '/';
  const rawPath = stripLocalePrefix(pathname);

  // Derive current page context title
  const pageTitleKeyMap: Record<string, string> = {
    '/': 'dashboard',
    '/calendar': 'calendar',
    '/health': 'health',
    '/insights': 'insights',
    '/learn': 'learn',
    '/ai-assistant': 'aiAssistant',
    '/secret-chat': 'secretChat',
    '/reminders': 'reminders',
    '/reports': 'reports',
    '/privacy': 'privacy',
    '/settings': 'settings',
  };

  const titleKey = pageTitleKeyMap[rawPath] || 'dashboard';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#E2D8D0] bg-[#FDFBF7]/95 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-3.5">
      <div className="flex items-center gap-3">
        {/* Mobile branding header icon */}
        <div className="flex items-center gap-2 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2D1B2D] text-[#FDFBF7]">
            <Heart className="h-4 w-4 fill-[#E8837D] text-[#E8837D]" />
          </span>
          <span className="font-bold text-[#2D1B2D]">PMSify</span>
        </div>

        {/* Current section indicator */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5A5A66]">
          <span className="rounded-md bg-[#F9EBEA] px-2 py-0.5 text-[#2D1B2D]">
            {tNav(titleKey)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Offline / Privacy Badge */}
        <div className="flex items-center gap-1.5 rounded-full border border-[#2E8B57]/20 bg-[#2E8B57]/10 px-3 py-1 text-xs font-medium text-[#2E8B57]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#2E8B57]" />
          <span className="hidden sm:inline">{tPrivacy('offlineNotice')}</span>
          <span className="sm:hidden">{tPrivacy('offlineVault')}</span>
        </div>

        <LanguageSelector />
      </div>
    </header>
  );
};
