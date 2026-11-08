import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import type { Server } from 'node:http';
import { createApp } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const server = app.getHttpServer() as Server;
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.setTimeout(20000, (socket) => socket.destroy());
  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'), '0.0.0.0');
}

void bootstrap().catch(() => {
  console.error('Application startup failed; verify environment and database availability');
  process.exitCode = 1;
});
