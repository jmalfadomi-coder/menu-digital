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
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'es'] })
  @ApiResponse({ status: 200, description: 'Restaurant branding, contact, and theme data' })
  @ApiResponse({ status: 404, description: 'Restaurant not found or inactive' })
  getRestaurant(
    @Param('slug') slug: string,
    @Query('locale') locale: 'en' | 'es' = 'en',
  ) {
    return this.publicService.getRestaurant(slug, locale);
  }

  @Get(':slug/menu')
  @ApiOperation({
    summary:
      'Full menu tree – active menus → categories → published + scheduled items',
  })
  @ApiParam({ name: 'slug', example: 'la-bella-pizza' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'es'] })
  @ApiResponse({
    status: 200,
    description:
      'Only active, currently-scheduled menus/items are returned. ' +
      'Price is serialized as a number.',
  })
  getMenuTree(
    @Param('slug') slug: string,
    @Query('locale') locale: 'en' | 'es' = 'en',
  ) {
    return this.publicService.getMenuTree(slug, locale);
  }

  @Get(':slug/items/featured')
  @ApiOperation({ summary: 'List featured items for the restaurant' })
  @ApiParam({ name: 'slug', example: 'la-bella-pizza' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'es'] })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max items (default 12)' })
  getFeatured(
    @Param('slug') slug: string,
    @Query('locale') locale: 'en' | 'es' = 'en',
    @Query('limit') limit = 12,
  ) {
    return this.publicService.getFeatured(slug, locale, +limit);
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
  @ApiOperation({ summary: 'Full-text search across published menu items' })
  @ApiParam({ name: 'slug', example: 'la-bella-pizza' })
  @ApiQuery({ name: 'q', required: true, description: 'Search keyword' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'es'] })
  search(
    @Param('slug') slug: string,
    @Query('q') query: string,
    @Query('locale') locale: 'en' | 'es' = 'en',
  ) {
    return this.publicService.search(slug, query, locale);
  }
}
