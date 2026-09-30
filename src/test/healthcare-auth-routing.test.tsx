import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NextRequest, type NextResponse } from 'next/server';
import en from '../../public/locales/en.json';
import {
  healthcareHomeHref,
  healthcareLoginHref,
  portalForRole,
} from '@/lib/healthcare/portal-routes';
import { LOCALES } from '@/types/i18n';
import { PortalGate } from '@/features/healthcare/portal-gate';
import middleware from '@/middleware';

/**
 * Healthcare sign-in has to land in healthcare, in the reader's own language.
 *
 * The regression held down here is specific and ugly: "Sign in to portal" on the ASHA
 * portal, the doctor portal and the camp list was a link to `/`, so a signed-out health
 * worker who clicked it left the healthcare system entirely and landed on the personal
 * cycle dashboard. Nothing in the code that decided it made that obvious — each page
 * passed its own `homeHref` to the gate, and thirteen of them passed the dashboard — so it
 * is pinned down here in one place instead: the paths, the gate's two destinations, and
 * the middleware that turns "no session on a staff page" into an actual redirect.
 */

/** Every healthcare path that must be unreachable without a session. */
const STAFF_PATHS = [
  '/asha',
  '/asha/cases',
  '/asha/cases/11111111-1111-4111-8111-111111111111',
  '/asha/register',
  '/asha/households',
  '/asha/households/11111111-1111-4111-8111-111111111111',
  '/asha/referrals',
  '/asha/follow-ups',
  '/doctor',
  '/doctor/cases',
  '/doctor/referrals',
  '/doctor/follow-ups',
];

/** The personal app, which this guard has no business touching. */
const PERSONAL_PATHS = [
  '/',
  '/calendar',
  '/health',
  '/insights',
  '/reports',
  '/ai-assistant',
  '/secret-chat',
  '/learn',
  '/settings',
];

const portalOf = (path: string): 'ASHA' | 'DOCTOR' => (path.startsWith('/doctor') ? 'DOCTOR' : 'ASHA');

/** The app's own rule, restated here so the expectation does not import its own subject. */
const expected = (path: string, locale: string) => (locale === 'en' ? path : `/${locale}${path}`);

/**
 * The shipped English strings, read rather than retyped.
 *
 * A hand-written copy of the copy is a second set of strings, and a gate can then pass a
 * test against a label the application does not have. `healthcare-ui.test.tsx` makes the
 * same argument; this file needs the healthcare namespace and nothing else.
 */
function resolve(key: string): string {
  let node: unknown = en;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : key;
}

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => resolve([namespace, key].filter(Boolean).join('.')),
}));

describe('healthcare portal paths', () => {
  it('sends every portal to a sign-in page, and never to the personal dashboard', () => {
    for (const locale of LOCALES) {
      expect(healthcareLoginHref('ASHA', locale)).toBe(expected('/asha/login', locale));
      expect(healthcareLoginHref('DOCTOR', locale)).toBe(expected('/doctor/login', locale));
      // Camps are read by the `USER` role as well as by staff, and there is no third
      // sign-in form in this project to invent for them — the community health worker
      // who runs the camp is the way in, and the doctor login is one link from there.
      expect(healthcareLoginHref('MEMBER', locale)).toBe(expected('/asha/login', locale));

      for (const portal of ['ASHA', 'DOCTOR', 'MEMBER'] as const) {
        expect(healthcareLoginHref(portal, locale)).not.toBe(expected('/', locale));
        expect(healthcareHomeHref(portal, locale)).not.toBe(expected('/', locale));
      }
    }
  });

  it('keeps the locale the reader arrived in', () => {
    expect(healthcareLoginHref('ASHA', 'hi')).toBe('/hi/asha/login');
    expect(healthcareLoginHref('ASHA', 'kn')).toBe('/kn/asha/login');
    expect(healthcareLoginHref('DOCTOR', 'hi')).toBe('/hi/doctor/login');
    expect(healthcareLoginHref('DOCTOR', 'kn')).toBe('/kn/doctor/login');
    // `en` is the default locale and this app runs `localePrefix: 'as-needed'`, so the
    // English portal carries no prefix — the same rule `/en/calendar` already follows.
    expect(healthcareLoginHref('ASHA', 'en')).toBe('/asha/login');
    expect(healthcareHomeHref('ASHA', 'en')).toBe('/asha');
    expect(healthcareHomeHref('DOCTOR', 'kn')).toBe('/kn/doctor');
  });

  it('maps every role to the one portal that has a workspace it may be shown', () => {
    expect(portalForRole('ASHA')).toBe('ASHA');
    expect(portalForRole('DOCTOR')).toBe('DOCTOR');
    // A member reads camps, and an administrator oversees rather than works a queue, so
    // both land on the camp list rather than on a page that would refuse them.
    expect(portalForRole('USER')).toBe('MEMBER');
    expect(portalForRole('ADMIN')).toBe('MEMBER');
  });
});

