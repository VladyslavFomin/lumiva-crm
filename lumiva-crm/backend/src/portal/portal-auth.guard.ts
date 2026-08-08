// src/portal/portal-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyPortalSessionToken } from './portal-token.util';

export interface PortalRequestContact {
  contactId: string;
  tenantId: string;
}

@Injectable()
export class PortalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header = req.headers?.authorization as string | undefined;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('No portal session token');

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new UnauthorizedException('Portal auth misconfigured');

    const result = verifyPortalSessionToken(token, secret);
    if (!result.valid) throw new UnauthorizedException('Invalid or expired portal session');

    const portalContact: PortalRequestContact = { contactId: result.contactId, tenantId: result.tenantId };
    req.portalContact = portalContact;
    return true;
  }
}
