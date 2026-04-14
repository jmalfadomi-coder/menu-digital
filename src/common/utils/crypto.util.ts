import { createHash, randomBytes, timingSafeEqual as cryptoTimingSafeEqual } from 'crypto';

/** Generates a cryptographically random hex string of `byteLength` bytes */
export function randomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex');
}

/** SHA-256 hash of a string (useful for idempotency keys, cache keys, etc.) */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both strings must be the same byte length; pads shorter one to match.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a.padEnd(Math.max(a.length, b.length), '\0'));
  const bufB = Buffer.from(b.padEnd(Math.max(a.length, b.length), '\0'));
  return cryptoTimingSafeEqual(bufA, bufB) && a.length === b.length;
}
