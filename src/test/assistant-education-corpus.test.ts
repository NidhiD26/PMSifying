import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ARTICLES } from '../lib/learn/articles';
import {
  retrieveEducationSources,
  knownArticleIds,
  type EducationDoc,
} from '../lib/assistant/retrieval';
import { classifyIntent, detectPersonalDiagnosisClaim } from '../lib/assistant/intent';
import { composeOfflineReply } from '../lib/assistant/respond';
import { emptyRedactedContext } from '../lib/assistant/context';
import { locales } from '@/i18n/config';
import type { Locale } from '@/types/i18n';

/**
 * The assistant against the real, bundled corpus.
 *
 * The other assistant tests use hand-written fixtures, which is right for
 * testing reply shape but hides one specific failure: the assistant can know a
 * word perfectly well and still have nothing to say, because the article was
 * never written. That is exactly how "tell me about endometriosis" reached a
 * reader as noMatch while every test still passed.
 *
 * So these tests read the shipped catalogue and the shipped English prose, and
 * assert the two halves agree.
 */

const en = JSON.parse(readFileSync('public/locales/en.json', 'utf8'));
const articles = en.learn.articles;

/**
 * The catalogue stores metadata and translation KEYS only, so the searchable
 * prose has to be pulled out of the locale file to mirror how the learn view
 * and the assistant handler both build their docs.
 */
const docs: EducationDoc[] = ARTICLES.map((article) => ({
  id: article.id,
  topic: article.topic,
  titleKey: `learn.articles.${article.id}.title`,
  summaryKey: `learn.articles.${article.id}.summary`,
  title: articles[article.id].title as string,
  summary: articles[article.id].summary as string,
  body: articles[article.id].body as string,
}));

function ask(text: string, limit = 3) {
  return retrieveEducationSources(docs, text, { limit });
}

function replyTo(text: string, locale: Locale = 'en') {
  return composeOfflineReply({
    text,
    turn: 0,
    context: emptyRedactedContext(locale),
    sources: ask(text),
  });
}

const ENDOMETRIOSIS = 'endometriosisOverview';

describe('the shipped corpus answers endometriosis questions', () => {
  it('has an endometriosis article in the catalogue', () => {
    expect(knownArticleIds()).toContain(ENDOMETRIOSIS);
    expect(ARTICLES.find((a) => a.id === ENDOMETRIOSIS)?.topic).toBe('conditions');
  });

  // Both of these are the phrasings a reader actually types. They normalise
  // down to the same single term, so they must land on the same article.
  it.each([
    'tell me about endometriosis',
    'what is endometriosis?',
    'What is endometriosis?',
    'Tell me about endometriosis',
  ])('answers %j with the endometriosis article', (text) => {
    const [top] = retrieveEducationSources(docs, text, { limit: 3 });
    expect(top?.articleId).toBe(ENDOMETRIOSIS);
  });

  it('treats both phrasings as an education question, not a diagnosis', () => {
    expect(classifyIntent('tell me about endometriosis')).toBe('education');
    expect(classifyIntent('what is endometriosis?')).toBe('education');
  });

  it('returns a grounded reply with a citation rather than noMatch', () => {
    for (const text of ['tell me about endometriosis', 'what is endometriosis?']) {
      const reply = replyTo(text);
      expect(reply.isRefusal).toBe(false);
      expect(reply.citations.map((c) => c.articleId)).toContain(ENDOMETRIOSIS);
    }
  });

  it('grounds the citation in the real article text, not a stub', () => {
    const [top] = ask('tell me about endometriosis');
    expect(top.title).toBe(articles[ENDOMETRIOSIS].title);
    expect(top.excerpt.toLowerCase()).toContain('endometriosis');
    // The excerpt is what a model would be handed as grounding, so it has to be
    // substantial rather than a title echoed back.
    expect(top.excerpt.length).toBeGreaterThan(200);
  });
});

