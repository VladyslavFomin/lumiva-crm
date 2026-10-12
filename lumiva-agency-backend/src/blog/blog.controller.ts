import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { BlogService } from './blog.service'
import { BlogTranslateService } from './blog-translate.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@ApiTags('blog')
@Controller('blog')
export class BlogController {
  constructor(private svc: BlogService, private translator: BlogTranslateService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.svc.findAll(query)
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string, @Query('admin') admin: string, @Query('lang') lang: string, @Query('site') site: string) {
    const isAdmin = admin === 'true' || admin === '1'
    return this.svc.findBySlug(slug, lang, !isAdmin, isAdmin ? undefined : site === 'crm' ? 'crm' : 'agency')
  }

  @Post('translate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async translate(@Body() body: {
    title: string
    excerpt: string
    seoTitle: string
    seoDescription: string
    blocks: any[]
    targetLangs: string[]
    existing?: Record<string, { title?: string; excerpt?: string; seoTitle?: string; seoDescription?: string; blocks?: any[] }>
  }) {
    const targets = (body.targetLangs ?? ['en', 'tr']).filter(l => l !== 'ru')
    const results: Record<string, any> = {}
    for (const lang of targets) {
      results[lang] = await this.translator.translateContent(body, 'ru', lang, body.existing?.[lang] ?? {})
    }
    return results
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@Body() body: any) {
    return this.svc.create(body)
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.svc.update(id, body)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id)
  }
}
