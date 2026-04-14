import { Global, Module } from '@nestjs/common';
import { CacheInvalidationService } from './cache-invalidation.service';

/**
 * Global module so CacheInvalidationService can be injected anywhere without
 * re-importing.  Requires CacheModule (CACHE_MANAGER) to be registered in the
 * root AppModule.
 */
@Global()
@Module({
  providers: [CacheInvalidationService],
  exports: [CacheInvalidationService],
})
export class CacheInvalidationModule {}
