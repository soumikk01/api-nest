import {
  IsOptional,
  IsString,
  IsNumber,
  IsObject,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class AiContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  endpoint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  method?: string;

  @IsOptional()
  @IsNumber()
  statusCode?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorMessage?: string;

  @IsOptional()
  @IsNumber()
  latency?: number;

  @IsOptional()
  @IsString()
  timestamp?: string;

  // Allow Prisma to treat this as InputJsonObject
  [key: string]: unknown;
}

export class StartConversationDto {
  @IsOptional()
  @IsObject()
  context?: AiContextDto;

  /** 'user' = web app (beginner-friendly), 'admin' = admin panel (technical) */
  @IsOptional()
  @IsString()
  @IsIn(['user', 'admin'])
  mode?: 'user' | 'admin';
}

export class SendMessageDto {
  @IsString()
  @MaxLength(4000)
  content!: string;

  @IsString()
  conversationId!: string;
}

export class SetApiKeyDto {
  @IsString()
  @MaxLength(200)
  geminiApiKey!: string;
}

export class ListConversationsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
