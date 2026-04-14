import { SetMetadata } from '@nestjs/common';
import { Plan } from '@prisma/client';

export const REQUIRES_PLAN_KEY = 'requiresPlan';

/**
 * Requires the current tenant to be on the given plan tier or higher.
 * Apply to a controller method or class; enforced by PlanGuard.
 *
 * @example
 * @RequiresPlan(Plan.PRO)
 * @Post('advanced-feature')
 */
export const RequiresPlan = (plan: Plan) =>
  SetMetadata(REQUIRES_PLAN_KEY, plan);
