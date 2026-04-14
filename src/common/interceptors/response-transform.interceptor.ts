import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

/**
 * Replaces Prisma Decimal instances with plain JS numbers and strips
 * BigInt values before the response is JSON-serialised by Express.
 */
function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  // Prisma Decimal – duck-typed by checking for `.toFixed` and `._isBigDecimal`
  if (
    typeof value === 'object' &&
    value !== null &&
    'toFixed' in value &&
    'toDecimalPlaces' in value
  ) {
    return parseFloat((value as any).toString());
  }

  if (typeof value === 'bigint') return Number(value);

  if (Array.isArray(value)) return value.map(sanitize);

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitize(v);
    }
    return out;
  }

  return value;
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: sanitize(data) as T,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
