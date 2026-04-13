import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { getPrismaSkipTake, paginate } from '../../common/types/pagination.types';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRestaurantDto) {
    return this.prisma.tenant.create({ data: dto });
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const { skip, take } = getPrismaSkipTake(page, limit);
    const where = search
      ? {
          OR: [
            { name_en: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
            { city: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: this.listSelect(),
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string, user: JwtPayload) {
    const restaurant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        userTenants: {
          where: { userId: user.sub },
          select: { role: true },
        },
      },
    });

    if (!restaurant) throw new NotFoundException('Restaurant not found');

    this.assertAccess(restaurant, user);
    return restaurant;
  }

  async findBySlug(slug: string) {
    const restaurant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }

  async update(id: string, dto: UpdateRestaurantDto, user: JwtPayload) {
    const restaurant = await this.findOne(id, user);
    return this.prisma.tenant.update({ where: { id: restaurant.id }, data: dto });
  }

  async remove(id: string) {
    const exists = await this.prisma.tenant.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Restaurant not found');
    await this.prisma.tenant.delete({ where: { id } });
    return { message: 'Restaurant deleted' };
  }

  async toggleActive(id: string, isActive: boolean) {
    return this.prisma.tenant.update({ where: { id }, data: { isActive } });
  }

  // ─── Helpers ──────────────────────────────────────────────

  private assertAccess(
    restaurant: any,
    user: JwtPayload,
  ) {
    if ([Role.SUPER_ADMIN, Role.AGENCY_ADMIN].includes(user.role as Role)) return;

    const membership = restaurant.userTenants?.[0];
    if (!membership) {
      throw new ForbiddenException('You do not have access to this restaurant');
    }
  }

  private listSelect() {
    return {
      id: true,
      slug: true,
      name_en: true,
      name_es: true,
      logoUrl: true,
      city: true,
      country: true,
      plan: true,
      isActive: true,
      createdAt: true,
      _count: { select: { menus: true } },
    };
  }
}
