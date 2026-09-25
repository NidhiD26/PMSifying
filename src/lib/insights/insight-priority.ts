import type { InsightCategory, InsightPriority } from './types';

/**
 * Deterministic prioritization strategy.
 *
 * Why these weights:
 *  - Personally-useful "what I recorded" observations (most frequent symptom,
 *    most frequent mood, average pain/sleep/hydration) sort first: they are
 *    the most immediately useful, purely factual daily-health summaries.
 *  - Cycle/period observations follow: important menstrual data but less
 *    daily-actionable than the daily-health summaries.
 *  - Data-completeness nudges sort last: gentle and optional, they should
 *    never crowd out actual recorded findings.
 *
 * Within the same priority tier, deterministic secondary keys break ties so
 * the ordering is fully reproducible for identical input:
 *   1. explicit priority (high > medium > low)
 *   2. fixed category rank
 *   3. stable insight id (lexicographic)
 *
 * No randomness and no current-time dependence. "Recent" is only ever driven
 * by explicit input from the engine caller.
 */

const PRIORITY_WEIGHT: Record<InsightPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const CATEGORY_RANK: Record<InsightCategory, number> = {
  symptoms: 0,
  mood: 1,
  pain: 2,
  sleep: 3,
  hydration: 4,
  cycle: 5,
  period: 6,
  general: 7,
};

export function categoryRank(category: InsightCategory): number {
  return CATEGORY_RANK[category];
}

export function priorityWeight(priority: InsightPriority): number {
  return PRIORITY_WEIGHT[priority];
}

/**
 * Resolve a sensible default priority for a category; used by rules that do
 * not need to override it.
 */
export function defaultPriority(category: InsightCategory): InsightPriority {
  if (
    category === 'symptoms' ||
    category === 'mood' ||
    category === 'pain' ||
    category === 'sleep' ||
    category === 'hydration'
  ) {
    return 'high';
  }
  if (category === 'cycle' || category === 'period') return 'medium';
  return 'low';
}

export interface ComparableInsight {
  priority: InsightPriority;
  category: InsightCategory;
  id: string;
}

/**
 * Comparator for a fully deterministic sort. Returns a negative number when
 * `a` should sort before `b`.
 */
export function compareInsights(
  a: ComparableInsight,
  b: ComparableInsight
): number {
  const pa = PRIORITY_WEIGHT[a.priority];
  const pb = PRIORITY_WEIGHT[b.priority];
  if (pa !== pb) return pa - pb;
  if (CATEGORY_RANK[a.category] !== CATEGORY_RANK[b.category]) {
    return CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
  }
  return a.id.localeCompare(b.id);
}
