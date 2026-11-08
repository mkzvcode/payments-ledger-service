import 'reflect-metadata';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import type { Environment } from '../common/config/environment';
import { Initial1730000000000 } from './migrations/1730000000000-initial';

export function databaseOptions(env: Environment): DataSourceOptions {
  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    synchronize: false,
    migrationsRun: false,
    migrations: [Initial1730000000000],
    migrationsTransactionMode: 'all',
    logging: false,
    extra: {
      max: env.DB_POOL_SIZE,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30000,
      statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
      lock_timeout: env.DB_LOCK_TIMEOUT_MS,
      idle_in_transaction_session_timeout: 15000,
      application_name: 'payments-ledger-service',
    },
  };
}

export function createDataSource(env: Environment): DataSource {
  return new DataSource(databaseOptions(env));
}
