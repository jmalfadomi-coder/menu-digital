import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PublicService } from './public.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockTenant = {
  id: 'tenant-1',
  slug: 'my-restaurant',
  name_en: 'My Restaurant',
  name_es: 'Mi Restaurante',
  email: 'hello@restaurant.com',
  phone: null,
  website: null,
  address: null,
  city: null,
  state: null,
  country: null,
  logoUrl: null,
  faviconUrl: null,
  bannerUrl: null,
  primaryColor: '#000',
  accentColor: '#fff',
  backgroundColor: '#f8f8f8',
  fontFamily: null,
  heroMediaUrl: null,
  heroMediaType: null,
  heroTitle_en: 'Welcome',
  heroTitle_es: 'Bienvenido',
  heroSubtitle_en: null,
  heroSubtitle_es: null,
  metaTitle_en: 'My Restaurant',
  metaTitle_es: 'Mi Restaurante',
  metaDescription_en: null,
  metaDescription_es: null,
  themeSettings: null,
  defaultLocale: 'en',
  supportedLocales: ['en', 'es'],
};

const mockItem = {
  id: 'item-1',
  tenantId: 'tenant-1',
  name_en: 'Burger',
  name_es: 'Hamburguesa',
  description_en: 'A tasty burger',
  description_es: 'Una rica hamburguesa',
  price: { toString: () => '9.99' },
  isFeatured: true,
  isSoldOut: false,
  status: 'PUBLISHED',
  sortOrder: 0,
  schedules: [],
  category: {
    id: 'cat-1',
    name_en: 'Mains',
    name_es: 'Principales',
    menu: { id: 'menu-1', name_en: 'Lunch', name_es: 'Almuerzo' },
  },
};

const mockMenu = {
  id: 'menu-1',
  tenantId: 'tenant-1',
  name_en: 'Lunch',
  name_es: 'Almuerzo',
  description_en: null,
  description_es: null,
  isActive: true,
  sortOrder: 0,
  schedules: [],
  categories: [
    {
      id: 'cat-1',
      name_en: 'Mains',
      name_es: 'Principales',
      description_en: null,
      description_es: null,
      isActive: true,
      sortOrder: 0,
      items: [mockItem],
    },
  ],
};

const mockPrisma = {
  tenant: { findUnique: jest.fn() },
  item: { findFirst: jest.fn(), findMany: jest.fn() },
  menu: { findMany: jest.fn() },
};

