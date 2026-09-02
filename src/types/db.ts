import type { CycleDomainModel, DailyLogDomainModel } from './health';

export interface UserPreferencesRecord {
  id: string; // 'user_prefs'
  isPinEnabled: boolean;
  pinHash?: string;
  pinSalt?: string;
  language: string;
  averageCycleLength: number;
  averagePeriodLength: number;
  updatedAt: string;
}

export type CycleRecord = CycleDomainModel;
export type DailyLogRecord = DailyLogDomainModel;
