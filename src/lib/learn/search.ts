/**
 * Deterministic, offline, client-side article search.
 *
 * No model and no network: the library ships with the app and is searched in
 * memory. Scoring is a simple weighted token match, which is predictable,
 * fast on a small corpus, and trivially testable — an important property for
 * an educational library that must never invent an answer.
 *
 * Two rankers live here, and the difference between them is the whole reason
 * there are two:
 *
 *   `searchArticles`            AND semantics. Adding a word narrows the results,
 *                               which is what you want in a search box: as the
 *                               reader types, the list should shrink.
 *
 *   `rankArticlesByRelevance`   OR semantics with a relevance floor. A natural
 *                               question is not a search string — "what is worth
 *                               knowing before a doctor visit" contains no word
 *                               that any single article leads with, so AND returns
 *                               nothing and the caller is left with no answer at
 *                               all. This ranks by how much of the question an
 *                               article actually covers, so a broad question
 *                               still lands on the right article.
 *
 * Neither ranker invents relevance; both are token matching over prose the app
 * already ships.
 *
 * Matching rules, shared by both:
 *   - The query is lowercased and split on whitespace/punctuation.
 *   - Token prefixes match, so results appear while the user is still typing.
 *   - Weights: title 4, summary 2, body 1.
 *   - Ties keep catalogue order, so results never reshuffle between renders.
 */

export interface ArticleSearchDoc {
  id: string;
  title: string;
  summary: string;
  /** Concatenated body paragraphs. */
  body: string;
}

export interface ScoredArticle {
  id: string;
  score: number;
}

const SEPARATORS = /[\s\u2000-\u206f,.;:!?"'()\[\]{}<>|/\\]+/;

/** Lowercases, strips punctuation, and drops empty fragments. */
export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(SEPARATORS)
    .filter((token) => token.length > 0);
}

function matches(haystack: string, token: string): boolean {
  return haystack.includes(token);
}

/**
 * Ranks documents against a query.
 *
 * An empty or whitespace-only query returns every document in input order,
 * which lets the UI show the full library before a search begins.
 */
export function searchArticles(
  docs: ArticleSearchDoc[],
  query: string,
  limit = Number.POSITIVE_INFINITY
): ScoredArticle[] {
  const tokens = tokenize(query);

  const scored: ScoredArticle[] = [];

  for (const doc of docs) {
    const title = doc.title.toLowerCase();
    const summary = doc.summary.toLowerCase();
    const body = doc.body.toLowerCase();

    let score = 0;
    let allTokensMatched = true;

    for (const token of tokens) {
      let tokenScore = 0;
      if (matches(title, token)) tokenScore += 4;
      if (matches(summary, token)) tokenScore += 2;
      if (matches(body, token)) tokenScore += 1;

      if (tokenScore === 0) {
        allTokensMatched = false;
        break;
      }
      score += tokenScore;
    }

    if (allTokensMatched) {
      scored.push({ id: doc.id, score });
    }
  }

  // Stable: only a strict score difference reorders, so equal scores keep
  // their original catalogue position.
  const withIndex = scored.map((entry, index) => ({ ...entry, index }));
  withIndex.sort((a, b) => (b.score - a.score) || (a.index - b.index));

  const limited = Number.isFinite(limit) ? withIndex.slice(0, Math.max(0, limit)) : withIndex;

  return limited.map(({ id, score }) => ({ id, score }));
}

/* -------------------------------------------------------------------------- */
/* Relevance ranking — for questions, not search boxes                           */
/* -------------------------------------------------------------------------- */

export interface RankedArticle extends ScoredArticle {
  /**
   * How much of the query this article covered, 0–1.
   *
   * A question is covered by an article when several of its words are, not when
   * all of them are. `coverage` is what separates "this article is about the
   * thing you asked" from "this article happens to contain the word water".
   */
  coverage: number;
}

export interface RelevanceOptions {
  /**
   * Extra points added to an article's score, keyed by article id.
   *
   * A caller that already knows which corner of the library a question lives in
   * — cycle phases, symptoms, when to see a doctor — can say so here instead of
   * hoping the wording lines up. The boost is added to the score and the article
   * is still required to match something, so a hint can reorder results but can
   * never conjure a match out of unrelated prose.
   */
  scoreBoostById?: ReadonlyMap<string, number>;
  /**
   * Ids that may be returned on the strength of a hint alone.
   *
   * For the rare article a reader will never reach by typing, because it does
   * not use their words. The pain-tracking article never says "cramps", and
   * "what can I do for period cramps" is plainly about it. A *topic* hint must
   * never appear here — that would let a coarse guess manufacture an answer — so
   * only a deliberately curated per-article mapping may, and it is expected to
   * stay small.
   */
  qualifyingIds?: ReadonlySet<string>;
  limit?: number;
}

