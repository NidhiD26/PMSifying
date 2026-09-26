import { describe, it, expect } from 'vitest';
import { composeOfflineReply } from '../lib/assistant/respond';
import {
  buildExcerpt,
  retrieveEducationSources,
  knownArticleIds,
  type EducationDoc,
} from '../lib/assistant/retrieval';
import { buildRedactedContext, emptyRedactedContext } from '../lib/assistant/context';
import type { EducationSource } from '../lib/assistant/types';
import type { CycleDomainModel, DailyLogDomainModel } from '@/types/health';

/**
 * The deterministic path.
 *
 * These replies are what the reader sees with no network at all, so they are the
 * product's real behaviour rather than a degraded version of it. Nothing here
 * may depend on a provider, a clock, or Math.random.
 */

const docs: EducationDoc[] = [
  {
    id: 'fertileWindow',
    topic: 'cycleBasics',
    titleKey: 'articles.fertileWindow.title',
    summaryKey: 'articles.fertileWindow.summary',
    title: 'Your fertile window',
    summary: 'When you are most likely to conceive.',
    body: 'The fertile window spans the days around ovulation, usually six days.',
  },
  {
    id: 'pcosOverview',
    topic: 'conditions',
    titleKey: 'articles.pcosOverview.title',
    summaryKey: 'articles.pcosOverview.summary',
    title: 'Living with PCOS',
    summary: 'Common symptoms and day to day management.',
    body: 'PCOS is a common hormonal condition. Symptoms can include irregular cycles and acne.',
  },
  {
    id: 'whenToSeeDoctor',
    topic: 'whenToSeeDoctor',
    titleKey: 'articles.whenToSeeDoctor.title',
    summaryKey: 'articles.whenToSeeDoctor.summary',
    title: 'When to see a doctor',
    summary: 'Signs that deserve a consultation.',
    body: 'See a doctor if periods stop for three months, or if pain is severe.',
  },
];

const cycles: CycleDomainModel[] = [
  { startDate: '2026-01-05', endDate: '2026-01-10', createdAt: 'x', updatedAt: 'x' },
  { startDate: '2026-02-05', endDate: '2026-02-10', createdAt: 'x', updatedAt: 'x' },
  { startDate: '2026-03-08', endDate: '2026-03-13', createdAt: 'x', updatedAt: 'x' },
];

const dailyLogs: DailyLogDomainModel[] = [
  {
    date: '2026-03-09',
    symptoms: [{ id: 'cramps', intensity: 4 }],
    mood: [{ id: 'anxious', intensity: 3 }],
    painLevel: 5,
    sleepHours: 6,
    hydrationMl: 1500,
    createdAt: 'x',
    updatedAt: 'x',
  },
  {
    date: '2026-03-10',
    symptoms: [{ id: 'headache', intensity: 2 }],
    mood: [{ id: 'calm', intensity: 4 }],
    painLevel: 2,
    sleepHours: 7.5,
    hydrationMl: 2000,
    createdAt: 'x',
    updatedAt: 'x',
  },
];

const richContext = () =>
  buildRedactedContext({ locale: 'en', today: '2026-03-15', cycles, dailyLogs });

const emptyContext = () => emptyRedactedContext('en');

const reply = (text: string, context = richContext(), sources: EducationSource[] = []) =>
  composeOfflineReply({ text, turn: 0, context, sources });

/* -------------------------------------------------------------------------- */

describe('every reply is well formed', () => {
  it.each([
    'hello',
    'what is the fertile window',
    'when is my next period',
    'summarise my data',
    'what is PCOS',
    'tell me about endometriosis',
    'asdfghjkl',
  ])('answers %j with a renderable message key', (text) => {
    const result = reply(text);
    expect(result.messageKey).toMatch(/^responses\.[a-zA-Z.]+$/);
    expect(result.id).toMatch(/^reply-\d+$/);
    expect(result.source).toBe('offline');
    expect(result.providerText).toBeUndefined();
  });

  it('only ever uses params that the message key declares', () => {
    // next-intl throws on a missing param, so an undeclared key is a crash.
    const declared: Record<string, string[]> = {
      'responses.education': ['count'],
      'responses.predictionReady': ['estimatedDate'],
      'responses.predictionWithWindow': ['estimatedDate', 'windowStart', 'windowEnd'],
    };
    for (const text of [
      'what is the fertile window',
      'when is my next period',
      'summarise my data',
      'what is PCOS',
    ]) {
      const result = reply(text);
      const allowed = declared[result.messageKey];
      if (allowed) {
        for (const key of Object.keys(result.params)) {
          expect(allowed).toContain(key);
        }
      }
    }
  });
});

