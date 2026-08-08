// src/calendar/calendar.controller.ts
import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarService } from './calendar.service';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('events')
  getEvents(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid from/to date');
    }
    return this.calendar.getEvents(req.user.tenantId as string, fromDate, toDate);
  }
}
