import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IngestService } from './ingest.service';
import { IngestDto } from './dto/ingest.dto';

/**
 * POST /ingest
 *
 * This endpoint is called by the CLI agent (NOT the dashboard user).
 * Authentication is done via sdkToken inside the request body.
 * No JWT required — the SDK token acts as the credential.
 */
@Controller('ingest')
export class IngestController {
  constructor(private ingestService: IngestService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  ingest(@Body() dto: IngestDto) {
    return this.ingestService.ingest(dto);
  }
}
