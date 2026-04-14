import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Plan } from '@prisma/client';
import StripeLib from 'stripe';

@Injectable()
export class CheckoutService {
  private readonly stripe: InstanceType<typeof StripeLib>;
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripe = new StripeLib(
      this.config.get<string>('stripe.secretKey') ?? '',
      { apiVersion: '2026-03-25.dahlia' as const },
    );
  }

  /**
   * Create a Stripe Checkout session for the given plan.
   * If the tenant already has a Stripe customer, it is reused; otherwise a
   * new customer is created and stored.
   *
   * Returns the one-time Checkout URL to redirect the user to.
   */
  async createSession(
    tenantId: string,
    plan: Exclude<Plan, 'FREE'>,
    userId: string,
  ): Promise<{ url: string }> {
    const priceId = this.config.get<string>(`stripe.prices.${plan}`);
    if (!priceId) {
      throw new BadRequestException(
        `No Stripe price configured for plan "${plan}". ` +
          `Set STRIPE_PRICE_${plan} in your environment.`,
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name_en: true,
        email: true,
        stripeCustomerId: true,
        plan: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Reuse or create Stripe customer
    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        name: tenant.name_en,
        email: tenant.email ?? undefined,
        metadata: { tenantId },
      });
      customerId = customer.id;

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: this.config.get<string>('stripe.successUrl') ?? '',
      cancel_url: this.config.get<string>('stripe.cancelUrl') ?? '',
      metadata: { tenantId, userId, plan },
      subscription_data: { metadata: { tenantId, plan } },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }

    this.logger.log(
      `Checkout session created for tenant=${tenantId} plan=${plan} session=${session.id}`,
    );

    return { url: session.url };
  }

  /**
   * Create a Stripe Billing Portal session so the tenant can manage their
   * existing subscription (upgrade, downgrade, cancel, view invoices).
   */
  async createPortalSession(tenantId: string): Promise<{ url: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeCustomerId: true },
    });

    if (!tenant?.stripeCustomerId) {
      throw new BadRequestException(
        'No active subscription found for this tenant',
      );
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: this.config.get<string>('stripe.successUrl') ?? '',
    });

    return { url: session.url };
  }
}
