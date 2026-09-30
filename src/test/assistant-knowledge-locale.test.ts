import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import IntlMessageFormat from 'intl-messageformat';
import { composeOfflineReply } from '@/lib/assistant/respond';
import { emptyRedactedContext } from '@/lib/assistant/context';
import { KNOWLEDGE_ENTRIES, qualifyKnowledgeKey, knowledgeKey } from '@/lib/assistant/knowledge';
import { retrieveEducationSources } from '@/lib/assistant/retrieval';
import { ARTICLES } from '@/lib/learn/articles';
import { LOCALES, type Locale } from '@/types/i18n';

/**
 * The contract between the response composer and the shipped locale files.
 *
 * The view resolves every key the composer emits with `useTranslations('assistant')`,
 * so a `messageKey` and a `block.key` are both *namespace-relative* paths under
 * `assistant`. Two mistakes are possible and both fail silently at build time,
 * only surfacing as a raw key in the reader's own language:
 *
 *   - repeating the `assistant.` prefix, resolving to `assistant.assistant.…`;
 *   - emitting an entry's stored key unqualified, resolving to `assistant.log.detail`
 *     instead of `assistant.knowledge.log.detail`.
 *
 * These tests resolve the composer's real output against the real locale trees,
 * in every language, so neither mistake can ship.
 */

type Messages = { [key: string]: string | Messages };

const load = (locale: Locale): Messages =>
  JSON.parse(readFileSync(`public/locales/${locale}.json`, 'utf8')) as Messages;

/**
 * Resolves a dotted path the same way next-intl does under a namespace, and
 * formats the result — so a key that exists but is not valid ICU, or that is
 * missing a parameter it declares, fails here too, exactly as it would at render
 * time. The values bag supplies a placeholder for whatever the message actually
 * reads (a plural `count`, an interpolated date), mirroring the parity test.
 */
function resolveUnder(
  namespace: string,
  key: string,
  locale: Locale,
  values: Record<string, string | number> = {}
): string {
  const messages = load(locale);
  const value = [namespace, ...key.split('.')].reduce<unknown>((node, part) => {
    if (node && typeof node === 'object') return (node as Messages)[part];
    return undefined;
  }, messages);

  if (typeof value !== 'string') {
    throw new Error(
      `${locale}: "${key}" does not resolve under namespace "${namespace}" ` +
        `(got ${value === undefined ? 'undefined' : typeof value})`
    );
  }

  return new IntlMessageFormat(value, locale).format({
    count: 1,
    days: 1,
    day: 1,
    value: 1,
    ...values,
  }) as string;
}

