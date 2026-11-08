import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNTS, LEDGER } from '../common/application/ports';
import type { AccountRepository, LedgerRepository, JsonObject } from '../common/application/ports';
import { DomainError } from '../common/domain/domain-error';
import { entryResponse } from '../common/http/presenters';

@Injectable()
export class LedgerService {
  constructor(
    @Inject(ACCOUNTS) private readonly accounts: AccountRepository,
    @Inject(LEDGER) private readonly ledger: LedgerRepository,
  ) {}

  async list(accountId: string, limit: number, cursor?: string): Promise<JsonObject> {
    const before = cursor ? this.decodeCursor(cursor, accountId) : undefined;
    if (!(await this.accounts.find(accountId)))
      throw new DomainError('ACCOUNT_NOT_FOUND', 'Account was not found');
    const rows = await this.ledger.list(accountId, limit + 1, before);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor =
      rows.length > limit && last
        ? Buffer.from(JSON.stringify([accountId, last.sequence])).toString('base64url')
        : null;
    return { items: page.map(entryResponse), nextCursor };
  }

  private decodeCursor(cursor: string, accountId: string): string {
    try {
      const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (
        !Array.isArray(parsed) ||
        parsed.length !== 2 ||
        parsed[0] !== accountId ||
        typeof parsed[1] !== 'string' ||
        !/^[1-9]\d{0,18}$/.test(parsed[1]) ||
        BigInt(parsed[1]) > 9223372036854775807n
      ) {
        throw new Error('Invalid cursor');
      }
      return parsed[1];
    } catch {
      throw new DomainError('INVALID_CURSOR', 'Cursor is invalid for this account');
    }
  }
}
