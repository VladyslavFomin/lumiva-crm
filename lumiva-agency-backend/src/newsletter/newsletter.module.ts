import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { HttpModule } from '@nestjs/axios'
import { NewsletterSubscriber } from './newsletter-subscriber.entity'
import { NewsletterService } from './newsletter.service'
import { NewsletterController } from './newsletter.controller'

@Module({
  imports: [TypeOrmModule.forFeature([NewsletterSubscriber]), HttpModule],
  providers: [NewsletterService],
  controllers: [NewsletterController],
  exports: [NewsletterService],
})
export class NewsletterModule {}
