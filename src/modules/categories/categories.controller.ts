import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantRole } from '@prisma/client';
import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class ReorderDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}

@ApiTags('Categories')
@ApiBearerAuth('access-token')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER, TenantRole.CONTENT_EDITOR)
  @ApiOperation({ summary: 'Create a category within a menu' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(tenantId, dto);
  }

  @Get()
  @ApiQuery({ name: 'menuId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'List all categories (optionally filter by menu)' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('menuId') menuId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.categoriesService.findAll(tenantId, menuId, +page, +limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category with its published items' })
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.categoriesService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER, TenantRole.CONTENT_EDITOR)
  @ApiOperation({ summary: 'Update a category' })
  update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a category (cascades items)' })
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.categoriesService.remove(id, tenantId);
  }

  @Post('reorder')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER, TenantRole.CONTENT_EDITOR)
  @ApiOperation({ summary: 'Reorder categories within a menu' })
  reorder(
    @CurrentTenant() tenantId: string,
    @Query('menuId') menuId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.categoriesService.reorder(tenantId, menuId, dto.orderedIds);
  }
}
