import { PartialType } from '@nestjs/mapped-types';
import { CreateMarketingIntegrationDto } from './create-marketing-integration.dto';

export class UpdateMarketingIntegrationDto extends PartialType(
  CreateMarketingIntegrationDto,
) {}
