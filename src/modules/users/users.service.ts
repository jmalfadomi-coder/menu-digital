import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as argon2 from 'argon2';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignTenantDto } from './dto/assign-tenant.dto';
import { getPrismaSkipTake, paginate } from '../../common/types/pagination.types';
import { Role } from '@prisma/client';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new ConflictException('Email already in use');

    const hashed = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        ...dto,
        email: dto.email.toLowerCase(),
        password: hashed,
      },
      select: USER_SELECT,
    });
    return user;
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const { skip, take } = getPrismaSkipTake(page, limit);
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take, select: USER_SELECT }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_SELECT,
        userTenants: {
          include: {
            tenant: { select: { id: true, slug: true, name_en: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted' };
  }

  async assignTenant(userId: string, dto: AssignTenantDto, requestingRole: Role) {
    // Only super admin / agency admin can assign users to tenants
    if (![Role.SUPER_ADMIN, Role.AGENCY_ADMIN].includes(requestingRole)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    await this.findOne(userId);

    return this.prisma.userTenant.upsert({
      where: { userId_tenantId: { userId, tenantId: dto.tenantId } },
      create: { userId, tenantId: dto.tenantId, role: dto.role },
      update: { role: dto.role },
    });
  }

  async removeTenant(userId: string, tenantId: string) {
    await this.prisma.userTenant.deleteMany({ where: { userId, tenantId } });
    return { message: 'Tenant access removed' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await argon2.verify(user.password, currentPassword);
    if (!valid) throw new ForbiddenException('Current password is incorrect');

    const hashed = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, refreshTokenHash: null },
    });
    return { message: 'Password updated' };
  }
}
