import { Body, Controller, Headers, Logger, Param, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JiraInboundService } from './jira-inbound.service';

@SkipThrottle()
@Controller('webhooks/jira')
export class JiraInboundController {
  private readonly log = new Logger(JiraInboundController.name);
  constructor(private readonly svc: JiraInboundService) {}

  @Post(':connectionId')
  async receive(
    @Param('connectionId') connectionId: string,
    @Query('token') token: string | undefined,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
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
