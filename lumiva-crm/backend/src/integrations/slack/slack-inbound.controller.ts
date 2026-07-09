import { Body, Controller, Headers, Logger, Param, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SlackInboundService } from './slack-inbound.service';

/**
 * Inbound data from Slack → CRM.
 * URL: POST /v1/webhooks/slack/:connectionId?token=…
 *
 * Handles:
 *  - Slack URL verification challenge (type: url_verification)
 *  - Event API payloads
 *  - Plain JSON from Slack Workflow Builder / third-party tools
 */
@SkipThrottle()
@Controller('webhooks/slack')
export class SlackInboundController {
  private readonly log = new Logger(SlackInboundController.name);

  constructor(private readonly svc: SlackInboundService) {}

  @Post(':connectionId')
  async receive(
    @Param('connectionId') connectionId: string,
    @Query('token') token: string | undefined,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ): Promise<{ ok: true } | { challenge: string }> {
    try {
      const query: Record<string, string | string[] | undefined> = {};
      if (token) query.token = token;
      return await this.svc.handleInbound(connectionId, headers, query, body);
    } catch (e) {
      this.log.error((e as Error).stack || (e as Error).message);
      return { ok: true };
    }
  }
}