describe('refusals never answer the question', () => {
  it.each([
    ['I want to kill myself', 'responses.crisisRefusal'],
    ['should I take iron tablets', 'responses.medicationRefusal'],
    ['do I have PCOS', 'responses.diagnosisRefusal'],
    ['what is the share price of tata motors', 'responses.outOfScopeRefusal'],
  ])('refuses %j', (text, messageKey) => {
    const result = reply(text);
    expect(result.isRefusal).toBe(true);
    expect(result.messageKey).toBe(messageKey);
  });

  it('attaches no citations to a refusal', () => {
    const withSources = retrieveEducationSources(docs, 'PCOS');
    const result = reply('do I have PCOS', richContext(), withSources);
    expect(result.isRefusal).toBe(true);
    // Citing an article next to a refusal reads as an answer.
    expect(result.citations).toEqual([]);
  });

  it('keeps a crisis a crisis in every language', () => {
    for (const text of [
      'I want to kill myself',
      'मैं आत्महत्या करना चाहती हूँ',
      'ನಾನು ಆತ್ಮಹತ್ಯೆ ಮಾಡಲು ಬಯಸುತ್ತೇನೆ',
    ]) {
      expect(reply(text).isRefusal).toBe(true);
      expect(reply(text).messageKey).toBe('responses.crisisRefusal');
    }
  });

  it('refuses even when education sources are available', () => {
    const withSources = retrieveEducationSources(docs, 'irregular periods');
    expect(reply('should I take iron tablets', richContext(), withSources).isRefusal).toBe(true);
  });
});

describe('education answers cite their sources', () => {
  it('cites every supplied source', () => {
    const sources = retrieveEducationSources(docs, 'what is PCOS');
    const result = reply('what is PCOS', richContext(), sources);
    expect(result.citations).toEqual(sources);
    expect(result.params.count).toBe(sources.length);
  });

  it('still answers with no sources at all', () => {
    const result = reply('what is PCOS', richContext(), []);
    // With nothing to ground it, the honest answer is "no match", not a
    // confident-sounding summary with an empty citation list.
    expect(result.citations).toEqual([]);
    expect(result.messageKey).toBe('responses.noMatch');
  });
});

describe('a prediction is only stated when the engine produced one', () => {
  it('states the estimate when data is sufficient', () => {
    const result = reply('when is my next period', richContext());
    expect(result.messageKey).toMatch(/^responses\.prediction/);
    expect(result.params.estimatedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('adds the fertile window only when the engine produced one', () => {
    const result = reply('when is my next period', richContext());
    expect(result.messageKey).toBe('responses.predictionWithWindow');
    expect(result.params.windowStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.params.windowEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('withholds a date when the engine reports insufficient data', () => {
    const result = reply('when is my next period', emptyContext());
    // The point is that no date is invented to fill the gap.
    expect(result.params.estimatedDate).toBeUndefined();
    expect(result.params.windowStart).toBeUndefined();
    expect(JSON.stringify(result.params)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('the reply is deterministic', () => {
  it('produces an identical reply for identical input', () => {
    for (const text of ['hello', 'what is the fertile window', 'when is my next period']) {
      const first = JSON.stringify(reply(text));
      for (let i = 0; i < 25; i += 1) {
        expect(JSON.stringify(reply(text))).toBe(first);
      }
    }
  });

  it('derives the id from the turn number', () => {
    const context = richContext();
    expect(composeOfflineReply({ text: 'hi', turn: 0, context, sources: [] }).id).toBe('reply-0');
    expect(composeOfflineReply({ text: 'hi', turn: 3, context, sources: [] }).id).toBe('reply-3');
  });

  it('does not vary with wall-clock time', () => {
    const first = JSON.stringify(reply('when is my next period'));
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(JSON.stringify(reply('when is my next period'))).toBe(first);
        resolve();
      }, 5);
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Retrieval                                                                   */
/* -------------------------------------------------------------------------- */

describe('education retrieval', () => {
  it('finds the article that answers the question', () => {
    const [top] = retrieveEducationSources(docs, 'what is the fertile window');
    expect(top.articleId).toBe('fertileWindow');
  });

  it('ranks a condition question to the condition article', () => {
    const [top] = retrieveEducationSources(docs, 'tell me about PCOS');
    expect(top.articleId).toBe('pcosOverview');
  });

  it('respects the limit', () => {
    expect(retrieveEducationSources(docs, 'cycle', { limit: 1 })).toHaveLength(1);
    expect(retrieveEducationSources(docs, 'cycle', { limit: 0 })).toHaveLength(0);
  });

  it('filters by topic', () => {
    const results = retrieveEducationSources(docs, 'pain', { topic: 'whenToSeeDoctor' });
    expect(results.every((r) => r.topic === 'whenToSeeDoctor')).toBe(true);
  });

  it('opens with useful articles for an empty query instead of nothing', () => {
    expect(retrieveEducationSources(docs, '').length).toBeGreaterThan(0);
    expect(retrieveEducationSources(docs, '   ').length).toBeGreaterThan(0);
  });

  it('returns nothing rather than a bad match for unrelated text', () => {
    expect(retrieveEducationSources(docs, 'quantum chromodynamics')).toEqual([]);
  });

  it('caps the excerpt length', () => {
    const long = 'word '.repeat(2000);
    expect(buildExcerpt(long, 200).length).toBeLessThanOrEqual(200);
  });

  it('exposes the bundled article ids', () => {
    const ids = knownArticleIds();
    expect(ids).toContain('fertileWindow');
    expect(ids).toContain('pcosOverview');
    expect(new Set(ids).size).toBe(ids.length);
  });
});
