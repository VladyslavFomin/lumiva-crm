/**
 * Финансы для ИИ-отдела: дебиторка по срокам, онлайн-платежи (iyzico / PayTR / ЮKassa), возвраты, известные
 * расходы (реклама) и сверка «платёж ↔ продажа». Все суммы считает система — по валютам отдельно, без
 * пересчёта. «Оплачено» = есть успешный платёж в CRM (онлайн-оплата ставит продаже статус confirmed)
 * или статус paid у импортированной продажи.
 */
type Q = { query: (sql: string, params?: unknown[]) => Promise<any[]> };
type Lang = 'ru' | 'en' | 'tr';

const OPEN = `s.status IN ('new','confirmed','pending','on_hold') AND s.amount > 0
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p."saleId" = s.id AND p.status = 'paid')`;

export type Mismatch = { kind: 'not_marked' | 'amount' | 'failed'; saleId: string; client: string | null; sale: string; payment: string; provider: string; at: string };

/** Сверка: оплата прошла, а продажа не отмечена; суммы/валюты расходятся; клиент пытался оплатить и не смог. */
export async function reconcile(db: Q, tenantId: string): Promise<Mismatch[]> {
  const rows: any[] = await db.query(
    `SELECT p.provider, p.status pstatus, p.amount pamount, p.currency pcur, COALESCE(p."paidAt", p."updatedAt") at, p."failReason" reason,
            s.id sale_id, s.status sstatus, s.amount samount, s.currency scur, COALESCE(NULLIF(c."fullName", ''), l.name, s."guestName") client,
            EXISTS (SELECT 1 FROM payments p2 WHERE p2."saleId" = s.id AND p2.status = 'paid') has_paid
       FROM payments p JOIN sales s ON s.id = p."saleId" LEFT JOIN contacts c ON c.id = s.contact_id LEFT JOIN leads l ON l.id = s.lead_id
      WHERE p."tenantId" = $1 AND p."updatedAt" > now() - interval '30 days' AND p.status IN ('paid','failed')
      ORDER BY p."updatedAt" DESC LIMIT 200`,
    [tenantId],
  );
  const out: Mismatch[] = [];
  const money = (a: unknown, c: unknown) => `${Number(a).toFixed(2)} ${c}`;
  for (const r of rows) {
    const base = { saleId: r.sale_id, client: r.client ?? null, sale: `${money(r.samount, r.scur)} · ${r.sstatus}`, payment: `${money(r.pamount, r.pcur)} · ${r.pstatus}`, provider: r.provider, at: new Date(r.at).toISOString().slice(0, 10) };
    if (r.pstatus === 'paid' && !['confirmed', 'paid', 'refunded'].includes(r.sstatus)) out.push({ kind: 'not_marked', ...base });
    else if (r.pstatus === 'paid' && (String(r.pcur) !== String(r.scur) || Math.abs(Number(r.pamount) - Number(r.samount)) > 0.01)) out.push({ kind: 'amount', ...base });
    else if (r.pstatus === 'failed' && !r.has_paid && new Date(r.at).getTime() > Date.now() - 3 * 86_400_000 && !['cancelled', 'canceled', 'refunded'].includes(r.sstatus))
      out.push({ kind: 'failed', ...base, payment: `${base.payment}${r.reason ? ` (${String(r.reason).slice(0, 80)})` : ''}` });
  }
  // по продаже — одна строка каждого вида (повторные попытки оплаты не плодят строки)
  const seen = new Set<string>();
  return out.filter((m) => (seen.has(`${m.kind}:${m.saleId}`) ? false : (seen.add(`${m.kind}:${m.saleId}`), true))).slice(0, 30);
}

