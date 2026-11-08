import type { Account } from '../../accounts/domain/account';
import { Money, MAX_MONEY } from '../../common/domain/money';
import { planTransfer, planDeposit } from './transfer-rules';

const account = (id: string, balance = 100n, currency = 'RUB'): Account => ({
  id,
  ownerId: id,
  balance: Money.of(balance, currency),
  status: 'ACTIVE',
  createdAt: new Date(),
  version: 0,
});

describe('transfer rules', () => {
  it('conserves money and does not mutate inputs', () => {
    const from = account('a');
    const to = account('b', 0n);
    const [debit, credit] = planTransfer(from, to, Money.of(30n, 'RUB'));
    expect([debit.amount, credit.amount]).toEqual([70n, 30n]);
    expect(debit.amount + credit.amount).toBe(from.balance.amount + to.balance.amount);
    expect(from.balance.amount).toBe(100n);
  });

  it('can transfer the full balance', () => {
    expect(planTransfer(account('a'), account('b'), Money.of(100n, 'RUB'))[0].amount).toBe(0n);
  });

  it('rejects self transfers', () => {
    expect(() => planTransfer(account('a'), account('a'), Money.of(1n, 'RUB'))).toThrow(
      'must differ',
    );
  });

  it('rejects inactive source and destination', () => {
    const frozen: Account = { ...account('frozen'), status: 'FROZEN' };
    expect(() => planTransfer(frozen, account('b'), Money.of(1n, 'RUB'))).toThrow('active');
    expect(() => planTransfer(account('a'), frozen, Money.of(1n, 'RUB'))).toThrow('active');
    expect(() => planDeposit(frozen, Money.of(1n, 'RUB'))).toThrow('active');
  });

  it('checks insufficient funds, zero, currencies and destination overflow', () => {
    expect(() => planTransfer(account('a'), account('b'), Money.of(101n, 'RUB'))).toThrow(
      'insufficient',
    );
    expect(() => planTransfer(account('a'), account('b'), Money.of(0n, 'RUB'))).toThrow('greater');
    expect(() => planTransfer(account('a'), account('b', 0n, 'USD'), Money.of(1n, 'RUB'))).toThrow(
      'Currencies',
    );
    expect(() =>
      planTransfer(account('a', 100n, 'USD'), account('b'), Money.of(1n, 'RUB')),
    ).toThrow('Currencies');
    expect(() => planDeposit(account('a', MAX_MONEY), Money.of(1n, 'RUB'))).toThrow('exceeds');
    expect(planDeposit(account('a'), Money.of(1n, 'RUB')).amount).toBe(101n);
  });
});
