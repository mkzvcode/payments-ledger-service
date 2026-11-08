import { applyDecorators } from '@nestjs/common';
import { ApiResponse, ApiHeader } from '@nestjs/swagger';

export const accountExample = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: 'customer-alice',
  currency: 'RUB',
  balance: '100000',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  version: 1,
};
export const transferExample = {
  id: '33333333-3333-4333-8333-333333333333',
  kind: 'TRANSFER',
  fromAccountId: accountExample.id,
  toAccountId: '22222222-2222-4222-8222-222222222222',
  amount: '15000',
  currency: 'RUB',
  status: 'COMPLETED',
  failureCode: null,
  idempotencyKey: 'demo-transfer-1',
  createdAt: accountExample.createdAt,
};

export function ApiProblems(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ...[400, 404, 409, 422, 429, 500, 503].map((status) =>
      ApiResponse({
        status,
        description: 'RFC 7807 problem details',
        content: {
          'application/problem+json': {
            example: {
              type: 'urn:payments-ledger:problem:insufficient_funds',
              title: 'Conflict',
              status: 409,
              detail: 'The source account has insufficient funds',
              instance: '/api/v1/transfers',
              code: 'INSUFFICIENT_FUNDS',
              requestId: '44444444-4444-4444-8444-444444444444',
            },
          },
        },
      }),
    ),
  );
}

export function ApiIdempotency(): MethodDecorator {
  return ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    example: 'demo-transfer-1',
    description: 'Globally unique operation key; replay is permanent, another payload returns 422',
  });
}
