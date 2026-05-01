// src/leads/public-leads.controller.ts
import { Body, Controller, Post, BadRequestException, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LeadsService } from './leads.service';

@Controller('public/leads')
export class PublicLeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    if (!body || !body.apiToken) {
      throw new BadRequestException('apiToken is required');
    }
    return this.leadsService.createFromPublic(
      body,
      typeof req.headers.referer === 'string' ? req.headers.referer : null,
      typeof req.headers.origin === 'string' ? req.headers.origin : null,
    );
  }
}
