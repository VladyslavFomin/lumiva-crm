// src/media/media.entities.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type MediaKind = 'image' | 'video' | 'pdf';

@Entity('media_folders')
@Index(['tenantId', 'parentId'])
export class MediaFolder {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid', nullable: true }) hotelId: string | null;
  /** Свой раздел (бренд и т.п.) — у всего поддерева, как hotelId. */
  @Column({ type: 'uuid', nullable: true }) collectionId: string | null;
  @Column({ type: 'uuid', nullable: true }) parentId: string | null;
  @Column({ type: 'varchar', length: 200 }) name: string;
  @Column({ type: 'uuid', nullable: true }) createdByUserId: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

@Entity('media_collections')
export class MediaCollection {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'varchar', length: 200 }) name: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('media_files')
@Index(['tenantId', 'folderId'])
export class MediaFile {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) folderId: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 16, default: '' }) ext: string;
  @Column({ type: 'varchar', length: 128 }) mime: string;
  @Column({ type: 'varchar', length: 16 }) kind: MediaKind;
  @Column({ type: 'bigint', default: 0 }) sizeBytes: string;
  @Column({ type: 'integer', nullable: true }) width: number | null;
  @Column({ type: 'integer', nullable: true }) height: number | null;
  @Column({ type: 'integer', nullable: true }) durationSec: number | null;
  /** Относительно uploads/ — `media/<tenantId>/<id>.<ext>`. Каталог закрыт от express.static (main.ts). */
  @Column({ type: 'varchar', length: 512 }) storagePath: string;
  @Column({ type: 'varchar', length: 512, nullable: true }) thumbPath: string | null;
  @Column({ type: 'integer', default: 0 }) downloads: number;
  @Column({ type: 'timestamptz', nullable: true }) lastDownloadAt: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) lastDownloadBy: string | null;
  @Column({ type: 'uuid', nullable: true }) createdByUserId: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

/** hotel — подборка одного отеля, multi — общий архив по нескольким отелям, agency — материалы без отеля. */
export type MediaLinkScope = 'hotel' | 'multi' | 'agency';

@Entity('media_links')
export class MediaLink {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'varchar', length: 200 }) name: string;
  @Column({ type: 'varchar', length: 80, unique: true }) slug: string;
  @Column({ type: 'varchar', length: 16, default: 'hotel' }) scope: MediaLinkScope;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) hotelIds: string[];
  /** Папки любого уровня: клиенту доступны они и всё, что внутри. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) folderIds: string[];
  /** Отдельные файлы («Ссылка на выбранные») — показываются клиенту как одна подборка. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) fileIds: string[];
  /** Заголовок на публичной странице (по умолчанию — название отеля / компании). */
  @Column({ type: 'varchar', length: 200, nullable: true }) title: string | null;
  @Column({ type: 'text', nullable: true }) description: string | null;
  /** Язык страницы по умолчанию: ru | en | tr; null — по браузеру посетителя. */
  @Column({ type: 'varchar', length: 5, nullable: true }) lang: string | null;
  @Column({ type: 'boolean', default: true }) gate: boolean;
  @Column({ type: 'boolean', default: true }) allowZip: boolean;
  @Column({ type: 'varchar', length: 100, nullable: true, select: false }) passwordHash: string | null;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt: Date | null;
  @Column({ type: 'boolean', default: true }) enabled: boolean;
  /** Переопределяет ответственного из настроек формы. */
  @Column({ type: 'uuid', nullable: true }) assigneeStaffId: string | null;
  @Column({ type: 'uuid', nullable: true }) createdByUserId: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

@Entity('media_visitors')
export class MediaVisitor {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'varchar', length: 64 }) token: string;
  @Column({ type: 'jsonb', nullable: true }) formData: Record<string, unknown> | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) name: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) email: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) phone: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) company: string | null;
  @Column({ type: 'varchar', length: 128, nullable: true }) role: string | null;
  @Column({ type: 'uuid', nullable: true }) leadId: string | null;
  @Column({ type: 'uuid', nullable: true }) contactId: string | null;
  @Column({ type: 'timestamptz', nullable: true }) formAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @Column({ type: 'timestamptz', default: () => 'now()' }) lastSeenAt: Date;
}

/** view — открыл ссылку, open — открыл папку, click — нажал «Скачать», lead — заполнил форму, download — скачал. */
export type MediaEventType = 'view' | 'open' | 'click' | 'lead' | 'download';

@Entity('media_events')
export class MediaEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) linkId: string;
  @Column({ type: 'uuid', nullable: true }) visitorId: string | null;
  @Column({ type: 'varchar', length: 16 }) type: MediaEventType;
  @Column({ type: 'uuid', nullable: true }) folderId: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) fileIds: string[];
  @Column({ type: 'integer', default: 0 }) filesCount: number;
  @Column({ type: 'bigint', default: 0 }) bytes: string;
  @Column({ type: 'varchar', length: 300, nullable: true }) what: string | null;
  @Column({ type: 'boolean', default: false }) zip: boolean;
  @Column({ type: 'varchar', length: 64, nullable: true }) ip: string | null;
  @Column({ type: 'varchar', length: 300, nullable: true }) userAgent: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

export type MediaFormFieldType = 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'check';

export interface MediaFormField {
  id: string;
  label: string;
  type: MediaFormFieldType;
  ph?: string;
  options?: string[];
  on: boolean;
  req: boolean;
  lock?: boolean;
  /** Тексты на других языках; нет — стандартные подписи переводятся сами (mediaAuto), свои показываются как есть. */
  l10n?: Partial<Record<MediaLang, { label?: string; ph?: string; options?: string[] }>>;
}

export type MediaLang = 'ru' | 'en' | 'tr';

@Entity('media_settings')
export class MediaSettings {
  @PrimaryColumn({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) formTitle: string | null;
  @Column({ type: 'jsonb', nullable: true }) formFields: MediaFormField[] | null;
  @Column({ type: 'jsonb', nullable: true }) formTitles: Partial<Record<MediaLang, string>> | null;
  @Column({ type: 'varchar', length: 32, default: 'new' }) leadStatus: string;
  @Column({ type: 'uuid', nullable: true }) assigneeStaffId: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) contactTags: string[];
  /** 0 — спрашивать форму каждый раз. */
  @Column({ type: 'integer', default: 30 }) reaskDays: number;
  /** merge — склеивать с существующим контактом/открытым медиа-лидом по почте/телефону; new — всегда новый лид. */
  @Column({ type: 'varchar', length: 16, default: 'merge' }) dedupe: 'merge' | 'new';
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

@Entity('media_uploads')
export class MediaUpload {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) folderId: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 128 }) mime: string;
  @Column({ type: 'bigint' }) sizeBytes: string;
  @Column({ type: 'bigint', default: 0 }) receivedBytes: string;
  @Column({ type: 'varchar', length: 512 }) tmpPath: string;
  @Column({ type: 'uuid', nullable: true }) createdByUserId: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
