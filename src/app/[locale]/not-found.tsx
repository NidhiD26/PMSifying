'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const t = useTranslations('common');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#FDFBF7]">
      <h1 className="text-6xl font-bold text-[#2D1B2D] mb-4">404</h1>
      <h2 className="text-xl font-semibold text-[#1E1E24] mb-2">{t('notFound')}</h2>
      <p className="text-sm text-[#5A5A66] max-w-md mb-6">{t('notFoundBody')}</p>
      <Link href="/">
        <Button variant="primary">{t('backHome')}</Button>
      </Link>
    </div>
  );
}
