// src/esign/esign-public.controller.ts
import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { EsignService } from './esign.service';
import { getClientIp } from '../common/client-ip.util';

@Controller('esign/public')
export class EsignPublicController {
  constructor(private readonly esign: EsignService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.esign.getPublicDocument(token);
  }

  @Post(':token/sign')
  sign(@Param('token') token: string, @Body() body: { signerName: string }, @Req() req: Request) {
    return this.esign.signDocument(token, {
      signerName: body.signerName,
      ip: getClientIp(req) || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });
  }

  @Post(':token/decline')
  decline(@Param('token') token: string) {
    return this.esign.declineDocument(token);
  }
}
