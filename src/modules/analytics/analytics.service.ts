import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAnalyticsEventDto } from './dto/create-event.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Event Intake ─────────────────────────────────────────

  async ingest(
    tenantId: string,
    dto: CreateAnalyticsEventDto,
    ipAddress?: string,
    userAgent?: string,
    referrer?: string,
  ) {
    // Fire-and-forget: never block the caller
    this.prisma.analyticsEvent
      .create({
        data: {
          tenantId,
          eventType: dto.eventType,
          resourceType: dto.resourceType,
          resourceId: dto.resourceId,
          sessionId: dto.sessionId,
          visitorId: dto.visitorId,
          locale: dto.locale,
          metadata: dto.metadata as any,
          ipAddress,
          userAgent,
          referrer,
        },
      })
      .catch(() => {});

    return { received: true };
  }

  // ─── Summary ──────────────────────────────────────────────

  async getSummary(tenantId: string, days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalEvents, eventsByType, uniqueVisitors] = await Promise.all([
      this.prisma.analyticsEvent.count({
        where: { tenantId, createdAt: { gte: since } },
      }),

      this.prisma.analyticsEvent.groupBy({
        by: ['eventType'],
        where: { tenantId, createdAt: { gte: since } },
        _count: { eventType: true },
        orderBy: { _count: { eventType: 'desc' } },
      }),

      // Unique visitor IDs (non-null)
      this.prisma.analyticsEvent.findMany({
        where: {
          tenantId,
          createdAt: { gte: since },
          visitorId: { not: null },
        },
        select: { visitorId: true },
        distinct: ['visitorId'],
      }),
    ]);

    // Top viewed items — resourceId is non-null; use raw query to avoid
    // Prisma groupBy limitations on nullable columns
    const topItemsRaw: Array<{ resourceId: string; views: bigint }> =
      await this.prisma.$queryRaw`
        SELECT "resourceId", COUNT(*) AS views
        FROM "AnalyticsEvent"
        WHERE "tenantId" = ${tenantId}
          AND "resourceType" = 'item'
          AND "resourceId" IS NOT NULL
          AND "createdAt" >= ${since}
        GROUP BY "resourceId"
        ORDER BY views DESC
        LIMIT 10
      `;

    // Resolve names for top items
    const itemIds = topItemsRaw.map((r) => r.resourceId);
    const items = itemIds.length
      ? await this.prisma.item.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, name_en: true, name_es: true, price: true },
        })
      : [];

    const nameMap = Object.fromEntries(items.map((i) => [i.id, i]));

    // Daily event counts over the period (raw SQL for simplicity)
    const dailyRaw: Array<{ day: Date; count: bigint }> =
      await this.prisma.$queryRaw`
        SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS count
        FROM "AnalyticsEvent"
        WHERE "tenantId" = ${tenantId}
          AND "createdAt" >= ${since}
        GROUP BY day
        ORDER BY day ASC
      `;

    return {
      period: { days, since: since.toISOString() },
      totalEvents,
      uniqueVisitors: uniqueVisitors.length,
      eventsByType: eventsByType.map((e) => ({
        eventType: e.eventType,
        count: e._count.eventType,
      })),
      topItems: topItemsRaw.map((r) => ({
        itemId: r.resourceId,
        name_en: nameMap[r.resourceId]?.name_en ?? null,
        name_es: nameMap[r.resourceId]?.name_es ?? null,
        price: nameMap[r.resourceId]?.price
          ? parseFloat(nameMap[r.resourceId].price.toString())
          : null,
        views: Number(r.views),
      })),
      dailyBreakdown: dailyRaw.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        count: Number(r.count),
      })),
    };
  }
}
