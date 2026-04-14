import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { Plan } from '@prisma/client';
import { CheckoutService } from './checkout.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';

class CreateCheckoutSessionDto {
  @IsEnum(Plan)
  plan: Exclude<Plan, 'FREE'>;
}

@ApiTags('Stripe')
@ApiBearerAuth('access-token')
@SkipTenant()
@Controller('stripe')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('checkout/sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create a Stripe Checkout session to upgrade plan',
    description:
      'Returns a one-time Stripe Checkout URL. Redirect the user to this URL to complete payment.',
  })
  createSession(
    @Body() dto: CreateCheckoutSessionDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.checkoutService.createSession(tenantId, dto.plan, user.sub);
  }

  @Get('portal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create a Stripe Billing Portal session',
    description:
      'Returns a URL to the Stripe Billing Portal where the tenant can manage invoices, payment methods, and cancel/upgrade their subscription.',
  })
  createPortalSession(@CurrentTenant() tenantId: string) {
    return this.checkoutService.createPortalSession(tenantId);
  }
}
