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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { Role, TenantRole } from '@prisma/client';
import { ParseBooleanPipe } from '../../common/pipes/parse-boolean.pipe';

@ApiTags('Restaurants')
@ApiBearerAuth('access-token')
@SkipTenant()
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Create a new restaurant/tenant' })
  create(@Body() dto: CreateRestaurantDto) {
    return this.restaurantsService.create(dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.AGENCY_ADMIN)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiOperation({ summary: 'List all restaurants (Admin)' })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('isActive', ParseBooleanPipe) isActive?: boolean,
  ) {
    return this.restaurantsService.findAll(+page, +limit, search, isActive);
  }

  @Get('mine')
  @ApiOperation({ summary: 'List restaurants the current user belongs to' })
  findMine(@CurrentUser('sub') userId: string) {
    return this.restaurantsService.findMine(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get restaurant by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.restaurantsService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update restaurant profile and branding' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.restaurantsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete restaurant (Super Admin only)' })
  remove(@Param('id') id: string) {
    return this.restaurantsService.remove(id);
  }

  @Patch(':id/activate')
  @Roles(Role.SUPER_ADMIN, Role.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Activate restaurant' })
  activate(@Param('id') id: string) {
    return this.restaurantsService.toggleActive(id, true);
  }

  @Patch(':id/deactivate')
  @Roles(Role.SUPER_ADMIN, Role.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Deactivate restaurant' })
  deactivate(@Param('id') id: string) {
    return this.restaurantsService.toggleActive(id, false);
  }

  // ─── Staff management ──────────────────────────────────────────────────────

  @Get(':id/staff')
  @Roles(
    Role.SUPER_ADMIN,
    Role.AGENCY_ADMIN,
    TenantRole.RESTAURANT_OWNER,
    TenantRole.RESTAURANT_MANAGER,
  )
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'List all staff for a restaurant' })
  getStaff(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.restaurantsService.getStaff(id, +page, +limit);
  }

  @Delete(':id/staff/:userId')
  @Roles(Role.SUPER_ADMIN, Role.AGENCY_ADMIN, TenantRole.RESTAURANT_OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a staff member from the restaurant' })
  removeStaff(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser('sub') requestingUserId: string,
  ) {
    return this.restaurantsService.removeStaff(id, userId, requestingUserId);
  }
}
