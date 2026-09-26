import { searchArticles, type ArticleSearchDoc } from '@/lib/learn/search';
import { ARTICLES, type ArticleTopic } from '@/lib/learn/articles';
import type { EducationSource } from './types';

/**
 * Education retrieval for the assistant.
 *
 * This is RAG with the model removed: the same deterministic `searchArticles()`
 * that powers the Education screen ranks the corpus here, so the assistant can
 * only ever say something the app can already show the reader in their own
 * language. There is no generation step, so there is nothing that can invent a
 * claim the corpus does not contain.
 *
 * The caller supplies the corpus as already-localised text, exactly as
 * `LearnView` does, which means retrieval works in Hindi and Kannada without
 * any translation step of its own.
 */

const EXCERPT_MAX_CHARS = 420;

/**
 * Question scaffolding to drop before ranking.
 *
 * `searchArticles` uses AND semantics on purpose — that is what makes the
 * Education screen narrow as you type — but it means a real question matches
 * nothing, because no article contains the words "what is" or "tell me about".
 * Without this, "what is the fertile window" would return zero sources and the
 * assistant would answer `noMatch` to the most natural question a reader can
 * ask.
 *
 * The words removed here carry no health meaning, so dropping them cannot change
 * which articles are relevant, only whether any are found. The list is
 * deliberately short and conservative: it is safer to leave a word in and get a
 * narrower result than to strip a content word.
 */
const QUESTION_WORDS = new Set([
  // English
  'a', 'an', 'the', 'is', 'are', 'am', 'do', 'does', 'did', 'can', 'could',
  'should', 'would', 'will', 'shall', 'may', 'might', 'must', 'i', 'me', 'my',
  'you', 'your', 'it', 'its', 'about', 'tell', 'explain', 'know', 'please',
  'want', 'need', 'like', 'what', 'whats', 'whats', 'how', 'why', 'when',
  'where', 'which', 'who', 'whom', 'whose', 'and', 'or', 'of', 'to', 'for',
  'in', 'on', 'at', 'be', 'been', 'have', 'has', 'had', 'there', 'that',
  // Hindi
  'क्या', 'कैसे', 'क्यों', 'कब', 'कहाँ', 'कौन', 'कौनसा', 'कितना', 'मुझे',
  'मुझ', 'मेरा', 'मेरी', 'मेरे', 'है', 'हैं', 'हो', 'बताइए', 'बताओ', 'बताएं',
  'कि', 'से', 'का', 'की', 'के', 'को', 'और', 'या', 'पर', 'यह', 'वह',
  // Kannada
  'ಏನು', 'ಏಕೆ', 'ಹೇಗೆ', 'ಯಾವಾಗ', 'ಎಲ್ಲಿ', 'ಯಾರು', 'ಎಷ್ಟು', 'ನನಗೆ', 'ನನ್ನ',
  'ನಾನು', 'ಇದೆ', 'ಇವೆ', 'ಆಗಿ', 'ತಿಳಿಸಿ', 'ಹೇಳಿ', 'ಮತ್ತು', 'ಅಥವಾ', 'ಮತ್ತು',
  'ಈ', 'ಆ', 'ಒಂದು', 'ಇದೆಯೆ', 'ಆಗ',
]);

/** Removes question scaffolding, keeping every content word. */
export function stripQuestionWords(query: string): string {
  const kept = query
    .toLowerCase()
    .split(/[\s\u2000-\u206f,.;:!?"'()[\]{}<>|/\\]+/)
    .filter((token) => token.length > 0 && !QUESTION_WORDS.has(token));
  // Fall back to the original if the question was *entirely* scaffolding, so
  // retrieval still gets a real chance rather than an empty query.
  return kept.length > 0 ? kept.join(' ') : query;
}

/** A corpus entry paired with the keys and topic the UI needs to render it. */
export interface EducationDoc extends ArticleSearchDoc {
  topic: ArticleTopic;
  titleKey: string;
  summaryKey: string;
}

/**
 * Bounded, sentence-aligned excerpt of an article body.
 *
 * The bodies in the locale files separate paragraphs with `||`. Truncating on
 * that boundary keeps an excerpt from ending mid-sentence, which matters
 * because this text is handed to a model as grounding.
 */
export function buildExcerpt(body: string, maxChars = EXCERPT_MAX_CHARS): string {
  const flattened = body
    .split('||')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .join(' ');

  if (flattened.length <= maxChars) return flattened;

  const clipped = flattened.slice(0, maxChars);
  const lastBreak = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('। '));
  if (lastBreak > maxChars * 0.4) return clipped.slice(0, lastBreak + 1).trim();

  return `${clipped.trimEnd()}…`;
}

export interface RetrieveOptions {
  /** Maximum sources to return. Default 2 — enough to answer without padding. */
  limit?: number;
  /**
   * Narrows results to one topic. Used to keep a prediction question pointed at
   * cycle-basics material instead of an unrelated article that shares a word.
   */
  topic?: ArticleTopic;
}

/**
 * Ranks the corpus against a query.
 *
 * An empty query returns the leading articles in catalogue order, which lets the
 * assistant open with a few genuinely relevant suggestions rather than refusing
 * to answer. Callers that need a real match should pass the user's text.
 */
export function retrieveEducationSources(
  docs: EducationDoc[],
  query: string,
  options: RetrieveOptions = {}
): EducationSource[] {
  const { limit = 2, topic } = options;

  const docById = new Map(docs.map((doc) => [doc.id, doc]));

  // Rank the whole corpus first, then filter by topic, then limit. Limiting
  // before the filter would let one topic starve the results: a prediction
  // question could match three lifestyle articles and lose the cycleBasics
  // article that actually answers it.
  const ranked = searchArticles(docs, stripQuestionWords(query));

  const sources: EducationSource[] = [];

  for (const { id, score } of ranked) {
    if (sources.length >= Math.max(0, limit)) break;

    const doc = docById.get(id);
    if (!doc) continue;
    if (topic && doc.topic !== topic) continue;

    sources.push({
      articleId: doc.id,
      topic: doc.topic,
      score,
      titleKey: doc.titleKey,
      summaryKey: doc.summaryKey,
      title: doc.title,
      summary: doc.summary,
      excerpt: buildExcerpt(doc.body),
    });
  }

  return sources;
}

/** The article ids in the bundled corpus, in catalogue order. */
export function knownArticleIds(): string[] {
  return ARTICLES.map((article) => article.id);
}
