import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnvironment } from '../common/config/environment';
import { ACCOUNTS, TRANSFERS, LEDGER, PAYMENTS } from '../common/application/ports';
import { databaseOptions } from './data-source';
import { PgAccountRepository, PgTransferRepository, PgLedgerRepository } from './pg-repositories';
import { PgPaymentUnitOfWork } from './pg-payment-unit-of-work';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        databaseOptions(
          validateEnvironment({
            ...process.env,
            DATABASE_URL: config.getOrThrow<string>('DATABASE_URL'),
          }),
        ),
    }),
  ],
  providers: [
    { provide: ACCOUNTS, useClass: PgAccountRepository },
    { provide: TRANSFERS, useClass: PgTransferRepository },
    { provide: LEDGER, useClass: PgLedgerRepository },
    { provide: PAYMENTS, useClass: PgPaymentUnitOfWork },
  ],
  exports: [ACCOUNTS, TRANSFERS, LEDGER, PAYMENTS, TypeOrmModule],
})
export class DatabaseModule {}
