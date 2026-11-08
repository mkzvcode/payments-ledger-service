import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PAYMENTS, TRANSFERS } from '../common/application/ports';
import type {
  PaymentUnitOfWork,
  PaymentSession,
  TransferRepository,
  JsonObject,
  OperationResult,
} from '../common/application/ports';
import { DomainError } from '../common/domain/domain-error';
import { Money } from '../common/domain/money';
import type { Account } from '../accounts/domain/account';
import type { Transfer } from './domain/transfer';
import { planTransfer, planDeposit } from './domain/transfer-rules';
import { generateEntries } from '../ledger/domain/ledger-entry';
import { transferResponse } from '../common/http/presenters';

export interface PaymentCommand {
  kind: Transfer['kind'];
  fromAccountId: string | null;
  toAccountId: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENTS) private readonly unitOfWork: PaymentUnitOfWork,
    @Inject(TRANSFERS) private readonly transfers: TransferRepository,
  ) {}

  async get(id: string): Promise<Transfer> {
    const transfer = await this.transfers.find(id);
    if (!transfer) throw new DomainError('TRANSFER_NOT_FOUND', 'Transfer was not found');
    return transfer;
  }

  async execute(command: PaymentCommand): Promise<JsonObject> {
    const money = Money.positive(command.amount, command.currency);
    const hash = createHash('sha256')
      .update(
        JSON.stringify([
          command.kind,
          command.fromAccountId,
          command.toAccountId,
          money.amount.toString(),
          money.currency,
        ]),
      )
      .digest('hex');
    const result = await this.unitOfWork.run(async (session) => {
      const replay = await session.claim(command.idempotencyKey, hash);
      if (replay) return replay;
      const outcome = await this.process(session, command, money);
      await session.finish(command.idempotencyKey, outcome);
      return outcome;
    });
    if (!result.ok) throw new DomainError(result.code, result.detail);
    return result.body;
  }

  private async process(
    session: PaymentSession,
    command: PaymentCommand,
    money: Money,
  ): Promise<OperationResult> {
    const ids = [command.toAccountId, ...(command.fromAccountId ? [command.fromAccountId] : [])];
    const accounts = await session.lockAccounts(ids);
    const to = accounts.find((account) => account.id === command.toAccountId);
    const from = accounts.find((account) => account.id === command.fromAccountId);
    if (!to || (command.kind === 'TRANSFER' && !from)) {
      return { ok: false, code: 'ACCOUNT_NOT_FOUND', detail: 'Account was not found' };
    }
    const transfer: Transfer = {
      id: randomUUID(),
      kind: command.kind,
      fromAccountId: command.fromAccountId,
      toAccountId: command.toAccountId,
      money,
      status: 'COMPLETED',
      failureCode: null,
      idempotencyKey: command.idempotencyKey,
      createdAt: new Date(),
    };
    let changes: { account: Account; balance: Money }[];
    try {
      changes = this.planBalances(from, to, money);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      if (command.fromAccountId !== command.toAccountId) {
        await session.insertTransfer({ ...transfer, status: 'FAILED', failureCode: error.code });
      }
      return { ok: false, code: error.code, detail: error.message };
    }
    for (const change of changes.sort((a, b) => a.account.id.localeCompare(b.account.id))) {
      await session.updateBalance(change.account, change.balance.amount);
    }
    await session.insertTransfer(transfer);
    await session.appendEntries(generateEntries(transfer, randomUUID(), randomUUID()));
    return { ok: true, body: transferResponse(transfer) };
  }

  private planBalances(
    from: Account | undefined,
    to: Account,
    money: Money,
  ): { account: Account; balance: Money }[] {
    if (!from) return [{ account: to, balance: planDeposit(to, money) }];
    const [fromBalance, toBalance] = planTransfer(from, to, money);
    return [
      { account: from, balance: fromBalance },
      { account: to, balance: toBalance },
    ];
  }
}
