// src/online-chat/consultant-office.service.ts
//
// ИИ-консультант (сайт / WhatsApp / Telegram) ↔ ИИ-офис: знания из «Мозга» выбранных отделов и
// материалы из «Медиа» — ТОЛЬКО ссылками (решение владельца 2026-10-22): на файл, на папку или на весь
// отель/раздел сразу (как кнопка «Поделиться всем»). Вложений ИИ не шлёт.
// Работает, только если у тенанта есть модуль ИИ-офиса (тариф + переключатель в pl1); медиа — ещё и модуль «Медиа».
// Что доступно ИИ, задаёт владелец в профиле консультанта: отделы, папки (с вложенными) и отели/разделы целиком.
// AiBrainService и MediaService берём лениво через ModuleRef — прямые импорты модулей дают цикл DI.
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AiAgent } from '../ai-employees/ai-agent.entity';
import { Tenant } from '../tenants/tenant.entity';
import { isComponentAllowedByPlan } from '../tenants/plan-entitlements';
import type { AiBrainService } from '../ai-office/ai-brain.service';
import type { MediaService } from '../media/media.service';

export type ConsultantOfficeConfig = {
  /** Чьи файлы «Мозга» читает консультант: папки этих отделов + (по галочке) общие файлы офиса. */
  brain: { departmentIds: string[]; includeShared: boolean };
  /** Что из «Медиа» ИИ может отдавать ссылками: папки (с вложенными) и отели/разделы целиком (вместе с будущими папками). */
  media: { enabled: boolean; folderIds: string[]; hotelIds: string[]; collectionIds: string[] };
};

export type OfficeChannel = 'site' | 'whatsapp' | 'telegram';

type Ref =
  | { type: 'place'; id: string; name: string; hotelId: string | null; folderIds: string[] }
  | { type: 'folder'; id: string; name: string; hotelId: string | null }
  | { type: 'file'; id: string; name: string; hotelId: string | null };

/** Медиа в рамках одного ответа: что можно и какие ссылки уже выданы. */
export type MediaRun = {
  channel: OfficeChannel;
  dryRun: boolean;
  /** Разрешённые папки — выбранные, папки выбранных отелей/разделов и всё внутри. */
  folderIds: string[];
  /** Для промпта: отели/разделы целиком (P…) и папки (D…). */
  places: Array<{ ref: string; name: string; folders: number; files: number }>;
  tree: Array<{ ref: string; id: string; parentId: string | null; path: string; files: number }>;
  refs: Map<string, Ref>;
  fileSeq: number;
  /** Ссылки, выданные инструментами в этом ответе: только их ИИ может вставить в текст. */
  links: string[];
  trace: string[];
};

export type OfficeRun = { brainBlock: string; brainFiles: string[]; media: MediaRun | null };

const MAX_TREE_LINES = 150;
/** send_file — старое имя file_link (модель может его вспомнить): тоже только ссылка. */
const MEDIA_TOOLS = new Set(['media_list', 'media_find', 'file_link', 'send_file', 'folder_link']);
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanIds = (a: unknown, max = 300): string[] =>
  Array.isArray(a) ? [...new Set(a.map((x) => String(x || '').trim()).filter((x) => uuidRe.test(x)))].slice(0, max) : [];
const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

@Injectable()
export class ConsultantOfficeService {
  private readonly log = new Logger(ConsultantOfficeService.name);

  constructor(
    @InjectRepository(AiAgent) private readonly agents: Repository<AiAgent>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly moduleRef: ModuleRef,
  ) {}

