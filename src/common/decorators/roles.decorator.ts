import { SetMetadata } from '@nestjs/common';
import { Role, TenantRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (Role | TenantRole)[]) =>
  SetMetadata(ROLES_KEY, roles);
