import { Controller, Get, Post, Param, UseGuards, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { CrmService } from './crm.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@ApiTags('crm')
@Controller('crm')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CrmController {
  constructor(private svc: CrmService) {}

  @Get('status')
  status() { return this.svc.getStatus() }

  @Post('push-lead/:id')
  pushLead(@Param('id', ParseIntPipe) id: number) { return this.svc.pushLead(id) }
}
