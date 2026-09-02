import { describe, it, expect } from 'vitest';
import { isValidLocale } from '../i18n/config';

describe('i18n Locale Validation', () => {
  it('validates supported locales correctly', () => {
    expect(isValidLocale('en')).toBe(true);
    expect(isValidLocale('hi')).toBe(true);
    expect(isValidLocale('kn')).toBe(true);
    expect(isValidLocale('fr')).toBe(false);
  });
});
