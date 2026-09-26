/**
 * Deterministic, offline, client-side article search.
 *
 * No model and no network: the library ships with the app and is searched in
 * memory. Scoring is a simple weighted token match, which is predictable,
 * fast on a small corpus, and trivially testable — an important property for
 * an educational library that must never invent an answer.
 *
 * Matching rules:
 *   - The query is lowercased and split on whitespace/punctuation.
 *   - Every token must match somewhere in the document (AND semantics), so
 *     adding words narrows results rather than widening them.
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
