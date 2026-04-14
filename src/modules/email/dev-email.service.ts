import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IEmailService,
  SendPasswordResetOptions,
  SendWelcomeOptions,
} from './email.interface';

/**
 * Development / stub email service.
 *
 * Logs emails to stdout instead of sending them.  Replace with a real
 * implementation (SendGrid, Resend, AWS SES …) by providing a different class
 * for EMAIL_SERVICE in EmailModule.
 */
@Injectable()
export class DevEmailService implements IEmailService {
  private readonly logger = new Logger('Email');
  private readonly appUrl: string;

  constructor(private readonly config: ConfigService) {
    this.appUrl = this.config.get<string>('app.appUrl') ?? 'http://localhost:3000';
  }

  async sendPasswordReset(opts: SendPasswordResetOptions): Promise<void> {
    const link = `${this.appUrl}/auth/reset-password?token=${opts.resetToken}`;
    this.logger.log(
      `[PASSWORD RESET] to=${opts.to} name=${opts.firstName} ` +
        `expires_in=${opts.expiresInMinutes}m link=${link}`,
    );
  }

  async sendWelcome(opts: SendWelcomeOptions): Promise<void> {
    this.logger.log(`[WELCOME] to=${opts.to} name=${opts.firstName}`);
  }
}
