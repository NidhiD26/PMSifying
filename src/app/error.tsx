'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  React.useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#FDFBF7]">
      <div className="h-16 w-16 rounded-full bg-[#C94A46]/10 flex items-center justify-center text-[#C94A46] mb-4">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold text-[#2D1B2D] mb-2">{t('error')}</h1>
      <p className="text-sm text-[#5A5A66] max-w-md mb-6">
        Something unexpected occurred. Your offline data remains safe and unaffected.
      </p>
      <Button onClick={reset} variant="primary">
        {t('retry')}
      </Button>
    </div>
  );
}
