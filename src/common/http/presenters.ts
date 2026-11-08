import type { Account } from '../../accounts/domain/account';
import type { Transfer } from '../../transfers/domain/transfer';
import type { LedgerEntry } from '../../ledger/domain/ledger-entry';
import type { JsonObject } from '../application/ports';

export function accountResponse(account: Account): JsonObject {
  return {
    id: account.id,
    ownerId: account.ownerId,
    currency: account.balance.currency,
    balance: account.balance.amount.toString(),
    status: account.status,
    createdAt: account.createdAt.toISOString(),
    version: account.version,
  };
}

export function transferResponse(transfer: Transfer): JsonObject {
  return {
    id: transfer.id,
    kind: transfer.kind,
    fromAccountId: transfer.fromAccountId,
    toAccountId: transfer.toAccountId,
    amount: transfer.money.amount.toString(),
    currency: transfer.money.currency,
    status: transfer.status,
    failureCode: transfer.failureCode,
    idempotencyKey: transfer.idempotencyKey,
    createdAt: transfer.createdAt.toISOString(),
  };
}

export function entryResponse(entry: LedgerEntry): JsonObject {
  return {
    id: entry.id,
    transferId: entry.transferId,
    accountId: entry.accountId,
    externalAccount: entry.externalAccount,
    direction: entry.direction,
    amount: entry.money.amount.toString(),
    currency: entry.money.currency,
    createdAt: entry.createdAt.toISOString(),
  };
}
