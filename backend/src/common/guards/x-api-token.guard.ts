import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class XApiTokenGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req: any = ctx.switchToHttp().getRequest();

    const header =
      (req.headers['x-api-token'] as string) ||
      (req.headers['x-api_token'] as string) ||
      (req.headers['x_api_token'] as string);

    const token = String(header || '').trim();
    if (!token) throw new UnauthorizedException('Missing X-Api-Token');

    // Ищем tenantId по токену в таблице api_tokens
    // Колонки: token, is_active/isActive, tenant_id/tenantId — подстрахуемся под оба стиля
    const row = await this.dataSource
      .createQueryBuilder()
      .select([
        't.tenant_id AS tenant_id',
        't.tenantId AS tenantId',
        't.is_active AS is_active',
        't.isActive AS isActive',
      ])
      .from('api_tokens', 't')
      .where('t.token = :token', { token })
      .andWhere('(t.is_active = true OR t.isActive = true OR t.is_active = 1 OR t.isActive = 1)')
      .limit(1)
      .getRawOne<any>();

    const tenantId = row?.tenant_id ?? row?.tenantId;

    if (!tenantId) throw new UnauthorizedException('Invalid X-Api-Token');

    // прокидываем tenantId в request, чтобы сервис мог его взять
    req.tenantId = String(tenantId);

    return true;
  }
}