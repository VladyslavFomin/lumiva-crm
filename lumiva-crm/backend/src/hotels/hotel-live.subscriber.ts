import { Injectable } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelHousekeepingTask, HotelRoomOutage } from './hotel-housekeeping.entities';
import { HotelLiveEntity, HotelLiveService } from './hotel-live.service';
import { HotelGuestRequest } from './hotel-guest-care.entity';

const KINDS: Array<[Function, HotelLiveEntity]> = [
  [HotelReservation, 'reservation'],
  [HotelRoomUnit, 'unit'],
  [HotelHousekeepingTask, 'housekeeping'],
  [HotelRoomOutage, 'outage'],
  [HotelGuestRequest, 'request'],
];

/** Любое сохранение брони, номера, задачи уборки или OOO через репозиторий — событие в живой поток компании.
 * Массовые update() через QueryBuilder сюда не попадают — там, где это важно, сервис публикует сам. */
@Injectable()
export class HotelLiveSubscriber implements EntitySubscriberInterface {
  constructor(dataSource: DataSource, private readonly live: HotelLiveService) {
    dataSource.subscribers.push(this);
  }

  afterInsert(e: InsertEvent<any>) {
    this.emit(e.metadata.target, e.entity, 'insert');
  }

  afterUpdate(e: UpdateEvent<any>) {
    this.emit(e.metadata.target, e.entity || e.databaseEntity, 'update');
  }

  afterRemove(e: RemoveEvent<any>) {
    this.emit(e.metadata.target, e.entity || e.databaseEntity, 'remove', e.entityId);
  }

  private emit(target: unknown, row: any, action: 'insert' | 'update' | 'remove', removedId?: unknown) {
    const kind = KINDS.find(([cls]) => cls === target)?.[1];
    if (!kind || !row?.tenantId) return;
    const id = row.id || (typeof removedId === 'string' ? removedId : '');
    // у номера hotelId нет — страница перечитает свой отель
    this.live.publish(row.tenantId, { type: 'changed', entity: kind, id, hotelId: row.hotelId ?? null, action });
  }
}
