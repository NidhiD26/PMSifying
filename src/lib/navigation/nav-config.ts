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

export interface NavItem {
  /** Locale-agnostic app path. Locale handling lives in `withLocale`. */
  href: string;
  /** Key inside the `nav` message namespace. */
  labelKey: string;
  icon: NavIcon;
}

/** Daily modules, in the order they are offered everywhere. */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', labelKey: 'dashboard', icon: Home },
  { href: '/calendar', labelKey: 'calendar', icon: Calendar },
  { href: '/health', labelKey: 'health', icon: Activity },
  { href: '/insights', labelKey: 'insights', icon: BarChart2 },
  { href: '/learn', labelKey: 'learn', icon: BookOpen },
  { href: '/ai-assistant', labelKey: 'aiAssistant', icon: Bot },
  { href: '/secret-chat', labelKey: 'secretChat', icon: MessageSquare },
];

/** Reminders, reports, privacy and settings: secondary, settings-shaped work. */
export const SECONDARY_NAV: NavItem[] = [
  { href: '/reminders', labelKey: 'reminders', icon: Bell },
  { href: '/reports', labelKey: 'reports', icon: FileText },
  { href: '/privacy', labelKey: 'privacy', icon: ShieldCheck },
  { href: '/settings', labelKey: 'settings', icon: Settings },
];

/** A different system: authenticated, role-scoped, and not fed by local data. */
export const HEALTHCARE_NAV: NavItem[] = [
  { href: '/asha', labelKey: 'asha', icon: Users },
  { href: '/doctor', labelKey: 'doctor', icon: Stethoscope },
  { href: '/health-camps', labelKey: 'healthCamps', icon: HeartPulse },
];

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
