import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsArray,
  IsNumber,
  IsDecimal,
  IsEnum,
  ValidateNested,
  IsPositive,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ItemStatus } from '@prisma/client';
import { ScheduleDto } from '../../menus/dto/create-menu.dto';

export class CreateItemDto {
  @ApiProperty({ example: 'Margherita Pizza' })
  @IsString()
  name_en: string;

  @ApiPropertyOptional({ example: 'Pizza Margherita' })
  @IsOptional()
  @IsString()
  name_es?: string;

  @ApiPropertyOptional({ example: 'Classic tomato sauce, mozzarella, fresh basil' })
  @IsOptional()
  @IsString()
  description_en?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description_es?: string;

  @ApiProperty({ example: 14.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Transform(({ value }) => parseFloat(value))
  price: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'clq1abc...', description: 'Parent category ID' })
  @IsString()
  categoryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['gluten', 'dairy'],
    description: 'Allergen identifiers',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['vegan', 'new', 'popular'],
    description: 'Display badges',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  badges?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 5, description: '0=none, 5=very hot' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  spicyLevel?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSoldOut?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: ItemStatus, default: ItemStatus.DRAFT })
  @IsOptional()
  @IsEnum(ItemStatus)
  status?: ItemStatus;

  @ApiPropertyOptional({ type: [ScheduleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDto)
  schedules?: ScheduleDto[];
}