const mockCache = {
  get: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockResolvedValue(undefined),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('PublicService', () => {
  let service: PublicService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = module.get<PublicService>(PublicService);
  });

  // ─── getRestaurant ───────────────────────────────────────────────────────────

  describe('getRestaurant', () => {
    it('returns restaurant profile localized in English', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const result: any = await service.getRestaurant('my-restaurant', 'en');
      expect(result.name).toBe('My Restaurant');
      expect(result.heroTitle).toBe('Welcome');
      expect(result['name_en']).toBeUndefined();
    });

    it('returns restaurant profile localized in Spanish', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const result: any = await service.getRestaurant('my-restaurant', 'es');
      expect(result.name).toBe('Mi Restaurante');
      expect(result.heroTitle).toBe('Bienvenido');
    });

    it('throws 404 when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.getRestaurant('unknown')).rejects.toThrow(NotFoundException);
    });

    it('returns cached result on second call', async () => {
      const cached = { id: 'cached' };
      mockCache.get.mockResolvedValue(cached);

      const result = await service.getRestaurant('my-restaurant');
      expect(result).toBe(cached);
      expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
    });

    it('caches the result after DB fetch', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

      await service.getRestaurant('my-restaurant');
      expect(mockCache.set).toHaveBeenCalledWith(
        'public:restaurant:my-restaurant:en',
        expect.any(Object),
        300_000,
      );
    });
  });

  // ─── getMenuTree ─────────────────────────────────────────────────────────────

  describe('getMenuTree', () => {
    it('throws 404 when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.getMenuTree('unknown')).rejects.toThrow(NotFoundException);
    });

    it('returns menus with localized names', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.menu.findMany.mockResolvedValue([mockMenu]);

      const result: any[] = await service.getMenuTree('my-restaurant', 'en');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Lunch');
      expect(result[0].categories[0].items[0].name).toBe('Burger');
    });

    it('returns Spanish localization', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.menu.findMany.mockResolvedValue([mockMenu]);

      const result: any[] = await service.getMenuTree('my-restaurant', 'es');
      expect(result[0].name).toBe('Almuerzo');
      expect(result[0].categories[0].items[0].name).toBe('Hamburguesa');
    });

    it('strips _en/_es keys from output', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.menu.findMany.mockResolvedValue([mockMenu]);

      const result: any[] = await service.getMenuTree('my-restaurant', 'en');
      expect(result[0]['name_en']).toBeUndefined();
      expect(result[0]['name_es']).toBeUndefined();
    });

    it('parses item price as float', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.menu.findMany.mockResolvedValue([mockMenu]);

      const result: any[] = await service.getMenuTree('my-restaurant', 'en');
      expect(typeof result[0].categories[0].items[0].price).toBe('number');
      expect(result[0].categories[0].items[0].price).toBe(9.99);
    });

    it('filters out menus with inactive schedules', async () => {
      // A menu with a schedule that never matches (past date range)
      const menuWithExpiredSchedule = {
        ...mockMenu,
        schedules: [{ isActive: true, startDate: new Date('2020-01-01'), endDate: new Date('2020-12-31'), dayOfWeek: null, startTime: null, endTime: null }],
      };
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.menu.findMany.mockResolvedValue([menuWithExpiredSchedule]);

      const result: any[] = await service.getMenuTree('my-restaurant', 'en');
      expect(result).toHaveLength(0);
    });

    it('returns cached result on second call', async () => {
      const cached = [{ id: 'cached-menu' }];
      mockCache.get.mockResolvedValue(cached);

      const result = await service.getMenuTree('my-restaurant');
      expect(result).toBe(cached);
      expect(mockPrisma.menu.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── getItem ─────────────────────────────────────────────────────────────────

  describe('getItem', () => {
    const itemWithCategory = {
      ...mockItem,
      schedules: [],
      category: { id: 'cat-1', name_en: 'Mains', name_es: 'Principales', menu: { id: 'menu-1', name_en: 'Lunch', name_es: 'Almuerzo' } },
    };

    it('throws 404 when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.getItem('unknown', 'item-1')).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when item not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.item.findFirst.mockResolvedValue(null);
      await expect(service.getItem('my-restaurant', 'item-1')).rejects.toThrow(NotFoundException);
    });

    it('returns item with localized fields', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.item.findFirst.mockResolvedValue(itemWithCategory);

      const result: any = await service.getItem('my-restaurant', 'item-1', 'es');
      expect(result.name).toBe('Hamburguesa');
      expect(result.description).toBe('Una rica hamburguesa');
      expect(result.category.name).toBe('Principales');
    });

    it('parses price as float', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.item.findFirst.mockResolvedValue(itemWithCategory);

      const result: any = await service.getItem('my-restaurant', 'item-1', 'en');
      expect(typeof result.price).toBe('number');
    });
  });

  // ─── search ──────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('returns empty array for blank query', async () => {
      const result = await service.search('my-restaurant', '   ');
      expect(result).toEqual([]);
      expect(mockPrisma.item.findMany).not.toHaveBeenCalled();
    });

    it('throws 404 when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.search('unknown', 'burger')).rejects.toThrow(NotFoundException);
    });

    it('returns matching items localized', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.item.findMany.mockResolvedValue([mockItem]);

      const result: any[] = await service.search('my-restaurant', 'burger', 'en');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Burger');
    });

    it('does not cache search results', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.item.findMany.mockResolvedValue([]);

      await service.search('my-restaurant', 'pizza');
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  // ─── getFeatured ─────────────────────────────────────────────────────────────

  describe('getFeatured', () => {
    it('throws 404 when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.getFeatured('unknown')).rejects.toThrow(NotFoundException);
    });

    it('returns featured items localized', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.item.findMany.mockResolvedValue([mockItem]);

      const result: any[] = await service.getFeatured('my-restaurant', 'en');
      expect(result).toHaveLength(1);
      expect(result[0].isFeatured).toBe(true);
    });

    it('caps limit at 50', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      mockPrisma.item.findMany.mockResolvedValue([]);

      await service.getFeatured('my-restaurant', 'en', 200);
      expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('returns cached result on second call', async () => {
      const cached = [{ id: 'cached-item' }];
      mockCache.get.mockResolvedValue(cached);

      const result = await service.getFeatured('my-restaurant');
      expect(result).toBe(cached);
      expect(mockPrisma.item.findMany).not.toHaveBeenCalled();
    });
  });
});
