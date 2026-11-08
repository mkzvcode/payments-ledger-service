import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TransfersModule } from '../transfers/transfers.module';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';

@Module({
  imports: [DatabaseModule, TransfersModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
