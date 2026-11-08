import { STATUS_CODES } from 'node:http';
import { Catch, HttpException, Inject } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { DomainError } from '../domain/domain-error';
import type { ErrorCode } from '../domain/domain-error';

const domainStatuses: Record<ErrorCode, number> = {
  INVALID_MONEY: 422,
  CURRENCY_MISMATCH: 422,
  SELF_TRANSFER: 422,
  ACCOUNT_INACTIVE: 409,
  INSUFFICIENT_FUNDS: 409,
  BALANCE_OVERFLOW: 422,
  ACCOUNT_NOT_FOUND: 404,
  TRANSFER_NOT_FOUND: 404,
  IDEMPOTENCY_CONFLICT: 422,
  VERSION_CONFLICT: 409,
  INVALID_CURSOR: 400,
};

@Catch()
export class ProblemFilter implements ExceptionFilter {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const req = context.getRequest<Request>();
    const res = context.getResponse<Response>();
    const problem = this.describe(exception);
    const requestId = req.header('x-request-id');
    if (problem.status >= 500) {
      this.logger.error(
        { code: problem.code, status: problem.status, requestId },
        'Request failed',
      );
    }
    if (problem.status === 503) res.setHeader('Retry-After', '1');
    res
      .status(problem.status)
      .type('application/problem+json')
      .json({
        type: `urn:payments-ledger:problem:${problem.code.toLowerCase()}`,
        title: STATUS_CODES[problem.status] ?? 'Error',
        ...problem,
        instance: req.path,
        requestId,
      });
  }

  private describe(exception: unknown): { status: number; code: string; detail: string } {
    if (exception instanceof DomainError) {
      return {
        status: domainStatuses[exception.code],
        code: exception.code,
        detail: exception.message,
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message: unknown =
        typeof body === 'object' && body && 'message' in body ? body.message : undefined;
      const detail =
        typeof message === 'string'
          ? message
          : Array.isArray(message)
            ? message.join('; ')
            : (STATUS_CODES[status] ?? 'Request failed');
      return {
        status,
        code: `HTTP_${status}`,
        detail: status >= 500 ? 'Service is unavailable' : detail,
      };
    }
    const driver =
      typeof exception === 'object' && exception && 'driverError' in exception
        ? exception.driverError
        : exception;
    const code = typeof driver === 'object' && driver && 'code' in driver ? driver.code : undefined;
    if (
      typeof code === 'string' &&
      ['55P03', '57014', '40001', '40P01', '53300', 'ECONNREFUSED', 'ECONNRESET'].includes(code)
    ) {
      return {
        status: 503,
        code: 'TEMPORARILY_UNAVAILABLE',
        detail: 'Retry the request with the same Idempotency-Key',
      };
    }
    return { status: 500, code: 'INTERNAL_ERROR', detail: 'An unexpected error occurred' };
  }
}
