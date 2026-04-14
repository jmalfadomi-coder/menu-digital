import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { getPrismaSkipTake, paginate } from '../../common/types/pagination.types';
import { ItemStatus } from '@prisma/client';
import { CacheInvalidationService } from '../../common/cache/cache-invalidation.service';

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  async create(tenantId: string, dto: CreateItemDto) {
    const { schedules, ...itemData } = dto;

    // Verify category belongs to tenant
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, tenantId },
    });
    if (!category) throw new BadRequestException('Category not found in this tenant');

    const item = await this.prisma.item.create({
      data: {
        ...itemData,
        tenantId,
        schedules: schedules ? { createMany: { data: schedules } } : undefined,
      },
      include: { schedules: true },
    });
    await this.cacheInvalidation.invalidateByTenantId(tenantId);
    return item;
  }

  async findAll(
    tenantId: string,
    filters: {
      categoryId?: string;
      status?: ItemStatus;
      isFeatured?: boolean;
      isSoldOut?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { categoryId, status, isFeatured, isSoldOut, search, page = 1, limit = 50 } = filters;
    const { skip, take } = getPrismaSkipTake(page, limit);

    const where: any = { tenantId };
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (isSoldOut !== undefined) where.isSoldOut = isSoldOut;
    if (search) {
      where.OR = [
        { name_en: { contains: search, mode: 'insensitive' } },
        { name_es: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { schedules: true },
      }),
      this.prisma.item.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string, tenantId: string) {
    const item = await this.prisma.item.findFirst({
      where: { id, tenantId },
      include: { schedules: true, category: { select: { id: true, name_en: true } } },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async update(id: string, tenantId: string, dto: UpdateItemDto) {
    await this.findOne(id, tenantId);
    const { schedules, ...itemData } = dto;

    const item = await this.prisma.item.update({
      where: { id },
      data: {
        ...itemData,
        ...(schedules !== undefined && {
          schedules: {
            deleteMany: {},
            createMany: { data: schedules },
          },
        }),
      },
      include: { schedules: true },
    });
    await this.cacheInvalidation.invalidateByTenantId(tenantId);
    return item;
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.item.delete({ where: { id } });
    await this.cacheInvalidation.invalidateByTenantId(tenantId);
    return { message: 'Item deleted' };
  }

  async publish(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    const item = await this.prisma.item.update({
      where: { id },
      data: { status: ItemStatus.PUBLISHED, publishedAt: new Date() },
    });
    await this.cacheInvalidation.invalidateByTenantId(tenantId);
    return item;
  }

  async unpublish(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    const item = await this.prisma.item.update({
      where: { id },
      data: { status: ItemStatus.DRAFT },
    });
    await this.cacheInvalidation.invalidateByTenantId(tenantId);
    return item;
  }

  async toggleSoldOut(id: string, tenantId: string, isSoldOut: boolean) {
    await this.findOne(id, tenantId);
    const item = await this.prisma.item.update({ where: { id }, data: { isSoldOut } });
    await this.cacheInvalidation.invalidateByTenantId(tenantId);
    return item;
  }

  async reorder(tenantId: string, categoryId: string, orderedIds: string[]) {
    const updates = orderedIds.map((id, index) =>
      this.prisma.item.updateMany({
        where: { id, tenantId, categoryId },
        data: { sortOrder: index },
      }),
    );
    await Promise.all(updates);
    await this.cacheInvalidation.invalidateByTenantId(tenantId);
    return { message: 'Sort order updated' };
  }
}
