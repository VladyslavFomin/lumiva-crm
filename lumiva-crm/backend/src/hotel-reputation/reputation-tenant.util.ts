/**
 * Название клиента и адрес его CRM для писем, сообщений, задач и PDF модуля отзывов. У тенанта со своим
 * активным доменом (white-label) ссылки ведут на его домен, а в отчётах — его название, не Lumiva.
 */
type Query = (sql: string, params: unknown[]) => Promise<any[]>;

const DEFAULT_BASE = () => (process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');
const TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; v: { name: string | null; frontend: string; customDomain: boolean } }>();

export async function tenantBranding(query: Query, tenantId: string): Promise<{ name: string | null; frontend: string; customDomain: boolean }> {
  const c = cache.get(tenantId);
  if (c && Date.now() - c.at < TTL_MS) return c.v;
  let v = { name: null as string | null, frontend: DEFAULT_BASE(), customDomain: false };
  try {
    const [t] = await query(`SELECT name, custom_domain AS domain, custom_domain_status AS status FROM tenants WHERE id = $1`, [tenantId]);
    const domain = t?.status === 'active' && t?.domain ? String(t.domain).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') : '';
    v = { name: t?.name ? String(t.name) : null, frontend: domain ? `https://${domain}` : DEFAULT_BASE(), customDomain: !!domain };
  } catch {
    /* без БД — ссылки по умолчанию */
  }
  cache.set(tenantId, { at: Date.now(), v });
  return v;
}

/** Только адрес CRM клиента (без завершающего «/»). */
export async function tenantFrontend(query: Query, tenantId: string): Promise<string> {
  return (await tenantBranding(query, tenantId)).frontend;
}
