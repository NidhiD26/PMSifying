/**
 * Locale-preserving path helpers.
 *
 * The app runs with `localePrefix: 'as-needed'`, so the default locale has no
 * URL segment at all (`/calendar`) and the others do (`/hi/calendar`). A plain
 * `next/link` to `/calendar` therefore resolves against the middleware, which
 * answers with a redirect based on the stored locale cookie — the reader can be
 * moved to a different language, and every internal navigation pays for a
 * redirect round trip.
 *
 * These helpers keep the locale that is already in the URL, and they work the
 * same way on the server (where the locale is known from the route params) and
 * on the client (where it is read from `usePathname`).
 *
 * Pure and dependency-free, so it can be unit tested without a router.
 */

import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/types/i18n';

export function isLocaleSegment(segment: string | undefined): segment is Locale {
  return !!segment && (LOCALES as string[]).includes(segment);
}

export interface SplitLocalePath {
  /** The locale found in the pathname, or null when it carries no prefix. */
  locale: Locale | null;
  /** The path with any locale prefix removed. Always starts with `/`. */
  path: string;
}

/** Index of the first `?` or `#`, or -1. */
function suffixStart(href: string): number {
  const query = href.indexOf('?');
  const hash = href.indexOf('#');
  if (query === -1) return hash;
  if (hash === -1) return query;
  return Math.min(query, hash);
}

/**
 * Splits `/hi/calendar?month=9` into its locale and its unprefixed path.
 *
 * Only the first segment is inspected, so a route that merely starts with a
 * locale-shaped word is never mistaken for a prefixed path. Query strings and
 * hashes are left on `path`, so callers can re-attach them unchanged.
 */
export function splitLocalePath(href: string): SplitLocalePath {
  const at = suffixStart(href);
  const pathname = at === -1 ? href : href.slice(0, at);
  const suffix = at === -1 ? '' : href.slice(at);

  const segments = pathname.split('/');

  if (segments.length >= 2 && isLocaleSegment(segments[1])) {
    return {
      locale: segments[1],
      path: `/${segments.slice(2).join('/')}${suffix}`,
    };
  }

  return { locale: null, path: `${pathname}${suffix}` };
}

/** Strips any locale prefix, leaving a locale-agnostic app path. */
export function stripLocalePrefix(href: string): string {
  return splitLocalePath(href).path;
}

/**
 * Returns the href a reader should follow to reach `path` in `locale`.
 *
 * The default locale stays unprefixed, matching `localePrefix: 'as-needed'`;
 * every other locale keeps its own prefix. Query strings and hashes survive
 * untouched. A path that already carries a prefix is retargeted to the
 * requested locale rather than prefixed a second time, so a caller's idea of
 * the reader's current language always wins.
 */
export function withLocale(path: string, locale: Locale = DEFAULT_LOCALE): string {
  const appPath = stripLocalePrefix(path);

  if (locale === DEFAULT_LOCALE) return appPath;

  const at = suffixStart(appPath);
  const pathname = at === -1 ? appPath : appPath.slice(0, at);
  const suffix = at === -1 ? '' : appPath.slice(at);

  return `/${locale}${pathname === '/' ? '' : pathname}${suffix}`;
}
