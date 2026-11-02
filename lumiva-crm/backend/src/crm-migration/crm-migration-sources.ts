import { AmocrmApiService } from '../integrations/amocrm/amocrm-api.service';
import { BitrixRestService } from '../integrations/bitrix/bitrix-rest.service';

/** Статусы лида Lumiva, в которые раскладываются этапы чужих воронок. */
export type LeadStatus = 'new' | 'in_progress' | 'waiting' | 'won' | 'lost';

export type NormUser = { extId: string; name: string | null; email: string | null };

export type NormStage = {
  /** Ключ этапа для карты статусов: amo:<pipeline>:<status> / b24:<entity>:<status> */
  key: string;
  pipeline: string;
  name: string;
  /** Предлагаемый статус (успех/провал по семантике, первый этап — new) */
  suggested: LeadStatus;
};

export type NormCompany = {
  extId: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  responsibleExtId: string | null;
};

export type NormContact = {
  extId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  position: string | null;
  companyExtId: string | null;
  responsibleExtId: string | null;
};

export type NormLead = {
  /** deal (сделка) / lead (лид Битрикс24) — разные пространства ID */
  kind: 'deal' | 'lead';
  extId: string;
  name: string;
  amount: number | null;
  currency: string | null;
  stageKey: string | null;
  stageName: string | null;
  pipelineName: string | null;
  contactExtId: string | null;
  companyExtId: string | null;
  phone: string | null;
  email: string | null;
  responsibleExtId: string | null;
  createdAt: string | null;
  closedAt: string | null;
};

export interface MigrationSourceAdapter {
  readonly source: 'amocrm' | 'bitrix24';
  account(): Promise<{ name: string; currency: string | null }>;
  users(): Promise<NormUser[]>;
  stages(): Promise<NormStage[]>;
  /** Сколько записей (если источник умеет сказать без полного обхода) */
  counts(): Promise<Partial<Record<'companies' | 'contacts' | 'deals' | 'leads', number>>>;
  companies(onPage: (items: NormCompany[]) => Promise<void>): Promise<void>;
  contacts(onPage: (items: NormContact[]) => Promise<void>): Promise<void>;
  deals(onPage: (items: NormLead[]) => Promise<void>): Promise<void>;
  /** Только у Битрикс24 — отдельная сущность «лид» */
  leads?(onPage: (items: NormLead[]) => Promise<void>): Promise<void>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const str = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
};
const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
};
const isoFromUnix = (v: unknown): string | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
};
const isoFromAny = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

// ───────────────────────────── amoCRM ─────────────────────────────

/** amoCRM API v4: 250 записей на страницу, ≤7 запросов/с; пустая страница — 204 без тела. */
export class AmoSource implements MigrationSourceAdapter {
  readonly source = 'amocrm' as const;
  private static readonly AMO_WON = 142;
  private static readonly AMO_LOST = 143;

