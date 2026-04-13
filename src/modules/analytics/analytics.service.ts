import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAnalyticsEventDto } from './dto/create-event.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(
    tenantId: string,
    dto: CreateAnalyticsEventDto,
    ipAddress?: string,
    userAgent?: string,
    referrer?: string,
  ) {
    // Fire-and-forget insertion for non-blocking public API
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
          metadata: dto.metadata,
          ipAddress,
          userAgent,
          referrer,
        },
      })
      .catch(() => {}); // never block the caller

    return { received: true };
  }

  async getSummary(tenantId: string, days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalEvents, eventsByType, topItems] = await Promise.all([
      this.prisma.analyticsEvent.count({
        where: { tenantId, createdAt: { gte: since } },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['eventType'],
        where: { tenantId, createdAt: { gte: since } },
        _count: true,
        orderBy: { _count: { eventType: 'desc' } },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['resourceId'],
        where: {
          tenantId,
          resourceType: 'item',
          createdAt: { gte: since },
          resourceId: { not: null },
        },
        _count: true,
        orderBy: { _count: { resourceId: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      period: { days, since },
      totalEvents,
      eventsByType,
      topItems,
    };
  }
}
