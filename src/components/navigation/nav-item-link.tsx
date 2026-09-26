'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import { isNavItemActive, type NavItem } from '@/lib/navigation/nav-config';
import { LocaleLink } from './locale-link';

export interface NavItemLinkProps {
  item: NavItem;
  pathname: string;
  /** `sidebar` for the persistent rail, `sheet` for the mobile "all sections" list. */
  variant?: 'sidebar' | 'sheet';
  onNavigate?: () => void;
}

/**
 * One navigation row, used by the desktop sidebar and the mobile sheet.
 *
 * The active row is filled rather than tinted, and is announced with
 * `aria-current="page"`, so the current screen is obvious by shape as well as by
 * colour.
 */
export const NavItemLink: React.FC<NavItemLinkProps> = ({
  item,
  pathname,
  variant = 'sidebar',
  onNavigate,
}) => {
  const t = useTranslations('nav');
  const Icon = item.icon;
  const isActive = isNavItemActive(pathname, item.href);

  return (
    <LocaleLink
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl font-medium transition-colors',
        variant === 'sheet'
          ? 'px-3 py-3 text-sm min-h-[48px]'
          : 'px-3 py-2.5 text-sm min-h-[44px]',
        isActive
          ? 'bg-[#2D1B2D] text-[#FDFBF7]'
          : 'text-[#1E1E24] hover:bg-[#F9EBEA] hover:text-[#2D1B2D]'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{t(item.labelKey)}</span>
    </LocaleLink>
  );
};

/** Small uppercase heading that separates one group of destinations from the next. */
export const NavGroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-3 text-xs font-semibold uppercase tracking-wider text-[#5A5A66]">
    {children}
  </span>
);
