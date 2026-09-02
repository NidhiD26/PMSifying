'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Home, Calendar, Activity, MessageSquare, Menu } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export const MobileBottomNav: React.FC = () => {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const mainNavItems = [
    { href: '/', label: t('home'), icon: Home },
    { href: '/calendar', label: t('calendar'), icon: Calendar },
    { href: '/health', label: t('health'), icon: Activity },
    { href: '/secret-chat', label: t('secretChat'), icon: MessageSquare },
    { href: '/settings', label: t('settings'), icon: Menu },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#E2D8D0] bg-[#FFFFFF] px-2 py-2 shadow-lg"
      aria-label="Mobile Navigation Bar"
    >
      <div className="flex items-center justify-around">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl text-xs font-medium transition-colors',
                isActive
                  ? 'text-[#2D1B2D] font-semibold bg-[#F9EBEA]'
                  : 'text-[#5A5A66] hover:text-[#2D1B2D]'
              )}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              <span className="truncate max-w-[64px] text-[11px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
