import { Controller, Get, Put, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { SettingsService } from './settings.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private svc: SettingsService) {}

  @Get()
  findAll() { return this.svc.findAll() }

  @Put()
  bulkSet(@Body() body: { entries: { key: string; value: string; label?: string; group?: string }[] }) {
    return this.svc.bulkSet(body.entries)
  }

  @Put(':key')
  set(@Param('key') key: string, @Body() body: { value: string; label?: string; group?: string }) {
    return this.svc.set(key, body.value, body.label, body.group)
  }

  @Delete(':key')
  remove(@Param('key') key: string) { return this.svc.remove(key) }
}
