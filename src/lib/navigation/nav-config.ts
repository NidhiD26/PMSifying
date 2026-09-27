/**
 * The one place the app's navigation is defined.
 *
 * Desktop sidebar, mobile bottom bar, the mobile "all sections" sheet and the
 * healthcare header all read from this list, so a destination can never be
 * reachable from one surface and missing from another, and no label can drift
 * between them. Every entry points at a route that exists.
 *
 * Order is deliberate: the modules someone opens daily come first, the
 * settings-shaped modules sit under their own heading, and the healthcare
 * portals stay in a group of their own because they are a separate,
 * authenticated system that must not read the local tracking data.
 */

import type * as React from 'react';
import {
  Activity,
  BarChart2,
  Bell,
  BookOpen,
  Bot,
  Calendar,
  CalendarCheck,
  FileText,
  HeartPulse,
  Home,
  MessageSquare,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { stripLocalePrefix } from './locale-path';

export type NavIcon = React.ComponentType<{ className?: string }>;

/**
 * The roles the healthcare navigation can be built for.
 *
 * Deliberately a duplicate of the four `HealthcareRole` values rather than an import
 * of them: this module is imported by client components, and a nav list that pulled in
 * the healthcare domain types would drag the clinical vocabulary into the personal
 * app's bundle to say "ASHA". If a role is ever added, the switch in
 * `healthcareNavForRole` is the place it has to be handled, and TypeScript will say so.
 */
export type HealthcareNavRole = 'USER' | 'ASHA' | 'DOCTOR' | 'ADMIN';

export interface NavItem {
  /** Locale-agnostic app path. Locale handling lives in `withLocale`. */
  href: string;
  /** Key inside the `nav` message namespace. */
  labelKey: string;
  icon: NavIcon;
}

/** Personal health tracking destinations. */
export const PERSONAL_NAV: NavItem[] = [
  { href: '/', labelKey: 'dashboard', icon: Home },
  { href: '/calendar', labelKey: 'calendar', icon: Calendar },
  { href: '/health', labelKey: 'health', icon: Activity },
  { href: '/insights', labelKey: 'insights', icon: BarChart2 },
  { href: '/reports', labelKey: 'reports', icon: FileText },
  { href: '/reminders', labelKey: 'reminders', icon: Bell },
];

/** Educational, AI assistant, and community features. */
export const EXPLORE_NAV: NavItem[] = [
  { href: '/learn', labelKey: 'learn', icon: BookOpen },
  { href: '/ai-assistant', labelKey: 'aiAssistant', icon: Bot },
  { href: '/secret-chat', labelKey: 'secretChat', icon: MessageSquare },
];

/** Healthcare entry points for discovery & staff workflows. */
export const HEALTHCARE_DEMO_NAV: NavItem[] = [
  { href: '/asha', labelKey: 'asha', icon: Users },
  { href: '/doctor', labelKey: 'doctor', icon: Stethoscope },
  { href: '/health-camps', labelKey: 'healthCamps', icon: HeartPulse },
];

/** System preferences and privacy controls. */
export const SYSTEM_NAV: NavItem[] = [
  { href: '/privacy', labelKey: 'privacy', icon: ShieldCheck },
  { href: '/settings', labelKey: 'settings', icon: Settings },
];

/** Primary modules export for backwards compatibility. */
export const PRIMARY_NAV: NavItem[] = [...PERSONAL_NAV, ...EXPLORE_NAV];

/** Secondary modules export for backwards compatibility. */
export const SECONDARY_NAV: NavItem[] = SYSTEM_NAV;

/**
 * A different system: authenticated, role-scoped, and not fed by local data.
 *
 * This is the union of every healthcare destination, so `ALL_NAV` stays a complete
 * index of where the app can take you and the "every href exists" claim above keeps
 * being true. What a given person is *offered* is `healthcareNavForRole` below, which
 * filters this list rather than maintaining a second one — a destination that exists
 * but is not offered is a page that explains itself, whereas a destination offered
 * twice or with two labels is a bug nobody notices.
 */
export const HEALTHCARE_NAV: NavItem[] = [
  { href: '/asha', labelKey: 'asha', icon: Home },
  { href: '/asha/households', labelKey: 'households', icon: Users },
  { href: '/asha/cases', labelKey: 'cases', icon: FileText },
  { href: '/asha/referrals', labelKey: 'referrals', icon: Stethoscope },
  { href: '/asha/follow-ups', labelKey: 'followUps', icon: CalendarCheck },
  { href: '/doctor', labelKey: 'doctor', icon: Home },
  { href: '/doctor/referrals', labelKey: 'referrals', icon: Stethoscope },
  { href: '/doctor/cases', labelKey: 'cases', icon: FileText },
  { href: '/doctor/follow-ups', labelKey: 'followUps', icon: CalendarCheck },
  { href: '/health-camps', labelKey: 'healthCamps', icon: HeartPulse },
];

/**
 * What a community health worker is offered, in the order they work.
 *
 * Households and cases are the work; referrals and follow-ups are the parts of that
 * work that leave the building, so they follow. Health camps are last because they are
 * occasional rather than daily.
 */
export const ASHA_HEALTHCARE_NAV: NavItem[] = HEALTHCARE_NAV.filter((item) =>
  item.href.startsWith('/asha/') || item.href === '/health-camps' || item.href === '/asha'
);

/**
 * What a clinician is offered.
 *
 * No households, deliberately. A doctor's unit of access is the member on a case, not
 * the household the member belongs to, so there is no page for them to be sent to that
 * could answer "the whole register" — see `src/test/healthcare-privacy.test.ts`.
 */
export const DOCTOR_HEALTHCARE_NAV: NavItem[] = HEALTHCARE_NAV.filter(
  (item) => item.href.startsWith('/doctor/') || item.href === '/doctor' || item.href === '/health-camps'
);

/**
 * Health camps, for everybody.
 *
 * The one healthcare destination a plain member is offered: a published camp is open
 * to whoever turns up, so it is not a staff surface and needs no role to read.
 */
export const USER_HEALTHCARE_NAV: NavItem[] = HEALTHCARE_NAV.filter(
  (item) => item.href === '/health-camps'
);

/**
 * An administrator oversees the system rather than working in it, so there is no
 * queue that is theirs. The service agrees: `getAshaDashboard` needs an ASHA and
 * `getDoctorDashboard` needs a doctor, and `listHouseholds` deliberately has no
 * list-everything read for a role that oversees rather than works. So an admin is
 * offered the camp list, which `requireStaff` does admit, and no invented surface
 * that would have to be a page of things they cannot do.
 */
export const ADMIN_HEALTHCARE_NAV: NavItem[] = USER_HEALTHCARE_NAV;

/**
 * The healthcare destinations to offer somebody, given the role the server resolved.
 *
 * NAVIGATION IS NOT AUTHORISATION
 * This is a courtesy list and nothing more. It decides what a sidebar offers; it does
 * not decide what anybody may read, and it is not a security control. The service
 * answers every one of these questions again on the server, so hiding `/doctor` from
 * a member hides a link, not a record — and a member who types the path anyway gets the
 * `forbidden` envelope, not the page.
 *
 * `null` means "no role is established", which is the signed-out case, and is treated
 * as a plain member: the camps link is the only one that is genuinely open to all.
 */
export function healthcareNavForRole(role: HealthcareNavRole | null | undefined): NavItem[] {
  switch (role) {
    case 'ASHA':
      return ASHA_HEALTHCARE_NAV;
    case 'DOCTOR':
      return DOCTOR_HEALTHCARE_NAV;
    case 'ADMIN':
      return ADMIN_HEALTHCARE_NAV;
    default:
      return USER_HEALTHCARE_NAV;
  }
}

/** Every user-facing destination, primary first. */
export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV, ...HEALTHCARE_NAV];

/**
 * Destinations pinned to the mobile bottom bar. Everything else is one tap away
 * in the "all sections" sheet, so the bar stays usable at 360px wide.
 */
export const MOBILE_BAR_NAV: NavItem[] = [
  PRIMARY_NAV[0],
  PRIMARY_NAV[1],
  PRIMARY_NAV[2],
  PRIMARY_NAV[6],
];

/**
 * Active-route test, tolerant of nesting: `/` must not light up for every page,
 * and a child path such as `/learn/pcos` must light up its parent.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  const current = stripLocalePrefix(pathname || '/');
  if (current === '/') return href === '/';
  return current === href || current.startsWith(`${href}/`);
}
