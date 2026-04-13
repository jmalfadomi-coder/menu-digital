import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { PublicService } from './public.service';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';

@ApiTags('Public')
@Public()
@SkipTenant()
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Get restaurant profile by slug' })
  @ApiParam({ name: 'slug', example: 'la-bella-pizza' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'es'], example: 'en' })
  getRestaurant(
    @Param('slug') slug: string,
    @Query('locale') locale: 'en' | 'es' = 'en',
  ) {
    return this.publicService.getRestaurant(slug, locale);
  }

  @Get(':slug/menu')
  @ApiOperation({ summary: 'Get full menu tree (active menus → categories → items)' })
  @ApiParam({ name: 'slug', example: 'la-bella-pizza' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'es'], example: 'en' })
  @ApiResponse({
    status: 200,
    description: 'Returns all active/scheduled menus with their categories and published items',
  })
  getMenuTree(
    @Param('slug') slug: string,
    @Query('locale') locale: 'en' | 'es' = 'en',
  ) {
    return this.publicService.getMenuTree(slug, locale);
  }

  @Get(':slug/items/:itemId')
  @ApiOperation({ summary: 'Get a single published item by ID' })
  @ApiParam({ name: 'slug', example: 'la-bella-pizza' })
  @ApiParam({ name: 'itemId' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'es'] })
  getItem(
    @Param('slug') slug: string,
    @Param('itemId') itemId: string,
    @Query('locale') locale: 'en' | 'es' = 'en',
  ) {
    return this.publicService.getItem(slug, itemId, locale);
  }

  @Get(':slug/search')
  @ApiOperation({ summary: 'Search menu items by keyword' })
  @ApiParam({ name: 'slug', example: 'la-bella-pizza' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'es'] })
  search(
    @Param('slug') slug: string,
    @Query('q') query: string,
    @Query('locale') locale: 'en' | 'es' = 'en',
  ) {
    return this.publicService.search(slug, query, locale);
  }
}
