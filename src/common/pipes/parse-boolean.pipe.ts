import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Converts the string query-param values "true" / "1" / "false" / "0"
 * to proper booleans.  Undefined passes through as-is.
 */
@Injectable()
export class ParseBooleanPipe implements PipeTransform<string, boolean | undefined> {
  transform(value: string | undefined): boolean | undefined {
    if (value === undefined || value === null) return undefined;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    throw new BadRequestException(
      `Query parameter must be "true" or "false", received: "${value}"`,
    );
  }
}
