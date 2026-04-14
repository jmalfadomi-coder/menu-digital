import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction } from '@prisma/client';

const METHOD_ACTION_MAP: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

// Resources to exclude from automatic audit (too noisy / handled manually)
const EXCLUDED_RESOURCES = new Set([
  'analytics',
  'health',
  'auth',  // auth events are logged manually with more context
  'public',
]);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    // @Optional allows the app to boot even if AuditService hasn't loaded yet
    @Optional() private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.auditService) return next.handle();

    const request = context.switchToHttp().getRequest();
    const { method, user, tenantId, headers, ip } = request;

    const action = METHOD_ACTION_MAP[method];
    if (!action || !user) return next.handle();

    const resource = this.extractResource(request.url);
    if (EXCLUDED_RESOURCES.has(resource)) return next.handle();

    return next.handle().pipe(
      tap((responseData) => {
        const resourceId =
          request.params?.id ||
          responseData?.data?.id ||
          responseData?.id ||
          undefined;

        this.auditService
          .log({
            userId: user.sub,
            tenantId: tenantId || user.tenantId,
            action,
            resource,
            resourceId,
            ipAddress: ip,
            userAgent: headers['user-agent'],
          })
          .catch(() => {}); // fire-and-forget
      }),
    );
  }

  private extractResource(url: string): string {
    // /api/v1/menus/123 → menus
    const parts = url.split('?')[0].split('/').filter(Boolean);
    const vIdx = parts.findIndex((p) => /^v\d+$/.test(p));
    return vIdx >= 0 ? parts[vIdx + 1] ?? 'unknown' : parts[1] ?? 'unknown';
  }
}
