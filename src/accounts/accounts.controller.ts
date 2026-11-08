import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IdempotencyKey } from '../common/http/idempotency-key.decorator';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { PaymentsService } from '../transfers/payments.service';
import { CreateAccountDto, AmountDto } from '../common/http/dto';
import { IdempotencyKeyPipe } from '../common/http/idempotency-key.pipe';
import { accountResponse } from '../common/http/presenters';
import {
  ApiProblems,
  ApiIdempotency,
  accountExample,
  transferExample,
} from '../common/http/api-responses';

@ApiTags('accounts')
@ApiProblems()
@Controller('accounts')
export class AccountsController {
  constructor(
    @Inject(AccountsService) private readonly accounts: AccountsService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a zero-balance account' })
  @ApiCreatedResponse({ schema: { example: accountExample } })
  async create(@Body() dto: CreateAccountDto) {
    return accountResponse(await this.accounts.create(dto.ownerId, dto.currency));
  }

  @Get(':id')
  @ApiOkResponse({ schema: { example: accountExample } })
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    return accountResponse(await this.accounts.get(id));
  }

  @Post(':id/deposit')
  @ApiOperation({ summary: 'Credit an account from the external funding ledger' })
  @ApiIdempotency()
  @ApiCreatedResponse({
    schema: { example: { ...transferExample, kind: 'DEPOSIT', fromAccountId: null } },
  })
  deposit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AmountDto,
    @IdempotencyKey(IdempotencyKeyPipe) key: string,
  ) {
    return this.payments.execute({
      ...dto,
      kind: 'DEPOSIT',
      fromAccountId: null,
      toAccountId: id.toLowerCase(),
      idempotencyKey: key,
    });
  }
}
