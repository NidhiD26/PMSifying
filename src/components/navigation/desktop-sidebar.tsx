'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LocaleLink } from './locale-link';
import { NavGroupLabel, NavItemLink } from './nav-item-link';
import {
  PERSONAL_NAV,
  EXPLORE_NAV,
  HEALTHCARE_DEMO_NAV,
  SYSTEM_NAV,
  type NavItem,
} from '@/lib/navigation/nav-config';
import { ShieldCheck, Heart } from 'lucide-react';

export const DesktopSidebar: React.FC = () => {
  const t = useTranslations('nav');
  const tHealthcare = useTranslations('healthcare');
  const tApp = useTranslations('app');
  const pathname = usePathname() ?? '/';

  const groups: { title: string; items: NavItem[] }[] = [
    { title: t('personal'), items: PERSONAL_NAV },
    { title: t('explore'), items: EXPLORE_NAV },
    { title: t('healthcare'), items: HEALTHCARE_DEMO_NAV },
    { title: t('system'), items: SYSTEM_NAV },
  ];

  return (
    <aside
      className="hidden lg:flex flex-col w-64 shrink-0 border-r border-[#E2D8D0] bg-[#FFFFFF] min-h-screen sticky top-0 shadow-sm z-20"
      aria-label={t('desktopLabel')}
    >
      <LocaleLink
        href="/"
        className="flex items-center gap-3 px-5 py-5 border-b border-[#E2D8D0] hover:bg-[#F9EBEA]/50 transition-colors"
      >
        <span
          className="h-10 w-10 rounded-xl bg-[#2D1B2D] flex items-center justify-center text-[#FDFBF7] font-bold text-xl shadow-sm"
          aria-hidden="true"
        >
          <Heart className="h-5 w-5 fill-[#E8837D] text-[#E8837D]" />
        </span>
        <span className="min-w-0">
          <span className="block text-xl font-bold tracking-tight text-[#2D1B2D]">
            {tApp('title')}
          </span>
          <span className="block truncate text-xs font-medium text-[#5A5A66]">
            {t('healthEcosystem')}
          </span>
        </span>
      </LocaleLink>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3.5 py-4">
        {groups.map((group, idx) => (
          <div
            key={group.title}
            className={
              idx > 0
                ? 'flex flex-col gap-1 border-t border-[#E2D8D0]/60 pt-3.5'
                : 'flex flex-col gap-1'
            }
          >
            <NavGroupLabel>{group.title}</NavGroupLabel>
            {group.items.map((item) => (
              <NavItemLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-[#E2D8D0] p-4 bg-[#FDFBF7]/60">
        <div className="flex items-center gap-2 text-xs font-medium text-[#2E8B57]">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Local Vault Active</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[#5A5A66]">
          {tHealthcare('footerNote')}
        </p>
      </div>
    </aside>
  );
};
