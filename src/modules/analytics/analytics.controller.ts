import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Ip,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CreateAnalyticsEventDto } from './dto/create-event.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Role, TenantRole } from '@prisma/client';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** Public intake – called by the frontend menu UI */
  @Public()
  @Post('tenants/:tenantId/events')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Ingest an analytics event (public, no auth required)' })
  ingest(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateAnalyticsEventDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Headers('referer') referrer: string,
  ) {
    return this.analyticsService.ingest(tenantId, dto, ip, userAgent, referrer);
  }

  /** Admin summary endpoint */
  @Get('summary')
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER)
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Lookback window (default 7)' })
  @ApiOperation({ summary: 'Get analytics summary for current tenant' })
  summary(
    @CurrentTenant() tenantId: string,
    @Query('days') days = 7,
  ) {
    return this.analyticsService.getSummary(tenantId, +days);
  }
}
