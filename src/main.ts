import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    rawBody: true, // required for Stripe webhook signature verification
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port');
  const env = config.get<string>('app.env');

  // ─── CORS ─────────────────────────────────────────────────
  app.enableCors({
    origin: config.get<string[]>('app.corsOrigins'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
  });

  // ─── API Versioning ───────────────────────────────────────
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'api/v',
  });

  // ─── Global Prefix ────────────────────────────────────────
  // Note: versioning already handles /api/v1 prefix

  // ─── Validation ───────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Swagger ──────────────────────────────────────────────
  if (env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Menu Digital API')
      .setDescription(
        'Multi-tenant digital menu SaaS – admin & public API documentation',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addApiKey(
        { type: 'apiKey', name: 'x-tenant-id', in: 'header' },
        'tenant-id',
      )
      .addTag('Auth', 'Authentication & token management')
      .addTag('Users', 'User management')
      .addTag('Restaurants', 'Restaurant/tenant management')
      .addTag('Menus', 'Menu management')
      .addTag('Categories', 'Category management')
      .addTag('Items', 'Menu item management')
      .addTag('Media', 'Media upload & management')
      .addTag('Analytics', 'Analytics event intake')
      .addTag('Audit', 'Audit log access')
      .addTag('Public', 'Public read-only menu API')
      .addTag('Admin', 'Platform & tenant dashboard statistics')
      .addTag('Health', 'Service health check')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });

    logger.log(`Swagger docs available at http://localhost:${port}/docs`);
  }

  // ─── Shutdown hooks ───────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port ?? 3000);
  logger.log(`Application running on http://localhost:${port} [${env}]`);
}

bootstrap();