  constructor(
    private readonly api: AmocrmApiService,
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async get(path: string): Promise<any> {
    const data = await this.api.request({ baseUrl: this.baseUrl, accessToken: this.token, method: 'GET', path });
    return data && typeof data === 'object' ? data : null;
  }

  private cf(entity: any, code: string): string | null {
    const f = (entity?.custom_fields_values || []).find((x: any) => x?.field_code === code);
    return str(f?.values?.[0]?.value);
  }

  private async pages(path: string, key: string, onPage: (raw: any[]) => Promise<void>) {
    for (let page = 1; page < 10000; page++) {
      const sep = path.includes('?') ? '&' : '?';
      const data = await this.get(`${path}${sep}limit=250&page=${page}`);
      const items = data?._embedded?.[key];
      if (!Array.isArray(items) || !items.length) return;
      await onPage(items);
      if (!data?._links?.next) return;
      await sleep(160);
    }
  }

  async account() {
    const a = await this.get('/api/v4/account');
    return { name: str(a?.name) || str(a?.subdomain) || 'amoCRM', currency: str(a?.currency) };
  }

  async users(): Promise<NormUser[]> {
    const out: NormUser[] = [];
    await this.pages('/api/v4/users', 'users', async (items) => {
      for (const u of items) out.push({ extId: String(u.id), name: str(u.name), email: str(u.email)?.toLowerCase() ?? null });
    });
    return out;
  }

  async stages(): Promise<NormStage[]> {
    const data = await this.get('/api/v4/leads/pipelines');
    const out: NormStage[] = [];
    for (const p of data?._embedded?.pipelines || []) {
      const statuses = [...(p?._embedded?.statuses || [])].sort((a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0));
      // «Неразобранное» (type=1) и первый рабочий этап — новые
      const firstWork = statuses.find((s: any) => s.id !== AmoSource.AMO_WON && s.id !== AmoSource.AMO_LOST && s.type !== 1);
      for (const s of statuses) {
        const suggested: LeadStatus =
          s.id === AmoSource.AMO_WON ? 'won' : s.id === AmoSource.AMO_LOST ? 'lost' : s.type === 1 || s.id === firstWork?.id ? 'new' : 'in_progress';
        out.push({ key: `amo:${p.id}:${s.id}`, pipeline: str(p.name) || String(p.id), name: str(s.name) || String(s.id), suggested });
      }
    }
    return out;
  }

  async counts() {
    return {};
  }

  async companies(onPage: (items: NormCompany[]) => Promise<void>) {
    await this.pages('/api/v4/companies', 'companies', (items) =>
      onPage(
        items.map((c) => ({
          extId: String(c.id),
          name: str(c.name) || `amoCRM #${c.id}`,
          phone: this.cf(c, 'PHONE'),
          email: this.cf(c, 'EMAIL'),
          website: this.cf(c, 'WEB'),
          address: this.cf(c, 'ADDRESS'),
          responsibleExtId: str(c.responsible_user_id),
        })),
      ),
    );
  }

  async contacts(onPage: (items: NormContact[]) => Promise<void>) {
    await this.pages('/api/v4/contacts', 'contacts', (items) =>
      onPage(
        items.map((c) => {
          let first = str(c.first_name);
          let last = str(c.last_name);
          if (!first && !last) first = str(c.name);
          return {
            extId: String(c.id),
            firstName: first,
            lastName: last,
            phone: this.cf(c, 'PHONE'),
            email: this.cf(c, 'EMAIL'),
            position: this.cf(c, 'POSITION'),
            companyExtId: str(c?._embedded?.companies?.[0]?.id),
            responsibleExtId: str(c.responsible_user_id),
          };
        }),
      ),
    );
  }

  async deals(onPage: (items: NormLead[]) => Promise<void>) {
    const stages = new Map((await this.stages()).map((s) => [s.key, s]));
    const { currency } = await this.account();
    await this.pages('/api/v4/leads?with=contacts', 'leads', (items) =>
      onPage(
        items.map((l) => {
          const key = `amo:${l.pipeline_id}:${l.status_id}`;
          const st = stages.get(key);
          const contacts = l?._embedded?.contacts || [];
          const main = contacts.find((c: any) => c.is_main) || contacts[0];
          return {
            kind: 'deal' as const,
            extId: String(l.id),
            name: str(l.name) || `amoCRM #${l.id}`,
            amount: num(l.price),
            currency,
            stageKey: key,
            stageName: st?.name ?? null,
            pipelineName: st?.pipeline ?? null,
            contactExtId: str(main?.id),
            companyExtId: str(l?._embedded?.companies?.[0]?.id),
            phone: null,
            email: null,
            responsibleExtId: str(l.responsible_user_id),
            createdAt: isoFromUnix(l.created_at),
            closedAt: isoFromUnix(l.closed_at),
          };
        }),
      ),
    );
  }
}

// ───────────────────────────── Битрикс24 ─────────────────────────────

/** Битрикс24 REST через входящий вебхук: 50 записей на страницу, ~2 запроса/с. */
export class BitrixSource implements MigrationSourceAdapter {
  readonly source = 'bitrix24' as const;

  constructor(
    private readonly api: BitrixRestService,
    private readonly webhookBase: string,
  ) {}

  private call(method: string, payload: Record<string, unknown> = {}): Promise<any> {
    return this.api.callMethod(this.webhookBase, method, payload);
  }

  private async list(method: string, select: string[], onPage: (raw: any[]) => Promise<void>, extra: Record<string, unknown> = {}) {
    let start: number | undefined = 0;
    for (let guard = 0; start !== undefined && guard < 20000; guard++) {
      const data = await this.call(method, { select, order: { ID: 'ASC' }, start, ...extra });
      const items = Array.isArray(data?.result) ? data.result : [];
      if (items.length) await onPage(items);
      start = typeof data?.next === 'number' ? data.next : undefined;
      if (start !== undefined) await sleep(550);
    }
  }

