import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(TypeOrmHealthIndicator) private readonly database: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  ready() {
    return this.health.check([() => this.database.pingCheck('postgres', { timeout: 2000 })]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.ready();
  }

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }
}
