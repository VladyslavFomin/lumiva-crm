import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Case } from './case.entity'
import { CasesService } from './cases.service'
import { CasesController } from './cases.controller'
import { CaseTranslateService } from './case-translate.service'

@Module({
  imports: [TypeOrmModule.forFeature([Case])],
  providers: [CasesService, CaseTranslateService],
  controllers: [CasesController],
  exports: [CasesService],
})
export class CasesModule {}