describe('asking about oneself is still refused, and stays non-diagnostic', () => {
  it.each([
    'do i have endometriosis?',
    'Do I have endometriosis?',
    'could i have endometriosis',
    'i think i have endometriosis',
    'symptoms of endometriosis',
  ])('refuses %j as a personal diagnosis claim', (text) => {
    expect(detectPersonalDiagnosisClaim(text)).toBe(true);
    expect(classifyIntent(text)).toBe('diagnosis');
  });

  it('refuses with no citations, so nothing reads as a finding', () => {
    const reply = replyTo('do i have endometriosis?');
    expect(reply.isRefusal).toBe(true);
    expect(reply.intent).toBe('diagnosis');
    expect(reply.citations).toEqual([]);
  });

  it('never states or denies the condition in the refusal', () => {
    const reply = replyTo('do i have endometriosis?');
    const rendered = `${reply.messageKey} ${JSON.stringify(reply.params)}`;

    // A refusal that says "that sounds like endometriosis" or "you probably do
    // not have it" is a diagnosis, so neither may appear.
    expect(rendered).not.toMatch(/you (have|do not have|likely have)/i);
    expect(rendered).not.toMatch(/sounds like|is a sign of|probably|likely (have|has)/i);
  });

  it('refuses identically in every supported locale', () => {
    for (const locale of locales) {
      const reply = replyTo('do i have endometriosis?', locale);
      expect(reply.isRefusal, locale).toBe(true);
      expect(reply.messageKey, locale).toBe('responses.diagnosisRefusal');
      expect(reply.citations, locale).toEqual([]);
    }
  });

  it('still hands over the education article when the claim is refused', () => {
    // The refusal declines to diagnose; it must not also withhold the reading.
    const [top] = retrieveEducationSources(docs, 'do i have endometriosis?', { limit: 3 });
    expect(top?.articleId).toBe(ENDOMETRIOSIS);
  });
});

describe('no advertised condition is a dead end', () => {
  /**
   * Subject phrasings for the condition articles the assistant can be asked
   * about. Every one of these must resolve, otherwise the assistant recognises
   * the condition and then returns noMatch to the reader.
   */
  const ASKED_ABOUT: ReadonlyArray<[subject: string, articleId: string]> = [
    ['tell me about pcos', 'pcosOverview'],
    ['tell me about endometriosis', ENDOMETRIOSIS],
    ['anaemia and fatigue', 'anaemiaFatigue'],
  ];

  it.each(ASKED_ABOUT)('“%s” reaches %s', (subject, articleId) => {
    const [top] = ask(subject);
    expect(top?.articleId).toBe(articleId);
  });

  it('every condition-topic article is reachable by asking about it', () => {
    // Guards the invariant generally: if a condition article is added without a
    // subject phrasing here, this fails and asks for one, rather than the
    // article quietly existing in the Learn tab but not in the assistant.
    const covered = new Set(ASKED_ABOUT.map(([, articleId]) => articleId));
    const conditionArticles = ARTICLES.filter((a) => a.topic === 'conditions').map((a) => a.id);

    expect([...conditionArticles].filter((id) => !covered.has(id))).toEqual([]);
  });

  it('keeps every catalogue article backed by real translated prose', () => {
    for (const doc of docs) {
      expect(doc.title.trim(), doc.id).not.toBe('');
      expect(doc.summary.trim(), doc.id).not.toBe('');
      expect(doc.body.trim(), doc.id).not.toBe('');
    }
  });
});

describe('the added article stays within the editorial rules', () => {
  const body = articles[ENDOMETRIOSIS].body as string;
  const prose = `${articles[ENDOMETRIOSIS].title} ${articles[ENDOMETRIOSIS].summary} ${body}`;

  it('is split into paragraphs the excerpter can use', () => {
    expect(body.split('||').length).toBeGreaterThanOrEqual(3);
  });

  it('points the reader to a clinician rather than naming a condition as theirs', () => {
    expect(prose).toMatch(/clinician|doctor|consultation|medical care|healthcare professional/i);
  });

  it('names the conditions it is easily confused with', () => {
    expect(prose).toMatch(/adenomyosis/i);
    expect(prose).toMatch(/fibroid/i);
  });

  it('does not tell the reader to start, stop, or change any treatment', () => {
    // The corpus rule is education only, and this is the failure mode that
    // would matter most if it ever slipped in.
    expect(prose).not.toMatch(/\b(take|start|stop|begin) (the )?(painkiller|painkillers|medication|hormone|pill|tablets?)\b/i);
    expect(prose).not.toMatch(/\b(mg|dosage|twice a day|daily dose)\b/i);
  });
});
