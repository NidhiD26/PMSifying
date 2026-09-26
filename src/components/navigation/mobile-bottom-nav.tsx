'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Home,
  Calendar,
  Activity,
  MessageSquare,
  MoreHorizontal,
  X,
  BarChart2,
  BookOpen,
  Bot,
  FileText,
  Bell,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  Stethoscope,
  HeartPulse,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type NavIcon = React.ComponentType<{ className?: string }>;

interface NavEntry {
  href: string;
  labelKey: string;
  icon: NavIcon;
}

/** The five highest-traffic destinations, always visible in the bar. */
const PRIMARY: NavEntry[] = [
  { href: '/', labelKey: 'home', icon: Home },
  { href: '/calendar', labelKey: 'calendar', icon: Calendar },
  { href: '/health', labelKey: 'health', icon: Activity },
  { href: '/secret-chat', labelKey: 'secretChat', icon: MessageSquare },
];

/** Everything reachable from the personal tracker that does not fit in the bar. */
const SECONDARY: NavEntry[] = [
  { href: '/insights', labelKey: 'insights', icon: BarChart2 },
  { href: '/learn', labelKey: 'learn', icon: BookOpen },
  { href: '/ai-assistant', labelKey: 'aiAssistant', icon: Bot },
  { href: '/reports', labelKey: 'reports', icon: FileText },
  { href: '/reminders', labelKey: 'reminders', icon: Bell },
  { href: '/settings', labelKey: 'settings', icon: SettingsIcon },
  { href: '/privacy', labelKey: 'privacy', icon: ShieldCheck },
];

/** Healthcare portals are a separate authenticated system, grouped apart. */
const HEALTHCARE: NavEntry[] = [
  { href: '/asha', labelKey: 'asha', icon: Users },
  { href: '/doctor', labelKey: 'doctor', icon: Stethoscope },
  { href: '/health-camps', labelKey: 'healthCamps', icon: HeartPulse },
];

export const MobileBottomNav: React.FC = () => {
  const t = useTranslations('nav');
  const tNavMore = useTranslations('navMore');
  const pathname = usePathname();

  const [isOpen, setIsOpen] = React.useState(false);
  const panelId = React.useId();

  const normalizedPathname = pathname ? (pathname.replace(/^\/(en|hi|kn)/, '') || '/') : '/';

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

  const hasActiveSecondary =
    SECONDARY.some((item) => normalizedPathname === item.href) ||
    HEALTHCARE.some((item) => normalizedPathname === item.href);

  const groups: { title: string; items: NavEntry[] }[] = [
    { title: t('personalTracker'), items: SECONDARY },
    { title: t('healthcarePortal'), items: HEALTHCARE },
  ];

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#E2D8D0] bg-[#FFFFFF] px-2 py-2 shadow-lg"
        aria-label={tNavMore('barLabel')}
      >
        <div className="flex items-center justify-around">
          {PRIMARY.map((item) => {
            const Icon = item.icon;
            const isActive = normalizedPathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl text-xs font-medium transition-colors',
                  isActive
                    ? 'text-[#2D1B2D] font-semibold bg-[#F9EBEA]'
                    : 'text-[#5A5A66] hover:text-[#2D1B2D]'
                )}
              >
                <Icon className="h-5 w-5 mb-0.5" aria-hidden="true" />
                <span className="truncate max-w-[64px] text-[11px]">{t(item.labelKey)}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-expanded={isOpen}
            aria-controls={panelId}
            className={cn(
              'flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl text-xs font-medium transition-colors',
              isOpen || hasActiveSecondary
                ? 'text-[#2D1B2D] font-semibold bg-[#F9EBEA]'
                : 'text-[#5A5A66] hover:text-[#2D1B2D]'
            )}
          >
            <MoreHorizontal className="h-5 w-5 mb-0.5" aria-hidden="true" />
            <span className="truncate max-w-[64px] text-[11px]">{tNavMore('open')}</span>
          </button>
        </div>
      </nav>

      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-[#1E1E24]/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${panelId}-title`}
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div
            id={panelId}
            className="bg-[#FDFBF7] rounded-t-3xl border-t border-[#E2D8D0] max-h-[85vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-[#FDFBF7] border-b border-[#E2D8D0] px-4 py-4 flex items-center justify-between">
              <h2 id={`${panelId}-title`} className="text-lg font-bold text-[#2D1B2D]">
                {tNavMore('title')}
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={tNavMore('close')}
                className="rounded-full p-2 text-[#5A5A66] hover:bg-[#F9EBEA] min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {groups.map((group) => (
                <div key={group.title} className="space-y-2">
                  <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-[#5A5A66]">
                    {group.title}
                  </h3>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = normalizedPathname === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium min-h-[48px] transition-colors',
                              isActive
                                ? 'bg-[#2D1B2D] text-[#FDFBF7]'
                                : 'text-[#1E1E24] hover:bg-[#F9EBEA]'
                            )}
                          >
                            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                            <span>{t(item.labelKey)}</span>
                          </Link>
                        </li>
                      );
                    })}
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
