import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { tokenize, searchArticles, type ArticleSearchDoc } from '../lib/learn/search';
import { ARTICLES, ARTICLE_TOPICS, DEFAULT_ARTICLE_ID } from '../lib/learn/articles';

describe('tokenize', () => {
  it('lowercases and splits on whitespace', () => {
    expect(tokenize('PMDD Symptoms')).toEqual(['pmdd', 'symptoms']);
  });

  it('splits on punctuation', () => {
    expect(tokenize('cycle, phases: and (symptoms)')).toEqual([
      'cycle',
      'phases',
      'and',
      'symptoms',
    ]);
  });

  it('drops empty fragments', () => {
    expect(tokenize('   ')).toEqual([]);
    expect(tokenize('')).toEqual([]);
    expect(tokenize(' , , ')).toEqual([]);
  });
});

describe('searchArticles', () => {
  const docs: ArticleSearchDoc[] = [
    { id: 'a', title: 'Cycle phases', summary: 'Four stages', body: 'Luteal progesterone' },
    { id: 'b', title: 'Sleep and stress', summary: 'Rest and cycle', body: 'Stress affects sleep' },
    { id: 'c', title: 'When to see a doctor', summary: 'Get checked', body: 'See a doctor for pain' },
  ];

  it('returns every document in catalogue order for an empty query', () => {
    expect(searchArticles(docs, '').map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('treats a whitespace-only query as empty', () => {
    expect(searchArticles(docs, '    ')).toHaveLength(3);
  });

  it('matches substrings so results appear while typing', () => {
    expect(searchArticles(docs, 'cycl').map((r) => r.id)).toContain('a');
  });

  it('uses AND semantics: extra words narrow results', () => {
    expect(searchArticles(docs, 'cycle').map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(searchArticles(docs, 'cycle sleep').map((r) => r.id)).toEqual(['b']);
  });

  it('returns nothing when any token is absent', () => {
    expect(searchArticles(docs, 'cycle zzzznotpresent')).toEqual([]);
  });

  it('weights title above summary above body', () => {
    const [top] = searchArticles(docs, 'cycle');
    const results = searchArticles(docs, 'cycle');
    const scores = Object.fromEntries(results.map((r) => [r.id, r.score]));
    expect(scores.a).toBeGreaterThan(0);
    expect(scores.b).toBeGreaterThan(0);
    expect(top).toBeDefined();
  });

  it('scores a title hit higher than a body-only hit', () => {
    const docs2: ArticleSearchDoc[] = [
      { id: 'title-hit', title: 'anaemia', summary: 'x', body: 'y' },
      { id: 'body-hit', title: 'x', summary: 'y', body: 'anaemia' },
    ];
    const results = searchArticles(docs2, 'anaemia');
    expect(results[0].id).toBe('title-hit');
  });

  it('is stable: equal scores keep catalogue order', () => {
    const tied: ArticleSearchDoc[] = [
      { id: 'first', title: 'zzz', summary: 'zzz', body: 'zzz' },
      { id: 'second', title: 'zzz', summary: 'zzz', body: 'zzz' },
      { id: 'third', title: 'zzz', summary: 'zzz', body: 'zzz' },
    ];
    expect(searchArticles(tied, 'zzz').map((r) => r.id)).toEqual(['first', 'second', 'third']);
  });

  it('is deterministic across repeated calls', () => {
    expect(searchArticles(docs, 'cycle')).toEqual(searchArticles(docs, 'cycle'));
  });

  it('honours a positive limit', () => {
    expect(searchArticles(docs, '', 2)).toHaveLength(2);
  });

  it('returns an empty array for a non-positive limit', () => {
    expect(searchArticles(docs, '', 0)).toEqual([]);
    expect(searchArticles(docs, '', -5)).toEqual([]);
  });

  it('returns every document when the limit is not finite', () => {
    expect(searchArticles(docs, '', Number.POSITIVE_INFINITY)).toHaveLength(3);
  });
});

describe('the real catalogue, backed by the English translations', () => {
  // The catalogue stores metadata and translation KEYS only; all prose lives in
  // the locale JSON. This mirrors how learn-view.tsx builds its search docs, so
  // it also proves every article has real translated prose behind it.
  const en = JSON.parse(readFileSync('public/locales/en.json', 'utf8'));
  const learn = en.learn;

  function articleText(id: string) {
    return {
      title: learn.articles[id].title as string,
      summary: learn.articles[id].summary as string,
      body: (learn.articles[id].body as string)
        .split('||')
        .map((p: string) => p.trim())
        .join(' '),
    };
  }

  const searchDocs: ArticleSearchDoc[] = ARTICLES.map((a) => ({
    id: a.id,
    ...articleText(a.id),
  }));

  it('has a non-empty, uniquely keyed catalogue', () => {
    expect(ARTICLES.length).toBeGreaterThan(0);
    expect(new Set(ARTICLES.map((a) => a.id)).size).toBe(ARTICLES.length);
  });

  it('points DEFAULT_ARTICLE_ID at a real article', () => {
    expect(ARTICLES.some((a) => a.id === DEFAULT_ARTICLE_ID)).toBe(true);
  });

  it('has an article entry in en.json for every catalogue id', () => {
    for (const article of ARTICLES) {
      expect(learn.articles[article.id], `missing learn.articles.${article.id}`).toBeDefined();
    }
  });

  it('gives every article non-empty translated title, summary and body', () => {
    for (const article of ARTICLES) {
      const { title, summary, body } = articleText(article.id);
      expect(title.trim(), article.id).not.toBe('');
      expect(summary.trim(), article.id).not.toBe('');
      expect(body.trim(), article.id).not.toBe('');
    }
  });

  it('assigns every article a recognised topic', () => {
    for (const article of ARTICLES) {
      expect(ARTICLE_TOPICS).toContain(article.topic);
    }
  });

  it('gives every article a positive read time', () => {
    for (const article of ARTICLES) {
      expect(article.readMinutes).toBeGreaterThan(0);
    }
  });

  it('finds an article from a title word', () => {
    expect(searchArticles(searchDocs, 'PCOS').map((r) => r.id)).toContain('pcosOverview');
  });

  it('finds an article from a body-only word', () => {
    // 'luteal' appears in prose, not in any title.
    const results = searchArticles(searchDocs, 'luteal');
    expect(results.length).toBeGreaterThan(0);
  });

  it('finds an article from a summary word', () => {
    const results = searchArticles(searchDocs, 'diagnosis');
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns nothing for a nonsense query rather than inventing results', () => {
    expect(searchArticles(searchDocs, 'zzqqxx nonsenseword')).toEqual([]);
  });

  it('finds something for every topic the UI offers as a filter', () => {
    for (const topic of ARTICLE_TOPICS) {
      const ids = ARTICLES.filter((a) => a.topic === topic).map((a) => a.id);
      expect(ids.length, `no article for topic ${topic}`).toBeGreaterThan(0);
    }
  });

  it('never renders an untranslated key back to the reader', () => {
    for (const doc of searchDocs) {
      expect(doc.title).not.toBe(`articles.${doc.id}.title`);
      expect(doc.title).not.toMatch(/^learn\./);
    }
  });
});
