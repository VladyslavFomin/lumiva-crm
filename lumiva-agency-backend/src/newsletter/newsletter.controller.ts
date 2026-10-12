import { Controller, Get, Post, Body, Query, UseGuards, Req, Res } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { Response } from 'express'
import { NewsletterService } from './newsletter.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@ApiTags('newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private svc: NewsletterService) {}

  @Post('subscribe')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  subscribe(@Body() body: any, @Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.ip || ''
    return this.svc.subscribe(body.email, body.lang || 'en', body.source || 'web', ip)
  }

  @Post('unsubscribe')
  unsubscribe(@Body() body: any) {
    return this.svc.unsubscribe(body.email)
  }

  @Get('subscribers')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  findAll(@Query() q: any) {
    return this.svc.findAll(q)
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  stats() {
    return this.svc.getStats()
  }

  @Get('export')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  async exportCsv(@Query('lang') lang: string, @Res() res: Response) {
    const rows = await this.svc.exportCsv(lang)
    const header = 'id,email,lang,source,status,createdAt\n'
    const csv = header + rows.map(r =>
      `${r.id},"${r.email}","${r.lang || ''}","${r.source}","${r.status}","${r.createdAt.toISOString()}"`
    ).join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="subscribers${lang ? '_' + lang : ''}.csv"`)
    res.send(csv)
  }
}
