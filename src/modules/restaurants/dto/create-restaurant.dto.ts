import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsUrl,
  Matches,
  MinLength,
  MaxLength,
  IsObject,
} from 'class-validator';
import { Locale, MediaType, Plan } from '@prisma/client';

export class CreateRestaurantDto {
  @ApiProperty({ example: 'la-bella-pizza' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug may only contain lowercase letters, numbers and hyphens',
  })
  slug: string;

  @ApiProperty({ example: 'La Bella Pizza' })
  @IsString()
  @MinLength(2)
  name_en: string;

  @ApiPropertyOptional({ example: 'La Bella Pizza' })
  @IsOptional()
  @IsString()
  name_es?: string;

  // Contact
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zipCode?: string;

  // Branding
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @ApiPropertyOptional({ example: '#FF6B35' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Must be a valid hex color' })
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#2C3E50' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Must be a valid hex color' })
  accentColor?: string;

  @ApiPropertyOptional({ example: '#FFFFFF' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Must be a valid hex color' })
  backgroundColor?: string;

  @ApiPropertyOptional({ example: 'Inter' })
  @IsOptional()
  @IsString()
  fontFamily?: string;

  // Hero
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heroMediaUrl?: string;

  @ApiPropertyOptional({ enum: MediaType })
  @IsOptional()
  @IsEnum(MediaType)
  heroMediaType?: MediaType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heroTitle_en?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heroTitle_es?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heroSubtitle_en?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heroSubtitle_es?: string;

  // SEO
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaTitle_en?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaDescription_en?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaTitle_es?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaDescription_es?: string;

  // Theme
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  themeSettings?: Record<string, any>;

  // Locale
  @ApiPropertyOptional({ enum: Locale, default: Locale.EN })
  @IsOptional()
  @IsEnum(Locale)
  defaultLocale?: Locale;

  @ApiPropertyOptional({ enum: Locale, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Locale, { each: true })
  supportedLocales?: Locale[];

  // Subscription (Super/Agency admin only)
  @ApiPropertyOptional({ enum: Plan })
  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;
}
