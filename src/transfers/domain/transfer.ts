import type { Money } from '../../common/domain/money';
import type { ErrorCode } from '../../common/domain/domain-error';

export interface Transfer {
  readonly id: string;
  readonly kind: 'TRANSFER' | 'DEPOSIT';
  readonly fromAccountId: string | null;
  readonly toAccountId: string;
  readonly money: Money;
  readonly status: 'PENDING' | 'COMPLETED' | 'FAILED';
  readonly idempotencyKey: string;
  readonly failureCode: ErrorCode | null;
  readonly createdAt: Date;
}
