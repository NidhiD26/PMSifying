/**
 * Local PIN lock for the personal health system.
 *
 * SCOPE AND HONESTY NOTE
 * ----------------------
 * This is a *local privacy lock*, not authentication. It exists to keep the
 * health records on a shared or borrowed device from being casually readable.
 *
 * It is deliberately NOT presented as strong security:
 *   - The PIN is never stored. Only a salted SHA-256 digest is kept, in the
 *     same local IndexedDB database as the data it protects.
 *   - Anyone with developer tools on the device can read that database.
 *   - There is no recovery path. A forgotten PIN means the local records
 *     cannot be unlocked.
 *
 * Realistic threat model: a family member or passer-by picking up an unlocked
 * phone. It does not defend against a compromised device or a forensic reader.
 */

import type { UserPreferencesRecord } from '@/types/db';

export const PIN_LENGTH = 4;

const PIN_PATTERN = /^[0-9]{4}$/;

function getCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function' || !c.subtle) {
    throw new Error('Web Crypto is unavailable in this context.');
  }
  return c;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** A PIN is valid when it is exactly 4 ASCII digits. */
export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

/** Cryptographically random 16-byte salt, hex encoded. */
export function generatePinSalt(): string {
  const bytes = new Uint8Array(16);
  getCrypto().getRandomValues(bytes);
  return bytesToHex(bytes);
}

/** SHA-256(salt + ':' + pin), hex encoded. Deterministic for a given salt. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  if (!isValidPinFormat(pin)) {
    throw new Error('PIN must be exactly 4 digits.');
  }
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await getCrypto().subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

export interface PinSetupResult {
  isPinEnabled: true;
  pinHash: string;
  pinSalt: string;
}

/** Produces the preference fields needed to enable the lock. */
export async function buildPinSetup(pin: string): Promise<PinSetupResult> {
  const salt = generatePinSalt();
  const pinHash = await hashPin(pin, salt);
  return { isPinEnabled: true, pinHash, pinSalt: salt };
}

/**
 * Verifies a candidate PIN against stored preferences.
 *
 * Returns `null` rather than throwing when the lock is disabled, so callers
 * cannot accidentally treat "no lock configured" as "correct PIN".
 */
export async function verifyPin(
  pin: string,
  preferences: Pick<UserPreferencesRecord, 'isPinEnabled' | 'pinHash' | 'pinSalt'>
): Promise<boolean | null> {
  if (!preferences.isPinEnabled) return null;
  if (!preferences.pinHash || !preferences.pinSalt) return false;
  if (!isValidPinFormat(pin)) return false;

  const candidate = await hashPin(pin, preferences.pinSalt);
  return constantTimeEquals(candidate, preferences.pinHash);
}
