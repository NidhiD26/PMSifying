import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import IntlMessageFormat from 'intl-messageformat';
import { locales, defaultLocale } from '../i18n/config';

/**
 * Locales are loaded from JSON at runtime, so a missing key does not fail the
 * build — it fails in the interface, in the reader's language, on someone
 * else's device. These tests are the guard for that.
 */

type Messages = { [key: string]: string | Messages };

/**
 * ICU AST element types, as emitted by intl-messageformat:
 *   0 literal, 1 argument, 2 number, 3 date, 4 time,
 *   5 select, 6 plural, 7 pound (#), 8 selectordinal.
 */
const enum ElementType {
  Literal = 0,
  Argument = 1,
  Number = 2,
  Date = 3,
  Time = 4,
  Select = 5,
  Plural = 6,
  Pound = 7,
  SelectOrdinal = 8,
}

interface AstElement {
  type: ElementType;
  value?: string | number;
  options?: Record<string, { value: AstElement[] }>;
}

interface Variable {
  name: string;
  /** Types this variable is used with, so a later use can raise the requirement. */
  types: Set<ElementType>;
}

/**
 * Collects the variables a message genuinely reads, from its parsed AST.
 *
 * Going through the AST rather than a regex is what makes this trustworthy:
 * plural branch prose like `{count, plural, =0 {No articles}}` contains `{No`,
 * which a regex happily reports as a variable named "No".
 */
function parseVariables(elements: AstElement[]): Variable[] {
  const found = new Map<string, Variable>();

  const record = (name: string, type: ElementType) => {
    const existing = found.get(name);
    if (existing) {
      existing.types.add(type);
    } else {
      found.set(name, { name, types: new Set([type]) });
    }
  };

  const walk = (nodes: AstElement[]) => {
    for (const node of nodes) {
      // Literals carry their text in `value` too, and `#` has no value at all.
      // Only genuine placeholder elements name a variable.
      if (node.type === ElementType.Literal || node.type === ElementType.Pound) continue;
      if (typeof node.value === 'string') record(node.value, node.type);
      if (node.options) {
        for (const option of Object.values(node.options)) walk(option.value);
      }
    }
  };

  walk(elements);
  return [...found.values()];
}

/** Counts chosen to hit the zero, one, and plural branches of any rule. */
const BRANCH_COUNTS = [3, 1, 0, 7];

/**
 * `ast` is marked private in the type declarations but is the parser's public
 * output at runtime, and it is the only accurate way to see which variables a
 * message really reads.
 */
function astOf(formatter: IntlMessageFormat): AstElement[] {
  return (formatter as unknown as { ast: AstElement[] }).ast;
}

function load(locale: string): Messages {
  return JSON.parse(readFileSync(`public/locales/${locale}.json`, 'utf8')) as Messages;
}

/** Flattens to dotted leaf paths, matching how next-intl addresses a key. */
function leafKeys(node: Messages, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : leafKeys(value as Messages, path);
  });
}

function read(messages: Messages, key: string): string | Messages | undefined {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object') return (node as Messages)[part];
    return undefined;
  }, messages) as string | Messages | undefined;
}

/**
 * A correctly typed value for each variable.
 *
 * A name used both bare and as a plural (`{count} {count, plural, …}`) must be
 * a number, so the strongest type requirement across all uses wins.
 */
function valuesFor(variables: Variable[], count: number): Record<string, string | number> {
  const values: Record<string, string | number> = {};

  for (const variable of variables) {
    const numeric = [
      ElementType.Number,
      ElementType.Plural,
      ElementType.SelectOrdinal,
    ].some((type) => variable.types.has(type));

    if (numeric) {
      values[variable.name] = count;
    } else if (variable.types.has(ElementType.Select)) {
      values[variable.name] = 'other';
    } else {
      values[variable.name] = 'sample';
    }
  }

  return values;
}

/**
 * The ICU variable names a message reads, keyed by message path.
 *
 * Malformed patterns yield an empty list; the dedicated parse/format test is
 * what reports those.
 */
function usedVariables(messages: Messages): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const key of leafKeys(messages)) {
    let names: string[] = [];
    try {
      const formatter = new IntlMessageFormat(String(read(messages, key)), 'en');
      names = parseVariables(astOf(formatter))
        .map((variable) => variable.name)
        .sort();
    } catch {
      // Reported by the parse/format test below.
    }
    result.set(key, names);
  }

  return result;
}

const tables = Object.fromEntries(locales.map((l) => [l, leafKeys(load(l))]));

describe('locale files are valid JSON', () => {
  it.each(locales)('%s.json parses and has leaves', (locale) => {
    expect(tables[locale].length).toBeGreaterThan(0);
  });

  it('declares a default locale that is actually supported', () => {
    expect(locales).toContain(defaultLocale);
  });
});

describe('locale key parity', () => {
  const reference = tables[defaultLocale];

  it.each(locales.filter((l) => l !== defaultLocale))(
    '%s has exactly the same keys as %s',
    (locale) => {
      const expected = new Set(reference);
      const actual = new Set(tables[locale]);

      const missing = reference.filter((key) => !actual.has(key));
      const extra = tables[locale].filter((key) => !expected.has(key));

      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] });
    }
  );

  it.each(locales)('%s has no duplicate leaf keys', (locale) => {
    const keys = tables[locale];
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('translation values are usable', () => {
  it.each(locales)('%s has no empty or blank strings', (locale) => {
    const messages = load(locale);
    const blanks = leafKeys(messages).filter((key) => {
      const value = read(messages, key);
      return typeof value === 'string' && value.trim() === '';
    });
    expect(blanks).toEqual([]);
  });

  // next-intl formats with intl-messageformat, so a malformed ICU message is not
  // caught by the build — it throws in the reader's face at render time. Parse
  // and format every message to prove it actually works.
  it.each(locales)('%s has ICU messages that parse and format', (locale) => {
    const messages = load(locale);
    const broken: { key: string; error: string }[] = [];

    for (const key of leafKeys(messages)) {
      const pattern = String(read(messages, key));

      let formatter: IntlMessageFormat;
      let variables: Variable[];
      try {
        formatter = new IntlMessageFormat(pattern, locale);
        variables = parseVariables(astOf(formatter));
      } catch (error) {
        broken.push({ key, error: `parse: ${(error as Error).message}` });
        continue;
      }

      // Exercise the plural/select branches, not just the happy path.
      try {
        for (const count of BRANCH_COUNTS) {
          formatter.format(valuesFor(variables, count));
        }
      } catch (error) {
        broken.push({ key, error: `format: ${(error as Error).message}` });
      }
    }

    expect(broken).toEqual([]);
  });

  // A locale that drops {days} renders broken prose; one that invents a
  // placeholder throws. Compare what each locale actually reads.
  it.each(locales.filter((l) => l !== defaultLocale))(
    '%s reads exactly the same ICU variables as %s',
    (locale) => {
      const reference = usedVariables(load(defaultLocale));
      const current = usedVariables(load(locale));

      const mismatches: { key: string; reference: string[]; actual: string[] }[] = [];
      for (const [key, expected] of reference) {
        const actual = current.get(key) ?? [];
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          mismatches.push({ key, reference: expected, actual });
        }
      }

      expect(mismatches).toEqual([]);
    }
  );
});
