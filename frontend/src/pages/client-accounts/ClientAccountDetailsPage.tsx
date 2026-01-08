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
  // create-dto amount/rate — string
  const n = toNumberMoney(v);
  // не форсим локаль, чтобы backend не словил запятую
  return String(Number.isFinite(n) ? n : 0);
}
function fmtMoney(v: any) {
  const raw = s(v).replace(/\s+/g, '').replace(',', '.');
  const n = Number(raw);
  if (!Number.isFinite(n)) return s(v) || '0';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v: any) {
  const ss = s(v);
  if (!ss) return '—';
  const d = new Date(ss);
  if (Number.isNaN(d.getTime())) return ss;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
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
  if (vv === 'done' || vv === 'completed' || vv === 'success' || vv.includes('выполн')) return t('crm.clientAccounts.status.done');
  if (vv === 'draft' || vv.includes('чернов')) return t('crm.clientAccounts.status.draft');
  if (vv === 'publish' || vv === 'published' || vv.includes('опублик')) return t('crm.clientAccounts.status.published');
  if (vv === 'pending' || vv === 'in_progress' || vv.includes('ожида')) return t('crm.clientAccounts.status.inProgress');
  if (vv === 'failed' || vv === 'error' || vv.includes('ошиб') || vv.includes('insufficient')) return t('crm.clientAccounts.status.failed');
  const orig = s(v);
  return orig.length > 1 ? orig[0].toUpperCase() + orig.slice(1) : orig.toUpperCase();
}
function statusTone(status?: string | null) {
  const vv = s(status).toLowerCase();
  if (vv.includes('done') || vv.includes('completed') || vv.includes('success') || vv.includes('выполн')) return 'ok';
  if (vv.includes('reject') || vv.includes('cancel') || vv.includes('fail') || vv.includes('ошиб') || vv.includes('insufficient')) return 'bad';
  if (vv.includes('progress') || vv.includes('pending') || vv.includes('hold') || vv.includes('check') || vv.includes('ожида')) return 'warn';
  return 'neutral';
}

/**
 * СЧЁТ / IBAN / Балансы могут жить в разных местах:
 * - client.accountEur/accountUsd
 * - client.balanceEur/balanceUsd
 * - client.meta.ccp_acc_*_number / ccp_acc_*_balance / ccp_iban_*
 * - legacy keys ccp_balance_*
 */
function pickMeta(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k] ?? obj?.meta?.[k];
    if (v !== undefined && v !== null && s(v) !== '') return v;
  }
  return '';
}

/* ===================== UI bits ===================== */

const Pill: React.FC<{ children: React.ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'bad' }> = ({
  children,
  tone = 'neutral',
}) => {
  const cls =
    tone === 'ok'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : tone === 'warn'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      : tone === 'bad'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
      : 'border-slate-700 bg-slate-900/60 text-slate-300';

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
        cls
      )}
    >
      {children}
    </span>
  );
};

const SoftButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'ghost' | 'primary' | 'soft' }
> = ({ className, tone = 'ghost', ...props }) => {
  const base =
    tone === 'primary'
      ? 'rounded-2xl !bg-slate-900 px-4 py-2 text-xs font-semibold !text-white hover:!bg-slate-800 disabled:opacity-40'
      : tone === 'soft'
      ? 'rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900 disabled:opacity-50'
      : 'rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-2 text-xs text-slate-200 hover:bg-slate-900 disabled:opacity-50';

  return <button {...props} className={cx(base, className || '')} />;
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rightHint?: React.ReactNode;
}> = ({ label, value, onChange, placeholder, rightHint }) => {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
        {rightHint ? <div className="text-[11px] text-slate-500">{rightHint}</div> : null}
      </div>
      <input
        className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
};

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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-50">{title}</div>
            {subtitle ? <div className="mt-1 text-[11px] text-slate-500">{subtitle}</div> : null}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none"
            aria-label={t('crm.common.close')}
          >
            ×
          </button>
        </div>

        <div className="mt-4">{children}</div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <SoftButton tone="soft" onClick={onClose} disabled={!!busy}>
            {t('crm.common.cancel')}
          </SoftButton>
          <SoftButton onClick={onSave} tone="primary" disabled={!!busy || !!saveDisabled}>
            {busy ? t('crm.common.saving') : saveLabel || t('crm.common.save')}
          </SoftButton>
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
  const { t } = useTranslation();
  const params = useParams();
  const clientId = s((params as any).id || (params as any).clientId);

  const ccpStatusOptions = useMemo(
    () => [
      { value: 'In progress', label: t('crm.clientAccountDetails.ccpStatus.inProgress') },
      { value: 'Done', label: t('crm.clientAccountDetails.ccpStatus.done') },
      { value: 'Rejected', label: t('crm.clientAccountDetails.ccpStatus.rejected') },
      { value: 'Insufficient funds', label: t('crm.clientAccountDetails.ccpStatus.insufficient') },
    ],
    [t]
  );

  const wpStatusOptions = useMemo(
    () => [
      { value: 'publish', label: t('crm.clientAccountDetails.wpStatus.publish') },
      { value: 'draft', label: t('crm.clientAccountDetails.wpStatus.draft') },
      { value: 'pending', label: t('crm.clientAccountDetails.wpStatus.pending') },
      { value: 'private', label: t('crm.clientAccountDetails.wpStatus.private') },
    ],
    [t]
  );

  const [client, setClient] = useState<CcpClient | null>(null);
  const [site, setSite] = useState<CcpSite | null>(null);

  const [txns, setTxns] = useState<ApiList<CcpTxn> | null>(null);
  const [transfers, setTransfers] = useState<ApiList<CcpTransfer> | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingTables, setLoadingTables] = useState(false);
  const [err, setErr] = useState<string>('');

  // client index for autocomplete (same site)
  const [indexLoading, setIndexLoading] = useState(false);
  const [clientIndex, setClientIndex] = useState<ClientIndexItem[]>([]);

  // edit client modal
  const [editOpen, setEditOpen] = useState(false);
  const [eur, setEur] = useState('');
  const [usd, setUsd] = useState('');
  const [accEurNumber, setAccEurNumber] = useState('');
  const [accUsdNumber, setAccUsdNumber] = useState('');
  const [ibanEur, setIbanEur] = useState('');
  const [ibanUsd, setIbanUsd] = useState('');
  const [savingClient, setSavingClient] = useState(false);

  // create/edit txn
  const [txnEdit, setTxnEdit] = useState<CcpTxn | null>(null);
  const [txnCreateOpen, setTxnCreateOpen] = useState(false);
  const [txnSaving, setTxnSaving] = useState(false);

  // create/edit transfer
  const [trEdit, setTrEdit] = useState<CcpTransfer | null>(null);
  const [trCreateOpen, setTrCreateOpen] = useState(false);
  const [trSaving, setTrSaving] = useState(false);

  const aliveRef = useRef(true);
  const pollRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const lastOkRef = useRef<number>(0);

  const loadAll = async (mode: 'full' | 'tables' = 'full') => {
    if (!clientId) {
      setErr(t('crm.clientAccountDetails.errors.clientIdMissing'));
      setLoading(false);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      if (mode === 'full') {
        setLoading(true);
        setErr('');
      } else {
        setLoadingTables(true);
      }

      const c = await ccpApi.client(clientId);
      if (!aliveRef.current) return;
      setClient(c);

      const sites = await ccpApi.sites();
      if (!aliveRef.current) return;
      const ss = (sites || []).find((x: any) => x.id === (c as any).siteId) || null;
      setSite(ss);

      const wpUserId = Number((c as any).wpUserId);
      const sid = String((c as any).siteId);

      const [t1, t2] = await Promise.all([
        ccpApi.txns({ siteId: sid, wpUserId, page: 1, per: 200 } as any),
        ccpApi.transfers({ siteId: sid, wpUserId, page: 1, per: 200 } as any),
      ]);

      if (!aliveRef.current) return;
      const tx = (t1 as any);
      const tr = (t2 as any);

      const txItems = pickItems<CcpTxn>(tx);
      const trItems = pickItems<CcpTransfer>(tr);

      setTxns({
        items: txItems,
        page: (tx?.page ?? 1) as any,
        per: (tx?.per ?? txItems.length ?? 200) as any,
        total: (tx?.total ?? txItems.length ?? 0) as any,
      });

      setTransfers({
        items: trItems,
        page: (tr?.page ?? 1) as any,
        per: (tr?.per ?? trItems.length ?? 200) as any,
        total: (tr?.total ?? trItems.length ?? 0) as any,
      });

      lastOkRef.current = Date.now();
    } catch (e: any) {
      if (!aliveRef.current) return;
      setErr(e?.message || t('crm.clientAccountDetails.errors.loadFailed'));
    } finally {
      inFlightRef.current = false;
      if (!aliveRef.current) return;
      setLoading(false);
      setLoadingTables(false);
    }
  };

  const loadClientIndex = async (siteId: string) => {
    if (!siteId) return;
    setIndexLoading(true);
    try {
      // берём много, чтобы редактирование/создание переводов не падало
      // если клиентов реально > 1000 — сделаем второй запрос по total (ниже)
      const first = await ccpApi.clients({ siteId, page: 1, per: 500 } as any);
      const items1 = pickItems<CcpClient>(first as any);

      let all = items1;
      const total = Number((first as any)?.total ?? items1.length ?? 0);
      const per = Number((first as any)?.per ?? 500);

      if (total > per) {
        const pages = Math.ceil(total / per);
        const restPages = Array.from({ length: Math.min(pages - 1, 9) }).map((_, i) => i + 2); // safety cap
        const rest = await Promise.all(restPages.map((p) => ccpApi.clients({ siteId, page: p, per } as any)));
        for (const r of rest) all = all.concat(pickItems<CcpClient>(r as any));
      }

      const mapped: ClientIndexItem[] = (all || [])
        .map((c: any) => ({
          id: String(c.id),
          wpUserId: Number(c.wpUserId),
          email: String(c.email || ''),
          name: c.name ?? null,
          siteId: String(c.siteId),
        }))
        .filter((x) => x.wpUserId && x.email && x.siteId === siteId);

      // unique by wpUserId
      const uniq = new Map<number, ClientIndexItem>();
      for (const it of mapped) if (!uniq.has(it.wpUserId)) uniq.set(it.wpUserId, it);
      setClientIndex(Array.from(uniq.values()));
    } catch {
      setClientIndex([]);
    } finally {
      setIndexLoading(false);
    }
  };

  useEffect(() => {
    aliveRef.current = true;
    loadAll('full');

    return () => {
      aliveRef.current = false;
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // when client loaded — load index for its site
  useEffect(() => {
    const sid = String((client as any)?.siteId || '');
    if (!sid) return;
    loadClientIndex(sid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(client as any)?.siteId]);

  useEffect(() => {
    if (!clientId) return;

    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }

    const tick = () => {
      if (!isVisibleNow()) return;
      if (editOpen || txnEdit || trEdit || txnCreateOpen || trCreateOpen) return;
      if (inFlightRef.current) return;

      const sinceOk = Date.now() - (lastOkRef.current || 0);
      if (sinceOk < POLL_MS * 0.6) return;

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
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, editOpen, txnEdit, trEdit, txnCreateOpen, trCreateOpen]);

  /* ===================== view fields ===================== */

  const viewBalanceEur = useMemo(() => {
    if (!client) return '0';
    return String((client as any).balanceEur ?? pickMeta(client, ['ccp_acc_eur_balance', 'ccp_balance_eur']) ?? '0');
  }, [client, t]);

  const viewBalanceUsd = useMemo(() => {
    if (!client) return '0';
    return String((client as any).balanceUsd ?? pickMeta(client, ['ccp_acc_usd_balance', 'ccp_balance_usd']) ?? '0');
  }, [client]);

  const viewAccEur = useMemo(() => {
    if (!client) return '';
    return String((client as any).accountEur ?? pickMeta(client, ['ccp_acc_eur_number', 'accEurNumber', 'ccp_acc_eur']) ?? '');
  }, [client]);

  const viewAccUsd = useMemo(() => {
    if (!client) return '';
    return String((client as any).accountUsd ?? pickMeta(client, ['ccp_acc_usd_number', 'accUsdNumber', 'ccp_acc_usd']) ?? '');
  }, [client]);

  const viewIbanEur = useMemo(() => {
    if (!client) return '';
    return String((client as any).ibanEur ?? pickMeta(client, ['ccp_iban_eur']) ?? '');
  }, [client]);

  const viewIbanUsd = useMemo(() => {
    if (!client) return '';
    return String((client as any).ibanUsd ?? pickMeta(client, ['ccp_iban_usd']) ?? '');
  }, [client]);

  const currentBalance = useMemo(() => {
    return {
      EUR: toNumberMoney(viewBalanceEur),
      USD: toNumberMoney(viewBalanceUsd),
    };
  }, [viewBalanceEur, viewBalanceUsd]);

  const totals = useMemo(() => {
    const tx = txns?.items || [];
    const eurSpent = tx.reduce((a, t: any) => a + toNumberMoney(t?.spendEur ?? 0), 0);
    const usdSpent = tx.reduce((a, t: any) => a + toNumberMoney(t?.spendUsd ?? 0), 0);
    return { eurSpent, usdSpent };
  }, [txns?.items]);

  const title = useMemo(() => {
    if (!client) return t('crm.clientAccountDetails.title');
    return (
      (client as any).name ||
      (client as any).email ||
      t('crm.clientAccountDetails.clientFallback', { id: (client as any).wpUserId })
    );
  }, [client]);

  const txnsCount = txns?.total ?? txns?.items?.length ?? 0;
  const transfersCount = transfers?.total ?? transfers?.items?.length ?? 0;

  /* ===================== helpers: index lookups ===================== */

  const findClientByWpId = (wpUserId: number) => {
    const id = Number(wpUserId);
    if (!id) return null;
    return clientIndex.find((x) => x.wpUserId === id) || null;
  };

  const clientLabel = (c: ClientIndexItem | null) => {
    if (!c) return t('crm.common.empty');
    const nm = s(c.name) || s(c.email);
    return `${nm} · ${t('crm.clientAccounts.wpUserShort', { id: c.wpUserId })}`;
  };
  const wpUserLabel = (wpUserId: any) => {
  const id = Number(wpUserId || 0);
  if (!id) return t('crm.common.empty');
  const c = findClientByWpId(id);
  if (!c) return t('crm.clientAccounts.wpUserShort', { id });
  return `${s(c.name) || s(c.email)} · ${t('crm.clientAccounts.wpUserShort', { id })}`;
  };

  /* ===================== balances patching (UI workaround) ===================== */

  const patchClientBalances = async (clientIdToPatch: string, next: { EUR?: number; USD?: number }) => {
    // патчим как в твоём ClientAccountsPage (NEW + LEGACY)
    const eurNext = next.EUR;
    const usdNext = next.USD;

    const dto: any = { meta: {} as any };
    if (eurNext !== undefined) {
      dto.meta.ccp_acc_eur_balance = eurNext;
      dto.meta.ccp_balance_eur = eurNext;
    }
    if (usdNext !== undefined) {
      dto.meta.ccp_acc_usd_balance = usdNext;
      dto.meta.ccp_balance_usd = usdNext;
    }
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

    setEur(String(viewBalanceEur ?? '0'));
    setUsd(String(viewBalanceUsd ?? '0'));
    setAccEurNumber(String(viewAccEur ?? ''));
    setAccUsdNumber(String(viewAccUsd ?? ''));
    setIbanEur(String(viewIbanEur ?? ''));
    setIbanUsd(String(viewIbanUsd ?? ''));

    setEditOpen(true);
  };

  const saveClient = async () => {
    if (!client) return;

    setSavingClient(true);
    setErr('');

    try {
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

      const updated = await ccpApi.updateClient((client as any).id, dto as any);
      const full = await ccpApi.client((updated as any).id);
      setClient(full);

      setEditOpen(false);
      await loadAll('tables');
    } catch (e: any) {
      setErr(e?.message || t('crm.clientAccountDetails.errors.clientSaveFailed'));
    } finally {
      setSavingClient(false);
    }
  };

  /* ===================== TXN: create/update with balance control ===================== */

  const createTxn = async (patch: {
  title?: string;
  desc?: string;
  date?: string;
  currency: 'EUR' | 'USD';
  amount: string;
  ccpStatus?: string;
  }) => {
  if (!client) return;
  setTxnSaving(true);
  setErr('');

  try {
    const sid = String((client as any).siteId);
    const wpUserId = Number((client as any).wpUserId);
    const cur = patch.currency;
    const amt = toNumberMoney(patch.amount);

    const available = cur === 'EUR' ? currentBalance.EUR : currentBalance.USD;
    if (amt <= 0) throw new Error(t('crm.clientAccountDetails.errors.amountPositive'));
    if (amt > available) throw new Error(t('crm.clientAccountDetails.errors.insufficientFunds'));

    const amtStr = moneyToString(amt);

    await (ccpApi as any).createTxn(sid, {
      wpUserId,
      title: patch.title || '',
      desc: patch.desc || '',
      date: patch.date || '',
      currency: cur,
      amount: amtStr,

      // ✅ ДОБАВИЛИ: чтобы backend/WP точно записали расход
      spendEur: cur === 'EUR' ? amtStr : '0',
      spendUsd: cur === 'USD' ? amtStr : '0',

      status: 'publish',
      ccpStatus: patch.ccpStatus || 'In progress',
    });

    await applyBalanceDelta(String((client as any).id), cur, -amt);

    setTxnCreateOpen(false);
    await loadAll('full');
  } catch (e: any) {
    setErr(e?.message || t('crm.clientAccountDetails.errors.txnCreateFailed'));
  } finally {
    setTxnSaving(false);
  }
  };

  const saveTxn = async (row: CcpTxn, patch: Partial<CcpTxn>) => {
  if (!client) return;
  setTxnSaving(true);
  setErr('');

  try {
    const oldEur = toNumberMoney((row as any).spendEur ?? 0);
    const oldUsd = toNumberMoney((row as any).spendUsd ?? 0);

    const newEur = toNumberMoney(
      (patch as any).spendEur ?? (row as any).spendEur ?? 0
    );
    const newUsd = toNumberMoney(
      (patch as any).spendUsd ?? (row as any).spendUsd ?? 0
    );

    const deltaEur = newEur - oldEur;
    const deltaUsd = newUsd - oldUsd;

    if (deltaEur > 0 && deltaEur > currentBalance.EUR) {
      throw new Error(t('crm.clientAccountDetails.errors.insufficientFundsEur'));
    }
    if (deltaUsd > 0 && deltaUsd > currentBalance.USD) {
      throw new Error(t('crm.clientAccountDetails.errors.insufficientFundsUsd'));
    }

    const payload: any = {
      title: (patch as any).title ?? (row as any).title ?? '',
      status: (patch as any).status ?? (row as any).status ?? 'publish',
      meta: {
        // 🔴 КРИТИЧНО: без этого wpUserId = 0 и операция "пропадает"
        ccp_user_id: Number(
          (row as any).wpUserId ??
          (client as any).wpUserId ??
          0
        ),

        // суммы операции
        ccp_spend_eur: newEur,
        ccp_spend_usd: newUsd,

        // данные операции
        ccp_date: String((patch as any).date ?? (row as any).date ?? ''),
        ccp_desc: String((patch as any).desc ?? (row as any).desc ?? ''),
        ccp_status: String(
          (patch as any).ccpStatus ??
          (row as any).ccpStatus ??
          'In progress'
        ),
      },
    };

    await (ccpApi as any).updateTxn(
      (row as any).siteId,
      (row as any).wpPostId,
      payload
    );

    // обновляем баланс клиента
    if (deltaEur !== 0) {
      await applyBalanceDelta(String((client as any).id), 'EUR', -deltaEur);
    }
    if (deltaUsd !== 0) {
      await applyBalanceDelta(String((client as any).id), 'USD', -deltaUsd);
    }

    setTxnEdit(null);
    await loadAll('full');
  } catch (e: any) {
    setErr(e?.message || t('crm.clientAccountDetails.errors.txnSaveFailed'));
  } finally {
    setTxnSaving(false);
  }
};

  /* ===================== TRANSFER: create/update with proper meta keys + balances ===================== */

  const readTransferFields = (tr: any) => {
    // читаем и NEW и legacy
    const amount = tr.amount ?? tr.meta?.ccp_tr_amount ?? '';
    const fromCur =
      s(tr.fromCurrency) ||
      s(tr.meta?.ccp_tr_from_cur) || // ✅ NEW
      s(tr.meta?.ccp_tr_from_currency) ||
      '';
    const toCur =
      s(tr.toCurrency) ||
      s(tr.meta?.ccp_tr_to_cur) || // ✅ NEW
      s(tr.meta?.ccp_tr_to_currency) ||
      s(tr.currency) ||
      s(tr.meta?.ccp_tr_currency) ||
      '';
    const rate = tr.rate ?? tr.meta?.ccp_tr_rate ?? '';
    const credited = tr.credited ?? tr.meta?.ccp_tr_credited ?? '';
    const desc = tr.desc ?? tr.meta?.ccp_tr_desc ?? tr.meta?.ccp_tr_description ?? '';
    const note = tr.note ?? tr.meta?.ccp_tr_note ?? '';
    return { amount, fromCur, toCur, rate, credited, desc, note };
  };

  const createTransfer = async (patch: {
    toWpUserId: number;
    fromCurrency: 'EUR' | 'USD';
    toCurrency: 'EUR' | 'USD';
    amount: string;
    rate: string;
    date?: string;
    desc?: string;
    ccpStatus?: string;
  }) => {
    if (!client) return;
    setTrSaving(true);
    setErr('');

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

      const fromCur = patch.fromCurrency;
      const toCur = patch.toCurrency;
      const available = fromCur === 'EUR' ? currentBalance.EUR : currentBalance.USD;
      if (amt > available) throw new Error(t('crm.clientAccountDetails.errors.transferInsufficient'));

      const credited = amt * (rate || 1);

      await (ccpApi as any).createTransfer(sid, {
        fromUserId: fromWp,
        toUserId: toWp,
        fromCurrency: fromCur,
        toCurrency: toCur,
        amount: moneyToString(amt),
        rate: moneyToString(rate || 1),
        date: patch.date || '',
        desc: patch.desc || '',
        ccpStatus: patch.ccpStatus || 'In progress',
      });

      // UI-workaround: списываем у отправителя и начисляем получателю
      await applyBalanceDelta(String((client as any).id), fromCur, -amt);
      await applyBalanceDelta(String(toClient.id), toCur, +credited);

      setTrCreateOpen(false);
      await loadAll('full');
    } catch (e: any) {
      setErr(e?.message || t('crm.clientAccountDetails.errors.transferCreateFailed'));
    } finally {
      setTrSaving(false);
    }
  };

  const saveTransfer = async (row: CcpTransfer, patch: any) => {
    if (!client) return;
    setTrSaving(true);
    setErr('');

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
      if (!fromClient || !toClient) {
        throw new Error(t('crm.clientAccountDetails.errors.transferParticipantsNotFound'));
      }

      // контроль остатка: если итоговое списание у отправителя увеличится — проверяем
      // делаем безопасно: “откат” старого + применение нового
      // проверка делается по текущему балансу отправителя
      // (это UI-check; backend всё равно должен валидировать)
      if (newAmount <= 0) throw new Error(t('crm.clientAccountDetails.errors.amountPositive'));

      // если это текущий просмотренный клиент и он является отправителем — проверяем по его балансу
      if (Number((client as any).wpUserId) === fromWp) {
        // с учётом того, что старое списание могло быть в другой валюте
        // доступно = текущий баланс + старое списание (если валюта совпадает)
        const availableNow = newFromCur === 'EUR' ? currentBalance.EUR : currentBalance.USD;
        const back = oldFromCur === newFromCur ? oldAmount : 0;
        const effectiveAvailable = availableNow + back;
        if (newAmount > effectiveAvailable) throw new Error(t('crm.clientAccountDetails.errors.transferInsufficient'));
      }

      // ✅ правильные meta-ключи под UpdateCcpTransferDto (NEW + LEGACY)
      const payload: any = {
        title: s(patch.title ?? (row as any).title ?? ''),
        status: s(patch.status ?? (row as any).status ?? ''),
        meta: {
          ccp_tr_amount: newAmount,

          // ✅ NEW KEYS (важно!)
          ccp_tr_from_cur: newFromCur,
          ccp_tr_to_cur: newToCur,
          ccp_tr_rate: newRate,
          ccp_tr_desc: s(patch.desc ?? old.desc ?? ''),

          // legacy + совместимость (оставляем)
          ccp_tr_currency: (patch.currency ?? (row as any).currency ?? newToCur) as any,
          ccp_tr_from_user: fromWp,
          ccp_tr_to_user: toWp,
          ccp_tr_date: s(patch.date ?? (row as any).date ?? ''),
          ccp_tr_note: s(patch.note ?? old.note ?? ''),
          ccp_tr_status: s(patch.ccpStatus ?? (row as any).ccpStatus ?? ''),
        },
      };

      await (ccpApi as any).updateTransfer(sid, wpPostId, payload);

      // UI-workaround: откатываем старые изменения баланса и применяем новые
      // sender: +oldAmount (вернуть), затем -newAmount (списать) в соответствующих валютах
      await applyBalanceDelta(String(fromClient.id), oldFromCur, +oldAmount);
      await applyBalanceDelta(String(fromClient.id), newFromCur, -newAmount);

      // receiver: -oldCredited (откат), затем +newCredited (начислить)
      await applyBalanceDelta(String(toClient.id), oldToCur, -oldCredited);
      await applyBalanceDelta(String(toClient.id), newToCur, +newCredited);

      setTrEdit(null);
      await loadAll('full');
    } catch (e: any) {
      setErr(e?.message || t('crm.clientAccountDetails.errors.transferSaveFailed'));
    } finally {
      setTrSaving(false);
    }
  };

  /* ===================== render ===================== */

  return (
    <MainLayout>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {t('crm.clientAccountDetails.sectionLabel')}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-50">{title}</h1>
            {loadingTables ? <Pill tone="warn">{t('crm.clientAccountDetails.updating')}</Pill> : null}
          </div>

          <div className="mt-1 text-xs text-slate-400">
            {site?.siteHost ? (
              <>
                {t('crm.clientAccountDetails.siteLabel')}{' '}
                <span className="text-slate-200">{(site as any).siteHost}</span>
              </>
            ) : (
              <>
                {t('crm.clientAccountDetails.siteLabel')}{' '}
                <span className="text-slate-500">{t('crm.common.empty')}</span>
              </>
            )}
            {(client as any)?.wpUserId ? (
              <>
                {' '}
                · {t('crm.clientAccountDetails.wpUserIdLabel')}{' '}
                <span className="text-slate-200">{(client as any).wpUserId}</span>
              </>
            ) : null}
            <span className="mx-2 text-slate-700">•</span>
            {indexLoading ? (
              <span>{t('crm.clientAccountDetails.clientsLoading')}</span>
            ) : (
              <span>{t('crm.clientAccountDetails.clientsCount', { count: clientIndex.length || 0 })}</span>
            )}
          </div>

          <div className="mt-2">
            <Link
              to="/app/client-accounts"
              className="text-[11px] text-slate-400 underline underline-offset-2 hover:text-slate-100"
            >
              {t('crm.clientAccountDetails.backToList')}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SoftButton tone="primary" onClick={() => loadAll('full')}>
            {t('crm.clientAccountDetails.refresh')}
          </SoftButton>
          <SoftButton tone="primary" onClick={openEditClient} disabled={!client}>
            {t('crm.clientAccountDetails.edit')}
          </SoftButton>
        </div>
      </div>

      {err ? (
        <div className="mb-4 rounded-2xl border border-rose-900/40 bg-rose-950/30 p-4 text-xs text-rose-200">
          {err}
        </div>
      ) : null}

      {loading && (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6 text-xs text-slate-400">
          {t('crm.clientAccountDetails.loading')}
        </div>
      )}

      {!loading && client && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {t('crm.clientAccountDetails.cards.eurAccount')}
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-50">
                {viewAccEur || <span className="text-slate-500">{t('crm.common.empty')}</span>}
              </div>

              <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {t('crm.clientAccountDetails.cards.eurBalance')}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-50">{fmtMoney(viewBalanceEur)} €</div>

              <div className="mt-2 text-xs text-slate-400">
                {t('crm.clientAccountDetails.cards.iban')}{' '}
                <span className="text-slate-200">{viewIbanEur || t('crm.common.empty')}</span>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                {t('crm.clientAccountDetails.cards.spent')}{' '}
                <span className="text-slate-300">{fmtMoney(totals.eurSpent)} €</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {t('crm.clientAccountDetails.cards.usdAccount')}
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-50">
                {viewAccUsd || <span className="text-slate-500">{t('crm.common.empty')}</span>}
              </div>

              <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {t('crm.clientAccountDetails.cards.usdBalance')}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-50">{fmtMoney(viewBalanceUsd)} $</div>

              <div className="mt-2 text-xs text-slate-400">
                {t('crm.clientAccountDetails.cards.iban')}{' '}
                <span className="text-slate-200">{viewIbanUsd || t('crm.common.empty')}</span>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                {t('crm.clientAccountDetails.cards.spent')}{' '}
                <span className="text-slate-300">{fmtMoney(totals.usdSpent)} $</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {t('crm.clientAccountDetails.cards.contacts')}
              </div>
              <div className="mt-2 text-sm font-medium text-slate-50">{(client as any).name || t('crm.common.empty')}</div>
              <div className="mt-1 text-xs text-slate-300">{(client as any).email}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>
                  {t('crm.clientAccountDetails.cards.updatedAt', {
                    date: (client as any).updatedAt ? new Date((client as any).updatedAt).toLocaleString() : t('crm.common.empty'),
                  })}
                </span>
                <Pill tone="neutral">{t('crm.clientAccountDetails.cards.txnsCount', { count: txnsCount })}</Pill>
                <Pill tone="neutral">{t('crm.clientAccountDetails.cards.transfersCount', { count: transfersCount })}</Pill>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* TXNS */}
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold text-slate-100">{t('crm.clientAccountDetails.txns.title')}</div>
                  <SoftButton tone="soft" onClick={() => setTxnCreateOpen(true)} disabled={!client}>
                    {t('crm.clientAccountDetails.txns.create')}
                  </SoftButton>
                </div>
                <div className="text-[11px] text-slate-500">
                  {loadingTables
                    ? t('crm.clientAccountDetails.tables.loading')
                    : t('crm.clientAccountDetails.tables.recordsCount', { count: txnsCount })}
                </div>
              </div>

              <div className="overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950">
                    <tr className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-5 py-3">{t('crm.clientAccountDetails.txns.headers.date')}</th>
                      <th className="px-5 py-3">{t('crm.clientAccountDetails.txns.headers.title')}</th>
                      <th className="px-5 py-3">EUR</th>
                      <th className="px-5 py-3">USD</th>
                      <th className="px-5 py-3">{t('crm.clientAccountDetails.txns.headers.status')}</th>
                      <th className="px-5 py-3 text-right">{t('crm.clientAccountDetails.txns.headers.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(txns?.items || []).map((txn: any) => (
                      <tr key={txn.id} className="border-t border-slate-900">
                        <td className="px-5 py-3 text-slate-300 whitespace-nowrap">{fmtDate(txn.date)}</td>
                        <td className="px-5 py-3 text-slate-100">
                          <div className="font-medium">{txn.title || `#${txn.wpPostId}`}</div>
                          {txn.desc ? <div className="mt-1 text-[11px] text-slate-400 line-clamp-2">{txn.desc}</div> : null}
                        </td>
                        <td className="px-5 py-3 text-slate-200 whitespace-nowrap">{fmtMoney(txn.spendEur || '0')}</td>
                        <td className="px-5 py-3 text-slate-200 whitespace-nowrap">{fmtMoney(txn.spendUsd || '0')}</td>
                        <td className="px-5 py-3">
                          <Pill tone={statusTone(txn.ccpStatus || txn.status) as any}>
                            {humanStatus(txn.ccpStatus || txn.status, t)}
                          </Pill>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setTxnEdit(txn)}
                            className="text-[11px] text-slate-300 underline underline-offset-2 hover:text-white"
                          >
                            {t('crm.common.edit')}
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!loadingTables && (!txns || (txns.items || []).length === 0) ? (
                      <tr className="border-t border-slate-900">
                        <td colSpan={6} className="px-5 py-6 text-center text-slate-500">
                          {t('crm.clientAccountDetails.txns.empty')}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TRANSFERS */}
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold text-slate-100">{t('crm.clientAccountDetails.transfers.title')}</div>
                  <SoftButton tone="soft" onClick={() => setTrCreateOpen(true)} disabled={!client}>
                    {t('crm.clientAccountDetails.transfers.create')}
                  </SoftButton>
                </div>
                <div className="text-[11px] text-slate-500">
                  {loadingTables
                    ? t('crm.clientAccountDetails.tables.loading')
                    : t('crm.clientAccountDetails.tables.recordsCount', { count: transfersCount })}
                </div>
              </div>

              <div className="overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950">
                    <tr className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-5 py-3">{t('crm.clientAccountDetails.transfers.headers.date')}</th>
                      <th className="px-5 py-3">{t('crm.clientAccountDetails.transfers.headers.from')}</th>
                      <th className="px-5 py-3">{t('crm.clientAccountDetails.transfers.headers.to')}</th>
                      <th className="px-5 py-3">{t('crm.clientAccountDetails.transfers.headers.amount')}</th>
                      <th className="px-5 py-3">{t('crm.clientAccountDetails.transfers.headers.rate')}</th>
                      <th className="px-5 py-3">{t('crm.clientAccountDetails.transfers.headers.credited')}</th>
                      <th className="px-5 py-3">{t('crm.clientAccountDetails.transfers.headers.status')}</th>
                      <th className="px-5 py-3 text-right">{t('crm.clientAccountDetails.transfers.headers.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(transfers?.items || []).map((tr: any) => {
                      const f = readTransferFields(tr);
                      const fromCur = s(f.fromCur);
                      const toCur = s(f.toCur);
                      const amount = f.amount;
                      const rate = f.rate;
                      const credited = f.credited;

                      const sumLabel = `${fmtMoney(amount || '0')} ${toCur || tr.currency || '—'}`;

                      return (
                        <tr key={tr.id} className="border-t border-slate-900">
                          <td className="px-5 py-3 text-slate-300 whitespace-nowrap">{fmtDate(tr.date)}</td>
                            <td className="px-5 py-3 text-slate-200 whitespace-nowrap">
                              {wpUserLabel(tr.fromUserId)} {fromCur ? <span className="text-slate-500">({fromCur})</span> : null}
                            </td>
                            <td className="px-5 py-3 text-slate-200 whitespace-nowrap">
                              {wpUserLabel(tr.toUserId)} {toCur ? <span className="text-slate-500">({toCur})</span> : null}
                            </td>
                          <td className="px-5 py-3 text-slate-100 whitespace-nowrap">
                            <span className="font-medium">{sumLabel}</span>
                            {f.note ? <div className="mt-1 text-[11px] text-slate-400 line-clamp-2">{f.note}</div> : null}
                          </td>
                          <td className="px-5 py-3 text-slate-200 whitespace-nowrap">{rate ? fmtMoney(rate) : '—'}</td>
                          <td className="px-5 py-3 text-slate-200 whitespace-nowrap">{credited ? fmtMoney(credited) : '—'}</td>
                          <td className="px-5 py-3">
                            <Pill tone={statusTone(tr.ccpStatus || tr.status) as any}>
                              {humanStatus(tr.ccpStatus || tr.status, t)}
                            </Pill>
                          </td>
                          <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setTrEdit(tr)}
                            className="text-[11px] text-slate-300 underline underline-offset-2 hover:text-white"
                          >
                            {t('crm.common.edit')}
                          </button>
                        </td>
                      </tr>
                      );
                    })}

                    {!loadingTables && (!transfers || (transfers.items || []).length === 0) ? (
                      <tr className="border-t border-slate-900">
                        <td colSpan={8} className="px-5 py-6 text-center text-slate-500">
                          {t('crm.clientAccountDetails.transfers.empty')}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===================== MODALS ===================== */}

      {editOpen && client ? (
        <ModalShell
          title={t('crm.clientAccountDetails.editClient.title')}
          subtitle={t('crm.clientAccountDetails.editClient.subtitle')}
          busy={savingClient}
          onClose={() => setEditOpen(false)}
          onSave={saveClient}
          saveLabel={t('crm.common.save')}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('crm.clientAccountDetails.editClient.balanceEur')} value={eur} onChange={setEur} placeholder="0" />
            <Field label={t('crm.clientAccountDetails.editClient.balanceUsd')} value={usd} onChange={setUsd} placeholder="0" />

            <Field
              label={t('crm.clientAccountDetails.editClient.accountEur')}
              value={accEurNumber}
              onChange={setAccEurNumber}
              placeholder="EUR-xxxx-xxxx"
            />
            <Field
              label={t('crm.clientAccountDetails.editClient.accountUsd')}
              value={accUsdNumber}
              onChange={setAccUsdNumber}
              placeholder="USD-xxxx-xxxx"
            />

            <Field label={t('crm.clientAccountDetails.editClient.ibanEur')} value={ibanEur} onChange={setIbanEur} placeholder="TR.." />
            <Field label={t('crm.clientAccountDetails.editClient.ibanUsd')} value={ibanUsd} onChange={setIbanUsd} placeholder="TR.." />
          </div>
        </ModalShell>
      ) : null}

      {txnCreateOpen && client ? (
        <TxnCreateModal
          busy={txnSaving}
          balanceEur={currentBalance.EUR}
          balanceUsd={currentBalance.USD}
          onClose={() => setTxnCreateOpen(false)}
          onCreate={createTxn}
        />
      ) : null}

      {txnEdit ? (
        <TxnEditModal
          row={txnEdit}
          busy={txnSaving}
          balanceEur={currentBalance.EUR}
          balanceUsd={currentBalance.USD}
          onClose={() => setTxnEdit(null)}
          onSave={(patch) => saveTxn(txnEdit, patch)}
        />
      ) : null}

      {trCreateOpen && client ? (
        <TransferCreateModal
          busy={trSaving}
          sender={{
            id: String((client as any).id),
            wpUserId: Number((client as any).wpUserId),
            email: String((client as any).email || ''),
            name: (client as any).name ?? null,
          }}
          indexLoading={indexLoading}
          clientIndex={clientIndex}
          balanceEur={currentBalance.EUR}
          balanceUsd={currentBalance.USD}
          onClose={() => setTrCreateOpen(false)}
          onCreate={createTransfer}
        />
      ) : null}

      {trEdit ? (
        <TransferEditModal
          row={trEdit}
          busy={trSaving}
          indexLoading={indexLoading}
          clientIndex={clientIndex}
          onClose={() => setTrEdit(null)}
          onSave={(patch) => saveTransfer(trEdit, patch)}
        />
      ) : null}
    </MainLayout>
  );
};

