import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-helpers';
import { ItemStatus, Locale, Plan } from '@prisma/client';

describe('Public Menu API (e2e)', () => {
  let app: INestApplication;
  const SLUG = `public-e2e-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);

    // Seed a tenant + full menu tree
    const tenant = await prisma.tenant.create({
      data: {
        slug: SLUG,
        name_en: 'Public E2E Restaurant',
        defaultLocale: Locale.EN,
        supportedLocales: [Locale.EN, Locale.ES],
        plan: Plan.FREE,
        isActive: true,
      },
    });

    const menu = await prisma.menu.create({
      data: {
        tenantId: tenant.id,
        name_en: 'Main Menu',
        name_es: 'Menú Principal',
        isActive: true,
        publishedAt: new Date(),
      },
    });

    const category = await prisma.category.create({
      data: {
        tenantId: tenant.id,
        menuId: menu.id,
        name_en: 'Burgers',
        name_es: 'Hamburguesas',
        isActive: true,
      },
    });

    await prisma.item.createMany({
      data: [
        {
          tenantId: tenant.id,
          categoryId: category.id,
          name_en: 'Classic Burger',
          name_es: 'Hamburguesa Clásica',
          price: 11.99,
          status: ItemStatus.PUBLISHED,
          publishedAt: new Date(),
          isFeatured: true,
        },
        {
          tenantId: tenant.id,
          categoryId: category.id,
          name_en: 'Draft Item',
          price: 5.00,
          status: ItemStatus.DRAFT, // should NOT appear in public API
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Restaurant info ──────────────────────────────────────────────────────

  describe('GET /public/:slug', () => {
    it('returns restaurant profile in EN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/public/${SLUG}?locale=en`)
        .expect(200);

      expect(res.body.data.slug).toBe(SLUG);
      expect(res.body.data.name).toBe('Public E2E Restaurant');
    });

    it('returns 404 for unknown slug', () =>
      request(app.getHttpServer())
        .get('/api/v1/public/does-not-exist-xyz')
        .expect(404));

    it('returns 404 for inactive restaurant', async () => {
      const { PrismaService } = await import('../src/prisma/prisma.service');
      const prisma = app.get(PrismaService);
      const inactiveSlug = `inactive-${Date.now()}`;
      await prisma.tenant.create({
        data: {
          slug: inactiveSlug,
          name_en: 'Inactive',
          isActive: false,
        },
      });

      return request(app.getHttpServer())
        .get(`/api/v1/public/${inactiveSlug}`)
        .expect(404);
    });
  });

  // ─── Menu tree ────────────────────────────────────────────────────────────

  describe('GET /public/:slug/menu', () => {
    it('returns full active menu tree in EN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/public/${SLUG}/menu?locale=en`)
        .expect(200);

      const menus = res.body.data;
      expect(Array.isArray(menus)).toBe(true);
      expect(menus.length).toBeGreaterThan(0);

      const menu = menus[0];
      expect(menu.name).toBe('Main Menu');
      expect(menu.categories[0].name).toBe('Burgers');

      const items = menu.categories[0].items;
      expect(items.length).toBe(1); // only PUBLISHED
      expect(items[0].name).toBe('Classic Burger');
      expect(typeof items[0].price).toBe('number');
      expect(items[0].price).toBe(11.99);
    });

    it('returns menu tree localized in ES', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/public/${SLUG}/menu?locale=es`)
        .expect(200);

      const menu = res.body.data[0];
      expect(menu.name).toBe('Menú Principal');
      expect(menu.categories[0].name).toBe('Hamburguesas');
      expect(menu.categories[0].items[0].name).toBe('Hamburguesa Clásica');
    });

    it('does not expose draft items', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/public/${SLUG}/menu`)
        .expect(200);

      const items = res.body.data[0].categories[0].items;
      const hasHidden = items.some((i: any) => i.name === 'Draft Item');
      expect(hasHidden).toBe(false);
    });

    it('does not require authentication', () =>
      request(app.getHttpServer())
        .get(`/api/v1/public/${SLUG}/menu`)
        .expect(200));
  });

  // ─── Search ───────────────────────────────────────────────────────────────

  describe('GET /public/:slug/search', () => {
    it('finds items by keyword', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/public/${SLUG}/search?q=burger`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name.toLowerCase()).toContain('burger');
    });

    it('returns empty array for no match', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/public/${SLUG}/search?q=doesnotexist12345`)
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });
  });
});
