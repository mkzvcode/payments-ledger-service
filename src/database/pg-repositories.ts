import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  AccountRepository,
  TransferRepository,
  LedgerRepository,
} from '../common/application/ports';
import type { Account } from '../accounts/domain/account';
import type { Transfer } from '../transfers/domain/transfer';
import type { LedgerEntry } from '../ledger/domain/ledger-entry';
import type { AccountRow, TransferRow, LedgerRow } from './rows';
import { mapAccount, mapTransfer, mapEntry } from './rows';

@Injectable()
export class PgAccountRepository implements AccountRepository {
  constructor(private readonly source: DataSource) {}

  async create(ownerId: string, currency: string): Promise<Account> {
    const [row] = await this.source.query<AccountRow[]>(
      'INSERT INTO accounts(id, owner_id, currency) VALUES ($1, $2, $3) RETURNING *',
      [randomUUID(), ownerId, currency],
    );
    if (!row) throw new Error('Account insert returned no row');
    return mapAccount(row);
  }

  async find(id: string): Promise<Account | null> {
    const [row] = await this.source.query<AccountRow[]>('SELECT * FROM accounts WHERE id = $1', [
      id,
    ]);
    return row ? mapAccount(row) : null;
  }
}

@Injectable()
export class PgTransferRepository implements TransferRepository {
  constructor(private readonly source: DataSource) {}

  async find(id: string): Promise<Transfer | null> {
    const [row] = await this.source.query<TransferRow[]>('SELECT * FROM transfers WHERE id = $1', [
      id,
    ]);
    return row ? mapTransfer(row) : null;
  }
}

@Injectable()
export class PgLedgerRepository implements LedgerRepository {
  constructor(private readonly source: DataSource) {}

  async list(
    accountId: string,
    limit: number,
    before?: string,
  ): Promise<(LedgerEntry & { sequence: string })[]> {
    const rows = await this.source.query<LedgerRow[]>(
      `SELECT * FROM ledger_entries WHERE account_id = $1
       AND ($2::bigint IS NULL OR sequence < $2::bigint) ORDER BY sequence DESC LIMIT $3`,
      [accountId, before ?? null, limit],
    );
    return rows.map(mapEntry);
  }
}
