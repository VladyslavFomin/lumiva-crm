// src/leads/public-leads.controller.ts
import { Body, Controller, Post, BadRequestException, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LeadsService } from './leads.service';

@Controller('public/leads')
export class PublicLeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    // для публичного API требуем apiToken
    if (!body || !body.apiToken) {
      throw new BadRequestException('apiToken is required');
    }

    // вся логика: проверка apiToken, поиск сайта, tenantId, siteId —
    // уже внутри LeadsService.createFromPublic(...)
    return this.leadsService.createFromPublic(body, req.headers.referer);
  }
}
