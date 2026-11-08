import 'dotenv/config';
import { validateEnvironment } from '../common/config/environment';
import { createDataSource } from './data-source';

async function migrate(): Promise<void> {
  const source = createDataSource(validateEnvironment(process.env));
  await source.initialize();
  try {
    await source.runMigrations();
  } finally {
    await source.destroy();
  }
}

void migrate().catch(() => {
  console.error('Migration failed; check database connectivity and migration compatibility');
  process.exitCode = 1;
});
