/**
 * Offline health-literacy library.
 *
 * The catalogue holds metadata and translation KEYS only. All prose lives in
 * the locale JSON files, so articles are translated, screen-reader friendly,
 * and never shipped as hardcoded English inside a component.
 *
 * Every article is general health education. None of them diagnose, and none
 * of them instruct a reader to start, stop, or change any treatment. Articles
 * that describe a condition explicitly point the reader to a qualified
 * clinician for diagnosis.
 */

export type ArticleTopic =
  | 'cycleBasics'
  | 'symptoms'
  | 'whenToSeeDoctor'
  | 'lifestyle'
  | 'conditions';

export const ARTICLE_TOPICS: ArticleTopic[] = [
  'cycleBasics',
  'symptoms',
  'whenToSeeDoctor',
  'lifestyle',
  'conditions',
];

export interface ArticleMeta {
  id: string;
  topic: ArticleTopic;
  readMinutes: number;
}

export const ARTICLES: ArticleMeta[] = [
  { id: 'cyclePhases', topic: 'cycleBasics', readMinutes: 4 },
  { id: 'fertileWindow', topic: 'cycleBasics', readMinutes: 4 },
  { id: 'pmsVsPmd', topic: 'symptoms', readMinutes: 5 },
  { id: 'painTracking', topic: 'symptoms', readMinutes: 4 },
  { id: 'sleepStressCycle', topic: 'lifestyle', readMinutes: 4 },
  { id: 'hydrationEnergy', topic: 'lifestyle', readMinutes: 3 },
  { id: 'pcosOverview', topic: 'conditions', readMinutes: 5 },
  { id: 'endometriosisOverview', topic: 'conditions', readMinutes: 5 },
  { id: 'anaemiaFatigue', topic: 'conditions', readMinutes: 4 },
  { id: 'whenToSeeDoctor', topic: 'whenToSeeDoctor', readMinutes: 5 },
  { id: 'talkingToDoctor', topic: 'whenToSeeDoctor', readMinutes: 4 },
];

export const DEFAULT_ARTICLE_ID = ARTICLES[0].id;

export function isKnownArticle(id: string): boolean {
  return ARTICLES.some((a) => a.id === id);
}
