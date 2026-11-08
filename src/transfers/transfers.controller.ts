import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IdempotencyKey } from '../common/http/idempotency-key.decorator';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreateTransferDto } from '../common/http/dto';
import { IdempotencyKeyPipe } from '../common/http/idempotency-key.pipe';
import { transferResponse } from '../common/application/presenters';
import { ApiProblems, ApiIdempotency, transferExample } from '../common/http/api-responses';

@ApiTags('transfers')
@ApiProblems()
@Controller('transfers')
export class TransfersController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Post()
  @ApiIdempotency()
  @ApiCreatedResponse({ schema: { example: transferExample } })
  create(@Body() dto: CreateTransferDto, @IdempotencyKey(IdempotencyKeyPipe) key: string) {
    return this.payments.execute({ ...dto, kind: 'TRANSFER', idempotencyKey: key });
  }

  @Get(':id')
  @ApiOkResponse({ schema: { example: transferExample } })
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    return transferResponse(await this.payments.get(id));
  }
}