const T = {
  ru: { h: 'Финансы: проверенные цифры', note: 'посчитано системой; суммы по валютам, без пересчёта', aging: 'Неоплаченные продажи по сроку (без онлайн-оплаты в CRM)', cur: 'Валюта', b1: '0–7 дн', b2: '8–30 дн', b3: '31–90 дн', b4: '90+ дн', pay: 'Онлайн-платежи за 30 дней', prov: 'Шлюз', st: 'Статус', n: 'Кол-во', sum: 'Сумма', ref: 'Возвраты за 30 дней', ads: 'Известные расходы за 30 дней: реклама', rec: 'Сверка платежей с продажами', kind: { not_marked: 'оплата прошла, продажа не отмечена', amount: 'сумма/валюта платежа ≠ продаже', failed: 'клиент не смог оплатить' }, client: 'Клиент', sale: 'Продажа', payment: 'Платёж' },
  en: { h: 'Finance: verified numbers', note: 'computed by the system; amounts per currency, no conversion', aging: 'Unpaid sales by age (no online payment in the CRM)', cur: 'Currency', b1: '0–7 d', b2: '8–30 d', b3: '31–90 d', b4: '90+ d', pay: 'Online payments, last 30 days', prov: 'Gateway', st: 'Status', n: 'Count', sum: 'Amount', ref: 'Refunds, last 30 days', ads: 'Known expenses, last 30 days: advertising', rec: 'Payments vs sales reconciliation', kind: { not_marked: 'paid, but the sale is not marked', amount: 'payment amount/currency ≠ sale', failed: 'client could not pay' }, client: 'Client', sale: 'Sale', payment: 'Payment' },
  tr: { h: 'Finans: doğrulanmış rakamlar', note: 'sistem tarafından hesaplandı; tutarlar para birimine göre, çevrilmeden', aging: 'Yaşa göre ödenmemiş satışlar (CRM’de online ödeme yok)', cur: 'Para birimi', b1: '0–7 g', b2: '8–30 g', b3: '31–90 g', b4: '90+ g', pay: 'Online ödemeler, son 30 gün', prov: 'Ödeme sistemi', st: 'Durum', n: 'Adet', sum: 'Tutar', ref: 'İadeler, son 30 gün', ads: 'Bilinen giderler, son 30 gün: reklam', rec: 'Ödeme–satış mutabakatı', kind: { not_marked: 'ödendi, satış işaretlenmedi', amount: 'ödeme tutarı/para birimi ≠ satış', failed: 'müşteri ödeyemedi' }, client: 'Müşteri', sale: 'Satış', payment: 'Ödeme' },
};

export function mismatchTable(lang: Lang, rows: Mismatch[]): string {
  const t = T[lang];
  return [
    `| ${t.st} | ${t.client} | ${t.sale} | ${t.payment} | ${t.prov} | |`,
    '|---|---|---|---|---|---|',
    ...rows.map((m) => `| ${t.kind[m.kind]} | ${String(m.client ?? '—').replace(/\|/g, '/')} | ${m.sale} | ${m.payment} | ${m.provider} | ${m.at} · sale ${m.saleId} |`),
  ].join('\n');
}

const fmt = (lang: Lang, v: number) => v.toLocaleString(lang === 'ru' ? 'ru-RU' : lang === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 0 });

