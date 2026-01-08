import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListChatSessionsQueryDto {
  @IsOptional()
  @IsIn(['open', 'closed'])
  status?: 'open' | 'closed';

  @IsOptional()
  @IsString()
  siteHost?: string; // фильтр по сайту

  @IsOptional()
  @IsString()
  search?: string; // по имени/почте/текстам
}