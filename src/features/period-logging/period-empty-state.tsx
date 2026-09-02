'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { CalendarHeart, ShieldCheck } from 'lucide-react';

export interface PeriodEmptyStateProps {
  onLogFirst: () => void;
}

export const PeriodEmptyState: React.FC<PeriodEmptyStateProps> = ({ onLogFirst }) => {
  const t = useTranslations('period');

  return (
    <Surface variant="bordered" className="text-center py-12 px-6 max-w-xl mx-auto space-y-5">
      <div className="mx-auto h-16 w-16 rounded-full bg-[#F9EBEA] flex items-center justify-center text-[#2D1B2D]">
        <CalendarHeart className="h-8 w-8 text-[#E8837D]" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-[#2D1B2D]">{t('emptyTitle')}</h2>
        <p className="text-sm text-[#5A5A66] leading-relaxed max-w-md mx-auto">
          {t('emptyDescription')}
        </p>
      </div>

      <div className="pt-2">
        <Button variant="primary" onClick={onLogFirst}>
          {t('logFirst')}
        </Button>
      </div>

      <div className="pt-4 border-t border-[#E2D8D0] flex items-center justify-center gap-2 text-xs text-[#5A5A66]">
        <ShieldCheck className="h-4 w-4 text-[#2E8B57]" />
        <span>Stored 100% locally on your device with zero cloud sync.</span>
      </div>
    </Surface>
  );
};
