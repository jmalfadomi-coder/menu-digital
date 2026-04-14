import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { EMAIL_SERVICE } from '../email/email.interface';
import * as argon2 from 'argon2';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  password: 'hashed',
  firstName: 'Test',
  lastName: 'User',
  role: 'RESTAURANT_OWNER',
  isActive: true,
  refreshTokenHash: null,
  userTenants: [],
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('mock-token'),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, any> = {
      'auth.jwtSecret': 'test-secret-32-chars-long-minimum',
      'auth.jwtExpiresIn': '15m',
      'auth.jwtRefreshSecret': 'test-refresh-32-chars-long-minimum',
      'auth.jwtRefreshExpiresIn': '7d',
      'auth.resetPasswordExpiry': 60,
    };
    return map[key];
  }),
};

const mockBlacklist = {
  revoke: jest.fn().mockResolvedValue(undefined),
  isRevoked: jest.fn().mockResolvedValue(false),
};

const mockEmail = {
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
  sendWelcome: jest.fn().mockResolvedValue(undefined),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: TokenBlacklistService, useValue: mockBlacklist },
        { provide: EMAIL_SERVICE, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns tokens on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: await argon2.hash('correct-password'),
      });
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'test@example.com',
        password: 'correct-password',
      });

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('throws 401 when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@x.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 when user is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(
        service.login({ email: 'test@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 on wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: await argon2.hash('correct-password'),
      });
      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes jti and clears refresh token', async () => {
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.logout('user-1', 'jti-abc');

      expect(mockBlacklist.revoke).toHaveBeenCalledWith('jti-abc', expect.any(Number));
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { refreshTokenHash: null } }),
      );
      expect(result.message).toBe('Logged out successfully');
    });
  });

  // ─── refreshTokens ──────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    it('returns new tokens when refresh token matches', async () => {
      const rawToken = 'valid-refresh-token';
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        refreshTokenHash: await argon2.hash(rawToken),
      });
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.refreshTokens('user-1', rawToken);
      expect(result.accessToken).toBe('mock-token');
    });

    it('throws 401 and nukes session on token reuse', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        refreshTokenHash: await argon2.hash('real-token'),
      });

      await expect(
        service.refreshTokens('user-1', 'wrong-token'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { refreshTokenHash: null } }),
      );
    });
  });

  // ─── forgotPassword ─────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('always returns success message regardless of email existence', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await service.forgotPassword({ email: 'nobody@x.com' });
      expect(result.message).toContain('reset link');
    });

    it('stores reset token when user exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await service.forgotPassword({ email: 'test@example.com' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resetPasswordToken: expect.any(String),
            resetPasswordExpires: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ─── resetPassword ──────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('throws 400 on expired/invalid token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: 'bad-token', password: 'NewPass1234!' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password and clears token on success', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.resetPassword({
        token: 'valid-token',
        password: 'NewPass1234!',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resetPasswordToken: null,
            resetPasswordExpires: null,
            refreshTokenHash: null,
          }),
        }),
      );
      expect(result.message).toBe('Password reset successfully');
    });
  });
});
