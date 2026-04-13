import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_TENANT_KEY } from '../decorators/skip-tenant.decorator';
import { JwtPayload } from '../decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const skipTenant = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipTenant) return true;

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;
    if (!user) return true; // JWT guard already handled this

    // Super admin doesn't require tenant context
    if (user.role === Role.SUPER_ADMIN) return true;

    // Resolve tenantId from header, JWT payload, or route param
    const tenantId =
      request.headers['x-tenant-id'] ||
      user.tenantId ||
      request.params?.tenantId;

    if (!tenantId) {
      throw new BadRequestException(
        'Tenant context required. Provide x-tenant-id header.',
      );
    }

    request.tenantId = tenantId;
    return true;
  }
}
