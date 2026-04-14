import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Bust Redis public-API cache entries when tenant content is mutated.
 *
 * Cache key formats (all prefixed `public:`):
 *   public:restaurant:<slug>:<locale>
 *   public:menu-tree:<slug>:<locale>
 *   public:item:<slug>:<itemId>:<locale>
 *   public:featured:<slug>:<locale>:<limit>
 */
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly prisma: PrismaService,
  ) {}

  /** Invalidate all public cache entries for a tenant (by internal ID). */
  async invalidateByTenantId(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    if (!tenant) return;
    await this.invalidateBySlug(tenant.slug);
  }

  /** Invalidate all public cache entries for a tenant slug. */
  async invalidateBySlug(slug: string): Promise<void> {
    const patterns = [
      `public:restaurant:${slug}:*`,
      `public:menu-tree:${slug}:*`,
      `public:item:${slug}:*`,
      `public:featured:${slug}:*`,
    ];

    await Promise.all(patterns.map((p) => this.deleteByPattern(p)));
  }

  /** Invalidate only the single-item cache entry for a specific item. */
  async invalidateItem(slug: string, itemId: string): Promise<void> {
    await this.deleteByPattern(`public:item:${slug}:${itemId}:*`);
    // Featured list may include this item
    await this.deleteByPattern(`public:featured:${slug}:*`);
    // Menu tree includes item inline
    await this.deleteByPattern(`public:menu-tree:${slug}:*`);
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async deleteByPattern(pattern: string): Promise<void> {
    const client: any = (this.cache as any)?.store?.client;
    if (!client) {
      this.logger.warn('Redis client unavailable; skipping cache invalidation');
      return;
    }

    const keys: string[] = [];
    let cursor = '0';

    try {
      do {
        const [nextCursor, found]: [string, string[]] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          '100',
        );
        cursor = nextCursor;
        keys.push(...found);
      } while (cursor !== '0');

      if (keys.length > 0) {
        await client.del(keys);
        this.logger.debug(`Invalidated ${keys.length} keys matching "${pattern}"`);
      }
    } catch (err) {
      // Non-fatal: log and continue. Stale cache is preferable to a crash.
      this.logger.error(`Failed to invalidate pattern "${pattern}": ${(err as Error).message}`);
    }
  }
}
