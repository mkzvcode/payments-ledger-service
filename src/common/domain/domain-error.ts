export type ErrorCode =
  | 'INVALID_MONEY'
  | 'CURRENCY_MISMATCH'
  | 'SELF_TRANSFER'
  | 'ACCOUNT_INACTIVE'
  | 'INSUFFICIENT_FUNDS'
  | 'BALANCE_OVERFLOW'
  | 'ACCOUNT_NOT_FOUND'
  | 'TRANSFER_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INVALID_CURSOR';

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
