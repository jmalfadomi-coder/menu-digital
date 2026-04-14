import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ItemsService } from './items.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ItemStatus } from '@prisma/client';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT = 'tenant-1';
const ITEM_ID = 'item-1';
const CAT_ID = 'cat-1';

const mockCategory = { id: CAT_ID, tenantId: TENANT };

const mockItem = {
  id: ITEM_ID,
  tenantId: TENANT,
  categoryId: CAT_ID,
  name_en: 'Burger',
  name_es: 'Hamburguesa',
  description_en: null,
  description_es: null,
  price: '9.99',
  status: ItemStatus.DRAFT,
  isFeatured: false,
  isSoldOut: false,
  sortOrder: 0,
  schedules: [],
  category: { id: CAT_ID, name_en: 'Mains' },
};

const mockPrisma = {
  category: { findFirst: jest.fn() },
  item: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ItemsService', () => {
  let service: ItemsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ItemsService>(ItemsService);
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      name_en: 'Burger',
      price: 9.99,
      categoryId: CAT_ID,
      status: ItemStatus.DRAFT,
    };

    it('throws 400 when category does not belong to tenant', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(null);
      await expect(service.create(TENANT, dto as any)).rejects.toThrow(BadRequestException);
    });

    it('creates item and returns it with schedules', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(mockCategory);
      mockPrisma.item.create.mockResolvedValue(mockItem);

      const result = await service.create(TENANT, dto as any);
      expect(result).toEqual(mockItem);
      expect(mockPrisma.item.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: TENANT }),
          include: { schedules: true },
        }),
      );
    });

    it('creates item with schedules when provided', async () => {
      const dtoWithSchedules = { ...dto, schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }] };
      mockPrisma.category.findFirst.mockResolvedValue(mockCategory);
      mockPrisma.item.create.mockResolvedValue({ ...mockItem, schedules: dtoWithSchedules.schedules });

      await service.create(TENANT, dtoWithSchedules as any);
      expect(mockPrisma.item.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedules: { createMany: { data: dtoWithSchedules.schedules } },
          }),
        }),
      );
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated results with defaults', async () => {
      mockPrisma.item.findMany.mockResolvedValue([mockItem]);
      mockPrisma.item.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('applies categoryId filter', async () => {
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.item.count.mockResolvedValue(0);

      await service.findAll(TENANT, { categoryId: CAT_ID });
      expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: CAT_ID }),
        }),
      );
    });

    it('applies status filter', async () => {
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.item.count.mockResolvedValue(0);

      await service.findAll(TENANT, { status: ItemStatus.PUBLISHED });
      expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ItemStatus.PUBLISHED }),
        }),
      );
    });

    it('applies search filter with OR clause', async () => {
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.item.count.mockResolvedValue(0);

      await service.findAll(TENANT, { search: 'burger' });
      const callArg = mockPrisma.item.findMany.mock.calls[0][0];
      expect(callArg.where.OR).toBeDefined();
      expect(callArg.where.OR).toHaveLength(2);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws 404 when item not found', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(null);
      await expect(service.findOne(ITEM_ID, TENANT)).rejects.toThrow(NotFoundException);
    });

    it('returns item with category and schedules', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(mockItem);
      const result = await service.findOne(ITEM_ID, TENANT);
      expect(result.id).toBe(ITEM_ID);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws 404 when item not found', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(null);
      await expect(service.update(ITEM_ID, TENANT, { name_en: 'New' } as any)).rejects.toThrow(NotFoundException);
    });

    it('updates item fields', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(mockItem);
      mockPrisma.item.update.mockResolvedValue({ ...mockItem, name_en: 'New' });

      const result = await service.update(ITEM_ID, TENANT, { name_en: 'New' } as any);
      expect(result.name_en).toBe('New');
    });

    it('replaces schedules when provided in update', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(mockItem);
      mockPrisma.item.update.mockResolvedValue(mockItem);

      const newSchedules = [{ dayOfWeek: 2, startTime: '10:00', endTime: '20:00' }];
      await service.update(ITEM_ID, TENANT, { schedules: newSchedules } as any);

      expect(mockPrisma.item.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedules: { deleteMany: {}, createMany: { data: newSchedules } },
          }),
        }),
      );
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws 404 when item not found', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(null);
      await expect(service.remove(ITEM_ID, TENANT)).rejects.toThrow(NotFoundException);
    });

    it('deletes item and returns message', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(mockItem);
      mockPrisma.item.delete.mockResolvedValue(mockItem);

      const result = await service.remove(ITEM_ID, TENANT);
      expect(result.message).toBe('Item deleted');
      expect(mockPrisma.item.delete).toHaveBeenCalledWith({ where: { id: ITEM_ID } });
    });
  });

  // ─── publish / unpublish ─────────────────────────────────────────────────────

  describe('publish', () => {
    it('sets status to PUBLISHED and records publishedAt', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(mockItem);
      mockPrisma.item.update.mockResolvedValue({ ...mockItem, status: ItemStatus.PUBLISHED });

      await service.publish(ITEM_ID, TENANT);
      expect(mockPrisma.item.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ItemStatus.PUBLISHED,
            publishedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('unpublish', () => {
    it('sets status back to DRAFT', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(mockItem);
      mockPrisma.item.update.mockResolvedValue({ ...mockItem, status: ItemStatus.DRAFT });

      await service.unpublish(ITEM_ID, TENANT);
      expect(mockPrisma.item.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ItemStatus.DRAFT } }),
      );
    });
  });

  // ─── toggleSoldOut ───────────────────────────────────────────────────────────

  describe('toggleSoldOut', () => {
    it('sets isSoldOut to true', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(mockItem);
      mockPrisma.item.update.mockResolvedValue({ ...mockItem, isSoldOut: true });

      await service.toggleSoldOut(ITEM_ID, TENANT, true);
      expect(mockPrisma.item.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isSoldOut: true } }),
      );
    });

    it('sets isSoldOut to false', async () => {
      mockPrisma.item.findFirst.mockResolvedValue({ ...mockItem, isSoldOut: true });
      mockPrisma.item.update.mockResolvedValue({ ...mockItem, isSoldOut: false });

      await service.toggleSoldOut(ITEM_ID, TENANT, false);
      expect(mockPrisma.item.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isSoldOut: false } }),
      );
    });
  });

  // ─── reorder ─────────────────────────────────────────────────────────────────

  describe('reorder', () => {
    it('updates sort order for each item', async () => {
      mockPrisma.item.updateMany.mockResolvedValue({ count: 1 });

      const ids = ['item-a', 'item-b', 'item-c'];
      const result = await service.reorder(TENANT, CAT_ID, ids);

      expect(mockPrisma.item.updateMany).toHaveBeenCalledTimes(3);
      expect(mockPrisma.item.updateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ data: { sortOrder: 0 } }),
      );
      expect(mockPrisma.item.updateMany).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ data: { sortOrder: 2 } }),
      );
      expect(result.message).toBe('Sort order updated');
    });
  });
});
