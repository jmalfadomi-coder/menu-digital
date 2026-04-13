import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { MediaService } from './media.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantRole } from '@prisma/client';
import { IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PresignedUrlDto {
  @ApiProperty()
  @IsString()
  filename: string;

  @ApiProperty()
  @IsString()
  mimeType: string;
}

class ConfirmUploadDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  @IsString()
  originalName: string;

  @ApiProperty()
  @IsString()
  mimeType: string;

  @ApiProperty()
  size: number;
}

@ApiTags('Media')
@ApiBearerAuth('access-token')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER, TenantRole.CONTENT_EDITOR)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Direct multipart upload (≤10MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  upload(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.mediaService.upload(tenantId, file);
  }

  @Post('presigned-url')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER, TenantRole.CONTENT_EDITOR)
  @ApiOperation({ summary: 'Get a pre-signed S3 upload URL (for large files)' })
  getPresignedUrl(
    @CurrentTenant() tenantId: string,
    @Body() dto: PresignedUrlDto,
  ) {
    return this.mediaService.getPresignedUploadUrl(
      tenantId,
      dto.filename,
      dto.mimeType,
    );
  }

  @Post('confirm-upload')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER, TenantRole.CONTENT_EDITOR)
  @ApiOperation({ summary: 'Register a file after direct S3 upload' })
  confirmUpload(
    @CurrentTenant() tenantId: string,
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.mediaService.confirmUpload(
      tenantId,
      dto.key,
      dto.originalName,
      dto.mimeType,
      dto.size,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List media assets for the current tenant' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.mediaService.findAll(tenantId, +page, +limit);
  }

  @Delete(':id')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a media asset from S3 and database' })
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.mediaService.remove(id, tenantId);
  }
}
