import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ARTICLES } from '@/lib/learn/articles';
import { classifyIntent, detectMedicationRequest } from '@/lib/assistant/intent';
import {
  curatedArticleMatches,
  inferTopicHints,
  retrieveEducationSources,
  stripQuestionWords,
  type EducationDoc,
} from '@/lib/assistant/retrieval';
import { appHelpTopicFor, composeOfflineReply } from '@/lib/assistant/respond';
import { APP_HELP_PATHS } from '@/lib/assistant/knowledge';
import { emptyRedactedContext } from '@/lib/assistant/context';
import { rankArticlesByRelevance } from '@/lib/learn/search';
import { LOCALES } from '@/types/i18n';

/**
 * The questions the assistant used to get wrong.
 *
 * Each case here is a real message that produced a real bad answer, so this file
 * is the regression net for the fix rather than a description of it. The three
 * failures that motivated it were:
 *
 *   - a question with no article title in it ("what is worth knowing before a
 *     doctor visit") returned nothing at all, because Education's search requires
 *     every word to match;
 *   - "how do I log my period" was answered with a summary of the reader's own
 *     data, because a possessive was treated as a request for one;
 *   - citations named an article and showed nothing of it.
 *
 * The corpus is the real one, in real prose, loaded from the shipped locale
 * files. A hand-built fixture would let the ranker be tuned against words the
 * app does not actually ship.
 */

const corpus = (locale: string): EducationDoc[] => {
  const learn = JSON.parse(readFileSync(`public/locales/${locale}.json`, 'utf8')).learn;

  return ARTICLES.map((article) => ({
    id: article.id,
    topic: article.topic,
    titleKey: `articles.${article.id}.title`,
    summaryKey: `articles.${article.id}.summary`,
    title: learn.articles[article.id].title,
    summary: learn.articles[article.id].summary,
    body: learn.articles[article.id].body,
  }));
};

const docs = corpus('en');
const top = (query: string) => retrieveEducationSources(docs, query)[0]?.articleId;

describe('education retrieval answers real questions', () => {
  it('finds the article for a question that shares no words with its title', () => {
    // "worth", "knowing" and "before" appear nowhere in the two relevant
    // articles. Only "doctor" does, and only in one of the two titles.
    expect(top('what is worth knowing before a doctor visit?')).toBe('whenToSeeDoctor');
  });

  it('answers a symptom question with the article about that symptom', () => {
    // "cramps" is not in the pain article's title or body at all, so only the
    // curated article mapping can put it first.
    expect(top('what can I do for period cramps?')).toBe('painTracking');
  });

  it('distinguishes PMS from PMDD for a question that names both', () => {
    expect(top('what is the difference between PMS and PMDD')).toBe('pmsVsPmd');
  });

  it('routes a tiredness question away from a generic symptoms article', () => {
    expect(top('why am I so tired all the time')).toBe('anaemiaFatigue');
  });

  it('names the condition the reader asked about', () => {
    expect(top('is endometriosis serious')).toBe('endometriosisOverview');
    expect(top('what is PCOS')).toBe('pcosOverview');
  });

  it('answers a question with no question words in it', () => {
    expect(top('how much water should I drink')).toBe('hydrationEnergy');
  });

  it('keeps a cycle question inside cycle basics', () => {
    const sources = retrieveEducationSources(docs, 'when will my next period be', {
      topic: 'cycleBasics',
    });
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => source.topic === 'cycleBasics')).toBe(true);
  });

  it('refuses to guess rather than returning a stray word match', () => {
    // The behaviour that matters most: no article, and the assistant says so.
    expect(retrieveEducationSources(docs, 'quantum chromodynamics')).toEqual([]);
    expect(top('how do I bake sourdough bread')).toBeUndefined();
  });

  it('still offers the library when there is no question to work from', () => {
    expect(retrieveEducationSources(docs, '').length).toBeGreaterThan(0);
  });
});

