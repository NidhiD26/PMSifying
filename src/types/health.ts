export type FlowLevel = 'spotting' | 'light' | 'medium' | 'heavy';

export interface SymptomEntry {
  id: string; // Predefined (e.g. 'cramps', 'headache', 'bloating') or custom ID
  intensity?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export interface MoodEntry {
  id: string; // e.g. 'calm', 'anxious', 'energetic', 'irritable'
  intensity?: 1 | 2 | 3 | 4 | 5;
}

export interface CycleDomainModel {
  id?: number;
  startDate: string; // ISO Date YYYY-MM-DD
  endDate?: string;  // ISO Date YYYY-MM-DD
  cycleLength?: number; // Total cycle length in days
  periodLength?: number; // Period duration in days
  flow?: FlowLevel;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLogDomainModel {
  id?: number;
  date: string; // ISO Date YYYY-MM-DD (Unique key)
  symptoms: SymptomEntry[];
  mood: MoodEntry[];
  painLevel: number; // 0 (None) to 10 (Unbearable)
  sleepHours: number; // 0 to 24
  hydrationMl: number; // Milliliters (e.g. 0 to 10000)
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export class RepositoryError extends Error {
  constructor(message: string, public readonly code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'STORAGE_ERROR') {
    super(message);
    this.name = 'RepositoryError';
  }
}
