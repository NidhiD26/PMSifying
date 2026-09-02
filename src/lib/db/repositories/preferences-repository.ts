import { db } from '../dexie-db';
import type { UserPreferencesRecord } from '@/types/db';

const DEFAULT_PREFS: UserPreferencesRecord = {
  id: 'user_prefs',
  isPinEnabled: false,
  language: 'en',
  averageCycleLength: 28,
  averagePeriodLength: 5,
  updatedAt: new Date().toISOString(),
};

export const PreferencesRepository = {
  async getPreferences(): Promise<UserPreferencesRecord> {
    try {
      const prefs = await db.user_preferences.get('user_prefs');
      if (!prefs) {
        await db.user_preferences.put(DEFAULT_PREFS);
        return DEFAULT_PREFS;
      }
      return prefs;
    } catch {
      return DEFAULT_PREFS;
    }
  },

  async updatePreferences(updates: Partial<UserPreferencesRecord>): Promise<void> {
    const current = await this.getPreferences();
    await db.user_preferences.put({
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },
};
