import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, Req, Ip } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { FormsService } from './forms.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@ApiTags('forms')
@Controller('forms')
export class FormsController {
  constructor(private svc: FormsService) {}

  @Post('submit')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  submit(@Body() body: any, @Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.ip || ''
    const ua = req.headers['user-agent'] || ''
    return this.svc.submit(body, ip, ua)
  }

  @Get()
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  findAll(@Query() q: any) { return this.svc.findAll(q) }

  @Get('stats')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  stats(@Query('days') days: string) { return this.svc.getStats(+days || 30) }

  @Patch(':id')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.svc.update(id, body) }

  @Delete(':id')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id) }
}
