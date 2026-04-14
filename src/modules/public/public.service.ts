import { Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { isScheduleActive } from '../../common/utils/date.util';

type LocaleKey = 'en' | 'es';

/** Flatten bilingual fields into a single locale-resolved object */
function localize<T extends Record<string, any>>(
  record: T,
  locale: LocaleKey,
  fields: string[],
): T {
  const out: any = { ...record };
  for (const field of fields) {
    const localeKey = `${field}_${locale}`;
    const fallbackKey = `${field}_en`;
    out[field] = out[localeKey] ?? out[fallbackKey] ?? null;
    delete out[`${field}_en`];
    delete out[`${field}_es`];
  }
  return out;
}

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ─── Restaurant Profile ───────────────────────────────────

  async getRestaurant(slug: string, locale: LocaleKey = 'en') {
    const cacheKey = `public:restaurant:${slug}:${locale}`;
    const cached = await this.cache.get<object>(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true, slug: true,
        name_en: true, name_es: true,
        email: true, phone: true, website: true,
        address: true, city: true, state: true, country: true,
        logoUrl: true, faviconUrl: true, bannerUrl: true,
        primaryColor: true, accentColor: true, backgroundColor: true, fontFamily: true,
        heroMediaUrl: true, heroMediaType: true,
        heroTitle_en: true, heroTitle_es: true,
        heroSubtitle_en: true, heroSubtitle_es: true,
        metaTitle_en: true, metaTitle_es: true,
        metaDescription_en: true, metaDescription_es: true,
        themeSettings: true,
        defaultLocale: true, supportedLocales: true,
      },
    });

    if (!tenant) throw new NotFoundException('Restaurant not found');

    const result = localize(tenant, locale, [
      'name', 'heroTitle', 'heroSubtitle', 'metaTitle', 'metaDescription',
    ]);

    await this.cache.set(cacheKey, result, 300_000); // 5 min in ms
    return result;
  }

  // ─── Full Menu Tree ───────────────────────────────────────

  async getMenuTree(slug: string, locale: LocaleKey = 'en') {
    const cacheKey = `public:menu-tree:${slug}:${locale}`;
    const cached = await this.cache.get<object[]>(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Restaurant not found');

    const now = new Date();

    const menus = await this.prisma.menu.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        schedules: { where: { isActive: true } },
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            items: {
              where: { status: 'PUBLISHED' },
              orderBy: { sortOrder: 'asc' },
              include: { schedules: { where: { isActive: true } } },
            },
          },
        },
      },
    });

    const activeMenus = menus.filter((m) => isScheduleActive(m.schedules, now));

    const result = activeMenus.map((menu) => ({
      ...localize(menu, locale, ['name', 'description']),
      schedules: undefined,
      categories: menu.categories.map((cat) => ({
        ...localize(cat, locale, ['name', 'description']),
        items: cat.items
          .filter((item) => isScheduleActive(item.schedules, now))
          .map((item) => ({
            ...localize(item, locale, ['name', 'description']),
            price: parseFloat(item.price.toString()),
            schedules: undefined,
          })),
      })),
    }));

    await this.cache.set(cacheKey, result, 60_000); // 1 min – live schedule data
    return result;
  }

  // ─── Single Item ──────────────────────────────────────────

  async getItem(slug: string, itemId: string, locale: LocaleKey = 'en') {
    const cacheKey = `public:item:${slug}:${itemId}:${locale}`;
    const cached = await this.cache.get<object>(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Restaurant not found');

    const item = await this.prisma.item.findFirst({
      where: { id: itemId, tenantId: tenant.id, status: 'PUBLISHED' },
      include: {
        schedules: { where: { isActive: true } },
        category: {
          select: {
            id: true, name_en: true, name_es: true,
            menu: { select: { id: true, name_en: true, name_es: true } },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Item not found');

    const result = {
      ...localize(item, locale, ['name', 'description']),
      price: parseFloat(item.price.toString()),
      category: localize(item.category, locale, ['name']),
      schedules: undefined,
    };

    await this.cache.set(cacheKey, result, 120_000); // 2 min
    return result;
  }

  // ─── Search ───────────────────────────────────────────────

  async search(slug: string, query: string, locale: LocaleKey = 'en') {
    if (!query?.trim()) return [];

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Restaurant not found');

    const items = await this.prisma.item.findMany({
      where: {
        tenantId: tenant.id,
        status: 'PUBLISHED',
        OR: [
          { name_en: { contains: query, mode: 'insensitive' } },
          { name_es: { contains: query, mode: 'insensitive' } },
          { description_en: { contains: query, mode: 'insensitive' } },
          { description_es: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 30,
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
      include: {
        category: {
          select: {
            id: true, name_en: true, name_es: true,
            menu: { select: { id: true, name_en: true, name_es: true } },
          },
        },
      },
    });

    return items.map((item) => ({
      ...localize(item, locale, ['name', 'description']),
      price: parseFloat(item.price.toString()),
      category: localize(item.category, locale, ['name']),
    }));
  }

  // ─── Featured Items ───────────────────────────────────────

  async getFeatured(slug: string, locale: LocaleKey = 'en', limit = 12) {
    const cacheKey = `public:featured:${slug}:${locale}:${limit}`;
    const cached = await this.cache.get<object[]>(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Restaurant not found');

    const items = await this.prisma.item.findMany({
      where: { tenantId: tenant.id, status: 'PUBLISHED', isFeatured: true },
      orderBy: { sortOrder: 'asc' },
      take: Math.min(limit, 50),
      include: {
        category: { select: { id: true, name_en: true, name_es: true } },
      },
    });

    const result = items.map((item) => ({
      ...localize(item, locale, ['name', 'description']),
      price: parseFloat(item.price.toString()),
      category: localize(item.category, locale, ['name']),
    }));

    await this.cache.set(cacheKey, result, 120_000);
    return result;
  }
}