describe('the blocked-portal gate', () => {
  it('offers sign-in to a reader with no session and a workspace to one with the wrong role', () => {
    const signedOut = render(
      <PortalGate status="unauthenticated" homeHref="/hi/asha/login" workspaceHref="/hi/asha" />
    );
    expect(
      within(signedOut.container).getByRole('link', { name: 'Sign in to portal' })
    ).toHaveAttribute('href', '/hi/asha/login');
    signedOut.unmount();

    const wrongRole = render(
      <PortalGate status="forbidden" homeHref="/hi/asha/login" workspaceHref="/hi/doctor" />
    );
    // Not the login form: this reader already holds a session, and asking a doctor to
    // authenticate as an ASHA in order to be told again that she is not one is the other
    // half of the same bug.
    expect(
      within(wrongRole.container).getByRole('link', { name: 'Go to my workspace' })
    ).toHaveAttribute('href', '/hi/doctor');
  });

  it('falls back to the sign-in page when no workspace was supplied', () => {
    const { unmount } = render(<PortalGate status="forbidden" homeHref="/en/doctor/login" />);
    expect(screen.getByRole('link', { name: 'Go to my workspace' })).toHaveAttribute(
      'href',
      '/en/doctor/login'
    );
    unmount();
  });
});

describe('the middleware healthcare guard', () => {
  const ASHA_SESSION = { pmsify_demo_healthcare_session: 'ASHA' };
  const DOCTOR_SESSION = { pmsify_demo_healthcare_session: 'DOCTOR' };

  const run = (path: string, cookies: Record<string, string> = {}) => {
    const header = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    return middleware(new NextRequest(new URL(path, 'http://app.test'), { headers: { cookie: header } }));
  };

  /**
   * Where the guard sent the reader, as a path, or null when it sent them nowhere.
   *
   * `next-intl`'s own middleware also answers with a 307 — it normalises the default
   * locale away — so the status alone cannot tell "sent to sign in" from "sent to the same
   * page without the `/en` prefix". Only the destination can.
   */
  const destination = (res: NextResponse | undefined): string | null => {
    const location = res?.headers.get('location');
    return location ? new URL(location, 'http://app.test').pathname : null;
  };

  it('sends a signed-out visitor on every staff page to that portal’s sign-in', () => {
    for (const locale of LOCALES) {
      for (const path of STAFF_PATHS) {
        expect(destination(run(`/${locale}${path}`)), `${locale}${path}`).toBe(
          healthcareLoginHref(portalOf(path), locale)
        );
      }
    }
  });

  it('reaches the same place for the unprefixed English URLs', () => {
    for (const path of STAFF_PATHS) {
      expect(destination(run(path)), path).toBe(healthcareLoginHref(portalOf(path), 'en'));
    }
  });

  it('never redirects a sign-in page, which is where the redirect was sent', () => {
    for (const locale of LOCALES) {
      for (const path of ['/asha/login', '/doctor/login']) {
        const target = destination(run(`/${locale}${path}`));
        // Either nothing at all, or the same page with the default locale prefix
        // normalised away. Never a *different* sign-in page, and never a loop.
        expect(target === null || target === expected(path, locale), `${locale}${path}`).toBe(true);
      }
    }
  });

  it('leaves the camp list reachable, because camps are read by members as well as staff', () => {
    for (const locale of LOCALES) {
      const target = destination(run(`/${locale}/health-camps`));
      expect(target === null || target === expected('/health-camps', locale), locale).toBe(true);
    }
  });

  it('lets a signed-in reader through on every page, including the other role’s', () => {
    for (const session of [ASHA_SESSION, DOCTOR_SESSION]) {
      const who = Object.values(session)[0];
      for (const path of STAFF_PATHS) {
        // Not sent to sign in. A doctor who typed `/asha` must reach the page and be
        // refused by it, because that refusal is where role isolation is decided — a
        // login form here would quietly replace it with a re-authentication.
        const target = destination(run(path, session));
        expect(target === null || !target.includes('/login'), `${who} ${path}`).toBe(true);
      }
    }
  });

  it('leaves the personal app alone, signed in or out', () => {
    for (const path of PERSONAL_PATHS) {
      for (const locale of LOCALES) {
        for (const session of [{}, ASHA_SESSION, DOCTOR_SESSION]) {
          const target = destination(run(`/${locale}${path}`, session));
          expect(
            target === null || !target.includes('/login'),
            `${locale}${path} ${Object.values(session)[0] ?? 'signed out'}`
          ).toBe(true);
        }
      }
    }
  });

  it('treats a healthcare cookie naming a role that does not exist as no session at all', () => {
    // The cookie is not trusted for anything; recognising it only avoids bouncing a
    // reader who is genuinely signed in, so a value outside the two real roles counts
    // as nobody being signed in.
    const target = destination(run('/hi/asha', { pmsify_demo_healthcare_session: 'ADMIN' }));
    expect(target).toBe('/hi/asha/login');
  });

  it('drops the query string on the way to sign-in, so no path is smuggled through', () => {
    const res = run('/en/asha/cases?household=11111111-1111-4111-8111-111111111111');
    expect(destination(res)).toBe('/asha/login');
    expect(res?.headers.get('location')).not.toContain('household=');
  });
});
