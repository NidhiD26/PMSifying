export interface CycleInput {
  startDate: string;
  endDate?: string;
}

export interface CycleLengthResult {
  days: number;
}

export interface PeriodDurationResult {
  days: number;
}

export interface CycleStats {
  averageCycleLength: number;
  shortestCycle: number;
  longestCycle: number;
  cycleLengths: number[];
  sampleSize: number;
}

export type DataSufficiencyStatus = 'sufficient_data' | 'insufficient_data';

export type PredictionStatus =
  | 'predicted'
  | 'insufficient_data'
  | 'invalid_input';

export interface NextPeriodPrediction {
  status: PredictionStatus;
  estimatedStartDate?: string;
  basedOnCycles?: number;
}

export type OvulationEstimateStatus =
  | 'estimated'
  | 'insufficient_data'
  | 'invalid_input';

export interface OvulationEstimate {
  status: OvulationEstimateStatus;
  estimatedDate?: string;
  basedOnCycles?: number;
}

export type FertileWindowStatus =
  | 'estimated'
  | 'insufficient_data'
  | 'invalid_input';

export interface FertileWindow {
  status: FertileWindowStatus;
  startDate?: string;
  endDate?: string;
  estimatedOvulationDate?: string;
  basedOnCycles?: number;
}

export type VariabilityCategory =
  | 'stable'
  | 'moderate'
  | 'variable'
  | 'insufficient_data';

export interface CycleVariability {
  category: VariabilityCategory;
  standardDeviation: number;
  coefficientOfVariation: number;
  sampleSize: number;
}

export type OutlierStrategy = 'none' | 'exclude_extreme' | 'winsorize';

export interface EngineConfig {
  outlierStrategy?: OutlierStrategy;
  minCyclesForPrediction?: number;
}

export interface CycleAnalysisResult {
  stats: CycleStats | null;
  nextPeriod: NextPeriodPrediction;
  ovulation: OvulationEstimate;
  fertileWindow: FertileWindow;
  variability: CycleVariability;
  dataSufficiency: DataSufficiencyStatus;
}
