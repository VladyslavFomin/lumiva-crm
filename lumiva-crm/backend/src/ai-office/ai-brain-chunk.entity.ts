import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Фрагмент файла «Мозга» для поиска: полнотекстовый (tsv) + эмбеддинг (real[]; pgvector в образе БД нет). */
@Entity('ai_brain_chunks')
@Index('IDX_ai_brain_chunks_file', ['fileId', 'ord'])
export class AiBrainChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'file_id', type: 'uuid' })
  fileId: string;

  @Column({ type: 'int' })
  ord: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'real', array: true, nullable: true })
  embedding: number[] | null;
}
