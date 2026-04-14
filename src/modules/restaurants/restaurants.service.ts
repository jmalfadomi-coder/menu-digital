import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { getPrismaSkipTake, paginate } from '../../common/types/pagination.types';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { Role, TenantRole } from '@prisma/client';
import { uniqueSlug } from '../../common/utils/slug.util';
import { CacheInvalidationService } from '../../common/cache/cache-invalidation.service';

@Injectable()
export class RestaurantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  // ─── Create ───────────────────────────────────────────────

  async create(dto: CreateRestaurantDto) {
    // Auto-generate slug from name if not provided
    const slug = dto.slug
      ? await this.assertSlugFree(dto.slug)
      : await uniqueSlug(dto.name_en, (s) =>
          this.prisma.tenant.findUnique({ where: { slug: s } }).then(Boolean),
        );

    return this.prisma.tenant.create({ data: { ...dto, slug } });
  }

  // ─── List (admin) ─────────────────────────────────────────

  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    isActive?: boolean,
  ) {
    const { skip, take } = getPrismaSkipTake(page, limit);
    const where: any = {};
    if (search) {
      where.OR = [
        { name_en: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) where.isActive = isActive;

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

  // ─── My restaurants (current user) ───────────────────────

  async findMine(userId: string) {
    const memberships = await this.prisma.userTenant.findMany({
      where: { userId },
      include: {
        tenant: { select: this.listSelect() },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      ...m.tenant,
      tenantRole: m.role,
    }));
  }

  // ─── Single ───────────────────────────────────────────────

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

  // ─── Update ───────────────────────────────────────────────

  async update(id: string, dto: UpdateRestaurantDto, user: JwtPayload) {
    const restaurant = await this.findOne(id, user);
    const updated = await this.prisma.tenant.update({
      where: { id: restaurant.id },
      data: dto,
    });
    await this.cacheInvalidation.invalidateBySlug(restaurant.slug);
    return updated;
  }

  // ─── Delete ───────────────────────────────────────────────

  async remove(id: string) {
    const exists = await this.prisma.tenant.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Restaurant not found');
    await this.prisma.tenant.delete({ where: { id } });
    return { message: 'Restaurant deleted' };
  }

  async toggleActive(id: string, isActive: boolean) {
    return this.prisma.tenant.update({ where: { id }, data: { isActive } });
  }

  // ─── Staff management ─────────────────────────────────────

  /**
   * List all users assigned to a specific tenant (for restaurant owners/managers).
   */
  async getStaff(tenantId: string, page = 1, limit = 50) {
    const { skip, take } = getPrismaSkipTake(page, limit);

    const [data, total] = await Promise.all([
      this.prisma.userTenant.findMany({
        where: { tenantId },
        skip,
        take,
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              isActive: true,
              lastLoginAt: true,
            },
          },
        },
      }),
      this.prisma.userTenant.count({ where: { tenantId } }),
    ]);

    return paginate(
      data.map((ut) => ({ ...ut.user, tenantRole: ut.role })),
      total,
      page,
      limit,
    );
  }

  async removeStaff(tenantId: string, userId: string, requestingUserId: string) {
    if (userId === requestingUserId) {
      throw new ForbiddenException('You cannot remove yourself from the restaurant');
    }
    await this.prisma.userTenant.deleteMany({ where: { tenantId, userId } });
    return { message: 'Staff member removed' };
  }

  // ─── Helpers ──────────────────────────────────────────────

  private assertAccess(restaurant: any, user: JwtPayload) {
    if ([Role.SUPER_ADMIN, Role.AGENCY_ADMIN].includes(user.role as Role)) return;

    const membership = restaurant.userTenants?.[0];
    if (!membership) {
      throw new ForbiddenException('You do not have access to this restaurant');
    }
  }

  private async assertSlugFree(slug: string): Promise<string> {
    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Slug "${slug}" is already taken`);
    return slug;
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
      isVerified: true,
      createdAt: true,
      _count: { select: { menus: true } },
    } as const;
  }
}
