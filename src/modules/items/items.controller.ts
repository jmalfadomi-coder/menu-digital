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
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantRole, ItemStatus } from '@prisma/client';
import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class ReorderDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}

@ApiTags('Items')
@ApiBearerAuth('access-token')
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER, TenantRole.CONTENT_EDITOR)
  @ApiOperation({ summary: 'Create a new menu item' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateItemDto) {
    return this.itemsService.create(tenantId, dto);
  }

  @Get()
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ItemStatus })
  @ApiQuery({ name: 'isFeatured', required: false, type: Boolean })
  @ApiQuery({ name: 'isSoldOut', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'List items with filters' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: ItemStatus,
    @Query('isFeatured') isFeatured?: boolean,
    @Query('isSoldOut') isSoldOut?: boolean,
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.itemsService.findAll(tenantId, {
      categoryId,
      status,
      isFeatured,
      isSoldOut,
      search,
      page: +page,
      limit: +limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an item by ID' })
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.itemsService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER, TenantRole.CONTENT_EDITOR)
  @ApiOperation({ summary: 'Update an item' })
  update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.itemsService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an item' })
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.itemsService.remove(id, tenantId);
  }

  @Patch(':id/publish')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER, TenantRole.CONTENT_EDITOR)
  @ApiOperation({ summary: 'Publish an item' })
  publish(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.itemsService.publish(id, tenantId);
  }

  @Patch(':id/unpublish')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER, TenantRole.CONTENT_EDITOR)
  @ApiOperation({ summary: 'Unpublish (draft) an item' })
  unpublish(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.itemsService.unpublish(id, tenantId);
  }

  @Patch(':id/sold-out')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER, TenantRole.CONTENT_EDITOR)
  @ApiOperation({ summary: 'Mark item as sold out' })
  soldOut(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.itemsService.toggleSoldOut(id, tenantId, true);
  }

  @Patch(':id/available')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER, TenantRole.CONTENT_EDITOR)
  @ApiOperation({ summary: 'Mark item as available again' })
  available(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.itemsService.toggleSoldOut(id, tenantId, false);
  }

  @Post('reorder')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER, TenantRole.CONTENT_EDITOR)
  @ApiOperation({ summary: 'Reorder items within a category' })
  reorder(
    @CurrentTenant() tenantId: string,
    @Query('categoryId') categoryId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.itemsService.reorder(tenantId, categoryId, dto.orderedIds);
  }
}
