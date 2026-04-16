// src/modules/ccp/ccp.service.ts
import { BadRequestException, Inject, Injectable, Scope } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { CcpSiteEntity } from './entities/ccp-site.entity';
import { CcpClientEntity } from './entities/ccp-client.entity';
import { CcpTxnEntity } from './entities/ccp-txn.entity';
import { CcpTransferEntity } from './entities/ccp-transfer.entity';

import { CcpIngestDto } from './dto/ingest.dto';
import { UpdateCcpClientDto } from './dto/update-client.dto';
import { UpdateCcpTxnDto } from './dto/update-txn.dto';
import { UpdateCcpTransferDto } from './dto/update-transfer.dto';
import { CreateCcpClientDto } from './dto/create-client.dto';
import { CreateCcpTxnDto } from './dto/create-txn.dto';
import { CreateCcpTransferDto } from './dto/create-transfer.dto';

import { CcpWpClient } from './ccp.wp-client';

// ✅ твоя entity токенов (реальная)
import { ApiToken } from '../../api-tokens/api-token.entity';

function hostFromUrl(u: string): string | null {
  try {
    return new URL(u).host;
  } catch {
    return null;
  }
}

function toNum(v: any, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function toStr(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function lowerEmail(v: any): string {
  return String(v ?? '').toLowerCase().trim();
}

/**
 * scope REQUEST нужен, чтобы в connect-by-token взять tenantId из req.tenantId
 * (его ставит XApiTokenGuard).
 */
@Injectable({ scope: Scope.REQUEST })
export class CcpService {
  constructor(
    @InjectRepository(CcpSiteEntity) private sites: Repository<CcpSiteEntity>,
    @InjectRepository(CcpClientEntity) private clients: Repository<CcpClientEntity>,
    @InjectRepository(CcpTxnEntity) private txns: Repository<CcpTxnEntity>,
    @InjectRepository(CcpTransferEntity) private transfers: Repository<CcpTransferEntity>,

    @InjectRepository(ApiToken) private apiTokens: Repository<ApiToken>,

    @Inject(REQUEST) private readonly req: Request,
  ) {}

  /** tenantId, если вызвали public connect-by-token */
  private tenantIdFromReq(): string {
    const anyReq: any = this.req as any;
    const tid = anyReq?.tenantId;
    if (!tid) throw new BadRequestException('Missing tenantId (X-Api-Token guard did not set it)');
    return String(tid);
  }

  /** ===== helpers ===== */

  private normalizeSiteUrl(siteUrl: string) {
    const clean = String(siteUrl || '').trim();
    if (!clean) return '';
    return clean.endsWith('/') ? clean : clean + '/';
  }

  private wpRestBaseFromSiteUrl(siteUrl: string) {
    const clean = this.normalizeSiteUrl(siteUrl);
    return clean.replace(/\/+$/, '') + '/wp-json/ccp/v1';
  }

  /** ============ SITES ============ */
  async upsertSiteByUrl(tenantId: string, siteUrl: string) {
    const clean = this.normalizeSiteUrl(siteUrl);
    const ex = await this.sites.findOne({ where: { tenantId, siteUrl: clean } });
    if (ex) return ex;

    const s = this.sites.create({
      tenantId,
      siteUrl: clean,
      siteHost: hostFromUrl(clean),
      wpRestBase: this.wpRestBaseFromSiteUrl(clean),
      wpToken: null,
      isActive: true,
    });
    return await this.sites.save(s);
  }

  async setSiteWpAccess(tenantId: string, siteId: string, wpRestBase: string, wpToken: string) {
    const s = await this.sites.findOne({ where: { tenantId, id: siteId } });
    if (!s) throw new Error('Site not found');

    s.wpRestBase = String(wpRestBase || '').trim();
    s.wpToken = String(wpToken || '').trim();

    return await this.sites.save(s);
  }

  /**
   * ✅ Вариант 1: WP сам дергает CRM и подключает сайт к tenant по X-Api-Token
   * POST /v1/ccp/sites/connect-by-token
   */
  async connectSiteWpByXApiToken(body: { siteUrl: string; wpRestBase: string; wpToken: string }) {
    const tenantId = this.tenantIdFromReq();

    const siteUrl = this.normalizeSiteUrl(body?.siteUrl || '');
    const wpRestBase = String(body?.wpRestBase || '').trim() || this.wpRestBaseFromSiteUrl(siteUrl);
    const wpToken = String(body?.wpToken || '').trim();

    if (!siteUrl) throw new BadRequestException('siteUrl is required');
    if (!wpRestBase) throw new BadRequestException('wpRestBase is required');
    if (!wpToken) throw new BadRequestException('wpToken is required');

    const site = await this.upsertSiteByUrl(tenantId, siteUrl);

    // test WP token
    const wp = new CcpWpClient(wpRestBase, wpToken);
    await wp.get('/meta');

    const saved = await this.setSiteWpAccess(tenantId, site.id, wpRestBase, wpToken);

    if (!saved.wpToken) {
      throw new Error('Failed to persist wpToken into ccp_sites (db save returned empty token)');
    }

    return saved;
  }

  /** ============ INGEST from WP ============ */
  async ingest(tenantId: string, dto: CcpIngestDto) {
    const siteUrl = this.normalizeSiteUrl(dto.site || '');
    if (!siteUrl) throw new Error('site is required in payload');

    const site = await this.upsertSiteByUrl(tenantId, siteUrl);

    if (dto.type === 'client.upsert') {
      return await this.ingestClient(tenantId, site.id, dto.data);
    }
    if (dto.type === 'txn.upsert') {
      return await this.ingestTxn(tenantId, site.id, dto.data);
    }
    if (dto.type === 'transfer.upsert') {
      return await this.ingestTransfer(tenantId, site.id, dto.data);
    }

    throw new Error(`Unknown ingest type: ${dto.type}`);
  }

  private async ingestClient(tenantId: string, siteId: string, data: any) {
    const wpUserId = toNum(data?.id ?? data?.wpUserId);
    if (!Number.isFinite(wpUserId) || wpUserId <= 0) throw new Error('client wpUserId missing');

    const email = lowerEmail(data?.email);
    const name = data?.name != null ? String(data.name) : null;

    const meta = data?.meta || {};

    const balanceEur = String(meta?.ccp_acc_eur_balance ?? meta?.ccp_balance_eur ?? 0);
    const balanceUsd = String(meta?.ccp_acc_usd_balance ?? meta?.ccp_balance_usd ?? 0);

    const accountEur = toStr(meta?.ccp_acc_eur_number);
    const accountUsd = toStr(meta?.ccp_acc_usd_number);

    const analyticsUrl = toStr(meta?.ccp_analytics_url);
    const filesList = meta?.ccp_files_list != null ? String(meta.ccp_files_list) : null;
    const tgChatId = toStr(meta?.ccp_tg_chat_id);

    const ibanEur = toStr(meta?.ccp_iban_eur);
    const ibanUsd = toStr(meta?.ccp_iban_usd);

    const ex = await this.clients.findOne({ where: { tenantId, siteId, wpUserId } });

    const ent =
      ex ??
      this.clients.create({
        tenantId,
        siteId,
        wpUserId,
        email: email || 'unknown@example.com',
        name,
      });

    if (email) ent.email = email;
    ent.name = name ?? ent.name;

    ent.balanceEur = balanceEur;
    ent.balanceUsd = balanceUsd;

    (ent as any).accountEur = accountEur;
    (ent as any).accountUsd = accountUsd;
    (ent as any).analyticsUrl = analyticsUrl;
    (ent as any).filesList = filesList;
    (ent as any).tgChatId = tgChatId;

    ent.ibanEur = ibanEur;
    ent.ibanUsd = ibanUsd;

    ent.wpUpdatedAt = new Date();

    return await this.clients.save(ent);
  }

  private async ingestTxn(tenantId: string, siteId: string, data: any) {
  const wpPostId = toNum(data?.id ?? data?.wpPostId);
  if (!Number.isFinite(wpPostId) || wpPostId <= 0) throw new Error('txn wpPostId missing');

  const meta = (data?.meta && typeof data.meta === 'object') ? data.meta : {};

  const ex = await this.txns.findOne({ where: { tenantId, siteId, wpPostId } });
  const ent = ex ?? this.txns.create({ tenantId, siteId, wpPostId });

  if (data?.title != null) ent.title = String(data.title);
  if (data?.status != null) ent.status = String(data.status);

  // wpUserId — обновляем только если пришёл нормальный id
  const nextWpUserId = meta?.ccp_user_id != null ? toNum(meta.ccp_user_id) : undefined;
  if (nextWpUserId !== undefined && Number.isFinite(nextWpUserId) && nextWpUserId > 0) {
    ent.wpUserId = nextWpUserId;
  }

  // ❗ НЕ затираем 0-ми: обновляем только если meta реально прислала значения
  if (meta?.ccp_spend_eur != null && String(meta.ccp_spend_eur) !== '') {
    ent.spendEur = String(meta.ccp_spend_eur);
  }
  if (meta?.ccp_spend_usd != null && String(meta.ccp_spend_usd) !== '') {
    ent.spendUsd = String(meta.ccp_spend_usd);
  }

  if (meta?.ccp_date != null && String(meta.ccp_date) !== '') ent.date = String(meta.ccp_date);
  if (meta?.ccp_desc != null && String(meta.ccp_desc) !== '') ent.desc = String(meta.ccp_desc);
  if (meta?.ccp_status != null && String(meta.ccp_status) !== '') ent.ccpStatus = String(meta.ccp_status);

  return await this.txns.save(ent);
}

  private async ingestTransfer(tenantId: string, siteId: string, data: any) {
  const wpPostId = toNum(data?.id ?? data?.wpPostId);
  if (!Number.isFinite(wpPostId) || wpPostId <= 0) throw new Error('transfer wpPostId missing');

  const meta = (data?.meta && typeof data.meta === 'object') ? data.meta : {};

  const ex = await this.transfers.findOne({ where: { tenantId, siteId, wpPostId } });
  const ent = ex ?? this.transfers.create({ tenantId, siteId, wpPostId });

  if (data?.title != null) ent.title = String(data.title);
  if (data?.status != null) ent.status = String(data.status);

  // amount/rate
  const nextAmount =
    meta?.ccp_tr_amount != null && String(meta.ccp_tr_amount) !== ''
      ? toNum(meta.ccp_tr_amount)
      : undefined;

  const nextRate =
    meta?.ccp_tr_rate != null && String(meta.ccp_tr_rate) !== ''
      ? toNum(meta.ccp_tr_rate, 1)
      : undefined;

  if (nextAmount !== undefined && Number.isFinite(nextAmount)) ent.amount = String(nextAmount);

  const rateFinal = nextRate !== undefined && Number.isFinite(nextRate) ? nextRate : toNum((ent as any).rate ?? 1, 1);
  const amountFinal = nextAmount !== undefined ? nextAmount : toNum(ent.amount ?? 0, 0);

  // NEW keys for currencies
  const fromCur = meta?.ccp_tr_from_cur != null ? String(meta.ccp_tr_from_cur) : null;
  const toCur = meta?.ccp_tr_to_cur != null ? String(meta.ccp_tr_to_cur) : null;

  if (fromCur) (ent as any).fromCurrency = fromCur;
  if (toCur) (ent as any).toCurrency = toCur;

  (ent as any).rate = String(rateFinal);
  (ent as any).credited = String(amountFinal * (rateFinal || 1));

  if (meta?.ccp_tr_desc != null) (ent as any).desc = String(meta.ccp_tr_desc);

  // participants (обновляем только если пришли)
  const f = meta?.ccp_tr_from_user != null ? toNum(meta.ccp_tr_from_user) : undefined;
  const t = meta?.ccp_tr_to_user != null ? toNum(meta.ccp_tr_to_user) : undefined;

  if (f !== undefined && Number.isFinite(f) && f > 0) ent.fromUserId = f;
  if (t !== undefined && Number.isFinite(t) && t > 0) ent.toUserId = t;

  if (meta?.ccp_tr_date != null && String(meta.ccp_tr_date) !== '') ent.date = String(meta.ccp_tr_date);
  if (meta?.ccp_tr_status != null && String(meta.ccp_tr_status) !== '') ent.ccpStatus = String(meta.ccp_tr_status);

  // currency + note (без затирания)
  if (meta?.ccp_tr_currency != null && String(meta.ccp_tr_currency) !== '') {
    ent.currency = String(meta.ccp_tr_currency);
  } else if (!ent.currency) {
    ent.currency = (fromCur ?? 'EUR') as any;
  }

  if (meta?.ccp_tr_note != null && String(meta.ccp_tr_note) !== '') {
    ent.note = String(meta.ccp_tr_note);
  } else if (!ent.note && (ent as any).desc) {
    ent.note = String((ent as any).desc);
  }

  return await this.transfers.save(ent);
}

  /** ============ READ for CRM UI ============ */
  async listSites(tenantId: string) {
    return await this.sites.find({
      where: { tenantId, isActive: true },
      order: { updatedAt: 'DESC' },
    });
  }

  async listClients(tenantId: string, q: { siteId?: string; search?: string; page?: number; per?: number }) {
    const page = Math.max(1, q.page ?? 1);
    const per = Math.min(100, Math.max(10, q.per ?? 25));

    const qb = this.clients.createQueryBuilder('c').where('c.tenantId = :tenantId', { tenantId });

    if (q.siteId) qb.andWhere('c.siteId = :siteId', { siteId: q.siteId });

    if (q.search) {
      qb.andWhere('(LOWER(c.email) LIKE :s OR LOWER(c.name) LIKE :s)', { s: `%${q.search.toLowerCase()}%` });
    }

    qb.orderBy('c.updatedAt', 'DESC').skip((page - 1) * per).take(per);

    const [items, total] = await qb.getManyAndCount();
    return { items, page, per, total };
  }

  async getClient(tenantId: string, id: string) {
    const c = await this.clients.findOne({ where: { tenantId, id } });
    if (!c) throw new Error('Client not found');
    return c;
  }

  /** ============ WP helpers (variant 1 full) ============ */

  private async wpForSite(tenantId: string, siteId: string): Promise<CcpWpClient> {
    const s = await this.sites.findOne({ where: { tenantId, id: siteId } });
    if (!s) throw new Error('Site not found');

    const computedBase = this.wpRestBaseFromSiteUrl(s.siteUrl || '');
    const wpRestBase = String(s.wpRestBase || '').trim() || computedBase;

    if (!s.wpRestBase || s.wpRestBase !== wpRestBase) {
      s.wpRestBase = wpRestBase;
      await this.sites.save(s);
    }

    const token = String(s.wpToken || '').trim();
    if (!token) {
      throw new BadRequestException(
        `WP token is not configured for this site yet (siteId=${siteId}). ` +
          `Open WP admin -> CCP Settings -> Connect to CRM, to push wpToken.`,
      );
    }

    return new CcpWpClient(wpRestBase, token);
  }

  /**
   * ✅ Главное: если wpUserId неверный (у тебя было 6 вместо 2),
   * мы сами резолвим по email и сохраняем правильный wpUserId.
   * Требует WP endpoint: GET /users/resolve?email=
   */
  private async ensureClientWpUserId(tenantId: string, clientId: string): Promise<CcpClientEntity> {
    const c = await this.getClient(tenantId, clientId);

    // если wpUserId есть — ОК (но дальше будет "умный ретрай" если пусто)
    if (c.wpUserId && Number(c.wpUserId) > 0) return c;

    const email = lowerEmail(c.email);
    if (!email) throw new BadRequestException('Client email is empty; cannot resolve wpUserId');

    const wp = await this.wpForSite(tenantId, c.siteId);
    const resolved = await wp.resolveWpUserIdByEmail(email);

    if (!resolved) {
      throw new BadRequestException(`WP user not found by email: ${email}`);
    }

    c.wpUserId = resolved;
    c.wpUpdatedAt = new Date();
    return await this.clients.save(c);
  }

  /** подтянуть актуальный профиль из WP и обновить локально */
  async syncClientFromWp(tenantId: string, clientId: string) {
    const c0 = await this.ensureClientWpUserId(tenantId, clientId);
    const wp = await this.wpForSite(tenantId, c0.siteId);

    // предполагаем что WP endpoint существует: GET /clients/:wpUserId
    const wpRes = await wp.get(`/clients/${c0.wpUserId}`);
    await this.ingestClient(tenantId, c0.siteId, wpRes);

    // после ingest может быть создана новая запись по wpUserId (если раньше wpUserId был другой)
    // поэтому вернём актуального клиента по tenantId+siteId+wpUserId
    const c1 = await this.clients.findOne({ where: { tenantId, siteId: c0.siteId, wpUserId: c0.wpUserId } });
    return c1 ?? (await this.getClient(tenantId, clientId));
  }

  /** подтянуть операции из WP (и заинжестить в БД) */
  async syncTxnsFromWp(tenantId: string, siteId: string, wpUserId: number, page = 1, per = 100) {
    const wp = await this.wpForSite(tenantId, siteId);

    // WP должен отдавать { items: [...], page, per, total } или просто items[]
    const wpRes = await wp.get(`/txns?wpUserId=${wpUserId}&page=${page}&per=${per}`);

    const items: any[] = Array.isArray(wpRes) ? wpRes : (Array.isArray(wpRes?.items) ? wpRes.items : []);

    for (const it of items) {
      await this.ingestTxn(tenantId, siteId, it);
    }

    return wpRes;
  }

  /** подтянуть переводы из WP (и заинжестить в БД) */
  async syncTransfersFromWp(tenantId: string, siteId: string, wpUserId: number, page = 1, per = 100) {
    const wp = await this.wpForSite(tenantId, siteId);
    const wpRes = await wp.get(`/transfers?wpUserId=${wpUserId}&page=${page}&per=${per}`);

    const items: any[] = Array.isArray(wpRes) ? wpRes : (Array.isArray(wpRes?.items) ? wpRes.items : []);

    for (const it of items) {
      await this.ingestTransfer(tenantId, siteId, it);
    }

    return wpRes;
  }

  /** ============ LIST (with optional fresh=1) ============ */

  async listTxns(
    tenantId: string,
    q: { siteId?: string; wpUserId?: number; page?: number; per?: number; fresh?: boolean },
  ) {
    const page = Math.max(1, q.page ?? 1);
    const per = Math.min(200, Math.max(10, q.per ?? 50));

    // ✅ если fresh=1 — сначала подтянем из WP и заинжестим
    if (q.fresh && q.siteId && q.wpUserId) {
      await this.syncTxnsFromWp(tenantId, q.siteId, q.wpUserId, page, per);
    }

    const qb = this.txns.createQueryBuilder('t').where('t.tenantId = :tenantId', { tenantId });

    if (q.siteId) qb.andWhere('t.siteId = :siteId', { siteId: q.siteId });
    if (q.wpUserId) qb.andWhere('t.wpUserId = :uid', { uid: q.wpUserId });

    qb.orderBy('t.updatedAt', 'DESC').skip((page - 1) * per).take(per);

    const [items, total] = await qb.getManyAndCount();
    return { items, page, per, total };
  }

  async listTransfers(
    tenantId: string,
    q: { siteId?: string; wpUserId?: number; page?: number; per?: number; fresh?: boolean },
  ) {
    const page = Math.max(1, q.page ?? 1);
    const per = Math.min(200, Math.max(10, q.per ?? 50));

    if (q.fresh && q.siteId && q.wpUserId) {
      await this.syncTransfersFromWp(tenantId, q.siteId, q.wpUserId, page, per);
    }

    const qb = this.transfers.createQueryBuilder('tr').where('tr.tenantId = :tenantId', { tenantId });

    if (q.siteId) qb.andWhere('tr.siteId = :siteId', { siteId: q.siteId });
    if (q.wpUserId) qb.andWhere('(tr.fromUserId = :uid OR tr.toUserId = :uid)', { uid: q.wpUserId });

    qb.orderBy('tr.updatedAt', 'DESC').skip((page - 1) * per).take(per);

    const [items, total] = await qb.getManyAndCount();
    return { items, page, per, total };
  }

  /** ============ EDIT via CRM => WP, then update local ============ */

  async createClientInWp(tenantId: string, siteId: string, dto: CreateCcpClientDto) {
    const wp = await this.wpForSite(tenantId, siteId);

    const email = lowerEmail(dto?.email);
    if (!email) throw new BadRequestException('email is required');

    const password = String(dto?.password ?? '').trim();
    if (!password) throw new BadRequestException('password is required');

    const name = toStr(dto?.name) || null;
    const balanceEur = toNum(dto?.balanceEur ?? dto?.meta?.ccp_acc_eur_balance ?? 0, 0);
    const balanceUsd = toNum(dto?.balanceUsd ?? dto?.meta?.ccp_acc_usd_balance ?? 0, 0);

    const existing = await this.clients.findOne({
      where: { tenantId, siteId, email },
    });
    if (existing) throw new BadRequestException('Account already exists');

    const wpBody: any = {
      email,
      name,
      password,
      meta: {
        ccp_acc_eur_balance: balanceEur,
        ccp_acc_usd_balance: balanceUsd,
        ...dto?.meta,
      },
    };

    try {
      const wpRes = await wp.post('/clients', wpBody);
      await this.ingestClient(tenantId, siteId, wpRes);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/exists|already|registered|duplicate/i.test(msg)) {
        throw new BadRequestException('Account already exists');
      }
      throw e;
    }

    const saved = await this.clients.findOne({
      where: { tenantId, siteId, email },
      order: { updatedAt: 'DESC' },
    });
    if (saved) return saved;

    throw new BadRequestException('Client was created but not found in CRM yet');
  }

  async updateClientInWp(tenantId: string, clientId: string, dto: UpdateCcpClientDto) {
    // ✅ гарантируем wpUserId (и исправляем если пустой)
    let c = await this.ensureClientWpUserId(tenantId, clientId);
    const wp = await this.wpForSite(tenantId, c.siteId);

    // 1) пробуем PUT по текущему wpUserId
    try {
      const wpRes = await wp.put(`/clients/${c.wpUserId}`, dto);
      await this.ingestClient(tenantId, c.siteId, wpRes);
      return await this.clients.findOne({ where: { tenantId, siteId: c.siteId, wpUserId: c.wpUserId } }) ?? c;
    } catch (e: any) {
      // 2) если вдруг wpUserId неправильный (у тебя это и было), делаем резолв по email и повторяем
      const email = lowerEmail(c.email);
      if (!email) throw e;

      const resolved = await wp.resolveWpUserIdByEmail(email);
      if (!resolved) throw e;

      if (resolved !== c.wpUserId) {
        c.wpUserId = resolved;
        c = await this.clients.save(c);
      }

      const wpRes2 = await wp.put(`/clients/${c.wpUserId}`, dto);
      await this.ingestClient(tenantId, c.siteId, wpRes2);
      return await this.clients.findOne({ where: { tenantId, siteId: c.siteId, wpUserId: c.wpUserId } }) ?? c;
    }
  }

  async updateTxnInWp(tenantId: string, siteId: string, wpPostId: number, dto: UpdateCcpTxnDto) {
    const wp = await this.wpForSite(tenantId, siteId);
    const wpRes = await wp.put(`/txns/${wpPostId}`, dto);
    await this.ingestTxn(tenantId, siteId, wpRes);
    return await this.txns.findOne({ where: { tenantId, siteId, wpPostId } });
  }

  async updateTransferInWp(tenantId: string, siteId: string, wpPostId: number, dto: UpdateCcpTransferDto) {
    const wp = await this.wpForSite(tenantId, siteId);
    const wpRes = await wp.put(`/transfers/${wpPostId}`, dto);
    await this.ingestTransfer(tenantId, siteId, wpRes);
    return await this.transfers.findOne({ where: { tenantId, siteId, wpPostId } });
  }

  async connectSiteWp(tenantId: string, siteId: string, wpRestBase: string, wpToken: string) {
    const wp = new CcpWpClient(wpRestBase, wpToken);
    await wp.get('/meta');
    return await this.setSiteWpAccess(tenantId, siteId, wpRestBase, wpToken);
  }
  
async createTxnInWp(tenantId: string, siteId: string, dto: CreateCcpTxnDto) {
  const wp = await this.wpForSite(tenantId, siteId);
  const d: any = dto as any;

  const wpUserId = Number(d.wpUserId) || 0;
  if (!wpUserId) throw new BadRequestException('wpUserId is required');

  const parseMoney = (v: any) => {
    const raw = String(v ?? '0').trim().replace(/\s+/g, '').replace(',', '.');
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };

  const currency = String(d.currency ?? 'EUR').toUpperCase() === 'USD' ? 'USD' : 'EUR';

  // поддержка двух вариантов: spendEur/spendUsd ИЛИ amount+currency
  const spendEurNum = d.spendEur != null ? parseMoney(d.spendEur) : null;
  const spendUsdNum = d.spendUsd != null ? parseMoney(d.spendUsd) : null;

  const amountNum = parseMoney(d.amount);
  const finalSpendEur = spendEurNum != null ? spendEurNum : currency === 'EUR' ? amountNum : 0;
  const finalSpendUsd = spendUsdNum != null ? spendUsdNum : currency === 'USD' ? amountNum : 0;

  const wpBody: any = {
    title: d.title != null ? String(d.title) : '',
    status: d.status != null ? String(d.status) : 'publish',

    // ✅ ВАЖНО: WP должен получить meta, потому что ingest читает meta.ccp_*
    meta: {
      ccp_user_id: wpUserId,
      ccp_spend_eur: String(finalSpendEur),
      ccp_spend_usd: String(finalSpendUsd),
      ccp_date: d.date != null ? String(d.date) : '',
      ccp_desc: d.desc != null ? String(d.desc) : '',
      ccp_status: d.ccpStatus != null ? String(d.ccpStatus) : 'In progress',
    },
  };

  const wpRes = await wp.post('/txns', wpBody);

  const item: any = (wpRes as any)?.item ?? wpRes;
  item.meta = item.meta && typeof item.meta === 'object' ? item.meta : {};

  // ✅ гарантия ключей (на случай если WP вернул без meta)
  item.meta.ccp_user_id = Number(item.meta.ccp_user_id ?? wpUserId) || wpUserId;
  if (item.meta.ccp_spend_eur == null || item.meta.ccp_spend_eur === '') item.meta.ccp_spend_eur = String(finalSpendEur);
  if (item.meta.ccp_spend_usd == null || item.meta.ccp_spend_usd === '') item.meta.ccp_spend_usd = String(finalSpendUsd);
  if (item.meta.ccp_date == null) item.meta.ccp_date = wpBody.meta.ccp_date;
  if (item.meta.ccp_desc == null) item.meta.ccp_desc = wpBody.meta.ccp_desc;
  if (item.meta.ccp_status == null) item.meta.ccp_status = wpBody.meta.ccp_status;

  await this.ingestTxn(tenantId, siteId, item);

  const wpPostId = Number(item?.id ?? item?.wpPostId ?? item?.postId);
  if (Number.isFinite(wpPostId) && wpPostId > 0) {
    const saved = await this.txns.findOne({ where: { tenantId, siteId, wpPostId } });
    return saved ?? item;
  }

  return item;
}
  
async createTransferInWp(tenantId: string, siteId: string, dto: CreateCcpTransferDto) {
  const wp = await this.wpForSite(tenantId, siteId);
  const d: any = dto as any;

  const parseMoney = (v: any, def = 0) => {
    const raw = String(v ?? def).trim().replace(/\s+/g, '').replace(',', '.');
    const n = Number(raw);
    return Number.isFinite(n) ? n : def;
  };

  const fromUserId = Number(d.fromUserId ?? d.fromWpUserId ?? d.from_user_id ?? 0) || 0;
  const toUserId = Number(d.toUserId ?? d.toWpUserId ?? d.to_user_id ?? 0) || 0;
  if (!fromUserId || !toUserId) throw new BadRequestException('fromUserId/toUserId is required');

  const fromCur = String(d.fromCurrency ?? 'EUR').toUpperCase() === 'USD' ? 'USD' : 'EUR';
  const toCur = String(d.toCurrency ?? fromCur).toUpperCase() === 'USD' ? 'USD' : 'EUR';

  const amountNum = parseMoney(d.amount, 0);
  const rateNum = Math.max(0, parseMoney(d.rate, 1) || 1);

  const wpBody: any = {
    status: d.status != null ? String(d.status) : 'publish',

    // ✅ ВАЖНО: ingestTransfer читает meta.ccp_tr_*
    meta: {
      ccp_tr_amount: String(amountNum),
      ccp_tr_rate: String(rateNum),

      ccp_tr_from_cur: fromCur,
      ccp_tr_to_cur: toCur,

      ccp_tr_desc: d.desc != null ? String(d.desc) : '',
      ccp_tr_date: d.date != null ? String(d.date) : '',
      ccp_tr_status: d.ccpStatus != null ? String(d.ccpStatus) : 'In progress',

      // legacy / совместимость
      ccp_tr_from_user: fromUserId,
      ccp_tr_to_user: toUserId,
      ccp_tr_currency: toCur,
      ccp_tr_note: d.note != null ? String(d.note) : '',
    },
  };

  const wpRes = await wp.post('/transfers', wpBody);

  const item: any = (wpRes as any)?.item ?? wpRes;
  item.meta = item.meta && typeof item.meta === 'object' ? item.meta : {};

  // ✅ гарантия ключей (на случай если WP вернул без meta)
  if (item.meta.ccp_tr_from_user == null) item.meta.ccp_tr_from_user = fromUserId;
  if (item.meta.ccp_tr_to_user == null) item.meta.ccp_tr_to_user = toUserId;
  if (item.meta.ccp_tr_amount == null || item.meta.ccp_tr_amount === '') item.meta.ccp_tr_amount = String(amountNum);
  if (item.meta.ccp_tr_rate == null || item.meta.ccp_tr_rate === '') item.meta.ccp_tr_rate = String(rateNum);
  if (item.meta.ccp_tr_from_cur == null) item.meta.ccp_tr_from_cur = fromCur;
  if (item.meta.ccp_tr_to_cur == null) item.meta.ccp_tr_to_cur = toCur;
  if (item.meta.ccp_tr_desc == null) item.meta.ccp_tr_desc = wpBody.meta.ccp_tr_desc;
  if (item.meta.ccp_tr_date == null) item.meta.ccp_tr_date = wpBody.meta.ccp_tr_date;
  if (item.meta.ccp_tr_status == null) item.meta.ccp_tr_status = wpBody.meta.ccp_tr_status;
  if (item.meta.ccp_tr_currency == null) item.meta.ccp_tr_currency = toCur;

  await this.ingestTransfer(tenantId, siteId, item);

  const wpPostId = Number(item?.id ?? item?.wpPostId ?? item?.postId);
  if (Number.isFinite(wpPostId) && wpPostId > 0) {
    const saved = await this.transfers.findOne({ where: { tenantId, siteId, wpPostId } });
    return saved ?? item;
  }

  return item;
}
}
