import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { Role, TenantRole } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Platform-wide statistics – Super/Agency Admin only.
   * Covers all tenants, users, content and analytics.
   */
  @Get('stats')
  @SkipTenant()
  @Roles(Role.SUPER_ADMIN, Role.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Platform-wide statistics (Super/Agency Admin)' })
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  /**
   * Per-tenant dashboard statistics.
   * Available to Restaurant Owner and Manager within the current tenant.
   */
  @Get('tenant-stats')
  @Roles(
    Role.SUPER_ADMIN,
    Role.AGENCY_ADMIN,
    TenantRole.RESTAURANT_OWNER,
    TenantRole.RESTAURANT_MANAGER,
  )
  @ApiOperation({ summary: 'Dashboard stats for the current tenant' })
  getTenantStats(@CurrentTenant() tenantId: string) {
    return this.adminService.getTenantStats(tenantId);
  }
}
