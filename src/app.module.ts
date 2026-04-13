import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import redisConfig from './config/redis.config';
import s3Config from './config/s3.config';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RestaurantsModule } from './modules/restaurants/restaurants.module';
import { MenusModule } from './modules/menus/menus.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ItemsModule } from './modules/items/items.module';
import { MediaModule } from './modules/media/media.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { PublicModule } from './modules/public/public.module';
import { HealthModule } from './modules/health/health.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

@Module({
  imports: [
    // ─── Config ───────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, redisConfig, s3Config],
      envFilePath: ['.env', '.env.local'],
    }),

    // ─── Rate Limiting ────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('app.rateLimitTtl') * 1000,
          limit: config.get<number>('app.rateLimitMax'),
        },
      ],
    }),

    // ─── Cache (Redis) ────────────────────────────────────────
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const { createKeyDB } = await import('cache-manager-ioredis-yet');
        return {
          store: await createKeyDB({
            host: config.get<string>('redis.host'),
            port: config.get<number>('redis.port'),
            password: config.get<string>('redis.password'),
            db: config.get<number>('redis.db'),
          }),
          ttl: config.get<number>('redis.ttl'),
        };
      },
    }),

    // ─── Database ─────────────────────────────────────────────
    PrismaModule,

    // ─── Feature Modules ──────────────────────────────────────
    AuthModule,
    UsersModule,
    RestaurantsModule,
    MenusModule,
    CategoriesModule,
    ItemsModule,
    MediaModule,
    AnalyticsModule,
    AuditModule,
    PublicModule,
    HealthModule,
  ],

  providers: [
    // Global guards (order matters)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TenantGuard },

    // Global filters
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },

    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
  ],
})
export class AppModule {}
