import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import {
  RedactedContextViolation,
  assertRedactedContextIsSafe,
  buildRedactedContext,
  emptyRedactedContext,
  type ContextCycleInput,
  type ContextDailyLogInput,
} from '../lib/assistant/context';
import { REDACTED_CONTEXT_SCHEMA_VERSION } from '../lib/assistant/types';
import type { CycleDomainModel, DailyLogDomainModel } from '../types/health';

/**
 * The privacy boundary.
 *
 * These tests are the ones that matter most in this feature. Everything else
 * can be wrong in a way that produces a bad answer; a failure here produces a
 * breach, so the assertions use canary values planted in the source records and
 * then search the entire serialized output for them.
 */

const NOTE_CANARY = 'CANARY-FREE-TEXT-a1b2c3d4';
const PIN_HASH_CANARY = 'CANARY-PIN-HASH-e5f6g7h8';
const PIN_SALT_CANARY = 'CANARY-PIN-SALT-i9j0k1l2';

/** Full domain records, deliberately carrying sensitive fields. */
const cyclesWithSecrets: CycleDomainModel[] = [
  {
    startDate: '2026-01-05',
    endDate: '2026-01-10',
    flow: 'medium',
    notes: NOTE_CANARY,
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  },
  {
    startDate: '2026-02-05',
    endDate: '2026-02-10',
    flow: 'light',
    notes: NOTE_CANARY,
    createdAt: '2026-02-05T00:00:00.000Z',
    updatedAt: '2026-02-05T00:00:00.000Z',
  },
  {
    startDate: '2026-03-08',
    endDate: '2026-03-13',
    flow: 'heavy',
    notes: NOTE_CANARY,
    createdAt: '2026-03-08T00:00:00.000Z',
    updatedAt: '2026-03-08T00:00:00.000Z',
  },
];

const dailyLogsWithSecrets: DailyLogDomainModel[] = [
  {
    date: '2026-03-09',
    symptoms: [{ id: 'cramps', intensity: 4, notes: NOTE_CANARY }],
    mood: [{ id: 'anxious', intensity: 3 }],
    painLevel: 5,
    sleepHours: 6,
    hydrationMl: 1500,
    notes: NOTE_CANARY,
    createdAt: '2026-03-09T00:00:00.000Z',
    updatedAt: '2026-03-09T00:00:00.000Z',
  },
  {
    date: '2026-03-10',
    symptoms: [{ id: 'headache', intensity: 2 }],
    mood: [{ id: 'calm', intensity: 4 }],
    painLevel: 2,
    sleepHours: 7.5,
    hydrationMl: 2000,
    notes: NOTE_CANARY,
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: '2026-03-10T00:00:00.000Z',
  },
];

const build = (overrides: Partial<Parameters<typeof buildRedactedContext>[0]> = {}) =>
  buildRedactedContext({
    locale: 'en',
    today: '2026-03-15',
    cycles: cyclesWithSecrets,
    dailyLogs: dailyLogsWithSecrets,
    ...overrides,
  });

/* -------------------------------------------------------------------------- */
/* Compile-time proof                                                          */
/* -------------------------------------------------------------------------- */

/**
 * These two assignments are the structural guarantee, expressed as code.
 *
 * `ContextCycleInput` and `ContextDailyLogInput` are `Pick<…>` types that omit
 * `notes`, so `'notes' extends keyof T` is `false`. If somebody later widens
 * either input type to include the notes field, this file stops compiling —
 * which is a stronger guarantee than any runtime assertion, because it cannot
 * be bypassed by a code path a test forgot to exercise.
 */
type HasNotes<T> = 'notes' extends keyof T ? true : false;
const cycleInputHasNoNotes: HasNotes<ContextCycleInput> = false;
const dailyLogInputHasNoNotes: HasNotes<ContextDailyLogInput> = false;

