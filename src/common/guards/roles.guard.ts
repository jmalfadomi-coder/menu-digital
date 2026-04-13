import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, TenantRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<(Role | TenantRole)[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;
    if (!user) return false;

    // SUPER_ADMIN bypasses all role checks
    if (user.role === Role.SUPER_ADMIN) return true;
    // AGENCY_ADMIN bypasses tenant-level checks
    if (user.role === Role.AGENCY_ADMIN && !requiredRoles.includes(Role.SUPER_ADMIN)) {
      return true;
    }

    const hasSystemRole = requiredRoles.includes(user.role as Role);
    const hasTenantRole = user.tenantRole
      ? requiredRoles.includes(user.tenantRole as TenantRole)
      : false;

    if (!hasSystemRole && !hasTenantRole) {
      throw new ForbiddenException(
        `Requires one of roles: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}
