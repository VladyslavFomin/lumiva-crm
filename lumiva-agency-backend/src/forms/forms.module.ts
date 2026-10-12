import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { HttpModule } from '@nestjs/axios'
import { FormSubmission } from './form-submission.entity'
import { FormsService } from './forms.service'
import { FormsController } from './forms.controller'
import { NewsletterModule } from '../newsletter/newsletter.module'

@Module({
  imports: [TypeOrmModule.forFeature([FormSubmission]), HttpModule, NewsletterModule],
  providers: [FormsService],
  controllers: [FormsController],
  exports: [FormsService],
})
export class FormsModule {}
