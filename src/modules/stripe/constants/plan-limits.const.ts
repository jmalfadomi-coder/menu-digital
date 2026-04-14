import { Plan } from '@prisma/client';

export interface PlanLimits {
  maxMenus: number;
  maxItems: number;
  maxUsers: number;
}

/**
 * Hard resource limits enforced per plan tier.
 * Use Infinity to indicate no limit (ENTERPRISE).
 * Check these in service-layer create methods before inserting records.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [Plan.FREE]: {
    maxMenus: 1,
    maxItems: 20,
    maxUsers: 1,
  },
  [Plan.STARTER]: {
    maxMenus: 3,
    maxItems: 100,
    maxUsers: 3,
  },
  [Plan.PRO]: {
    maxMenus: 10,
    maxItems: 500,
    maxUsers: 10,
  },
  [Plan.ENTERPRISE]: {
    maxMenus: Infinity,
    maxItems: Infinity,
    maxUsers: Infinity,
  },
};

/** Ordered from lowest to highest tier. */
export const PLAN_ORDER: Plan[] = [
  Plan.FREE,
  Plan.STARTER,
  Plan.PRO,
  Plan.ENTERPRISE,
];

export function planRank(plan: Plan): number {
  return PLAN_ORDER.indexOf(plan);
}

/** Returns true if `current` is the same tier or higher than `required`. */
export function meetsMinimum(current: Plan, required: Plan): boolean {
  return planRank(current) >= planRank(required);
}
