'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DEFAULT_LOCALE } from '@/types/i18n';
import { splitLocalePath, withLocale } from '@/lib/navigation/locale-path';

/**
 * An internal link that keeps the reader in the language they are reading.
 *
 * `next/link` still does the navigating, so this stays a client-side
 * transition with no full page reload; the only thing added is the locale
 * prefix the URL already carries.
 *
 * The current locale is read from the live pathname. Outside a mounted router —
 * a unit test, for instance — there is no prefix to read and the default locale
 * is used, which is also what a server-rendered link would produce.
 */
export interface LocaleLinkProps extends React.ComponentPropsWithoutRef<typeof Link> {
  href: string;
}

export const LocaleLink = React.forwardRef<HTMLAnchorElement, LocaleLinkProps>(
  function LocaleLink({ href, ...rest }, ref) {
    const pathname = usePathname();
    const locale = splitLocalePath(pathname ?? '/').locale ?? DEFAULT_LOCALE;

    return <Link ref={ref} href={withLocale(href, locale)} {...rest} />;
  }
);
