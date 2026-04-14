import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { WebhookController } from './webhook.controller';
import { PlanGuard } from './guards/plan.guard';

@Module({
  providers: [
    CheckoutService,
    // PlanGuard exported so it can be applied as a global guard in AppModule
    // or imported individually into feature modules
    PlanGuard,
  ],
  controllers: [CheckoutController, WebhookController],
  exports: [CheckoutService, PlanGuard],
})
export class StripeModule {}
