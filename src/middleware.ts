import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from '@/i18n/config';
import { isLocaleSegment, stripLocalePrefix } from '@/lib/navigation/locale-path';
import { isDemoHealthcareRole, DEMO_HEALTHCARE_COOKIE } from '@/lib/healthcare/cookies';
import { healthcareLoginHref } from '@/lib/healthcare/portal-routes';
import { getSupabasePublicEnv } from '@/lib/supabase/env';
import type { Locale } from '@/types/i18n';
import { DEFAULT_LOCALE } from '@/types/i18n';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

/**
 * Signed-out visitors to a staff healthcare portal go to that portal's sign-in page.
 *
 * WHY THIS IS HERE AND NOT ONLY IN THE PAGE
 * The pages already do this — `resolvePageFor` returns `unauthenticated` and the page
 * calls `redirect()`. On its own that redirect is not an HTTP redirect: the healthcare
 * segment has a `loading.tsx`, so the shell and the header stream first, and a redirect
 * thrown after the first flush can only be delivered inside the response body. The reader
 * gets a working navigation and a correct URL, but the browser was told `200 OK` for a
 * page that was never rendered, a bookmark or a plain `curl` sees a 200, and there is a
 * visible frame of an empty healthcare workspace on the way. Middleware runs before a
 * single byte of HTML exists, so the same decision is a real `307` with no flash.
 *
 * WHAT IT IS AND IS NOT ALLOWED TO DO
 * It answers one question — *is anybody signed in at all* — and the only answer that
 * changes behaviour is "no". It never decides who may read what:
 *
 *   - A session is never invented, widened or upgraded here. The role that authorises a
 *     read is still resolved on the server by `resolveHealthcareActor`, from the
 *     `profiles` row, so a cookie this file merely noticed is still a cookie the service
 *     has to agree with.
 *   - A signed-in reader is passed straight through. A doctor who types `/asha` is not
 *     bounced to a login form; they reach the page, which refuses them and offers the
 *     workspace their own role is. Role isolation is decided where the records are, not
 *     here, so nothing about this file can weaken it.
 *   - `not_configured` is not this file's business. A deployment with no database has no
 *     session cookie, and the correct screen for that is the portal's own explanation,
 *     which the page renders. Only the sign-in path is redirected.
 *
 * WHY A MISSING SESSION IS A SAFE DEFAULT HERE
 * Every branch that could get this wrong is one where a session *does* exist and is not
 * recognised, which would bounce a signed-in reader to a sign-in page. Both session
 * mechanisms are therefore detected positively and nothing else counts: the demo cookie,
 * and the Supabase auth cookie whose name is derived from the configured project URL
 * rather than guessed. When Supabase is not configured there is no third mechanism to
 * miss — `getPortalContext` falls back to the same demo cookie this file reads.
 */
function hasHealthcareSession(request: NextRequest): boolean {
  if (isDemoHealthcareRole(request.cookies.get(DEMO_HEALTHCARE_COOKIE)?.value)) return true;

  const env = getSupabasePublicEnv();
  if (!env) return false;

  // `@supabase/ssr` names the session cookie after the project ref, and splits it into
  // `.0`, `.1`, … chunks when it is too large for one cookie, so the base name matches
  // either shape. The ref comes from the URL the rest of the app is configured with, so
  // this cannot drift from the client that wrote the cookie.
  const ref = env.url.replace(/^https?:\/\//, '').split('.')[0];
  if (!ref) return false;

  return request.cookies
    .getAll()
    .some(({ name }) => name === `sb-${ref}-auth-token` || name.startsWith(`sb-${ref}-auth-token.`));
}

/**
 * The portal a healthcare path belongs to, or null when it is not a staff portal.
 *
 * `/health-camps` is deliberately absent. Camps are read by the `USER` role as well as by
 * staff and are the one healthcare surface a signed-out reader may be told about, so the
 * camp list renders its own explanation and its own healthcare sign-in link instead of
 * being redirected — which is also what it did before, and the redirect would only have
 * hidden a page that is meant to stay reachable.
 */
function staffPortalFor(path: string): 'ASHA' | 'DOCTOR' | null {
  const segments = path.split('/').filter(Boolean);
  const [first, second] = segments;

  if (first === 'asha') return second === 'login' ? null : 'ASHA';
  if (first === 'doctor') return second === 'login' ? null : 'DOCTOR';
  return null;
}

export default function middleware(request: NextRequest) {
  // The locale prefix is still on the URL at this point — `intlMiddleware` is what
  // rewrites it — so it is read off the front rather than assumed, and a `/hi/asha` that
  // gets sent to sign in is sent to the Hindi sign-in page.
  const [first] = request.nextUrl.pathname.split('/').filter(Boolean);
  const locale: Locale = isLocaleSegment(first) ? first : DEFAULT_LOCALE;
  const portal = staffPortalFor(stripLocalePrefix(request.nextUrl.pathname));

  if (portal && !hasHealthcareSession(request)) {
    const target = request.nextUrl.clone();
    target.pathname = healthcareLoginHref(portal, locale);
    target.search = '';
    return NextResponse.redirect(target);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_verifier|.*\\..*).*)'],
};
