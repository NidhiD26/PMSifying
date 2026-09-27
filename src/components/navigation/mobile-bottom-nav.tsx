'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import {
  ALL_NAV,
  MOBILE_BAR_NAV,
  PERSONAL_NAV,
  EXPLORE_NAV,
  HEALTHCARE_DEMO_NAV,
  SYSTEM_NAV,
  isNavItemActive,
  type NavItem,
} from '@/lib/navigation/nav-config';
import { LocaleLink } from './locale-link';
import { NavGroupLabel, NavItemLink } from './nav-item-link';

export const MobileBottomNav: React.FC = () => {
  const t = useTranslations('nav');
  const tNavMore = useTranslations('navMore');
  const pathname = usePathname() ?? '/';

  const [isOpen, setIsOpen] = React.useState(false);
  const panelId = React.useId();
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  // Close the sheet on navigation so it never lingers over the next screen.
  React.useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  // Move focus into the sheet so a keyboard or screen-reader user lands inside it.
  React.useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus();
  }, [isOpen]);

  // "More" is only highlighted for destinations it is the way to reach. The
  // pinned items have their own tab, and lighting both would point at two places.
  const barHrefs = React.useMemo(() => new Set(MOBILE_BAR_NAV.map((i) => i.href)), []);
  const hasSheetDestination = ALL_NAV.some(
    (item) => !barHrefs.has(item.href) && isNavItemActive(pathname, item.href)
  );

  const groups: { title: string; items: NavItem[] }[] = [
    { title: t('personal'), items: PERSONAL_NAV },
    { title: t('explore'), items: EXPLORE_NAV },
    { title: t('healthcare'), items: HEALTHCARE_DEMO_NAV },
    { title: t('system'), items: SYSTEM_NAV },
  ];

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E2D8D0] bg-[#FFFFFF]/95 px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
        aria-label={tNavMore('barLabel')}
      >
        <div className="flex items-stretch justify-between gap-0.5">
          {MOBILE_BAR_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(pathname, item.href);
            return (
              <LocaleLink
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors sm:text-[11px]',
                  isActive
                    ? 'bg-[#F9EBEA] font-semibold text-[#2D1B2D]'
                    : 'text-[#5A5A66] hover:text-[#2D1B2D]'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="w-full truncate text-center">{t(item.labelKey)}</span>
              </LocaleLink>
            );
          })}

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-expanded={isOpen}
            aria-controls={panelId}
            className={cn(
              'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors sm:text-[11px]',
              isOpen || hasSheetDestination
                ? 'bg-[#F9EBEA] font-semibold text-[#2D1B2D]'
                : 'text-[#5A5A66] hover:text-[#2D1B2D]'
            )}
          >
            <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="w-full truncate text-center">{tNavMore('open')}</span>
          </button>
        </div>
      </nav>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-[#1E1E24]/40 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${panelId}-title`}
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div
            id={panelId}
            className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-[#E2D8D0] bg-[#FDFBF7]"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-[#E2D8D0] bg-[#FDFBF7] px-4 py-4">
              <h2 id={`${panelId}-title`} className="text-lg font-bold text-[#2D1B2D]">
                {tNavMore('title')}
              </h2>
              <Button
                ref={closeButtonRef}
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                aria-label={tNavMore('close')}
                className="min-h-[40px] min-w-[40px] px-2 text-[#5A5A66] hover:bg-[#F9EBEA]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            <div className="space-y-6 p-4">
              {groups.map((group) => (
                <div key={group.title} className="space-y-1">
                  <NavGroupLabel>{group.title}</NavGroupLabel>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <NavItemLink
                          item={item}
                          pathname={pathname}
                          variant="sheet"
                          onNavigate={() => setIsOpen(false)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
