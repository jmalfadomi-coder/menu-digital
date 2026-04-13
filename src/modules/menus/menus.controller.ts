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
import { MenusService } from './menus.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantRole } from '@prisma/client';

@ApiTags('Menus')
@ApiBearerAuth('access-token')
@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Post()
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER)
  @ApiOperation({ summary: 'Create a new menu' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateMenuDto) {
    return this.menusService.create(tenantId, dto);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'List all menus for current tenant' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.menusService.findAll(tenantId, +page, +limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a menu with its categories' })
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.menusService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER)
  @ApiOperation({ summary: 'Update a menu' })
  update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateMenuDto,
  ) {
    return this.menusService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a menu (cascades to categories and items)' })
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.menusService.remove(id, tenantId);
  }

  @Patch(':id/publish')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER)
  @ApiOperation({ summary: 'Publish a menu (make it active)' })
  publish(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.menusService.publish(id, tenantId);
  }

  @Patch(':id/unpublish')
  @Roles(TenantRole.RESTAURANT_OWNER, TenantRole.RESTAURANT_MANAGER)
  @ApiOperation({ summary: 'Unpublish / deactivate a menu' })
  unpublish(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.menusService.unpublish(id, tenantId);
  }
}
