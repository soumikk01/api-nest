import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { EventsService } from '../events/events.service';
import { ApiCallEventDto } from './dto/ingest.dto';
import { INGEST_QUEUE, INGEST_JOB, IngestJobPayload } from './ingest.queue';

// ─────────────────────────────────────────────
//  Helpers (copied from ingest.service — no shared dep needed)
// ─────────────────────────────────────────────
function classifyStatus(statusCode?: number): string {
  if (!statusCode) return 'PENDING';
  if (statusCode >= 200 && statusCode < 300) return 'SUCCESS';
  if (statusCode >= 400 && statusCode < 500) return 'CLIENT_ERROR';
  if (statusCode >= 500) return 'SERVER_ERROR';
  return 'PENDING';
}

function extractHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function extractPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────
//  Per-project stats debounce (lives in the worker process)
// ─────────────────────────────────────────────
const STATS_DEBOUNCE_MS = 5_000;

@Processor(INGEST_QUEUE)
export class IngestProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestProcessor.name);
  private readonly statsDebounce = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private eventsService: EventsService,
  ) {
    super();
  }

  async process(job: Job<IngestJobPayload>): Promise<void> {
    if (job.name !== INGEST_JOB.PROCESS_BATCH) {
      this.logger.warn(`Unknown job type: ${job.name} — skipping`);
      return;
    }

    const { projectId, serviceId, userId, events } = job.data;

    // ── Write events — use allSettled so one bad event doesn't abort the ────
    // ── entire batch and trigger duplicate retries for events that succeeded ──
    const settled = await Promise.allSettled(
      events.map((event) =>
        this.persistEvent(event, projectId, serviceId, userId),
      ),
    );

    const records = settled
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<
          Awaited<ReturnType<typeof this.persistEvent>>
        > => r.status === 'fulfilled',
      )
      .map((r) => r.value);

    const failedCount = settled.length - records.length;
    if (failedCount > 0) {
      this.logger.warn(
        `[${projectId}] ${failedCount}/${settled.length} event(s) failed to persist — skipped (job ${job.id})`,
      );
    }
    this.logger.debug(
      `[${projectId}] persisted ${records.length} event(s) (job ${job.id})`,
    );

    // ── Emit WebSocket events ─────────────────────────────────────────────
    for (const record of records) {
      this.eventsService.emitApiCall(projectId, record);

      if (
        record.status === 'CLIENT_ERROR' ||
        record.status === 'SERVER_ERROR'
      ) {
        this.eventsService.emitApiError(projectId, {
          id: record.id,
          error: `${record.statusCode} ${record.statusText ?? ''}`,
        });
      }
    }

    // ── Debounced stats broadcast + cache bust ────────────────────────────
    this.scheduleBroadcastStats(projectId, serviceId);
  }

  // ─────────────────────────────────────────────
  //  Private helpers
  // ─────────────────────────────────────────────

  private async persistEvent(
    event: ApiCallEventDto,
    projectId: string,
    serviceId: string,
    userId: string,
  ) {
    return this.prisma.apiCall.create({
      data: {
        projectId,
        serviceId: serviceId || undefined,
        userId,
        method: event.method.toUpperCase(),
        url: event.url,
        host: extractHost(event.url),
        path: extractPath(event.url),
        requestHeaders: event.requestHeaders ?? null,
        requestBody: event.requestBody ?? null,
        queryParams: event.queryParams ?? null,
        statusCode: event.statusCode ?? null,
        statusText: event.statusText ?? null,
        responseHeaders: event.responseHeaders ?? null,
        responseBody: event.responseBody ?? null,
        responseSize: event.responseSize ?? null,
        latency: event.latency,
        startedAt: new Date(event.startedAt),
        endedAt: new Date(event.endedAt),
        status: classifyStatus(event.statusCode),
      },
    });
  }

  private scheduleBroadcastStats(projectId: string, serviceId?: string) {
    const key = serviceId ? `${projectId}:${serviceId}` : projectId;
    const existing = this.statsDebounce.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.statsDebounce.delete(key);
      void this.broadcastStats(projectId);
      // Bust per-range analytics caches (now range-scoped)
      void this.cache.del(
        `analytics:summary:${projectId}:1h`,
        `analytics:summary:${projectId}:24h`,
        `analytics:summary:${projectId}:7d`,
        `analytics:summary:${projectId}:30d`,
      );
      // Bust stats and calls caches — now userId-scoped so use pattern delete
      void this.cache.delByPattern(`stats:${projectId}:*`);
      void this.cache.delByPattern(`calls:${projectId}:*`);
      // Bust analytics endpoints — now range-scoped
      void this.cache.delByPattern(`analytics:endpoints:${projectId}:*`);
      // Bust paginated history
      void this.cache.delByPattern(`history:${projectId}:*`);
    }, STATS_DEBOUNCE_MS);

    this.statsDebounce.set(key, timer);
  }

  /**
   * Windowed stats query — only last 1 hour, hard cap at 10k rows.
   * Uses compound index [projectId, createdAt] for a fast scan.
   */
  private async broadcastStats(projectId: string) {
    const since = new Date(Date.now() - 60 * 60 * 1_000);

    const calls = await this.prisma.apiCall.findMany({
      where: { projectId, createdAt: { gte: since } },
      select: { status: true, latency: true },
      take: 10_000,
    });

    if (!calls.length) return;

    const total = calls.length;
    const errors = calls.filter(
      (c) => c.status === 'CLIENT_ERROR' || c.status === 'SERVER_ERROR',
    ).length;
    const avgLatency = calls.reduce((sum, c) => sum + c.latency, 0) / total;

    this.eventsService.emitStats(projectId, {
      total,
      errorRate: Math.round((errors / total) * 100),
      avgLatency: Math.round(avgLatency),
    });
  }
}