  private multi(v: unknown): string | null {
    return Array.isArray(v) ? str(v[0]?.VALUE) : null;
  }

  async account() {
    // заодно проверка доступа: без права «CRM» у вебхука этот вызов падает
    const host = (() => {
      try {
        return new URL(this.webhookBase).host;
      } catch {
        return 'Битрикс24';
      }
    })();
    const cur = await this.call('crm.currency.base.get');
    return { name: host, currency: str(cur?.result) };
  }

  async users(): Promise<NormUser[]> {
    const out: NormUser[] = [];
    try {
      await this.list('user.get', [], async (items) => {
        for (const u of items) {
          const name = [str(u.NAME), str(u.LAST_NAME)].filter(Boolean).join(' ') || null;
          out.push({ extId: String(u.ID), name, email: str(u.EMAIL)?.toLowerCase() ?? null });
        }
      });
    } catch {
      // у вебхука нет права «Пользователи» — ответственных просто не сопоставим
    }
    return out;
  }

  async stages(): Promise<NormStage[]> {
    const out: NormStage[] = [];
    const cats: Array<{ id: string; name: string }> = [{ id: '0', name: 'Общая' }];
    try {
      const r = await this.call('crm.dealcategory.list', { order: { SORT: 'ASC' } });
      for (const c of r?.result || []) cats.push({ id: String(c.ID), name: str(c.NAME) || String(c.ID) });
    } catch {
      /* направлений нет или нет прав — только общая воронка */
    }
    const statuses: any[] = [];
    await this.list('crm.status.list', [], async (items) => {
      statuses.push(...items);
    }).catch(() => undefined);
    const semantic = (s: any): string => String(s?.EXTRA?.SEMANTICS || s?.SEMANTICS || '').toLowerCase();
    for (const cat of cats) {
      const entity = cat.id === '0' ? 'DEAL_STAGE' : `DEAL_STAGE_${cat.id}`;
      const list = statuses.filter((s) => s.ENTITY_ID === entity).sort((a, b) => Number(a.SORT) - Number(b.SORT));
      list.forEach((s, i) => {
        const sem = semantic(s);
        out.push({
          key: `b24:deal:${s.STATUS_ID}`,
          pipeline: `Сделки · ${cat.name}`,
          name: str(s.NAME) || String(s.STATUS_ID),
          suggested: sem === 'success' || /WON$/.test(s.STATUS_ID) ? 'won' : sem === 'failure' || /LOSE$/.test(s.STATUS_ID) ? 'lost' : i === 0 ? 'new' : 'in_progress',
        });
      });
    }
    const leadSt = statuses.filter((s) => s.ENTITY_ID === 'STATUS').sort((a, b) => Number(a.SORT) - Number(b.SORT));
    leadSt.forEach((s, i) => {
      const sem = semantic(s);
      out.push({
        key: `b24:lead:${s.STATUS_ID}`,
        pipeline: 'Лиды',
        name: str(s.NAME) || String(s.STATUS_ID),
        suggested: sem === 'success' || s.STATUS_ID === 'CONVERTED' ? 'won' : sem === 'failure' || s.STATUS_ID === 'JUNK' ? 'lost' : i === 0 ? 'new' : 'in_progress',
      });
    });
    return out;
  }

  async counts() {
    const total = async (method: string) => {
      const r = await this.call(method, { select: ['ID'], start: 0 }).catch(() => null);
      return typeof r?.total === 'number' ? r.total : undefined;
    };
    const [companies, contacts, deals, leads] = [
      await total('crm.company.list'),
      await total('crm.contact.list'),
      await total('crm.deal.list'),
      await total('crm.lead.list'),
    ];
    return { companies, contacts, deals, leads };
  }

  async companies(onPage: (items: NormCompany[]) => Promise<void>) {
    await this.list('crm.company.list', ['ID', 'TITLE', 'PHONE', 'EMAIL', 'WEB', 'ADDRESS', 'ASSIGNED_BY_ID'], (items) =>
      onPage(
        items.map((c) => ({
          extId: String(c.ID),
          name: str(c.TITLE) || `Битрикс24 #${c.ID}`,
          phone: this.multi(c.PHONE),
          email: this.multi(c.EMAIL),
          website: this.multi(c.WEB),
          address: str(c.ADDRESS),
          responsibleExtId: str(c.ASSIGNED_BY_ID),
        })),
      ),
    );
  }

