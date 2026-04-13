import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_KEY = 'skipTenant';
/** Mark a route as not requiring a tenant context (e.g. super-admin global endpoints). */
export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);
