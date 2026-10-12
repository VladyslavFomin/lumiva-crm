import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BlogPost } from '../blog/blog-post.entity'
import { Case } from '../cases/case.entity'
import { FormSubmission } from '../forms/form-submission.entity'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'

@Module({
  imports: [TypeOrmModule.forFeature([BlogPost, Case, FormSubmission])],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
