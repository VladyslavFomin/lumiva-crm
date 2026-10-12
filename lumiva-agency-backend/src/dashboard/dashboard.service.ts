import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { BlogPost } from '../blog/blog-post.entity'
import { Case } from '../cases/case.entity'
import { FormSubmission } from '../forms/form-submission.entity'

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(BlogPost) private blogRepo: Repository<BlogPost>,
    @InjectRepository(Case) private caseRepo: Repository<Case>,
    @InjectRepository(FormSubmission) private formRepo: Repository<FormSubmission>,
  ) {}

  async getStats() {
    const [
      totalBlogPosts,
      publishedPosts,
      totalCases,
      publishedCases,
      totalForms,
      newForms,
    ] = await Promise.all([
      this.blogRepo.count(),
      this.blogRepo.count({ where: { status: 'published' } }),
      this.caseRepo.count(),
      this.caseRepo.count({ where: { status: 'published' } }),
      this.formRepo.count(),
      this.formRepo.count({ where: { status: 'new' } }),
    ])

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const forms24h = await this.formRepo
      .createQueryBuilder('f')
      .where('f.createdAt >= :d', { d: last24h })
      .getCount()

    const recentForms = await this.formRepo.find({
      order: { createdAt: 'DESC' },
      take: 10,
    })

    const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const formsByDay = await this.formRepo
      .createQueryBuilder('f')
      .select("DATE(f.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('f.createdAt >= :d', { d: last30days })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany()

    return {
      blog: { total: totalBlogPosts, published: publishedPosts, draft: totalBlogPosts - publishedPosts },
      cases: { total: totalCases, published: publishedCases },
      forms: { total: totalForms, new: newForms, last24h: forms24h },
      recentForms,
      formsByDay,
    }
  }
}
