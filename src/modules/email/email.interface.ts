export interface SendPasswordResetOptions {
  to: string;
  firstName: string;
  resetToken: string;
  expiresInMinutes: number;
}

export interface SendWelcomeOptions {
  to: string;
  firstName: string;
}

/**
 * Abstraction over any email provider.  Swap implementations via the module
 * without touching callers.
 */
export interface IEmailService {
  sendPasswordReset(opts: SendPasswordResetOptions): Promise<void>;
  sendWelcome(opts: SendWelcomeOptions): Promise<void>;
}

export const EMAIL_SERVICE = Symbol('IEmailService');
