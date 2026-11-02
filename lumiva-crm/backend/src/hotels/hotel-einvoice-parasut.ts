import type { HotelEInvoiceDocType, HotelEInvoiceRecipient } from './hotel-einvoice.entities';
import {
  EInvoiceCredentials,
  EInvoiceIssueInput,
  EInvoiceIssueResult,
  EInvoiceJobState,
  EInvoiceProviderAdapter,
  EInvoiceProviderError,
  EInvoiceTokenUpdate,
} from './hotel-einvoice-provider';

type OnToken = (t: EInvoiceTokenUpdate) => Promise<void>;
/** Код UBL-TR налога на проживание (Konaklama Vergisi) — передаётся как «доп. налог» строки */
const ACC_TAX_CODE = 59;
const ACC_PRODUCT_NAME = 'Konaklama hizmeti';
const base = () => (process.env.PARASUT_BASE_URL || 'https://api.parasut.com').replace(/\/+$/, '');
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

/** Текст ошибки Paraşüt (JSON:API errors[] или OAuth error_description) */
const errorText = (body: any, status: number) => {
  const list = Array.isArray(body?.errors) ? body.errors.map((e: any) => [e?.title, e?.detail].filter(Boolean).join(': ')).filter(Boolean) : [];
  if (list.length) return list.join('; ');
  if (body?.error_description || body?.error) return String(body.error_description || body.error);
  if (status === 429) return 'Paraşüt: превышен лимит запросов, повторите через минуту';
  return `Paraşüt: ошибка ${status}`;
};

/**
 * Paraşüt API v4 (apidocs.parasut.com): OAuth2 password grant, токен 2 часа + refresh; счёт — sales_invoices,
 * затем e_invoices (получатель подключён к e-Fatura — проверка e_invoice_inboxes по VKN) или e_archives;
 * формирование асинхронное — trackable_jobs. Налог на проживание — доп. налог строки с кодом 0059 у услуги «Konaklama».
 */
