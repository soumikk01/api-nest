import { Controller, Get, Res } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from './prisma/prisma.service';
import { CacheService } from './cache/cache.service';
import { INGEST_QUEUE } from './ingest/ingest.queue';
import type { Response } from 'express';
import { promises as fsPromises, existsSync } from 'fs';
import * as path from 'path';

/**
 * GET /health — load balancer health check
 * Returns live Redis + DB status so NGINX can route away from unhealthy instances.
 * No auth required.
 */
@Controller('health')
export class AppController {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    @InjectQueue(INGEST_QUEUE) private queue: Queue,
  ) {}

  @Get()
  async check() {
    const [redis, db, queueSize] = await Promise.allSettled([
      this.checkRedis(),
      this.checkDb(),
      this.queue.getWaitingCount(),
    ]);

    const redisStatus =
      redis.status === 'fulfilled' ? 'connected' : 'disconnected';
    const dbStatus = db.status === 'fulfilled' ? 'connected' : 'disconnected';
    const queuePending =
      queueSize.status === 'fulfilled' ? queueSize.value : -1;

    const healthy = redisStatus === 'connected' && dbStatus === 'connected';

    return {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      redis: redisStatus,
      db: dbStatus,
      queue: { pending: queuePending },
    };
  }

  private async checkRedis(): Promise<void> {
    // CacheService.get with a dummy key — returns null on miss, throws on error
    await this.cache.get<unknown>('__health__');
  }

  private async checkDb(): Promise<void> {
    await this.prisma.$runCommandRaw({ ping: 1 });
  }
}

/**
 * GET /install.ps1  — serves the PowerShell install script
 * GET /install.sh   — serves the Bash install script
 * Both are excluded from the api/v1 prefix (see main.ts)
 */
@Controller()
export class InstallController {
  private findScript(name: string): string | null {
    const candidates = [
      // monorepo root / scripts/ (when running via turbo from repo root)
      path.join(process.cwd(), 'scripts', name),
      // one level up from apps/backend (monorepo root)
      path.join(process.cwd(), '..', '..', 'scripts', name),
      // compiled dist — 4 levels up to monorepo root
      path.join(__dirname, '..', '..', '..', '..', 'scripts', name),
    ];
    return candidates.find((p) => existsSync(p)) ?? null;
  }

  @Get('install.ps1')
  async servePs1(@Res() res: Response) {
    const file = this.findScript('install.ps1');
    if (!file) return res.status(404).send('install.ps1 not found on server');
    try {
      const content = await fsPromises.readFile(file, 'utf-8');
      res
        .setHeader('Content-Type', 'text/plain; charset=utf-8')
        .setHeader('Content-Disposition', 'inline; filename="install.ps1"')
        .send(content);
    } catch {
      res.status(500).send('Failed to read install script');
    }
  }

  @Get('install.sh')
  async serveSh(@Res() res: Response) {
    const file = this.findScript('install.sh');
    if (!file) return res.status(404).send('install.sh not found on server');
    try {
      const content = await fsPromises.readFile(file, 'utf-8');
      res
        .setHeader('Content-Type', 'text/plain; charset=utf-8')
        .setHeader('Content-Disposition', 'inline; filename="install.sh"')
        .send(content);
    } catch {
      res.status(500).send('Failed to read install script');
    }
  }
}
