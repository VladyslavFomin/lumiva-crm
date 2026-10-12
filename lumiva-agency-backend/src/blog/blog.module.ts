import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BlogPost } from './blog-post.entity'
import { BlogService } from './blog.service'
import { BlogController } from './blog.controller'
import { BlogTranslateService } from './blog-translate.service'

@Module({
  imports: [TypeOrmModule.forFeature([BlogPost])],
  providers: [BlogService, BlogTranslateService],
  controllers: [BlogController],
  exports: [BlogService],
})
export class BlogModule {}
