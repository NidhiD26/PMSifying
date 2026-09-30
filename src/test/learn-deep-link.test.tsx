import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { LearnView } from '@/features/learn/learn-view';

/**
 * The assistant cites articles, and a citation the reader cannot follow is a
 * claim they have to take on trust. These tests cover the link between the two
 * screens: an article id in the URL has to open that article, and a reader who
 * comes back out has to end up in a URL that no longer names one.
 */

const en = JSON.parse(readFileSync('public/locales/en.json', 'utf8')) as Record<string, unknown>;

/**
 * Reads a string out of the locale file by path.
 *
 * Typed as `unknown` on purpose so a rename surfaces here as `MISSING:`, which
 * is what a reader would otherwise see, rather than as a passing assertion
 * against `undefined`.
 */
const msg = (path: string): string => {
  let value: unknown = en;
  for (const part of path.split('.')) {
    if (value && typeof value === 'object' && part in (value as object)) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return `MISSING:${path}`;
    }
  }
  return typeof value === 'string' ? value : `MISSING:${path}`;
};

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const table = en[namespace] as Record<string, unknown> | undefined;
    return (key: string, params?: Record<string, unknown>): string => {
      let value: unknown = table;
      for (const part of key.split('.')) {
        if (value && typeof value === 'object' && part in (value as object)) {
          value = (value as Record<string, unknown>)[part];
        } else {
          return `MISSING:${namespace}.${key}`;
        }
      }
      if (typeof value !== 'string') return `MISSING:${namespace}.${key}`;
      return value.replace(/\{(\w+)[^}]*\}/g, (match, name: string) => {
        const replacement = params?.[name];
        return replacement === undefined ? match : String(replacement);
      });
    };
  },
  useLocale: () => 'en',
}));

const setSearch = (search: string) => {
  window.history.replaceState({}, '', `/en/learn${search}`);
};

beforeEach(() => setSearch(''));

afterEach(() => cleanup());

describe('the education library deep link', () => {
  it('opens the article named in the URL', () => {
    setSearch('?a=pcosOverview');
    render(<LearnView />);

    expect(
      screen.getByRole('heading', { name: msg('learn.articles.pcosOverview.title') })
    ).toBeInTheDocument();
  });

  it('ignores an unknown article id rather than opening nothing', () => {
    // A stale or hand-edited link must not leave the reader on a blank reader.
    setSearch('?a=noSuchArticle');
    render(<LearnView />);

    expect(screen.getByText(msg('learn.title'))).toBeInTheDocument();
  });

  it('keeps the article in the URL as the reader moves between articles', () => {
    setSearch('?a=pcosOverview');
    render(<LearnView />);

    const next = screen.getByRole('button', { name: new RegExp(msg('learn.nextArticle'), 'i') });
    fireEvent.click(next);

    expect(new URLSearchParams(window.location.search).get('a')).not.toBe('pcosOverview');
    expect(document.body.textContent).not.toContain('MISSING:');
  });

  it('drops the parameter when the reader goes back to the library', () => {
    // Otherwise a refresh after finishing an article reopens it.
    setSearch('?a=pcosOverview');
    render(<LearnView />);

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(msg('learn.backToLibrary'), 'i') })
    );

    expect(new URLSearchParams(window.location.search).has('a')).toBe(false);
  });

  it('reaches the same article from the list', () => {
    render(<LearnView />);

    fireEvent.click(screen.getByRole('button', { name: new RegExp('PCOS', 'i') }));

    expect(new URLSearchParams(window.location.search).get('a')).toBe('pcosOverview');
  });
});
