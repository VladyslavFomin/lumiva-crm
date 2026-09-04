import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { EmailOAuthService } from './email-oauth.service';

/**
 * OAuth callbacks (без JWT — проверка через подписанный state).
 */
@Controller('email/oauth')
export class EmailOAuthPublicController {
  constructor(private readonly oauth: EmailOAuthService) {}

  private frontendBase(): string {
    return (process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(
      /\/$/,
      '',
    );
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    const fe = this.frontendBase();
    const fail = () => res.redirect(`${fe}/app/email?oauth=error`);
    if (oauthError || !code || !state) return fail();
    try {
      const { redirect } = await this.oauth.handleGoogleCallback(code, state);
      return res.redirect(
        `${fe}${redirect}?oauth=connected&provider=gmail`,
      );
    } catch {
      return fail();
    }
  }

  @Get('microsoft/callback')
  async microsoftCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    const fe = this.frontendBase();
    const fail = () => res.redirect(`${fe}/app/email?oauth=error`);
    if (oauthError || !code || !state) return fail();
    try {
      const { redirect } = await this.oauth.handleMicrosoftCallback(
        code,
        state,
      );
      return res.redirect(
        `${fe}${redirect}?oauth=connected&provider=outlook`,
      );
    } catch {
      return fail();
    }
  }
}
