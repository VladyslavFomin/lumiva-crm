import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, Observable, switchMap, map } from 'rxjs';
import { ColumnAccessService } from './column-access.service';

export const COLUMN_ACCESS_TABLE_KEY = 'columnAccessTable';
/** Помечает обработчик: его ответ — записи таблицы `tableKey`, скрытые колонки вырезаются. */
export const ColumnAccessTable = (tableKey: string) => SetMetadata(COLUMN_ACCESS_TABLE_KEY, tableKey);

/**
 * Для помеченных обработчиков: (1) до вызова — убирает из тела запроса значения скрытых для
 * пользователя колонок (кроме восстановления «целиком заменяемых» объектов — это делает
 * контроллер, у которого есть текущая запись: см. req.columnAccessHidden); (2) после — вырезает
 * скрытые значения из ответа.
 */
@Injectable()
export class ColumnAccessInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: ColumnAccessService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const tableKey = this.reflector.get<string | undefined>(COLUMN_ACCESS_TABLE_KEY, context.getHandler());
    if (!tableKey) return next.handle();
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.tenantId) return next.handle();
    return from(this.access.hiddenFor(user.tenantId, tableKey, user)).pipe(
      switchMap((hidden) => {
        req.columnAccessHidden = hidden;
        if (!this.access.isEmpty(hidden) && req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
          // Без existing: скрытые свойства удаляются; meta/customFields восстанавливает контроллер.
          hidden.props.forEach((p) => delete req.body[p]);
        }
        return next.handle().pipe(map((body) => this.access.stripResponse(body, hidden)));
      }),
    );
  }
}
