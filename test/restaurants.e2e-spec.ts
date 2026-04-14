import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { createTestApp, loginAs, authed } from './test-helpers';

describe('Restaurants (e2e)', () => {
  let app: INestApplication;
  let superAdminToken: string;
  let ownerToken: string;
  let createdRestaurantId: string;

  const SLUG = `e2e-test-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);

    // Seed super admin
    await prisma.user.upsert({
      where: { email: 'sa-rest@test.com' },
      update: {},
      create: {
        email: 'sa-rest@test.com',
        password: await argon2.hash('Admin1234!'),
        firstName: 'SA',
        lastName: 'Rest',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });

    // Seed restaurant owner
    const owner = await prisma.user.upsert({
      where: { email: 'owner-rest@test.com' },
      update: {},
      create: {
        email: 'owner-rest@test.com',
        password: await argon2.hash('Owner1234!'),
        firstName: 'Owner',
        lastName: 'Rest',
        role: 'RESTAURANT_OWNER',
        isActive: true,
      },
    });

    const tokens = await Promise.all([
      loginAs(app, 'sa-rest@test.com', 'Admin1234!'),
      loginAs(app, 'owner-rest@test.com', 'Owner1234!'),
    ]);
    superAdminToken = tokens[0].accessToken;
    ownerToken = tokens[1].accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Create ──────────────────────────────────────────────────────────────

  describe('POST /restaurants', () => {
    it('Super admin can create a restaurant', async () => {
      const res = await authed(app, superAdminToken)
        .post('/api/v1/restaurants')
        .send({ name_en: 'E2E Restaurant', slug: SLUG })
        .expect(201);

      expect(res.body.data.slug).toBe(SLUG);
      createdRestaurantId = res.body.data.id;
    });

    it('Restaurant owner cannot create a restaurant', () =>
      authed(app, ownerToken)
        .post('/api/v1/restaurants')
        .send({ name_en: 'Should Fail', slug: `fail-${Date.now()}` })
        .expect(403));

    it('Duplicate slug returns 409', () =>
      authed(app, superAdminToken)
        .post('/api/v1/restaurants')
        .send({ name_en: 'Dupe', slug: SLUG })
        .expect(409));

    it('Auto-generates slug when omitted', async () => {
      const res = await authed(app, superAdminToken)
        .post('/api/v1/restaurants')
        .send({ name_en: 'Auto Slug Restaurant' })
        .expect(201);

      expect(res.body.data.slug).toMatch(/^auto-slug-restaurant/);
    });
  });

  // ─── Read ─────────────────────────────────────────────────────────────────

  describe('GET /restaurants', () => {
    it('Super admin can list all restaurants', async () => {
      const res = await authed(app, superAdminToken)
        .get('/api/v1/restaurants')
        .expect(200);

      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.meta).toBeDefined();
    });

    it('Owner cannot list all restaurants', () =>
      authed(app, ownerToken).get('/api/v1/restaurants').expect(403));
  });

  describe('GET /restaurants/mine', () => {
    it('Owner sees their own restaurants', async () => {
      const res = await authed(app, ownerToken)
        .get('/api/v1/restaurants/mine')
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── Update ───────────────────────────────────────────────────────────────

  describe('PATCH /restaurants/:id', () => {
    it('Super admin can update a restaurant', async () => {
      const res = await authed(app, superAdminToken)
        .patch(`/api/v1/restaurants/${createdRestaurantId}`)
        .send({ name_en: 'Updated Name', primaryColor: '#123456' })
        .expect(200);

      expect(res.body.data.name_en).toBe('Updated Name');
      expect(res.body.data.primaryColor).toBe('#123456');
    });

    it('Returns 400 on invalid hex color', () =>
      authed(app, superAdminToken)
        .patch(`/api/v1/restaurants/${createdRestaurantId}`)
        .send({ primaryColor: 'not-a-color' })
        .expect(400));
  });

  // ─── Activate / Deactivate ────────────────────────────────────────────────

  describe('PATCH /restaurants/:id/deactivate', () => {
    it('Super admin can deactivate', async () => {
      const res = await authed(app, superAdminToken)
        .patch(`/api/v1/restaurants/${createdRestaurantId}/deactivate`)
        .expect(200);

      expect(res.body.data.isActive).toBe(false);
    });
  });
});
