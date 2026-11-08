import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1730000000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(readFileSync(join(__dirname, '001-initial.up.sql'), 'utf8'));
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(readFileSync(join(__dirname, '001-initial.down.sql'), 'utf8'));
  }
}