/**
 * Minimum share of the query an article must cover to be worth returning.
 *
 * Half, not all: a question is covered by an article when several of its words
 * are, not when every one of them is. The exactness of AND semantics is what
 * produced a confident non-answer, and returning everything would just trade it
 * for a confident wrong answer.
 */
const MIN_COVERAGE = 0.5;

/**
 * Scores every article against a query without requiring all of it to match.
 *
 * An article qualifies when any of these holds:
 *
 *   - it appears in a title or summary (`score >= 2`), which is the app
 *     asserting the article is *about* the query;
 *   - it covers at least `MIN_COVERAGE` of the query's words in its text;
 *   - the caller's topic hint reached it; or
 *   - the caller named it outright, via `qualifyingIds`.
 *
 * The last two are the exception, and they differ in kind. A topic hint is an
 * inference — "this question is about when to see a doctor" — so it may lift an
 * article that matched one weak word into a correct answer, but only an article
 * that matched *something*; a question like "what is worth knowing before a
 * doctor visit" shares just the word *doctor* with the two articles that answer
 * it. `qualifyingIds` is an assertion of fact rather than an inference, so it is
 * the only route for an article with no overlap at all.
 *
 * Anything weaker is a stray word in a long body, and returning it would trade a
 * confident non-answer for a confident wrong one.
 */
export function rankArticlesByRelevance(
  docs: ArticleSearchDoc[],
  query: string,
  options: RelevanceOptions = {}
): RankedArticle[] {
  const { scoreBoostById, qualifyingIds, limit } = options;
  const tokens = tokenize(query);

  // An empty query keeps the behaviour `searchArticles` already has: the whole
  // library in catalogue order, so a caller with nothing to go on can still
  // offer something rather than nothing.
  if (tokens.length === 0) {
    const every = docs.map((doc, index) => ({ id: doc.id, score: 0, coverage: 0, index }));
    const cut = limit === undefined ? every : every.slice(0, Math.max(0, limit));
    return cut.map(({ id, score }) => ({ id, score, coverage: 0 }));
  }

  const ranked: Array<RankedArticle & { index: number }> = [];

  docs.forEach((doc, index) => {
    const title = doc.title.toLowerCase();
    const summary = doc.summary.toLowerCase();
    const body = doc.body.toLowerCase();

    let score = 0;
    let matched = 0;

    for (const token of tokens) {
      let tokenScore = 0;
      if (matches(title, token)) tokenScore += 4;
      if (matches(summary, token)) tokenScore += 2;
      if (matches(body, token)) tokenScore += 1;
      if (tokenScore === 0) continue;

      score += tokenScore;
      matched += 1;
    }

    const boost = scoreBoostById?.get(doc.id) ?? 0;

    if (matched === 0) {
      // Reachable only by explicit curation. Without the escape hatch this
      // article is not about the query in any word the reader can see, and
      // returning it on a topic guess alone is the failure mode worth avoiding.
      if (!qualifyingIds?.has(doc.id)) return;
      ranked.push({ id: doc.id, score: boost, coverage: 0, index });
      return;
    }

    const coverage = matched / tokens.length;
    if (score < 2 && coverage < MIN_COVERAGE && boost === 0) return;

    ranked.push({
      id: doc.id,
      score: score + boost,
      coverage,
      index,
    });
  });

  // Score first, coverage as the tiebreak, then catalogue order.
  //
  // Score leads because it is where "this article is *about* that" is
  // expressed: title and summary weight 4 and 2 against a body's 1, and a
  // caller's topic hint is folded in ahead of the comparison. Coverage is the
  // weaker signal and makes a poor primary key — a long question is partially
  // matched by almost everything, so ordering by coverage reliably promoted
  // whichever article happened to echo the most filler words over the one that
  // actually answers the question. It is kept for exactly what it is good at:
  // separating two articles of comparable strength.
  ranked.sort((a, b) => (b.score - a.score) || (b.coverage - a.coverage) || (a.index - b.index));

  const cut = limit === undefined ? ranked : ranked.slice(0, Math.max(0, limit));
  return cut.map(({ id, score, coverage }) => ({ id, score, coverage }));
}

