'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LocaleLink } from './locale-link';
import { NavGroupLabel, NavItemLink } from './nav-item-link';
import {
  HEALTHCARE_NAV,
  PRIMARY_NAV,
  SECONDARY_NAV,
  type NavItem,
} from '@/lib/navigation/nav-config';

export const DesktopSidebar: React.FC = () => {
  const t = useTranslations('nav');
  const tNavMore = useTranslations('navMore');
  const tHealthcare = useTranslations('healthcare');
  const tApp = useTranslations('app');
  const pathname = usePathname() ?? '/';

  const groups: { title: string; items: NavItem[]; bordered?: boolean }[] = [
    { title: t('personalTracker'), items: PRIMARY_NAV },
    { title: tNavMore('secondaryTitle'), items: SECONDARY_NAV, bordered: true },
    { title: t('healthcarePortal'), items: HEALTHCARE_NAV, bordered: true },
  ];

  return (
    <aside
      className="hidden lg:flex flex-col w-64 shrink-0 border-r border-[#E2D8D0] bg-[#FFFFFF] min-h-screen sticky top-0"
      aria-label={t('desktopLabel')}
    >
      <LocaleLink
        href="/"
        className="flex items-center gap-3 px-4 py-5 border-b border-[#E2D8D0] hover:bg-[#F9EBEA]/50 transition-colors"
      >
        <span
          className="h-9 w-9 rounded-xl bg-[#2D1B2D] flex items-center justify-center text-[#FDFBF7] font-bold text-lg"
          aria-hidden="true"
        >
          P
        </span>
        <span className="min-w-0">
          <span className="block text-lg font-semibold leading-tight text-[#2D1B2D]">
            {tApp('title')}
          </span>
          <span className="block truncate text-xs text-[#5A5A66]">{t('healthEcosystem')}</span>
        </span>
      </LocaleLink>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div
            key={group.title}
            className={
              group.bordered
                ? 'flex flex-col gap-1 border-t border-[#E2D8D0] pt-4'
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

      {/* The portals are a separate system; say so instead of implying continuity. */}
      <p className="border-t border-[#E2D8D0] px-4 py-4 text-[11px] leading-relaxed text-[#5A5A66]">
        {tHealthcare('footerNote')}
      </p>
    </aside>
  );
};
