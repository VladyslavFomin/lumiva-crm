// src/pages/client-accounts/ClientAccountDetailsPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { ccpApi, CcpClient, CcpSite, CcpTxn, CcpTransfer } from '../../api/ccp';

type ApiList<T> = { items: T[]; page: number; per: number; total: number };

const POLL_MS = 12000;

/* ===================== utils ===================== */
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
function moneyToString(v: any) {
  const n = toNumberMoney(v);
  return String(Number.isFinite(n) ? n : 0);
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
function fmtDate(v: any, locale = 'ru-RU') {
  const ss = s(v);
  if (!ss) return '—';
  const d = new Date(ss);
  if (Number.isNaN(d.getTime())) return ss;
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: '2-digit' });
}
function todayYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function isVisibleNow() {
  const vis = typeof document !== 'undefined' ? document.visibilityState : 'visible';
  return vis === 'visible';
}
function pickItems<T>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray((res as any).items)) return (res as any).items as T[];
  if (Array.isArray((res as any)?.data?.items)) return (res as any).data.items as T[];
  return [];
}
function humanStatus(v: any, t: (key: string) => string) {
  const vv = s(v).toLowerCase();
  if (!vv) return t('crm.clientAccounts.status.unknown');
  if (vv === 'done' || vv === 'completed' || vv === 'success' || vv === 'accepted' || vv.includes('выполн')) return t('crm.clientAccounts.status.done');
  if (vv === 'draft' || vv.includes('чернов')) return t('crm.clientAccounts.status.draft');
  if (vv === 'publish' || vv === 'published' || vv.includes('опублик')) return t('crm.clientAccounts.status.published');
  if (vv === 'pending' || vv === 'in_progress' || vv.includes('ожида')) return t('crm.clientAccounts.status.inProgress');
  if (vv === 'failed' || vv === 'error' || vv.includes('ошиб') || vv.includes('insufficient')) return t('crm.clientAccounts.status.failed');
  const orig = s(v);
  return orig.length > 1 ? orig[0].toUpperCase() + orig.slice(1) : orig.toUpperCase();
}
function statusTone(status?: string | null) {
  const vv = s(status).toLowerCase();
  if (vv.includes('done') || vv.includes('completed') || vv.includes('success') || vv.includes('accepted') || vv.includes('выполн')) return 'ok';
  if (vv.includes('reject') || vv.includes('cancel') || vv.includes('fail') || vv.includes('ошиб') || vv.includes('insufficient')) return 'bad';
  if (vv.includes('progress') || vv.includes('pending') || vv.includes('hold') || vv.includes('check') || vv.includes('ожида')) return 'warn';
  return 'neutral';
}

function pickMeta(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k] ?? obj?.meta?.[k];
    if (v !== undefined && v !== null && s(v) !== '') return v;
  }
  return '';
}

function transferParticipantIds(tr: any, fallbackWpId?: number | null) {
  const fromId = Number(
    tr.fromUserId ?? tr.fromWpUserId ?? tr.fromExternalUserId ?? tr.senderWpUserId ??
    tr.from_user_id ?? tr.meta?.ccp_tr_from_user ?? 0
  ) || null;
  const toId = Number(
    tr.toUserId ?? tr.toWpUserId ?? tr.toExternalUserId ?? tr.recipientWpUserId ??
    tr.to_user_id ?? tr.meta?.ccp_tr_to_user ?? 0
  ) || null;
  const participantId = Number(tr.wpUserId ?? tr.externalUserId ?? fallbackWpId ?? 0) || null;
  const resolvedFrom = fromId || participantId;
  const resolvedTo = toId !== resolvedFrom ? toId : null;
  return { fromId: resolvedFrom, toId: resolvedTo };
}

function initials(name: string) {
  return (name || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p: string) => p[0]).join('').toUpperCase();
}

/* ===================== UI components ===================== */

// Swiss status badge
const StatusBadge: React.FC<{ status: string; t: (key: string) => string }> = ({ status, t }) => {
  const tone = statusTone(status);
  const label = humanStatus(status, t);
  const styles = {
    ok:      { wrap: 'text-[#175c3d] border-[#c5e3d2] bg-[#eaf4ee]', dot: 'bg-[#1f8a5e]' },
    bad:     { wrap: 'text-[#9a1f31] border-[#f0c8cf] bg-[#fbecef]', dot: 'bg-[#cc2f47]' },
    warn:    { wrap: 'text-[#7a4a09] border-[#f0d9a8] bg-[#fbf2dc]', dot: 'bg-[#c08319]' },
    neutral: { wrap: 'text-[#555] border-[#e7e7e7] bg-[#fafafa]', dot: 'bg-[#888]' },
  };
  const st = styles[tone as keyof typeof styles] || styles.neutral;
  return (
    <span className={cx('inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-[6px] border cd-mono text-[9.5px] font-semibold tracking-[0.06em] uppercase whitespace-nowrap', st.wrap)}>
      <span className={cx('w-[5px] h-[5px] rounded-full flex-shrink-0', st.dot)} />
      {label}
    </span>
  );
};