const eduDocs = (locale: Locale) => {
  const learn = load(locale).learn as {
    articles: Record<string, { title: string; summary: string; body: string }>;
  };
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

const compose = (text: string, locale: Locale = 'en') =>
  composeOfflineReply({
    text,
    turn: 0,
    context: emptyRedactedContext(locale),
    sources: retrieveEducationSources(eduDocs(locale), text),
  });

/** Every key the composer can emit must be formatted, not merely present. */
function assertReplyRenderable(reply: ReturnType<typeof composeOfflineReply>, locale: Locale) {
  resolveUnder('assistant', reply.messageKey, locale);
  for (const block of reply.blocks) resolveUnder('assistant', block.key, locale);
}

describe('every key the composer emits resolves in every locale', () => {
  const representative = [
    'how do I log my period', // app_help -> knowledge.answer + knowledge.detail
    'what does the cervix do', // health_education -> knowledge entry
    'how do I change the language', // app_help -> knowledge.answer
    'what is worth knowing before a doctor visit', // education article fallback
  ];

  it.each(LOCALES)('%s formats the answer for every representative question', (locale) => {
    for (const text of representative) {
      const reply = compose(text, locale);
      assertReplyRenderable(reply, locale);
    }
  });

  it.each(LOCALES)('%s formats the refusal and its safety blocks', (locale) => {
    // A crisis reply still carries the medical warning/care blocks, so both the
    // refusal key and the qualified knowledge keys have to resolve.
    const reply = composeOfflineReply({
      text: 'I am bleeding heavily and I feel faint, I want to kill myself',
      turn: 0,
      context: emptyRedactedContext(locale),
      sources: [],
    });
    expect(reply.isRefusal).toBe(true);
    assertReplyRenderable(reply, locale);
  });
});

describe('knowledge keys are qualified exactly once', () => {
  it.each(LOCALES)('%s resolves an answer and detail under assistant.knowledge', (locale) => {
    const reply = compose('what does the cervix do', locale);
    expect(reply.messageKey.startsWith('knowledge.')).toBe(true);
    expect(reply.messageKey.startsWith('assistant.')).toBe(false);
    expect(resolveUnder('assistant', reply.messageKey, locale).length).toBeGreaterThan(0);

    for (const block of reply.blocks) {
      expect(block.key.startsWith('knowledge.'), block.key).toBe(true);
      expect(block.key.startsWith('assistant.'), block.key).toBe(false);
    }
  });

  it('qualifyKnowledgeKey is idempotent and never doubles the prefix', () => {
    expect(qualifyKnowledgeKey('log.detail')).toBe('knowledge.log.detail');
    expect(qualifyKnowledgeKey('knowledge.log.detail')).toBe('knowledge.log.detail');
    expect(qualifyKnowledgeKey(knowledgeKey('log', 'detail'))).toBe('knowledge.log.detail');
  });

  it('every entry slot key the composer can reach resolves in every locale', () => {
    // Exhaustively prove the qualification by walking the real corpus and
    // resolving each declared answer/detail/warning/care key.
    for (const entry of KNOWLEDGE_ENTRIES) {
      const slots: string[] = [entry.answerKey];
      if (entry.detailKey) slots.push(entry.detailKey);
      if (entry.warningKey) slots.push(entry.warningKey);
      if (entry.careKey) slots.push(entry.careKey);

      for (const slot of slots) {
        const key = qualifyKnowledgeKey(slot);
        for (const locale of LOCALES) {
          expect(() => resolveUnder('assistant', key, locale), `${locale}.${key}`).not.toThrow();
        }
      }
    }
  });
});

describe('shared composer labels exist in every locale', () => {
  it.each(LOCALES)('%s carries provenance and block headings', (locale) => {
    for (const key of [
      'provenanceLabel',
      'provenance.education',
      'provenance.appHelp',
      'provenance.personalData',
      'provenance.healthKnowledge',
      'blocks.warningHeading',
      'blocks.careHeading',
      'blocks.relatedHeading',
    ]) {
      const value = resolveUnder('assistant', key, locale);
      expect(value.length, `${locale}.${key}`).toBeGreaterThan(0);
    }
  });

  /**
   * The translation-review note is a release gate, not reader-facing copy.
   *
   * It lives in the module doc of `src/lib/assistant/knowledge/index.ts`. This
   * test pins that decision in both directions: the note exists in source, and
   * no locale ships any string that shows it to a reader. A banner admitting an
   * unreviewed translation to every reader would undercut the whole product.
   */
  it('keeps the translation-review note in source, out of the locales', () => {
    // Resolved from the repo root rather than a bare relative path, because this
    // file's own location is not where vitest's cwd necessarily points.
// Flattened first: the note is a wrapped block comment, so the phrase is split
    // across lines and each line carries a leading " * ".
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/assistant/knowledge/index.ts'),
      'utf8'
    )
      .replace(/\*\//g, ' ')
      .replace(/[^\S\n]*\*[^\S\n]*/g, ' ')
      .replace(/\s+/g, ' ');

    expect(source).toMatch(/Hindi and Kannada clinical content requires native-speaker/);
    expect(source).toMatch(/medically informed review before production release/);

    for (const locale of LOCALES) {
      const serialised = JSON.stringify(load(locale));

      for (const marker of ['unreviewed', 'not been reviewed', 'requires review']) {
        expect(serialised, `${locale} exposes "${marker}" to readers`).not.toContain(marker);
      }
    }
  });
});

describe('the no-match fallback covers all four supported areas', () => {
  /**
   * The old fallback said only "I could not find anything about that in the
   * education library", which was true but misleading once the assistant could
   * also answer app questions, personal-record questions and safety questions:
   * a reader who asked how to log their period was told, wrongly, that the
   * answer had to be in the library. The replacement has to describe the real
   * scope.
   *
   * Checked per locale because the four areas have to actually be named in each
   * language — a fallback that keeps the library-only wording in one language
   * while translating the rest is exactly the failure this guards against.
   */
  const AREA_MARKERS: Record<string, [string, string, string, string]> = {
    en: ['PMSify', 'recorded', 'education library', 'doctor'],
    hi: ['PMSify', 'दर्ज', 'शिक्षा पुस्तकालय', 'डॉक्टर'],
    kn: ['PMSify', 'ದಾಖಲಿಸಿದ', 'ಶಿಕ್ಷಣಾ ಗ್ರಂಥಾಲಯ', 'ವೈದ್ಯರ'],
  };

  it.each(LOCALES)('%s names the app, personal data, education and seeing a doctor', (locale) => {
    const value = resolveUnder('assistant', 'responses.noMatch', locale);
    const [app, personal, education, care] = AREA_MARKERS[locale];

    for (const [area, marker] of Object.entries({ app, personal, education, care })) {
      expect(value, `${locale} noMatch omits ${area}`).toContain(marker);
    }

    // And it no longer reads as an Education-only promise.
    expect(value).not.toMatch(/education library(?! yourself)/i);
  });

  it.each(LOCALES)('%s no longer carries the removed appHelp responses', (locale) => {
    const responses = (load(locale).assistant as { responses: Record<string, unknown> }).responses;
    expect(Object.keys(responses).filter((key) => key.startsWith('appHelp'))).toEqual([]);
  });
});