import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { Locale } from '@prisma/client';

type LocaleKey = 'en' | 'es';

@Injectable()
export class ParseLocalePipe implements PipeTransform<string, LocaleKey> {
  transform(value: string | undefined): LocaleKey {
    if (!value) return 'en';
    const lower = value.toLowerCase() as LocaleKey;
    if (['en', 'es'].includes(lower)) return lower;
    throw new BadRequestException(
      `Unsupported locale "${value}". Supported: en, es`,
    );
  }
}
