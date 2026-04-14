import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { getPrismaSkipTake, paginate } from '../../common/types/pagination.types';
import { CacheInvalidationService } from '../../common/cache/cache-invalidation.service';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  async create(tenantId: string, dto: CreateCategoryDto) {
    // Verify menu belongs to tenant
    const menu = await this.prisma.menu.findFirst({
      where: { id: dto.menuId, tenantId },
    });
    if (!menu) throw new BadRequestException('Menu not found in this tenant');

    const category = await this.prisma.category.create({
      data: { ...dto, tenantId },
    });
    await this.cacheInvalidation.invalidateByTenantId(tenantId);
    return category;
  }

  async findAll(tenantId: string, menuId?: string, page = 1, limit = 50) {
    const { skip, take } = getPrismaSkipTake(page, limit);
    const where = { tenantId, ...(menuId ? { menuId } : {}) };

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { _count: { select: { items: true } } },
      }),
      this.prisma.category.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string, tenantId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          where: { status: 'PUBLISHED' },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: string, tenantId: string, dto: UpdateCategoryDto) {
    await this.findOne(id, tenantId);
    const category = await this.prisma.category.update({ where: { id }, data: dto });
    await this.cacheInvalidation.invalidateByTenantId(tenantId);
    return category;
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.category.delete({ where: { id } });
    await this.cacheInvalidation.invalidateByTenantId(tenantId);
    return { message: 'Category deleted' };
  }

  async reorder(tenantId: string, menuId: string, orderedIds: string[]) {
    const updates = orderedIds.map((id, index) =>
      this.prisma.category.updateMany({
        where: { id, tenantId, menuId },
        data: { sortOrder: index },
      }),
    );
    await Promise.all(updates);
    await this.cacheInvalidation.invalidateByTenantId(tenantId);
    return { message: 'Sort order updated' };
  }
}
