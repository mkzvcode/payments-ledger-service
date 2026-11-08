import type { Transfer } from '../../transfers/domain/transfer';
import type { Money } from '../../common/domain/money';

export interface LedgerEntry {
  readonly id: string;
  readonly transferId: string;
  readonly accountId: string | null;
  readonly externalAccount: string | null;
  readonly direction: 'DEBIT' | 'CREDIT';
  readonly money: Money;
  readonly createdAt: Date;
}

export function generateEntries(
  transfer: Transfer,
  debitId: string,
  creditId: string,
): LedgerEntry[] {
  if (transfer.status !== 'COMPLETED') return [];
  const common = { transferId: transfer.id, money: transfer.money, createdAt: transfer.createdAt };
  return [
    {
      ...common,
      id: debitId,
      accountId: transfer.fromAccountId,
      externalAccount: transfer.kind === 'DEPOSIT' ? 'external:funding' : null,
      direction: 'DEBIT',
    },
    {
      ...common,
      id: creditId,
      accountId: transfer.toAccountId,
      externalAccount: null,
      direction: 'CREDIT',
    },
  ];
}
