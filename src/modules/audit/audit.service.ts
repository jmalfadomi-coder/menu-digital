import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction } from '@prisma/client';
import { getPrismaSkipTake, paginate } from '../../common/types/pagination.types';

export interface LogAuditDto {
  userId: string;
  tenantId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  resourceName?: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(dto: LogAuditDto) {
    return this.prisma.auditLog.create({ data: dto });
  }

  async findAll(
    filters: {
      tenantId?: string;
      userId?: string;
      resource?: string;
      action?: AuditAction;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { tenantId, userId, resource, action, page = 1, limit = 50 } = filters;
    const { skip, take } = getPrismaSkipTake(page, limit);

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;
    if (resource) where.resource = resource;
    if (action) where.action = action;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }
}
