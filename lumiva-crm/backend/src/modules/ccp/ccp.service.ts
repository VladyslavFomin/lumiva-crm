// src/modules/ccp/ccp.service.ts
import { BadRequestException, Inject, Injectable, Logger, Scope } from '@nestjs/common';
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

const INVESTMENT_STYLE_ANNUAL_PERCENT: Record<string, number> = {
  'консервативный': 7,
  'стабильный': 12,
  'растущий': 14,
  'сбалансированный': 18,
  'повышенный риск': 24,
};

function optionalNum(...values: any[]): number | null {
  for (const value of values) {
    if (value === undefined || value === null || String(value).trim() === '') continue;
    const n = toNum(value, Number.NaN);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function annualPercentForStyle(style: any): number | null {
  const key = String(style ?? '').trim().toLowerCase();
  return key ? INVESTMENT_STYLE_ANNUAL_PERCENT[key] ?? null : null;
}

function plainObject(value: any): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hasValue(value: any): boolean {
  return value !== undefined && value !== null && String(value) !== '';
}

function displayBalanceFromAccount(accountLike: any): number | null {
  const account = plainObject(accountLike);
  const financial = plainObject(account.financial);
  const explicit = optionalNum(
    account.displayBalance,
    account.totalBalance,
    account.totalEquity,
    financial.totalEquity,
    financial.displayBalance,
    financial.totalBalance,
  );
  if (explicit != null) return explicit;

  const operational = optionalNum(account.balanceOperational, financial.balanceOperational);
  const profitBalance = optionalNum(account.profitBalance, financial.profitBalance);
  const creditBalance = optionalNum(account.creditBalance, financial.creditBalance);
  if (operational != null || profitBalance != null || creditBalance != null) {
    return (operational ?? 0) + (profitBalance ?? 0) + (creditBalance ?? 0);
  }

  const balance = optionalNum(account.balance, financial.balance);
  const profit = optionalNum(account.profit, financial.availableProfit);
  const credit = optionalNum(account.credit, financial.creditLeverage, financial.creditLeverageTotal);
  if (balance != null || profit != null || credit != null) {
    return (balance ?? 0) + (profit ?? 0) + (credit ?? 0);
  }

  return null;
}

function pickItems(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  return [];
}

function totalFromResponse(res: any): number | null {
  const raw = res?.total ?? res?.data?.total;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function dateOrNull(value: any): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * scope REQUEST нужен, чтобы в connect-by-token взять tenantId из req.tenantId
 * (его ставит XApiTokenGuard).
 */
@Injectable({ scope: Scope.REQUEST })
export class CcpService {
  private readonly log = new Logger(CcpService.name);

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
    if (ex) {
      if (!ex.isActive) {
        ex.isActive = true;
        return await this.sites.save(ex);
      }
      return ex;
    }

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

  async updateSite(
    tenantId: string,
    siteId: string,
    body: {
      siteUrl?: string;
      wpRestBase?: string | null;
      wpToken?: string | null;
      isActive?: boolean;
    },
  ) {
    const site = await this.sites.findOne({ where: { tenantId, id: siteId } });
    if (!site) throw new BadRequestException('Site not found');

    if (body.siteUrl != null) {
      const clean = this.normalizeSiteUrl(body.siteUrl);
      if (!clean) throw new BadRequestException('siteUrl is required');
      const existing = await this.sites.findOne({ where: { tenantId, siteUrl: clean } });
      if (existing && existing.id !== site.id) {
        throw new BadRequestException('Site with this URL already exists');
      }
      site.siteUrl = clean;
      site.siteHost = hostFromUrl(clean);
      if (!body.wpRestBase) {
        site.wpRestBase = this.wpRestBaseFromSiteUrl(clean);
      }
    }

    if (body.wpRestBase != null) {
      site.wpRestBase = String(body.wpRestBase || '').trim() || null;
    }

    if (body.wpToken != null && String(body.wpToken).trim()) {
      site.wpToken = String(body.wpToken).trim();
    }

    if (typeof body.isActive === 'boolean') {
      site.isActive = body.isActive;
    }

    return await this.sites.save(site);
  }

  async deactivateSite(tenantId: string, siteId: string) {
    const site = await this.sites.findOne({ where: { tenantId, id: siteId } });
    if (!site) throw new BadRequestException('Site not found');
    site.isActive = false;
    await this.sites.save(site);
    return { ok: true, id: site.id };
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
    const wpUserId = toNum(data?.wpUserId ?? data?.externalUserId ?? data?.id);
    if (!Number.isFinite(wpUserId) || wpUserId <= 0) throw new Error('client wpUserId missing');

    const email = lowerEmail(data?.email);
    const firstName = toStr(data?.firstName);
    const lastName = toStr(data?.lastName);
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const name = data?.name != null ? String(data.name) : fullName || null;
    const meta = plainObject(data?.meta);
    const phone = toStr(
      data?.phone ??
        data?.billing_phone ??
        data?.mobile ??
        data?.phoneNumber ??
        data?.phone_number ??
        meta?.phone ??
        meta?.billing_phone ??
        meta?.user_phone ??
        meta?.ccp_phone,
    );
    const accounts = Array.isArray(meta.accounts) ? meta.accounts : [];
    const financialSummary = Array.isArray(meta.financialSummary) ? meta.financialSummary : [];
    const accountByCurrency = (currency: string) =>
      accounts.find((account) => String(plainObject(account).currency || '').toUpperCase() === currency);
    const summaryByCurrency = (currency: string) =>
      financialSummary.find((row) => String(plainObject(row).currency || '').toUpperCase() === currency);
    const accountValue = (currency: string, ...keys: string[]) => {
      const account = plainObject(accountByCurrency(currency));
      const financial = plainObject(account.financial);
      for (const source of [financial, account]) {
        for (const key of keys) {
          if (source[key] != null && String(source[key]) !== '') return source[key];
        }
      }
      return undefined;
    };
    const summaryValue = (currency: string, ...keys: string[]) => {
      const summary = plainObject(summaryByCurrency(currency));
      for (const key of keys) {
        if (hasValue(summary[key])) return summary[key];
      }
      return undefined;
    };
    const accountDisplayBalance = (currency: string) => displayBalanceFromAccount(accountByCurrency(currency));

    const balanceEur = String(
      accountDisplayBalance('EUR') ??
        data?.balanceEur ??
        meta?.ccp_acc_eur_balance ??
        meta?.ccp_balance_eur ??
        summaryValue('EUR', 'balance') ??
        accountValue('EUR', 'balance') ??
        0,
    );
    const balanceUsd = String(
      accountDisplayBalance('USD') ??
        data?.balanceUsd ??
        meta?.ccp_acc_usd_balance ??
        meta?.ccp_balance_usd ??
        summaryValue('USD', 'balance') ??
        accountValue('USD', 'balance') ??
        0,
    );

    const accountEur = toStr(data?.accountEur ?? meta?.ccp_acc_eur_number ?? accountValue('EUR', 'number'));
    const accountUsd = toStr(data?.accountUsd ?? meta?.ccp_acc_usd_number ?? accountValue('USD', 'number'));

    const analyticsUrl = toStr(meta?.ccp_analytics_url);
    const filesList = meta?.ccp_files_list != null ? String(meta.ccp_files_list) : null;
    const tgChatId = toStr(meta?.ccp_tg_chat_id);
    const investmentStyle = toStr(
      data?.investmentStyle ??
        data?.style ??
        meta?.ccp_investment_style ??
        meta?.investment_style ??
        meta?.style,
    );
    const investmentAnnualPercent =
      optionalNum(
        data?.investmentAnnualPercent,
        data?.annualPercent,
        meta?.ccp_investment_annual_percent,
        meta?.investment_annual_percent,
      ) ?? annualPercentForStyle(investmentStyle);
    const creditLeverage = optionalNum(data?.creditLeverage, meta?.ccp_credit_leverage, meta?.credit_leverage);
    const creditRepayMonthlyPercent = optionalNum(
      data?.creditRepayMonthlyPercent,
      meta?.ccp_credit_repay_monthly_percent,
      meta?.credit_repay_monthly_percent,
      meta?.credit?.repay?.monthly,
    );
    const investmentProfitMonthlyPercent = optionalNum(
      data?.investmentProfitMonthlyPercent,
      meta?.ccp_investment_profit_monthly_percent,
      meta?.investment_profit_monthly_percent,
      meta?.investment?.profit?.monthly,
    );
    const accountDebitMonthlyPercent = optionalNum(
      data?.accountDebitMonthlyPercent,
      meta?.ccp_account_debit_monthly_percent,
      meta?.account_debit_monthly_percent,
      meta?.account?.debit?.monthly,
    );

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
    if (phone) (ent as any).phone = phone;

    ent.balanceEur = balanceEur;
    ent.balanceUsd = balanceUsd;

    (ent as any).accountEur = accountEur;
    (ent as any).accountUsd = accountUsd;
    (ent as any).analyticsUrl = analyticsUrl;
    (ent as any).filesList = filesList;
    (ent as any).tgChatId = tgChatId;
    (ent as any).meta = meta;
    (ent as any).investmentStyle = investmentStyle;
    (ent as any).investmentAnnualPercent =
      investmentAnnualPercent == null ? null : String(investmentAnnualPercent);
    (ent as any).creditLeverage = creditLeverage == null ? null : String(creditLeverage);
    (ent as any).creditRepayMonthlyPercent =
      creditRepayMonthlyPercent == null ? null : String(creditRepayMonthlyPercent);
    (ent as any).investmentProfitMonthlyPercent =
      investmentProfitMonthlyPercent == null ? null : String(investmentProfitMonthlyPercent);
    (ent as any).accountDebitMonthlyPercent =
      accountDebitMonthlyPercent == null ? null : String(accountDebitMonthlyPercent);

    ent.ibanEur = ibanEur;
    ent.ibanUsd = ibanUsd;

    const sourceUpdatedAt = dateOrNull(data?.updatedAt ?? data?.wpUpdatedAt);
    ent.wpUpdatedAt = sourceUpdatedAt ?? new Date();

    return await this.clients.save(ent);
  }

  private async ingestTxn(tenantId: string, siteId: string, data: any) {
  const wpPostId = toNum(data?.wpPostId ?? data?.externalTransactionId ?? data?.id);
  if (!Number.isFinite(wpPostId) || wpPostId <= 0) throw new Error('txn wpPostId missing');

  const meta = plainObject(data?.meta);

  const ex = await this.txns.findOne({ where: { tenantId, siteId, wpPostId } });
  const ent = ex ?? this.txns.create({ tenantId, siteId, wpPostId });
  (ent as any).meta = meta;

  if (data?.title != null) ent.title = String(data.title);
  else if (!ent.title && data?.type != null) ent.title = String(data.type);
  if (data?.status != null) ent.status = String(data.status);

  // wpUserId — обновляем только если пришёл нормальный id
  const nextWpUserId =
    data?.wpUserId != null || data?.externalUserId != null
      ? toNum(data?.wpUserId ?? data?.externalUserId)
      : meta?.ccp_user_id != null
        ? toNum(meta.ccp_user_id)
        : undefined;
  if (nextWpUserId !== undefined && Number.isFinite(nextWpUserId) && nextWpUserId > 0) {
    ent.wpUserId = nextWpUserId;
  }

  // ❗ НЕ затираем 0-ми: обновляем только если meta реально прислала значения
  const currency = String(data?.currency || '').toUpperCase();
  const sum = data?.sum ?? data?.amount;
  if (meta?.ccp_spend_eur != null && String(meta.ccp_spend_eur) !== '') {
    ent.spendEur = String(meta.ccp_spend_eur);
  } else if (sum != null && currency === 'EUR') {
    ent.spendEur = String(sum);
  }
  if (meta?.ccp_spend_usd != null && String(meta.ccp_spend_usd) !== '') {
    ent.spendUsd = String(meta.ccp_spend_usd);
  } else if (sum != null && currency === 'USD') {
    ent.spendUsd = String(sum);
  }

  if (data?.createdAt != null && String(data.createdAt) !== '') ent.date = String(data.createdAt);
  if (meta?.ccp_date != null && String(meta.ccp_date) !== '') ent.date = String(meta.ccp_date);

  const descParts = [
    data?.desc,
    meta?.comment,
    meta?.ccp_desc,
    data?.purpose,
    data?.details,
    meta?.purpose,
    meta?.description,
    meta?.assetName ? `Asset: ${meta.assetName}` : null,
    meta?.assetId ? `Asset ID: ${meta.assetId}` : null,
    meta?.accountId ? `Account ID: ${meta.accountId}` : null,
    meta?.managerExternalId ? `Manager: ${meta.managerExternalId}` : null,
  ]
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean);
  if (descParts.length) ent.desc = Array.from(new Set(descParts)).join('\n');
  if (data?.ccpStatus != null && String(data.ccpStatus) !== '') ent.ccpStatus = String(data.ccpStatus);
  if (meta?.ccp_status != null && String(meta.ccp_status) !== '') ent.ccpStatus = String(meta.ccp_status);

  return await this.txns.save(ent);
}

  private async ingestTransfer(tenantId: string, siteId: string, data: any) {
  const wpPostId = toNum(data?.wpPostId ?? data?.externalTransferId ?? data?.id);
  if (!Number.isFinite(wpPostId) || wpPostId <= 0) throw new Error('transfer wpPostId missing');

  const meta = plainObject(data?.meta);

  const ex = await this.transfers.findOne({ where: { tenantId, siteId, wpPostId } });
  const ent = ex ?? this.transfers.create({ tenantId, siteId, wpPostId });
  (ent as any).meta = meta;

  if (data?.title != null) ent.title = String(data.title);
  if (data?.status != null) ent.status = String(data.status);

  // amount/rate
  const nextAmount =
    data?.amount != null && String(data.amount) !== ''
      ? toNum(data.amount)
      : meta?.ccp_tr_amount != null && String(meta.ccp_tr_amount) !== ''
        ? toNum(meta.ccp_tr_amount)
      : undefined;

  const nextRate =
    data?.rate != null && String(data.rate) !== ''
      ? toNum(data.rate, 1)
      : meta?.ccp_tr_rate != null && String(meta.ccp_tr_rate) !== ''
        ? toNum(meta.ccp_tr_rate, 1)
      : undefined;

  if (nextAmount !== undefined && Number.isFinite(nextAmount)) ent.amount = String(nextAmount);

  const rateFinal = nextRate !== undefined && Number.isFinite(nextRate) ? nextRate : toNum((ent as any).rate ?? 1, 1);
  const amountFinal = nextAmount !== undefined ? nextAmount : toNum(ent.amount ?? 0, 0);

  // NEW keys for currencies
  const fromCur = data?.fromCurrency != null ? String(data.fromCurrency) : meta?.ccp_tr_from_cur != null ? String(meta.ccp_tr_from_cur) : null;
  const toCur = data?.toCurrency != null ? String(data.toCurrency) : meta?.ccp_tr_to_cur != null ? String(meta.ccp_tr_to_cur) : null;

  if (fromCur) (ent as any).fromCurrency = fromCur;
  if (toCur) (ent as any).toCurrency = toCur;

  (ent as any).rate = String(rateFinal);
  (ent as any).credited = String(amountFinal * (rateFinal || 1));

  if (data?.desc != null) (ent as any).desc = String(data.desc);
  if (meta?.ccp_tr_desc != null) (ent as any).desc = String(meta.ccp_tr_desc);

  // participants (обновляем только если пришли)
  const f =
    data?.fromUserId != null || data?.fromWpUserId != null || data?.fromExternalUserId != null || data?.senderWpUserId != null
      ? toNum(data.fromUserId ?? data.fromWpUserId ?? data.fromExternalUserId ?? data.senderWpUserId)
      : meta?.ccp_tr_from_user != null
        ? toNum(meta.ccp_tr_from_user)
        : undefined;
  const t =
    data?.toUserId != null || data?.toWpUserId != null || data?.toExternalUserId != null || data?.recipientWpUserId != null
      ? toNum(data.toUserId ?? data.toWpUserId ?? data.toExternalUserId ?? data.recipientWpUserId)
      : meta?.ccp_tr_to_user != null
        ? toNum(meta.ccp_tr_to_user)
        : undefined;
  const participantUserId =
    data?.wpUserId != null || data?.externalUserId != null
      ? toNum(data?.wpUserId ?? data?.externalUserId)
      : undefined;

  if (f !== undefined && Number.isFinite(f) && f > 0) ent.fromUserId = f;
  if (t !== undefined && Number.isFinite(t) && t > 0) ent.toUserId = t;
  if (
    participantUserId !== undefined &&
    Number.isFinite(participantUserId) &&
    participantUserId > 0
  ) {
    /* Only fill fromUserId from participant — never set toUserId = fromUserId,
       that would create fake self-transfers when WP doesn't send a recipient */
    if (!ent.fromUserId) ent.fromUserId = participantUserId;
  }

  if (data?.createdAt != null && String(data.createdAt) !== '') ent.date = String(data.createdAt);
  if (meta?.ccp_tr_date != null && String(meta.ccp_tr_date) !== '') ent.date = String(meta.ccp_tr_date);
  if (data?.ccpStatus != null && String(data.ccpStatus) !== '') ent.ccpStatus = String(data.ccpStatus);
  if (meta?.ccp_tr_status != null && String(meta.ccp_tr_status) !== '') ent.ccpStatus = String(meta.ccp_tr_status);

  // currency + note (без затирания)
  if (data?.currency != null && String(data.currency) !== '') {
    ent.currency = String(data.currency);
  } else if (meta?.ccp_tr_currency != null && String(meta.ccp_tr_currency) !== '') {
    ent.currency = String(meta.ccp_tr_currency);
  } else if (!ent.currency) {
    ent.currency = (fromCur ?? 'EUR') as any;
  }

  if (data?.note != null && String(data.note) !== '') {
    ent.note = String(data.note);
  } else if (meta?.ccp_tr_note != null && String(meta.ccp_tr_note) !== '') {
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

  async listClients(tenantId: string, q: { siteId?: string; search?: string; page?: number; per?: number; fresh?: boolean }) {
    const page = Math.max(1, q.page ?? 1);
    const per = Math.min(100, Math.max(10, q.per ?? 25));

    if (q.siteId && !q.search) {
      const localCount = await this.clients.count({ where: { tenantId, siteId: q.siteId } });
      if (q.fresh || localCount === 0) {
        try {
          if (q.fresh || localCount === 0) {
            await this.syncAllClientsFromWp(tenantId, q.siteId, per);
          } else {
            await this.syncClientsFromWp(tenantId, q.siteId, page, per);
          }
        } catch (error) {
          this.log.warn(
            `CCP clients fresh pull failed siteId=${q.siteId}: ${(error as Error).message}`,
          );
          if (localCount === 0) throw error;
        }
      }
    }

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

  async syncClientsFromWp(tenantId: string, siteId: string, page = 1, per = 50) {
    const wp = await this.wpForSite(tenantId, siteId);
    const path = `/clients?page=${page}&per=${per}`;
    const wpRes = await wp.get(path);
    const items = pickItems(wpRes);
    const total = totalFromResponse(wpRes);

    this.log.log(
      `CCP clients pull siteId=${siteId} path=${path} items=${items.length} total=${total ?? 'unknown'}`,
    );

    for (const item of items) {
      await this.ingestClient(tenantId, siteId, item);
    }

    return {
      items,
      page: Number(wpRes?.page ?? page) || page,
      per: Number(wpRes?.per ?? per) || per,
      total,
    };
  }

  async syncAllClientsFromWp(tenantId: string, siteId: string, per = 50) {
    const safePer = Math.min(100, Math.max(10, per));
    let page = 1;
    let imported = 0;
    let total: number | null = null;

    while (page <= 200) {
      const res = await this.syncClientsFromWp(tenantId, siteId, page, safePer);
      imported += res.items.length;
      total = res.total;
      if (!res.items.length) break;
      if (total != null && imported >= total) break;
      if (res.items.length < safePer) break;
      page += 1;
    }

    this.log.log(`CCP clients initial import siteId=${siteId} imported=${imported} total=${total ?? 'unknown'}`);
    return { imported, total };
  }

  /** подтянуть операции из WP (и заинжестить в БД) */
  async syncTxnsFromWp(tenantId: string, siteId: string, wpUserId?: number, page = 1, per = 100) {
    const wp = await this.wpForSite(tenantId, siteId);

    // WP должен отдавать { items: [...], page, per, total } или просто items[]
    const query = wpUserId ? `wpUserId=${wpUserId}&` : '';
    const path = `/txns?${query}page=${page}&per=${per}`;
    const wpRes = await wp.get(path);

    const items = pickItems(wpRes);
    const total = totalFromResponse(wpRes);
    this.log.log(
      `CCP txns pull siteId=${siteId} path=${path} items=${items.length} total=${total ?? 'unknown'}`,
    );

    for (const it of items) {
      await this.ingestTxn(tenantId, siteId, it);
    }

    return {
      items,
      page: Number(wpRes?.page ?? page) || page,
      per: Number(wpRes?.per ?? per) || per,
      total,
    };
  }

  /** подтянуть переводы из WP (и заинжестить в БД) */
  async syncTransfersFromWp(tenantId: string, siteId: string, wpUserId?: number, page = 1, per = 100) {
    const wp = await this.wpForSite(tenantId, siteId);
    const query = wpUserId ? `wpUserId=${wpUserId}&` : '';
    const path = `/transfers?${query}page=${page}&per=${per}`;
    const wpRes = await wp.get(path);

    const items = pickItems(wpRes);
    const total = totalFromResponse(wpRes);
    this.log.log(
      `CCP transfers pull siteId=${siteId} path=${path} items=${items.length} total=${total ?? 'unknown'}`,
    );

    for (const it of items) {
      await this.ingestTransfer(tenantId, siteId, it);
    }

    return {
      items,
      page: Number(wpRes?.page ?? page) || page,
      per: Number(wpRes?.per ?? per) || per,
      total,
    };
  }

  async syncAllTxnsFromWp(tenantId: string, siteId: string, wpUserId?: number, per = 200) {
    const safePer = Math.min(200, Math.max(10, per));
    let page = 1;
    let imported = 0;
    let total: number | null = null;

    while (page <= 200) {
      const res = await this.syncTxnsFromWp(tenantId, siteId, wpUserId, page, safePer);
      imported += res.items.length;
      total = res.total;
      if (!res.items.length) break;
      if (total != null && imported >= total) break;
      if (res.items.length < safePer) break;
      page += 1;
    }

    this.log.log(
      `CCP txns full pull siteId=${siteId} wpUserId=${wpUserId ?? 'all'} imported=${imported} total=${total ?? 'unknown'}`,
    );
    return { imported, total };
  }

  async syncAllTransfersFromWp(tenantId: string, siteId: string, wpUserId?: number, per = 200) {
    const safePer = Math.min(200, Math.max(10, per));
    let page = 1;
    let imported = 0;
    let total: number | null = null;

    while (page <= 200) {
      const res = await this.syncTransfersFromWp(tenantId, siteId, wpUserId, page, safePer);
      imported += res.items.length;
      total = res.total;
      if (!res.items.length) break;
      if (total != null && imported >= total) break;
      if (res.items.length < safePer) break;
      page += 1;
    }

    this.log.log(
      `CCP transfers full pull siteId=${siteId} wpUserId=${wpUserId ?? 'all'} imported=${imported} total=${total ?? 'unknown'}`,
    );
    return { imported, total };
  }

  /** ============ LIST (with optional fresh=1) ============ */

  async listTxns(
    tenantId: string,
    q: { siteId?: string; wpUserId?: number; page?: number; per?: number; fresh?: boolean },
  ) {
    const page = Math.max(1, q.page ?? 1);
    const per = Math.min(200, Math.max(10, q.per ?? 50));

    // ✅ если fresh=1 — сначала подтянем из внешнего REST и заинжестим
    if (q.fresh && q.siteId) {
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

    if (q.fresh && q.siteId) {
      await this.syncTransfersFromWp(tenantId, q.siteId, q.wpUserId, page, per);
    }

    const qb = this.transfers.createQueryBuilder('tr').where('tr.tenantId = :tenantId', { tenantId });

    if (q.siteId) qb.andWhere('tr.siteId = :siteId', { siteId: q.siteId });
    if (q.wpUserId) qb.andWhere('(tr.fromUserId = :uid OR tr.toUserId = :uid)', { uid: q.wpUserId });

    qb.orderBy('tr.updatedAt', 'DESC').skip((page - 1) * per).take(per);

    const [items, total] = await qb.getManyAndCount();
    return { items, page, per, total };
  }

  async getClientAnalytics(tenantId: string, clientId: string, q: { fresh?: boolean } = {}) {
    let client = await this.getClient(tenantId, clientId);
    const syncErrors: string[] = [];

    if (q.fresh) {
      try {
        client = await this.syncClientFromWp(tenantId, clientId);
      } catch (error) {
        const message = (error as Error).message;
        if (/WP GET \/clients\/\d+ -> 404/i.test(message)) {
          this.log.warn(
            `CCP client profile endpoint unavailable siteId=${client.siteId} wpUserId=${client.wpUserId}; using local profile`,
          );
          await this.syncAllClientsFromWp(tenantId, client.siteId, 100).catch((listError) => {
            this.log.warn(
              `CCP client list refresh failed siteId=${client.siteId}: ${(listError as Error).message}`,
            );
          });
          client = await this.getClient(tenantId, clientId).catch(() => client);
        } else {
          syncErrors.push(`client: ${message}`);
        }
      }

      try {
        await this.syncAllTxnsFromWp(tenantId, client.siteId, client.wpUserId, 200);
      } catch (error) {
        syncErrors.push(`txns: ${(error as Error).message}`);
      }

      try {
        await this.syncAllTransfersFromWp(tenantId, client.siteId, client.wpUserId, 200);
      } catch (error) {
        syncErrors.push(`transfers: ${(error as Error).message}`);
      }

      client = await this.getClient(tenantId, clientId).catch(() => client);
    }

    const [txns, transfers] = await Promise.all([
      this.txns
        .createQueryBuilder('t')
        .where('t.tenantId = :tenantId', { tenantId })
        .andWhere('t.siteId = :siteId', { siteId: client.siteId })
        .andWhere('t.wpUserId = :uid', { uid: client.wpUserId })
        .orderBy('t.updatedAt', 'DESC')
        .getMany(),
      this.transfers
        .createQueryBuilder('tr')
        .where('tr.tenantId = :tenantId', { tenantId })
        .andWhere('tr.siteId = :siteId', { siteId: client.siteId })
        .andWhere('(tr.fromUserId = :uid OR tr.toUserId = :uid)', { uid: client.wpUserId })
        .orderBy('tr.updatedAt', 'DESC')
        .getMany(),
    ]);

    const money = (value: any) => optionalNum(value) ?? 0;
    const text = (...values: any[]) =>
      values
        .map((value) => String(value ?? '').toLowerCase())
        .filter(Boolean)
        .join(' ');
    const kindOfTxn = (txn: CcpTxnEntity) => {
      const meta = plainObject((txn as any).meta);
      const category = String(meta.financialCategory || '').trim();
      if (category) return category;
      const haystack = text(txn.title, txn.desc, txn.ccpStatus, txn.status, meta.transactionTypeId);
      if (/profit|прибыл|доход|yield/.test(haystack)) return 'profit';
      if (/invest|инвест|deposit|вклад/.test(haystack)) return 'investment';
      if (/fee|commission|списан|комисс|обслуж/.test(haystack)) return 'fee';
      if (/credit|кредит|плеч/.test(haystack)) return 'credit';
      return 'expense';
    };

    const txnsByKind = txns.reduce<Record<string, number>>((acc, txn) => {
      const kind = kindOfTxn(txn);
      acc[kind] = (acc[kind] || 0) + money(txn.spendEur) + money(txn.spendUsd);
      return acc;
    }, {});
    const txnsAbsByKind = txns.reduce<Record<string, number>>((acc, txn) => {
      const kind = kindOfTxn(txn);
      acc[kind] = (acc[kind] || 0) + Math.abs(money(txn.spendEur) + money(txn.spendUsd));
      return acc;
    }, {});

    const txnSpendEur = txns.reduce((sum, txn) => sum + money(txn.spendEur), 0);
    const txnSpendUsd = txns.reduce((sum, txn) => sum + money(txn.spendUsd), 0);
    const transferOutgoing = transfers
      .filter((tr) => Number(tr.fromUserId) === Number(client.wpUserId))
      .reduce((sum, tr) => sum + money(tr.amount), 0);
    const transferIncoming = transfers
      .filter((tr) => Number(tr.toUserId) === Number(client.wpUserId))
      .reduce((sum, tr) => sum + money((tr as any).credited ?? tr.amount), 0);

    const balanceEur = money(client.balanceEur);
    const balanceUsd = money(client.balanceUsd);
    const clientMeta = plainObject((client as any).meta);
    const financialSummary = Array.isArray(clientMeta.financialSummary) ? clientMeta.financialSummary : [];
    const accounts = Array.isArray(clientMeta.accounts) ? clientMeta.accounts : [];
    const investments = Array.isArray(clientMeta.investments) ? clientMeta.investments : [];
    const summarySum = (...keys: string[]) =>
      financialSummary.reduce((sum, row) => {
        const source = plainObject(row);
        const key = keys.find((candidate) => hasValue(source[candidate]));
        return sum + (key ? money(source[key]) : 0);
      }, 0);
    const accountFinancialSum = (...keys: string[]) =>
      accounts.reduce((sum, account) => {
        const financial = plainObject(plainObject(account).financial);
        const source = Object.keys(financial).length ? financial : plainObject(account);
        const key = keys.find((candidate) => hasValue(source[candidate]));
        return sum + (key ? money(source[key]) : 0);
      }, 0);
    const summaryCurrency = (currency: string, ...keys: string[]) => {
      const row = financialSummary.find((item) => String(plainObject(item).currency || '').toUpperCase() === currency);
      if (!row) return null;
      const source = plainObject(row);
      const key = keys.find((candidate) => hasValue(source[candidate]));
      return key ? money(source[key]) : null;
    };
    const accountDisplayBalanceByCurrency = (currency: string) =>
      accounts.reduce((sum, account) => {
        const source = plainObject(account);
        if (String(source.currency || '').toUpperCase() !== currency) return sum;
        return sum + (displayBalanceFromAccount(source) ?? 0);
      }, 0);

    const summaryBalanceEur = summaryCurrency('EUR', 'balance');
    const summaryBalanceUsd = summaryCurrency('USD', 'balance');
    const accountDisplayBalanceEur = accountDisplayBalanceByCurrency('EUR');
    const accountDisplayBalanceUsd = accountDisplayBalanceByCurrency('USD');
    const displayBalanceEur = accountDisplayBalanceEur || summaryBalanceEur || balanceEur;
    const displayBalanceUsd = accountDisplayBalanceUsd || summaryBalanceUsd || balanceUsd;
    const investmentAnnualPercent =
      optionalNum((client as any).investmentAnnualPercent) ?? annualPercentForStyle((client as any).investmentStyle);
    const investmentProfitMonthlyPercent = optionalNum((client as any).investmentProfitMonthlyPercent);
    const accountDebitMonthlyPercent = optionalNum((client as any).accountDebitMonthlyPercent);
    const creditRepayMonthlyPercent = optionalNum((client as any).creditRepayMonthlyPercent);
    const creditLeverage =
      summarySum('creditLeverage', 'creditLeverageTotal') ||
      accountFinancialSum('creditLeverage', 'creditLeverageTotal') ||
      optionalNum((client as any).creditLeverage) ||
      0;
    const investmentAmount =
      summarySum('invested', 'investmentTotal') ||
      accountFinancialSum('invested', 'investmentTotal') ||
      investments.reduce((sum, item) => sum + money(plainObject(item).invested), 0) ||
      Math.abs(txnsByKind.investment || 0);
    const expectedAnnualProfit =
      summarySum('expectedProfit') ||
      accountFinancialSum('expectedProfit') ||
      (investmentAmount > 0 && investmentAnnualPercent != null ? (investmentAmount * investmentAnnualPercent) / 100 : null);
    const expectedMonthlyProfit =
      summarySum('profitAccrued', 'profitAccrualTotal') ||
      accountFinancialSum('profitAccrued', 'profitAccrualTotal') ||
      (investmentAmount > 0 && investmentProfitMonthlyPercent != null ? (investmentAmount * investmentProfitMonthlyPercent) / 100 : null);
    const accountDebitMonthly =
      summarySum('accountFee', 'accountWriteOff') ||
      accountFinancialSum('accountFee', 'accountWriteOff') ||
      (accountDebitMonthlyPercent == null ? null : ((displayBalanceEur + displayBalanceUsd) * accountDebitMonthlyPercent) / 100);
    const creditRepayMonthly =
      txnsByKind.credit_repayment ||
      (creditRepayMonthlyPercent == null ? null : (creditLeverage * creditRepayMonthlyPercent) / 100);
    const operationExpenseTotal =
      Math.abs(summarySum('accountFee', 'accountWriteOff')) ||
      Math.abs(accountFinancialSum('accountFee', 'accountWriteOff')) ||
      txnsAbsByKind.account_fee ||
      txnsAbsByKind.fee ||
      0;
    const withdrawalTotal =
      Math.abs(summarySum('withdrawn')) ||
      Math.abs(accountFinancialSum('withdrawn')) ||
      (txnsAbsByKind.withdrawal || 0) + (txnsAbsByKind.bank_transfer || 0);
    const transferTotal =
      Math.abs(summarySum('transfers')) ||
      Math.abs(accountFinancialSum('transfers')) ||
      transferOutgoing ||
      txnsAbsByKind.transfer ||
      0;
    const spendingTotal = operationExpenseTotal + withdrawalTotal + transferTotal;
    const expectedNetMonthly =
      expectedAnnualProfit == null
        ? null
        : expectedAnnualProfit + (accountDebitMonthly ?? 0) - (creditRepayMonthly ?? 0);

    return {
      client,
      txns,
      transfers,
      sync: {
        fresh: !!q.fresh,
        errors: syncErrors,
      },
      metrics: {
        balances: { eur: displayBalanceEur, usd: displayBalanceUsd, total: displayBalanceEur + displayBalanceUsd },
        counts: { txns: txns.length, transfers: transfers.length },
        spending: { eur: 0, usd: 0, total: spendingTotal },
        transfers: {
          incoming: transferIncoming,
          outgoing: transferOutgoing,
          net: transferIncoming - transferOutgoing,
        },
        investments: {
          amount: investmentAmount,
          byKind: txnsByKind,
          style: (client as any).investmentStyle ?? null,
          annualPercent: investmentAnnualPercent,
          profitMonthlyPercent: investmentProfitMonthlyPercent,
          expectedAnnualProfit,
          expectedMonthlyProfit,
        },
        accountCosts: {
          monthlyPercent: accountDebitMonthlyPercent,
          expectedMonthlyDebit: accountDebitMonthly,
        },
        credit: {
          leverage: creditLeverage || null,
          repayMonthlyPercent: creditRepayMonthlyPercent,
          expectedMonthlyRepay: creditRepayMonthly,
        },
        expected: {
          netMonthly: expectedNetMonthly,
          netAnnual:
            expectedAnnualProfit == null
              ? null
              : expectedAnnualProfit - (accountDebitMonthly ?? 0) * 12 - (creditRepayMonthly ?? 0) * 12,
        },
      },
    };
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
