// src/integrations/webhooks-rate-limit.guard.ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Per-IP rate limiting guard for inbound webhook endpoints.
 * New inbound controllers (Shopify, WooCommerce, etc.) should use:
 *
 *   @Throttle({ default: { limit: 120, ttl: 60000 } })
 *   @UseGuards(WebhooksRateLimitGuard)
 *
 * instead of @SkipThrottle().
 */
@Injectable()
export class WebhooksRateLimitGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Prefer the first forwarded IP (behind a reverse proxy), fall back to direct IP
    return (req.ips?.length ? req.ips[0] : req.ip) as string;
  }
}
