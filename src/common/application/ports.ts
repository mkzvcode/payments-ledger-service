import type { Account } from '../../accounts/domain/account';
import type { Transfer } from '../../transfers/domain/transfer';
import type { LedgerEntry } from '../../ledger/domain/ledger-entry';
import type { ErrorCode } from '../domain/domain-error';

export type JsonObject = Record<string, unknown>;
export type OperationResult =
  { ok: true; body: JsonObject } | { ok: false; code: ErrorCode; detail: string };

export interface AccountRepository {
  create(ownerId: string, currency: string): Promise<Account>;
  find(id: string): Promise<Account | null>;
}

export interface TransferRepository {
  find(id: string): Promise<Transfer | null>;
}

export interface LedgerRepository {
  list(
    accountId: string,
    limit: number,
    before?: string,
  ): Promise<(LedgerEntry & { sequence: string })[]>;
}

export interface PaymentSession {
  claim(key: string, hash: string): Promise<OperationResult | null>;
  lockAccounts(ids: string[]): Promise<Account[]>;
  updateBalance(account: Account, amount: bigint): Promise<void>;
  insertTransfer(transfer: Transfer): Promise<void>;
  appendEntries(entries: LedgerEntry[]): Promise<void>;
  finish(key: string, result: OperationResult): Promise<void>;
}

export interface PaymentUnitOfWork {
  run<T>(work: (session: PaymentSession) => Promise<T>): Promise<T>;
}

export const ACCOUNTS = Symbol('AccountRepository');
export const TRANSFERS = Symbol('TransferRepository');
export const LEDGER = Symbol('LedgerRepository');
export const PAYMENTS = Symbol('PaymentUnitOfWork');
