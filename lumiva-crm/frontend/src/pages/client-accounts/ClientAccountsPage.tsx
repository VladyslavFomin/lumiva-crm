// src/pages/client-accounts/ClientAccountsPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { ccpApi, CcpClient, CcpSite, CcpTxn, CcpTransfer } from '../../api/ccp';
import { searchLeadsQuick, createLead } from '../../api/leads';

function cx(...c: Array<string | false | undefined | null>) {
  return c.filter(Boolean).join(' ');
}
function s(v: any) {
  return String(v ?? '').trim();
}
function toNumberMoney(v: any) {
  const raw = s(v).replace(/\s+/g, '').replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
function fmtMoney(v: any) {
  const raw = s(v).replace(/\s+/g, '').replace(',', '.');
  const n = Number(raw);
  if (!Number.isFinite(n)) return s(v) || '0';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function displayAccountBalance(account: any) {
  const financial = account?.financial || {};
  const explicit =
    account?.displayBalance ??
    account?.totalBalance ??
    account?.totalEquity ??
    financial?.totalEquity ??
    financial?.displayBalance ??
    financial?.totalBalance;
  if (explicit !== undefined && explicit !== null && String(explicit) !== '') return toNumberMoney(explicit);

  const operational = account?.balanceOperational ?? financial?.balanceOperational;
  const profitBalance = account?.profitBalance ?? financial?.profitBalance;
  const creditBalance = account?.creditBalance ?? financial?.creditBalance;
  if ([operational, profitBalance, creditBalance].some((value) => value !== undefined && value !== null && String(value) !== '')) {
    return toNumberMoney(operational) + toNumberMoney(profitBalance) + toNumberMoney(creditBalance);
  }

  return toNumberMoney(account?.balance ?? financial?.balance) +
    toNumberMoney(account?.profit ?? financial?.availableProfit) +
    toNumberMoney(account?.credit ?? financial?.creditLeverage ?? financial?.creditLeverageTotal);
}
function pickItems<T>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray((res as any).items)) return (res as any).items as T[];
  if (Array.isArray((res as any)?.data?.items)) return (res as any).data.items as T[];
  return [];
}
function fmtDate(v: any) {
  const ss = s(v);
  if (!ss) return '—';
  const d = new Date(ss);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: '2-digit' });
  }
  return ss;
}
function shortId(id: any) {
  const ss = s(id);
  if (ss.length <= 10) return ss;
  return ss.slice(0, 6) + '…' + ss.slice(-4);
}
function initials(name: string) {
  return (name || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p: string) => p[0]).join('').toUpperCase();
}
function humanStatus(v: any, t: (key: string) => string) {
  const vv = s(v).toLowerCase();
  if (!vv) return t('crm.clientAccounts.status.unknown');
  if (vv === 'done' || vv === 'completed' || vv === 'success' || vv === 'accepted' || vv.includes('выполн')) {
    return t('crm.clientAccounts.status.done');
  }
  if (vv === 'draft' || vv.includes('чернов')) return t('crm.clientAccounts.status.draft');
  if (vv === 'publish' || vv === 'published' || vv.includes('опублик')) return t('crm.clientAccounts.status.published');
  if (vv === 'pending' || vv === 'in_progress' || vv.includes('ожида')) return t('crm.clientAccounts.status.inProgress');
  if (vv === 'failed' || vv === 'error' || vv.includes('ошиб')) return t('crm.clientAccounts.status.failed');
  const orig = s(v);
  return orig.length > 1 ? orig[0].toUpperCase() + orig.slice(1) : orig.toUpperCase();
}

function transferParticipantIds(tr: any, fallbackWpId?: number | null) {
  const fromId = Number(
    tr.fromUserId ??
      tr.fromWpUserId ??
      tr.fromExternalUserId ??
      tr.senderWpUserId ??
      tr.from_user_id ??
      tr.meta?.ccp_tr_from_user ??
      0
  ) || null;
  const toId = Number(
    tr.toUserId ??
      tr.toWpUserId ??
      tr.toExternalUserId ??
      tr.recipientWpUserId ??
      tr.to_user_id ??
      tr.meta?.ccp_tr_to_user ??
      0
  ) || null;
  const participantId = Number(tr.wpUserId ?? tr.externalUserId ?? fallbackWpId ?? 0) || null;

  return {
    fromId: fromId || participantId,
    toId: toId !== (fromId || participantId) ? toId : null,
  };
}

function transferTitle(tr: any, id: any) {
  return s(tr.title) || s(tr.name) || s(tr.type) || `Перевод #${id || tr.id || ''}`;
}

function txnTitle(txn: any, id: any) {
  const type = s(txn.type || txn.transactionType || txn.meta?.transactionType || txn.meta?.transactionTypeId);
  if (s(txn.title)) return s(txn.title);
  if (type === 'manual_adjustment' || type === '3') return 'Финансовая операция';
  if (type) return type.replace(/_/g, ' ');
  return `Операция #${id || txn.id || ''}`;
}

function operationDetails(row: any) {
  const parts = [
    row.desc,
    row.note,
    row.comment,
    row.purpose,
    row.details,
    row.meta?.comment,
    row.meta?.ccp_desc,
    row.meta?.ccp_tr_desc,
    row.meta?.purpose,
    row.meta?.description,
    row.meta?.assetName ? `Asset: ${row.meta.assetName}` : null,
    row.meta?.assetId ? `Asset ID: ${row.meta.assetId}` : null,
    row.meta?.accountId ? `Account ID: ${row.meta.accountId}` : null,
    row.meta?.managerExternalId ? `Manager: ${row.meta.managerExternalId}` : null,
  ]
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean);
  return Array.from(new Set(parts));
}

/* ── Status badge ──────────────────────────────────────────────────────── */
type BadgeKind = 'done' | 'fail' | 'progress' | 'neutral';

function statusKind(v?: string | null): BadgeKind {
  const vv = s(v).toLowerCase();
  if (/done|completed|success|accepted|выполн|опубл|publish/.test(vv)) return 'done';
  if (/reject|cancel|fail|error|ошиб/.test(vv)) return 'fail';
  if (/progress|pending|hold|check|ожида|чернов|draft/.test(vv)) return 'progress';
  return 'neutral';
}

const BADGE_STYLE: Record<BadgeKind, { wrap: string; dot: string }> = {
  done:     { wrap: 'text-[#175c3d] border-[#c5e3d2] bg-[#eaf4ee]', dot: 'bg-[#1f8a5e]' },
  fail:     { wrap: 'text-[#9a1f31] border-[#f0c8cf] bg-[#fbecef]', dot: 'bg-[#cc2f47]' },
  progress: { wrap: 'text-[#7a4a09] border-[#f0d9a8] bg-[#fbf2dc]', dot: 'bg-[#c08319]' },
  neutral:  { wrap: 'text-[#555] border-[#e7e7e7] bg-[#fafafa]',    dot: 'bg-[#888]' },
};

const StatusBadge: React.FC<{ status?: string | null; label: string }> = ({ status, label }) => {
  const kind = statusKind(status);
  const { wrap, dot } = BADGE_STYLE[kind];
  return (
    <span className={cx('inline-flex items-center gap-[5px] rounded-full border px-[9px] py-[3px] text-[11px] font-medium', wrap)}>
      <span className={cx('w-[5px] h-[5px] rounded-full flex-shrink-0', dot)} />
      {label}
    </span>
  );
};

