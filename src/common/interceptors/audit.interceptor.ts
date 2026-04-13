import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
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

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, tenantId, headers, ip } = request;

    const action = METHOD_ACTION_MAP[method];
    if (!action || !user) return next.handle();

    const resource = this.extractResource(url);

    return next.handle().pipe(
      tap(() => {
        this.auditService
          .log({
            userId: user.sub,
            tenantId: tenantId || user.tenantId,
            action,
            resource,
            ipAddress: ip,
            userAgent: headers['user-agent'],
          })
          .catch(() => {}); // fire-and-forget, never block the request
      }),
    );
  }

  private extractResource(url: string): string {
    // /api/v1/menus/123 → menus
    const parts = url.split('/').filter(Boolean);
    const vIdx = parts.findIndex((p) => p.startsWith('v'));
    return parts[vIdx + 1] || 'unknown';
  }
}