export class ParasutEInvoiceAdapter implements EInvoiceProviderAdapter {
  private async token(c: EInvoiceCredentials, onToken: OnToken, force = false): Promise<string> {
    if (!force && c.accessToken && c.tokenExpiresAt && c.tokenExpiresAt.getTime() > Date.now() + 60_000) return c.accessToken;
    const grant = async (form: Record<string, string>) => {
      const res = await fetch(`${base()}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) });
      const body: any = await res.json().catch(() => null);
      return { ok: res.ok && !!body?.access_token, body, status: res.status };
    };
    let r = !force && c.refreshToken ? await grant({ grant_type: 'refresh_token', client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken }) : null;
    if (!r?.ok) {
      r = await grant({ grant_type: 'password', client_id: c.clientId, client_secret: c.clientSecret, username: c.username, password: c.password, redirect_uri: 'urn:ietf:wg:oauth:2.0:oob' });
    }
    if (!r.ok) throw new EInvoiceProviderError(`Paraşüt не принял вход: ${errorText(r.body, r.status)}`, 'HOTEL_EINVOICE_AUTH', r.status);
    const upd = { accessToken: String(r.body.access_token), refreshToken: r.body.refresh_token ? String(r.body.refresh_token) : null, tokenExpiresAt: new Date(Date.now() + (Number(r.body.expires_in) || 7200) * 1000) };
    Object.assign(c, upd);
    await onToken(upd);
    return upd.accessToken;
  }

  private async call(c: EInvoiceCredentials, onToken: OnToken, method: string, path: string, body?: unknown): Promise<any> {
    const go = async (tok: string) =>
      fetch(`${base()}/v4/${encodeURIComponent(c.companyId)}${path}`, {
        method,
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/vnd.api+json', Accept: 'application/vnd.api+json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    let res = await go(await this.token(c, onToken));
    if (res.status === 401) res = await go(await this.token(c, onToken, true));
    const text = await res.text();
    const json = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
    if (!res.ok) throw new EInvoiceProviderError(errorText(json, res.status), res.status === 404 ? 'HOTEL_EINVOICE_NOT_FOUND' : 'HOTEL_EINVOICE_PROVIDER', res.status);
    return json;
  }

  async testConnection(c: EInvoiceCredentials, onToken: OnToken) {
    await this.token(c, onToken, true);
    // любой лёгкий запрос по фирме: проверяет и номер фирмы, и права пользователя
    await this.call(c, onToken, 'GET', '/contacts?page[size]=1');
    return { companyName: null };
  }

  async lookupInbox(c: EInvoiceCredentials, onToken: OnToken, taxNumber: string) {
    const digits = String(taxNumber || '').replace(/\D/g, '');
    if (!/^\d{10,11}$/.test(digits) || /^1{11}$|^2{10}$/.test(digits)) return null;
    const r = await this.call(c, onToken, 'GET', `/e_invoice_inboxes?filter[vkn]=${digits}`);
    const row = Array.isArray(r?.data) ? r.data[0] : null;
    return row?.attributes?.e_invoice_address ? String(row.attributes.e_invoice_address) : null;
  }

  private async contactId(c: EInvoiceCredentials, onToken: OnToken, p: HotelEInvoiceRecipient) {
    // компанию ищем по налоговому номеру, чтобы не плодить дубли; частное лицо — новый контакт
    if (p.kind === 'company' && p.taxNumber) {
      const found = await this.call(c, onToken, 'GET', `/contacts?filter[tax_number]=${encodeURIComponent(p.taxNumber)}&page[size]=1`);
      if (found?.data?.[0]?.id) return String(found.data[0].id);
    }
    const r = await this.call(c, onToken, 'POST', '/contacts', {
      data: {
        type: 'contacts',
        attributes: {
          name: p.name, contact_type: p.kind, account_type: 'customer', tax_number: p.taxNumber || undefined, tax_office: p.taxOffice || undefined,
          address: p.address || undefined, city: p.city || undefined, district: p.district || undefined, email: p.email || undefined, phone: p.phone || undefined, is_abroad: !!p.abroad,
        },
      },
    });
    return String(r.data.id);
  }

  /** Услуга «Konaklama» с кодом налога 0059: Paraşüt привязывает код доп. налога к услуге */
  private async accProduct(c: EInvoiceCredentials, onToken: OnToken, known: string | null | undefined, vatPct: number) {
    if (known) return known;
    const found = await this.call(c, onToken, 'GET', `/products?filter[name]=${encodeURIComponent(ACC_PRODUCT_NAME)}&page[size]=1`);
    if (found?.data?.[0]?.id) return String(found.data[0].id);
    const r = await this.call(c, onToken, 'POST', '/products', { data: { type: 'products', attributes: { name: ACC_PRODUCT_NAME, vat_rate: vatPct, unit: 'Gün', sales_excise_duty_code: String(ACC_TAX_CODE).padStart(4, '0') } } });
    return String(r.data.id);
  }

  async issue(c: EInvoiceCredentials, onToken: OnToken, input: EInvoiceIssueInput): Promise<EInvoiceIssueResult> {
    const lineTax = (input.settings.accTaxMode || 'line_tax') === 'line_tax';
    const accLines = input.lines.filter((l) => l.kind === 'accommodation' && l.accTaxPct > 0);
    const accProductId = lineTax && accLines.length ? await this.accProduct(c, onToken, input.settings.parasutAccProductId, accLines[0].vatPct) : null;
    const contact = await this.contactId(c, onToken, input.recipient);
    const currency = input.currency === 'TRY' ? 'TRL' : input.currency;
    const details = input.lines.map((l) => {
      const acc = lineTax && l.kind === 'accommodation' && l.accTaxPct > 0;
      return {
        type: 'sales_invoice_details',
        attributes: {
          quantity: l.quantity, unit_price: round(l.unitPrice), vat_rate: l.vatPct, description: l.description,
          ...(l.discount > 0 ? { discount_type: 'amount', discount_value: round(l.discount, 2) } : {}),
          ...(acc ? { excise_duty_type: 'percentage', excise_duty_value: l.accTaxPct } : {}),
        },
        ...(acc && accProductId ? { relationships: { product: { data: { id: accProductId, type: 'products' } } } } : {}),
      };
    });
    const p = input.recipient;
    const inv = await this.call(c, onToken, 'POST', '/sales_invoices', {
      data: {
        type: 'sales_invoices',
        attributes: {
          item_type: 'invoice', description: input.description, issue_date: input.issueDate, due_date: input.issueDate, currency,
          ...(currency !== 'TRL' && input.exchangeRate ? { exchange_rate: input.exchangeRate } : {}),
          ...(input.settings.invoiceSeries ? { invoice_series: input.settings.invoiceSeries } : {}),
          tax_number: p.taxNumber || undefined, tax_office: p.taxOffice || undefined, billing_address: p.address || undefined,
          city: p.city || undefined, district: p.district || undefined, is_abroad: p.abroad ? 'true' : undefined,
        },
        relationships: { contact: { data: { id: contact, type: 'contacts' } }, details: { data: details } },
      },
    });
    const invoiceId = String(inv.data.id);
    const common = {
      note: input.note || undefined,
      ...(accProductId ? { excise_duty_codes: [{ product: Number(accProductId), sales_excise_duty_code: ACC_TAX_CODE }] } : {}),
    };
    const inbox = await this.lookupInbox(c, onToken, p.taxNumber);
    const docType: HotelEInvoiceDocType = inbox ? 'e_invoice' : 'e_archive';
    const job = inbox
      ? await this.call(c, onToken, 'POST', '/e_invoices', { data: { type: 'e_invoices', attributes: { ...common, scenario: 'basic', to: inbox }, relationships: { invoice: { data: { id: invoiceId, type: 'sales_invoices' } } } } })
      : await this.call(c, onToken, 'POST', '/e_archives', { data: { type: 'e_archives', attributes: common, relationships: { sales_invoice: { data: { id: invoiceId, type: 'sales_invoices' } } } } });
    return { externalInvoiceId: invoiceId, docType, jobId: job?.data?.id ? String(job.data.id) : null, settings: accProductId ? { parasutAccProductId: accProductId } : undefined };
  }

  async poll(c: EInvoiceCredentials, onToken: OnToken, externalInvoiceId: string, jobId: string | null): Promise<EInvoiceJobState> {
    if (jobId) {
      const j = await this.call(c, onToken, 'GET', `/trackable_jobs/${encodeURIComponent(jobId)}`);
      const st = j?.data?.attributes?.status;
      if (st === 'running') return { state: 'running' };
      if (st === 'error') {
        const errs = j?.data?.attributes?.errors;
        return { state: 'error', error: (Array.isArray(errs) ? errs.map((e: any) => (typeof e === 'string' ? e : e?.detail || e?.title || JSON.stringify(e))).join('; ') : '') || 'Paraşüt не сформировал документ' };
      }
    }
    const r = await this.call(c, onToken, 'GET', `/sales_invoices/${encodeURIComponent(externalInvoiceId)}?include=active_e_document`);
    const docRef = r?.data?.relationships?.active_e_document?.data;
    if (!docRef?.id) return { state: 'running' };
    const doc = (r.included || []).find((x: any) => x.id === docRef.id && x.type === docRef.type);
    const invoiceNo = doc?.attributes?.invoice_number || r?.data?.attributes?.invoice_no || null;
    return { state: 'done', docId: String(docRef.id), invoiceNo: invoiceNo ? String(invoiceNo) : null };
  }

  async pdfUrl(c: EInvoiceCredentials, onToken: OnToken, docType: HotelEInvoiceDocType, docId: string) {
    const r = await this.call(c, onToken, 'GET', `/${docType === 'e_invoice' ? 'e_invoices' : 'e_archives'}/${encodeURIComponent(docId)}/pdf`);
    return r?.data?.attributes?.url ? String(r.data.attributes.url) : null;
  }

  async cancel(c: EInvoiceCredentials, onToken: OnToken, externalInvoiceId: string) {
    await this.call(c, onToken, 'DELETE', `/sales_invoices/${encodeURIComponent(externalInvoiceId)}/cancel`);
  }
}