export default ClientAccountDetailsPage;

/* ===================== Create/Edit Modals ===================== */

const TxnCreateModal: React.FC<{
  busy: boolean;
  balanceEur: number;
  balanceUsd: number;
  onClose: () => void;
  onCreate: (patch: {
    title?: string;
    desc?: string;
    date?: string;
    currency: 'EUR' | 'USD';
    amount: string;
    ccpStatus?: string;
  }) => void;
}> = ({ busy, balanceEur, balanceUsd, onClose, onCreate }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [ccpStatus, setCcpStatus] = useState('In progress');
  const [date, setDate] = useState(todayYmd());
  const [currency, setCurrency] = useState<'EUR' | 'USD'>('EUR');
  const [amount, setAmount] = useState('0');
  const [desc, setDesc] = useState('');

  const ccpStatusOptions = useMemo(
    () => [
      { value: 'In progress', label: t('crm.clientAccountDetails.ccpStatus.inProgress') },
      { value: 'Done', label: t('crm.clientAccountDetails.ccpStatus.done') },
      { value: 'Rejected', label: t('crm.clientAccountDetails.ccpStatus.rejected') },
      { value: 'Insufficient funds', label: t('crm.clientAccountDetails.ccpStatus.insufficient') },
    ],
    [t]
  );

  const amt = toNumberMoney(amount);
  const available = currency === 'EUR' ? balanceEur : balanceUsd;
  const ok = amt > 0 && amt <= available;

  return (
    <ModalShell
      title={t('crm.clientAccountDetails.txnCreate.title')}
      subtitle={t('crm.clientAccountDetails.txnCreate.subtitle')}
      busy={busy}
      onClose={onClose}
      onSave={() => onCreate({ title, desc, date, currency, amount, ccpStatus })}
      saveLabel={t('crm.clientAccountDetails.txnCreate.save')}
      saveDisabled={!ok}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field
          label={t('crm.clientAccountDetails.txnCreate.nameLabel')}
          value={title}
          onChange={setTitle}
          placeholder={t('crm.clientAccountDetails.txnCreate.namePlaceholder')}
        />
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {t('crm.clientAccountDetails.labels.ccpStatus')}
          </div>
          <select
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
            value={ccpStatus}
            onChange={(e) => setCcpStatus(e.target.value)}
          >
            {ccpStatusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <Field label={t('crm.clientAccountDetails.labels.date')} value={date} onChange={setDate} placeholder="YYYY-MM-DD" />

        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {t('crm.clientAccountDetails.labels.currency')}
          </div>
          <select
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as any)}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
          <div className="mt-1 text-[11px] text-slate-500">
            {t('crm.clientAccountDetails.labels.available', { amount: fmtMoney(available) })}
          </div>
        </div>

        <Field
          label={t('crm.clientAccountDetails.labels.amount')}
          value={amount}
          onChange={setAmount}
          rightHint={
            !ok ? (
              <span className="text-rose-300">
                {amt <= 0
                  ? t('crm.clientAccountDetails.txnCreate.amountHintPositive')
                  : t('crm.clientAccountDetails.txnCreate.amountHintInsufficient')}
              </span>
            ) : (
              <span className="text-emerald-300">{t('crm.common.ok')}</span>
            )
          }
        />

        <div className="md:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {t('crm.clientAccountDetails.labels.description')}
          </div>
          <textarea
            className="mt-2 w-full min-h-[90px] rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={t('crm.clientAccountDetails.txnCreate.descPlaceholder')}
          />
        </div>
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
  const [status, setStatus] = useState((row as any).status || '');
  const [ccpStatus, setCcpStatus] = useState((row as any).ccpStatus || '');
  const [date, setDate] = useState((row as any).date || '');
  const [desc, setDesc] = useState((row as any).desc || '');
  const [eur, setEur] = useState(String((row as any).spendEur ?? '0'));
  const [usd, setUsd] = useState(String((row as any).spendUsd ?? '0'));

  const ccpStatusOptions = useMemo(
    () => [
      { value: 'In progress', label: t('crm.clientAccountDetails.ccpStatus.inProgress') },
      { value: 'Done', label: t('crm.clientAccountDetails.ccpStatus.done') },
      { value: 'Rejected', label: t('crm.clientAccountDetails.ccpStatus.rejected') },
      { value: 'Insufficient funds', label: t('crm.clientAccountDetails.ccpStatus.insufficient') },
    ],
    [t]
  );

  const wpStatusOptions = useMemo(
    () => [
      { value: 'publish', label: t('crm.clientAccountDetails.wpStatus.publish') },
      { value: 'draft', label: t('crm.clientAccountDetails.wpStatus.draft') },
      { value: 'pending', label: t('crm.clientAccountDetails.wpStatus.pending') },
      { value: 'private', label: t('crm.clientAccountDetails.wpStatus.private') },
    ],
    [t]
  );

  const oldE = toNumberMoney((row as any).spendEur ?? 0);
  const oldU = toNumberMoney((row as any).spendUsd ?? 0);
  const newE = toNumberMoney(eur);
  const newU = toNumberMoney(usd);

  const deltaE = newE - oldE;
  const deltaU = newU - oldU;

  const ok = !(deltaE > 0 && deltaE > balanceEur) && !(deltaU > 0 && deltaU > balanceUsd);

  return (
    <ModalShell
      title={t('crm.clientAccountDetails.txnEdit.title', { id: (row as any).wpPostId })}
      subtitle={t('crm.clientAccountDetails.txnEdit.subtitle')}
      busy={busy}
      onClose={onClose}
      onSave={() =>
        onSave({
          title,
          status,
          ccpStatus,
          date,
          desc,
          spendEur: eur as any,
          spendUsd: usd as any,
        } as any)
      }
      saveLabel={t('crm.common.save')}
      saveDisabled={!ok}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t('crm.clientAccountDetails.txnEdit.nameLabel')} value={title} onChange={setTitle} />
        <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {t('crm.clientAccountDetails.labels.wpStatus')}
            </div>
            <select
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
              value={status || 'publish'}
              onChange={(e) => setStatus(e.target.value)}
            >
              {wpStatusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {t('crm.clientAccountDetails.labels.ccpStatus')}
            </div>
            <select
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
              value={ccpStatus || 'In progress'}
              onChange={(e) => setCcpStatus(e.target.value)}
            >
              {ccpStatusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        <Field label={t('crm.clientAccountDetails.labels.date')} value={date} onChange={setDate} placeholder="YYYY-MM-DD" />

        <Field
          label={t('crm.clientAccountDetails.txnEdit.spendEur')}
          value={eur}
          onChange={setEur}
          rightHint={
            deltaE > 0 && deltaE > balanceEur ? (
              <span className="text-rose-300">{t('crm.clientAccountDetails.txnEdit.insufficient')}</span>
            ) : (
              <span className="text-slate-500">Δ {fmtMoney(deltaE)}</span>
            )
          }
        />
        <Field
          label={t('crm.clientAccountDetails.txnEdit.spendUsd')}
          value={usd}
          onChange={setUsd}
          rightHint={
            deltaU > 0 && deltaU > balanceUsd ? (
              <span className="text-rose-300">{t('crm.clientAccountDetails.txnEdit.insufficient')}</span>
            ) : (
              <span className="text-slate-500">Δ {fmtMoney(deltaU)}</span>
            )
          }
        />

        <div className="md:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {t('crm.clientAccountDetails.labels.description')}
          </div>
          <textarea
            className="mt-2 w-full min-h-[90px] rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={t('crm.clientAccountDetails.txnEdit.descPlaceholder')}
          />
        </div>
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
  onCreate: (patch: {
    toWpUserId: number;
    fromCurrency: 'EUR' | 'USD';
    toCurrency: 'EUR' | 'USD';
    amount: string;
    rate: string;
    date?: string;
    desc?: string;
    ccpStatus?: string;
  }) => void;
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

  const ccpStatusOptions = useMemo(
    () => [
      { value: 'In progress', label: t('crm.clientAccountDetails.ccpStatus.inProgress') },
      { value: 'Done', label: t('crm.clientAccountDetails.ccpStatus.done') },
      { value: 'Rejected', label: t('crm.clientAccountDetails.ccpStatus.rejected') },
      { value: 'Insufficient funds', label: t('crm.clientAccountDetails.ccpStatus.insufficient') },
    ],
    [t]
  );

  const suggestions = useMemo(() => {
    const qq = s(q).toLowerCase();
    if (qq.length < 2) return [];
    return clientIndex
      .filter((c) => c.wpUserId !== sender.wpUserId)
      .filter((c) => (c.email || '').toLowerCase().includes(qq) || (c.name || '').toLowerCase().includes(qq))
      .slice(0, 8);
  }, [q, clientIndex, sender.wpUserId]);

  const available = fromCur === 'EUR' ? balanceEur : balanceUsd;
  const amt = toNumberMoney(amount);
  const rt = Math.max(0, toNumberMoney(rate || 1));
  const credited = amt * (rt || 1);

  const ok = !!pickedWpId && amt > 0 && amt <= available;

  const picked = pickedWpId ? clientIndex.find((x) => x.wpUserId === pickedWpId) || null : null;

  return (
    <ModalShell
      title={t('crm.clientAccountDetails.transferCreate.title')}
      subtitle={t('crm.clientAccountDetails.transferCreate.subtitle')}
      busy={busy}
      onClose={onClose}
      onSave={() =>
        onCreate({
          toWpUserId: Number(pickedWpId),
          fromCurrency: fromCur,
          toCurrency: toCur,
          amount,
          rate,
          date,
          desc,
          ccpStatus,
        })
      }
      saveLabel={t('crm.clientAccountDetails.transferCreate.save')}
      saveDisabled={!ok}
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
          {t('crm.clientAccountDetails.transferCreate.senderLabel')}{' '}
          <span className="text-slate-100 font-semibold">{sender.name || sender.email}</span> · WP#{sender.wpUserId}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {t('crm.clientAccountDetails.transferCreate.recipientSearchLabel')}
          </div>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
            placeholder={
              indexLoading
                ? t('crm.clientAccountDetails.transferCreate.recipientPlaceholderLoading')
                : t('crm.clientAccountDetails.transferCreate.recipientPlaceholder')
            }
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPickedWpId(null);
            }}
            disabled={indexLoading}
          />
          {picked ? (
            <div className="mt-2 text-xs text-emerald-300">
              {t('crm.clientAccountDetails.transferCreate.recipientChosen', {
                name: picked.name || picked.email,
                id: picked.wpUserId,
              })}
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-500">{t('crm.clientAccountDetails.transferCreate.recipientHint')}</div>
          )}

          {!indexLoading && suggestions.length > 0 ? (
            <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-2">
              {suggestions.map((c) => (
                <button
                  key={c.wpUserId}
                  className="w-full text-left rounded-xl px-3 py-2 hover:bg-slate-900/60"
                  onClick={() => {
                    setPickedWpId(c.wpUserId);
                    setQ(c.email);
                  }}
                >
                  <div className="text-sm text-slate-100">{c.name || c.email}</div>
                  <div className="text-[11px] text-slate-500">{c.email} · WP#{c.wpUserId}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {t('crm.clientAccountDetails.labels.ccpStatus')}
            </div>
            <select
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
              value={ccpStatus}
              onChange={(e) => setCcpStatus(e.target.value)}
            >
              {ccpStatusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <Field label={t('crm.clientAccountDetails.labels.date')} value={date} onChange={setDate} placeholder="YYYY-MM-DD" />

          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {t('crm.clientAccountDetails.transferCreate.fromCurrency')}
            </div>
            <select
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
              value={fromCur}
              onChange={(e) => setFromCur(e.target.value as any)}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
            <div className="mt-1 text-[11px] text-slate-500">
              {t('crm.clientAccountDetails.labels.available', { amount: fmtMoney(available) })}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {t('crm.clientAccountDetails.transferCreate.toCurrency')}
            </div>
            <select
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
              value={toCur}
              onChange={(e) => setToCur(e.target.value as any)}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
            <div className="mt-1 text-[11px] text-slate-500">
              {t('crm.clientAccountDetails.transferCreate.credited', { amount: fmtMoney(credited), currency: toCur })}
            </div>
          </div>

          <Field
            label={t('crm.clientAccountDetails.labels.amount')}
            value={amount}
            onChange={setAmount}
            rightHint={
              !ok ? (
                <span className="text-rose-300">
                  {amt <= 0
                    ? t('crm.clientAccountDetails.transferCreate.amountHintPositive')
                    : amt > available
                    ? t('crm.clientAccountDetails.transferCreate.amountHintInsufficient')
                    : t('crm.clientAccountDetails.transferCreate.amountHintRecipient')}
                </span>
              ) : (
                <span className="text-emerald-300">{t('crm.common.ok')}</span>
              )
            }
          />
          <Field label={t('crm.clientAccountDetails.labels.rate')} value={rate} onChange={setRate} placeholder="1" />

          <div className="md:col-span-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {t('crm.clientAccountDetails.labels.description')}
            </div>
            <textarea
              className="mt-2 w-full min-h-[90px] rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={t('crm.clientAccountDetails.transferCreate.descPlaceholder')}
            />
          </div>
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

    const fromCurrency =
      (row as any).fromCurrency ??
      (row as any).meta?.ccp_tr_from_cur ??
      (row as any).meta?.ccp_tr_from_currency ??
      'EUR';

    const toCurrency =
      (row as any).toCurrency ??
      (row as any).meta?.ccp_tr_to_cur ??
      (row as any).meta?.ccp_tr_to_currency ??
      (row as any).currency ??
      (row as any).meta?.ccp_tr_currency ??
      'EUR';

    const desc = (row as any).desc ?? (row as any).meta?.ccp_tr_desc ?? (row as any).meta?.ccp_tr_description ?? '';
    const note = (row as any).note ?? (row as any).meta?.ccp_tr_note ?? '';

    return { amount, rate, fromCurrency, toCurrency, desc, note };
  }, [row]);

  const [title, setTitle] = useState((row as any).title || '');
  const [status, setStatus] = useState((row as any).status || '');
  const [ccpStatus, setCcpStatus] = useState((row as any).ccpStatus || '');
  const [date, setDate] = useState((row as any).date || '');

  const [fromUserId, setFromUserId] = useState(String((row as any).fromUserId ?? ''));
  const [toUserId, setToUserId] = useState(String((row as any).toUserId ?? ''));

  const ccpStatusOptions = useMemo(
    () => [
      { value: 'In progress', label: t('crm.clientAccountDetails.ccpStatus.inProgress') },
      { value: 'Done', label: t('crm.clientAccountDetails.ccpStatus.done') },
      { value: 'Rejected', label: t('crm.clientAccountDetails.ccpStatus.rejected') },
      { value: 'Insufficient funds', label: t('crm.clientAccountDetails.ccpStatus.insufficient') },
    ],
    [t]
  );

  const wpStatusOptions = useMemo(
    () => [
      { value: 'publish', label: t('crm.clientAccountDetails.wpStatus.publish') },
      { value: 'draft', label: t('crm.clientAccountDetails.wpStatus.draft') },
      { value: 'pending', label: t('crm.clientAccountDetails.wpStatus.pending') },
      { value: 'private', label: t('crm.clientAccountDetails.wpStatus.private') },
    ],
    [t]
  );

  const [fromCurrency, setFromCurrency] = useState(String(initial.fromCurrency || 'EUR'));
  const [toCurrency, setToCurrency] = useState(String(initial.toCurrency || 'EUR'));

  const [amount, setAmount] = useState(String(initial.amount ?? '0'));
  const [rate, setRate] = useState(String(initial.rate ?? '1'));

  const [desc, setDesc] = useState(String(initial.desc ?? ''));
  const [note, setNote] = useState(String(initial.note ?? ''));

  const fromWp = Number(fromUserId || 0);
  const toWp = Number(toUserId || 0);
  const fromClient = fromWp ? clientIndex.find((x) => x.wpUserId === fromWp) || null : null;
  const toClient = toWp ? clientIndex.find((x) => x.wpUserId === toWp) || null : null;

  const cannotResolveParticipants = (!!fromWp && !fromClient) || (!!toWp && !toClient);

  return (
    <ModalShell
      title={t('crm.clientAccountDetails.transferEdit.title', { id: (row as any).wpPostId })}
      subtitle={t('crm.clientAccountDetails.transferEdit.subtitle')}
      busy={busy}
      onClose={onClose}
      onSave={() =>
        onSave({
          title,
          status,
          ccpStatus,
          date,
          fromUserId: fromWp,
          toUserId: toWp,
          fromCurrency,
          toCurrency,
          amount,
          rate,
          desc,
          note,
          currency: toCurrency,
        })
      }
      saveLabel={t('crm.common.save')}
      saveDisabled={indexLoading || cannotResolveParticipants || toNumberMoney(amount) <= 0}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t('crm.clientAccountDetails.transferEdit.nameLabel')} value={title} onChange={setTitle} />
        <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {t('crm.clientAccountDetails.labels.wpStatus')}
            </div>
            <select
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
              value={status || 'publish'}
              onChange={(e) => setStatus(e.target.value)}
            >
              {wpStatusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {t('crm.clientAccountDetails.labels.ccpStatus')}
            </div>
            <select
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
              value={ccpStatus || 'In progress'}
              onChange={(e) => setCcpStatus(e.target.value)}
            >
              {ccpStatusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        <Field label={t('crm.clientAccountDetails.labels.date')} value={date} onChange={setDate} placeholder="YYYY-MM-DD" />

        <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
          {indexLoading ? (
            <>{t('crm.clientAccountDetails.transferEdit.participantsLoading')}</>
          ) : (
            <>
              {t('crm.clientAccountDetails.transferEdit.senderLabel')}{' '}
              <span className="text-slate-200">
                {fromClient
                  ? `${fromClient.name || fromClient.email} · WP#${fromClient.wpUserId}`
                  : fromWp
                  ? t('crm.clientAccountDetails.transferEdit.userMissing', { id: fromWp })
                  : t('crm.common.empty')}
              </span>
              <span className="mx-2 text-slate-700">•</span>
              {t('crm.clientAccountDetails.transferEdit.recipientLabel')}{' '}
              <span className="text-slate-200">
                {toClient
                  ? `${toClient.name || toClient.email} · WP#${toClient.wpUserId}`
                  : toWp
                  ? t('crm.clientAccountDetails.transferEdit.userMissing', { id: toWp })
                  : t('crm.common.empty')}
              </span>
            </>
          )}
        </div>

        <Field
          label={t('crm.clientAccountDetails.transferEdit.fromUserId')}
          value={fromUserId}
          onChange={setFromUserId}
          placeholder={t('crm.clientAccountDetails.transferEdit.userIdPlaceholder', { id: 123 })}
        />
        <Field
          label={t('crm.clientAccountDetails.transferEdit.toUserId')}
          value={toUserId}
          onChange={setToUserId}
          placeholder={t('crm.clientAccountDetails.transferEdit.userIdPlaceholder', { id: 456 })}
        />

        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {t('crm.clientAccountDetails.transferEdit.fromCurrency')}
          </div>
          <select
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {t('crm.clientAccountDetails.transferEdit.toCurrency')}
          </div>
          <select
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value)}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <Field label={t('crm.clientAccountDetails.labels.amount')} value={amount} onChange={setAmount} />
        <Field label={t('crm.clientAccountDetails.labels.rate')} value={rate} onChange={setRate} placeholder="1" />

        <div className="md:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {t('crm.clientAccountDetails.transferEdit.descLabel')}
          </div>
          <textarea
            className="mt-2 w-full min-h-[90px] rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={t('crm.clientAccountDetails.transferEdit.descPlaceholder')}
          />
        </div>

        <div className="md:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {t('crm.clientAccountDetails.transferEdit.noteLabel')}
          </div>
          <textarea
            className="mt-2 w-full min-h-[90px] rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('crm.clientAccountDetails.transferEdit.notePlaceholder')}
          />
        </div>

        {cannotResolveParticipants ? (
          <div className="md:col-span-2 rounded-2xl border border-rose-900/40 bg-rose-950/30 p-3 text-xs text-rose-200">
            {t('crm.clientAccountDetails.transferEdit.participantsMissing')}
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
};
