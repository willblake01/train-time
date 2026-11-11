// Server-only: device tokens let a linked device (like an LED strip) read one
// rider's trip status without a Firebase login. Only a hash of each token is
// stored, so a database leak can't be used to impersonate a device.
import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes, base64url: 43 characters */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const MAX_DEVICES_PER_USER = 5;
export const MAX_LABEL_LENGTH = 40;

export const newDeviceToken = () => randomBytes(32).toString('base64url');

export const isDeviceToken = (value: unknown): value is string =>
  typeof value === 'string' && TOKEN_PATTERN.test(value);

/** Stored key for a token; also used as the device's public ID */
export const hashDeviceToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const isDeviceId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

/** "Bearer abc" → "abc"; null when the header is missing or malformed */
export function bearerToken(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  const match = value?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

/** A tidy, length-limited label, or a default */
export function cleanLabel(raw: unknown): string {
  const label = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH) : '';
  return label || 'LED strip';
}
