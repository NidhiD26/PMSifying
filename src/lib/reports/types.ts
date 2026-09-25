import type { HealthAnalytics, AnalyticsValue } from '@/lib/analytics';
import type { PersonalInsight } from '@/lib/insights';
import type { CycleDomainModel, FlowLevel } from '@/types/health';

export type ReportRangeKey = 'all' | '90d' | '6m' | 'custom';

export interface ReportDateRange {
  startDate: string;
  endDate: string;
  key: ReportRangeKey;
}

export interface ReportCycleSummary {
  recordedCycles: number;
  averageCycleLength: AnalyticsValue;
  shortestCycle: AnalyticsValue;
  longestCycle: AnalyticsValue;
  mostRecentCycleLength: AnalyticsValue;
  variability: { category: string; standardDeviation: number; sampleSize: number };
  predictionAvailable: boolean;
  cycles: CycleDomainModel[];
}

export interface ReportPeriodSummary {
  recordedPeriods: number;
  completedPeriods: number;
  ongoingPeriod: boolean;
  averageDuration: AnalyticsValue;
  shortestDuration: AnalyticsValue;
  longestDuration: AnalyticsValue;
  mostRecentDuration: AnalyticsValue;
  flowDistribution: { level: FlowLevel; count: number }[];
}

export interface ReportSymptomSummary {
  recordedDays: number;
  mostFrequent: { id: string; count: number }[];
  frequency: { id: string; count: number }[];
}

export interface ReportMoodSummary {
  recordedDays: number;
  mostFrequent: { id: string; count: number }[];
  distribution: { id: string; count: number }[];
}

export interface ReportPainSummary {
  recordedDays: number;
  average: AnalyticsValue;
  highest: AnalyticsValue;
  lowest: AnalyticsValue;
}

export interface ReportSleepSummary {
  recordedDays: number;
  average: AnalyticsValue;
  minimum: AnalyticsValue;
  maximum: AnalyticsValue;
}

export interface ReportHydrationSummary {
  recordedDays: number;
  average: AnalyticsValue;
  minimum: AnalyticsValue;
  maximum: AnalyticsValue;
}

export interface ReportData {
  generatedAt: string;
  dateRange: ReportDateRange;
  totalDailyLogs: number;
  cycle: ReportCycleSummary;
  period: ReportPeriodSummary;
  symptoms: ReportSymptomSummary;
  mood: ReportMoodSummary;
  pain: ReportPainSummary;
  sleep: ReportSleepSummary;
  hydration: ReportHydrationSummary;
  insights: PersonalInsight[];
}

export interface ReportEngineInput {
  analytics: HealthAnalytics;
  insights: PersonalInsight[];
  cycles: CycleDomainModel[];
  dateRange: ReportDateRange;
  today: string;
}
