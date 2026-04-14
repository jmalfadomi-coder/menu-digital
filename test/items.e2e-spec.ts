import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { createTestApp, loginAs, authed } from './test-helpers';
import { ItemStatus, Locale, Plan, TenantRole } from '@prisma/client';

describe('Items (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let tenantId: string;
  let categoryId: string;
  let createdItemId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);

    // Seed tenant, owner, menu, category
    const tenant = await prisma.tenant.create({
      data: {
        slug: `items-e2e-${Date.now()}`,
        name_en: 'Items E2E Restaurant',
        isActive: true,
        plan: Plan.FREE,
      },
    });
    tenantId = tenant.id;

    const owner = await prisma.user.upsert({
      where: { email: 'items-owner@e2e.com' },
      update: {},
      create: {
        email: 'items-owner@e2e.com',
        password: await argon2.hash('Owner1234!'),
        firstName: 'Item',
        lastName: 'Owner',
        role: 'RESTAURANT_OWNER',
        isActive: true,
      },
    });

    await prisma.userTenant.upsert({
      where: { userId_tenantId: { userId: owner.id, tenantId } },
      update: {},
      create: { userId: owner.id, tenantId, role: TenantRole.RESTAURANT_OWNER },
    });

    const menu = await prisma.menu.create({
      data: { tenantId, name_en: 'Test Menu', isActive: true },
    });

    const category = await prisma.category.create({
      data: { tenantId, menuId: menu.id, name_en: 'Test Category', isActive: true },
    });
    categoryId = category.id;

    const tokens = await loginAs(app, 'items-owner@e2e.com', 'Owner1234!', tenantId);
    ownerToken = tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const headers = () => ({ 'x-tenant-id': tenantId });

  describe('POST /items', () => {
    it('creates an item', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          categoryId,
          name_en: 'Test Burger',
          name_es: 'Hamburguesa de Prueba',
          description_en: 'A test burger',
          price: 13.99,
          allergens: ['gluten', 'dairy'],
          badges: ['new'],
          spicyLevel: 1,
          status: ItemStatus.DRAFT,
        })
        .expect(201);

      expect(res.body.data.name_en).toBe('Test Burger');
      expect(res.body.data.price).toBe(13.99); // Decimal serialized as number
      expect(res.body.data.allergens).toEqual(['gluten', 'dairy']);
      createdItemId = res.body.data.id;
    });

    it('rejects price ≤ 0', () =>
      request(app.getHttpServer())
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .send({ categoryId, name_en: 'Free Item', price: -1 })
        .expect(400));

    it('rejects spicyLevel > 5', () =>
      request(app.getHttpServer())
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .send({ categoryId, name_en: 'Too Spicy', price: 5, spicyLevel: 6 })
        .expect(400));
  });

  describe('PATCH /items/:id/publish', () => {
    it('publishes a draft item', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/items/${createdItemId}/publish`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.body.data.status).toBe(ItemStatus.PUBLISHED);
      expect(res.body.data.publishedAt).toBeDefined();
    });
  });

  describe('PATCH /items/:id/sold-out', () => {
    it('marks item as sold out', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/items/${createdItemId}/sold-out`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.body.data.isSoldOut).toBe(true);
    });
  });

  describe('PATCH /items/:id/available', () => {
    it('marks item as available', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/items/${createdItemId}/available`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.body.data.isSoldOut).toBe(false);
    });
  });

  describe('GET /items tenant isolation', () => {
    it('cannot read items from another tenant', async () => {
      const { PrismaService } = await import('../src/prisma/prisma.service');
      const prisma = app.get(PrismaService);
      const other = await prisma.tenant.create({
        data: { slug: `other-${Date.now()}`, name_en: 'Other', isActive: true },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', other.id) // wrong tenant in header
        .expect(403); // TenantGuard or RolesGuard blocks access
    });
  });

  describe('DELETE /items/:id', () => {
    it('deletes the item', () =>
      request(app.getHttpServer())
        .delete(`/api/v1/items/${createdItemId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200));

    it('returns 404 after deletion', () =>
      request(app.getHttpServer())
        .get(`/api/v1/items/${createdItemId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404));
  });
});