  private lazy<T>(path: string, name: string): T | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Svc = require(path)[name];
      return this.moduleRef.get(Svc, { strict: false });
    } catch {
      return null;
    }
  }
  private brain() {
    return this.lazy<AiBrainService>('../ai-office/ai-brain.service', 'AiBrainService');
  }
  private mediaSvc() {
    return this.lazy<MediaService>('../media/media.service', 'MediaService');
  }
  private q<T = any>(sql: string, params: unknown[]): Promise<T[]> {
    return this.agents.manager.query(sql, params);
  }

  // ───────────────────────── настройки ─────────────────────────

  readConfig(agent: AiAgent | null): ConsultantOfficeConfig {
    const raw = ((agent?.settings as any)?.officeLink || {}) as any;
    return {
      brain: { departmentIds: cleanIds(raw.brain?.departmentIds, 50), includeShared: raw.brain?.includeShared === true },
      media: {
        enabled: raw.media?.enabled === true,
        folderIds: cleanIds(raw.media?.folderIds),
        hotelIds: cleanIds(raw.media?.hotelIds),
        collectionIds: cleanIds(raw.media?.collectionIds),
      },
    };
  }

  /** Модули у тенанта: ИИ-офис (условие всей связки) и «Медиа». */
  async modules(tenantId: string): Promise<{ office: boolean; media: boolean }> {
    const t = await this.tenants.findOne({ where: { id: tenantId }, select: ['id', 'plan', 'enabledComponents'] as any });
    const on = (key: string) => !!t && isComponentAllowedByPlan(key, t.plan) && (t.enabledComponents as any)?.[key] !== false;
    return { office: on('ai_office'), media: on('ai_office') && on('media') };
  }

  /** Для панели в профиле: настройки + что есть у тенанта (отделы, дерево медиатеки). */
  async getSettings(tenantId: string, agent: AiAgent) {
    const config = this.readConfig(agent);
    const mods = await this.modules(tenantId);
    const departments = mods.office
      ? await this.q<{ id: string; name: string; color: string; files: number }>(
          `SELECT d.id, d.name, d.color,
                  (SELECT count(*)::int FROM ai_brain_files f WHERE f.tenant_id = d.tenant_id AND f.source <> 'agent'
                      AND (f.department_id = d.id OR f.scope @> ARRAY[d.id::text])) AS files
             FROM ai_departments d WHERE d.tenant_id = $1 ORDER BY d.sort, d.created_at`,
          [tenantId],
        )
      : [];
    const [{ n: sharedFiles } = { n: 0 }] = mods.office
      ? await this.q<{ n: number }>(
          `SELECT count(*)::int AS n FROM ai_brain_files WHERE tenant_id = $1 AND source <> 'agent' AND scope @> ARRAY['all']::text[]`,
          [tenantId],
        )
      : [];
    const media = mods.media
      ? {
          hotels: await this.q<{ id: string; name: string }>(`SELECT id, name FROM hotels WHERE "tenantId" = $1 ORDER BY name`, [tenantId]),
          collections: await this.q<{ id: string; name: string }>(`SELECT id, name FROM media_collections WHERE "tenantId" = $1 ORDER BY name`, [tenantId]),
          folders: await this.q<{ id: string; name: string; parentId: string | null; hotelId: string | null; collectionId: string | null; files: number }>(
            `SELECT d.id, d.name, d."parentId", d."hotelId", d."collectionId",
                    (SELECT count(*)::int FROM media_files f WHERE f."folderId" = d.id) AS files
               FROM media_folders d WHERE d."tenantId" = $1 ORDER BY d.name`,
            [tenantId],
          ),
        }
      : null;
    return { config, status: { officeAvailable: mods.office, mediaAvailable: mods.media, departments, sharedFiles, media } };
  }

  async updateSettings(tenantId: string, agent: AiAgent, body: Partial<ConsultantOfficeConfig>) {
    const cur = this.readConfig(agent);
    const m = body.media;
    const next: ConsultantOfficeConfig = {
      brain: {
        departmentIds: body.brain?.departmentIds !== undefined ? cleanIds(body.brain.departmentIds, 50) : cur.brain.departmentIds,
        includeShared: body.brain?.includeShared !== undefined ? !!body.brain.includeShared : cur.brain.includeShared,
      },
      media: {
        enabled: m?.enabled !== undefined ? !!m.enabled : cur.media.enabled,
        folderIds: m?.folderIds !== undefined ? cleanIds(m.folderIds) : cur.media.folderIds,
        hotelIds: m?.hotelIds !== undefined ? cleanIds(m.hotelIds) : cur.media.hotelIds,
        collectionIds: m?.collectionIds !== undefined ? cleanIds(m.collectionIds) : cur.media.collectionIds,
      },
    };
    // только свои отделы, папки, отели и разделы
    const own = async (sql: string, ids: string[]) =>
      ids.length ? (await this.q<{ id: string }>(sql, [tenantId, ids])).map((r) => r.id).filter((id) => ids.includes(id)) : [];
    next.brain.departmentIds = await own(`SELECT id FROM ai_departments WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, next.brain.departmentIds);
    next.media.folderIds = await own(`SELECT id FROM media_folders WHERE "tenantId" = $1 AND id = ANY($2::uuid[])`, next.media.folderIds);
    next.media.hotelIds = await own(`SELECT id FROM hotels WHERE "tenantId" = $1 AND id = ANY($2::uuid[])`, next.media.hotelIds);
    next.media.collectionIds = await own(`SELECT id FROM media_collections WHERE "tenantId" = $1 AND id = ANY($2::uuid[])`, next.media.collectionIds);
    if (next.media.enabled && !next.media.folderIds.length && !next.media.hotelIds.length && !next.media.collectionIds.length) {
      throw new BadRequestException('Выберите хотя бы одну папку, отель или раздел медиатеки');
    }
    await this.agents.manager.query(
      `UPDATE ai_agents SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('officeLink', $2::jsonb) WHERE id = $1`,
      [agent.id, JSON.stringify(next)],
    );
    const fresh = await this.agents.findOne({ where: { id: agent.id, tenantId } });
    if (!fresh) throw new NotFoundException('AI employee not found');
    return this.getSettings(tenantId, fresh);
  }

  // ───────────────────────── ответ клиенту ─────────────────────────

  /** Подготовка к одному ответу: знания из «Мозга» по вопросу клиента и (если включено) медиа. */
  async prepare(
    tenantId: string,
    agent: AiAgent,
    opts: { channel: OfficeChannel; dryRun: boolean; query: string },
  ): Promise<OfficeRun | null> {
    const cfg = this.readConfig(agent);
    // личный «Мозг» консультанта (вкладка «Мозг» в профиле): файлы людей — без заметок самого ИИ,
    // ответы клиенту строятся только на том, что положила компания. Работает и без ИИ-офиса.
    const own = await this.ownBrain(tenantId, agent, opts);
    const wantsBrain = cfg.brain.departmentIds.length > 0 || cfg.brain.includeShared;
    if (!wantsBrain && !cfg.media.enabled) return own.block ? { brainBlock: own.block, brainFiles: own.files, media: null } : null;
    const mods = await this.modules(tenantId);
    if (!mods.office) return own.block ? { brainBlock: own.block, brainFiles: own.files, media: null } : null;

    let brainBlock = '';
    let brainFiles: string[] = [];
    const brain = wantsBrain ? this.brain() : null;
    if (brain && opts.query.trim()) {
      try {
        const hits = await brain.searchForClient(tenantId, cfg.brain.departmentIds, opts.query, { includeShared: cfg.brain.includeShared, k: 6 });
        let budget = 6000;
        const parts: string[] = [];
        for (const h of hits) {
          const piece = `— ${h.fileName}:\n${h.text.trim()}`;
          if (piece.length > budget) break;
          budget -= piece.length;
          parts.push(piece);
        }
        brainBlock = parts.join('\n\n');
        brainFiles = [...new Set(hits.slice(0, parts.length).map((h) => h.fileId))];
        if (brainFiles.length && !opts.dryRun) await brain.markRead(tenantId, brainFiles, agent.id).catch(() => undefined);
      } catch (e) {
        this.log.warn(`brain search failed for ${tenantId}: ${(e as Error).message}`);
      }
    }

    const anyMedia = cfg.media.folderIds.length + cfg.media.hotelIds.length + cfg.media.collectionIds.length > 0;
    const media = cfg.media.enabled && mods.media && anyMedia ? await this.prepareMedia(tenantId, cfg, opts) : null;
    if (own.block) {
      brainBlock = brainBlock ? `${own.block}\n\n${brainBlock}` : own.block;
      brainFiles = [...new Set([...own.files, ...brainFiles])];
    }
    if (!brainBlock && !media) return null;
    return { brainBlock, brainFiles, media };
  }

  /** Файлы людей из личной папки консультанта: md целиком (до лимита), загруженные — по вопросу. */
  private async ownBrain(tenantId: string, agent: AiAgent, opts: { dryRun: boolean; query: string }): Promise<{ block: string; files: string[] }> {
    const brain = this.brain();
    if (!brain) return { block: '', files: [] };
    try {
      const docs = (await brain.agentDocs(tenantId, agent.id)).filter((d) => d.source !== 'agent' && d.body.trim());
      let budget = 6000;
      const parts: string[] = [];
      const files: string[] = [];
      for (const d of docs) {
        const body = d.body.trim();
        const piece = `— ${d.name}:\n${body.length > budget ? body.slice(0, Math.max(0, budget - 20)) : body}`;
        parts.push(piece);
        files.push(d.id);
        budget -= piece.length;
        if (budget <= 200) break;
      }
      if (opts.query.trim() && budget > 400) {
        for (const h of await brain.searchAgentFiles(tenantId, agent.id, opts.query, 3)) {
          const piece = `— ${h.fileName}:\n${h.text.trim()}`;
          if (piece.length > budget) break;
          budget -= piece.length;
          parts.push(piece);
          files.push(h.fileId);
        }
      }
      if (files.length && !opts.dryRun) await brain.markRead(tenantId, [...new Set(files)], agent.id).catch(() => undefined);
      return { block: parts.join('\n\n'), files: [...new Set(files)] };
    } catch (e) {
      this.log.warn(`own brain failed for ${agent.id}: ${(e as Error).message}`);
      return { block: '', files: [] };
    }
  }

  private async prepareMedia(tenantId: string, cfg: ConsultantOfficeConfig, opts: { channel: OfficeChannel; dryRun: boolean }): Promise<MediaRun | null> {
    const svc = this.mediaSvc();
    if (!svc) return null;
    // корневые папки отелей/разделов, выбранных целиком, — каждый раз заново (новые папки попадают сами)
    const placeRoots = cfg.media.hotelIds.length || cfg.media.collectionIds.length
      ? (await this.q<{ id: string }>(
          `SELECT id FROM media_folders WHERE "tenantId" = $1 AND "parentId" IS NULL
              AND ("hotelId" = ANY($2::uuid[]) OR ("hotelId" IS NULL AND "collectionId" = ANY($3::uuid[])))`,
          [tenantId, cfg.media.hotelIds, cfg.media.collectionIds],
        )).map((r) => r.id)
      : [];
    const folderIds = await svc.subtreeIds(tenantId, [...cfg.media.folderIds, ...placeRoots]);
    if (!folderIds.length) return null;
    const allowed = new Set(folderIds);
    const rows = await this.q<{ id: string; name: string; parentId: string | null; hotelId: string | null; collectionId: string | null; hotel: string | null; coll: string | null; files: number }>(
      `SELECT d.id, d.name, d."parentId", d."hotelId", d."collectionId", h.name AS hotel, c.name AS coll,
              (SELECT count(*)::int FROM media_files f WHERE f."folderId" = d.id) AS files
         FROM media_folders d
         LEFT JOIN hotels h ON h.id = d."hotelId"
         LEFT JOIN media_collections c ON c.id = d."collectionId"
        WHERE d."tenantId" = $1 AND d.id = ANY($2::uuid[])`,
      [tenantId, folderIds],
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    const pathOf = (r: (typeof rows)[number]): string => {
      const names: string[] = [];
      let cur: (typeof rows)[number] | undefined = r;
      for (let i = 0; cur && i < 12; i++) {
        names.unshift(cur.name);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
      const place = r.hotel || r.coll;
      return (place ? `${place} › ` : '') + names.join(' › ');
    };
    const refs = new Map<string, Ref>();

    // отель/раздел целиком — когда ИИ доступны ВСЕ его корневые папки (ссылка «Поделиться всем»)
    const allRoots = await this.q<{ id: string; hotelId: string | null; collectionId: string | null }>(
      `SELECT id, "hotelId", "collectionId" FROM media_folders WHERE "tenantId" = $1 AND "parentId" IS NULL AND ("hotelId" IS NOT NULL OR "collectionId" IS NOT NULL)`,
      [tenantId],
    );
    const placeKeys = new Map<string, { hotelId: string | null; name: string; roots: string[] }>();
    for (const r of rows) {
      const key = r.hotelId ? `h:${r.hotelId}` : r.collectionId ? `c:${r.collectionId}` : null;
      if (!key || placeKeys.has(key)) continue;
      const roots = allRoots.filter((x) => (r.hotelId ? x.hotelId === r.hotelId : !x.hotelId && x.collectionId === r.collectionId)).map((x) => x.id);
      if (roots.length && roots.every((id) => allowed.has(id))) placeKeys.set(key, { hotelId: r.hotelId, name: (r.hotel || r.coll) as string, roots });
    }
    const places: MediaRun['places'] = [];
    [...placeKeys.entries()]
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .forEach(([key, p], i) => {
        const ref = `P${i + 1}`;
        const inside = rows.filter((r) => (p.hotelId ? r.hotelId === p.hotelId : `c:${r.collectionId}` === key));
        refs.set(ref, { type: 'place', id: key, name: p.name, hotelId: p.hotelId, folderIds: p.roots });
        places.push({ ref, name: p.name, folders: inside.length, files: inside.reduce((s, r) => s + r.files, 0) });
      });

    const tree = rows
      .map((r) => ({ id: r.id, parentId: r.parentId, hotelId: r.hotelId, path: pathOf(r), files: r.files, name: r.name }))
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, MAX_TREE_LINES)
      .map((r, i) => {
        refs.set(`D${i + 1}`, { type: 'folder', id: r.id, name: r.name, hotelId: r.hotelId });
        return { ref: `D${i + 1}`, id: r.id, parentId: r.parentId, path: r.path, files: r.files };
      });
    return { channel: opts.channel, dryRun: opts.dryRun, folderIds, places, tree, refs, fileSeq: 0, links: [], trace: [] };
  }

  isMediaTool(name: unknown): boolean {
    return typeof name === 'string' && MEDIA_TOOLS.has(name);
  }

  /** Блок промпта: что лежит в медиатеке и как дать на это ссылку. */
  mediaPrompt(run: MediaRun): string {
    return `MEDIA LIBRARY IS CONNECTED — you can share the company's photos, videos and documents with the visitor as LINKS (never as attachments).
${run.places.length ? `Whole hotels / sections (ref · name · folders · files):\n${run.places.map((p) => `${p.ref} · ${p.name} · ${p.folders} · ${p.files}`).join('\n')}\n` : ''}Folders (ref · path · files):
${run.tree.map((t) => `${t.ref} · ${t.path} · ${t.files}`).join('\n')}
Media tools (respond with "tool" set to ONE of these, then continue from the TOOL RESULT):
- {"name":"folder_link","ref":"P1"} — ONE public link to everything of a hotel/section (all its folders). Use it for "photos of the hotel", "show me the hotel", "everything about X".
- {"name":"folder_link","ref":"D1"} — a public link to one folder (gallery + download), e.g. only rooms, only the beach.
- {"name":"media_list","ref":"D1"} — files and subfolders of a folder or hotel (gives file refs F1, F2…)
- {"name":"media_find","query":"words from file names"} — search file names in all allowed folders
- {"name":"file_link","ref":"F1"} — a direct link to ONE file (a menu, a presentation, a price list, one specific photo)
Media rules:
- Share materials when the visitor asks for photos, videos, a presentation, a price list, a menu, a brochure or similar — or when one clearly answers their question.
- Prefer ONE link: the whole hotel (P-ref) for general requests, a folder (D-ref) for a topic, a file link for one specific document.
- Pick by meaning (the visitor may write in another language than the folder names). If the folder you need has 0 files, use the hotel link or say honestly there are no such materials yet.
- Put links into "reply" EXACTLY as returned by a tool. Never invent or shorten URLs.`;
  }

  private nextFileRef(run: MediaRun, f: { id: string; name: string; hotelId: string | null }): string {
    for (const [k, v] of run.refs) if (v.type === 'file' && v.id === f.id) return k;
    const key = `F${++run.fileSeq}`;
    run.refs.set(key, { type: 'file', ...f });
    return key;
  }

  async runMediaTool(run: MediaRun, tenantId: string, agent: AiAgent, tool: Record<string, any>): Promise<Record<string, any>> {
    const name = String(tool.name || '');
    const ref = (k: unknown) => run.refs.get(String(k || '').trim().toUpperCase());
    const hotelOf = (folderId: string) => (run.refs.get(run.tree.find((t) => t.id === folderId)?.ref || '') as { hotelId?: string | null } | undefined)?.hotelId ?? null;
    const fileRow = (f: { id: string; name: string; kind: string; sizeBytes: string; folderId: string }) => ({
      ref: this.nextFileRef(run, { id: f.id, name: f.name, hotelId: hotelOf(f.folderId) }),
      name: f.name,
      kind: f.kind,
      size: fmtSize(Number(f.sizeBytes)),
    });
    const out = await (async (): Promise<Record<string, any>> => {
      if (name === 'media_list') {
        const r = ref(tool.ref);
        if (!r || r.type === 'file') return { ok: false, error: 'Unknown folder ref — use a D- or P-ref from the list' };
        const parents = r.type === 'place' ? r.folderIds : [r.id];
        const files = await this.q<{ id: string; name: string; kind: string; sizeBytes: string; folderId: string }>(
          `SELECT id, name, kind, "sizeBytes", "folderId" FROM media_files WHERE "tenantId" = $1 AND "folderId" = ANY($2::uuid[]) ORDER BY name LIMIT 60`,
          [tenantId, parents],
        );
        const subs = run.tree.filter((t) => (r.type === 'place' ? parents.includes(t.id) : t.parentId === r.id));
        return { ok: true, name: r.name, subfolders: subs.map((s) => ({ ref: s.ref, path: s.path, files: s.files })), files: files.map(fileRow) };
      }
      if (name === 'media_find') {
        const terms = String(tool.query || '').toLowerCase().split(/[\s,.;:!?"'()]+/).filter((w) => w.length >= 2).slice(0, 8);
        if (!terms.length) return { ok: false, error: 'Empty query' };
        const files = await this.q<{ id: string; name: string; kind: string; sizeBytes: string; folderId: string }>(
          `SELECT id, name, kind, "sizeBytes", "folderId" FROM media_files
            WHERE "tenantId" = $1 AND "folderId" = ANY($2::uuid[]) AND name ILIKE ANY($3::text[])
            ORDER BY "createdAt" DESC LIMIT 30`,
          [tenantId, run.folderIds, terms.map((t) => `%${t}%`)],
        );
        const pathById = new Map(run.tree.map((t) => [t.id, t.path]));
        return { ok: true, files: files.map((f) => ({ ...fileRow(f), folder: pathById.get(f.folderId) || '' })) };
      }
      if (name === 'file_link' || name === 'send_file') {
        const r = ref(tool.ref);
        if (!r || r.type !== 'file') return { ok: false, error: 'Unknown file ref — list a folder or search first' };
        const url = await this.linkFor(run, tenantId, agent, { folderIds: [], fileIds: [r.id], hotelId: r.hotelId }, r.name);
        return url ? { ok: true, url, file: r.name } : { ok: false, error: 'Could not create a link' };
      }
      if (name === 'folder_link') {
        const r = ref(tool.ref);
        if (!r || r.type === 'file') return { ok: false, error: 'Unknown folder ref' };
        const folderIds = r.type === 'place' ? r.folderIds : [r.id];
        const url = await this.linkFor(run, tenantId, agent, { folderIds, fileIds: [], hotelId: r.hotelId }, r.name);
        return url ? { ok: true, url, [r.type === 'place' ? 'hotel' : 'folder']: r.name } : { ok: false, error: 'Could not create a link' };
      }
      return { ok: false, error: 'Unknown media tool' };
    })().catch((e) => ({ ok: false, error: (e as Error).message }));
    run.trace.push(`${JSON.stringify(tool)} => ${JSON.stringify(out)}`.slice(0, 600));
    return out;
  }

  /**
   * Публичная ссылка: берём готовую без формы и пароля (включена, не истекла, ровно этот набор папок/файлов —
   * в т.ч. сделанную вручную «Поделиться всем»), иначе создаём такую же. Клиент в мессенджере уже известен —
   * форма «оставьте контакты» ему лишняя. В тесте новые ссылки не создаются.
   */
  private async linkFor(
    run: MediaRun,
    tenantId: string,
    agent: AiAgent,
    set: { folderIds: string[]; fileIds: string[]; hotelId: string | null },
    title: string,
  ): Promise<string | null> {
    const svc = this.mediaSvc();
    if (!svc) return null;
    const base = await svc.publicBase(tenantId);
    const folders = JSON.stringify(set.folderIds);
    const files = JSON.stringify(set.fileIds);
    const [hit] = await this.q<{ slug: string }>(
      `SELECT slug FROM media_links
        WHERE "tenantId" = $1 AND enabled = true AND gate = false AND "passwordHash" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > now())
          AND "folderIds" @> $2::jsonb AND "folderIds" <@ $2::jsonb AND "fileIds" @> $3::jsonb AND "fileIds" <@ $3::jsonb
        ORDER BY "createdAt" DESC LIMIT 1`,
      [tenantId, folders, files],
    );
    let url: string;
    if (hit) url = base + hit.slug;
    else if (run.dryRun) url = `${base}<new-link>`;
    else {
      const prefix = { ru: 'ИИ', en: 'AI', tr: 'YZ' }[this.lang(agent)];
      const link = await svc.createLink(tenantId, null, {
        name: `${prefix} · ${title}`.slice(0, 200),
        title: title.slice(0, 200),
        scope: set.hotelId ? 'hotel' : 'agency',
        hotelIds: set.hotelId ? [set.hotelId] : [],
        folderIds: set.folderIds,
        fileIds: set.fileIds,
        gate: false,
        allowZip: true,
      });
      if (!link?.url) return null;
      url = link.url;
    }
    run.links.push(url);
    return url;
  }

  /** Ссылки на /m/…, которые модель «придумала» (их не выдавал инструмент), из ответа убираем. */
  sanitizeReply(run: MediaRun | null, reply: string): string {
    return reply.replace(/https?:\/\/[^\s)]+\/m\/[^\s)]+/g, (u) => {
      const clean = u.replace(/[.,!?;:]+$/, '');
      if (run?.links.includes(clean)) return u;
      if (run && run.links.length === 1) return run.links[0];
      return '';
    });
  }

  private lang(agent: AiAgent): 'ru' | 'en' | 'tr' {
    const l = String(agent.language || '').trim();
    return l === 'Russian' ? 'ru' : l === 'Turkish' ? 'tr' : 'en';
  }
}
