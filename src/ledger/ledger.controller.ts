import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { EntriesQueryDto } from '../common/http/dto';
import { ApiProblems } from '../common/http/api-responses';

@ApiTags('ledger')
@ApiProblems()
@Controller('accounts/:id/entries')
export class LedgerController {
  constructor(@Inject(LedgerService) private readonly ledger: LedgerService) {}

  @Get()
  @ApiOkResponse({
    schema: {
      example: {
        items: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            transferId: '33333333-3333-4333-8333-333333333333',
            accountId: '11111111-1111-4111-8111-111111111111',
            externalAccount: null,
            direction: 'DEBIT',
            amount: '15000',
            currency: 'RUB',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
    },
  })
  list(@Param('id', new ParseUUIDPipe()) id: string, @Query() query: EntriesQueryDto) {
    return this.ledger.list(id.toLowerCase(), query.limit, query.cursor);
  }
}
