import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner@restaurant.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'S3cur3P@ssw0rd!' })
  @IsString()
  @MinLength(8)
  password: string;

  /** Optionally scope the session to a specific tenant on login */
  @ApiPropertyOptional({ example: 'clq1abc...' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  expiresIn: number;

  @ApiProperty()
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}
