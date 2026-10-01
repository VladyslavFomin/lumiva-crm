import type { EntityManager } from 'typeorm';

export type ChatContactCrmInfo = {
  lead: { id: string; name: string | null; status: string | null; ownerName: string | null } | null;
  crmContact: { id: string; name: string | null } | null;
  crmCompany: { id: string; name: string | null } | null;
  messageCount: number;
  firstMessageAt: string | null;
};

/**
 * Данные для карточки диалога (раздел «Диалоги» WhatsApp/Telegram): лид с этапом и ответственным,
 * связанные контакт и компания CRM, число сообщений и дата первого. Одним набором запросов на всю
 * страницу списка, а не по запросу на каждый диалог.
 */
export async function enrichChatContacts<T extends { id: string; leadId: string | null; contactId: string | null; companyId: string | null }>(
  manager: EntityManager,
  tenantId: string,
  contacts: T[],
  messageTable: 'whatsapp_messages' | 'telegram_messages',
): Promise<Array<T & ChatContactCrmInfo>> {
  if (!contacts.length) return [];
  const uniq = (xs: Array<string | null>) => [...new Set(xs.filter((x): x is string => !!x))];
  const leadIds = uniq(contacts.map((c) => c.leadId));
  const crmContactIds = uniq(contacts.map((c) => c.contactId));
  const companyIds = uniq(contacts.map((c) => c.companyId));

  const leads: Array<{ id: string; name: string | null; status: string | null; assignedUserIds: string[] | null }> = leadIds.length
    ? await manager.query(
        `SELECT id, name, status, "assignedUserIds" FROM leads WHERE "tenantId" = $1 AND id = ANY($2::uuid[])`,
        [tenantId, leadIds],
      )
    : [];
  const ownerIds = uniq(leads.map((l) => (Array.isArray(l.assignedUserIds) ? l.assignedUserIds[0] ?? null : null)));
  const owners: Array<{ id: string; name: string | null }> = ownerIds.length
    ? // Ответственные лида — сотрудники (staff_users), не учётки users
      await manager.query(
        `SELECT id, COALESCE(NULLIF(full_name, ''), email) AS name FROM staff_users WHERE id = ANY($1::uuid[])`,
        [ownerIds],
      )
    : [];
  const crmContacts: Array<{ id: string; name: string | null }> = crmContactIds.length
    ? await manager.query(
        `SELECT id, COALESCE(NULLIF("fullName", ''), NULLIF(TRIM(CONCAT("firstName", ' ', "lastName")), '')) AS name
           FROM contacts WHERE "tenantId" = $1 AND id = ANY($2::uuid[])`,
        [tenantId, crmContactIds],
      )
    : [];
  const companies: Array<{ id: string; name: string | null }> = companyIds.length
    ? await manager.query(`SELECT id, name FROM companies WHERE "tenantId" = $1 AND id = ANY($2::uuid[])`, [tenantId, companyIds])
    : [];
  const stats: Array<{ contactId: string; count: string; first: Date | null }> = await manager.query(
    `SELECT "contactId", COUNT(*) AS count, MIN(date) AS first FROM ${messageTable}
      WHERE "tenantId" = $1 AND "contactId" = ANY($2::uuid[]) GROUP BY "contactId"`,
    [tenantId, contacts.map((c) => c.id)],
  );

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const ownerById = new Map(owners.map((o) => [o.id, o.name]));
  const contactById = new Map(crmContacts.map((c) => [c.id, c]));
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const statsById = new Map(stats.map((s) => [s.contactId, s]));

  return contacts.map((c) => {
    const l = c.leadId ? leadById.get(c.leadId) : undefined;
    const owner = l && Array.isArray(l.assignedUserIds) && l.assignedUserIds[0] ? ownerById.get(l.assignedUserIds[0]) ?? null : null;
    const s = statsById.get(c.id);
    return {
      ...c,
      lead: l ? { id: l.id, name: l.name, status: l.status, ownerName: owner } : null,
      crmContact: c.contactId && contactById.has(c.contactId) ? contactById.get(c.contactId)! : null,
      crmCompany: c.companyId && companyById.has(c.companyId) ? companyById.get(c.companyId)! : null,
      messageCount: s ? Number(s.count) : 0,
      firstMessageAt: s?.first ? new Date(s.first).toISOString() : null,
    };
  });
}