// Light input field
const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rightHint?: React.ReactNode;
}> = ({ label, value, onChange, placeholder, rightHint }) => (
  <div>
    <div className="flex items-center justify-between gap-2">
      <div className="cd-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">{label}</div>
      {rightHint ? <div className="text-[11px]">{rightHint}</div> : null}
    </div>
    <input
      className="mt-1.5 w-full rounded-[8px] border border-[#e7e7e7] bg-white px-3 py-2 text-sm text-[#222] outline-none focus:border-[#222] transition-colors placeholder:text-[#b5b5b5]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

// Light modal shell
const ModalShell: React.FC<{
  title: string;
  subtitle?: string;
  busy?: boolean;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
  saveLabel?: string;
  saveDisabled?: boolean;
}> = ({ title, subtitle, busy, onClose, onSave, children, saveLabel, saveDisabled }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl rounded-[14px] border border-[#e7e7e7] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.12)] p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <div className="cd-display text-[15px] font-semibold text-[#222] tracking-[-0.01em]">{title}</div>
            {subtitle ? <div className="mt-1 text-[12px] text-[#888]">{subtitle}</div> : null}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#888] hover:text-[#222] hover:bg-[#f0f0f0] transition-colors text-lg leading-none flex-shrink-0">×</button>
        </div>

        {children}

        <div className="mt-5 flex items-center justify-end gap-2 pt-4 border-t border-[#f0f0f0]">
          <button onClick={onClose} disabled={!!busy}
            className="inline-flex items-center px-4 py-2 rounded-[8px] border border-[#e7e7e7] bg-white text-[12.5px] text-[#555] hover:border-[#222] hover:text-[#222] disabled:opacity-40 transition-colors">
            {t('crm.common.cancel')}
          </button>
          <button onClick={onSave} disabled={!!busy || !!saveDisabled}
            className="inline-flex items-center px-4 py-2 rounded-[8px] bg-[#222] text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-40 transition-colors">
            {busy ? t('crm.common.saving') : saveLabel || t('crm.common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ===================== Page ===================== */

type ClientIndexItem = {
  id: string;
  wpUserId: number;
  email: string;
  name?: string | null;
  siteId: string;
};

const ClientAccountDetailsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const params = useParams();
  const clientId = s((params as any).id || (params as any).clientId);

  const [client, setClient] = useState<CcpClient | null>(null);
  const [site, setSite] = useState<CcpSite | null>(null);
  const [txns, setTxns] = useState<ApiList<CcpTxn> | null>(null);
  const [transfers, setTransfers] = useState<ApiList<CcpTransfer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTables, setLoadingTables] = useState(false);
  const [err, setErr] = useState<string>('');
  const [indexLoading, setIndexLoading] = useState(false);
  const [clientIndex, setClientIndex] = useState<ClientIndexItem[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [eur, setEur] = useState('');
  const [usd, setUsd] = useState('');
  const [accEurNumber, setAccEurNumber] = useState('');
  const [accUsdNumber, setAccUsdNumber] = useState('');
  const [ibanEur, setIbanEur] = useState('');
  const [ibanUsd, setIbanUsd] = useState('');
  const [savingClient, setSavingClient] = useState(false);
  const [txnEdit, setTxnEdit] = useState<CcpTxn | null>(null);
  const [txnCreateOpen, setTxnCreateOpen] = useState(false);
  const [txnSaving, setTxnSaving] = useState(false);
  const [trEdit, setTrEdit] = useState<CcpTransfer | null>(null);
  const [trCreateOpen, setTrCreateOpen] = useState(false);
  const [trSaving, setTrSaving] = useState(false);

  const aliveRef = useRef(true);
  const pollRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const lastOkRef = useRef<number>(0);

  const loadAll = async (mode: 'full' | 'tables' = 'full') => {
    if (!clientId) { setErr(t('crm.clientAccountDetails.errors.clientIdMissing')); setLoading(false); return; }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      if (mode === 'full') { setLoading(true); setErr(''); } else { setLoadingTables(true); }
      const c = await ccpApi.client(clientId);
      if (!aliveRef.current) return;
      setClient(c);
      const sites = await ccpApi.sites();
      if (!aliveRef.current) return;
      setSite((sites || []).find((x: any) => x.id === (c as any).siteId) || null);
      const wpUserId = Number((c as any).wpUserId);
      const sid = String((c as any).siteId);
      const [txnsResult, transfersResult] = await Promise.allSettled([
        ccpApi.txns({ siteId: sid, wpUserId, page: 1, per: 200, fresh: 1 } as any),
        ccpApi.transfers({ siteId: sid, wpUserId, page: 1, per: 200, fresh: 1 } as any),
      ]);
      if (!aliveRef.current) return;
      const tx = txnsResult.status === 'fulfilled' ? (txnsResult.value as any) : null;
      const tr = transfersResult.status === 'fulfilled' ? (transfersResult.value as any) : null;
      const txItems = pickItems<CcpTxn>(tx);
      const trItems = pickItems<CcpTransfer>(tr);
      setTxns({ items: txItems, page: tx?.page ?? 1, per: tx?.per ?? txItems.length ?? 200, total: tx?.total ?? txItems.length ?? 0 });
      setTransfers({ items: trItems, page: tr?.page ?? 1, per: tr?.per ?? trItems.length ?? 200, total: tr?.total ?? trItems.length ?? 0 });
      lastOkRef.current = Date.now();
    } catch (e: any) {
      if (!aliveRef.current) return;
      setErr(e?.message || t('crm.clientAccountDetails.errors.loadFailed'));
    } finally {
      inFlightRef.current = false;
      if (!aliveRef.current) return;
      setLoading(false); setLoadingTables(false);
    }
  };

  const loadClientIndex = async (siteId: string) => {
    if (!siteId) return;
    setIndexLoading(true);
    try {
      const first = await ccpApi.clients({ siteId, page: 1, per: 500 } as any);
      const items1 = pickItems<CcpClient>(first as any);
      let all = items1;
      const total = Number((first as any)?.total ?? items1.length ?? 0);
      const per = Number((first as any)?.per ?? 500);
      if (total > per) {
        const pages = Math.ceil(total / per);
        const restPages = Array.from({ length: Math.min(pages - 1, 9) }).map((_, i) => i + 2);
        const rest = await Promise.all(restPages.map((p) => ccpApi.clients({ siteId, page: p, per } as any)));
        for (const r of rest) all = all.concat(pickItems<CcpClient>(r as any));
      }
      const mapped: ClientIndexItem[] = (all || [])
        .map((c: any) => ({ id: String(c.id), wpUserId: Number(c.wpUserId), email: String(c.email || ''), name: c.name ?? null, siteId: String(c.siteId) }))
        .filter((x) => x.wpUserId && x.email && x.siteId === siteId);
      const uniq = new Map<number, ClientIndexItem>();
      for (const it of mapped) if (!uniq.has(it.wpUserId)) uniq.set(it.wpUserId, it);
      setClientIndex(Array.from(uniq.values()));
    } catch { setClientIndex([]); } finally { setIndexLoading(false); }
  };

  useEffect(() => {
    aliveRef.current = true;
    loadAll('full');
    return () => {
      aliveRef.current = false;
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    const sid = String((client as any)?.siteId || '');
    if (!sid) return;
    loadClientIndex(sid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(client as any)?.siteId]);

  useEffect(() => {
    if (!clientId) return;
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    const tick = () => {
      if (!isVisibleNow()) return;
      if (editOpen || txnEdit || trEdit || txnCreateOpen || trCreateOpen) return;
      if (inFlightRef.current) return;
      if (Date.now() - (lastOkRef.current || 0) < POLL_MS * 0.6) return;
      loadAll('tables');
    };
    tick();
    pollRef.current = window.setInterval(tick, POLL_MS);
    const onVis = () => tick();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, editOpen, txnEdit, trEdit, txnCreateOpen, trCreateOpen]);

  /* ===================== view fields ===================== */
  const viewBalanceEur = useMemo(() => !client ? '0' : String((client as any).balanceEur ?? pickMeta(client, ['ccp_acc_eur_balance', 'ccp_balance_eur']) ?? '0'), [client]);
  const viewBalanceUsd = useMemo(() => !client ? '0' : String((client as any).balanceUsd ?? pickMeta(client, ['ccp_acc_usd_balance', 'ccp_balance_usd']) ?? '0'), [client]);
  const viewAccEur = useMemo(() => !client ? '' : String((client as any).accountEur ?? pickMeta(client, ['ccp_acc_eur_number', 'accEurNumber', 'ccp_acc_eur']) ?? ''), [client]);
  const viewAccUsd = useMemo(() => !client ? '' : String((client as any).accountUsd ?? pickMeta(client, ['ccp_acc_usd_number', 'accUsdNumber', 'ccp_acc_usd']) ?? ''), [client]);
  const viewIbanEur = useMemo(() => !client ? '' : String((client as any).ibanEur ?? pickMeta(client, ['ccp_iban_eur']) ?? ''), [client]);
  const viewIbanUsd = useMemo(() => !client ? '' : String((client as any).ibanUsd ?? pickMeta(client, ['ccp_iban_usd']) ?? ''), [client]);

  const currentBalance = useMemo(() => ({ EUR: toNumberMoney(viewBalanceEur), USD: toNumberMoney(viewBalanceUsd) }), [viewBalanceEur, viewBalanceUsd]);

  const totals = useMemo(() => {
    const tx = txns?.items || [];
    return {
      eurSpent: tx.reduce((a, t: any) => a + toNumberMoney(t?.spendEur ?? 0), 0),
      usdSpent: tx.reduce((a, t: any) => a + toNumberMoney(t?.spendUsd ?? 0), 0),
    };
  }, [txns?.items]);

  const clientAccounts = useMemo(() => { const a = (client as any)?.meta?.accounts; return Array.isArray(a) ? a : []; }, [client]);
  const financialSummary = useMemo(() => { const a = (client as any)?.meta?.financialSummary; return Array.isArray(a) ? a : []; }, [client]);
  const investments = useMemo(() => { const a = (client as any)?.meta?.investments; return Array.isArray(a) ? a : []; }, [client]);

  const title = useMemo(() => {
    if (!client) return t('crm.clientAccountDetails.title');
    return (client as any).name || (client as any).email || t('crm.clientAccountDetails.clientFallback', { id: (client as any).wpUserId });
  }, [client, t]);

  const txnsCount = txns?.total ?? txns?.items?.length ?? 0;
  const transfersCount = transfers?.total ?? transfers?.items?.length ?? 0;

  const findClientByWpId = (wpUserId: number) => {
    const id = Number(wpUserId);
    return id ? clientIndex.find((x) => x.wpUserId === id) || null : null;
  };

  const wpUserLabel = (wpUserId: any) => {
    const id = Number(wpUserId || 0);
    if (!id) return t('crm.common.empty');
    const c = findClientByWpId(id);
    if (!c) return t('crm.clientAccounts.wpUserShort', { id });
    return `${s(c.name) || s(c.email)} · ${t('crm.clientAccounts.wpUserShort', { id })}`;
  };

  /* ===================== balances patching ===================== */
  const patchClientBalances = async (clientIdToPatch: string, next: { EUR?: number; USD?: number }) => {
    const dto: any = { meta: {} as any };
    if (next.EUR !== undefined) { dto.meta.ccp_acc_eur_balance = next.EUR; dto.meta.ccp_balance_eur = next.EUR; }
    if (next.USD !== undefined) { dto.meta.ccp_acc_usd_balance = next.USD; dto.meta.ccp_balance_usd = next.USD; }
    await ccpApi.updateClient(clientIdToPatch, dto);
  };

  const applyBalanceDelta = async (clientIdToPatch: string, cur: 'EUR' | 'USD', delta: number) => {
    const full = await ccpApi.client(clientIdToPatch);
    const balE = toNumberMoney((full as any).balanceEur ?? pickMeta(full, ['ccp_acc_eur_balance', 'ccp_balance_eur']) ?? 0);
    const balU = toNumberMoney((full as any).balanceUsd ?? pickMeta(full, ['ccp_acc_usd_balance', 'ccp_balance_usd']) ?? 0);
    if (cur === 'EUR') await patchClientBalances(clientIdToPatch, { EUR: balE + delta });
    else await patchClientBalances(clientIdToPatch, { USD: balU + delta });
  };

  /* ===================== client edit ===================== */
  const openEditClient = () => {
    if (!client) return;
    setEur(String(viewBalanceEur ?? '0')); setUsd(String(viewBalanceUsd ?? '0'));
    setAccEurNumber(String(viewAccEur ?? '')); setAccUsdNumber(String(viewAccUsd ?? ''));
    setIbanEur(String(viewIbanEur ?? '')); setIbanUsd(String(viewIbanUsd ?? ''));
    setEditOpen(true);
  };

  const saveClient = async () => {
    if (!client) return;
    setSavingClient(true); setErr('');
    try {
      const dto = {
        meta: {
          ccp_acc_eur_balance: toNumberMoney(eur), ccp_acc_usd_balance: toNumberMoney(usd),
          ccp_acc_eur_number: s(accEurNumber), ccp_acc_usd_number: s(accUsdNumber),
          ccp_iban_eur: s(ibanEur) || undefined, ccp_iban_usd: s(ibanUsd) || undefined,
          ccp_balance_eur: toNumberMoney(eur), ccp_balance_usd: toNumberMoney(usd),
        },
      };
      const updated = await ccpApi.updateClient((client as any).id, dto as any);
      const full = await ccpApi.client((updated as any).id);
      setClient(full); setEditOpen(false); await loadAll('tables');
    } catch (e: any) { setErr(e?.message || t('crm.clientAccountDetails.errors.clientSaveFailed')); }
    finally { setSavingClient(false); }
  };

  /* ===================== TXN ===================== */
  const createTxn = async (patch: { title?: string; desc?: string; date?: string; currency: 'EUR' | 'USD'; amount: string; ccpStatus?: string }) => {
    if (!client) return;
    setTxnSaving(true); setErr('');
    try {
      const sid = String((client as any).siteId);
      const wpUserId = Number((client as any).wpUserId);
      const cur = patch.currency;
      const amt = toNumberMoney(patch.amount);
      const available = cur === 'EUR' ? currentBalance.EUR : currentBalance.USD;
      if (amt <= 0) throw new Error(t('crm.clientAccountDetails.errors.amountPositive'));
      if (amt > available) throw new Error(t('crm.clientAccountDetails.errors.insufficientFunds'));
      const amtStr = moneyToString(amt);
      await (ccpApi as any).createTxn(sid, { wpUserId, title: patch.title || '', desc: patch.desc || '', date: patch.date || '', currency: cur, amount: amtStr, spendEur: cur === 'EUR' ? amtStr : '0', spendUsd: cur === 'USD' ? amtStr : '0', status: 'publish', ccpStatus: patch.ccpStatus || 'In progress' });
      await applyBalanceDelta(String((client as any).id), cur, -amt);
      setTxnCreateOpen(false); await loadAll('full');
    } catch (e: any) { setErr(e?.message || t('crm.clientAccountDetails.errors.txnCreateFailed')); }
    finally { setTxnSaving(false); }
  };

  const saveTxn = async (row: CcpTxn, patch: Partial<CcpTxn>) => {
    if (!client) return;
    setTxnSaving(true); setErr('');
    try {
      const oldEur = toNumberMoney((row as any).spendEur ?? 0);
      const oldUsd = toNumberMoney((row as any).spendUsd ?? 0);
      const newEur = toNumberMoney((patch as any).spendEur ?? (row as any).spendEur ?? 0);
      const newUsd = toNumberMoney((patch as any).spendUsd ?? (row as any).spendUsd ?? 0);
      const deltaEur = newEur - oldEur; const deltaUsd = newUsd - oldUsd;
      if (deltaEur > 0 && deltaEur > currentBalance.EUR) throw new Error(t('crm.clientAccountDetails.errors.insufficientFundsEur'));
      if (deltaUsd > 0 && deltaUsd > currentBalance.USD) throw new Error(t('crm.clientAccountDetails.errors.insufficientFundsUsd'));
      const payload: any = {
        title: (patch as any).title ?? (row as any).title ?? '', status: (patch as any).status ?? (row as any).status ?? 'publish',
        meta: { ccp_user_id: Number((row as any).wpUserId ?? (client as any).wpUserId ?? 0), ccp_spend_eur: newEur, ccp_spend_usd: newUsd, ccp_date: String((patch as any).date ?? (row as any).date ?? ''), ccp_desc: String((patch as any).desc ?? (row as any).desc ?? ''), ccp_status: String((patch as any).ccpStatus ?? (row as any).ccpStatus ?? 'In progress') },
      };
      await (ccpApi as any).updateTxn((row as any).siteId, (row as any).wpPostId, payload);
      if (deltaEur !== 0) await applyBalanceDelta(String((client as any).id), 'EUR', -deltaEur);
      if (deltaUsd !== 0) await applyBalanceDelta(String((client as any).id), 'USD', -deltaUsd);
      setTxnEdit(null); await loadAll('full');
    } catch (e: any) { setErr(e?.message || t('crm.clientAccountDetails.errors.txnSaveFailed')); }
    finally { setTxnSaving(false); }
  };

  /* ===================== TRANSFER ===================== */
  const readTransferFields = (tr: any) => {
    const amount = tr.amount ?? tr.meta?.ccp_tr_amount ?? '';
    const fromCur = s(tr.fromCurrency) || s(tr.meta?.ccp_tr_from_cur) || s(tr.meta?.ccp_tr_from_currency) || '';
    const toCur = s(tr.toCurrency) || s(tr.meta?.ccp_tr_to_cur) || s(tr.meta?.ccp_tr_to_currency) || s(tr.currency) || s(tr.meta?.ccp_tr_currency) || '';
    const rate = tr.rate ?? tr.meta?.ccp_tr_rate ?? '';
    const credited = tr.credited ?? tr.meta?.ccp_tr_credited ?? '';
    const desc = tr.desc ?? tr.meta?.ccp_tr_desc ?? tr.meta?.ccp_tr_description ?? '';
    const note = tr.note ?? tr.meta?.ccp_tr_note ?? '';
    return { amount, fromCur, toCur, rate, credited, desc, note };
  };

  const createTransfer = async (patch: { toWpUserId: number; fromCurrency: 'EUR' | 'USD'; toCurrency: 'EUR' | 'USD'; amount: string; rate: string; date?: string; desc?: string; ccpStatus?: string }) => {
    if (!client) return;
    setTrSaving(true); setErr('');
    try {
      const sid = String((client as any).siteId);
      const fromWp = Number((client as any).wpUserId);
      const toWp = Number(patch.toWpUserId);
      if (!fromWp) throw new Error(t('crm.clientAccountDetails.errors.transferSenderMissing'));
      if (!toWp) throw new Error(t('crm.clientAccountDetails.errors.transferRecipientMissing'));
      const toClient = findClientByWpId(toWp);
      if (!toClient) throw new Error(t('crm.clientAccountDetails.errors.transferRecipientNotFound'));
      const amt = toNumberMoney(patch.amount);
      const rate = Math.max(0, toNumberMoney(patch.rate || 1));
      if (amt <= 0) throw new Error(t('crm.clientAccountDetails.errors.amountPositive'));
      const fromCur = patch.fromCurrency; const toCur = patch.toCurrency;
      if (amt > (fromCur === 'EUR' ? currentBalance.EUR : currentBalance.USD)) throw new Error(t('crm.clientAccountDetails.errors.transferInsufficient'));
      await (ccpApi as any).createTransfer(sid, { fromUserId: fromWp, toUserId: toWp, fromCurrency: fromCur, toCurrency: toCur, amount: moneyToString(amt), rate: moneyToString(rate || 1), date: patch.date || '', desc: patch.desc || '', ccpStatus: patch.ccpStatus || 'In progress' });
      await applyBalanceDelta(String((client as any).id), fromCur, -amt);
      await applyBalanceDelta(String(toClient.id), toCur, amt * (rate || 1));
      setTrCreateOpen(false); await loadAll('full');
    } catch (e: any) { setErr(e?.message || t('crm.clientAccountDetails.errors.transferCreateFailed')); }
    finally { setTrSaving(false); }
  };

  const saveTransfer = async (row: CcpTransfer, patch: any) => {
    if (!client) return;
    setTrSaving(true); setErr('');
    try {
      const sid = String((row as any).siteId);
      const wpPostId = Number((row as any).wpPostId);
      const old = readTransferFields(row as any);
      const oldAmount = toNumberMoney(old.amount);
      const oldRate = toNumberMoney(old.rate || 1) || 1;
      const oldFromCur = (s(old.fromCur) || 'EUR') as 'EUR' | 'USD';
      const oldToCur = (s(old.toCur) || 'EUR') as 'EUR' | 'USD';
      const oldCredited = toNumberMoney(old.credited) || oldAmount * oldRate;
      const newAmount = toNumberMoney(patch.amount ?? old.amount);
      const newRate = toNumberMoney(patch.rate ?? old.rate ?? 1) || 1;
      const newFromCur = (s(patch.fromCurrency ?? oldFromCur) || 'EUR') as 'EUR' | 'USD';
      const newToCur = (s(patch.toCurrency ?? oldToCur) || 'EUR') as 'EUR' | 'USD';
      const newCredited = newAmount * newRate;
      const fromWp = Number(patch.fromUserId ?? (row as any).fromUserId ?? 0);
      const toWp = Number(patch.toUserId ?? (row as any).toUserId ?? 0);
      if (!fromWp || !toWp) throw new Error(t('crm.clientAccountDetails.errors.transferParticipantsMissing'));
      const fromClient = findClientByWpId(fromWp);
      const toClient = findClientByWpId(toWp);
      if (!fromClient || !toClient) throw new Error(t('crm.clientAccountDetails.errors.transferParticipantsNotFound'));
      if (newAmount <= 0) throw new Error(t('crm.clientAccountDetails.errors.amountPositive'));
      if (Number((client as any).wpUserId) === fromWp) {
        const availableNow = newFromCur === 'EUR' ? currentBalance.EUR : currentBalance.USD;
        const back = oldFromCur === newFromCur ? oldAmount : 0;
        if (newAmount > availableNow + back) throw new Error(t('crm.clientAccountDetails.errors.transferInsufficient'));
      }
      const payload: any = {
        title: s(patch.title ?? (row as any).title ?? ''), status: s(patch.status ?? (row as any).status ?? ''),
        meta: { ccp_tr_amount: newAmount, ccp_tr_from_cur: newFromCur, ccp_tr_to_cur: newToCur, ccp_tr_rate: newRate, ccp_tr_desc: s(patch.desc ?? old.desc ?? ''), ccp_tr_currency: (patch.currency ?? (row as any).currency ?? newToCur) as any, ccp_tr_from_user: fromWp, ccp_tr_to_user: toWp, ccp_tr_date: s(patch.date ?? (row as any).date ?? ''), ccp_tr_note: s(patch.note ?? old.note ?? ''), ccp_tr_status: s(patch.ccpStatus ?? (row as any).ccpStatus ?? '') },
      };
      await (ccpApi as any).updateTransfer(sid, wpPostId, payload);
      await applyBalanceDelta(String(fromClient.id), oldFromCur, +oldAmount);
      await applyBalanceDelta(String(fromClient.id), newFromCur, -newAmount);
      await applyBalanceDelta(String(toClient.id), oldToCur, -oldCredited);
      await applyBalanceDelta(String(toClient.id), newToCur, +newCredited);
      setTrEdit(null); await loadAll('full');
    } catch (e: any) { setErr(e?.message || t('crm.clientAccountDetails.errors.transferSaveFailed')); }
    finally { setTrSaving(false); }
  };

  /* ===================== render ===================== */

  const siteHost = (site as any)?.siteHost || '';
  const clientName = (client as any)?.name || '';
  const clientEmail = (client as any)?.email || '';
  const clientWpId = (client as any)?.wpUserId;
  const clientUpdatedAt = (client as any)?.updatedAt;

  return (
    <MainLayout>
      {/* PAGE HEADER */}
      <div className="mb-6 flex items-start justify-between gap-5 flex-wrap">
        <div>
          {/* kicker */}
          <div className="flex items-center gap-2 mb-2">
            <span className="w-[6px] h-[6px] rounded-full bg-[#222] flex-shrink-0" />
            <span className="cd-mono text-[11px] font-medium tracking-[0.12em] uppercase text-[#888]">
              {t('crm.clientAccountDetails.sectionLabel')}
            </span>
          </div>
          <h1 className="cd-display text-[26px] font-semibold tracking-[-0.025em] text-[#222] leading-tight">
            {loading ? <span className="text-[#888]">{t('crm.clientAccountDetails.loading')}</span> : title}
            {loadingTables && !loading && (
              <span className="ml-3 cd-mono text-[11px] font-normal tracking-[0.06em] text-[#888] align-middle">↻</span>
            )}
          </h1>
          {client && (
            <div className="mt-2 flex items-center gap-2 text-[13px] text-[#888] flex-wrap">
              {siteHost && <><span>{t('crm.clientAccountDetails.siteLabel')} <span className="cd-mono text-[#555]">{siteHost}</span></span><span className="text-[#e7e7e7]">•</span></>}
              {clientWpId && <><span>WP ID <span className="cd-mono text-[#555]">{clientWpId}</span></span><span className="text-[#e7e7e7]">•</span></>}
              <span>
                {indexLoading
                  ? t('crm.clientAccountDetails.clientsLoading')
                  : t('crm.clientAccountDetails.clientsCount', { count: clientIndex.length || 0 })}
              </span>
            </div>
          )}
          <Link
            to="/app/client-accounts"
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-[#555] hover:text-[#222] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
            {t('crm.clientAccountDetails.backToList')}
          </Link>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to={`/app/client-accounts/${clientId}/analytics`}
            className="inline-flex items-center gap-1.5 px-3 py-[7px] border border-[#e7e7e7] rounded-[8px] bg-white text-[12.5px] text-[#222] hover:border-[#222] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>
            {t('crm.clientAccountDetails.analyticsLink')}
          </Link>
          <button
            onClick={() => loadAll('full')}
            className="inline-flex items-center gap-1.5 px-3 py-[7px] border border-[#e7e7e7] rounded-[8px] bg-white text-[12.5px] text-[#222] hover:border-[#222] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 4v5h-5"/></svg>
            {t('crm.clientAccountDetails.refresh')}
          </button>
          <button
            onClick={openEditClient}
            disabled={!client}
            className="inline-flex items-center gap-1.5 px-4 py-[7px] rounded-[8px] bg-[#222] text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-40 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14 6l4 4"/></svg>
            {t('crm.clientAccountDetails.edit')}
          </button>
        </div>
      </div>

      {/* ERROR */}
      {err && (
        <div className="mb-5 rounded-[10px] border border-[#f0c8cf] bg-[#fbecef] px-4 py-3 text-[12.5px] text-[#9a1f31]">
          {err}
        </div>
      )}

      {/* LOADING SKELETON */}
      {loading && (
        <div className="rounded-[14px] border border-[#e7e7e7] bg-white p-6 text-[13px] text-[#888]">
          {t('crm.clientAccountDetails.loading')}
        </div>
      )}

      {!loading && client && (
        <>
          {/* TOP ROW: EUR | USD | Contacts */}
          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {/* EUR account card */}
            <div className="rounded-[14px] border border-[#e7e7e7] bg-white p-[22px]" style={{ borderTop: '3px solid #1f1f1f' }}>
              <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888]">{t('crm.clientAccountDetails.eurAccount')}</div>
              <div className={cx('cd-mono text-[18px] font-semibold tracking-[-0.02em] mt-1.5', viewAccEur ? 'text-[#222]' : 'text-[#b5b5b5]')}>
                {viewAccEur || '—'}
              </div>
              <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mt-4">{t('crm.clientAccountDetails.balanceEurLabel')}</div>
              <div className="cd-display text-[34px] font-semibold tracking-[-0.03em] text-[#222] leading-none mt-1.5">
                {fmtMoney(viewBalanceEur)}<span className="text-[18px] text-[#888] font-medium ml-[5px]">€</span>
              </div>
              <div className="mt-4 pt-4 border-t border-[#f0f0f0] flex items-end justify-between">
                <div>
                  <div className="cd-mono text-[9.5px] tracking-[0.1em] uppercase text-[#888]">IBAN</div>
                  <div className={cx('cd-mono text-[12px] mt-0.5 tracking-[-0.01em]', viewIbanEur ? 'text-[#222]' : 'text-[#b5b5b5]')}>{viewIbanEur || '—'}</div>
                </div>
                <div className="text-right pl-4 flex-shrink-0">
                  <div className="cd-mono text-[9.5px] tracking-[0.1em] uppercase text-[#888]">{t('crm.clientAccountDetails.spent')}</div>
                  <div className="cd-mono text-[13px] font-semibold text-[#222] mt-0.5 tracking-[-0.02em]">{fmtMoney(totals.eurSpent)} €</div>
                </div>
              </div>
            </div>

            {/* USD account card */}
            <div className="rounded-[14px] border border-[#e7e7e7] bg-white p-[22px]" style={{ borderTop: '3px solid #1f8a5e' }}>
              <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888]">{t('crm.clientAccountDetails.usdAccount')}</div>
              <div className={cx('cd-mono text-[18px] font-semibold tracking-[-0.02em] mt-1.5', viewAccUsd ? 'text-[#222]' : 'text-[#b5b5b5]')}>
                {viewAccUsd || '—'}
              </div>
              <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mt-4">{t('crm.clientAccountDetails.balanceUsdLabel')}</div>
              <div className="cd-display text-[34px] font-semibold tracking-[-0.03em] text-[#222] leading-none mt-1.5">
                {fmtMoney(viewBalanceUsd)}<span className="text-[18px] text-[#888] font-medium ml-[5px]">$</span>
              </div>
              <div className="mt-4 pt-4 border-t border-[#f0f0f0] flex items-end justify-between">
                <div>
                  <div className="cd-mono text-[9.5px] tracking-[0.1em] uppercase text-[#888]">IBAN</div>
                  <div className={cx('cd-mono text-[12px] mt-0.5 tracking-[-0.01em]', viewIbanUsd ? 'text-[#222]' : 'text-[#b5b5b5]')}>{viewIbanUsd || '—'}</div>
                </div>
                <div className="text-right pl-4 flex-shrink-0">
                  <div className="cd-mono text-[9.5px] tracking-[0.1em] uppercase text-[#888]">{t('crm.clientAccountDetails.spent')}</div>
                  <div className="cd-mono text-[13px] font-semibold text-[#222] mt-0.5 tracking-[-0.02em]">{fmtMoney(totals.usdSpent)} $</div>
                </div>
              </div>
            </div>

            {/* Contacts card */}
            <div className="rounded-[14px] border border-[#e7e7e7] bg-white p-[22px]">
              <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888]">{t('crm.clientAccountDetails.contacts')}</div>
              <div className="flex items-center gap-3 mt-2.5">
                <div className="w-11 h-11 rounded-[12px] bg-[#222] text-white flex items-center justify-center cd-display text-[16px] font-semibold flex-shrink-0">
                  {initials(clientName || clientEmail)}
                </div>
                <div className="min-w-0">
                  <div className="cd-display text-[16px] font-semibold tracking-[-0.02em] text-[#222] truncate">{clientName || '—'}</div>
                  <div className="text-[12.5px] text-[#888] mt-0.5 truncate">{clientEmail}</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-[#f0f0f0]">
                <div className="text-[11.5px] text-[#888]">
                  {t('crm.clientAccountDetails.updatedLabel')}{' '}
                  <span className="cd-mono text-[#555]">
                    {clientUpdatedAt ? new Date(clientUpdatedAt).toLocaleString() : '—'}
                  </span>
                </div>
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  <span className="inline-flex items-center gap-[5px] px-2.5 py-1 border border-[#e7e7e7] rounded-full cd-mono text-[10.5px] text-[#555]">
                    <strong className="text-[#222]">{txnsCount}</strong> {t('crm.clientAccountDetails.operationsCountSuffix')}
                  </span>
                  <span className="inline-flex items-center gap-[5px] px-2.5 py-1 border border-[#e7e7e7] rounded-full cd-mono text-[10.5px] text-[#555]">
                    <strong className="text-[#222]">{transfersCount}</strong> {t('crm.clientAccountDetails.transfersCountSuffix')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* MID: Site accounts + Financial summary */}
          {(clientAccounts.length > 0 || financialSummary.length > 0) && (
            <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: financialSummary.length ? '1fr 360px' : '1fr' }}>
              {clientAccounts.length > 0 && (
                <div className="rounded-[14px] border border-[#e7e7e7] bg-white p-[22px]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888]">{t('crm.clientAccountDetails.nsmAccountsTitle')}</div>
                    <span className="inline-flex items-center gap-1 text-[12px] text-[#555] border border-[#e7e7e7] rounded-[7px] px-[9px] py-1 cursor-pointer hover:border-[#222] hover:text-[#222] transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                      {t('crm.clientAccountDetails.addBtn')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                    {clientAccounts.map((account: any, index: number) => {
                      const financial = account?.financial || {};
                      const currency = account?.currency || financial?.currency || '—';
                      const acctNum = account?.number || t('crm.clientAccountDetails.accountFallback', { n: index + 1 });
                      const status = account?.status || '—';
                      const crmBalance = displayAccountBalance(account);
                      const operBalance = financial?.balanceOperational ?? account?.balanceOperational ?? financial?.balance ?? account?.balance;
                      const accrued = financial?.profitBalance ?? account?.profitBalance ?? financial?.availableProfit ?? account?.profit;
                      const credit = financial?.creditBalance ?? account?.creditBalance ?? financial?.creditLeverage ?? account?.credit;
                      const invested = financial?.invested ?? financial?.investmentTotal;
                      const accruedFee = financial?.profitAccrued ?? financial?.profitAccrualTotal;
                      const expected = financial?.expectedProfit;
                      const writeoff = financial?.accountFee ?? financial?.accountWriteOff;
                      return (
                        <div key={account?.externalAccountId || account?.id || index} className="rounded-[12px] border border-[#e7e7e7] p-[18px]">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="cd-mono text-[14px] font-semibold text-[#222] tracking-[-0.02em]">{acctNum}</div>
                            <span className="cd-mono text-[10px] font-semibold tracking-[0.08em] px-[9px] py-[3px] border border-[#e7e7e7] rounded-full text-[#555] bg-[#fafafa]">{currency}</span>
                          </div>
                          <div className="cd-mono text-[10.5px] text-[#888] tracking-[0.02em] mb-3.5">{currency} · <span className="text-[#1f8a5e]">{status}</span></div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            {[
                              { l: t('crm.clientAccountDetails.accountFields.crmBalance'), v: crmBalance, cur: currency },
                              { l: t('crm.clientAccountDetails.accountFields.operBalance'), v: operBalance, cur: currency },
                              { l: t('crm.clientAccountDetails.accountFields.accrued'), v: accrued, cur: currency },
                              { l: t('crm.clientAccountDetails.accountFields.creditBalance'), v: credit, cur: currency, neg: toNumberMoney(credit) < 0 },
                              { l: t('crm.clientAccountDetails.accountFields.invested'), v: invested, cur: currency },
                              { l: t('crm.clientAccountDetails.accountFields.accruedFee'), v: accruedFee, cur: currency },
                              { l: t('crm.clientAccountDetails.accountFields.expected'), v: expected, cur: currency },
                              { l: t('crm.clientAccountDetails.accountFields.writeoff'), v: writeoff, cur: currency, neg: toNumberMoney(writeoff) < 0 },
                            ].map(({ l, v, cur, neg }) => (
                              <div key={l}>
                                <div className="text-[11px] text-[#888]">{l}</div>
                                <div className={cx('cd-mono text-[13px] font-semibold mt-0.5 tracking-[-0.02em]', neg ? 'text-[#cc2f47]' : (v === undefined || v === null || v === '' || toNumberMoney(v) === 0) ? 'text-[#b5b5b5] font-medium' : 'text-[#222]')}>
                                  {fmtMoney(v)} {cur}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {financialSummary.length > 0 && (
                <div className="rounded-[14px] border border-[#e7e7e7] bg-white p-[22px]">
                  <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-4">{t('crm.clientAccountDetails.financialSummaryTitle')}</div>
                  <div className="flex flex-col gap-3.5">
                    {financialSummary.map((row: any, index: number) => {
                      const cur = row?.currency || '—';
                      const isUsd = cur.toLowerCase() === 'usd';
                      const matchingAccount = clientAccounts.find((a: any) => String(a?.currency || '').toUpperCase() === cur.toUpperCase());
                      const accountCrmBalance = matchingAccount != null ? displayAccountBalance(matchingAccount) : undefined;
                      const balance = toNumberMoney(row?.balance) || accountCrmBalance || row?.balance;
                      return (
                        <div key={`${cur}-${index}`} className="rounded-[12px] border border-[#e7e7e7] p-[18px]">
                          <div className="flex items-center gap-2 cd-display text-[16px] font-semibold text-[#222] tracking-[-0.02em] mb-3.5">
                            <span className={cx('w-[7px] h-[7px] rounded-full flex-shrink-0', isUsd ? 'bg-[#1f8a5e]' : 'bg-[#222]')} />
                            {cur}
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            {[
                              { l: t('crm.clientAccountDetails.summaryFields.balance'), v: balance },
                              { l: t('crm.clientAccountDetails.summaryFields.invested'), v: row?.invested ?? row?.investmentTotal },
                              { l: t('crm.clientAccountDetails.summaryFields.profit'), v: row?.profitAccrued ?? row?.profitAccrualTotal, pos: toNumberMoney(row?.profitAccrued ?? row?.profitAccrualTotal) > 0 },
                              { l: t('crm.clientAccountDetails.summaryFields.expected'), v: row?.expectedProfit },
                              { l: t('crm.clientAccountDetails.summaryFields.writeoff'), v: row?.accountFee ?? row?.accountWriteOff, neg: toNumberMoney(row?.accountFee ?? row?.accountWriteOff) < 0 },
                              { l: t('crm.clientAccountDetails.summaryFields.credit'), v: row?.creditLeverage ?? row?.creditLeverageTotal, neg: toNumberMoney(row?.creditLeverage ?? row?.creditLeverageTotal) < 0 },
                            ].map(({ l, v, pos, neg }) => (
                              <div key={l}>
                                <div className="text-[11px] text-[#888]">{l}</div>
                                <div className={cx('cd-mono text-[13px] font-semibold mt-0.5 tracking-[-0.02em]', neg ? 'text-[#cc2f47]' : pos ? 'text-[#1f8a5e]' : (v === undefined || v === null || v === '' || toNumberMoney(v) === 0) ? 'text-[#b5b5b5] font-medium' : 'text-[#222]')}>
                                  {fmtMoney(v)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INVESTMENTS */}
          {investments.length > 0 && (
            <div className="rounded-[14px] border border-[#e7e7e7] bg-white p-[22px] mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="cd-mono text-[10px] font-medium tracking-[0.14em] uppercase text-[#888]">{t('crm.clientAccountDetails.investmentsTitle')}</div>
                <span className="inline-flex items-center gap-1 text-[12px] text-[#555] border border-[#e7e7e7] rounded-[7px] px-[9px] py-1 cursor-pointer hover:border-[#222] hover:text-[#222] transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                  {t('crm.clientAccountDetails.addBtn')}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {investments.map((inv: any, index: number) => (
                  <div key={inv?.transactionId || `${inv?.assetId}-${index}`} className="rounded-[12px] border border-[#e7e7e7] p-[18px] cursor-pointer hover:border-[#222] hover:-translate-y-px transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="cd-display text-[16px] font-semibold tracking-[-0.02em] text-[#222] leading-snug">{inv?.assetName || '—'}</div>
                        <div className="cd-mono text-[10px] tracking-[0.06em] uppercase text-[#888] mt-1">{inv?.assetCategory || '—'} · {inv?.assetCalculation || '—'}</div>
                      </div>
                      {inv?.assetCategory && (
                        <span className="cd-mono text-[9.5px] tracking-[0.08em] uppercase px-2 py-[3px] rounded-full bg-[#222] text-white font-semibold flex-shrink-0">
                          {s(inv.assetCategory).split(' ')[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    {inv?.assetExcerpt && <div className="text-[12.5px] text-[#555] mt-2.5 leading-relaxed">{inv.assetExcerpt}</div>}
                    <div className="mt-4 pt-3.5 border-t border-[#f0f0f0] grid grid-cols-2 gap-3">
                      <div>
                        <div className="cd-mono text-[10px] tracking-[0.06em] uppercase text-[#888]">{t('crm.clientAccountDetails.investmentAmount')}</div>
                        <div className="cd-mono text-[14px] font-semibold text-[#222] mt-1 tracking-[-0.02em]">{fmtMoney(inv?.invested)} {inv?.currency || ''}</div>
                      </div>
                      <div>
                        <div className="cd-mono text-[10px] tracking-[0.06em] uppercase text-[#888]">{t('crm.clientAccountDetails.investmentExpectedProfit')}</div>
                        <div className={cx('cd-mono text-[14px] font-semibold mt-1 tracking-[-0.02em]', toNumberMoney(inv?.expectedProfit) === 0 ? 'text-[#b5b5b5] font-medium' : 'text-[#222]')}>
                          {fmtMoney(inv?.expectedProfit)} {inv?.currency || ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TABLES: Operations + Transfers */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* Operations */}
            <div className="rounded-[14px] border border-[#e7e7e7] bg-white overflow-hidden flex flex-col">
              <div className="flex items-center justify-between gap-3 px-[18px] py-4 border-b border-[#e7e7e7]">
                <div className="flex items-center gap-3">
                  <h3 className="cd-display text-[14px] font-semibold tracking-[-0.01em] text-[#222]">{t('crm.clientAccountDetails.txns.title')}</h3>
                  <button
                    onClick={() => setTxnCreateOpen(true)}
                    disabled={!client}
                    className="inline-flex items-center gap-1.5 px-[10px] py-[5px] border border-[#e7e7e7] rounded-[8px] bg-white text-[12.5px] text-[#222] hover:border-[#222] disabled:opacity-40 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    {t('crm.clientAccountDetails.txns.create')}
                  </button>
                </div>
                <div className="cd-mono text-[10.5px] text-[#888]">
                  {t('crm.clientAccountDetails.recordsWord')}: <strong className="text-[#222]">{txnsCount}</strong>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead className="bg-[#fafafa]">
                    <tr>
                      {[t('crm.clientAccountDetails.txnsTable.colDate'), t('crm.clientAccountDetails.txnsTable.colName'), 'EUR', 'USD', t('crm.clientAccountDetails.txnsTable.colStatus'), t('crm.clientAccountDetails.txnsTable.colActions')].map((h, i) => (
                        <th key={h} className={cx('px-3.5 py-2.5 cd-mono text-[9.5px] font-medium tracking-[0.1em] uppercase text-[#888] border-b border-[#e7e7e7] whitespace-nowrap', i >= 2 && i <= 3 ? 'text-right' : i === 5 ? 'text-right' : 'text-left')}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(txns?.items || []).map((txn: any) => (
                      <tr key={txn.id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors">
                        <td className="px-3.5 py-3 align-top whitespace-nowrap">
                          <span className="cd-mono text-[11.5px] text-[#888]">{fmtDate(txn.date, dateLocale)}</span>
                        </td>
                        <td className="px-3.5 py-3 align-top max-w-[200px]">
                          <div className="font-semibold text-[#222] tracking-[-0.01em] truncate">{txn.title || `#${txn.wpPostId}`}</div>
                          {txn.desc && <div className="text-[11px] text-[#888] mt-0.5 line-clamp-2 leading-snug">{txn.desc}</div>}
                        </td>
                        <td className="px-3.5 py-3 align-top text-right">
                          <span className={cx('cd-mono text-[12px] tracking-[-0.02em]', !toNumberMoney(txn.spendEur) ? 'text-[#b5b5b5]' : 'text-[#222]')}>
                            {fmtMoney(txn.spendEur || '0')}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 align-top text-right">
                          <span className={cx('cd-mono text-[12px] tracking-[-0.02em]', !toNumberMoney(txn.spendUsd) ? 'text-[#b5b5b5]' : 'text-[#222]')}>
                            {fmtMoney(txn.spendUsd || '0')}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 align-top">
                          <StatusBadge status={txn.ccpStatus || txn.status} t={t} />
                        </td>
                        <td className="px-3.5 py-3 align-top text-right">
                          <button onClick={() => setTxnEdit(txn)} className="text-[11.5px] text-[#555] underline underline-offset-2 decoration-[#e7e7e7] hover:text-[#222] hover:decoration-[#222] transition-colors whitespace-nowrap">
                            {t('crm.common.edit')}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!loadingTables && (!txns || txns.items.length === 0) && (
                      <tr><td colSpan={6} className="px-3.5 py-8 text-center text-[#888] text-[13px]">{t('crm.clientAccountDetails.txns.empty')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-[#fafafa] border-t border-[#e7e7e7] flex items-center justify-between text-[11.5px] text-[#888]">
                <span>{t('crm.clientAccountDetails.shownOfFormat', { shown: txns?.items?.length ?? 0, total: txnsCount })}</span>
                <span className="text-[#555] underline underline-offset-2 decoration-[#e7e7e7] cursor-pointer hover:text-[#222]">{t('crm.clientAccountDetails.allOperationsLink')}</span>
              </div>
            </div>

            {/* Transfers */}
            <div className="rounded-[14px] border border-[#e7e7e7] bg-white overflow-hidden flex flex-col">
              <div className="flex items-center justify-between gap-3 px-[18px] py-4 border-b border-[#e7e7e7]">
                <div className="flex items-center gap-3">
                  <h3 className="cd-display text-[14px] font-semibold tracking-[-0.01em] text-[#222]">{t('crm.clientAccountDetails.transfers.title')}</h3>
                  <button
                    onClick={() => setTrCreateOpen(true)}
                    disabled={!client}
                    className="inline-flex items-center gap-1.5 px-[10px] py-[5px] border border-[#e7e7e7] rounded-[8px] bg-white text-[12.5px] text-[#222] hover:border-[#222] disabled:opacity-40 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    {t('crm.clientAccountDetails.transfers.create')}
                  </button>
                </div>
                <div className="cd-mono text-[10.5px] text-[#888]">
                  {t('crm.clientAccountDetails.recordsWord')}: <strong className="text-[#222]">{transfersCount}</strong>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead className="bg-[#fafafa]">
                    <tr>
                      {[t('crm.clientAccountDetails.transfersTable.colDate'), t('crm.clientAccountDetails.transfersTable.colSender'), t('crm.clientAccountDetails.transfersTable.colRecipient'), t('crm.clientAccountDetails.transfersTable.colAmount'), t('crm.clientAccountDetails.transfersTable.colRate'), t('crm.clientAccountDetails.transfersTable.colCredited'), t('crm.clientAccountDetails.transfersTable.colStatus'), t('crm.clientAccountDetails.transfersTable.colActions')].map((h, i) => (
                        <th key={h} className={cx('px-3.5 py-2.5 cd-mono text-[9.5px] font-medium tracking-[0.1em] uppercase text-[#888] border-b border-[#e7e7e7] whitespace-nowrap', i >= 3 && i <= 5 ? 'text-right' : i === 7 ? 'text-right' : 'text-left')}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(transfers?.items || []).map((tr: any) => {
                      const f = readTransferFields(tr);
                      const fromCur = s(f.fromCur);
                      const toCur = s(f.toCur);
                      const selectedWpId = Number((client as any).wpUserId);
                      const { fromId: fromUserId, toId: toUserId } = transferParticipantIds(tr, selectedWpId);
                      /* When toUserId is unknown, extract name from meta.comment */
                      const commentRecipient = (() => {
                        const c = s(tr.meta?.comment || tr.note);
                        const m = c.match(/пользователю\s+(.+)/i);
                        return m ? m[1].trim() : null;
                      })();
                      const isSent = fromUserId === selectedWpId;
                      return (
                        <tr key={tr.id} className={cx('border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors', isSent ? 'border-l-2 border-l-[#cc2f47]' : toUserId === selectedWpId ? 'border-l-2 border-l-[#1f8a5e]' : '')}>
                          <td className="px-3.5 py-3 align-top whitespace-nowrap">
                            <span className="cd-mono text-[11.5px] text-[#888]">{fmtDate(tr.date, dateLocale)}</span>
                          </td>
                          <td className="px-3.5 py-3 align-top whitespace-nowrap">
                            <span className="font-semibold text-[#222] tracking-[-0.01em]">{wpUserLabel(fromUserId)}</span>
                            {fromCur && <span className="cd-mono text-[10.5px] text-[#888] ml-1">({fromCur})</span>}
                          </td>
                          <td className="px-3.5 py-3 align-top whitespace-nowrap">
                            {toUserId
                              ? <span className="font-semibold text-[#222] tracking-[-0.01em]">{wpUserLabel(toUserId)}</span>
                              : commentRecipient
                                ? <span className="font-semibold text-[#222] tracking-[-0.01em]">{commentRecipient}</span>
                                : <span className="text-[#b5b5b5]">—</span>
                            }
                            {toCur && <span className="cd-mono text-[10.5px] text-[#b5b5b5] ml-1">({toCur})</span>}
                          </td>
                          <td className="px-3.5 py-3 align-top text-right whitespace-nowrap">
                            <span className="cd-mono text-[12.5px] font-semibold text-[#222] tracking-[-0.02em]">{fmtMoney(f.amount || '0')} {toCur || tr.currency || '—'}</span>
                          </td>
                          <td className="px-3.5 py-3 align-top text-right whitespace-nowrap">
                            <span className="cd-mono text-[12px] text-[#555]">{f.rate ? fmtMoney(f.rate) : '—'}</span>
                          </td>
                          <td className="px-3.5 py-3 align-top text-right whitespace-nowrap">
                            <span className="cd-mono text-[12.5px] font-semibold text-[#222] tracking-[-0.02em]">{f.credited ? fmtMoney(f.credited) : '—'}</span>
                          </td>
                          <td className="px-3.5 py-3 align-top">
                            <StatusBadge status={tr.ccpStatus || tr.status} t={t} />
                          </td>
                          <td className="px-3.5 py-3 align-top text-right">
                            <button onClick={() => setTrEdit(tr)} className="text-[11.5px] text-[#555] underline underline-offset-2 decoration-[#e7e7e7] hover:text-[#222] hover:decoration-[#222] transition-colors whitespace-nowrap">
                              {t('crm.common.edit')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!loadingTables && (!transfers || transfers.items.length === 0) && (
                      <tr><td colSpan={8} className="px-3.5 py-8 text-center text-[#888] text-[13px]">{t('crm.clientAccountDetails.transfers.empty')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-[#fafafa] border-t border-[#e7e7e7] flex items-center justify-between text-[11.5px] text-[#888]">
                <span>{t('crm.clientAccountDetails.shownOfFormat', { shown: transfers?.items?.length ?? 0, total: transfersCount })}</span>
                <span className="text-[#555] underline underline-offset-2 decoration-[#e7e7e7] cursor-pointer hover:text-[#222]">{t('crm.clientAccountDetails.allTransfersLink')}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===================== MODALS ===================== */}

      {editOpen && client && (
        <ModalShell
          title={t('crm.clientAccountDetails.editClient.title')}
          subtitle={t('crm.clientAccountDetails.editClient.subtitle')}
          busy={savingClient}
          onClose={() => setEditOpen(false)}
          onSave={saveClient}
          saveLabel={t('crm.common.save')}
        >
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Field label={t('crm.clientAccountDetails.editClient.balanceEur')} value={eur} onChange={setEur} placeholder="0" />
            <Field label={t('crm.clientAccountDetails.editClient.balanceUsd')} value={usd} onChange={setUsd} placeholder="0" />
            <Field label={t('crm.clientAccountDetails.editClient.accountEur')} value={accEurNumber} onChange={setAccEurNumber} placeholder="EUR-xxxx-xxxx" />
            <Field label={t('crm.clientAccountDetails.editClient.accountUsd')} value={accUsdNumber} onChange={setAccUsdNumber} placeholder="USD-xxxx-xxxx" />
            <Field label={t('crm.clientAccountDetails.editClient.ibanEur')} value={ibanEur} onChange={setIbanEur} placeholder="TR.." />
            <Field label={t('crm.clientAccountDetails.editClient.ibanUsd')} value={ibanUsd} onChange={setIbanUsd} placeholder="TR.." />
          </div>
        </ModalShell>
      )}

      {txnCreateOpen && client && (
        <TxnCreateModal
          busy={txnSaving}
          balanceEur={currentBalance.EUR}
          balanceUsd={currentBalance.USD}
          onClose={() => setTxnCreateOpen(false)}
          onCreate={createTxn}
        />
      )}

      {txnEdit && (
        <TxnEditModal
          row={txnEdit}
          busy={txnSaving}
          balanceEur={currentBalance.EUR}
          balanceUsd={currentBalance.USD}
          onClose={() => setTxnEdit(null)}
          onSave={(patch) => saveTxn(txnEdit, patch)}
        />
      )}

      {trCreateOpen && client && (
        <TransferCreateModal
          busy={trSaving}
          sender={{ id: String((client as any).id), wpUserId: Number((client as any).wpUserId), email: String((client as any).email || ''), name: (client as any).name ?? null }}
          indexLoading={indexLoading}
          clientIndex={clientIndex}
          balanceEur={currentBalance.EUR}
          balanceUsd={currentBalance.USD}
          onClose={() => setTrCreateOpen(false)}
          onCreate={createTransfer}
        />
      )}

      {trEdit && (
        <TransferEditModal
          row={trEdit}
          busy={trSaving}
          indexLoading={indexLoading}
          clientIndex={clientIndex}
          onClose={() => setTrEdit(null)}
          onSave={(patch) => saveTransfer(trEdit, patch)}
        />
      )}
    </MainLayout>
  );
};

export default ClientAccountDetailsPage;

/* ===================== Select helper ===================== */
const CdSelect: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; hint?: React.ReactNode }> = ({ label, value, onChange, options, hint }) => (
  <div>
    <div className="cd-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">{label}</div>
    <select
      className="mt-1.5 w-full rounded-[8px] border border-[#e7e7e7] bg-white px-3 py-2 text-sm text-[#222] outline-none focus:border-[#222] transition-colors appearance-none cursor-pointer"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {hint && <div className="mt-1 text-[11px] text-[#888]">{hint}</div>}
  </div>
);

const CdTextarea: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
  <div>
    <div className="cd-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">{label}</div>
    <textarea
      className="mt-1.5 w-full min-h-[80px] rounded-[8px] border border-[#e7e7e7] bg-white px-3 py-2 text-sm text-[#222] outline-none focus:border-[#222] transition-colors resize-none placeholder:text-[#b5b5b5]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

/* ===================== Modal components ===================== */

const TxnCreateModal: React.FC<{
  busy: boolean;
  balanceEur: number;
  balanceUsd: number;
  onClose: () => void;
  onCreate: (patch: { title?: string; desc?: string; date?: string; currency: 'EUR' | 'USD'; amount: string; ccpStatus?: string }) => void;
}> = ({ busy, balanceEur, balanceUsd, onClose, onCreate }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [ccpStatus, setCcpStatus] = useState('In progress');
  const [date, setDate] = useState(todayYmd());
  const [currency, setCurrency] = useState<'EUR' | 'USD'>('EUR');
  const [amount, setAmount] = useState('0');
  const [desc, setDesc] = useState('');

  const statusOpts = useMemo(() => [
    { value: 'In progress', label: t('crm.clientAccountDetails.ccpStatus.inProgress') },
    { value: 'Done', label: t('crm.clientAccountDetails.ccpStatus.done') },
    { value: 'Rejected', label: t('crm.clientAccountDetails.ccpStatus.rejected') },
    { value: 'Insufficient funds', label: t('crm.clientAccountDetails.ccpStatus.insufficient') },
  ], [t]);

  const amt = toNumberMoney(amount);
  const available = currency === 'EUR' ? balanceEur : balanceUsd;
  const ok = amt > 0 && amt <= available;

  return (
    <ModalShell title={t('crm.clientAccountDetails.txnCreate.title')} subtitle={t('crm.clientAccountDetails.txnCreate.subtitle')} busy={busy} onClose={onClose} onSave={() => onCreate({ title, desc, date, currency, amount, ccpStatus })} saveLabel={t('crm.clientAccountDetails.txnCreate.save')} saveDisabled={!ok}>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label={t('crm.clientAccountDetails.txnCreate.nameLabel')} value={title} onChange={setTitle} placeholder={t('crm.clientAccountDetails.txnCreate.namePlaceholder')} />
        <CdSelect label={t('crm.clientAccountDetails.labels.ccpStatus')} value={ccpStatus} onChange={setCcpStatus} options={statusOpts} />
        <Field label={t('crm.clientAccountDetails.labels.date')} value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
        <CdSelect label={t('crm.clientAccountDetails.labels.currency')} value={currency} onChange={(v) => setCurrency(v as any)} options={[{ value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' }]} hint={<>{t('crm.clientAccountDetails.labels.available', { amount: fmtMoney(available) })}</>} />
        <Field label={t('crm.clientAccountDetails.labels.amount')} value={amount} onChange={setAmount} rightHint={!ok ? <span className="text-[#cc2f47]">{amt <= 0 ? t('crm.clientAccountDetails.txnCreate.amountHintPositive') : t('crm.clientAccountDetails.txnCreate.amountHintInsufficient')}</span> : <span className="text-[#1f8a5e]">{t('crm.common.ok')}</span>} />
        <div className="md:col-span-2"><CdTextarea label={t('crm.clientAccountDetails.labels.description')} value={desc} onChange={setDesc} placeholder={t('crm.clientAccountDetails.txnCreate.descPlaceholder')} /></div>
      </div>
    </ModalShell>
  );
};

const TxnEditModal: React.FC<{
  row: CcpTxn;
  busy: boolean;
  balanceEur: number;
  balanceUsd: number;
  onClose: () => void;
  onSave: (patch: Partial<CcpTxn>) => void;
}> = ({ row, busy, balanceEur, balanceUsd, onClose, onSave }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState((row as any).title || '');
  const [ccpStatus, setCcpStatus] = useState((row as any).ccpStatus || '');
  const [date, setDate] = useState((row as any).date || '');
  const [desc, setDesc] = useState((row as any).desc || '');
  const [eur, setEur] = useState(String((row as any).spendEur ?? '0'));
  const [usd, setUsd] = useState(String((row as any).spendUsd ?? '0'));

  const statusOpts = useMemo(() => [
    { value: 'In progress', label: t('crm.clientAccountDetails.ccpStatus.inProgress') },
    { value: 'Done', label: t('crm.clientAccountDetails.ccpStatus.done') },
    { value: 'Rejected', label: t('crm.clientAccountDetails.ccpStatus.rejected') },
    { value: 'Insufficient funds', label: t('crm.clientAccountDetails.ccpStatus.insufficient') },
  ], [t]);

  const oldE = toNumberMoney((row as any).spendEur ?? 0), oldU = toNumberMoney((row as any).spendUsd ?? 0);
  const newE = toNumberMoney(eur), newU = toNumberMoney(usd);
  const deltaE = newE - oldE, deltaU = newU - oldU;
  const ok = !(deltaE > 0 && deltaE > balanceEur) && !(deltaU > 0 && deltaU > balanceUsd);

  return (
    <ModalShell title={t('crm.clientAccountDetails.txnEdit.title', { id: (row as any).wpPostId })} subtitle={t('crm.clientAccountDetails.txnEdit.subtitle')} busy={busy} onClose={onClose} onSave={() => onSave({ title, status: (row as any).status || 'publish', ccpStatus, date, desc, spendEur: eur as any, spendUsd: usd as any } as any)} saveLabel={t('crm.common.save')} saveDisabled={!ok}>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label={t('crm.clientAccountDetails.txnEdit.nameLabel')} value={title} onChange={setTitle} />
        <CdSelect label={t('crm.clientAccountDetails.labels.ccpStatus')} value={ccpStatus || 'In progress'} onChange={setCcpStatus} options={statusOpts} />
        <Field label={t('crm.clientAccountDetails.labels.date')} value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
        <Field label={t('crm.clientAccountDetails.txnEdit.spendEur')} value={eur} onChange={setEur} rightHint={deltaE > 0 && deltaE > balanceEur ? <span className="text-[#cc2f47]">{t('crm.clientAccountDetails.txnEdit.insufficient')}</span> : <span className="text-[#888]">Δ {fmtMoney(deltaE)}</span>} />
        <Field label={t('crm.clientAccountDetails.txnEdit.spendUsd')} value={usd} onChange={setUsd} rightHint={deltaU > 0 && deltaU > balanceUsd ? <span className="text-[#cc2f47]">{t('crm.clientAccountDetails.txnEdit.insufficient')}</span> : <span className="text-[#888]">Δ {fmtMoney(deltaU)}</span>} />
        <div className="md:col-span-2"><CdTextarea label={t('crm.clientAccountDetails.labels.description')} value={desc} onChange={setDesc} placeholder={t('crm.clientAccountDetails.txnEdit.descPlaceholder')} /></div>
      </div>
    </ModalShell>
  );
};

const TransferCreateModal: React.FC<{
  busy: boolean;
  sender: { id: string; wpUserId: number; email: string; name?: string | null };
  indexLoading: boolean;
  clientIndex: ClientIndexItem[];
  balanceEur: number;
  balanceUsd: number;
  onClose: () => void;
  onCreate: (patch: { toWpUserId: number; fromCurrency: 'EUR' | 'USD'; toCurrency: 'EUR' | 'USD'; amount: string; rate: string; date?: string; desc?: string; ccpStatus?: string }) => void;
}> = ({ busy, sender, indexLoading, clientIndex, balanceEur, balanceUsd, onClose, onCreate }) => {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [pickedWpId, setPickedWpId] = useState<number | null>(null);
  const [ccpStatus, setCcpStatus] = useState('In progress');
  const [date, setDate] = useState(todayYmd());
  const [fromCur, setFromCur] = useState<'EUR' | 'USD'>('EUR');
  const [toCur, setToCur] = useState<'EUR' | 'USD'>('EUR');
  const [amount, setAmount] = useState('0');
  const [rate, setRate] = useState('1');
  const [desc, setDesc] = useState('');

  const statusOpts = useMemo(() => [
    { value: 'In progress', label: t('crm.clientAccountDetails.ccpStatus.inProgress') },
    { value: 'Done', label: t('crm.clientAccountDetails.ccpStatus.done') },
    { value: 'Rejected', label: t('crm.clientAccountDetails.ccpStatus.rejected') },
    { value: 'Insufficient funds', label: t('crm.clientAccountDetails.ccpStatus.insufficient') },
  ], [t]);

  const suggestions = useMemo(() => {
    const qq = s(q).toLowerCase();
    if (qq.length < 2) return [];
    return clientIndex.filter((c) => c.wpUserId !== sender.wpUserId).filter((c) => (c.email || '').toLowerCase().includes(qq) || (c.name || '').toLowerCase().includes(qq)).slice(0, 8);
  }, [q, clientIndex, sender.wpUserId]);

  const available = fromCur === 'EUR' ? balanceEur : balanceUsd;
  const amt = toNumberMoney(amount);
  const rt = Math.max(0, toNumberMoney(rate || 1));
  const credited = amt * (rt || 1);
  const ok = !!pickedWpId && amt > 0 && amt <= available;
  const picked = pickedWpId ? clientIndex.find((x) => x.wpUserId === pickedWpId) || null : null;

  return (
    <ModalShell title={t('crm.clientAccountDetails.transferCreate.title')} subtitle={t('crm.clientAccountDetails.transferCreate.subtitle')} busy={busy} onClose={onClose} onSave={() => onCreate({ toWpUserId: Number(pickedWpId), fromCurrency: fromCur, toCurrency: toCur, amount, rate, date, desc, ccpStatus })} saveLabel={t('crm.clientAccountDetails.transferCreate.save')} saveDisabled={!ok}>
      <div className="space-y-3.5">
        <div className="rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2.5 text-[12.5px] text-[#555]">
          {t('crm.clientAccountDetails.transferCreate.senderLabel')}{' '}
          <span className="font-semibold text-[#222]">{sender.name || sender.email}</span> · WP#{sender.wpUserId}
        </div>
        <div>
          <div className="cd-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">{t('crm.clientAccountDetails.transferCreate.recipientSearchLabel')}</div>
          <input className="mt-1.5 w-full rounded-[8px] border border-[#e7e7e7] bg-white px-3 py-2 text-sm text-[#222] outline-none focus:border-[#222] transition-colors placeholder:text-[#b5b5b5]"
            placeholder={indexLoading ? t('crm.clientAccountDetails.transferCreate.recipientPlaceholderLoading') : t('crm.clientAccountDetails.transferCreate.recipientPlaceholder')}
            value={q} onChange={(e) => { setQ(e.target.value); setPickedWpId(null); }} disabled={indexLoading} />
          {picked
            ? <div className="mt-1.5 text-[11px] text-[#1f8a5e]">{t('crm.clientAccountDetails.transferCreate.recipientChosen', { name: picked.name || picked.email, id: picked.wpUserId })}</div>
            : <div className="mt-1.5 text-[11px] text-[#888]">{t('crm.clientAccountDetails.transferCreate.recipientHint')}</div>}
          {!indexLoading && suggestions.length > 0 && (
            <div className="mt-1.5 rounded-[8px] border border-[#e7e7e7] bg-white overflow-hidden">
              {suggestions.map((c) => (
                <button key={c.wpUserId} className="w-full text-left px-3 py-2 hover:bg-[#fafafa] transition-colors border-b border-[#f0f0f0] last:border-0" onClick={() => { setPickedWpId(c.wpUserId); setQ(c.email); }}>
                  <div className="text-[13px] font-medium text-[#222]">{c.name || c.email}</div>
                  <div className="cd-mono text-[10.5px] text-[#888]">{c.email} · WP#{c.wpUserId}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <CdSelect label={t('crm.clientAccountDetails.labels.ccpStatus')} value={ccpStatus} onChange={setCcpStatus} options={statusOpts} />
          <Field label={t('crm.clientAccountDetails.labels.date')} value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
          <CdSelect label={t('crm.clientAccountDetails.transferCreate.fromCurrency')} value={fromCur} onChange={(v) => setFromCur(v as any)} options={[{ value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' }]} hint={<>{t('crm.clientAccountDetails.labels.available', { amount: fmtMoney(available) })}</>} />
          <CdSelect label={t('crm.clientAccountDetails.transferCreate.toCurrency')} value={toCur} onChange={(v) => setToCur(v as any)} options={[{ value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' }]} hint={<>{t('crm.clientAccountDetails.transferCreate.credited', { amount: fmtMoney(credited), currency: toCur })}</>} />
          <Field label={t('crm.clientAccountDetails.labels.amount')} value={amount} onChange={setAmount} rightHint={!ok ? <span className="text-[#cc2f47]">{amt <= 0 ? t('crm.clientAccountDetails.transferCreate.amountHintPositive') : amt > available ? t('crm.clientAccountDetails.transferCreate.amountHintInsufficient') : t('crm.clientAccountDetails.transferCreate.amountHintRecipient')}</span> : <span className="text-[#1f8a5e]">{t('crm.common.ok')}</span>} />
          <Field label={t('crm.clientAccountDetails.labels.rate')} value={rate} onChange={setRate} placeholder="1" />
          <div className="md:col-span-2"><CdTextarea label={t('crm.clientAccountDetails.labels.description')} value={desc} onChange={setDesc} placeholder={t('crm.clientAccountDetails.transferCreate.descPlaceholder')} /></div>
        </div>
      </div>
    </ModalShell>
  );
};

const TransferEditModal: React.FC<{
  row: CcpTransfer;
  busy: boolean;
  indexLoading: boolean;
  clientIndex: ClientIndexItem[];
  onClose: () => void;
  onSave: (patch: any) => void;
}> = ({ row, busy, indexLoading, clientIndex, onClose, onSave }) => {
  const { t } = useTranslation();
  const initial = useMemo(() => {
    const amount = row.amount ?? (row as any).meta?.ccp_tr_amount ?? '0';
    const rate = (row as any).rate ?? (row as any).meta?.ccp_tr_rate ?? '1';
    const fromCurrency = (row as any).fromCurrency ?? (row as any).meta?.ccp_tr_from_cur ?? (row as any).meta?.ccp_tr_from_currency ?? 'EUR';
    const toCurrency = (row as any).toCurrency ?? (row as any).meta?.ccp_tr_to_cur ?? (row as any).meta?.ccp_tr_to_currency ?? (row as any).currency ?? (row as any).meta?.ccp_tr_currency ?? 'EUR';
    const desc = (row as any).desc ?? (row as any).meta?.ccp_tr_desc ?? (row as any).meta?.ccp_tr_description ?? '';
    const note = (row as any).note ?? (row as any).meta?.ccp_tr_note ?? '';
    return { amount, rate, fromCurrency, toCurrency, desc, note };
  }, [row]);

  const [title, setTitle] = useState((row as any).title || '');
  const [ccpStatus, setCcpStatus] = useState((row as any).ccpStatus || '');
  const [date, setDate] = useState((row as any).date || '');
  const participantIds = useMemo(() => transferParticipantIds(row as any), [row]);
  const [fromUserId, setFromUserId] = useState(String(participantIds.fromId ?? ''));
  const [toUserId, setToUserId] = useState(String(participantIds.toId ?? ''));

  const statusOpts = useMemo(() => [
    { value: 'In progress', label: t('crm.clientAccountDetails.ccpStatus.inProgress') },
    { value: 'Done', label: t('crm.clientAccountDetails.ccpStatus.done') },
    { value: 'Rejected', label: t('crm.clientAccountDetails.ccpStatus.rejected') },
    { value: 'Insufficient funds', label: t('crm.clientAccountDetails.ccpStatus.insufficient') },
  ], [t]);

  const [fromCurrency, setFromCurrency] = useState(String(initial.fromCurrency || 'EUR'));
  const [toCurrency, setToCurrency] = useState(String(initial.toCurrency || 'EUR'));
  const [amount, setAmount] = useState(String(initial.amount ?? '0'));
  const [rate, setRate] = useState(String(initial.rate ?? '1'));
  const [desc, setDesc] = useState(String(initial.desc ?? ''));
  const [note, setNote] = useState(String(initial.note ?? ''));

  const fromWp = Number(fromUserId || 0), toWp = Number(toUserId || 0);
  const fromClient = fromWp ? clientIndex.find((x) => x.wpUserId === fromWp) || null : null;
  const toClient = toWp ? clientIndex.find((x) => x.wpUserId === toWp) || null : null;
  const cannotResolve = (!!fromWp && !fromClient) || (!!toWp && !toClient);

  return (
    <ModalShell title={t('crm.clientAccountDetails.transferEdit.title', { id: (row as any).wpPostId })} subtitle={t('crm.clientAccountDetails.transferEdit.subtitle')} busy={busy} onClose={onClose} onSave={() => onSave({ title, status: (row as any).status || 'publish', ccpStatus, date, fromUserId: fromWp, toUserId: toWp, fromCurrency, toCurrency, amount, rate, desc, note, currency: toCurrency })} saveLabel={t('crm.common.save')} saveDisabled={indexLoading || cannotResolve || toNumberMoney(amount) <= 0}>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label={t('crm.clientAccountDetails.transferEdit.nameLabel')} value={title} onChange={setTitle} />
        <CdSelect label={t('crm.clientAccountDetails.labels.ccpStatus')} value={ccpStatus || 'In progress'} onChange={setCcpStatus} options={statusOpts} />
        <Field label={t('crm.clientAccountDetails.labels.date')} value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
        <div className="md:col-span-2 rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2.5 text-[12px] text-[#888]">
          {indexLoading ? t('crm.clientAccountDetails.transferEdit.participantsLoading') : (
            <>
              {t('crm.clientAccountDetails.transferEdit.senderLabel')}{' '}
              <span className="text-[#222] font-medium">{fromClient ? `${fromClient.name || fromClient.email} · WP#${fromClient.wpUserId}` : fromWp ? t('crm.clientAccountDetails.transferEdit.userMissing', { id: fromWp }) : t('crm.common.empty')}</span>
              <span className="mx-2 text-[#e7e7e7]">•</span>
              {t('crm.clientAccountDetails.transferEdit.recipientLabel')}{' '}
              <span className="text-[#222] font-medium">{toClient ? `${toClient.name || toClient.email} · WP#${toClient.wpUserId}` : toWp ? t('crm.clientAccountDetails.transferEdit.userMissing', { id: toWp }) : t('crm.common.empty')}</span>
            </>
          )}
        </div>
        <Field label={t('crm.clientAccountDetails.transferEdit.fromUserId')} value={fromUserId} onChange={setFromUserId} placeholder={t('crm.clientAccountDetails.transferEdit.userIdPlaceholder', { id: 123 })} />
        <Field label={t('crm.clientAccountDetails.transferEdit.toUserId')} value={toUserId} onChange={setToUserId} placeholder={t('crm.clientAccountDetails.transferEdit.userIdPlaceholder', { id: 456 })} />
        <CdSelect label={t('crm.clientAccountDetails.transferEdit.fromCurrency')} value={fromCurrency} onChange={setFromCurrency} options={[{ value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' }]} />
        <CdSelect label={t('crm.clientAccountDetails.transferEdit.toCurrency')} value={toCurrency} onChange={setToCurrency} options={[{ value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' }]} />
        <Field label={t('crm.clientAccountDetails.labels.amount')} value={amount} onChange={setAmount} />
        <Field label={t('crm.clientAccountDetails.labels.rate')} value={rate} onChange={setRate} placeholder="1" />
        <div className="md:col-span-2"><CdTextarea label={t('crm.clientAccountDetails.transferEdit.descLabel')} value={desc} onChange={setDesc} placeholder={t('crm.clientAccountDetails.transferEdit.descPlaceholder')} /></div>
        <div className="md:col-span-2"><CdTextarea label={t('crm.clientAccountDetails.transferEdit.noteLabel')} value={note} onChange={setNote} placeholder={t('crm.clientAccountDetails.transferEdit.notePlaceholder')} /></div>
        {cannotResolve && (
          <div className="md:col-span-2 rounded-[8px] border border-[#f0c8cf] bg-[#fbecef] px-3 py-2.5 text-[12px] text-[#9a1f31]">
            {t('crm.clientAccountDetails.transferEdit.participantsMissing')}
          </div>
        )}
      </div>
    </ModalShell>
  );
};
