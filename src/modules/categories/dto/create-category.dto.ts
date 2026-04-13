import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt, Min, IsUrl } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Appetizers' })
  @IsString()
  name_en: string;

  @ApiPropertyOptional({ example: 'Aperitivos' })
  @IsOptional()
  @IsString()
  name_es?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description_en?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description_es?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ example: 'clq1abc...' })
  @IsString()
  menuId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
