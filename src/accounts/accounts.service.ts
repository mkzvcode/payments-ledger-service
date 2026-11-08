import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNTS } from '../common/application/ports';
import type { AccountRepository } from '../common/application/ports';
import type { Account } from './domain/account';
import { Money } from '../common/domain/money';
import { DomainError } from '../common/domain/domain-error';

@Injectable()
export class AccountsService {
  constructor(@Inject(ACCOUNTS) private readonly accounts: AccountRepository) {}

  create(ownerId: string, currency: string): Promise<Account> {
    Money.of(0n, currency);
    return this.accounts.create(ownerId, currency);
  }

  async get(id: string): Promise<Account> {
    const account = await this.accounts.find(id);
    if (!account) throw new DomainError('ACCOUNT_NOT_FOUND', 'Account was not found');
    return account;
  }
}
