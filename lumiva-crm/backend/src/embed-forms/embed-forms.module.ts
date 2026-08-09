import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EmbedForm } from './embed-form.entity';
import { EmbedFormUpload } from './embed-form-upload.entity';
import { Site } from '../sites/site.entity';
import { Tenant } from '../tenants/tenant.entity';
import { EmbedFormsService } from './embed-forms.service';
import { EmbedFormsController } from './embed-forms.controller';
import { PublicEmbedController } from './public-embed.controller';
import { LeadsModule } from '../leads/leads.module';
import { ProductsModule } from '../products/products.module';
import { SalesModule } from '../sales/sales.module';
import { BookingsModule } from '../bookings/bookings.module';
import { HotelsModule } from '../hotels/hotels.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmbedForm, EmbedFormUpload, Site, Tenant]),
    ConfigModule,
    LeadsModule,
    ProductsModule,
    SalesModule,
    BookingsModule,
    HotelsModule,
  ],
  controllers: [EmbedFormsController, PublicEmbedController],
  providers: [EmbedFormsService],
  exports: [EmbedFormsService],
})
export class EmbedFormsModule {}
