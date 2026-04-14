import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditAction, Role, TenantRole } from '@prisma/client';

@ApiTags('Audit')
@ApiBearerAuth('access-token')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, TenantRole.RESTAURANT_OWNER)
  @ApiQuery({ name: 'resource', required: false })
  @ApiQuery({ name: 'action', required: false, enum: AuditAction })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Get audit logs (scoped to current tenant)' })
  findAll(
    @CurrentTenant() tenantId: string,
    @CurrentUser('role') role: string,
    @Query('resource') resource?: string,
    @Query('action') action?: AuditAction,
    @Query('userId') userId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    // Super/Agency admin can query without tenant scope
    const scopedTenantId = ([Role.SUPER_ADMIN, Role.AGENCY_ADMIN] as Role[]).includes(role as Role)
      ? undefined
      : tenantId;

    return this.auditService.findAll({
      tenantId: scopedTenantId,
      userId,
      resource,
      action,
      page: +page,
      limit: +limit,
    });
  }
}
