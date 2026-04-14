import { Global, Module } from '@nestjs/common';
import { DevEmailService } from './dev-email.service';
import { EMAIL_SERVICE } from './email.interface';

/**
 * Global so AuthService can inject EMAIL_SERVICE without the caller importing
 * EmailModule.  Swap DevEmailService for a real provider here when ready.
 */
@Global()
@Module({
  providers: [
    {
      provide: EMAIL_SERVICE,
      useClass: DevEmailService,
    },
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
