'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Home,
  Calendar,
  Activity,
  BarChart2,
  BookOpen,
  MessageSquare,
  Bot,
  FileText,
  Bell,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export const DesktopSidebar: React.FC = () => {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const normalizedPathname = pathname ? (pathname.replace(/^\/(en|hi|kn)/, '') || '/') : '/';

  const userNavItems = [
    { href: '/', label: t('home'), icon: Home },
    { href: '/calendar', label: t('calendar'), icon: Calendar },
    { href: '/health', label: t('health'), icon: Activity },
    { href: '/insights', label: t('insights'), icon: BarChart2 },
    { href: '/learn', label: t('learn'), icon: BookOpen },
    { href: '/secret-chat', label: t('secretChat'), icon: MessageSquare },
    { href: '/ai-assistant', label: t('aiAssistant'), icon: Bot },
    { href: '/reports', label: t('reports'), icon: FileText },
    { href: '/reminders', label: t('reminders'), icon: Bell },
    { href: '/settings', label: t('settings'), icon: Settings },
    { href: '/privacy', label: t('privacy'), icon: ShieldCheck },
  ];

  const healthcareNavItems = [
    { href: '/asha', label: t('asha'), icon: Users },
    { href: '/doctor', label: t('doctor'), icon: Stethoscope },
    { href: '/health-camps', label: t('healthCamps'), icon: Activity },
  ];

  return (
    <aside
      className="hidden lg:flex flex-col w-64 border-r border-[#E2D8D0] bg-[#FFFFFF] min-h-screen p-4 sticky top-0"
      aria-label="Desktop Navigation"
    >
      <div className="flex items-center gap-3 px-3 py-4 mb-4 border-b border-[#E2D8D0]">
        <div className="h-9 w-9 rounded-xl bg-[#2D1B2D] flex items-center justify-center text-[#FDFBF7] font-bold text-lg">
          P
        </div>
        <div>
          <span className="font-semibold text-lg text-[#2D1B2D] block leading-tight">PMSify</span>
          <span className="text-xs text-[#5A5A66]">{t('healthEcosystem')}</span>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-6 overflow-y-auto">
        <div className="flex flex-col gap-1">
          <span className="px-3 text-xs font-semibold uppercase tracking-wider text-[#5A5A66] mb-1">
            {t('personalTracker')}
          </span>
          {userNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = normalizedPathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]',
                  isActive
                    ? 'bg-[#2D1B2D] text-[#FDFBF7]'
                    : 'text-[#1E1E24] hover:bg-[#F9EBEA] hover:text-[#2D1B2D]'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col gap-1 pt-4 border-t border-[#E2D8D0]">
          <span className="px-3 text-xs font-semibold uppercase tracking-wider text-[#5A5A66] mb-1">
            {t('healthcarePortal')}
          </span>
          {healthcareNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = normalizedPathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]',
                  isActive
                    ? 'bg-[#2D1B2D] text-[#FDFBF7]'
                    : 'text-[#1E1E24] hover:bg-[#F9EBEA] hover:text-[#2D1B2D]'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
};
