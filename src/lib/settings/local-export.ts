/**
 * Full local-vault export.
 *
 * Produces a portable JSON snapshot of everything PMSify holds on this
 * device. The report engine covers health statistics; this covers raw records
 * so a user can keep a personal backup.
 *
 * SECURITY: the PIN hash and salt are stripped. An export file is the kind of
 * thing that gets emailed to oneself, and shipping a crackable PIN hash
 * alongside it would silently defeat the local lock.
 */

import type { CycleDomainModel, DailyLogDomainModel } from '@/types/health';
import type { UserPreferencesRecord } from '@/types/db';
import type { ReminderRecord } from '@/types/reminders';

export const LOCAL_EXPORT_FORMAT_VERSION = 1;

export interface LocalVaultExport {
  format: 'pmsify-local-vault';
  formatVersion: number;
  exportedAt: string;
  cycles: CycleDomainModel[];
  dailyLogs: DailyLogDomainModel[];
  reminders: ReminderRecord[];
  /** PIN material is intentionally omitted. */
  preferences: Omit<UserPreferencesRecord, 'pinHash' | 'pinSalt'> | null;
}

export interface LocalVaultSnapshot {
  cycles: CycleDomainModel[];
  dailyLogs: DailyLogDomainModel[];
  reminders: ReminderRecord[];
  preferences: UserPreferencesRecord | null;
}

function stripPin(preferences: UserPreferencesRecord | null) {
  if (!preferences) return null;
  const safe: UserPreferencesRecord = { ...preferences };
  delete safe.pinHash;
  delete safe.pinSalt;
  return safe;
}

export function buildLocalVaultExport(
  snapshot: LocalVaultSnapshot,
  now: Date
): LocalVaultExport {
  return {
    format: 'pmsify-local-vault',
    formatVersion: LOCAL_EXPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    cycles: snapshot.cycles,
    dailyLogs: snapshot.dailyLogs,
    reminders: snapshot.reminders,
    preferences: stripPin(snapshot.preferences),
  };
}

export function serializeLocalVaultExport(payload: LocalVaultExport): string {
  return JSON.stringify(payload, null, 2);
}

export function downloadLocalVaultExport(payload: LocalVaultExport, filename: string): void {
  const blob = new Blob([serializeLocalVaultExport(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
