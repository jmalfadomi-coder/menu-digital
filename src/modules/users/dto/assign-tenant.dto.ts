import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum } from 'class-validator';
import { TenantRole } from '@prisma/client';

export class AssignTenantDto {
  @ApiProperty()
  @IsString()
  tenantId: string;

  @ApiProperty({ enum: TenantRole })
  @IsEnum(TenantRole)
  role: TenantRole;
}
