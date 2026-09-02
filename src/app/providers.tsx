'use client';

import * as React from 'react';
import { NextIntlClientProvider, AbstractIntlMessages } from 'next-intl';

export interface ProvidersProps {
  children: React.ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
}

export const Providers: React.FC<ProvidersProps> = ({ children, locale, messages }) => {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Kolkata">
      {children}
    </NextIntlClientProvider>
  );
};

