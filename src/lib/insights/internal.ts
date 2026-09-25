import type {
  PersonalInsight,
  InsightCategory,
  InsightEvidence,
  InsightPriority,
} from './types';
import { defaultPriority } from './insight-priority';

/**
 * Minimal, unopinionated factory for a PersonalInsight. Rules associate a
 * stable key + category; priority defaults to the category unless overridden.
 * All text is expressed as translation keys + params — never raw sentences.
 */
export function insight(
  category: InsightCategory,
  key: string,
  fields: {
    priority?: InsightPriority;
    titleKey: string;
    messageKey: string;
    params?: Record<string, string | number>;
    evidence?: InsightEvidence[];
  }
): PersonalInsight {
  return {
    id: `${category}.${key}`,
    category,
    priority: fields.priority ?? defaultPriority(category),
    titleKey: fields.titleKey,
    messageKey: fields.messageKey,
    params: fields.params,
    evidence: fields.evidence,
  };
}

export function evidenceRange(
  startDate: string,
  endDate: string
): InsightEvidence {
  return { range: { startDate, endDate } };
}
