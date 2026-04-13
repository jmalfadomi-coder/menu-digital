import { registerAs } from '@nestjs/config';

export default registerAs('s3', () => ({
  endpoint: process.env.S3_ENDPOINT || undefined, // for S3-compatible (e.g. MinIO)
  region: process.env.S3_REGION || 'us-east-1',
  accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  bucket: process.env.S3_BUCKET || 'menu-digital',
  cdnUrl: process.env.S3_CDN_URL || undefined,
  maxFileSizeMb: parseInt(process.env.S3_MAX_FILE_SIZE_MB || '10', 10),
}));
