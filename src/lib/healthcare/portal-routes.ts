import { withLocale } from '@/lib/navigation/locale-path';
import type { HealthcareRole } from '@/types/healthcare';
import type { Locale } from '@/types/i18n';

/**
 * Where healthcare authentication lives, and where it must never point.
 *
 * WHY THIS FILE EXISTS
 * Healthcare sign-in used to be routed by whatever `homeHref` a page happened to pass to
 * the blocked-portal gate, and the pages passed `withLocale('/', locale)` — the personal
 * cycle-tracking dashboard. So "Sign in to portal" on the ASHA portal, the doctor portal
 * and the camp list walked a signed-out health worker out of the healthcare system and
 * into somebody's menstrual calendar. The destination is not a styling decision and it is
 * not something a page should re-derive: it is the difference between a healthcare
 * session and a personal one, so it is written down once here, in locale-agnostic form,
 * and every healthcare surface asks this module.
 *
 * NOTHING HERE IS AN AUTHORISATION DECISION
 * These are links. Who may read what is still `resolvePageFor` for the page and the
 * service for the record, and pointing a sign-in link at `/asha/login` grants nobody
 * anything — the login endpoint re-checks the credentials, and every read behind the
 * redirect re-resolves the role from the session.
 *
 * WHY THE PATHS ARE STORED WITHOUT A LOCALE
 * The app runs `localePrefix: 'as-needed'`, so a path is a path and the language is a
 * property of where the reader is standing. Storing `/en/asha/login` here would pin the
 * English portal and break a Hindi reader the first time they opened a gate, so every
 * href leaves this module through `withLocale` and the locale the page already resolved.
 */
export type HealthcarePortal = 'ASHA' | 'DOCTOR' | 'MEMBER';

/**
 * The healthcare sign-in page for each portal.
 *
 * `MEMBER` is health camps, and it is the one entry that is not a page of its own. Camps
 * are not an organiser-only surface: `listCamps` is read by the `USER` role as well as by
 * staff, and only the *organiser actions* on a camp (`camp.canManage`, the roster, the
 * status change) are staff-only. So the camp list is a member surface that lives inside
 * the healthcare system, and a signed-out visitor needs a healthcare session to read it
 * — not a personal PMSify session, which is the thing this whole change exists to stop
 * mistaking for one.
 *
 * There is no third sign-in form to point at, and inventing one would be the fake
 * authentication system this project already has two working answers for: the community
 * health worker who registers the women and runs the camp, and the clinician who
 * attends it. The camp list is the ASHA worker's list, the ASHA portal is the one that
 * gets a visitor into healthcare at all, and the doctor portal is one link away from the
 * ASHA login page itself, so neither role is stranded.
 */
const PORTAL_LOGIN_PATH: Record<HealthcarePortal, string> = {
  ASHA: '/asha/login',
  DOCTOR: '/doctor/login',
  MEMBER: '/asha/login',
};

/** Where a signed-in member of each portal belongs, for the "wrong role" way back. */
const PORTAL_HOME_PATH: Record<HealthcarePortal, string> = {
  ASHA: '/asha',
  DOCTOR: '/doctor',
  MEMBER: '/health-camps',
};

/**
 * The portal a resolved role works in.
 *
 * `USER` and `ADMIN` both land on `MEMBER`, which is the camp list: an administrator
 * oversees the system rather than working a queue in it, and the service agrees —
 * `getAshaDashboard` needs an ASHA and `getDoctorDashboard` needs a doctor, so there is
 * no admin home to send somebody to.
 */
export function portalForRole(role: HealthcareRole): HealthcarePortal {
  if (role === 'ASHA') return 'ASHA';
  if (role === 'DOCTOR') return 'DOCTOR';
  return 'MEMBER';
}

/**
 * The healthcare sign-in page for a portal, in the reader's own language.
 *
 * `/en/asha` becomes `/en/asha/login` and `/hi/asha` becomes `/hi/asha/login`. The locale
 * comes from the page, never from a cookie, so a reader is not moved to another language
 * by clicking a sign-in link.
 */
export function healthcareLoginHref(portal: HealthcarePortal, locale: Locale): string {
  return withLocale(PORTAL_LOGIN_PATH[portal], locale);
}

/** The portal's own home, in the reader's own language. Never the personal dashboard. */
export function healthcareHomeHref(portal: HealthcarePortal, locale: Locale): string {
  return withLocale(PORTAL_HOME_PATH[portal], locale);
}