/* ── Spend spark ───────────────────────────────────────────────────────── */
const SpendSpark: React.FC<{ txns: any[] }> = ({ txns }) => {
  const data = txns.length
    ? txns.slice(0, 8).reverse().map((t: any) => Number(t.spendEur || 0) + Number(t.spendUsd || 0))
    : [0];
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[4px] h-[44px]">
      {data.map((v: number, i: number) => (
        <div
          key={i}
          className={cx('flex-1 rounded-[2px_2px_0_0]', v > 0 ? 'bg-[#222]' : 'bg-[#e7e7e7]')}
          style={{ height: `${Math.max(6, (v / max) * 100)}%`, opacity: 0.4 + (i / data.length) * 0.6 }}
        />
      ))}
    </div>
  );
};

type Tab = 'overview' | 'txns' | 'transfers';

const ClientAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [importingLeadId, setImportingLeadId] = useState<string | null>(null);
  const [bulkImport, setBulkImport] = useState<{
    running: boolean; done: number; total: number; created: number; skipped: number; errors: number;
  } | null>(null);
  const [sites, setSites] = useState<CcpSite[]>([]);
  const [siteId, setSiteId] = useState<string>('');
  const [search, setSearch] = useState('');

  const [loadingList, setLoadingList] = useState(false);
  const [clients, setClients] = useState<CcpClient[]>([]);
  const [selected, setSelected] = useState<CcpClient | null>(null);

  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  useEffect(() => {
    const fn = () => setVw(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  const isLg = vw >= 1024;
  const mobileDetailOpen = !isLg && Boolean(selected);

  const [txns, setTxns] = useState<CcpTxn[]>([]);
  const [transfers, setTransfers] = useState<CcpTransfer[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [tab, setTab] = useState<Tab>('overview');

  const [editing, setEditing] = useState(false);
  const [editingTxn, setEditingTxn] = useState<CcpTxn | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<CcpTransfer | null>(null);
  const [eur, setEur] = useState('');
  const [usd, setUsd] = useState('');
  const [accEurNumber, setAccEurNumber] = useState('');
  const [accUsdNumber, setAccUsdNumber] = useState('');
  const [ibanEur, setIbanEur] = useState('');
  const [ibanUsd, setIbanUsd] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);

  const detailsReqRef = useRef(0);
  const fullReqRef = useRef(0);

  const userLabelByWpId = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of clients) {
      const id = Number((c as any).wpUserId);
      if (!Number.isFinite(id) || !id) continue;
      const label = (c as any).name || (c as any).email || `WP#${id}`;
      m.set(id, label);
    }
    return m;
  }, [clients]);

  const getUserLabel = (wpId: any) => {
    const id = Number(wpId);
    if (!Number.isFinite(id) || !id) return t('crm.common.empty');
    return userLabelByWpId.get(id) || t('crm.clientAccounts.wpUserShort', { id });
  };

  useEffect(() => {
    ccpApi
      .sites()
      .then((s) => {
        setSites(s || []);
        if (!siteId && s?.length) setSiteId(s[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImportLead = async (c: CcpClient, e: React.MouseEvent) => {
    e.stopPropagation();
    if (importingLeadId) return;
    const email = (c as any).email?.trim();
    if (!email) return;
    setImportingLeadId(c.id);
    try {
      // Check if a lead already exists with this email
      const found = await searchLeadsQuick(email, 5);
      const existing = found.find(l => l.email?.toLowerCase() === email.toLowerCase());
      if (existing) {
        navigate(`/leads/${existing.id}`);
      } else {
        const lead = await createLead({
          name:   (c as any).name?.trim() || email,
          email,
          phone:  c.phone?.trim() || (c as any).meta?.phone?.trim() || undefined,
          source: 'ClientCabinet',
          meta:   { ccpClientId: c.id, ccpSiteId: c.siteId, ccpWpUserId: (c as any).wpUserId },
        });
        navigate(`/leads/${lead.id}`);
      }
    } catch (err) {
      console.error('Import lead error', err);
    } finally {
      setImportingLeadId(null);
    }
  };

  const handleBulkImportLeads = async () => {
    if (bulkImport?.running) return;

    // Load all clients for the selected site (no WP sync, just DB)
    let allClients: CcpClient[] = [];
    try {
      const res = await ccpApi.clients({ siteId: siteId || undefined, page: 1, per: 1000, fresh: 0 });
      allClients = (res as any)?.items ?? (Array.isArray(res) ? res : []);
    } catch {
      return;
    }

    const withEmail = allClients.filter((c) => (c as any).email?.trim());
    if (!withEmail.length) return;

    setBulkImport({ running: true, done: 0, total: withEmail.length, created: 0, skipped: 0, errors: 0 });

    let created = 0, skipped = 0, errors = 0;

    for (let i = 0; i < withEmail.length; i++) {
      const c = withEmail[i];
      const email = (c as any).email.trim();
      try {
        const found = await searchLeadsQuick(email, 3);
        const exists = found.find((l) => l.email?.toLowerCase() === email.toLowerCase());
        if (exists) {
          skipped++;
        } else {
          await createLead({
            name:   (c as any).name?.trim() || email,
            email,
            phone:  c.phone?.trim() || (c as any).meta?.phone?.trim() || undefined,
            source: 'ClientCabinet',
            meta:   { ccpClientId: c.id, ccpSiteId: c.siteId, ccpWpUserId: (c as any).wpUserId },
          });
          created++;
        }
      } catch {
        errors++;
      }
      setBulkImport({ running: true, done: i + 1, total: withEmail.length, created, skipped, errors });
    }

    setBulkImport({ running: false, done: withEmail.length, total: withEmail.length, created, skipped, errors });
  };

  const loadList = async () => {
    try {
      setLoadingList(true);
      const res = await ccpApi.clients({
        siteId: siteId || undefined,
        search: search || undefined,
        page: 1,
        per: 80,
        fresh: siteId && !search ? 1 : undefined,
      });

      const items = (res as any)?.items || (res as any) || [];
      setClients(items);

      if (!items?.length) {
        setSelected(null);
      } else if (!selected || !items.some((x: any) => x.id === (selected as any).id)) {
        setSelected(items[0]);
      }
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, search]);

  const loadDetails = async (c: CcpClient) => {
    const reqId = ++detailsReqRef.current;
    try {
      setLoadingDetails(true);

      const [txnsResult, transfersResult] = await Promise.allSettled([
        ccpApi.txns({ siteId: c.siteId, wpUserId: c.wpUserId, page: 1, per: 200, fresh: 1 } as any),
        ccpApi.transfers({ siteId: c.siteId, wpUserId: c.wpUserId, page: 1, per: 200, fresh: 1 } as any),
      ]);

      if (reqId !== detailsReqRef.current) return;

      setTxns(txnsResult.status === 'fulfilled' ? pickItems<CcpTxn>(txnsResult.value) : []);
      setTransfers(transfersResult.status === 'fulfilled' ? pickItems<CcpTransfer>(transfersResult.value) : []);
    } catch {
      if (reqId !== detailsReqRef.current) return;
      setTxns([]);
      setTransfers([]);
    } finally {
      if (reqId !== detailsReqRef.current) return;
      setLoadingDetails(false);
    }
  };

  const loadFullClient = async (id: string) => {
    const reqId = ++fullReqRef.current;
    try {
      const full = await ccpApi.client(id);
      if (reqId !== fullReqRef.current) return;
      setSelected(full);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!selected?.id) return;
    setEditing(false);
    loadFullClient(String((selected as any).id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;

    setEur(String((selected as any).balanceEur ?? '0'));
    setUsd(String((selected as any).balanceUsd ?? '0'));
    setAccEurNumber(String((selected as any).accountEur ?? ''));
    setAccUsdNumber(String((selected as any).accountUsd ?? ''));
    setIbanEur(String((selected as any).ibanEur ?? ''));
    setIbanUsd(String((selected as any).ibanUsd ?? ''));

    loadDetails(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.updatedAt, selected?.id]);

  const siteName = useMemo(() => {
    const sss = sites.find((x) => x.id === selected?.siteId);
    return (sss as any)?.siteHost || (sss as any)?.siteUrl || '';
  }, [selected?.siteId, sites]);

  const totals = useMemo(() => {
    const eurSpent = txns.reduce((a, t: any) => a + Number(t?.spendEur ?? 0), 0);
    const usdSpent = txns.reduce((a, t: any) => a + Number(t?.spendUsd ?? 0), 0);
    return { eurSpent, usdSpent };
  }, [txns]);

  const selectedAccounts = useMemo(() => {
    const accounts = (selected as any)?.meta?.accounts;
    return Array.isArray(accounts) ? accounts : [];
  }, [selected]);

  const selectedFinancialSummary = useMemo(() => {
    const summary = (selected as any)?.meta?.financialSummary;
    return Array.isArray(summary) ? summary : [];
  }, [selected]);

  const selectedInvestments = useMemo(() => {
    const investments = (selected as any)?.meta?.investments;
    return Array.isArray(investments) ? investments : [];
  }, [selected]);

  const saveClient = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      const dto = {
        meta: {
          ccp_acc_eur_balance: toNumberMoney(eur),
          ccp_acc_usd_balance: toNumberMoney(usd),
          ccp_acc_eur_number: s(accEurNumber),
          ccp_acc_usd_number: s(accUsdNumber),
          ccp_iban_eur: s(ibanEur) || undefined,
          ccp_iban_usd: s(ibanUsd) || undefined,
          ccp_balance_eur: toNumberMoney(eur),
          ccp_balance_usd: toNumberMoney(usd),
        },
      };
      const updated = await ccpApi.updateClient(selected.id, dto);
      const full = await ccpApi.client(updated.id);
      setSelected(full);
      setClients((prev) => prev.map((x) => (x.id === full.id ? full : x)));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const saveTxn = async (row: CcpTxn, patch: any) => {
    if (!selected) return;
    setSavingActivity(true);
    try {
      await ccpApi.updateTxn((row as any).siteId, (row as any).wpPostId, {
        title: patch.title,
        status: (row as any).status || 'publish',
        meta: {
          ccp_user_id: Number((row as any).wpUserId || (selected as any).wpUserId || 0),
          ccp_spend_eur: toNumberMoney(patch.spendEur),
          ccp_spend_usd: toNumberMoney(patch.spendUsd),
          ccp_date: s(patch.date),
          ccp_desc: s(patch.desc),
          ccp_status: s(patch.ccpStatus || (row as any).ccpStatus || 'Done'),
        },
      });
      setEditingTxn(null);
      await loadDetails(selected);
    } finally {
      setSavingActivity(false);
    }
  };

  const saveTransfer = async (row: CcpTransfer, patch: any) => {
    if (!selected) return;
    setSavingActivity(true);
    try {
      await ccpApi.updateTransfer((row as any).siteId, (row as any).wpPostId, {
        title: patch.title,
        status: (row as any).status || 'publish',
        meta: {
          ccp_tr_amount: toNumberMoney(patch.amount),
          ccp_tr_from_cur: s(patch.fromCurrency || 'USD'),
          ccp_tr_to_cur: s(patch.toCurrency || 'USD'),
          ccp_tr_rate: toNumberMoney(patch.rate || 1),
          ccp_tr_desc: s(patch.desc),
          ccp_tr_from_user: Number(patch.fromUserId || 0),
          ccp_tr_to_user: Number(patch.toUserId || 0),
          ccp_tr_date: s(patch.date),
          ccp_tr_note: s(patch.note),
          ccp_tr_status: s(patch.ccpStatus || (row as any).ccpStatus || 'Done'),
        },
      });
      setEditingTransfer(null);
      await loadDetails(selected);
    } finally {
      setSavingActivity(false);
    }
  };

  const refreshAll = async () => {
    await loadList();
    if (selected) await loadDetails(selected);
  };

  return (
    <MainLayout>
      {/* ── Page header ── */}
      <div className="mb-5 flex flex-col items-start gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-[6px] h-[6px] rounded-full bg-[#222]" />
            <span className="cd-mono text-[10px] font-medium tracking-[0.18em] uppercase text-[#888]">
              CCP · Финансы
            </span>
          </div>
          <h1 className="cd-display text-[22px] font-semibold tracking-[-0.02em] text-[#222]">
            {t('crm.clientAccounts.title')}
          </h1>
          <p className="mt-0.5 text-[13px] text-[#888]">{t('crm.clientAccounts.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/client-accounts/operations"
            className="rounded-[8px] border border-[#e7e7e7] bg-white px-3.5 py-2 text-[12px] font-medium text-[#444] hover:border-[#ccc] hover:bg-[#fafafa] transition-colors"
          >
            Финансовые операции
          </Link>
          <Link
            to="/client-accounts/sites"
            className="rounded-[8px] border border-[#e7e7e7] bg-white px-3.5 py-2 text-[12px] font-medium text-[#444] hover:border-[#ccc] hover:bg-[#fafafa] transition-colors"
          >
            Управление сайтами
          </Link>
          {/* Bulk import */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkImportLeads}
              disabled={bulkImport?.running}
              className="rounded-[8px] border border-[#e7e7e7] bg-white px-3.5 py-2 text-[12px] font-medium text-[#444] hover:border-[#ccc] hover:bg-[#fafafa] disabled:opacity-60 transition-colors flex items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 3-5.5 6-5.5s6 2.5 6 5.5"/><path d="M19 8v6"/><path d="M16 11h6"/></svg>
              {bulkImport?.running
                ? `${bulkImport.done} / ${bulkImport.total}…`
                : 'Импортировать все лиды'}
            </button>
            {bulkImport && !bulkImport.running && (
              <div className="flex items-center gap-2 text-[11px]">
                {bulkImport.created > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#c5e3d2] bg-[#eaf4ee] px-2.5 py-[3px] text-[#175c3d] font-medium">
                    +{bulkImport.created} создано
                  </span>
                )}
                {bulkImport.skipped > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#e7e7e7] bg-[#fafafa] px-2.5 py-[3px] text-[#888] font-medium">
                    {bulkImport.skipped} пропущено
                  </span>
                )}
                {bulkImport.errors > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#f0c8cf] bg-[#fbecef] px-2.5 py-[3px] text-[#9a1f31] font-medium">
                    {bulkImport.errors} ошибок
                  </span>
                )}
                <button
                  onClick={() => setBulkImport(null)}
                  className="text-[#b5b5b5] hover:text-[#555] transition-colors"
                  aria-label="Скрыть"
                >×</button>
              </div>
            )}
          </div>
          <button
            onClick={refreshAll}
            className="rounded-[8px] border border-[#222] bg-[#222] px-3.5 py-2 text-[12px] font-medium text-white hover:bg-[#111] transition-colors"
          >
            {t('crm.clientAccounts.refresh')}
          </button>
        </div>
      </div>

      {/* ── Master-detail shell ── */}
      <div
        className="grid gap-4 h-auto min-h-0 lg:h-[calc(100vh-210px)] lg:min-h-[560px]"
        style={{ gridTemplateColumns: isLg ? '340px 1fr' : '1fr' }}
      >

        {/* ── LEFT — client list ── */}
        <div
          className={cx(
            'rounded-[14px] border border-[#e7e7e7] bg-white overflow-hidden flex-col',
            mobileDetailOpen ? 'hidden lg:flex' : 'flex'
          )}
          style={{ maxHeight: 'calc(100vh - 210px)' }}
        >
          {/* List header */}
          <div className="p-4 border-b border-[#f0f0f0]">
            <div>
              <div className="cd-mono text-[10px] font-medium tracking-[0.18em] uppercase text-[#888] mb-1.5">
                {t('crm.clientAccounts.sitesLabel')}
              </div>
              <select
                className="w-full rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[13px] text-[#222] outline-none focus:border-[#222] transition-colors appearance-none"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
              >
                {sites.length === 0 ? <option value="">Нет подключённых сайтов</option> : null}
                {sites.map((ss) => (
                  <option key={ss.id} value={ss.id}>
                    {(ss as any).siteHost || (ss as any).siteUrl}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3">
              <div className="cd-mono text-[10px] font-medium tracking-[0.18em] uppercase text-[#888] mb-1.5">
                {t('crm.clientAccounts.searchLabel')}
              </div>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b5b5b5]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>
                <input
                  className="w-full rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] pl-8 pr-3 py-2 text-[13px] text-[#222] outline-none focus:border-[#222] placeholder-[#b5b5b5] transition-colors"
                  placeholder={t('crm.clientAccounts.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-[#888]">
              <span>Клиентов: <strong className="text-[#222]">{clients.length}</strong></span>
              {siteName && <span className="truncate ml-2">{siteName}</span>}
            </div>
          </div>

          {/* Client list */}
          <div className="flex-1 overflow-y-auto">
            {loadingList && (
              <div className="p-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-[10px] border border-[#f0f0f0] p-3 animate-pulse">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#f0f0f0]" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-3/4 bg-[#f0f0f0] rounded" />
                        <div className="h-2.5 w-1/2 bg-[#f0f0f0] rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingList && clients.length === 0 && (
              <div className="p-5 text-[13px] text-[#888]">{t('crm.clientAccounts.clientsEmpty')}</div>
            )}

            {!loadingList && clients.length > 0 && (
              <div className="p-3 space-y-1.5">
                {clients.map((c) => {
                  const active = selected?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(c)}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelected(c)}
                      className={cx(
                        'w-full text-left rounded-[10px] border p-3 transition-all cursor-pointer',
                        active
                          ? 'border-[#222] bg-white shadow-[0_0_0_1px_#222]'
                          : 'border-[#f0f0f0] bg-white hover:border-[#e7e7e7] hover:bg-[#fafafa]'
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-[#f0f0f0] flex items-center justify-center flex-shrink-0 cd-mono text-[11px] font-semibold text-[#888]">
                          {initials((c as any).name || (c as any).email)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-[#222] truncate leading-snug">
                                {(c as any).name || (c as any).email}
                              </div>
                              <div className="text-[11px] text-[#888] truncate mt-0.5">{(c as any).email}</div>
                            </div>
                            <div className="cd-mono text-[10px] text-[#b5b5b5] flex-shrink-0 mt-0.5">
                              WP#{(c as any).wpUserId}
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <div className="rounded-[6px] border border-[#f0f0f0] bg-[#fafafa] px-2 py-1.5">
                              <div className="cd-mono text-[9px] font-medium tracking-[0.14em] uppercase text-[#b5b5b5]">EUR</div>
                              <div className="cd-mono text-[12px] font-semibold text-[#222] mt-0.5">{fmtMoney((c as any).balanceEur)}</div>
                            </div>
                            <div className="rounded-[6px] border border-[#f0f0f0] bg-[#fafafa] px-2 py-1.5">
                              <div className="cd-mono text-[9px] font-medium tracking-[0.14em] uppercase text-[#b5b5b5]">USD</div>
                              <div className="cd-mono text-[12px] font-semibold text-[#222] mt-0.5">{fmtMoney((c as any).balanceUsd)}</div>
                            </div>
                          </div>
                          {/* Import / open lead */}
                          <button
                            type="button"
                            disabled={importingLeadId === c.id}
                            onClick={e => handleImportLead(c, e)}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 h-7 rounded-[7px] border border-[#e7e7e7] bg-white cd-mono text-[10px] font-medium text-[#555] hover:border-[#222] hover:text-[#222] disabled:opacity-50 transition-colors"
                          >
                            {importingLeadId === c.id ? (
                              '…'
                            ) : (
                              <>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 3-5.5 6-5.5s6 2.5 6 5.5"/><path d="M19 8v6"/><path d="M16 11h6"/></svg>
                                Импортировать лид
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT — detail panel ── */}
        <div
          className={cx(
            'rounded-[14px] border border-[#e7e7e7] bg-white overflow-hidden flex-col',
            mobileDetailOpen ? 'flex' : 'hidden lg:flex'
          )}
          style={{ maxHeight: 'calc(100vh - 210px)' }}
        >
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#888]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#b5b5b5]"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14" r="1.4" fill="currentColor"/></svg>
              <span className="text-[13px]">{t('crm.clientAccounts.selectClient')}</span>
            </div>
          ) : (
            <>
              {/* Sticky header */}
              <div className="border-b border-[#f0f0f0] bg-white">
                <div className="px-5 pt-4 pb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 w-full lg:w-auto">
                    {!isLg && (
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="mb-2 inline-flex items-center rounded-full border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#444] hover:bg-[#fafafa] transition-colors"
                      >
                        ← Назад
                      </button>
                    )}
                    <div className="cd-display text-[18px] font-semibold text-[#222] tracking-[-0.02em] truncate">
                      {(selected as any).name || (selected as any).email}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#888]">
                      <span>{(selected as any).email}</span>
                      <span className="text-[#e7e7e7]">•</span>
                      <span className="cd-mono">WP#{(selected as any).wpUserId}</span>
                      {siteName && (
                        <>
                          <span className="text-[#e7e7e7]">•</span>
                          <span>{siteName}</span>
                        </>
                      )}
                      <span className="text-[#e7e7e7]">•</span>
                      <span className="cd-mono">ID {shortId((selected as any).id)}</span>
                      <span className="text-[#e7e7e7]">•</span>
                      <Link
                        to={`/app/client-accounts/${(selected as any).id}`}
                        className="text-[#222] underline underline-offset-2 hover:text-[#555] transition-colors"
                      >
                        {t('crm.clientAccounts.openPage')}
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto lg:flex-shrink-0">
                    <Link
                      to={`/app/client-accounts/${(selected as any).id}/analytics`}
                      className="rounded-[8px] border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#444] hover:border-[#ccc] hover:bg-[#fafafa] transition-colors"
                    >
                      Аналитика
                    </Link>
                    <button
                      onClick={() => loadDetails(selected)}
                      className="rounded-[8px] border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#444] hover:border-[#ccc] hover:bg-[#fafafa] transition-colors"
                    >
                      {t('crm.clientAccounts.refreshActivity')}
                    </button>
                    {!editing ? (
                      <button
                        onClick={() => setEditing(true)}
                        className="rounded-[8px] border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#444] hover:border-[#ccc] hover:bg-[#fafafa] transition-colors"
                      >
                        {t('crm.clientAccounts.edit')}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditing(false)}
                          className="rounded-[8px] border border-[#e7e7e7] px-3 py-1.5 text-[12px] font-medium text-[#555] hover:bg-[#fafafa] transition-colors"
                        >
                          {t('crm.clientAccounts.cancel')}
                        </button>
                        <button
                          disabled={saving}
                          onClick={saveClient}
                          className="rounded-[8px] border border-[#222] bg-[#222] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#111] disabled:opacity-50 transition-colors"
                        >
                          {saving ? t('crm.clientAccounts.saving') : t('crm.clientAccounts.save')}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="px-5 pb-3 flex items-center gap-1.5 overflow-x-auto">
                  {(['overview', 'txns', 'transfers'] as Tab[]).map((tabKey) => (
                    <button
                      key={tabKey}
                      onClick={() => setTab(tabKey)}
                      className={cx(
                        'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-all flex-shrink-0',
                        tab === tabKey
                          ? 'bg-[#222] border-[#222] text-white'
                          : 'bg-white border-[#e7e7e7] text-[#555] hover:border-[#ccc] hover:bg-[#fafafa]'
                      )}
                    >
                      {tabKey === 'overview' && (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14" r="1.4" fill="currentColor"/></svg>
                          {t('crm.clientAccounts.tabs.overview')}
                        </>
                      )}
                      {tabKey === 'txns' && (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
                          {t('crm.clientAccounts.tabs.txns', { count: txns.length })}
                          <span className={cx('rounded-full px-1.5 py-[1px] text-[10px] font-medium', tab === 'txns' ? 'bg-white/20 text-white' : 'bg-[#f0f0f0] text-[#888]')}>{txns.length}</span>
                        </>
                      )}
                      {tabKey === 'transfers' && (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 4v13M7 4L4 7M7 4l3 3"/><path d="M17 20V7M17 20l3-3M17 20l-3-3"/></svg>
                          {t('crm.clientAccounts.tabs.transfers', { count: transfers.length })}
                          <span className={cx('rounded-full px-1.5 py-[1px] text-[10px] font-medium', tab === 'transfers' ? 'bg-white/20 text-white' : 'bg-[#f0f0f0] text-[#888]')}>{transfers.length}</span>
                        </>
                      )}
                    </button>
                  ))}
                  {loadingDetails && (
                    <div className="ml-auto text-[11px] text-[#888]">{t('crm.clientAccounts.loading')}</div>
                  )}
                </div>

                {/* Editing banner */}
                {editing && (
                  <div className="mx-5 mb-3 flex items-center gap-2 rounded-[8px] border border-[#f0d9a8] bg-[#fbf2dc] px-3.5 py-2.5 text-[12px] text-[#7a4a09]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14 6l4 4"/></svg>
                    Режим редактирования
                    <span className="cd-mono ml-auto text-[11px]">баланс · номер счёта · IBAN</span>
                  </div>
                )}
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto p-5">

                {/* ── OVERVIEW ── */}
                {tab === 'overview' && (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* EUR account card */}
                      <div className="rounded-[12px] border border-[#e7e7e7] bg-white p-5" style={{ borderTop: '3px solid #1f1f1f' }}>
                        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                          <div className="min-w-0">
                            <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888]">Счёт · EUR</div>
                            <div className="mt-2">
                              {editing ? (
                                <input
                                  className="w-full rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[22px] font-semibold text-[#222] outline-none focus:border-[#222] transition-colors cd-display"
                                  value={eur}
                                  onChange={(e) => setEur(e.target.value)}
                                />
                              ) : (
                                <div className="cd-display text-[28px] font-semibold tracking-[-0.03em] text-[#222] leading-none">
                                  {fmtMoney(eur)}<span className="text-[16px] text-[#888] font-medium ml-[5px]">€</span>
                                </div>
                              )}
                            </div>
                            {!editing && (
                              <div className="mt-1.5 flex items-center gap-1 text-[11px] text-[#888]">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>
                                Потрачено: <span className="cd-mono">{fmtMoney(totals.eurSpent)} €</span>
                              </div>
                            )}
                          </div>
                          <div className="rounded-[8px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2 text-right max-w-full">
                            <div className="text-[9px] text-[#b5b5b5] uppercase tracking-[0.12em]">Счёт №</div>
                            <div className="mt-0.5 cd-mono text-[11px] font-semibold text-[#222] break-all">{accEurNumber || '—'}</div>
                          </div>
                        </div>
                        <div className="border-t border-[#f0f0f0] pt-4 space-y-3">
                          <div>
                            <div className="text-[10px] text-[#888] uppercase tracking-[0.14em] mb-1.5">Номер счёта</div>
                            {editing ? (
                              <input
                                className="w-full rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[13px] text-[#222] outline-none focus:border-[#222] transition-colors"
                                value={accEurNumber}
                                onChange={(e) => setAccEurNumber(e.target.value)}
                                placeholder={t('crm.clientAccounts.accounts.eurNumberPlaceholder')}
                              />
                            ) : (
                              <div className="cd-mono text-[12px] text-[#222] break-all">{accEurNumber || <span className="text-[#b5b5b5]">—</span>}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] text-[#888] uppercase tracking-[0.14em] mb-1.5">IBAN</div>
                            {editing ? (
                              <input
                                className="w-full rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[13px] text-[#222] outline-none focus:border-[#222] transition-colors"
                                value={ibanEur}
                                onChange={(e) => setIbanEur(e.target.value)}
                                placeholder={t('crm.clientAccounts.accounts.ibanPlaceholder')}
                              />
                            ) : (
                              <div className="cd-mono text-[12px] text-[#222] break-all">{ibanEur || <span className="text-[#b5b5b5]">—</span>}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* USD account card */}
                      <div className="rounded-[12px] border border-[#e7e7e7] bg-white p-5" style={{ borderTop: '3px solid #1f8a5e' }}>
                        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                          <div className="min-w-0">
                            <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888]">Счёт · USD</div>
                            <div className="mt-2">
                              {editing ? (
                                <input
                                  className="w-full rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[22px] font-semibold text-[#222] outline-none focus:border-[#222] transition-colors cd-display"
                                  value={usd}
                                  onChange={(e) => setUsd(e.target.value)}
                                />
                              ) : (
                                <div className="cd-display text-[28px] font-semibold tracking-[-0.03em] text-[#222] leading-none">
                                  {fmtMoney(usd)}<span className="text-[16px] text-[#888] font-medium ml-[5px]">$</span>
                                </div>
                              )}
                            </div>
                            {!editing && (
                              <div className="mt-1.5 flex items-center gap-1 text-[11px] text-[#888]">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>
                                Потрачено: <span className="cd-mono">{fmtMoney(totals.usdSpent)} $</span>
                              </div>
                            )}
                          </div>
                          <div className="rounded-[8px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2 text-right max-w-full">
                            <div className="text-[9px] text-[#b5b5b5] uppercase tracking-[0.12em]">Счёт №</div>
                            <div className="mt-0.5 cd-mono text-[11px] font-semibold text-[#222] break-all">{accUsdNumber || '—'}</div>
                          </div>
                        </div>
                        <div className="border-t border-[#f0f0f0] pt-4 space-y-3">
                          <div>
                            <div className="text-[10px] text-[#888] uppercase tracking-[0.14em] mb-1.5">Номер счёта</div>
                            {editing ? (
                              <input
                                className="w-full rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[13px] text-[#222] outline-none focus:border-[#222] transition-colors"
                                value={accUsdNumber}
                                onChange={(e) => setAccUsdNumber(e.target.value)}
                                placeholder={t('crm.clientAccounts.accounts.usdNumberPlaceholder')}
                              />
                            ) : (
                              <div className="cd-mono text-[12px] text-[#222] break-all">{accUsdNumber || <span className="text-[#b5b5b5]">—</span>}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] text-[#888] uppercase tracking-[0.14em] mb-1.5">IBAN</div>
                            {editing ? (
                              <input
                                className="w-full rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[13px] text-[#222] outline-none focus:border-[#222] transition-colors"
                                value={ibanUsd}
                                onChange={(e) => setIbanUsd(e.target.value)}
                                placeholder={t('crm.clientAccounts.accounts.ibanPlaceholder')}
                              />
                            ) : (
                              <div className="cd-mono text-[12px] text-[#222] break-all">{ibanUsd || <span className="text-[#b5b5b5]">—</span>}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats + spark row */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-[12px] border border-[#e7e7e7] bg-white p-4">
                        <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-3">Сводка</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-[11px] text-[#888] mb-1">Операций</div>
                            <div className="cd-display text-[26px] font-semibold text-[#222] tracking-[-0.03em] leading-none">{txns.length}</div>
                          </div>
                          <div>
                            <div className="text-[11px] text-[#888] mb-1">Переводов</div>
                            <div className="cd-display text-[26px] font-semibold text-[#222] tracking-[-0.03em] leading-none">{transfers.length}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-[11px] text-[#888]">
                          Обновлено: <span className="cd-mono text-[#222]">{fmtDate((selected as any).updatedAt)}</span>
                        </div>
                      </div>

                      <div className="rounded-[12px] border border-[#e7e7e7] bg-white p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888]">Динамика расходов</div>
                          <span className="text-[11px] text-[#888]">{txns.length} опер.</span>
                        </div>
                        <SpendSpark txns={txns} />
                      </div>
                    </div>

                    {/* Financial summary */}
                    {selectedFinancialSummary.length > 0 && (
                      <div className="mt-4 rounded-[12px] border border-[#e7e7e7] bg-white p-4">
                        <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-3">Финансовые totals сайта</div>
                        <div className="space-y-2.5">
                          {selectedFinancialSummary.map((row: any, index: number) => (
                            <div key={`${row?.currency || 'total'}-${index}`} className="rounded-[8px] border border-[#f0f0f0] bg-[#fafafa] p-3">
                              <div className="text-[13px] font-semibold text-[#222] mb-2">{row?.currency || '—'}</div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                                <div className="text-[#888]">Инвестировано <span className="cd-mono text-[#222] ml-1">{fmtMoney(row?.invested ?? row?.investmentTotal)}</span></div>
                                <div className="text-[#888]">Ожид. профит <span className="cd-mono text-[#222] ml-1">{fmtMoney(row?.expectedProfit)}</span></div>
                                <div className="text-[#888]">Начислено <span className="cd-mono text-[#222] ml-1">{fmtMoney(row?.profitAccrued ?? row?.profitAccrualTotal)}</span></div>
                                <div className="text-[#888]">Кредит <span className="cd-mono text-[#222] ml-1">{fmtMoney(row?.creditLeverage ?? row?.creditLeverageTotal)}</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Investments */}
                    {selectedInvestments.length > 0 && (
                      <div className="mt-4 rounded-[12px] border border-[#e7e7e7] bg-white p-4">
                        <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-3">Инвестиции</div>
                        <div className="space-y-2.5">
                          {selectedInvestments.slice(0, 5).map((inv: any, index: number) => (
                            <div key={inv?.transactionId || `${inv?.assetId}-${index}`} className="rounded-[8px] border border-[#f0f0f0] bg-[#fafafa] p-3">
                              <div className="text-[13px] font-semibold text-[#222]">{inv?.assetName || '—'}</div>
                              <div className="mt-0.5 text-[11px] text-[#888]">{inv?.assetCategory || '—'} · {inv?.assetCalculation || '—'}</div>
                              <div className="mt-1.5 cd-mono text-[12px] text-[#555]">
                                {fmtMoney(inv?.invested)} {inv?.currency || ''} · ожидается {fmtMoney(inv?.expectedProfit)} {inv?.currency || ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* NSM accounts */}
                    {selectedAccounts.length > 0 && (
                      <div className="mt-4 rounded-[12px] border border-[#e7e7e7] bg-white p-4">
                        <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-3">Счета NSM</div>
                        <div className="space-y-2.5">
                          {selectedAccounts.map((account: any, index: number) => {
                            const financial = account?.financial || {};
                            const currency = account?.currency || financial?.currency || '—';
                            return (
                              <div key={account?.externalAccountId || account?.id || index} className="rounded-[8px] border border-[#f0f0f0] bg-[#fafafa] p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-[13px] font-semibold text-[#222]">{account?.number || `Счет ${index + 1}`}</div>
                                  <div className="cd-mono text-[10px] text-[#888]">{currency} · {account?.status || '—'}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                                  <div className="text-[#888]">Баланс CRM <span className="cd-mono text-[#222] ml-1">{fmtMoney(displayAccountBalance(account))}</span></div>
                                  <div className="text-[#888]">Опер. баланс <span className="cd-mono text-[#222] ml-1">{fmtMoney(financial?.balanceOperational ?? account?.balanceOperational ?? financial?.balance ?? account?.balance)}</span></div>
                                  <div className="text-[#888]">Накоплено <span className="cd-mono text-[#222] ml-1">{fmtMoney(financial?.profitBalance ?? account?.profitBalance ?? financial?.availableProfit ?? account?.profit)}</span></div>
                                  <div className="text-[#888]">Кредитный баланс <span className="cd-mono text-[#222] ml-1">{fmtMoney(financial?.creditBalance ?? account?.creditBalance ?? financial?.creditLeverage ?? account?.credit)}</span></div>
                                  <div className="text-[#888]">Инвестировано <span className="cd-mono text-[#222] ml-1">{fmtMoney(financial?.invested ?? financial?.investmentTotal)}</span></div>
                                  <div className="text-[#888]">Профит <span className="cd-mono text-[#222] ml-1">{fmtMoney(financial?.profitAccrued ?? financial?.profitAccrualTotal)}</span></div>
                                  <div className="text-[#888]">Списание <span className="cd-mono text-[#222] ml-1">{fmtMoney(financial?.accountFee ?? financial?.accountWriteOff)}</span></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TXNS ── */}
                {tab === 'txns' && (
                  <div className="space-y-3">
                    {txns.length === 0 && (
                      <div className="text-[13px] text-[#888]">{t('crm.clientAccounts.txnsEmpty')}</div>
                    )}
                    {txns.map((txn: any) => {
                      const details = operationDetails(txn);
                      const status = txn.ccpStatus || txn.status;
                      return (
                        <div key={txn.id} className="rounded-[12px] border border-[#e7e7e7] bg-white p-4">
                          <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className="w-9 h-9 rounded-[8px] border border-[#f0f0f0] bg-[#fafafa] flex items-center justify-center flex-shrink-0 text-[#888]">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[13px] font-semibold text-[#222] truncate">
                                    {txnTitle(txn, txn.wpPostId)}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#888]">
                                    <span className="cd-mono">WP-пост #{txn.wpPostId}</span>
                                    <span>·</span>
                                    <span className="cd-mono">{fmtDate(txn.date)}</span>
                                    <StatusBadge status={status} label={humanStatus(status, t)} />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <div className="text-right">
                                    <div className="cd-mono text-[11px] text-[#555]">EUR {fmtMoney(txn.spendEur)}</div>
                                    <div className="cd-mono text-[11px] text-[#555]">USD {fmtMoney(txn.spendUsd)}</div>
                                  </div>
                                  <button
                                    onClick={() => setEditingTxn(txn)}
                                    className="rounded-[7px] border border-[#e7e7e7] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#555] hover:border-[#ccc] hover:bg-[#fafafa] transition-colors"
                                  >
                                    Редактировать
                                  </button>
                                </div>
                              </div>
                              {/* Detail cells */}
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                <div className="rounded-[7px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2">
                                  <div className="text-[9px] text-[#b5b5b5] uppercase tracking-[0.12em] mb-1">Тип</div>
                                  <div className="text-[12px] font-medium text-[#222] truncate">{s(txn.meta?.financialCategory || txn.type || txn.title) || 'Операция'}</div>
                                </div>
                                <div className="rounded-[7px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2">
                                  <div className="text-[9px] text-[#b5b5b5] uppercase tracking-[0.12em] mb-1">Сумма</div>
                                  <div className="cd-mono text-[11px] text-[#222]">€{fmtMoney(txn.spendEur)}</div>
                                  <div className="cd-mono text-[11px] text-[#555]">${fmtMoney(txn.spendUsd)}</div>
                                </div>
                                <div className="rounded-[7px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2">
                                  <div className="text-[9px] text-[#b5b5b5] uppercase tracking-[0.12em] mb-1">Клиент</div>
                                  <div className="text-[12px] font-medium text-[#222] truncate">{getUserLabel(txn.wpUserId)}</div>
                                </div>
                              </div>
                              {/* Description */}
                              {details.length > 0 ? (
                                <div className="mt-2.5 rounded-[7px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2.5 text-[12px] text-[#555] whitespace-pre-wrap leading-relaxed">
                                  {details.join('\n')}
                                </div>
                              ) : (
                                <div className="mt-2.5 rounded-[7px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2.5 text-[12px] text-[#b5b5b5] italic">
                                  Описание не указано
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── TRANSFERS ── */}
                {tab === 'transfers' && (
                  <div className="space-y-3">
                    {transfers.length === 0 && (
                      <div className="text-[13px] text-[#888]">{t('crm.clientAccounts.transfersEmpty')}</div>
                    )}
                    {transfers.map((tr: any) => {
                      const selectedWpId = Number((selected as any).wpUserId);
                      const { fromId, toId } = transferParticipantIds(tr, selectedWpId);
                      const fromLabel = fromId ? getUserLabel(fromId) : '—';
                      /* When toId is unknown, try to extract name from meta.comment */
                      const commentRecipient = (() => {
                        const c = s(tr.meta?.comment || tr.note);
                        const m = c.match(/пользователю\s+(.+)/i);
                        return m ? m[1].trim() : null;
                      })();
                      const toLabel = toId ? getUserLabel(toId) : (commentRecipient || '—');

                      let dirLabel = '';
                      let dirSent = false;
                      let dirReceived = false;
                      if (Number.isFinite(selectedWpId)) {
                        if (fromId === selectedWpId) { dirLabel = t('crm.clientAccounts.direction.sent'); dirSent = true; }
                        else if (toId === selectedWpId) { dirLabel = t('crm.clientAccounts.direction.received'); dirReceived = true; }
                      }

                      const status = tr.ccpStatus || tr.status;
                      const fromCur = s(tr.fromCurrency || tr.currency);
                      const toCur = s(tr.toCurrency || tr.currency);
                      const details = operationDetails(tr);

                      return (
                        <div key={tr.id} className="rounded-[12px] border border-[#e7e7e7] bg-white p-4">
                          <div className="flex items-start gap-3">
                            {/* Direction icon */}
                            <div className={cx(
                              'w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0',
                              dirReceived ? 'bg-[#eaf4ee] border border-[#c5e3d2] text-[#1f8a5e]'
                              : dirSent ? 'bg-[#fbecef] border border-[#f0c8cf] text-[#cc2f47]'
                              : 'bg-[#fafafa] border border-[#f0f0f0] text-[#888]'
                            )}>
                              {dirReceived ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M6 13l6 6 6-6"/></svg>
                              ) : dirSent ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 4v13M7 4L4 7M7 4l3 3"/><path d="M17 20V7M17 20l3-3M17 20l-3-3"/></svg>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[13px] font-semibold text-[#222] truncate">
                                    {transferTitle(tr, tr.wpPostId)}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#888]">
                                    <span className="cd-mono">WP-пост #{tr.wpPostId}</span>
                                    <span>·</span>
                                    <span className="cd-mono">{fmtDate(tr.date)}</span>
                                    <StatusBadge status={status} label={humanStatus(status, t)} />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <div className="cd-mono text-[10px] text-[#b5b5b5]">ID {shortId(tr.id)}</div>
                                  <button
                                    onClick={() => setEditingTransfer(tr)}
                                    className="rounded-[7px] border border-[#e7e7e7] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#555] hover:border-[#ccc] hover:bg-[#fafafa] transition-colors"
                                  >
                                    Редактировать
                                  </button>
                                </div>
                              </div>

                              {/* Flow row */}
                              <div className="mt-3 grid grid-cols-4 gap-2">
                                <div className="rounded-[7px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2">
                                  <div className="text-[9px] text-[#b5b5b5] uppercase tracking-[0.12em] mb-1">{t('crm.clientAccounts.direction.label')}</div>
                                  <div className="text-[12px] font-medium text-[#222]">{dirLabel || '—'}</div>
                                </div>
                                <div className="col-span-2 rounded-[7px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2">
                                  <div className="text-[9px] text-[#b5b5b5] uppercase tracking-[0.12em] mb-1">{t('crm.clientAccounts.fromTo')}</div>
                                  <div className="text-[12px] font-medium text-[#222] truncate">{fromLabel} → {toLabel}</div>
                                </div>
                                <div className="rounded-[7px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2">
                                  <div className="text-[9px] text-[#b5b5b5] uppercase tracking-[0.12em] mb-1">Валюта</div>
                                  <div className="cd-mono text-[11px] text-[#222]">{fromCur || '—'} → {toCur || '—'}</div>
                                </div>
                              </div>

                              {/* Amount/rate/credited row */}
                              <div className="mt-2 grid grid-cols-3 gap-2">
                                <div className="rounded-[7px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2">
                                  <div className="text-[9px] text-[#b5b5b5] uppercase tracking-[0.12em] mb-1">{t('crm.clientAccounts.amount')}</div>
                                  <div className="cd-mono text-[12px] font-semibold text-[#222]">{fmtMoney(tr.amount)} {fromCur || '—'}</div>
                                </div>
                                <div className="rounded-[7px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2">
                                  <div className="text-[9px] text-[#b5b5b5] uppercase tracking-[0.12em] mb-1">{t('crm.clientAccounts.rate')}</div>
                                  <div className="cd-mono text-[12px] font-semibold text-[#222]">{tr.rate ? fmtMoney(tr.rate) : '—'}</div>
                                </div>
                                <div className="rounded-[7px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2">
                                  <div className="text-[9px] text-[#b5b5b5] uppercase tracking-[0.12em] mb-1">{t('crm.clientAccounts.credited')}</div>
                                  <div className="cd-mono text-[12px] font-semibold text-[#222]">{tr.credited ? `${fmtMoney(tr.credited)} ${toCur || '—'}` : '—'}</div>
                                </div>
                              </div>

                              {details.length > 0 && (
                                <div className="mt-2.5 rounded-[7px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-2.5 text-[12px] text-[#555] whitespace-pre-wrap leading-relaxed">
                                  {details.join('\n')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Edit modals ── */}
      {editingTxn ? (
        <TxnEditModal
          row={editingTxn}
          busy={savingActivity}
          onClose={() => setEditingTxn(null)}
          onSave={(patch) => saveTxn(editingTxn, patch)}
        />
      ) : null}

      {editingTransfer ? (
        <TransferEditModal
          row={editingTransfer}
          busy={savingActivity}
          fallbackWpUserId={Number((selected as any)?.wpUserId || 0) || null}
          onClose={() => setEditingTransfer(null)}
          onSave={(patch) => saveTransfer(editingTransfer, patch)}
        />
      ) : null}
    </MainLayout>
  );
};

export default ClientAccountsPage;

/* ── Modal shell ───────────────────────────────────────────────────────── */
const ModalShell: React.FC<{
  title: string;
  busy?: boolean;
  children: React.ReactNode;
  onClose: () => void;
  onSave: () => void;
}> = ({ title, busy, children, onClose, onSave }) => (
  <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-2xl rounded-[14px] border border-[#e7e7e7] bg-white shadow-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
        <h2 className="cd-display text-[15px] font-semibold text-[#222]">{title}</h2>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#888] hover:bg-[#f0f0f0] hover:text-[#222] transition-colors text-lg leading-none"
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>
      <div className="p-5">{children}</div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#f0f0f0]">
        <button
          onClick={onClose}
          disabled={busy}
          className="rounded-[8px] border border-[#e7e7e7] px-4 py-2 text-[12px] font-medium text-[#555] hover:bg-[#fafafa] disabled:opacity-50 transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={onSave}
          disabled={busy}
          className="rounded-[8px] border border-[#222] bg-[#222] px-4 py-2 text-[12px] font-medium text-white hover:bg-[#111] disabled:opacity-50 transition-colors"
        >
          {busy ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  </div>
);

/* ── Form field ────────────────────────────────────────────────────────── */
const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
}> = ({ label, value, onChange, textarea }) => (
  <div>
    <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-1.5">{label}</div>
    {textarea ? (
      <textarea
        className="min-h-[100px] w-full rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[13px] text-[#222] outline-none focus:border-[#222] placeholder-[#b5b5b5] transition-colors resize-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : (
      <input
        className="w-full rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[13px] text-[#222] outline-none focus:border-[#222] placeholder-[#b5b5b5] transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    )}
  </div>
);

/* ── Txn edit modal ────────────────────────────────────────────────────── */
const TxnEditModal: React.FC<{
  row: CcpTxn;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: any) => void;
}> = ({ row, busy, onClose, onSave }) => {
  const [title, setTitle] = useState(String((row as any).title || txnTitle(row, (row as any).wpPostId)));
  const [date, setDate] = useState(String((row as any).date || ''));
  const [ccpStatus, setCcpStatus] = useState(String((row as any).ccpStatus || 'Done'));
  const [spendEur, setSpendEur] = useState(String((row as any).spendEur ?? '0'));
  const [spendUsd, setSpendUsd] = useState(String((row as any).spendUsd ?? '0'));
  const [desc, setDesc] = useState(operationDetails(row).join('\n'));

  return (
    <ModalShell
      title={`Редактировать операцию #${(row as any).wpPostId}`}
      busy={busy}
      onClose={onClose}
      onSave={() => onSave({ title, date, ccpStatus, spendEur, spendUsd, desc })}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextField label="Название" value={title} onChange={setTitle} />
        <TextField label="Статус" value={ccpStatus} onChange={setCcpStatus} />
        <TextField label="Дата" value={date} onChange={setDate} />
        <TextField label="EUR" value={spendEur} onChange={setSpendEur} />
        <TextField label="USD" value={spendUsd} onChange={setSpendUsd} />
        <div className="md:col-span-2">
          <TextField label="Описание / назначение" value={desc} onChange={setDesc} textarea />
        </div>
      </div>
    </ModalShell>
  );
};

/* ── Transfer edit modal ───────────────────────────────────────────────── */
const TransferEditModal: React.FC<{
  row: CcpTransfer;
  busy: boolean;
  fallbackWpUserId: number | null;
  onClose: () => void;
  onSave: (patch: any) => void;
}> = ({ row, busy, fallbackWpUserId, onClose, onSave }) => {
  const ids = transferParticipantIds(row, fallbackWpUserId);
  const [title, setTitle] = useState(String((row as any).title || transferTitle(row, (row as any).wpPostId)));
  const [date, setDate] = useState(String((row as any).date || ''));
  const [ccpStatus, setCcpStatus] = useState(String((row as any).ccpStatus || 'Done'));
  const [fromUserId, setFromUserId] = useState(String(ids.fromId || ''));
  const [toUserId, setToUserId] = useState(String(ids.toId || ''));
  const [fromCurrency, setFromCurrency] = useState(String((row as any).fromCurrency || (row as any).currency || 'USD'));
  const [toCurrency, setToCurrency] = useState(String((row as any).toCurrency || (row as any).currency || 'USD'));
  const [amount, setAmount] = useState(String((row as any).amount ?? '0'));
  const [rate, setRate] = useState(String((row as any).rate ?? '1'));
  const [desc, setDesc] = useState(String((row as any).desc || ''));
  const [note, setNote] = useState(operationDetails(row).join('\n'));

  return (
    <ModalShell
      title={`Редактировать перевод #${(row as any).wpPostId}`}
      busy={busy}
      onClose={onClose}
      onSave={() => onSave({ title, date, ccpStatus, fromUserId, toUserId, fromCurrency, toCurrency, amount, rate, desc, note })}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextField label="Название" value={title} onChange={setTitle} />
        <TextField label="Статус" value={ccpStatus} onChange={setCcpStatus} />
        <TextField label="Дата" value={date} onChange={setDate} />
        <TextField label="Отправитель WP ID" value={fromUserId} onChange={setFromUserId} />
        <TextField label="Получатель WP ID" value={toUserId} onChange={setToUserId} />
        <TextField label="Сумма" value={amount} onChange={setAmount} />
        <TextField label="Валюта списания" value={fromCurrency} onChange={setFromCurrency} />
        <TextField label="Валюта зачисления" value={toCurrency} onChange={setToCurrency} />
        <TextField label="Курс" value={rate} onChange={setRate} />
        <div className="md:col-span-2">
          <TextField label="Описание" value={desc} onChange={setDesc} textarea />
        </div>
        <div className="md:col-span-2">
          <TextField label="Примечание / детали" value={note} onChange={setNote} textarea />
        </div>
      </div>
    </ModalShell>
  );
};
