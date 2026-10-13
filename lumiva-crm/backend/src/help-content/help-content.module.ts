import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HelpMedia } from './help-media.entity';
import { HelpContentService } from './help-content.service';
import { HelpContentController, PlatformHelpContentController } from './help-content.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HelpMedia])],
  providers: [HelpContentService],
  controllers: [HelpContentController, PlatformHelpContentController],
})
export class HelpContentModule {}
