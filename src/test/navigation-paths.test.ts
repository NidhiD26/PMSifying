import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  isLocaleSegment,
  splitLocalePath,
  stripLocalePrefix,
  withLocale,
} from '@/lib/navigation/locale-path';
import {
  ALL_NAV,
  HEALTHCARE_NAV,
  MOBILE_BAR_NAV,
  PRIMARY_NAV,
  SECONDARY_NAV,
  isNavItemActive,
} from '@/lib/navigation/nav-config';

type Messages = { [key: string]: string | Messages };

const en = JSON.parse(readFileSync('public/locales/en.json', 'utf8')) as Messages;

const read = (messages: Messages, key: string): string | undefined => {
  const value = key.split('.').reduce<unknown>((node, part) => {
    return node && typeof node === 'object' ? (node as Messages)[part] : undefined;
  }, messages);
  return typeof value === 'string' ? value : undefined;
};

describe('locale path helpers', () => {
  it('recognises only supported locale segments', () => {
    expect(isLocaleSegment('en')).toBe(true);
    expect(isLocaleSegment('hi')).toBe(true);
    expect(isLocaleSegment('kn')).toBe(true);
    expect(isLocaleSegment('fr')).toBe(false);
    expect(isLocaleSegment('health')).toBe(false);
    expect(isLocaleSegment(undefined)).toBe(false);
  });

  it('leaves the default locale unprefixed and prefixes the others', () => {
    expect(withLocale('/calendar', 'en')).toBe('/calendar');
    expect(withLocale('/calendar', 'hi')).toBe('/hi/calendar');
    expect(withLocale('/calendar', 'kn')).toBe('/kn/calendar');
    expect(withLocale('/', 'en')).toBe('/');
    expect(withLocale('/', 'hi')).toBe('/hi');
  });

  it('never prefixes twice, and retargets a path that already carries a locale', () => {
    expect(withLocale('/calendar', 'hi')).toBe('/hi/calendar');
    expect(withLocale('/hi/calendar', 'hi')).toBe('/hi/calendar');
    expect(withLocale('/hi/calendar', 'kn')).toBe('/kn/calendar');
    expect(withLocale('/kn/insights', 'en')).toBe('/insights');
  });

  it('keeps query strings and hashes attached to the right path', () => {
    expect(withLocale('/health?date=2026-09-01', 'hi')).toBe('/hi/health?date=2026-09-01');
    expect(withLocale('/health?date=2026-09-01', 'en')).toBe('/health?date=2026-09-01');
    expect(withLocale('/learn#top', 'kn')).toBe('/kn/learn#top');
    expect(splitLocalePath('/kn/health?date=2026-09-01')).toEqual({
      locale: 'kn',
      path: '/health?date=2026-09-01',
    });
  });

  it('strips a prefix from a path that looks like one deeper in the URL', () => {
    expect(splitLocalePath('/learn/hindi-basics')).toEqual({
      locale: null,
      path: '/learn/hindi-basics',
    });
    expect(stripLocalePrefix('/hi')).toBe('/');
    expect(stripLocalePrefix('/')).toBe('/');
  });
});

describe('navigation configuration', () => {
  it('covers every destination exactly once, with no duplicate hrefs', () => {
    const hrefs = ALL_NAV.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(ALL_NAV).toHaveLength(
      PRIMARY_NAV.length + SECONDARY_NAV.length + HEALTHCARE_NAV.length
    );
  });

  it('has a translated label for every destination', () => {
    for (const item of ALL_NAV) {
      expect(read(en, `nav.${item.labelKey}`), `nav.${item.labelKey}`).toBeTruthy();
    }
  });

  it('keeps the mobile bar to a subset of the primary destinations', () => {
    for (const item of MOBILE_BAR_NAV) {
      expect(PRIMARY_NAV).toContain(item);
    }
    expect(MOBILE_BAR_NAV.length).toBeLessThan(PRIMARY_NAV.length);
  });

  it('lights the dashboard only at the dashboard root', () => {
    expect(isNavItemActive('/', '/')).toBe(true);
    expect(isNavItemActive('/calendar', '/')).toBe(false);
    expect(isNavItemActive('/hi/calendar', '/')).toBe(false);
  });

  it('lights a parent for its nested routes, in any locale', () => {
    expect(isNavItemActive('/learn', '/learn')).toBe(true);
    expect(isNavItemActive('/hi/learn', '/learn')).toBe(true);
    expect(isNavItemActive('/kn/learn/pcos-overview', '/learn')).toBe(true);
    expect(isNavItemActive('/kn/reports/custom', '/reports')).toBe(true);
    expect(isNavItemActive('/kn/reminders', '/reports')).toBe(false);
  });
});
