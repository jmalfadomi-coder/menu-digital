import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateRestaurantDto } from './create-restaurant.dto';

export class UpdateRestaurantDto extends PartialType(
  OmitType(CreateRestaurantDto, ['slug'] as const),
) {}
