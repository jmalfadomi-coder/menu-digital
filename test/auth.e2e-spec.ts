import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, cleanDatabase, loginAs, authed } from './test-helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  const superAdminEmail = 'e2e-superadmin@menu.digital';
  const superAdminPassword = 'E2eAdmin1234!';
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Setup: create a super admin via Prisma directly ────────────────────
  beforeAll(async () => {
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);
    const argon2 = await import('argon2');

    await prisma.user.upsert({
      where: { email: superAdminEmail },
      update: {},
      create: {
        email: superAdminEmail,
        password: await argon2.hash(superAdminPassword),
        firstName: 'E2E',
        lastName: 'SuperAdmin',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
  });

  // ─── Login ────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns 200 with tokens on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: superAdminEmail, password: superAdminPassword })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe(superAdminEmail);

      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('returns 401 on wrong password', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: superAdminEmail, password: 'wrongpassword' })
        .expect(401));

    it('returns 401 on unknown email', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@nowhere.com', password: 'whatever' })
        .expect(401));

    it('returns 400 when email is missing', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ password: superAdminPassword })
        .expect(400));
  });

  // ─── Protected route ──────────────────────────────────────────────────────

  describe('GET /users/me', () => {
    it('returns current user when authenticated', async () => {
      const res = await authed(app, accessToken)
        .get('/api/v1/users/me')
        .expect(200);

      expect(res.body.data.email).toBe(superAdminEmail);
    });

    it('returns 401 without a token', () =>
      request(app.getHttpServer()).get('/api/v1/users/me').expect(401));

    it('returns 401 with a malformed token', () =>
      request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer not.a.real.token')
        .expect(401));
  });

  // ─── Refresh ──────────────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('returns a new access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.accessToken).not.toBe(accessToken);
    });
  });

  // ─── Logout ───────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('returns 200 and revokes the session', async () => {
      const res = await authed(app, accessToken)
        .post('/api/v1/auth/logout')
        .expect(200);

      expect(res.body.data.message).toBe('Logged out successfully');
    });
  });

  // ─── Forgot / Reset password ──────────────────────────────────────────────

  describe('POST /auth/forgot-password', () => {
    it('always returns 200 regardless of email existence', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'does-not-exist@example.com' })
        .expect(200));
  });
});
