import type { Money } from '../../common/domain/money';

export interface Account {
  readonly id: string;
  readonly ownerId: string;
  readonly balance: Money;
  readonly status: 'ACTIVE' | 'FROZEN';
  readonly createdAt: Date;
  readonly version: number;
}
