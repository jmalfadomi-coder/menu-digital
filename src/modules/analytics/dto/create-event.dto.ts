import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsObject, IsUUID } from 'class-validator';
import { Locale } from '@prisma/client';

export class CreateAnalyticsEventDto {
  @ApiProperty({ example: 'menu_view', description: 'Event type identifier' })
  @IsString()
  eventType: string;

  @ApiPropertyOptional({ example: 'item', enum: ['menu', 'category', 'item'] })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ example: 'clq1abc...' })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional({ description: 'Anonymous session identifier' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Persistent visitor identifier (fingerprint/cookie)' })
  @IsOptional()
  @IsString()
  visitorId?: string;

  @ApiPropertyOptional({ enum: Locale })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  @ApiPropertyOptional({ description: 'Additional event payload' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
