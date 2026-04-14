import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenBlacklistService } from './token-blacklist.service';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { v4 as uuid } from 'uuid';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuditAction } from '@prisma/client';
import { EMAIL_SERVICE, IEmailService } from '../email/email.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly blacklist: TokenBlacklistService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
  ) {}

  // ─── Login ────────────────────────────────────────────────

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        userTenants: {
          where: dto.tenantId ? { tenantId: dto.tenantId } : undefined,
          include: { tenant: { select: { id: true, slug: true, isActive: true } } },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await argon2.verify(user.password, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Resolve tenant context
    let tenantId: string | undefined;
    let tenantRole: string | undefined;
    if (dto.tenantId) {
      const ut = user.userTenants.find((ut) => ut.tenantId === dto.tenantId);
      if (!ut || !ut.tenant.isActive) {
        throw new UnauthorizedException('Access to this restaurant is not allowed');
      }
      tenantId = ut.tenantId;
      tenantRole = ut.role;
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      tenantId,
      tenantRole,
    );

    // Store hashed refresh token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await argon2.hash(tokens.refreshToken),
        lastLoginAt: new Date(),
      },
    });

    await this.audit(user.id, tenantId, AuditAction.LOGIN, ipAddress, userAgent);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.getAccessTokenExpirySeconds(),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  // ─── Refresh ──────────────────────────────────────────────

  async refreshTokens(userId: string, rawRefreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Access denied');
    }

    const tokenMatches = await argon2.verify(user.refreshTokenHash, rawRefreshToken);
    if (!tokenMatches) {
      // Refresh token reuse detected – revoke everything (rotation violation)
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshTokenHash: null },
      });
      throw new UnauthorizedException('Refresh token reuse detected. Please log in again.');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await argon2.hash(tokens.refreshToken) },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.getAccessTokenExpirySeconds(),
    };
  }

  // ─── Logout ───────────────────────────────────────────────

  async logout(
    userId: string,
    jti?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Blacklist current access token so it can't be reused before expiry
    if (jti) {
      const ttl = this.getAccessTokenExpirySeconds();
      await this.blacklist.revoke(jti, ttl);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    await this.audit(userId, undefined, AuditAction.LOGOUT, ipAddress, userAgent);
    return { message: 'Logged out successfully' };
  }

  // ─── Forgot Password ──────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() +
        this.config.get<number>('auth.resetPasswordExpiry') * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpires: expiresAt,
      },
    });

    await this.emailService.sendPasswordReset({
      to: user.email,
      firstName: user.firstName ?? 'User',
      resetToken: token,
      expiresInMinutes: this.config.get<number>('auth.resetPasswordExpiry') ?? 60,
    });

    return { message: 'If the email exists, a reset link has been sent' };
  }

  // ─── Reset Password ───────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: dto.token,
        resetPasswordExpires: { gte: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: await argon2.hash(dto.password),
        resetPasswordToken: null,
        resetPasswordExpires: null,
        refreshTokenHash: null, // Force re-login on all devices
      },
    });

    await this.audit(user.id, undefined, AuditAction.PASSWORD_RESET);

    return { message: 'Password reset successfully' };
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    tenantId?: string,
    tenantRole?: string,
  ) {
    const jti = uuid(); // unique token ID for blacklist support

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: userId, email, role, tenantId, tenantRole, jti },
        {
          secret: this.config.get<string>('auth.jwtSecret'),
          expiresIn: this.config.get<string>('auth.jwtExpiresIn'),
        },
      ),
      this.jwt.signAsync(
        { sub: userId },
        {
          secret: this.config.get<string>('auth.jwtRefreshSecret'),
          expiresIn: this.config.get<string>('auth.jwtRefreshExpiresIn'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  getAccessTokenExpirySeconds(): number {
    const raw = this.config.get<string>('auth.jwtExpiresIn');
    if (raw.endsWith('m')) return parseInt(raw) * 60;
    if (raw.endsWith('h')) return parseInt(raw) * 3600;
    if (raw.endsWith('d')) return parseInt(raw) * 86400;
    return 900; // 15 min default
  }

  private async audit(
    userId: string,
    tenantId?: string,
    action: AuditAction = AuditAction.LOGIN,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.prisma.auditLog
      .create({
        data: { userId, tenantId, action, resource: 'auth', ipAddress, userAgent },
      })
      .catch(() => {});
  }
}
