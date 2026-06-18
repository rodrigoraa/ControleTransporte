import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable, finalize, tap } from 'rxjs';

type HttpRequest = {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
};

type HttpResponse = {
  statusCode?: number;
  header?: (name: string, value: string) => void;
  setHeader?: (name: string, value: string) => void;
};

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const response = context.switchToHttp().getResponse<HttpResponse>();
    const startedAt = Date.now();
    const requestId = validRequestId(request.headers['x-request-id']) || randomUUID();
    let errorStatusCode: number | undefined;

    request.requestId = requestId;
    if (response.header) response.header('X-Request-Id', requestId);
    else response.setHeader?.('X-Request-Id', requestId);

    return next.handle().pipe(
      tap({
        error: (error) => {
          errorStatusCode = error instanceof HttpException ? error.getStatus() : 500;
        },
      }),
      finalize(() => {
        this.logger.log(
          JSON.stringify({
            requestId,
            method: request.method,
            path: request.url,
            statusCode: errorStatusCode || response.statusCode || 500,
            durationMs: Date.now() - startedAt,
          }),
        );
      }),
    );
  }
}

function validRequestId(value: string | string[] | undefined) {
  if (typeof value !== 'string') return null;
  return /^[A-Za-z0-9._:-]{1,64}$/.test(value) ? value : null;
}
