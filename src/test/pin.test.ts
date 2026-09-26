import { describe, it, expect } from 'vitest';
import {
  PIN_LENGTH,
  isValidPinFormat,
  generatePinSalt,
  hashPin,
  buildPinSetup,
  verifyPin,
} from '../lib/security/pin';

describe('isValidPinFormat', () => {
  it('accepts exactly four ASCII digits', () => {
    expect(isValidPinFormat('1234')).toBe(true);
    expect(isValidPinFormat('0000')).toBe(true);
    expect(isValidPinFormat('9999')).toBe(true);
  });

  it('rejects anything that is not four ASCII digits', () => {
    expect(isValidPinFormat('')).toBe(false);
    expect(isValidPinFormat('1')).toBe(false);
    expect(isValidPinFormat('123')).toBe(false);
    expect(isValidPinFormat('12345')).toBe(false);
    expect(isValidPinFormat('12a4')).toBe(false);
    expect(isValidPinFormat('12 4')).toBe(false);
    expect(isValidPinFormat('१२३४')).toBe(false);
    expect(isValidPinFormat('１２３４')).toBe(false);
  });

  it('rejects control characters that survive a digit strip', () => {
    expect(isValidPinFormat('\n234')).toBe(false);
    expect(isValidPinFormat('123\n')).toBe(false);
  });
});

describe('generatePinSalt', () => {
  it('produces a 32-character hex salt (16 bytes)', () => {
    const salt = generatePinSalt();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is random per call, so identical PINs hash differently', () => {
    const salts = new Set(Array.from({ length: 50 }, () => generatePinSalt()));
    expect(salts.size).toBe(50);
  });
});

describe('hashPin', () => {
  it('is a 64-character hex SHA-256 digest', async () => {
    const digest = await hashPin('1234', 'a'.repeat(32));
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same salt and PIN', async () => {
    const salt = 'b'.repeat(32);
    expect(await hashPin('1234', salt)).toBe(await hashPin('1234', salt));
  });

  it('differs for a different salt with the same PIN', async () => {
    const a = await hashPin('1234', 'a'.repeat(32));
    const b = await hashPin('1234', 'b'.repeat(32));
    expect(a).not.toBe(b);
  });

  it('differs for a different PIN with the same salt', async () => {
    const salt = 'c'.repeat(32);
    expect(await hashPin('1234', salt)).not.toBe(await hashPin('1235', salt));
  });

  it('does not embed the raw PIN or the salt in the digest', async () => {
    const digest = await hashPin('1234', 'd'.repeat(32));
    expect(digest).not.toContain('1234');
    expect(digest).not.toContain('d'.repeat(32));
  });

  it('throws rather than hashing a malformed PIN', async () => {
    await expect(hashPin('123', 'e'.repeat(32))).rejects.toThrow();
    await expect(hashPin('12a4', 'e'.repeat(32))).rejects.toThrow();
  });
});

describe('buildPinSetup', () => {
  it('returns the fields needed to enable the lock', async () => {
    const setup = await buildPinSetup('1234');
    expect(setup.isPinEnabled).toBe(true);
    expect(setup.pinSalt).toMatch(/^[0-9a-f]{32}$/);
    expect(setup.pinHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never returns the raw PIN', async () => {
    const setup = await buildPinSetup('1234');
    expect(JSON.stringify(setup)).not.toContain('1234');
  });
});

describe('verifyPin', () => {
  it('accepts the correct PIN', async () => {
    const setup = await buildPinSetup('1234');
    expect(await verifyPin('1234', setup)).toBe(true);
  });

  it('rejects an incorrect PIN', async () => {
    const setup = await buildPinSetup('1234');
    expect(await verifyPin('1235', setup)).toBe(false);
    expect(await verifyPin('4321', setup)).toBe(false);
  });

  it('rejects a PIN whose salt matches a different PIN', async () => {
    const setup = await buildPinSetup('1111');
    expect(await verifyPin('2222', setup)).toBe(false);
  });

  it('rejects a malformed PIN instead of throwing', async () => {
    const setup = await buildPinSetup('1234');
    expect(await verifyPin('', setup)).toBe(false);
    expect(await verifyPin('123', setup)).toBe(false);
    expect(await verifyPin('12345', setup)).toBe(false);
    expect(await verifyPin('abcd', setup)).toBe(false);
  });

  it('returns null when the lock is disabled, never true', async () => {
    expect(
      await verifyPin('1234', { isPinEnabled: false, pinHash: undefined, pinSalt: undefined })
    ).toBeNull();
  });

  it('fails closed when enabled but the stored material is missing', async () => {
    expect(
      await verifyPin('1234', { isPinEnabled: true, pinHash: undefined, pinSalt: undefined })
    ).toBe(false);
    expect(
      await verifyPin('1234', { isPinEnabled: true, pinHash: 'a'.repeat(64), pinSalt: undefined })
    ).toBe(false);
    expect(
      await verifyPin('1234', { isPinEnabled: true, pinHash: undefined, pinSalt: 'a'.repeat(32) })
    ).toBe(false);
  });
});

describe('PIN contract', () => {
  it('uses the documented length consistently', async () => {
    expect(PIN_LENGTH).toBe(4);
    const padded = '0'.repeat(PIN_LENGTH);
    expect(isValidPinFormat(padded)).toBe(true);
  });
});
