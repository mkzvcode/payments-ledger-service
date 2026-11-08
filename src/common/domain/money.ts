import { isISO4217 } from 'validator';
import { DomainError } from './domain-error';

export const MAX_MONEY = 9223372036854775807n;

export class Money {
  private constructor(
    readonly amount: bigint,
    readonly currency: string,
  ) {}

  static of(amount: bigint, currency: string): Money {
    if (!/^[A-Z]{3}$/.test(currency) || !isISO4217(currency)) {
      throw new DomainError('INVALID_MONEY', 'Currency must be an uppercase ISO 4217 code');
    }
    if (amount < 0n || amount > MAX_MONEY) {
      throw new DomainError('INVALID_MONEY', 'Amount is outside the PostgreSQL bigint range');
    }
    return new Money(amount, currency);
  }

  static positive(value: string, currency: string): Money {
    if (!/^[1-9]\d{0,18}$/.test(value)) {
      throw new DomainError('INVALID_MONEY', 'Amount must be a positive integer string');
    }
    return Money.of(BigInt(value), currency);
  }

  add(other: Money): Money {
    this.assertCurrency(other);
    if (this.amount + other.amount > MAX_MONEY) {
      throw new DomainError('BALANCE_OVERFLOW', 'Resulting balance exceeds the bigint range');
    }
    return Money.of(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertCurrency(other);
    if (this.amount < other.amount) {
      throw new DomainError('INSUFFICIENT_FUNDS', 'The source account has insufficient funds');
    }
    return Money.of(this.amount - other.amount, this.currency);
  }

  assertPositive(): void {
    if (this.amount === 0n) {
      throw new DomainError('INVALID_MONEY', 'Amount must be greater than zero');
    }
  }

  private assertCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainError('CURRENCY_MISMATCH', 'Currencies must match');
    }
  }
}
