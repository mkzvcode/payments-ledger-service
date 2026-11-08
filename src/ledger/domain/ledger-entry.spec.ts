import { generateEntries } from './ledger-entry';
import type { Transfer } from '../../transfers/domain/transfer';
import { Money } from '../../common/domain/money';

const transfer: Transfer = {
  id: 'operation',
  kind: 'TRANSFER',
  fromAccountId: 'a',
  toAccountId: 'b',
  money: Money.of(9007199254740993n, 'USD'),
  status: 'COMPLETED',
  idempotencyKey: 'key',
  failureCode: null,
  createdAt: new Date(),
};

describe('double-entry journal', () => {
  it('generates matching debit and credit', () => {
    const entries = generateEntries(transfer, 'debit', 'credit');
    expect(
      entries.map((entry) => [entry.direction, entry.accountId, entry.externalAccount]),
    ).toEqual([
      ['DEBIT', 'a', null],
      ['CREDIT', 'b', null],
    ]);
    expect(
      entries.reduce(
        (net, entry) =>
          net + (entry.direction === 'CREDIT' ? entry.money.amount : -entry.money.amount),
        0n,
      ),
    ).toBe(0n);
    expect(
      entries.every((entry) => entry.money === transfer.money && entry.transferId === transfer.id),
    ).toBe(true);
  });

  it('uses an external funding counterparty for deposits', () => {
    expect(
      generateEntries({ ...transfer, kind: 'DEPOSIT', fromAccountId: null }, 'd', 'c')[0],
    ).toMatchObject({
      direction: 'DEBIT',
      accountId: null,
      externalAccount: 'external:funding',
    });
  });

  it.each(['FAILED', 'PENDING'] as const)('has no entries for %s', (status) => {
    expect(generateEntries({ ...transfer, status }, 'd', 'c')).toEqual([]);
  });
});
