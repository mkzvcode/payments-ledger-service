import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { validateEnvironment } from '../common/config/environment';
import { createDataSource } from './data-source';
import { PgPaymentUnitOfWork } from './pg-payment-unit-of-work';
import { PgTransferRepository } from './pg-repositories';
import { PaymentsService } from '../transfers/payments.service';

const aliceId = '11111111-1111-4111-8111-111111111111';
const bobId = '22222222-2222-4222-8222-222222222222';

async function seed(): Promise<void> {
  const db = createDataSource(validateEnvironment(process.env));
  await db.initialize();
  try {
    await db.query(
      `INSERT INTO accounts(id, owner_id, currency) VALUES
      ($1, 'demo-alice', 'RUB'), ($2, 'demo-bob', 'RUB') ON CONFLICT (id) DO NOTHING`,
      [aliceId, bobId],
    );
    const payments = new PaymentsService(new PgPaymentUnitOfWork(db), new PgTransferRepository(db));
    for (const id of [aliceId, bobId]) {
      await payments.execute({
        kind: 'DEPOSIT',
        fromAccountId: null,
        toAccountId: id,
        amount: '100000',
        currency: 'RUB',
        idempotencyKey: `seed-v1-deposit-${id}`,
      });
    }
    console.log(
      JSON.stringify({
        aliceId,
        bobId,
        requestId: randomUUID(),
        message: 'Demo accounts are ready',
      }),
    );
  } finally {
    await db.destroy();
  }
}

void seed().catch(() => {
  console.error('Seed failed; run migrations first and verify database connectivity');
  process.exitCode = 1;
});
