import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { BlogPost } from './blog-post.entity'

type LangFields = { title?: string; excerpt?: string; content?: string; blocks?: any[]; seoTitle?: string; seoDescription?: string; coverUrl?: string }

function applyLang(post: BlogPost, lang: string): BlogPost {
  if (!lang || lang === 'ru') return post
  const tr: LangFields = post.translations?.[lang] ?? {}
  return {
    ...post,
    title:          tr.title          ?? post.title,
    excerpt:        tr.excerpt        ?? post.excerpt,
    content:        tr.content        ?? post.content,
    blocks:         Array.isArray(tr.blocks) && tr.blocks.length > 0 ? tr.blocks : post.blocks,
    seoTitle:       tr.seoTitle       ?? post.seoTitle,
    seoDescription: tr.seoDescription ?? post.seoDescription,
    coverUrl:       tr.coverUrl       ?? post.coverUrl,
  } as BlogPost
}

export const BLOG_SITES = ['agency', 'crm']

/** Сайты статьи; у старых записей без поля — только сайт агентства. */
export function postSites(post: Pick<BlogPost, 'sites'>): string[] {
  const s = (post.sites || []).filter(x => BLOG_SITES.includes(x))
  return s.length ? s : ['agency']
}

function normalizeSites(v: unknown): string[] | undefined {
  if (v === undefined) return undefined
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []
  const s = Array.from(new Set(arr.map(x => String(x).trim()).filter(x => BLOG_SITES.includes(x))))
  return s.length ? s : ['agency']
}

@Injectable()
export class BlogService {
  constructor(@InjectRepository(BlogPost) private repo: Repository<BlogPost>) {}

  async findAll(query: any) {
    const { status, tag, category, lang, page = 1, limit = 20 } = query
    // site: 'agency' (по умолчанию — так сайт агентства работает без изменений), 'crm' или 'all' (админка pl2)
    const site = BLOG_SITES.includes(query.site) || query.site === 'all' ? query.site : 'agency'
    const qb = this.repo.createQueryBuilder('p')
    if (status) qb.andWhere('p.status = :status', { status })
    if (category) qb.andWhere('p.category = :category', { category })
    if (site !== 'all') {
      qb.andWhere(`(',' || coalesce(nullif(p.sites, ''), 'agency') || ',') LIKE :siteLike`, { siteLike: `%,${site},%` })
    }
    const [items, total] = await qb
      .orderBy('p.publishedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(+limit)
      .getManyAndCount()

    let filtered = tag ? items.filter(p => p.tags?.includes(tag)) : items

    // Filter by language availability
    if (lang && lang !== 'ru') {
      filtered = filtered.filter(p => Array.isArray(p.langs) && p.langs.includes(lang))
    }

    const localized = filtered.map(p => applyLang(p, lang))
    return { items: localized, total: localized.length, page: +page, limit: +limit }
  }

  async findBySlug(slug: string, lang?: string, increment = false, site?: string) {
    const post = await this.repo.findOne({ where: { slug } })
    if (!post) throw new NotFoundException('Post not found')
    // Публичное чтение: статья должна быть опубликована на запрошенном сайте (по умолчанию — агентства).
    if (site && !postSites(post).includes(site)) throw new NotFoundException('Post not found')
    if (increment) {
      post.viewCount = (post.viewCount || 0) + 1
      await this.repo.save(post)
    }
    return applyLang(post, lang || 'ru')
  }

  async create(data: Partial<BlogPost>) {
    data.sites = normalizeSites(data.sites) ?? ['agency']
    if (!data.slug && data.title) {
      data.slug = data.title.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/(^-|-$)/g, '')
    }
    if (data.status === 'published' && !data.publishedAt) data.publishedAt = new Date()
    return this.repo.save(this.repo.create(data))
  }

  async update(id: number, data: Partial<BlogPost>) {
    const post = await this.repo.findOne({ where: { id } })
    if (!post) throw new NotFoundException()
    const sites = normalizeSites(data.sites)
    if (sites) data.sites = sites
    else delete data.sites
    if (data.status === 'published' && !post.publishedAt) data.publishedAt = new Date()
    return this.repo.save({ ...post, ...data })
  }

  async remove(id: number) {
    await this.repo.delete(id)
    return { ok: true }
  }

  async getStats() {
    const total = await this.repo.count()
    const published = await this.repo.count({ where: { status: 'published' } })
    return { total, published }
  }
}
