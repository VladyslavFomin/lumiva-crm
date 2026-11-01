import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type HotelChannelProvider = 'channex';
export type HotelChannelStatus = 'active' | 'paused' | 'error';

export interface HotelChannelSettings {
  /** на сколько дней вперёд выгружать цены и наличие (до 500 — как требует Channex для полной выгрузки) */
  pushDays?: number;
  /** сколько номеров держать «про запас» — не отдавать в каналы */
  reserveRooms?: number;
}

/** Подключение отеля к менеджеру каналов. Ключ API — только в зашифрованном виде. */
@Entity('hotel_channel_connections')
@Index(['tenantId', 'hotelId', 'provider'], { unique: true })
export class HotelChannelConnection {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'varchar', length: 24 }) provider: HotelChannelProvider;
  /** production / staging (тестовый аккаунт канала) */
  @Column({ type: 'varchar', length: 16, default: 'production' }) environment: string;
  @Column({ type: 'varchar', length: 16, default: 'active' }) status: HotelChannelStatus;
  @Column({ type: 'text', nullable: true }) apiKeyEnc: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) externalPropertyId: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) externalPropertyName: string | null;
  @Column({ type: 'jsonb', default: {} }) settings: HotelChannelSettings;
  @Column({ type: 'timestamptz', nullable: true }) lastPushAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lastPullAt: Date | null;
  @Column({ type: 'text', nullable: true }) lastError: string | null;
  /** вебхук броней в канале: id и секрет заголовка X-Channex-Webhook-Secret (зашифрован) */
  @Column({ type: 'varchar', length: 80, nullable: true }) webhookId: string | null;
  @Column({ type: 'text', nullable: true }) webhookSecretEnc: string | null;
  /** полная выгрузка — не чаще раза в сутки (ночью по времени отеля), в остальное время только изменения */
  @Column({ type: 'timestamptz', nullable: true }) lastFullSyncAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lastDeltaAt: Date | null;
  /** после ошибки канала обмен ставится на паузу (1, 2, 4… до 15 минут) */
  @Column({ type: 'timestamptz', nullable: true }) backoffUntil: Date | null;
  @Column({ type: 'integer', default: 0 }) failCount: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

/** Тариф в канале: цена за номер или за человека (по числу гостей), ручной или производный от другого тарифа */
export interface HotelChannelRatePlanMeta {
  sellMode: 'per_room' | 'per_person';
  rateMode: 'manual' | 'derived' | 'auto' | 'cascade';
  occupancies: number[];
}

/** Последнее отправленное в канал значение по дню: только изменения уходят в следующую выгрузку */
@Entity('hotel_channel_ari_state')
@Index(['connectionId', 'kind', 'externalId', 'date'], { unique: true })
export class HotelChannelAriState {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) connectionId: string;
  /** avail — наличие по типу номера канала, rate — цена и ограничения по тарифу канала */
  @Column({ type: 'varchar', length: 8 }) kind: 'avail' | 'rate';
  @Column({ type: 'varchar', length: 80 }) externalId: string;
  @Column({ type: 'date' }) date: string;
  @Column({ type: 'jsonb' }) value: Record<string, unknown>;
  @Column({ type: 'timestamptz', default: () => 'now()' }) sentAt: Date;
}

/** Наш тип номера ↔ тип номера и тариф в канале; цена — по размещению и группе рынков */
@Entity('hotel_channel_mappings')
export class HotelChannelMapping {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) connectionId: string;
  @Column({ type: 'uuid' }) roomTypeId: string;
  @Column({ type: 'uuid', nullable: true }) occupancyTypeId: string | null;
  @Column({ type: 'uuid', nullable: true }) marketGroupId: string | null;
  @Column({ type: 'varchar', length: 80 }) externalRoomTypeId: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) externalRatePlanId: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) externalName: string | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  /** режим тарифа в канале (за номер / за человека, производный) — читается при сопоставлении и полной выгрузке */
  @Column({ type: 'jsonb', nullable: true }) ratePlanMeta: HotelChannelRatePlanMeta | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

/** Журнал обмена с каналом: выгрузки, загрузки броней, ошибки */
@Entity('hotel_channel_logs')
export class HotelChannelLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) connectionId: string;
  /** push — цены/наличие, pull — загрузка броней, booking — одна бронь, test — проверка ключа */
  @Column({ type: 'varchar', length: 16 }) kind: 'push' | 'pull' | 'booking' | 'test';
  @Column({ type: 'boolean', default: true }) ok: boolean;
  @Column({ type: 'text' }) message: string;
  @Column({ type: 'jsonb', nullable: true }) details: Record<string, unknown> | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
