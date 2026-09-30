import { ARTICLES } from '@/lib/learn/articles';
import { ANATOMY_ENTRIES } from './entries/anatomy';
import { APP_HELP_ENTRIES } from './entries/app-help';
import { CONDITION_ENTRIES } from './entries/conditions';
import { LIFE_STAGE_ENTRIES } from './entries/life-stages';
import { MENSTRUAL_FATIGUE_ENTRY, MENSTRUAL_HEALTH_ENTRIES } from './entries/menstrual-health';
import { MYTH_ENTRIES } from './entries/myths';
import { PREGNANCY_ENTRIES } from './entries/pregnancy';
import { PUBERTY_ENTRIES } from './entries/puberty';
import { SAFETY_ENTRIES } from './entries/safety';
import { SEXUAL_HEALTH_ENTRIES } from './entries/sexual-health';
import type { KnowledgeDomain, KnowledgeEntry } from './types';

/**
 * The assembled knowledge base.
 *
 * One array, assembled once at module load. Every consumer — the matcher, the
 * safety screen, the tests — reads this list, so a topic added to a domain file
 * is immediately answerable without being registered a second time somewhere.
 *
 * ---------------------------------------------------------------------------
 * TRANSLATION REVIEW REQUIRED
 * ---------------------------------------------------------------------------
 * The English strings are the authored source of truth. The Hindi and Kannada
 * clinical content requires native-speaker and medically informed review before
 * production release. It was drafted to the same structure and passes every
 * structural, ICU and parity check in the suite — but structural parity is not
 * clinical accuracy, and a fluent machine rendering of "seek care now" is still
 * a rendering nobody has put their name to.
 *
 * This is a developer note and stays in source. It is deliberately NOT a locale
 * key and must not be added to `assistant.responses` or an article warning: a
 * banner reading "this translation is unreviewed" would be shown to every reader
 * in a product whose credibility is the point. The gate is a release check, not
 * reader-facing copy.
 */

/**
 * The article ids that actually exist in the shipped corpus.
 *
 * Built from `ARTICLES` rather than hand-copied, so renaming an article id in
 * `src/lib/learn/articles.ts` cannot leave this module holding a stale name.
 */
const CORPUS_IDS = new Set<string>(ARTICLES.map((article) => article.id));

const unresolvedArticleRefs: string[] = [];

/**
 * Article references that named an id the corpus does not contain.
 *
 * Those entries have their `articles` dropped instead of rendering a citation
 * link to nowhere. They are collected and exported rather than swallowed so a
 * test can assert the list is empty — a typo in an article id is a content bug
 * that should fail a build's test run, not quietly ship a source card with an
 * empty title.
 *
 * Exported as a readonly view of a mutable collector, because the collector has
 * to be filled during module load while the export has to be a `const`.
 */
export const UNRESOLVED_ARTICLE_REFS: readonly string[] = unresolvedArticleRefs;

/** Drops citations that point at an article which is not in the corpus. */
function withResolvableArticles(entry: KnowledgeEntry): KnowledgeEntry {
  if (!entry.articles || entry.articles.length === 0) return entry;

  const resolved = entry.articles.filter((id) => {
    if (CORPUS_IDS.has(id)) return true;
    unresolvedArticleRefs.push(`${entry.id} -> ${id}`);
    return false;
  });

  if (resolved.length === entry.articles.length) return entry;
  return { ...entry, articles: resolved };
}

const RAW_ENTRIES: readonly KnowledgeEntry[] = [
  // AREA 1 — PMSify itself.
  ...APP_HELP_ENTRIES,

  // AREA 2 — general women's health.
  ...MENSTRUAL_HEALTH_ENTRIES,
  MENSTRUAL_FATIGUE_ENTRY,
  ...ANATOMY_ENTRIES,
  ...PUBERTY_ENTRIES,
  ...SEXUAL_HEALTH_ENTRIES,
  ...PREGNANCY_ENTRIES,
  ...CONDITION_ENTRIES,
  ...LIFE_STAGE_ENTRIES,
  ...MYTH_ENTRIES,

  // AREA 4 — medical urgency.
  ...SAFETY_ENTRIES,
];

/** Every entry, with unresolvable citations removed. */
export const KNOWLEDGE_ENTRIES: readonly KnowledgeEntry[] = RAW_ENTRIES.map(withResolvableArticles);

/** Entry lookup by id. One instance, built once. */
const BY_ID = new Map(KNOWLEDGE_ENTRIES.map((entry) => [entry.id, entry]));

/**
 * Looks up one entry by id.
 *
 * Used by the composer to resolve a matched entry back to its i18n keys, and by
 * tests. Returns null rather than throwing for an unknown id, because the id
 * arrives from the matcher over user text and a typo should degrade to "no
 * answer" rather than take the page down.
 */
export function knowledgeEntryById(id: string): KnowledgeEntry | null {
  return BY_ID.get(id) ?? null;
}

/** Every entry in one domain, in declaration order. */
export function knowledgeEntriesForDomain(domain: KnowledgeDomain): readonly KnowledgeEntry[] {
  return KNOWLEDGE_ENTRIES.filter((entry) => entry.domain === domain);
}

export { APP_HELP_ENTRIES, APP_HELP_PATHS, type AppHelpTopic } from './entries/app-help';
export { matchKnowledge, matchKnowledgeWithRelated, rankKnowledge, scoreEntry } from './match';
export {
  KNOWLEDGE_KEY_PREFIX,
  knowledgeKey,
  qualifyKnowledgeKey,
  type KnowledgeDomain,
  type KnowledgeEntry,
  type KnowledgeMatch,
  type KnowledgeProvenance,
  type KnowledgeSlot,
} from './types';