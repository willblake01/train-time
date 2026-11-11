/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';
import { bearerToken, cleanLabel, hashDeviceToken, isDeviceId, isDeviceToken, newDeviceToken } from '../deviceTokens';

describe('device tokens', () => {
  it('creates unique, well-formed tokens', () => {
    const a = newDeviceToken();
    expect(isDeviceToken(a)).toBe(true);
    expect(a).not.toBe(newDeviceToken());
  });

  it('rejects malformed tokens', () => {
    expect(isDeviceToken('short')).toBe(false);
    expect(isDeviceToken(`${'a'.repeat(42)}!`)).toBe(false);
    expect(isDeviceToken(undefined)).toBe(false);
  });

  it('hashes to a stable device id', () => {
    const token = newDeviceToken();
    expect(hashDeviceToken(token)).toBe(hashDeviceToken(token));
    expect(isDeviceId(hashDeviceToken(token))).toBe(true);
    expect(hashDeviceToken(token)).not.toContain(token);
  });

  it('reads bearer tokens', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('bearer abc')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });

  it('cleans labels', () => {
    expect(cleanLabel('  Living   room ')).toBe('Living room');
    expect(cleanLabel('')).toBe('LED strip');
    expect(cleanLabel(42)).toBe('LED strip');
    expect(cleanLabel('x'.repeat(100))).toHaveLength(40);
  });
});
