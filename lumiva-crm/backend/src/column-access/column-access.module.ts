import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TableColumnRestriction } from './table-column-restriction.entity';
import { CustomField } from '../custom-fields/custom-field.entity';
import { ColumnAccessService } from './column-access.service';
import { ColumnAccessController } from './column-access.controller';
import { ColumnAccessInterceptor } from './column-access.interceptor';

/** Глобальный: перехватчик используют контроллеры лидов и проектов без лишних imports. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TableColumnRestriction, CustomField])],
  controllers: [ColumnAccessController],
  providers: [ColumnAccessService, ColumnAccessInterceptor],
  exports: [ColumnAccessService, ColumnAccessInterceptor],
})
export class ColumnAccessModule {}
