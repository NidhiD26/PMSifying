/**
 * The structured knowledge base.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS ALONGSIDE THE EDUCATION LIBRARY
 * ---------------------------------------------------------------------------
 * Before this module the assistant's whole answer surface was the Education
 * corpus: a question that did not retrieve an article was answered with
 * `noMatch` — "I could not find anything about that in the education library".
 * That made the assistant a search box over eleven articles. A reader asking
 * "what does the cervix do", or "what is perimenopause", or "can I get pregnant
 * during my period" got nothing, not because those questions are unanswerable
 * but because no article covered them.
 *
 * So Education is now one *source* among several rather than the only one. This
 * module holds the general health knowledge the library cannot carry:
 * anatomy, puberty, sexual health, pregnancy, life stages and myths — plus, in
 * `app-help`, what PMSify actually does. Nothing here duplicates an article: an
 * entry may name article ids in `articles`, and those are surfaced as citations,
 * so a reader who wants the long read still gets it.
 *
 * ---------------------------------------------------------------------------
 * WHY PROSE LIVES IN THE LOCALE FILES
 * ---------------------------------------------------------------------------
 * Every entry is i18n KEYS, not sentences. That is not a stylistic preference —
 * it is the invariant the whole assistant is built on ("a reply is described,
 * never written"), and it is what keeps the assistant translatable and keeps
 * the offline and gateway replies structurally identical. An English string
 * hard-coded here would answer a Hindi reader in English, which is the one
 * outcome worse than saying nothing.
 *
 * ---------------------------------------------------------------------------
 * WHY AN ENTRY CARRIES NO CLINICAL NUMBER
 * ---------------------------------------------------------------------------
 * Knowledge entries are general education, so they contain no dates, no doses
 * and no probabilities. Anything that varies per person comes from the cycle
 * engine through the redacted context instead, which is the only place a number
 * in a reply is allowed to come from. That separation is why `ageRange`,
 * `typicalCycle` and friends are deliberately absent: they are ranges that
 * vary, and a range stated as a fact in code is a claim nobody reviews.
 */

/**
 * The three conceptual knowledge areas, plus the two that cut across them.
 *
 * `appHelp` is PMSify-the-application, which the brief calls AREA 1.
 * Everything else except `safety` is women's-health education, AREA 2.
 * Personal PMSify data is AREA 3 and is NOT a domain here on purpose: it is
 * answered from the redacted context, never from this table, so an entry can
 * never appear to be speaking about the reader's own records.
 */
export type KnowledgeDomain =
  | 'appHelp'
  | 'menstrualHealth'
  | 'anatomy'
  | 'puberty'
  | 'sexualHealth'
  | 'pregnancy'
  | 'conditions'
  | 'lifeStages'
  | 'myths'
  | 'safety';

/**
 * Which knowledge area an answer came from, reported to the reader.
 *
 * The brief asks that a reply be able to say where its information came from,
 * and that it never claim a source it did not use. This is the mechanism: the
 * composer sets these from what it actually did, so the list cannot drift from
 * the answer.
 */
export type KnowledgeProvenance =
  /** An Education article was retrieved and is shown as a citation. */
  | 'education'
  /** The answer describes PMSify's own screens and behaviour. */
  | 'appHelp'
  /** The answer quotes the reader's own computed records. */
  | 'personalData'
  /** The answer came from the structured knowledge base. */
  | 'healthKnowledge';

/** One knowledge entry: an id, i18n keys, matching terms and its sources. */
export interface KnowledgeEntry {
  id: string;
  domain: KnowledgeDomain;
  /** The direct answer. Always present, always short. */
  answerKey: string;
  /** A short "why that happens" paragraph, when there is one worth having. */
  detailKey?: string;
  /** Warning signs relevant to this specific topic. */
  warningKey?: string;
  /** When professional care is appropriate. */
  careKey?: string;
  /**
   * Education articles that go deeper on this topic.
   *
   * An allowlist, not a lookup: every id here is checked against the shipped
   * corpus at module load, so a rename in `ARTICLES` cannot leave the assistant
   * citing an article that no longer exists.
   */
  articles?: readonly string[];
  /**
   * Terms that identify this entry on their own.
   *
   * One strong hit is enough to answer. Terms are synonyms and natural question
   * forms, not article titles — the point of this module is to answer questions
   * that do not correspond to an article.
   */
  strong?: readonly string[];
  /** Terms that suggest this entry and break ties. Never sufficient alone. */
  weak?: readonly string[];
}

/** Which part of an entry an i18n key addresses. Mirrors the entry's fields. */
export type KnowledgeSlot = 'answer' | 'detail' | 'warning' | 'care';

/**
 * The `assistant`-relative segment every knowledge key starts with.
 *
 * The reply view calls `useTranslations('assistant')` and resolves both
 * `messageKey` and `block.key` relative to that namespace. So every key handed to
 * it must be `knowledge.<id>.<slot>` — the `assistant.` prefix is supplied by the
 * namespace and must not be repeated (doing so yields `assistant.assistant.…`),
 * and the entry's own `knowledge.` segment must be present (a bare `<id>.<slot>`
 * would resolve as `assistant.<id>.<slot>`). This constant is the single place
 * that decides that boundary.
 */
export const KNOWLEDGE_KEY_PREFIX = 'knowledge';

/**
 * The namespace-relative i18n key for one slot of one entry, ready for
 * `t()` under the `assistant` namespace.
 *
 * Built rather than written out at each use site: a hand-written key string is a
 * string with no type checking, and a typo in it is a missing translation that
 * only shows up in the reader's language at runtime.
 */
export function knowledgeKey(id: string, slot: KnowledgeSlot): string {
  return `${KNOWLEDGE_KEY_PREFIX}.${id}.${slot}`;
}

/**
 * Qualifies an entry's own stored slot key (`<id>.<slot>`) into the
 * namespace-relative key the view expects.
 *
 * Entries store their keys unprefixed — `answerKey: 'log.answer'` — which keeps
 * the entry tables readable and lets the locale tree be checked against the ids
 * directly. This is the one function that bridges that authoring form to the
 * namespace-relative form, so a block can never be emitted with the raw key and
 * silently resolve to `assistant.log.detail`. Idempotent, so calling it on an
 * already-qualified key is a no-op.
 */
export function qualifyKnowledgeKey(slotKey: string): string {
  return slotKey.startsWith(`${KNOWLEDGE_KEY_PREFIX}.`)
    ? slotKey
    : `${KNOWLEDGE_KEY_PREFIX}.${slotKey}`;
}

/** One entry plus why it matched, for tests and for the composer. */
export interface KnowledgeMatch {
  entry: KnowledgeEntry;
  score: number;
}