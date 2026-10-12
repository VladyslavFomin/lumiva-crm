import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, extname } from 'path';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { AiBrainFile } from './ai-brain-file.entity';
import { AiBrainChunk } from './ai-brain-chunk.entity';
import { AiDepartment } from './ai-department.entity';
import { AiOpenAiService } from '../ai/ai-openai.service';
import { AiQuotaService } from '../ai/ai-quota.service';
import { StorageQuotaService } from '../storage-quota/storage-quota.service';
import { joinUploadsAbsolute, unlinkUploadsRelative } from '../common/uploads-root.util';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_CHARS = 400_000;
const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 150;
const EMBED_DIMS = 256;
const EMBED_BATCH = 64;
/** Сколько фрагментов просматриваем по смыслу (векторы сравниваются в Node — pgvector в образе нет). */
const VECTOR_SCAN_LIMIT = 4000;

export type BrainHit = { fileId: string; fileName: string; folder: string | null; text: string; score: number };

const TYPE_BY_EXT: Record<string, string> = {
  md: 'md', markdown: 'md', txt: 'txt', pdf: 'pdf', csv: 'csv', xlsx: 'xlsx', xls: 'xlsx', docx: 'docx',
  png: 'img', jpg: 'img', jpeg: 'img', webp: 'img',
};

/**
 * «Мозг» ИИ-офиса: файлы и инструкции отделов. Агенты читают отсюда перед каждой задачей
 * (search → блок знаний в промпте) и пишут сюда выводы (brain_write, правило «Записывать выводы»).
 */
@Injectable()
export class AiBrainService {
  private readonly log = new Logger(AiBrainService.name);
  private readonly indexing = new Set<string>();

  constructor(
    @InjectRepository(AiBrainFile) private readonly files: Repository<AiBrainFile>,
    @InjectRepository(AiBrainChunk) private readonly chunks: Repository<AiBrainChunk>,
    @InjectRepository(AiDepartment) private readonly departments: Repository<AiDepartment>,
    private readonly openai: AiOpenAiService,
    private readonly quota: AiQuotaService,
    private readonly storage: StorageQuotaService,
  ) {}

  // ───────────────────────── файлы ─────────────────────────

  private async assertFolder(tenantId: string, departmentId: string | null): Promise<void> {
    if (!departmentId) return;
    const d = await this.departments.findOne({ where: { tenantId, id: departmentId }, select: ['id'] });
    if (!d) throw new BadRequestException('Unknown department folder');
  }

  private async normScope(tenantId: string, scope: unknown, departmentId: string | null): Promise<string[]> {
    const raw = Array.isArray(scope) ? scope.map(String) : [];
    if (!raw.length) return departmentId ? [departmentId] : ['all'];
    if (raw.includes('all')) return ['all'];
    const valid = await this.departments.find({ where: { tenantId, id: In(raw) }, select: ['id'] });
    const ids = valid.map((d) => d.id);
    return ids.length ? ids : departmentId ? [departmentId] : ['all'];
  }

  dto(f: AiBrainFile) {
    return {
      id: f.id,
      folder: f.departmentId ?? 'common',
      name: f.name,
      type: f.type,
      sizeBytes: Number(f.sizeBytes || 0),
      scope: f.scope,
      indexStatus: f.indexStatus,
      indexProgress: f.indexProgress,
      chunkCount: f.chunkCount,
      indexError: f.indexError,
      source: f.source,
      authorAgentId: f.authorAgentId,
      lastReadAt: f.lastReadAt,
      lastReadAgentId: f.lastReadAgentId,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      editable: f.type === 'md',
    };
  }

  async list(tenantId: string, folder?: string | null) {
    const where: any = { tenantId };
    if (folder === 'common') where.departmentId = IsNull();
    else if (folder && folder !== 'all') where.departmentId = folder;
    const rows = await this.files.find({ where, order: { updatedAt: 'DESC' }, take: 1000 });
    return rows.map((f) => this.dto(f));
  }

  async get(tenantId: string, id: string) {
    const f = await this.files.findOne({ where: { tenantId, id } });
    if (!f) throw new NotFoundException('File not found');
    return { ...this.dto(f), bodyMd: f.type === 'md' ? f.bodyMd ?? '' : null, preview: f.type === 'md' ? null : (f.textContent ?? '').slice(0, 4000) };
  }

  async rawFile(tenantId: string, id: string) {
    const f = await this.files.findOne({ where: { tenantId, id } });
    if (!f) throw new NotFoundException('File not found');
    return f;
  }

