import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [EventsModule, UsersModule],
  controllers: [IngestController],
  providers: [IngestService],
})
export class IngestModule {}
