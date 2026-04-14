import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';
import * as mime from 'mime-types';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaType } from '@prisma/client';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

@Injectable()
export class MediaService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnUrl?: string;
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const endpoint = config.get<string>('s3.endpoint');
    this.s3 = new S3Client({
      region: config.get<string>('s3.region') ?? 'us-east-1',
      credentials: {
        accessKeyId: config.get<string>('s3.accessKeyId') ?? '',
        secretAccessKey: config.get<string>('s3.secretAccessKey') ?? '',
      },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
    this.bucket = config.get<string>('s3.bucket') ?? '';
    this.cdnUrl = config.get<string>('s3.cdnUrl');
  }

  async upload(
    tenantId: string,
    file: Express.Multer.File,
  ) {
    const maxSizeMb = this.config.get<number>('s3.maxFileSizeMb') ?? 10;
    if (file.size > maxSizeMb * 1024 * 1024) {
      throw new BadRequestException(`File exceeds maximum size of ${maxSizeMb}MB`);
    }
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed: ${ALLOWED_TYPES.join(', ')}`,
      );
    }

    const ext = mime.extension(file.mimetype) || 'bin';
    const key = `tenants/${tenantId}/${uuid()}.${ext}`;
    const mediaType = ALLOWED_IMAGE_TYPES.includes(file.mimetype)
      ? MediaType.IMAGE
      : MediaType.VIDEO;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'max-age=31536000',
      }),
    );

    const url = this.cdnUrl
      ? `${this.cdnUrl}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;

    const asset = await this.prisma.mediaAsset.create({
      data: {
        tenantId,
        filename: key.split('/').pop()!,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url,
        storageKey: key,
        mediaType,
      },
    });

    return asset;
  }

  async getPresignedUploadUrl(
    tenantId: string,
    filename: string,
    mimeType: string,
    expiresIn = 300,
  ) {
    if (!ALLOWED_TYPES.includes(mimeType)) {
      throw new BadRequestException('Unsupported media type');
    }

    const ext = mime.extension(mimeType) || 'bin';
    const key = `tenants/${tenantId}/${uuid()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn });
    const publicUrl = this.cdnUrl
      ? `${this.cdnUrl}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;

    return { uploadUrl, key, publicUrl, expiresIn };
  }

  async confirmUpload(
    tenantId: string,
    key: string,
    originalName: string,
    mimeType: string,
    size: number,
  ) {
    const mediaType = ALLOWED_IMAGE_TYPES.includes(mimeType)
      ? MediaType.IMAGE
      : MediaType.VIDEO;

    const url = this.cdnUrl
      ? `${this.cdnUrl}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;

    return this.prisma.mediaAsset.create({
      data: {
        tenantId,
        filename: key.split('/').pop()!,
        originalName,
        mimeType,
        size,
        url,
        storageKey: key,
        mediaType,
      },
    });
  }

  async findAll(tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mediaAsset.count({ where: { tenantId } }),
    ]);
    return { data, meta: { total, page, limit } };
  }

  async remove(id: string, tenantId: string) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, tenantId },
    });
    if (!asset) throw new NotFoundException('Media asset not found');

    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: asset.storageKey }),
    );
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { message: 'Asset deleted' };
  }
}
