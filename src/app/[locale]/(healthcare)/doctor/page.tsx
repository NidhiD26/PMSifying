import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import { Surface } from '@/components/ui/surface';
import { Stethoscope } from 'lucide-react';

export default async function DoctorPage() {
  const tNav = await getTranslations('nav');
  const t = await getTranslations('healthcare');
  const tPrivacy = await getTranslations('privacy');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#2D1B2D]">{tNav('doctor')}</h1>
        <p className="mt-1 text-sm text-[#5A5A66]">{t('doctorDescription')}</p>
      </header>

      <Surface variant="bordered" className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2E8B57]/10 text-[#2E8B57]"
          aria-hidden="true"
        >
          <Stethoscope className="h-5 w-5" />
        </span>
        <p className="text-sm leading-relaxed text-[#5A5A66]">{tPrivacy('comingSoon')}</p>
      </Surface>
    </div>
  );
}
