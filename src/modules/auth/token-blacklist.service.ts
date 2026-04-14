import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * Maintains a Redis-backed blacklist of invalidated JWT access tokens.
 * Used after logout so stolen tokens can't be replayed within their TTL window.
 *
 * Key format:  blacklist:jti:<tokenId>
 * Value:       '1'  (presence = revoked)
 * TTL:         matches the JWT access-token expiry
 */
@Injectable()
export class TokenBlacklistService {
  private readonly PREFIX = 'blacklist:jti:';

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    await this.cache.set(
      `${this.PREFIX}${jti}`,
      '1',
      ttlSeconds * 1000, // cache-manager v5 uses ms
    );
  }

  async isRevoked(jti: string): Promise<boolean> {
    const val = await this.cache.get<string>(`${this.PREFIX}${jti}`);
    return val === '1';
  }
}
