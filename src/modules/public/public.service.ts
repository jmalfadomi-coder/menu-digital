import { Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { Locale } from '@prisma/client';

type LocaleKey = 'en' | 'es';

/** Translate a bilingual record into a locale-specific flat object */
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
    // Remove raw bilingual keys
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

  // ─── Restaurant Info ──────────────────────────────────────

  async getRestaurant(slug: string, locale: LocaleKey = 'en') {
    const cacheKey = `public:restaurant:${slug}:${locale}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true,
        slug: true,
        name_en: true,
        name_es: true,
        email: true,
        phone: true,
        website: true,
        address: true,
        city: true,
        state: true,
        country: true,
        logoUrl: true,
        faviconUrl: true,
        bannerUrl: true,
        primaryColor: true,
        accentColor: true,
        backgroundColor: true,
        fontFamily: true,
        heroMediaUrl: true,
        heroMediaType: true,
        heroTitle_en: true,
        heroTitle_es: true,
        heroSubtitle_en: true,
        heroSubtitle_es: true,
        metaTitle_en: true,
        metaTitle_es: true,
        metaDescription_en: true,
        metaDescription_es: true,
        themeSettings: true,
        defaultLocale: true,
        supportedLocales: true,
      },
    });

    if (!tenant) throw new NotFoundException('Restaurant not found');

    const result = localize(tenant, locale, [
      'name',
      'heroTitle',
      'heroSubtitle',
      'metaTitle',
      'metaDescription',
    ]);

    await this.cache.set(cacheKey, result, 300); // 5 min
    return result;
  }

  // ─── Full Menu Tree ───────────────────────────────────────

  async getMenuTree(slug: string, locale: LocaleKey = 'en') {
    const cacheKey = `public:menu-tree:${slug}:${locale}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Restaurant not found');

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

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

    // Filter menus by schedule
    const activeMenus = menus.filter((menu) =>
      this.isAvailable(menu.schedules, currentDay, currentTime, now),
    );

    // Localize and clean up
    const result = activeMenus.map((menu) => ({
      ...localize(menu, locale, ['name', 'description']),
      schedules: undefined,
      categories: menu.categories.map((cat) => ({
        ...localize(cat, locale, ['name', 'description']),
        items: cat.items
          .filter((item) =>
            this.isAvailable(item.schedules, currentDay, currentTime, now),
          )
          .map((item) => ({
            ...localize(item, locale, ['name', 'description']),
            price: parseFloat(item.price.toString()),
            schedules: undefined,
          })),
      })),
    }));

    await this.cache.set(cacheKey, result, 60); // 1 min for live data
    return result;
  }

  // ─── Single Item ──────────────────────────────────────────

  async getItem(slug: string, itemId: string, locale: LocaleKey = 'en') {
    const cacheKey = `public:item:${slug}:${itemId}:${locale}`;
    const cached = await this.cache.get(cacheKey);
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
        category: { select: { id: true, name_en: true, name_es: true } },
      },
    });
    if (!item) throw new NotFoundException('Item not found');

    const result = {
      ...localize(item, locale, ['name', 'description']),
      price: parseFloat(item.price.toString()),
      category: localize(item.category, locale, ['name']),
      schedules: undefined,
    };

    await this.cache.set(cacheKey, result, 120);
    return result;
  }

  // ─── Search ───────────────────────────────────────────────

  async search(slug: string, query: string, locale: LocaleKey = 'en') {
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
        category: { select: { id: true, name_en: true, name_es: true } },
      },
    });

    return items.map((item) => ({
      ...localize(item, locale, ['name', 'description']),
      price: parseFloat(item.price.toString()),
      category: localize(item.category, locale, ['name']),
    }));
  }

  // ─── Schedule helper ──────────────────────────────────────

  private isAvailable(
    schedules: any[],
    currentDay: number,
    currentTime: string,
    now: Date,
  ): boolean {
    if (!schedules || schedules.length === 0) return true;

    return schedules.some((s) => {
      if (s.startDate && now < new Date(s.startDate)) return false;
      if (s.endDate && now > new Date(s.endDate)) return false;
      if (s.dayOfWeek !== null && s.dayOfWeek !== undefined && s.dayOfWeek !== currentDay) {
        return false;
      }
      if (s.startTime && currentTime < s.startTime) return false;
      if (s.endTime && currentTime > s.endTime) return false;
      return true;
    });
  }
}
