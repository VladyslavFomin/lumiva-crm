import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EmbedForm } from './embed-form.entity';
import { EmbedFormUpload } from './embed-form-upload.entity';
import { Site } from '../sites/site.entity';
import { EmbedFormsService } from './embed-forms.service';
import { EmbedFormsController } from './embed-forms.controller';
import { PublicEmbedController } from './public-embed.controller';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmbedForm, EmbedFormUpload, Site]),
    ConfigModule,
    LeadsModule,
  ],
  controllers: [EmbedFormsController, PublicEmbedController],
  providers: [EmbedFormsService],
  exports: [EmbedFormsService],
})
export class EmbedFormsModule {}
