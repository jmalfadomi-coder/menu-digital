import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Plan } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { REQUIRES_PLAN_KEY } from '../decorators/requires-plan.decorator';
import { meetsMinimum } from '../constants/plan-limits.const';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Skip if no plan requirement is declared
    const requiredPlan = this.reflector.getAllAndOverride<Plan>(
      REQUIRES_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPlan) return true;

    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined =
      request.user?.tenantId ?? request.headers['x-tenant-id'];

    if (!tenantId) {
      throw new ForbiddenException(
        'A tenant context is required to verify plan access',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    if (!meetsMinimum(tenant.plan, requiredPlan)) {
      throw new ForbiddenException(
        `Your current plan (${tenant.plan}) does not include this feature. ` +
          `Upgrade to ${requiredPlan} or higher.`,
      );
    }

    return true;
  }
}
