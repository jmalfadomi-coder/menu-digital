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
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { Role } from '@prisma/client';

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
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOperation({ summary: 'List all restaurants (paginated)' })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.restaurantsService.findAll(+page, +limit, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a restaurant by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.restaurantsService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update restaurant profile & branding' })
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
  @ApiOperation({ summary: 'Delete a restaurant (Super Admin only)' })
  remove(@Param('id') id: string) {
    return this.restaurantsService.remove(id);
  }

  @Patch(':id/activate')
  @Roles(Role.SUPER_ADMIN, Role.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Activate a restaurant' })
  activate(@Param('id') id: string) {
    return this.restaurantsService.toggleActive(id, true);
  }

  @Patch(':id/deactivate')
  @Roles(Role.SUPER_ADMIN, Role.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Deactivate a restaurant' })
  deactivate(@Param('id') id: string) {
    return this.restaurantsService.toggleActive(id, false);
  }
}
