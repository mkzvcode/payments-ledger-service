import { z } from 'zod';

const environment = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string()
    .url()
    .refine((url) => /^postgres(ql)?:\/\//.test(url)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(10000),
  DB_LOCK_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(5000),
  RATE_LIMIT: z.coerce.number().int().positive().default(120),
  RATE_TTL_MS: z.coerce.number().int().positive().default(60000),
});

export type Environment = z.infer<typeof environment>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const parsed = environment.safeParse(input);
  if (!parsed.success) {
    // Do not include input values: DATABASE_URL can contain credentials.
    throw new Error(
      `Invalid environment variables: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  }
  return parsed.data;
}
