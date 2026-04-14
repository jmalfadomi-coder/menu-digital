import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ItemStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Platform-wide stats (Super/Agency Admin) ─────────────

  async getPlatformStats() {
    const [
      totalTenants,
      activeTenants,
      totalUsers,
      activeUsers,
      totalMenus,
      totalItems,
      publishedItems,
      planBreakdown,
      recentTenants,
      recentUsers,
      eventsLast24h,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.menu.count(),
      this.prisma.item.count(),
      this.prisma.item.count({ where: { status: ItemStatus.PUBLISHED } }),

      // Tenant plan distribution
      this.prisma.tenant.groupBy({
        by: ['plan'],
        _count: { plan: true },
        orderBy: { _count: { plan: 'desc' } },
      }),

      // 5 most recently created tenants
      this.prisma.tenant.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          slug: true,
          name_en: true,
          plan: true,
          isActive: true,
          createdAt: true,
        },
      }),

      // 5 most recently created users
      this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      }),

      // Analytics events in the last 24 hours
      this.prisma.analyticsEvent.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 86_400_000) },
        },
      }),
    ]);

    return {
      tenants: { total: totalTenants, active: activeTenants },
      users: { total: totalUsers, active: activeUsers },
      content: {
        menus: totalMenus,
        items: { total: totalItems, published: publishedItems },
      },
      analytics: { eventsLast24h },
      planBreakdown: planBreakdown.map((p) => ({
        plan: p.plan,
        count: p._count.plan,
      })),
      recent: { tenants: recentTenants, users: recentUsers },
    };
  }

  // ─── Per-tenant stats (Restaurant Owner / Manager) ────────

  async getTenantStats(tenantId: string) {
    const since7d = new Date(Date.now() - 7 * 86_400_000);
    const since30d = new Date(Date.now() - 30 * 86_400_000);

    const [
      menuCount,
      activeMenuCount,
      categoryCount,
      itemCount,
      publishedItemCount,
      featuredItemCount,
      soldOutItemCount,
      staffCount,
      mediaCount,
      auditLogCount,
      events7d,
      events30d,
      topEventTypes,
      topViewedItems,
    ] = await Promise.all([
      this.prisma.menu.count({ where: { tenantId } }),
      this.prisma.menu.count({ where: { tenantId, isActive: true } }),
      this.prisma.category.count({ where: { tenantId } }),
      this.prisma.item.count({ where: { tenantId } }),
      this.prisma.item.count({ where: { tenantId, status: ItemStatus.PUBLISHED } }),
      this.prisma.item.count({ where: { tenantId, isFeatured: true } }),
      this.prisma.item.count({ where: { tenantId, isSoldOut: true } }),
      this.prisma.userTenant.count({ where: { tenantId } }),
      this.prisma.mediaAsset.count({ where: { tenantId } }),
      this.prisma.auditLog.count({ where: { tenantId } }),

      // Analytics counts
      this.prisma.analyticsEvent.count({
        where: { tenantId, createdAt: { gte: since7d } },
      }),
      this.prisma.analyticsEvent.count({
        where: { tenantId, createdAt: { gte: since30d } },
      }),

      // Event breakdown by type (last 7d)
      this.prisma.analyticsEvent.groupBy({
        by: ['eventType'],
        where: { tenantId, createdAt: { gte: since7d } },
        _count: { eventType: true },
        orderBy: { _count: { eventType: 'desc' } },
        take: 10,
      }),

      // Top viewed items (last 7d)
      this.prisma.analyticsEvent.groupBy({
        by: ['resourceId'],
        where: {
          tenantId,
          resourceType: 'item',
          eventType: 'item_view',
          resourceId: { not: null },
          createdAt: { gte: since7d },
        },
        _count: { resourceId: true },
        orderBy: { _count: { resourceId: 'desc' } },
        take: 10,
      }),
    ]);

    // Resolve item names for topViewedItems
    const itemIds = topViewedItems
      .map((t) => t.resourceId)
      .filter(Boolean) as string[];

    const itemNames = await this.prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name_en: true, name_es: true },
    });

    const nameMap = Object.fromEntries(itemNames.map((i) => [i.id, i]));

    return {
      content: {
        menus: { total: menuCount, active: activeMenuCount },
        categories: categoryCount,
        items: {
          total: itemCount,
          published: publishedItemCount,
          featured: featuredItemCount,
          soldOut: soldOutItemCount,
          draft: itemCount - publishedItemCount,
        },
      },
      team: { staffCount },
      media: { assetCount: mediaCount },
      audit: { logCount: auditLogCount },
      analytics: {
        events7d,
        events30d,
        topEventTypes: topEventTypes.map((e) => ({
          eventType: e.eventType,
          count: e._count.eventType,
        })),
        topViewedItems: topViewedItems.map((t) => ({
          itemId: t.resourceId,
          name_en: nameMap[t.resourceId!]?.name_en ?? null,
          name_es: nameMap[t.resourceId!]?.name_es ?? null,
          views: t._count.resourceId,
        })),
      },
    };
  }
}
