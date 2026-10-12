import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { TypeOrmModule } from '@nestjs/typeorm'
import { FormSubmission } from '../forms/form-submission.entity'
import { CrmController } from './crm.controller'
import { CrmService } from './crm.service'

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([FormSubmission])],
  providers: [CrmService],
  controllers: [CrmController],
})
export class CrmModule {}
