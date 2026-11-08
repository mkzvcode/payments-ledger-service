import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';

@Module({ imports: [DatabaseModule], controllers: [LedgerController], providers: [LedgerService] })
export class LedgerModule {}
