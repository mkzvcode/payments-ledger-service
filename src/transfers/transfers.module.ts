import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PaymentsService } from './payments.service';
import { TransfersController } from './transfers.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [TransfersController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class TransfersModule {}