describe('the builder input type cannot carry notes', () => {
  it('holds at compile time', () => {
    expect(cycleInputHasNoNotes).toBe(false);
    expect(dailyLogInputHasNoNotes).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* The canary                                                                  */
/* -------------------------------------------------------------------------- */

describe('free text never reaches the redacted context', () => {
  it('omits cycle and daily-log notes entirely', () => {
    const serialized = JSON.stringify(build());
    expect(serialized).not.toContain(NOTE_CANARY);
  });

  it('omits nested symptom notes', () => {
    expect(JSON.stringify(build())).not.toContain(NOTE_CANARY);
  });

  it('contains no free-text field at all', () => {
    // Every string in the context must be short enough to be a key, an enum, or
    // a date. assertRedactedContextIsSafe enforces this and the context passes.
    expect(() => assertRedactedContextIsSafe(build())).not.toThrow();
  });

  it('exposes no field that could hold prose', () => {
    const context = build();
    const strings: string[] = [];
    const walk = (node: unknown) => {
      if (typeof node === 'string') strings.push(node);
      else if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === 'object') Object.values(node).forEach(walk);
    };
    walk(context);
    for (const value of strings) {
      expect(value.length).toBeLessThanOrEqual(200);
    }
  });
});

describe('PIN material is unreachable', () => {
  it('imports only pure engines and type-only modules', () => {
    // Module specifiers are checked rather than raw text, so an explanatory
    // comment naming a forbidden type cannot cause a false pass or failure.
    const specifiers = [...readFileSync('src/lib/assistant/context.ts', 'utf8').matchAll(/from\s+'([^']+)'/g)].map(
      (match) => match[1]
    );
    expect(specifiers).toEqual([
      '@/types/health',
      '@/types/i18n',
      '@/lib/analytics',
      '@/lib/cycle-engine',
      '@/lib/insights',
      './types',
    ]);
    // No database, no preferences, no repository: there is no path from here to
    // PIN material even if somebody later passes extra fields.
    for (const specifier of specifiers) {
      expect(specifier).not.toMatch(/storage|repository|preferences/i);
    }
  });

  it('names no PIN field in code', () => {
    const code = readFileSync('src/lib/assistant/context.ts', 'utf8').replace(
      /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
      ''
    );
    expect(code).not.toContain('pinHash');
    expect(code).not.toContain('pinSalt');
    expect(code).not.toContain('UserPreferencesRecord');
  });

  it('would reject a context that somehow carried PIN fields', () => {
    const contaminated = { ...build(), pinHash: PIN_HASH_CANARY, pinSalt: PIN_SALT_CANARY };
    expect(() => assertRedactedContextIsSafe(contaminated)).toThrow(RedactedContextViolation);
  });
});

describe('arbitrary raw records cannot be smuggled through', () => {
  it('rejects a nested key that looks like a note', () => {
    expect(() =>
      assertRedactedContextIsSafe({ cycle: { notes: NOTE_CANARY } })
    ).toThrow(/forbidden key "notes"/);
  });

  it('rejects a forbidden key at any depth', () => {
    expect(() =>
      assertRedactedContextIsSafe({ a: { b: { c: { email: 'x@example.com' } } } })
    ).toThrow(RedactedContextViolation);
  });

  it('rejects an over-long string, which is what prose would look like', () => {
    // Key is deliberately not "note": that trips the forbidden-key check first.
    expect(() => assertRedactedContextIsSafe({ value: 'x'.repeat(500) })).toThrow(
      /over the 200 char limit/
    );
  });

  it('rejects a circular structure rather than looping forever', () => {
    const node: Record<string, unknown> = {};
    node.self = node;
    expect(() => assertRedactedContextIsSafe(node)).toThrow(/circular reference/);
  });

  it('accepts a genuine context', () => {
    expect(() => assertRedactedContextIsSafe(build())).not.toThrow();
    expect(() => assertRedactedContextIsSafe(emptyRedactedContext('hi'))).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* Engine fidelity                                                             */
/* -------------------------------------------------------------------------- */

describe('the context reflects the deterministic engines', () => {
  it('carries the schema version and locale', () => {
    const context = build();
    expect(context.schemaVersion).toBe(REDACTED_CONTEXT_SCHEMA_VERSION);
    expect(context.locale).toBe('en');
  });

  it('passes the reader locale through for all three languages', () => {
    for (const locale of ['en', 'hi', 'kn'] as const) {
      expect(build({ locale }).locale).toBe(locale);
    }
  });

  it('reports recorded counts from the records', () => {
    const context = build();
    expect(context.recordedCycles).toBe(3);
    expect(context.recordedDailyLogs).toBe(2);
  });

  it('surfaces a prediction once the engine has enough data', () => {
    const { prediction } = build();
    expect(prediction.status).toBe('predicted');
    expect(prediction.estimatedStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('withholds dates when the engine reports insufficient data', () => {
    const { prediction } = build({ cycles: [cyclesWithSecrets[0]] });
    expect(prediction.status).toBe('insufficient_data');
    // The important part: no estimate leaks alongside the refusal to estimate.
    expect(prediction.estimatedStartDate).toBeNull();
    expect(prediction.fertileWindowStartDate).toBeNull();
    expect(prediction.fertileWindowEndDate).toBeNull();
    expect(prediction.estimatedOvulationDate).toBeNull();
  });

  it('withholds dates for invalid input', () => {
    const { prediction } = buildRedactedContext({
      locale: 'en',
      today: '2026-03-15',
      cycles: [],
      dailyLogs: [],
    });
    expect(prediction.estimatedStartDate).toBeNull();
  });

  it('carries only numeric cycle lengths, never dated log rows', () => {
    const { cycle } = build();
    for (const length of cycle.cycleLengthsDays) {
      expect(typeof length).toBe('number');
    }
  });

  it('caps the cycle length series', () => {
    const many = Array.from({ length: 40 }, (_, index) => {
      const day = String((index % 28) + 1).padStart(2, '0');
      return {
        startDate: `2025-${String((index % 12) + 1).padStart(2, '0')}-${day}`,
        endDate: `2025-${String((index % 12) + 1).padStart(2, '0')}-${day}`,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      } satisfies CycleDomainModel;
    });
    expect(build({ cycles: many }).cycle.cycleLengthsDays.length).toBeLessThanOrEqual(12);
  });

  it('keeps symptom and mood ids, which are a fixed vocabulary', () => {
    const { daily } = build();
    for (const entry of daily.topSymptoms) {
      expect(typeof entry.id).toBe('string');
      expect(entry.id).toMatch(/^[a-z]+$/);
      expect(typeof entry.count).toBe('number');
    }
  });

  it('never carries insight interpolation params, the only free-text risk in an insight', () => {
    const context = build({
      insights: [
        {
          id: 'cycle.average',
          category: 'cycle',
          priority: 'high',
          titleKey: 'insights.cycle.average.title',
          messageKey: 'insights.cycle.average.message',
          params: { note: NOTE_CANARY },
          evidence: [{ metric: 'cycleLengthMin', value: 21 }],
        },
      ],
    });
    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain(NOTE_CANARY);
    expect(context.insights[0]).not.toHaveProperty('params');
    expect(context.insights[0]).not.toHaveProperty('evidence');
  });
});

describe('determinism and empty input', () => {
  it('produces identical output for identical input', () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it('does not depend on the wall clock when today is supplied', () => {
    const a = build({ today: '2026-03-15' });
    const b = build({ today: '2026-03-15' });
    expect(a).toEqual(b);
  });

  it('produces a valid empty context for a user with no records', () => {
    const context = emptyRedactedContext('kn');
    expect(context.recordedCycles).toBe(0);
    expect(context.recordedDailyLogs).toBe(0);
    expect(context.insights).toEqual([]);
    expect(context.prediction.status).not.toBe('predicted');
    expect(() => assertRedactedContextIsSafe(context)).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* Client/server separation                                                     */
/* -------------------------------------------------------------------------- */

describe('the provider credential cannot reach a client bundle', () => {
  it('re-exports every client-safe assistant module and nothing server-only', () => {
    const reExported = new Set(
      [...readFileSync('src/lib/assistant/index.ts', 'utf8').matchAll(/from\s+'(\.\/[a-z-]+)'/g)].map(
        (match) => match[1]
      )
    );
    // Enumerated, not asserted loosely: the point of this test is that the list
    // is deliberate. `knowledge` and `route` were added with the structured
    // knowledge base — both are pure data and pure decision logic, so both are
    // safe in the client graph and both are needed there, because the view and the
    // composer run in the browser.
    expect([...reExported].sort()).toEqual([
      './context',
      './guardrails',
      './intent',
      './knowledge',
      './respond',
      './retrieval',
      './route',
      './types',
    ]);
    // gateway.ts holds the credential; handler.ts imports it.
    expect(reExported.has('./gateway')).toBe(false);
    expect(reExported.has('./handler')).toBe(false);
  });

  it('keeps nothing server-only reachable from any re-exported module', () => {
    // The list above is only trustworthy if each entry really is client-safe, so
    // this walks them rather than trusting the barrel's own shape.
    const barrel = readFileSync('src/lib/assistant/index.ts', 'utf8');
    const modules = [...new Set([...barrel.matchAll(/from\s+'(\.\/[a-z-]+)'/g)].map((m) => m[1]))];

    const filesOf = (specifier: string): string[] => {
      const base = `src/lib/assistant/${specifier.slice(2)}`;
      if (existsSync(`${base}.ts`)) return [`${base}.ts`];
      return readdirSync(base, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
        .map((entry) => `${base}/${entry.name}`);
    };

    for (const specifier of modules) {
      for (const file of filesOf(specifier)) {
        const source = readFileSync(file, 'utf8');
        const imports = [...source.matchAll(/^import[\s\S]*?from\s+'([^']+)'/gm)].map((m) => m[1]);

        for (const imported of imports) {
          expect(imported, `${file} imports ${imported}`).not.toMatch(/gateway|handler/);
        }
        expect(source, `${file} references the provider settings`).not.toMatch(
          /PMSIFY_GEMMA|PMSIFY_ASSISTANT_GATEWAY/
        );
      }
    }
  });

  it('keeps the handler and the credential out of the client barrel', () => {
    const barrel = readFileSync('src/lib/assistant/index.ts', 'utf8');
    expect(barrel).not.toContain("'./handler'");
    expect(barrel).not.toContain("'./gateway'");
  });

  it('does not leak the provider settings into the client view', () => {
    const view = readFileSync('src/features/assistant/assistant-view.tsx', 'utf8');
    expect(view).not.toContain('PMSIFY_GEMMA');
    expect(view).not.toContain('PMSIFY_ASSISTANT_GATEWAY');
  });

  it('reaches the credential only through the handler', () => {
    const handler = readFileSync('src/lib/assistant/handler.ts', 'utf8');
    expect(handler).toContain("from '@/lib/assistant/gateway'");

    const route = readFileSync('src/app/api/assistant/route.ts', 'utf8');
    expect(route).toContain("@/lib/assistant/handler");
    // The route must not import the credential module itself.
    expect(route).not.toContain("from '@/lib/assistant/gateway'");
  });

  it('exports nothing but POST from the route module', () => {
    // Next.js rejects other exports at build time; this documents the rule so a
    // future helper is added to the handler instead.
    const route = readFileSync('src/app/api/assistant/route.ts', 'utf8');
    const exports = [...route.matchAll(/^export\s+(?:async\s+)?(?:function|const|let)\s+(\w+)/gm)].map(
      (match) => match[1]
    );
    expect(exports).toEqual(['POST']);
  });

  it('keeps the credential out of the browser bundle entirely', () => {
    // The env var is read only inside the server route, so a client bundle can
    // never contain it even if the value is present in the build environment.
    const clientFiles = [
      'src/features/assistant/assistant-view.tsx',
      'src/lib/assistant/context.ts',
      'src/lib/assistant/respond.ts',
      'src/lib/assistant/retrieval.ts',
      'src/lib/assistant/intent.ts',
      'src/lib/assistant/guardrails.ts',
    ];
    for (const file of clientFiles) {
      expect(readFileSync(file, 'utf8')).not.toContain('PMSIFY_GEMMA_API_KEY');
    }
  });
});
