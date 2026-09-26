/**
 * Browser notification wrappers for local reminders.
 *
 * Privacy note: the notification body is intentionally generic. A lock screen
 * is visible to anyone standing nearby, so PMSify never puts a predicted date,
 * symptom, or diagnosis into notification text. The notification only says
 * "open PMSify"; the clinical context stays inside the app, behind the local
 * data store.
 */

export type NotificationSupport = 'unsupported' | 'default' | 'granted' | 'denied';

export function getNotificationSupport(): NotificationSupport {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as NotificationSupport;
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (getNotificationSupport() === 'unsupported') return 'unsupported';
  try {
    return (await Notification.requestPermission()) as NotificationSupport;
  } catch {
    return getNotificationSupport();
  }
}

export interface ReminderNotificationInput {
  title: string;
  body: string;
  /** Local tag, so a re-fired reminder replaces rather than stacks. */
  tag: string;
}

/** Shows a notification. Returns false when the platform refused. */
export function showReminderNotification(input: ReminderNotificationInput): boolean {
  if (getNotificationSupport() !== 'granted') return false;
  try {
    new Notification(input.title, {
      body: input.body,
      tag: input.tag,
      icon: '/favicon.ico',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Honest capability statement shown in the Reminders screen.
 * PMSify has no background push service, so a reminder can only fire while the
 * app is open in a tab. This string keeps that limit visible instead of
 * implying a promise the product cannot keep.
 */
export const NOTIFICATION_LIMITATION_KEY = 'reminders.limitationWhileClosed';