/** Пакет данных отдела финансов: блок для модели + таблица проверенных цифр для отчёта. */
export async function financePack(db: Q, tenantId: string, lang: Lang): Promise<{ block: string; factsMd: string }> {
  const t = T[lang];
  const [aging, pays, refunds, ads, debtors, mism] = await Promise.all([
    db.query(
      `SELECT s.currency cur,
              sum(CASE WHEN d <= 7 THEN s.amount ELSE 0 END) b1, sum(CASE WHEN d BETWEEN 8 AND 30 THEN s.amount ELSE 0 END) b2,
              sum(CASE WHEN d BETWEEN 31 AND 90 THEN s.amount ELSE 0 END) b3, sum(CASE WHEN d > 90 THEN s.amount ELSE 0 END) b4, count(*) n
         FROM (SELECT s.*, floor(extract(epoch FROM now() - COALESCE(s."saleDate", s."createdAt")) / 86400)::int d FROM sales s WHERE s."tenantId" = $1) s
        WHERE ${OPEN} GROUP BY 1 ORDER BY 1`,
      [tenantId],
    ),
    db.query(`SELECT provider, status, currency cur, count(*) n, sum(amount) sum FROM payments WHERE "tenantId" = $1 AND "createdAt" > now() - interval '30 days' GROUP BY 1, 2, 3 ORDER BY 1, 2`, [tenantId]),
    db.query(`SELECT currency cur, count(*) n, sum(amount) sum FROM sales WHERE "tenantId" = $1 AND status = 'refunded' AND "updatedAt" > now() - interval '30 days' GROUP BY 1`, [tenantId]),
    db.query(
      `SELECT currency cur, sum(cost) sum FROM marketing_traffic WHERE "tenantId" = $1 AND date >= current_date - 30 AND cost > 0
          AND ("dataSource" LIKE 'google_ads%' OR "dataSource" LIKE 'meta_ads%' OR "dataSource" LIKE 'yandex%' OR "dataSource" LIKE 'vk%') GROUP BY 1`,
      [tenantId],
    ).catch(() => []),
    db.query(
      `SELECT s.id, COALESCE(NULLIF(c."fullName", ''), l.name, s."guestName") client, s.amount, s.currency cur, s.status,
              floor(extract(epoch FROM now() - COALESCE(s."saleDate", s."createdAt")) / 86400)::int days
         FROM sales s LEFT JOIN contacts c ON c.id = s.contact_id LEFT JOIN leads l ON l.id = s.lead_id
        WHERE s."tenantId" = $1 AND ${OPEN} ORDER BY s.amount DESC LIMIT 15`,
      [tenantId],
    ),
    reconcile(db, tenantId),
  ]);
  const md: string[] = [`### ${t.h}`, `_${t.note}_`];
  if (aging.length)
    md.push('', `**${t.aging}**`, '', `| ${t.cur} | ${t.b1} | ${t.b2} | ${t.b3} | ${t.b4} | ${t.n} |`, '|---|---|---|---|---|---|', ...aging.map((a) => `| ${a.cur} | ${fmt(lang, +a.b1)} | ${fmt(lang, +a.b2)} | ${fmt(lang, +a.b3)} | ${fmt(lang, +a.b4)} | ${a.n} |`));
  if (pays.length) md.push('', `**${t.pay}**`, '', `| ${t.prov} | ${t.st} | ${t.n} | ${t.sum} |`, '|---|---|---|---|', ...pays.map((p) => `| ${p.provider} | ${p.status} | ${p.n} | ${fmt(lang, +p.sum)} ${p.cur} |`));
  if (refunds.length) md.push('', `**${t.ref}**: ${refunds.map((r) => `${r.n} · ${fmt(lang, +r.sum)} ${r.cur}`).join('; ')}`);
  if (ads.length) md.push('', `**${t.ads}**: ${ads.map((a) => `${fmt(lang, +a.sum)} ${a.cur}`).join('; ')}`);
  if (mism.length) md.push('', `**${t.rec}**`, '', mismatchTable(lang, mism));
  const factsMd = md.length > 2 ? md.join('\n') : '';
  const block =
    `FINANCE DATA (computed by the system — copy numbers exactly, never add currencies together; "unpaid" = no successful online payment recorded in the CRM, a client may have paid by cash/bank transfer — say so instead of accusing):\n` +
    `Receivables aging by currency: ${JSON.stringify(aging)}\nOnline payments 30d: ${JSON.stringify(pays)}\nRefunds 30d: ${JSON.stringify(refunds)}\n` +
    `Known expenses 30d (ONLY advertising is recorded in the CRM — there is no expense ledger; never invent other costs or profit): ${JSON.stringify(ads)}\n` +
    `Biggest unpaid sales: ${JSON.stringify(debtors)}\nReconciliation issues: ${JSON.stringify(mism)}\n` +
    `A verified table with these numbers is attached to your report automatically — do not retype it; write findings and actions.`;
  return { block, factsMd };
}
