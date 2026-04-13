import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET || 'super-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET || 'super-refresh-secret-change-in-production',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  resetPasswordExpiry: parseInt(process.env.RESET_PASSWORD_EXPIRY_MINUTES || '60', 10),
}));
