import { Body, Controller, Get, Patch, Param, Post } from '@nestjs/common';
import { DemoRequestsService } from './demo-requests.service';

@Controller('public/demo-requests')
export class DemoRequestsPublicController {
  constructor(private readonly demoRequests: DemoRequestsService) {}

  @Post()
  async create(
    @Body()
    body: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      ordersPerMonth?: string;
      contactMethod: string;
      botField?: string;
      utm?: any;
      utmSource?: string;
      utm_source?: string;
      utmMedium?: string;
      utm_medium?: string;
      utmCampaign?: string;
      utm_campaign?: string;
      utmContent?: string;
      utm_content?: string;
      utmTerm?: string;
      utm_term?: string;
    },
  ) {
    const req = await this.demoRequests.create({
      ...body,
      utm: body.utm,
      utmSource: body.utmSource ?? body.utm_source,
      utmMedium: body.utmMedium ?? body.utm_medium,
      utmCampaign: body.utmCampaign ?? body.utm_campaign,
      utmContent: body.utmContent ?? body.utm_content,
      utmTerm: body.utmTerm ?? body.utm_term,
    });
    return { ok: true, id: req.id };
  }
}

@Controller('platform/demo-requests')
export class DemoRequestsPlatformController {
  constructor(private readonly demoRequests: DemoRequestsService) {}

  @Get()
  async list() {
    return this.demoRequests.listAll();
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.demoRequests.updateStatus(id, body.status);
  }
}