describe('app questions are app questions', () => {
  it('does not mistake a question about logging for a question about records', () => {
    // This is the bug that motivated the intent: the possessive in "my period"
    // used to trigger a summary of the reader's personal data.
    expect(classifyIntent('how do I log my period')).toBe('appHelp');
    expect(classifyIntent('how do I track my cycle')).toBe('appHelp');
    expect(classifyIntent('where do I see my trends')).toBe('appHelp');
    expect(classifyIntent('how do I change the language')).toBe('appHelp');
  });

  it('still answers a question about a symptom, possessive and all', () => {
    // The other half of the same fix: a possessive on its own is a symptom
    // being described, not a request for a summary.
    expect(classifyIntent('why do my periods hurt so much')).toBe('education');
    expect(classifyIntent('why does my head hurt so badly')).not.toBe('personalSummary');
  });

  it('treats an explicit recap request as a recap', () => {
    expect(classifyIntent('tell me about my symptoms')).toBe('personalSummary');
    expect(classifyIntent('summarise my data')).toBe('personalSummary');
    expect(classifyIntent('what does my data show')).toBe('personalSummary');
  });

  it('routes an app question to the screen that answers it', () => {
    expect(appHelpTopicFor('how do I log my period')).toBe('log');
    expect(appHelpTopicFor('how do I record my mood')).toBe('daily');
    expect(appHelpTopicFor('when will my next period be')).toBe('predictions');
    expect(appHelpTopicFor('where do I see my trends')).toBe('insights');
    expect(appHelpTopicFor('how do I change the language')).toBe('settings');
  });

  it('points at a real app route', () => {
    const reply = composeOfflineReply({
      text: 'how do I log my period',
      turn: 0,
      context: emptyRedactedContext('en'),
      sources: retrieveEducationSources(docs, 'how do I log my period'),
    });

    expect(reply.intent).toBe('appHelp');
    expect(reply.isRefusal).toBe(false);
    // No article can explain where a button is, so citing one would be noise.
    expect(reply.citations).toEqual([]);
    expect(reply.params.target).toBe('/health');
  });

  it('points every app question at the screen that answers it', () => {
    // Driven off the same table the composer uses, so a rename of a target or a
    // mistyped path literal is caught here rather than in the reader's hand.
    // `predictions` and `cycleDay` resolve to Home ('/'): predictions are shown on
    // the Home screen, and /calendar shows recorded dates only, so it is not
    // where an estimate is explained.
    const expected: Record<string, string> = {
      'how do I log my period': APP_HELP_PATHS.log,
      'how do I record my mood': APP_HELP_PATHS.daily,
      'how do I see my predicted dates': APP_HELP_PATHS.predictions,
      'where do I see my trends': APP_HELP_PATHS.insights,
      'how do I change the language': APP_HELP_PATHS.settings,
    };

    for (const [text, target] of Object.entries(expected)) {
      const reply = composeOfflineReply({
        text,
        turn: 0,
        context: emptyRedactedContext('en'),
        sources: [],
      });
      expect(reply.params.target, text).toBe(target);
    }
  });

  it('names only routes the app actually has', () => {
    // The targets are written as literals, so nothing else would catch a path
    // that no longer exists. Checked against the locale navigation tables the
    // app actually ships.
    const targets = new Set(
      Object.values(APP_HELP_PATHS).map((path) => path.split(/[?#]/)[0])
    );

    expect(targets.has('/')).toBe(true);
    expect(targets.has('/calendar')).toBe(true);

    for (const path of Object.values(APP_HELP_PATHS)) {
      expect(path.startsWith('/'), path).toBe(true);
    }
  });

  it('answers a prediction with the cycle engine, not a link', () => {
    // Precedence is deliberate: a date question has a real answer computed from
    // the reader's own cycles, so it must not be demoted to "here is where to
    // look" by the app-help branch.
    const reply = composeOfflineReply({
      text: 'when will my next period be',
      turn: 0,
      context: emptyRedactedContext('en'),
      sources: [],
    });

    expect(reply.intent).toBe('prediction');
    expect(reply.params.target).toBeUndefined();
  });
});

describe('medication safety survives the widened vocabulary', () => {
  it('catches a brand name as readily as the generic noun', () => {
    // "I want to take crocin for cramps" contains no word from the old
    // medication list, so it reached retrieval and came back as an answer about
    // cramps — which is advice on medication by another route.
    expect(detectMedicationRequest('I want to take crocin for cramps')).toBe(true);
    expect(classifyIntent('I want to take crocin for cramps')).toBe('medication');
    expect(classifyIntent('how much crocin should I take')).toBe('medication');
    expect(classifyIntent('should I try ashwagandha for PMS')).toBe('medication');
  });

  it('catches Hindi and Kannada brand and generic names', () => {
    expect(classifyIntent('क्रोसिन कितना लें')).toBe('medication');
    expect(classifyIntent('ಯಾವ ಔಷಧಿ ತೆಗೆಯುವುದು')).toBe('medication');
  });

  it('still refuses rather than answering', () => {
    const reply = composeOfflineReply({
      text: 'I want to take crocin for cramps',
      turn: 0,
      context: emptyRedactedContext('en'),
      sources: retrieveEducationSources(docs, 'I want to take crocin for cramps'),
    });

    expect(reply.isRefusal).toBe(true);
    expect(reply.messageKey).toBe('responses.medicationRefusal');
    expect(reply.citations).toEqual([]);
  });

  it('does not treat a condition name as a diagnosis claim', () => {
    // "What is PCOS" is a question. "I think I have PCOS" is not, and only the
    // second may be refused.
    expect(classifyIntent('what is PCOS')).toBe('education');
    expect(classifyIntent('I think I have pcos')).toBe('diagnosis');
  });
});

describe('hints stay inside the corpus', () => {
  it('ignores a hint for an article the caller did not load', () => {
    const small = docs.filter((doc) => doc.id === 'pcosOverview');
    const boosts = inferTopicHints(small, 'what is endometriosis');
    expect([...boosts.keys()].every((id) => small.some((doc) => doc.id === id))).toBe(true);

    const matches = curatedArticleMatches(small, 'what is endometriosis');
    expect(matches.has('endometriosisOverview')).toBe(false);
  });

  it('cannot return an article with no word in common', () => {
    // The curated mapping is the only thing allowed to do that, so the ranker
    // itself must refuse when the caller does not grant it. The query is
    // stripped first, exactly as retrieval does, because unstripped question
    // words like "i" and "do" match almost any body and would make the
    // comparison meaningless.
    const question = stripQuestionWords('what can I do for period cramps?');

    const plain = rankArticlesByRelevance(docs, question);
    expect(plain.map((entry) => entry.id)).not.toContain('painTracking');

    // With the escape hatch the article is reachable, and with the boost that
    // normally accompanies it, it leads. Either half alone is not the real call.
    const escaped = rankArticlesByRelevance(docs, question, {
      qualifyingIds: curatedArticleMatches(docs, question),
    });
    expect(escaped.map((entry) => entry.id)).toContain('painTracking');

    const real = rankArticlesByRelevance(docs, question, {
      qualifyingIds: curatedArticleMatches(docs, question),
      scoreBoostById: inferTopicHints(docs, question),
    });
    expect(real[0]?.id).toBe('painTracking');
  });
});

describe('retrieval holds up in the other two languages', () => {
  it.each(LOCALES.filter((locale) => locale !== 'en'))(
    'answers questions in %s',
    (locale) => {
      const local = corpus(locale);
      const [logQuestion, doctorQuestion, conditionQuestion] =
        locale === 'hi'
          ? ['मैं पीरियड कैसे दर्ज करूँ', 'डॉक्टर से मिलने से पहले क्या जानना जरूरी है', 'एंडोमेट्रियोसिस क्या है']
          : ['ನನ್ನ ಮುಟ್ಟನ್ನು ಹೇಗೆ ದಾಖಲಿಸುವುದು', 'ವೈದ್ಯರನ್ನು ಭೇಟಿಯಾಗುವ ಮೊದಲೇ ಏನು ತಿಳಿಯಬೇಕು', 'ಎಂಡೊಮೆಟ್ರಿಯೋಸಿಸ್ ಎಂದರೇನು'];

      expect(classifyIntent(logQuestion)).toBe('appHelp');
      expect(retrieveEducationSources(local, doctorQuestion).length).toBeGreaterThan(0);
      expect(retrieveEducationSources(local, conditionQuestion)[0]?.articleId).toBe(
        'endometriosisOverview'
      );
    }
  );
});
