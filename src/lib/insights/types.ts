/**
 * Insights domain types.
 *
 * An insight is a deterministic, factual observation derived ONLY from the
 * user's recorded data via the analytics + Cycle Engine layers. Insights are
 * never diagnoses, never causal medical claims, and never recommendations.
 *
 * Insights carry translation keys + parameters (not hardcoded sentences) so
 * that a future AI layer can safely consume the structured evidence without
 * the rule engine depending on AI.
 */

export type InsightCategory =
  | 'cycle'
  | 'period'
  | 'symptoms'
  | 'mood'
  | 'pain'
  | 'sleep'
  | 'hydration'
  | 'general';

export type InsightPriority = 'low' | 'medium' | 'high';

/** Traceable support for an insight, useful for future AI safety/explainability. */
export interface InsightEvidence {
  /** Machine-readable metric id, e.g. 'cycleLengthMin'. */
  metric?: string;
  value?: string | number;
  /** Optional bounded date range the finding applies to. */
  range?: { startDate: string; endDate: string };
}

export interface PersonalInsight {
  /** Stable, deterministic id (same input -> same set of ids). */
  id: string;
  category: InsightCategory;
  priority: InsightPriority;
  /** Translation key under the `insights` namespace (title). */
  titleKey: string;
  /** Translation key under the `insights` namespace (body/message). */
  messageKey: string;
  /** Interpolation parameters for titleKey/messageKey. */
  params?: Record<string, string | number>;
  /** Ordered evidence supporting the insight. */
  evidence?: InsightEvidence[];
}