  async countFor(tenantId: string): Promise<number> {
    return this.files.count({ where: { tenantId } });
  }

  async upload(
    tenantId: string,
    userId: string | null,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    folder: string | null,
    scope?: unknown,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Empty file');
    if (file.size > MAX_FILE_BYTES) throw new BadRequestException('File is larger than 25 MB');
    const departmentId = folder && folder !== 'common' ? folder : null;
    await this.assertFolder(tenantId, departmentId);
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 255) || 'file';
    const ext = extname(name).replace('.', '').toLowerCase();
    const type = TYPE_BY_EXT[ext];
    if (!type) throw new BadRequestException('Supported: .md .txt .pdf .csv .xlsx .docx .png .jpg .webp');
    await this.storage.assertCanAdd(tenantId, file.size);
    const rel = `tenants/${tenantId}/ai-brain/${randomUUID()}.${ext}`;
    const abs = joinUploadsAbsolute(rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, file.buffer);
    const row = await this.files.save(
      this.files.create({
        tenantId,
        departmentId,
        name,
        type,
        mime: file.mimetype || null,
        sizeBytes: String(file.size),
        storagePath: rel,
        bodyMd: type === 'md' ? file.buffer.toString('utf8') : null,
        scope: await this.normScope(tenantId, scope, departmentId),
        indexStatus: 'pending',
        source: 'upload',
        uploadedBy: userId,
      }),
    );
    void this.index(row.id);
    return this.dto(row);
  }

  async createDoc(tenantId: string, input: { name?: string; folder?: string | null; bodyMd?: string; scope?: unknown; userId?: string | null; agentId?: string | null; source?: string }) {
    const departmentId = input.folder && input.folder !== 'common' ? input.folder : null;
    await this.assertFolder(tenantId, departmentId);
    let name = String(input.name || 'Document').trim().slice(0, 240) || 'Document';
    if (!/\.md$/i.test(name)) name += '.md';
    const body = String(input.bodyMd ?? '').slice(0, MAX_TEXT_CHARS);
    const bytes = Buffer.byteLength(body, 'utf8');
    const row = await this.files.save(
      this.files.create({
        tenantId,
        departmentId,
        name,
        type: 'md',
        mime: 'text/markdown',
        sizeBytes: String(bytes),
        bodyMd: body,
        scope: await this.normScope(tenantId, input.scope, departmentId),
        indexStatus: 'pending',
        source: input.source || 'editor',
        uploadedBy: input.userId ?? null,
        authorAgentId: input.agentId ?? null,
      }),
    );
    void this.index(row.id);
    return this.dto(row);
  }

  async update(tenantId: string, id: string, patch: { name?: string; bodyMd?: string; scope?: unknown; folder?: string | null }) {
    const f = await this.files.findOne({ where: { tenantId, id } });
    if (!f) throw new NotFoundException('File not found');
    let reindex = false;
    if (patch.folder !== undefined) {
      const dep = patch.folder && patch.folder !== 'common' ? patch.folder : null;
      await this.assertFolder(tenantId, dep);
      f.departmentId = dep;
    }
    if (patch.name !== undefined) {
      const n = String(patch.name).trim().slice(0, 255);
      if (n) f.name = f.type === 'md' && !/\.md$/i.test(n) ? `${n}.md` : n;
    }
    if (patch.scope !== undefined) f.scope = await this.normScope(tenantId, patch.scope, f.departmentId);
    if (patch.bodyMd !== undefined) {
      if (f.type !== 'md') throw new BadRequestException('Only .md documents are editable');
      f.bodyMd = String(patch.bodyMd).slice(0, MAX_TEXT_CHARS);
      f.sizeBytes = String(Buffer.byteLength(f.bodyMd, 'utf8'));
      f.indexStatus = 'pending';
      reindex = true;
    }
    await this.files.save(f);
    if (reindex) void this.index(f.id);
    return this.dto(f);
  }

  /** Дописать в .md (выводы агента в «Журнал выводов» отдела). Создаёт файл, если его нет. */
  /**
   * Есть ли эта цитата дословно (без учёта регистра, пробелов, кавычек и markdown) в md-файлах «Мозга»,
   * доступных отделу. Основа самостоятельных ответов поддержки: ответ опирается на файл компании.
   */
  async hasQuote(tenantId: string, departmentId: string, quote: string): Promise<boolean> {
    const norm = (v: string) => v.normalize('NFC').toLowerCase().replace(/\u0307/g, '').replace(/[*_`#>«»"“”„']/g, '').replace(/\s+/g, ' ').trim();
    const q = norm(String(quote ?? ''));
    if (q.length < 25) return false;
    const rows: Array<{ ok: boolean }> = await this.chunks.query(
      `SELECT true ok FROM ai_brain_chunks c JOIN ai_brain_files f ON f.id = c.file_id
        WHERE c.tenant_id = $1 AND f.type = 'md' AND f.index_status = 'ready'
          AND (f.scope @> ARRAY['all']::text[] OR f.scope @> ARRAY[$2]::text[] OR f.department_id::text = $2)
          AND position($3 in btrim(regexp_replace(regexp_replace(lower(c.text), '[*_\`#>«»"“”„'']', '', 'g'), '\\s+', ' ', 'g'))) > 0
        LIMIT 1`,
      [tenantId, departmentId, q],
    );
    return rows.length > 0;
  }

  /** Есть ли строка (ссылка, адрес) дословно в любом файле «Мозга», доступном отделу. */
  async hasText(tenantId: string, departmentId: string, text: string): Promise<boolean> {
    const v = String(text ?? '').trim().toLowerCase();
    if (v.length < 6) return false;
    const rows: Array<{ ok: boolean }> = await this.chunks.query(
      `SELECT true ok FROM ai_brain_chunks c JOIN ai_brain_files f ON f.id = c.file_id
        WHERE c.tenant_id = $1 AND (f.scope @> ARRAY['all']::text[] OR f.scope @> ARRAY[$2]::text[] OR f.department_id::text = $2)
          AND position($3 in lower(c.text)) > 0 LIMIT 1`,
      [tenantId, departmentId, v],
    );
    return rows.length > 0;
  }

  async appendToDoc(tenantId: string, departmentId: string | null, name: string, text: string, agentId: string | null) {
    const where: any = { tenantId, name, type: 'md', departmentId: departmentId ?? IsNull() };
    const f = await this.files.findOne({ where });
    if (!f) {
      return this.createDoc(tenantId, { name, folder: departmentId ?? 'common', bodyMd: text, agentId, source: 'agent', scope: departmentId ? [departmentId] : ['all'] });
    }
    // журнал не растёт бесконечно: держим последние ~60 000 символов
    const body = `${f.bodyMd ?? ''}\n\n${text}`.slice(-60_000);
    return this.update(tenantId, f.id, { bodyMd: body });
  }

  async remove(tenantId: string, id: string) {
    const f = await this.files.findOne({ where: { tenantId, id } });
    if (!f) throw new NotFoundException('File not found');
    await this.files.delete({ tenantId, id });
    if (f.storagePath) await unlinkUploadsRelative(f.storagePath).catch(() => undefined);
    return { ok: true };
  }

  // ───────────────────────── индексация ─────────────────────────

  private async extractText(f: AiBrainFile): Promise<string> {
    if (f.type === 'md') return f.bodyMd ?? '';
    if (!f.storagePath) return f.textContent ?? '';
    const buf = await readFile(joinUploadsAbsolute(f.storagePath));
    switch (f.type) {
      case 'txt':
      case 'csv':
        return buf.toString('utf8');
      case 'pdf': {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        const out = await pdfParse(buf);
        return String(out?.text ?? '');
      }
      case 'docx': {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mammoth = require('mammoth');
        const out = await mammoth.extractRawText({ buffer: buf });
        return String(out?.value ?? '');
      }
      case 'xlsx': {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf as any);
        const parts: string[] = [];
        wb.eachSheet((ws) => {
          parts.push(`# ${ws.name}`);
          ws.eachRow({ includeEmpty: false }, (row) => {
            const vals = (row.values as any[]).slice(1).map((v) => {
              if (v == null) return '';
              if (typeof v === 'object') return v.text ?? v.result ?? (v.richText ? v.richText.map((r: any) => r.text).join('') : '') ?? '';
              return String(v);
            });
            parts.push(vals.join(' | '));
          });
        });
        return parts.join('\n');
      }
      case 'img': {
        const mime = f.mime || 'image/png';
        const r = await this.openai.describeImage(`data:${mime};base64,${buf.toString('base64')}`, f.name);
        const cents = this.openai.estimateCostCents(r.promptTokens, r.completionTokens, 0.15, 0.6);
        await this.quota.chargeCents(f.tenantId, cents, { kind: 'chat', model: null, promptTokens: r.promptTokens, completionTokens: r.completionTokens, sessionId: null });
        return r.text;
      }
      default:
        return '';
    }
  }

  private chunkText(text: string): string[] {
    const clean = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!clean) return [];
    const out: string[] = [];
    let i = 0;
    while (i < clean.length) {
      let end = Math.min(clean.length, i + CHUNK_CHARS);
      if (end < clean.length) {
        // режем по абзацу/предложению, если есть рядом
        const win = clean.slice(i + CHUNK_CHARS * 0.6, end);
        const cut = Math.max(win.lastIndexOf('\n\n'), win.lastIndexOf('. '), win.lastIndexOf('\n'));
        if (cut > 0) end = i + Math.floor(CHUNK_CHARS * 0.6) + cut + 1;
      }
      out.push(clean.slice(i, end).trim());
      if (end >= clean.length) break;
      i = Math.max(end - CHUNK_OVERLAP, i + 1);
    }
    return out.filter(Boolean);
  }

  private async setProgress(id: string, patch: Partial<AiBrainFile>) {
    await this.files.update({ id }, patch as any);
  }

  /** Индексация в фоне: текст → фрагменты → эмбеддинги. Прогресс виден в списке файлов. */
  async index(fileId: string): Promise<void> {
    if (this.indexing.has(fileId)) return;
    this.indexing.add(fileId);
    try {
      const f = await this.files.findOne({ where: { id: fileId } });
      if (!f) return;
      await this.setProgress(fileId, { indexStatus: 'indexing', indexProgress: 5, indexError: null });
      const text = (await this.extractText(f)).slice(0, MAX_TEXT_CHARS);
      await this.setProgress(fileId, { textContent: text, indexProgress: 25 });
      const parts = this.chunkText(`${f.name}\n\n${text}`);
      await this.chunks.delete({ fileId });
      const rows = parts.map((t, ord) => this.chunks.create({ tenantId: f.tenantId, fileId, ord, text: t, embedding: null }));
      if (rows.length) await this.chunks.save(rows, { chunk: 200 });
      await this.setProgress(fileId, { indexProgress: 50, chunkCount: rows.length });

      // смысловой поиск — по возможности; без эмбеддингов файл всё равно ищется полнотекстово
      let embedded = 0;
      let embedError: string | null = null;
      for (let b = 0; b < rows.length; b += EMBED_BATCH) {
        const batch = rows.slice(b, b + EMBED_BATCH);
        try {
          const r = await this.openai.embed(batch.map((c) => c.text), EMBED_DIMS);
          for (let k = 0; k < batch.length; k++) {
            await this.chunks.update({ id: batch[k].id }, { embedding: r.vectors[k] });
          }
          embedded += batch.length;
          await this.quota.chargeCents(f.tenantId, r.costCents, { kind: 'embedding', model: 'text-embedding-3-small', promptTokens: r.tokens, completionTokens: 0, sessionId: null, departmentId: f.departmentId }).catch(() => undefined);
        } catch (e) {
          embedError = (e as any)?.response?.message || (e as Error).message;
          break;
        }
        await this.setProgress(fileId, { indexProgress: 50 + Math.round(((b + batch.length) / rows.length) * 48) });
      }
      await this.setProgress(fileId, {
        indexStatus: 'ready',
        indexProgress: 100,
        indexError: embedError && !embedded && rows.length ? `semantic search unavailable: ${String(embedError).slice(0, 200)}` : null,
      });
    } catch (e) {
      this.log.warn(`brain index failed file=${fileId}: ${(e as Error).message}`);
      await this.setProgress(fileId, { indexStatus: 'failed', indexError: (e as Error).message.slice(0, 500) }).catch(() => undefined);
    } finally {
      this.indexing.delete(fileId);
    }
  }

  /** После рестарта: доиндексировать то, что не успело. */
  async resumePending(): Promise<void> {
    const rows = await this.files.find({ where: { indexStatus: In(['pending', 'indexing']) }, select: ['id'], take: 200 });
    for (const r of rows) await this.index(r.id);
  }

  // ───────────────────────── поиск ─────────────────────────

  private cosine(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length && i < b.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }

  /**
   * Гибридный поиск по файлам, доступным отделу (scope 'all' или содержит отдел).
   * Полнотекстовый ранг (Postgres) + косинус эмбеддингов; файлы-инструкции отдела (его папка)
   * получают небольшой бонус.
   */
  async search(tenantId: string, departmentId: string, query: string, k = 6): Promise<BrainHit[]> {
    const q = query.replace(/\s+/g, ' ').trim().slice(0, 2000);
    const scopeSql = `(f.scope @> ARRAY['all']::text[] OR f.scope @> ARRAY[$2]::text[])`;
    const scores = new Map<string, { fileId: string; text: string; s: number }>();

    if (q) {
      const fts: Array<{ id: string; file_id: string; text: string; rank: number }> = await this.chunks.query(
        `SELECT c.id, c.file_id, c.text, ts_rank(c.tsv, websearch_to_tsquery('simple', $3)) AS rank
           FROM ai_brain_chunks c JOIN ai_brain_files f ON f.id = c.file_id
          WHERE c.tenant_id = $1 AND ${scopeSql} AND f.index_status = 'ready'
            AND c.tsv @@ websearch_to_tsquery('simple', $3)
          ORDER BY rank DESC LIMIT 30`,
        [tenantId, departmentId, q.split(' ').slice(0, 30).join(' OR ')],
      );
      const max = Math.max(0.0001, ...fts.map((r) => Number(r.rank)));
      for (const r of fts) scores.set(r.id, { fileId: r.file_id, text: r.text, s: 0.45 * (Number(r.rank) / max) });
    }

    let qv: number[] | null = null;
    if (q) {
      try {
        const r = await this.openai.embed([q], EMBED_DIMS);
        qv = r.vectors[0] ?? null;
        await this.quota.chargeCents(tenantId, r.costCents, { kind: 'embedding', model: 'text-embedding-3-small', promptTokens: r.tokens, completionTokens: 0, sessionId: null, departmentId }).catch(() => undefined);
      } catch {
        qv = null;
      }
    }
    if (qv) {
      const rows: Array<{ id: string; file_id: string; text: string; embedding: number[] }> = await this.chunks.query(
        `SELECT c.id, c.file_id, c.text, c.embedding
           FROM ai_brain_chunks c JOIN ai_brain_files f ON f.id = c.file_id
          WHERE c.tenant_id = $1 AND ${scopeSql} AND f.index_status = 'ready' AND c.embedding IS NOT NULL
          ORDER BY f.updated_at DESC LIMIT ${VECTOR_SCAN_LIMIT}`,
        [tenantId, departmentId],
      );
      for (const r of rows) {
        const sim = this.cosine(qv, r.embedding);
        if (sim < 0.2) continue;
        const prev = scores.get(r.id);
        scores.set(r.id, { fileId: r.file_id, text: r.text, s: (prev?.s ?? 0) + 0.55 * sim });
      }
    }

    // инструкции, лежащие в папке самого отдела, — всегда в контексте (это его регламенты/промты)
    const own: Array<{ id: string; file_id: string; text: string }> = await this.chunks.query(
      `SELECT c.id, c.file_id, c.text FROM ai_brain_chunks c JOIN ai_brain_files f ON f.id = c.file_id
        WHERE c.tenant_id = $1 AND f.department_id = $2 AND f.type = 'md' AND f.source <> 'agent' AND c.ord = 0
        ORDER BY f.updated_at DESC LIMIT 4`,
      [tenantId, departmentId],
    );
    for (const r of own) {
      const prev = scores.get(r.id);
      scores.set(r.id, { fileId: r.file_id, text: r.text, s: (prev?.s ?? 0) + 0.3 });
    }

    const top = [...scores.values()].sort((a, b) => b.s - a.s).slice(0, k);
    if (!top.length) return [];
    const files = await this.files.find({ where: { tenantId, id: In([...new Set(top.map((t) => t.fileId))]) }, select: ['id', 'name', 'departmentId'] });
    const byId = new Map(files.map((f) => [f.id, f]));
    return top
      .filter((t) => byId.has(t.fileId))
      .map((t) => ({ fileId: t.fileId, fileName: byId.get(t.fileId)!.name, folder: byId.get(t.fileId)!.departmentId, text: t.text, score: Math.round(t.s * 1000) / 1000 }));
  }

  /** Отметить, что агент прочитал файлы (колонка «Последнее чтение»). */
  async markRead(tenantId: string, fileIds: string[], agentId: string | null) {
    if (!fileIds.length) return;
    await this.files.update({ tenantId, id: In(fileIds) }, { lastReadAt: new Date(), lastReadAgentId: agentId });
  }

  /** Есть ли в папке отдела (или «Общем») файлы — для проверки запросов «нет данных». */
  async folderHasFiles(tenantId: string, departmentId: string | null): Promise<number> {
    return this.files.count({ where: { tenantId, departmentId: departmentId ?? IsNull() } });
  }
}