  async contacts(onPage: (items: NormContact[]) => Promise<void>) {
    await this.list('crm.contact.list', ['ID', 'NAME', 'LAST_NAME', 'POST', 'COMPANY_ID', 'PHONE', 'EMAIL', 'ASSIGNED_BY_ID'], (items) =>
      onPage(
        items.map((c) => ({
          extId: String(c.ID),
          firstName: str(c.NAME),
          lastName: str(c.LAST_NAME),
          phone: this.multi(c.PHONE),
          email: this.multi(c.EMAIL),
          position: str(c.POST),
          companyExtId: str(c.COMPANY_ID) && c.COMPANY_ID !== '0' ? String(c.COMPANY_ID) : null,
          responsibleExtId: str(c.ASSIGNED_BY_ID),
        })),
      ),
    );
  }

  async deals(onPage: (items: NormLead[]) => Promise<void>) {
    const stages = new Map((await this.stages()).map((s) => [s.key, s]));
    await this.list(
      'crm.deal.list',
      ['ID', 'TITLE', 'OPPORTUNITY', 'CURRENCY_ID', 'STAGE_ID', 'CONTACT_ID', 'COMPANY_ID', 'ASSIGNED_BY_ID', 'DATE_CREATE', 'CLOSEDATE', 'CLOSED'],
      (items) =>
        onPage(
          items.map((d) => {
            const key = `b24:deal:${d.STAGE_ID}`;
            const st = stages.get(key);
            return {
              kind: 'deal' as const,
              extId: String(d.ID),
              name: str(d.TITLE) || `Битрикс24 #${d.ID}`,
              amount: num(d.OPPORTUNITY),
              currency: str(d.CURRENCY_ID),
              stageKey: key,
              stageName: st?.name ?? str(d.STAGE_ID),
              pipelineName: st?.pipeline ?? null,
              contactExtId: str(d.CONTACT_ID) && d.CONTACT_ID !== '0' ? String(d.CONTACT_ID) : null,
              companyExtId: str(d.COMPANY_ID) && d.COMPANY_ID !== '0' ? String(d.COMPANY_ID) : null,
              phone: null,
              email: null,
              responsibleExtId: str(d.ASSIGNED_BY_ID),
              createdAt: isoFromAny(d.DATE_CREATE),
              closedAt: d.CLOSED === 'Y' ? isoFromAny(d.CLOSEDATE) : null,
            };
          }),
        ),
    );
  }

  async leads(onPage: (items: NormLead[]) => Promise<void>) {
    const stages = new Map((await this.stages()).map((s) => [s.key, s]));
    await this.list(
      'crm.lead.list',
      ['ID', 'TITLE', 'NAME', 'LAST_NAME', 'STATUS_ID', 'PHONE', 'EMAIL', 'OPPORTUNITY', 'CURRENCY_ID', 'ASSIGNED_BY_ID', 'CONTACT_ID', 'COMPANY_ID', 'DATE_CREATE', 'DATE_CLOSED'],
      (items) =>
        onPage(
          items.map((l) => {
            const key = `b24:lead:${l.STATUS_ID}`;
            const st = stages.get(key);
            const person = [str(l.NAME), str(l.LAST_NAME)].filter(Boolean).join(' ');
            return {
              kind: 'lead' as const,
              extId: String(l.ID),
              name: str(l.TITLE) || person || `Битрикс24 #${l.ID}`,
              amount: num(l.OPPORTUNITY),
              currency: str(l.CURRENCY_ID),
              stageKey: key,
              stageName: st?.name ?? str(l.STATUS_ID),
              pipelineName: st?.pipeline ?? 'Лиды',
              contactExtId: str(l.CONTACT_ID) && l.CONTACT_ID !== '0' ? String(l.CONTACT_ID) : null,
              companyExtId: str(l.COMPANY_ID) && l.COMPANY_ID !== '0' ? String(l.COMPANY_ID) : null,
              phone: this.multi(l.PHONE),
              email: this.multi(l.EMAIL),
              responsibleExtId: str(l.ASSIGNED_BY_ID),
              createdAt: isoFromAny(l.DATE_CREATE),
              closedAt: isoFromAny(l.DATE_CLOSED),
            };
          }),
        ),
    );
  }
}
