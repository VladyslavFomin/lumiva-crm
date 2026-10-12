import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Файл «Мозга»: документ .md (редактируется в CRM) или загруженный файл с извлечённым текстом. */
@Entity('ai_brain_files')
@Index('IDX_ai_brain_files_tenant_folder', ['tenantId', 'departmentId'])
export class AiBrainFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  /** Папка: отдел; null — «Общее». */
  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** md | pdf | csv | xlsx | docx | txt | img | url */
  @Column({ type: 'varchar', length: 12 })
  type: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mime: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', default: 0 })
  sizeBytes: string;

  /** Путь к исходнику на диске (uploads/ai-brain/...) — для загруженных файлов. */
  @Column({ name: 'storage_path', type: 'varchar', length: 512, nullable: true })
  storagePath: string | null;

  /** Тело документа .md (редактируемое) */
  @Column({ name: 'body_md', type: 'text', nullable: true })
  bodyMd: string | null;

  /** Извлечённый текст (для поиска и промпта) */
  @Column({ name: 'text_content', type: 'text', nullable: true })
  textContent: string | null;

  /** ['all'] или id отделов, которым доступен файл */
  @Column({ type: 'text', array: true, default: () => "'{all}'" })
  scope: string[];

  /** pending | indexing | ready | failed */
  @Column({ name: 'index_status', type: 'varchar', length: 16, default: 'pending' })
  indexStatus: string;

  @Column({ name: 'index_progress', type: 'int', default: 0 })
  indexProgress: number;

  @Column({ name: 'chunk_count', type: 'int', default: 0 })
  chunkCount: number;

  @Column({ name: 'index_error', type: 'text', nullable: true })
  indexError: string | null;

  /** upload | editor | agent | migrated */
  @Column({ type: 'varchar', length: 16, default: 'upload' })
  source: string;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy: string | null;

  @Column({ name: 'author_agent_id', type: 'uuid', nullable: true })
  authorAgentId: string | null;

  @Column({ name: 'last_read_at', type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  @Column({ name: 'last_read_agent_id', type: 'uuid', nullable: true })
  lastReadAgentId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
