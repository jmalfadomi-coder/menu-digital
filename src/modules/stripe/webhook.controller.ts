import {
  Controller,
  Post,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { Plan } from '@prisma/client';
import StripeLib from 'stripe';
import type { Event as StripeEvent } from 'stripe/cjs/resources/Events';
import type { Subscription as StripeSubscription } from 'stripe/cjs/resources/Subscriptions';
import type { Session as CheckoutSession } from 'stripe/cjs/resources/Checkout/Sessions';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';

@ApiTags('Stripe')
@Public()
@SkipTenant()
@Controller('stripe')
export class WebhookController {
  private readonly stripe: InstanceType<typeof StripeLib>;
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripe = new StripeLib(
      this.config.get<string>('stripe.secretKey') ?? '',
      { apiVersion: '2026-03-25.dahlia' as const },
    );
  }

  // ─── Webhook ──────────────────────────────────────────────────────────────

  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = this.config.get<string>('stripe.webhookSecret');

    if (!signature || !webhookSecret) {
      throw new BadRequestException('Missing Stripe signature or webhook secret');
    }

    let event: StripeEvent;
    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody as Buffer,
        signature,
        webhookSecret,
      ) as StripeEvent;
    } catch (err) {
      this.logger.warn(
        `Webhook signature verification failed: ${(err as Error).message}`,
      );
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    this.logger.log(`Stripe event received: ${event.type} [${event.id}]`);

    await this.dispatch(event);
    return { received: true };
  }

  // ─── Event Dispatch ───────────────────────────────────────────────────────

  private async dispatch(event: StripeEvent): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as CheckoutSession);
        break;

      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as StripeSubscription);
        break;

      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as StripeSubscription);
        break;

      default:
        this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  // ─── Handlers ────────────────────────────────────────────────────────────

  /**
   * checkout.session.completed — first payment succeeded.
   * Persist the subscriptionId so the tenant can be managed later.
   */
  private async onCheckoutCompleted(session: CheckoutSession): Promise<void> {
    const tenantId = session.metadata?.tenantId;
    if (!tenantId) {
      this.logger.warn('checkout.session.completed: missing tenantId in metadata');
      return;
    }

    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;

    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as any)?.id ?? null;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        stripeCustomerId: customerId ?? undefined,
        stripeSubscriptionId: subscriptionId ?? undefined,
      },
    });

    this.logger.log(
      `Tenant ${tenantId} checkout completed — customer=${customerId} sub=${subscriptionId}`,
    );
  }

  /**
   * customer.subscription.updated — covers initial activation, upgrades,
   * downgrades, and paused/unpaid transitions.
   */
  private async onSubscriptionUpdated(sub: StripeSubscription): Promise<void> {
    const customerId =
      typeof sub.customer === 'string' ? sub.customer : (sub.customer as any).id;

    const priceId = sub.items?.data[0]?.price?.id;
    const plan = priceId ? this.priceIdToPlan(priceId) : null;

    if (!plan) {
      this.logger.warn(
        `customer.subscription.updated: unknown price "${priceId}" — skipping`,
      );
      return;
    }

    const isActive = ['active', 'trialing'].includes(sub.status);
    const effectivePlan = isActive ? plan : Plan.FREE;

    await this.prisma.tenant.update({
      where: { stripeCustomerId: customerId },
      data: { plan: effectivePlan, stripeSubscriptionId: sub.id },
    });

    this.logger.log(
      `Tenant (customer=${customerId}) → plan=${effectivePlan} [status=${sub.status}]`,
    );
  }

  /**
   * customer.subscription.deleted — subscription cancelled or expired.
   * Downgrade tenant back to FREE.
   */
  private async onSubscriptionDeleted(sub: StripeSubscription): Promise<void> {
    const customerId =
      typeof sub.customer === 'string' ? sub.customer : (sub.customer as any).id;

    await this.prisma.tenant.update({
      where: { stripeCustomerId: customerId },
      data: { plan: Plan.FREE, stripeSubscriptionId: null },
    });

    this.logger.log(
      `Tenant (customer=${customerId}) subscription cancelled — downgraded to FREE`,
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Map a Stripe price ID → our Plan enum, using configured price IDs. */
  private priceIdToPlan(priceId: string): Plan | null {
    const prices = this.config.get<Record<string, string>>('stripe.prices') ?? {};

    for (const [planKey, id] of Object.entries(prices)) {
      if (id && id === priceId && planKey in Plan) {
        return Plan[planKey as keyof typeof Plan];
      }
    }
    return null;
  }
}
