import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { CasesService } from './cases.service'
import { CaseTranslateService } from './case-translate.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@ApiTags('cases')
@Controller('cases')
export class CasesController {
  constructor(private svc: CasesService, private translator: CaseTranslateService) {}

  @Get()
  findAll(@Query() query: any) { return this.svc.findAll(query) }

  @Get('featured')
  featured(@Query('lang') lang: string) { return this.svc.findFeatured(lang) }

  @Get('by-id/:id')
  findById(@Param('id', ParseIntPipe) id: number) { return this.svc.findById(id) }

  @Get(':slug')
  findOne(@Param('slug') slug: string, @Query('lang') lang: string) { return this.svc.findBySlug(slug, lang) }

  @Post('translate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async translate(@Body() body: { targetLangs: string[]; existing?: Record<string, any>; [key: string]: any }) {
    const { targetLangs, existing, ...content } = body
    const targets = (targetLangs ?? ['en', 'tr']).filter(l => l !== 'ru')
    const results: Record<string, any> = {}
    for (const lang of targets) {
      results[lang] = await this.translator.translateContent(content, 'ru', lang, existing?.[lang] ?? {})
    }
    return results
  }

  @Post()
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  create(@Body() body: any) { return this.svc.create(body) }

  @Patch(':id')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.svc.update(id, body) }

  @Delete(':id')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id) }
}
