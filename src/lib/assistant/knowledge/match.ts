import { normalize } from '../intent';
import type { KnowledgeEntry, KnowledgeMatch } from './types';

/**
 * Deterministic matching over the knowledge base.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT EDUCATION RETRIEVAL
 * ---------------------------------------------------------------------------
 * `retrieveEducationSources` answers "which of the eleven articles is about
 * this?", and its ranking is only meaningful inside that closed set: scores are
 * relative to the other articles. This file answers a different question — "is
 * there a topic here that we know how to explain at all?" — which is why it is
 * a separate matcher with absolute weights rather than a reuse of the ranker.
 *
 * The separation also fixes the bug the brief describes. Classification used to
 * be downstream of retrieval in effect, because an unrecognised question had
 * nowhere to go: `education` could only ever mean "an article matched". Here the
 * topic is decided from the question's own vocabulary, and Education is
 * consulted afterwards to attach citations. A question with no article can now
 * still get a real answer.
 *
 * ---------------------------------------------------------------------------
 * WEIGHTS
 * ---------------------------------------------------------------------------
 * A strong term is a topic name or a natural way of asking for it, and one hit
 * is enough to answer. A weak term is a word the topic shares with its
 * neighbours — `bleeding` belongs to six entries, `ectopic` to one — so weak
 * terms only accumulate, and an entry that matched *only* weak terms is not
 * returned. That asymmetry is what stops "why am I bleeding" from being answered
 * with whichever heavy-bleeding entry happens to sit first in the file.
 *
 * Both lists are multilingual. A knowledge base that only understood English
 * would leave a Hindi reader with `noMatch` for the same question an English
 * reader gets a full answer to, which is the same failure the existing guardrail
 * lists are careful to avoid.
 */

/** Enough that two weak hits can never qualify an entry on their own. */
const MIN_SCORE = 12;
const STRONG_WEIGHT = 12;
const WEAK_WEIGHT = 4;

/** Above this, a second entry is close enough to be worth reporting too. */
const ALSO_MATCHED_SCORE = 12;

/** Space-padded so whole-word matching needs no regular expression. */
function haystack(text: string): string {
  return ` ${normalize(text)} `;
}

/** Whole-word match for a token, phrase match for a multi-word term. */
function hits(padded: string, term: string): boolean {
  const needle = ` ${term.trim()} `;
  if (needle.length > padded.length) return false;
  return padded.includes(needle);
}

function countHits(padded: string, terms: readonly string[] | undefined): number {
  if (!terms) return 0;
  let total = 0;
  for (const term of terms) {
    if (hits(padded, term)) total += 1;
  }
  return total;
}

/** The score an entry earns from a question, or 0 when it does not apply. */
export function scoreEntry(entry: KnowledgeEntry, padded: string): number {
  const strong = countHits(padded, entry.strong);
  if (strong > 0) return strong * STRONG_WEIGHT;

  // Weak hits alone are a nudge, never an answer. Returning 0 rather than the
  // accumulated weight is what keeps "bleeding" from selecting an entry.
  return 0;
}

/**
 * Every entry that a question reaches, best first.
 *
 * Exported separately from `matchKnowledge` so the composer can show a second
 * related topic when one is genuinely close behind the first, and so a test can
 * assert on the whole ranked list rather than only its head.
 */
export function rankKnowledge(entries: readonly KnowledgeEntry[], text: string): KnowledgeMatch[] {
  const padded = haystack(text);
  if (padded.trim().length === 0) return [];

  const matches: KnowledgeMatch[] = [];
  for (const entry of entries) {
    const strong = countHits(padded, entry.strong);
    const weak = countHits(padded, entry.weak);
    const score = strong * STRONG_WEIGHT + weak * WEAK_WEIGHT;

    // Needs a strong hit, or enough weak hits to clear the floor. The second
    // clause is why `weak` lists are written in threes at minimum.
    const qualifies = strong > 0 || weak * WEAK_WEIGHT >= MIN_SCORE;
    if (!qualifies || score < MIN_SCORE) continue;

    matches.push({ entry, score });
  }

  return matches.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
}

/** The single best entry for a question, or null when nothing matches. */
export function matchKnowledge(
  entries: readonly KnowledgeEntry[],
  text: string
): KnowledgeMatch | null {
  return rankKnowledge(entries, text)[0] ?? null;
}

/**
 * The best entry plus any runner-up close enough to also be on topic.
 *
 * Both are returned rather than only the winner because several real questions
 * genuinely span two topics — "can endometriosis cause severe period pain" is
 * the condition and the symptom, and "why am I tired before my period" is the
 * symptom and iron deficiency. The composer answers with the first and cites the
 * second rather than pretending the question had one subject.
 */
export function matchKnowledgeWithRelated(
  entries: readonly KnowledgeEntry[],
  text: string
): { best: KnowledgeMatch; related: KnowledgeMatch[] } | null {
  const ranked = rankKnowledge(entries, text);
  const [best, ...rest] = ranked;
  if (!best) return null;
  return { best, related: rest.filter((match) => match.score >= ALSO_MATCHED_SCORE) };
}