import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { IngestModule } from './ingest/ingest.module';
import { EventsModule } from './events/events.module';
import { HistoryModule } from './history/history.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    // Load .env globally
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting: max 200 requests per 60 seconds per IP
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),

    // BullMQ — shared Redis connection for all queues
    // Falls back gracefully if REDIS_URL is not set (queue operations will throw,
    // so ensure Redis is running in production).
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: new URL(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379').hostname,
          port: parseInt(
            new URL(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379').port || '6379',
          ),
          maxRetriesPerRequest: null, // BullMQ requirement
        },
        defaultJobOptions: {
          removeOnComplete: { count: 100 },
          removeOnFail:     { count: 50 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 1_000 },
        },
      }),
    }),

    // Database
    PrismaModule,

    // Redis cache (global — auto-available in all modules)
    CacheModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ProjectsModule,
    IngestModule,
    EventsModule,
    HistoryModule,
    AnalyticsModule,
    AuditModule,
  ],
})
export class AppModule {}
