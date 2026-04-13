import { JwtPayload } from '../decorators/current-user.decorator';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenantId?: string;
    }
  }
}
