import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import type {
  PaymentUnitOfWork,
  PaymentSession,
  OperationResult,
} from '../common/application/ports';
import type { Account } from '../accounts/domain/account';
import type { Transfer } from '../transfers/domain/transfer';
import type { LedgerEntry } from '../ledger/domain/ledger-entry';
import { DomainError } from '../common/domain/domain-error';
import type { AccountRow } from './rows';
import { mapAccount } from './rows';

@Injectable()
export class PgPaymentUnitOfWork implements PaymentUnitOfWork {
  constructor(private readonly source: DataSource) {}

  run<T>(work: (session: PaymentSession) => Promise<T>): Promise<T> {
    return this.source.transaction('READ COMMITTED', (manager) =>
      work(new PgPaymentSession(manager)),
    );
  }
}

class PgPaymentSession implements PaymentSession {
  constructor(private readonly manager: EntityManager) {}

  async claim(key: string, hash: string): Promise<OperationResult | null> {
    // ON CONFLICT waits for a concurrent transaction; the next READ COMMITTED statement sees its result.
    const inserted = await this.manager.query<{ key: string }[]>(
      'INSERT INTO idempotency_requests(key, request_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING key',
      [key, hash],
    );
    if (inserted.length > 0) return null;
    const [existing] = await this.manager.query<
      { request_hash: string; result: OperationResult | null }[]
    >('SELECT request_hash, result FROM idempotency_requests WHERE key = $1', [key]);
    if (!existing || existing.request_hash !== hash) {
      throw new DomainError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency-Key was already used for another request',
      );
    }
    if (!existing.result) throw new Error('Committed idempotency reservation has no result');
    return existing.result;
  }

  async lockAccounts(ids: string[]): Promise<Account[]> {
    const rows = await this.manager.query<AccountRow[]>(
      'SELECT * FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
      [[...new Set(ids)].sort()],
    );
    return rows.map(mapAccount);
  }

  async updateBalance(account: Account, amount: bigint): Promise<void> {
    const updated = await this.manager.query<{ id: string }[]>(
      `WITH updated AS (
         UPDATE accounts SET balance = $1, version = version + 1
         WHERE id = $2 AND version = $3 RETURNING id
       ) SELECT id FROM updated`,
      [amount.toString(), account.id, account.version],
    );
    if (updated.length !== 1) {
      throw new DomainError('VERSION_CONFLICT', 'Account version changed concurrently');
    }
  }

  async insertTransfer(transfer: Transfer): Promise<void> {
    await this.manager.query(
      `INSERT INTO transfers(id, kind, from_account_id, to_account_id, amount, currency,
        status, idempotency_key, failure_code, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        transfer.id,
        transfer.kind,
        transfer.fromAccountId,
        transfer.toAccountId,
        transfer.money.amount.toString(),
        transfer.money.currency,
        transfer.status,
        transfer.idempotencyKey,
        transfer.failureCode,
        transfer.createdAt,
      ],
    );
  }

  async appendEntries(entries: LedgerEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.manager.query(
        `INSERT INTO ledger_entries(id, transfer_id, account_id, external_account, direction, amount, currency, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          entry.id,
          entry.transferId,
          entry.accountId,
          entry.externalAccount,
          entry.direction,
          entry.money.amount.toString(),
          entry.money.currency,
          entry.createdAt,
        ],
      );
    }
  }

  async finish(key: string, result: OperationResult): Promise<void> {
    await this.manager.query('UPDATE idempotency_requests SET result = $1::jsonb WHERE key = $2', [
      JSON.stringify(result),
      key,
    ]);
  }
}
