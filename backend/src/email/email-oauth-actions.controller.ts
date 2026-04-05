import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { EmailOAuthService } from './email-oauth.service';
import { EmailSyncService } from './email-sync.service';
import { EmailService } from './email.service';

@Controller('email/oauth')
@UseGuards(JwtAuthGuard, RbacGuard)
export class EmailOAuthActionsController {
  constructor(
    private readonly oauth: EmailOAuthService,
    private readonly sync: EmailSyncService,
    private readonly emailService: EmailService,
  ) {}

  private uid(user: CurrentUserPayload): string {
    return (user as any).userId || user.sub || '';
  }

  @Post('google/start')
  @RequirePermission('email', 'write')
  async startGoogle(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { redirect?: string },
  ) {
    const tenantId = user.tenantId;
    if (!tenantId) throw new BadRequestException('No tenant in session');
    const url = await this.oauth.buildGoogleAuthUrl({
      tenantId,
      userId: this.uid(user),
      redirect: (body.redirect || '/app/email/accounts').trim(),
      provider: 'gmail',
    });
    return { url };
  }

  @Post('microsoft/start')
  @RequirePermission('email', 'write')
  async startMicrosoft(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { redirect?: string },
  ) {
    const tenantId = user.tenantId;
    if (!tenantId) throw new BadRequestException('No tenant in session');
    const url = await this.oauth.buildMicrosoftAuthUrl({
      tenantId,
      userId: this.uid(user),
      redirect: (body.redirect || '/app/email/accounts').trim(),
      provider: 'outlook',
    });
    return { url };
  }

  @Post('sync/:accountId')
  @RequirePermission('email', 'write')
  async syncNow(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
  ) {
    await this.emailService.assertAccountInTenant(user.tenantId, accountId);
    return this.sync.syncAccount(accountId);
  }

  @Patch('accounts/:accountId/ingestion')
  @RequirePermission('email', 'write')
  async patchIngestion(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Body()
    body: {
      autoCreateFromUnknown?: boolean;
      skipDomains?: string[];
    },
  ) {
    return this.emailService.patchAccountIngestion(
      user.tenantId,
      accountId,
      body,
    );
  }
}
