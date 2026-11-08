import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApp } from '../src/bootstrap';
import { createDataSource } from '../src/database/data-source';
import { validateEnvironment } from '../src/common/config/environment';

interface AccountBody {
  id: string;
  balance: string;
  currency: string;
  version: number;
}
interface TransferBody {
  id: string;
  status: string;
  amount: string;
}
interface ProblemBody {
  code: string;
  status: number;
  detail: string;
  requestId: string;
}
interface EntriesBody {
  items: { id: string; direction: string; amount: string }[];
  nextCursor: string | null;
}

describe('payments API / PostgreSQL 16', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let app: NestExpressApplication;
  let db: DataSource;

  beforeAll(async () => {
    const externalUrl = process.env.E2E_DATABASE_URL;
    if (externalUrl) {
      if (process.env.CI || !new URL(externalUrl).pathname.endsWith('_e2e')) {
        throw new Error('External test database must end with _e2e and is forbidden in CI');
      }
      process.env.DATABASE_URL = externalUrl;
    } else {
      container = await new PostgreSqlContainer('postgres:16-alpine').start();
      process.env.DATABASE_URL = container.getConnectionUri();
    }
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    process.env.RATE_LIMIT = '10000';
    const migrations = createDataSource(validateEnvironment(process.env));
    await migrations.initialize();
    try {
      const [version] =
        await migrations.query<{ server_version_num: string }[]>('SHOW server_version_num');
      if (!version || !/^16\d{4}$/.test(version.server_version_num))
        throw new Error('E2E requires PostgreSQL 16');
      await migrations.runMigrations();
    } finally {
      await migrations.destroy();
    }
    app = await createApp();
    await app.init();
    db = app.get(DataSource);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (container) await container.stop();
  });

  const http = () => request(app.getHttpServer());

  async function account(amount = '0', currency = 'RUB'): Promise<AccountBody> {
    const response = await http()
      .post('/api/v1/accounts')
      .send({ ownerId: randomUUID(), currency })
      .expect(201);
    const body = response.body as AccountBody;
    if (amount !== '0') await deposit(body.id, amount, currency).expect(201);
    return body;
  }

  function deposit(id: string, amount: string, currency = 'RUB', key = randomUUID()) {
    return http()
      .post(`/api/v1/accounts/${id}/deposit`)
      .set('Idempotency-Key', key)
      .send({ amount, currency });
  }

  function transfer(from: string, to: string, amount = '10', key = randomUUID(), currency = 'RUB') {
    return http()
      .post('/api/v1/transfers')
      .set('Idempotency-Key', key)
      .send({ fromAccountId: from, toAccountId: to, amount, currency });
  }

  async function balance(id: string): Promise<bigint> {
    const response = await http().get(`/api/v1/accounts/${id}`).expect(200);
    return BigInt((response.body as AccountBody).balance);
  }

  it('serves Swagger, liveness and readiness', async () => {
    await http().get('/docs').expect(200);
    for (const path of ['/health', '/health/live', '/health/ready']) {
      await http().get(path).expect(200);
    }
    const schema = await http().get('/docs-json').expect(200);
    expect(JSON.stringify(schema.body)).toContain('Idempotency-Key');
  });

  it('transfers atomically and writes exactly two balanced entries', async () => {
    const from = await account('100');
    const to = await account();
    const response = await transfer(from.id, to.id, '30').expect(201);
    const body = response.body as TransferBody;
    expect(body.status).toBe('COMPLETED');
    expect(await balance(from.id)).toBe(70n);
    expect(await balance(to.id)).toBe(30n);
    await http().get(`/api/v1/transfers/${body.id}`).expect(200, response.body);
    const rows = await db.query<{ direction: string; amount: string }[]>(
      'SELECT direction, amount FROM ledger_entries WHERE transfer_id = $1',
      [body.id],
    );
    expect(rows).toHaveLength(2);
    expect(
      rows.reduce(
        (sum, row) => sum + (row.direction === 'CREDIT' ? BigInt(row.amount) : -BigInt(row.amount)),
        0n,
      ),
    ).toBe(0n);
    const version = await http().get(`/api/v1/accounts/${from.id}`);
    expect((version.body as AccountBody).version).toBe(2);
  });

  it('persists insufficient-funds failure without changing balances or journal', async () => {
    const from = await account('5');
    const to = await account();
    const key = randomUUID();
    const response = await transfer(from.id, to.id, '6', key)
      .expect(409)
      .expect('Content-Type', /application\/problem\+json/);
    expect((response.body as ProblemBody).code).toBe('INSUFFICIENT_FUNDS');
    expect(await balance(from.id)).toBe(5n);
    expect(await balance(to.id)).toBe(0n);
    const [failed] = await db.query<{ id: string; status: string }[]>(
      'SELECT id, status FROM transfers WHERE idempotency_key = $1',
      [key],
    );
    expect(failed?.status).toBe('FAILED');
    expect(
      await db.query('SELECT id FROM ledger_entries WHERE transfer_id = $1', [failed?.id]),
    ).toEqual([]);
    await deposit(from.id, '100').expect(201);
    const replay = await transfer(from.id, to.id, '6', key).expect(409);
    expect((replay.body as ProblemBody).code).toBe('INSUFFICIENT_FUNDS');
  });

  it('replays the exact successful result, including after balance changes', async () => {
    const from = await account('100');
    const to = await account();
    const key = randomUUID();
    const first = await transfer(from.id, to.id, '20', key).expect(201);
    await deposit(to.id, '3').expect(201);
    await transfer(from.id, to.id, '20', key).expect(201, first.body);
    expect(await balance(from.id)).toBe(80n);
    expect(await balance(to.id)).toBe(23n);
  });

  it('returns 422 for a key reused with another payload or endpoint', async () => {
    const from = await account('100');
    const to = await account();
    const key = randomUUID();
    await transfer(from.id, to.id, '20', key).expect(201);
    const changed = await transfer(from.id, to.id, '21', key).expect(422);
    expect((changed.body as ProblemBody).code).toBe('IDEMPOTENCY_CONFLICT');
    await deposit(to.id, '20', 'RUB', key).expect(422);
  });

  it('resolves 20 concurrent requests with one key to one transfer', async () => {
    const from = await account('100');
    const to = await account();
    const key = randomUUID();
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => transfer(from.id, to.id, '20', key).expect(201)),
    );
    expect(new Set(responses.map((response) => (response.body as TransferBody).id)).size).toBe(1);
    expect(await balance(from.id)).toBe(80n);
    expect(await balance(to.id)).toBe(20n);
  });

  it('resolves concurrent conflicting payloads to one success and one 422', async () => {
    const from = await account('100');
    const to = await account();
    const key = randomUUID();
    const responses = await Promise.all([
      transfer(from.id, to.id, '20', key),
      transfer(from.id, to.id, '21', key),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 422]);
  });

  it('preserves the total and nonnegative balances during 100 parallel transfers', async () => {
    const from = await account('10000');
    const to = await account('10000');
    const responses = await Promise.all(
      Array.from({ length: 100 }, () => transfer(from.id, to.id, '1').expect(201)),
    );
    expect(new Set(responses.map((response) => (response.body as TransferBody).id)).size).toBe(100);
    const balances = await Promise.all([balance(from.id), balance(to.id)]);
    expect(balances).toEqual([9900n, 10100n]);
    expect(balances.reduce((sum, value) => sum + value, 0n)).toBe(20000n);
    expect(balances.every((value) => value >= 0n)).toBe(true);
  });

  it('completes 100 simultaneous opposite-direction transfers without deadlock', async () => {
    const a = await account('1000');
    const b = await account('1000');
    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        index % 2 === 0
          ? transfer(a.id, b.id, '1').expect(201)
          : transfer(b.id, a.id, '1').expect(201),
      ),
    );
    expect(await balance(a.id)).toBe(1000n);
    expect(await balance(b.id)).toBe(1000n);
  });

  it('prevents overspending with concurrent debits', async () => {
    const a = await account('10');
    const b = await account();
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => transfer(a.id, b.id, '1')),
    );
    expect(responses.filter((response) => response.status === 201)).toHaveLength(10);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(10);
    expect(await balance(a.id)).toBe(0n);
    expect(await balance(b.id)).toBe(10n);
  });

  it('makes deposits idempotent and keeps amounts beyond 2^53 exact', async () => {
    const a = await account();
    const key = randomUUID();
    const first = await deposit(a.id, '9007199254740993', 'RUB', key).expect(201);
    await deposit(a.id, '9007199254740993', 'RUB', key).expect(201, first.body);
    expect(await balance(a.id)).toBe(9007199254740993n);
    const b = await account();
    await transfer(a.id, b.id, '9007199254740992').expect(201);
    expect(await balance(a.id)).toBe(1n);
    expect(await balance(b.id)).toBe(9007199254740992n);
  });

  it('rejects currency mismatch, self transfer, inactive accounts and overflow', async () => {
    const a = await account('1');
    const usd = await account('0', 'USD');
    await transfer(a.id, usd.id).expect(422);
    await transfer(a.id, a.id).expect(422);
    await db.query("UPDATE accounts SET status = 'FROZEN', version = version + 1 WHERE id = $1", [
      a.id,
    ]);
    await transfer(a.id, usd.id, '1').expect(409);
    await deposit(a.id, '1').expect(409);
    const full = await account('9223372036854775807');
    await deposit(full.id, '1').expect(422);
    expect(await balance(full.id)).toBe(9223372036854775807n);
  });

  it('validates string amounts, UUIDs, headers and unknown properties', async () => {
    const a = await account();
    await http()
      .post(`/api/v1/accounts/${a.id}/deposit`)
      .send({ amount: '1', currency: 'RUB' })
      .expect(400);
    for (const amount of [1, 0, '0', '-1', '1.5', '01', '1e3']) {
      await http()
        .post(`/api/v1/accounts/${a.id}/deposit`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount, currency: 'RUB' })
        .expect(400);
    }
    await deposit(a.id, '9223372036854775808').expect(422);
    await http()
      .post('/api/v1/accounts')
      .send({ ownerId: 'a', currency: 'RUB', balance: '100' })
      .expect(400);
    await http().get('/api/v1/accounts/bad').expect(400);
    await http().get(`/api/v1/accounts/${randomUUID()}`).expect(404);
    await http().get(`/api/v1/transfers/${randomUUID()}`).expect(404);
  });

  it('returns RFC 7807 and propagates a safe correlation id', async () => {
    const response = await http()
      .get('/api/v1/accounts/invalid')
      .set('X-Request-Id', 'demo-request')
      .expect(400);
    expect(response.headers['x-request-id']).toBe('demo-request');
    expect((response.body as ProblemBody).requestId).toBe('demo-request');
    expect(response.headers['content-type']).toMatch(/application\/problem\+json/);
    const malformed = await http()
      .post('/api/v1/accounts')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(malformed.headers['content-type']).toMatch(/application\/problem\+json/);
  });

  it('paginates entries without duplicates and binds the cursor to the account', async () => {
    const a = await account('10');
    const b = await account();
    for (let i = 0; i < 4; i++) await transfer(a.id, b.id, '1').expect(201);
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const response = await http()
        .get(`/api/v1/accounts/${a.id}/entries`)
        .query({ limit: 2, ...(cursor ? { cursor } : {}) })
        .expect(200);
      const body = response.body as EntriesBody;
      ids.push(...body.items.map((entry) => entry.id));
      cursor = body.nextCursor;
      if (cursor)
        await http().get(`/api/v1/accounts/${b.id}/entries`).query({ cursor }).expect(400);
    } while (cursor);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    await http().get(`/api/v1/accounts/${a.id}/entries?limit=101`).expect(400);
    await http().get(`/api/v1/accounts/${a.id}/entries?cursor=invalid`).expect(400);
  });

  it('enforces append-only journals, account projection, version and SQL constraints', async () => {
    const a = await account('10');
    await expect(
      db.query('UPDATE ledger_entries SET amount = 1 WHERE account_id = $1', [a.id]),
    ).rejects.toThrow('append-only');
    await expect(
      db.query('DELETE FROM ledger_entries WHERE account_id = $1', [a.id]),
    ).rejects.toThrow('append-only');
    await expect(
      db.query('UPDATE accounts SET balance = -1, version = version + 1 WHERE id = $1', [a.id]),
    ).rejects.toThrow();
    await expect(
      db.query('UPDATE accounts SET balance = 1, version = version + 1 WHERE id = $1', [a.id]),
    ).rejects.toThrow('differs from ledger');
    await expect(
      db.query("UPDATE accounts SET currency = 'USD', version = version + 1 WHERE id = $1", [a.id]),
    ).rejects.toThrow('immutable');
    await expect(
      db.query("UPDATE accounts SET status = 'FROZEN' WHERE id = $1", [a.id]),
    ).rejects.toThrow('version');
  });

  it('rejects a completed transfer without balanced entries at COMMIT', async () => {
    const a = await account('10');
    const b = await account();
    await expect(
      db.transaction(async (manager) => {
        const key = randomUUID();
        await manager.query(
          "INSERT INTO idempotency_requests(key, request_hash, result) VALUES ($1, $2, '{}'::jsonb)",
          [key, 'a'.repeat(64)],
        );
        await manager.query(
          `INSERT INTO transfers(id, kind, from_account_id, to_account_id, amount, currency, status, idempotency_key)
        VALUES ($1, 'TRANSFER', $2, $3, 1, 'RUB', 'COMPLETED', $4)`,
          [randomUUID(), a.id, b.id, key],
        );
      }),
    ).rejects.toThrow('invalid double-entry journal');
  });

  it('reconstructs every stored balance from the journal', async () => {
    const mismatches =
      await db.query(`SELECT a.id FROM accounts a LEFT JOIN ledger_entries e ON e.account_id = a.id
      GROUP BY a.id HAVING a.balance <> coalesce(sum(CASE e.direction WHEN 'CREDIT' THEN e.amount::numeric ELSE -e.amount::numeric END), 0)`);
    expect(mismatches).toEqual([]);
  });
});
