import type { Account } from '../accounts/domain/account';
import type { Transfer } from '../transfers/domain/transfer';
import type { LedgerEntry } from '../ledger/domain/ledger-entry';
import { Money } from '../common/domain/money';

export interface AccountRow {
  id: string;
  owner_id: string;
  currency: string;
  balance: string;
  status: Account['status'];
  created_at: Date;
  version: number;
}

export interface TransferRow {
  id: string;
  kind: Transfer['kind'];
  from_account_id: string | null;
  to_account_id: string;
  amount: string;
  currency: string;
  status: Transfer['status'];
  idempotency_key: string;
  failure_code: Transfer['failureCode'];
  created_at: Date;
}

export interface LedgerRow {
  id: string;
  sequence: string;
  transfer_id: string;
  account_id: string | null;
  external_account: string | null;
  direction: LedgerEntry['direction'];
  amount: string;
  currency: string;
  created_at: Date;
}

export function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    ownerId: row.owner_id,
    balance: Money.of(BigInt(row.balance), row.currency),
    status: row.status,
    createdAt: row.created_at,
    version: row.version,
  };
}

export function mapTransfer(row: TransferRow): Transfer {
  return {
    id: row.id,
    kind: row.kind,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    money: Money.of(BigInt(row.amount), row.currency),
    status: row.status,
    idempotencyKey: row.idempotency_key,
    failureCode: row.failure_code,
    createdAt: row.created_at,
  };
}

export function mapEntry(row: LedgerRow): LedgerEntry & { sequence: string } {
  return {
    id: row.id,
    sequence: row.sequence,
    transferId: row.transfer_id,
    accountId: row.account_id,
    externalAccount: row.external_account,
    direction: row.direction,
    money: Money.of(BigInt(row.amount), row.currency),
    createdAt: row.created_at,
  };
}
