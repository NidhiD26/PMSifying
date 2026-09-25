import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import { Surface } from '@/components/ui/surface';
import { ShieldCheck } from 'lucide-react';

export default async function PrivacyPage() {
  const t = await getTranslations('privacy');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#2D1B2D]">{t('charterTitle')}</h1>
      <Surface variant="bordered" className="space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-[#2E8B57]" />
          <h2 className="text-lg font-semibold text-[#1E1E24]">
            {t('localStorageTitle')}
          </h2>
        </div>
        <p className="text-sm text-[#5A5A66]">{t('localStorageBody')}</p>
      </Surface>
    </div>
  );
}
