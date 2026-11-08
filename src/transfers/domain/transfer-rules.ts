import type { Account } from '../../accounts/domain/account';
import { DomainError } from '../../common/domain/domain-error';
import type { Money } from '../../common/domain/money';

export function planTransfer(from: Account, to: Account, money: Money): [Money, Money] {
  if (from.id === to.id) {
    throw new DomainError('SELF_TRANSFER', 'Source and destination accounts must differ');
  }
  assertActive(from);
  const toBalance = planDeposit(to, money);
  return [from.balance.subtract(money), toBalance];
}

export function planDeposit(to: Account, money: Money): Money {
  money.assertPositive();
  assertActive(to);
  return to.balance.add(money);
}

function assertActive(account: Account): void {
  if (account.status !== 'ACTIVE') {
    throw new DomainError('ACCOUNT_INACTIVE', 'Account must be active');
  }
}
