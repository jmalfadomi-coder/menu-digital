import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { getPrismaSkipTake, paginate } from '../../common/types/pagination.types';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateMenuDto) {
    const { schedules, ...menuData } = dto;

    return this.prisma.menu.create({
      data: {
        ...menuData,
        tenantId,
        schedules: schedules
          ? { createMany: { data: schedules } }
          : undefined,
      },
      include: { schedules: true, _count: { select: { categories: true } } },
    });
  }

  async findAll(tenantId: string, page = 1, limit = 20) {
    const { skip, take } = getPrismaSkipTake(page, limit);

    const [data, total] = await Promise.all([
      this.prisma.menu.findMany({
        where: { tenantId },
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          schedules: true,
          _count: { select: { categories: true } },
        },
      }),
      this.prisma.menu.count({ where: { tenantId } }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string, tenantId: string) {
    const menu = await this.prisma.menu.findFirst({
      where: { id, tenantId },
      include: {
        schedules: true,
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: { _count: { select: { items: true } } },
        },
      },
    });
    if (!menu) throw new NotFoundException('Menu not found');
    return menu;
  }

  async update(id: string, tenantId: string, dto: UpdateMenuDto) {
    await this.findOne(id, tenantId);
    const { schedules, ...menuData } = dto;

    return this.prisma.menu.update({
      where: { id },
      data: {
        ...menuData,
        ...(schedules !== undefined && {
          schedules: {
            deleteMany: {},
            createMany: { data: schedules },
          },
        }),
      },
      include: { schedules: true },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.menu.delete({ where: { id } });
    return { message: 'Menu deleted' };
  }

  async publish(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.menu.update({
      where: { id },
      data: { isActive: true, publishedAt: new Date() },
    });
  }

  async unpublish(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.menu.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
