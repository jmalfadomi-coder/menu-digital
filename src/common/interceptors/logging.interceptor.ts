import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        const userId = (req as any).user?.sub ?? '-';
        this.logger.log(
          `${method} ${originalUrl} ${res.statusCode} ${ms}ms – ${ip} – uid:${userId}`,
        );
      }),
      catchError((err) => {
        const ms = Date.now() - start;
        this.logger.error(
          `${method} ${originalUrl} ERR ${ms}ms – ${err?.status ?? 500} – ${err?.message}`,
        );
        return throwError(() => err);
      }),
    );
  }
}
