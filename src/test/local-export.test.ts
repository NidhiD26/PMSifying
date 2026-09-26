import { describe, it, expect } from 'vitest';
import {
  buildLocalVaultExport,
  serializeLocalVaultExport,
  LOCAL_EXPORT_FORMAT_VERSION,
} from '../lib/settings/local-export';
import type { UserPreferencesRecord } from '../types/db';

function makePreferences(overrides: Partial<UserPreferencesRecord> = {}): UserPreferencesRecord {
  return {
    id: 'user_prefs',
    averageCycleLength: 28,
    averagePeriodLength: 5,
    language: 'en',
    isPinEnabled: true,
    pinHash: 'a'.repeat(64),
    pinSalt: 'b'.repeat(32),
    updatedAt: new Date(1_700_000_000_000).toISOString(),
    ...overrides,
  };
}

const snapshot = {
  cycles: [],
  dailyLogs: [],
  reminders: [],
  preferences: makePreferences(),
};

const NOW = new Date('2026-03-05T12:00:00.000Z');

describe('buildLocalVaultExport', () => {
  it('stamps the format and version', () => {
    const payload = buildLocalVaultExport(snapshot, NOW);
    expect(payload.format).toBe('pmsify-local-vault');
    expect(payload.formatVersion).toBe(LOCAL_EXPORT_FORMAT_VERSION);
  });

  it('records the export time from the injected clock', () => {
    const payload = buildLocalVaultExport(snapshot, NOW);
    expect(payload.exportedAt).toBe('2026-03-05T12:00:00.000Z');
  });

  it('carries the raw records through unchanged', () => {
    const withRecords = {
      cycles: [{ id: 'c1' }],
      dailyLogs: [{ id: 'd1' }],
      reminders: [{ id: 'dailyCheckIn' }],
      preferences: makePreferences(),
    } as never;
    const payload = buildLocalVaultExport(withRecords, NOW);
    expect(payload.cycles).toHaveLength(1);
    expect(payload.dailyLogs).toHaveLength(1);
    expect(payload.reminders).toHaveLength(1);
  });
});

describe('PIN material is never exported', () => {
  it('omits pinHash and pinSalt from preferences', () => {
    const payload = buildLocalVaultExport(snapshot, NOW);
    expect(payload.preferences).not.toBeNull();
    expect(payload.preferences).not.toHaveProperty('pinHash');
    expect(payload.preferences).not.toHaveProperty('pinSalt');
  });

  it('leaks neither hash nor salt anywhere in the serialized file', () => {
    const json = serializeLocalVaultExport(buildLocalVaultExport(snapshot, NOW));
    expect(json).not.toContain('a'.repeat(64));
    expect(json).not.toContain('b'.repeat(32));
    expect(json).not.toContain('pinHash');
    expect(json).not.toContain('pinSalt');
  });

  it('keeps the non-sensitive preference fields', () => {
    const payload = buildLocalVaultExport(snapshot, NOW);
    expect(payload.preferences?.averageCycleLength).toBe(28);
    expect(payload.preferences?.language).toBe('en');
  });

  it('still reports that a PIN is enabled, so the export is honest about it', () => {
    const payload = buildLocalVaultExport(snapshot, NOW);
    expect(payload.preferences?.isPinEnabled).toBe(true);
  });

  it('handles a null preferences record without throwing', () => {
    const payload = buildLocalVaultExport({ ...snapshot, preferences: null }, NOW);
    expect(payload.preferences).toBeNull();
    expect(serializeLocalVaultExport(payload)).not.toContain('pin');
  });
});

describe('serializeLocalVaultExport', () => {
  it('produces valid, re-parsable JSON', () => {
    const json = serializeLocalVaultExport(buildLocalVaultExport(snapshot, NOW));
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe('pmsify-local-vault');
    expect(parsed).toHaveProperty('cycles');
    expect(parsed).toHaveProperty('dailyLogs');
    expect(parsed).toHaveProperty('reminders');
  });
});
