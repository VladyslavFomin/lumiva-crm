// src/pages/client-accounts/ClientAccountsPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { ccpApi, CcpClient, CcpSite, CcpTxn, CcpTransfer } from '../../api/ccp';

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
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  }
  return ss;
}
function shortId(id: any) {
  const ss = s(id);
  if (ss.length <= 10) return ss;
  return ss.slice(0, 6) + '…' + ss.slice(-4);
}

function humanStatus(v: any, t: (key: string) => string) {
  const vv = s(v).toLowerCase();
  if (!vv) return t('crm.clientAccounts.status.unknown');
  if (vv === 'done' || vv === 'completed' || vv === 'success' || vv.includes('выполн')) {
    return t('crm.clientAccounts.status.done');
  }
  if (vv === 'draft' || vv.includes('чернов')) return t('crm.clientAccounts.status.draft');
  if (vv === 'publish' || vv === 'published' || vv.includes('опублик')) return t('crm.clientAccounts.status.published');
  if (vv === 'pending' || vv === 'in_progress' || vv.includes('ожида')) return t('crm.clientAccounts.status.inProgress');
  if (vv === 'failed' || vv === 'error' || vv.includes('ошиб')) return t('crm.clientAccounts.status.failed');
  const orig = s(v);
  return orig.length > 1 ? orig[0].toUpperCase() + orig.slice(1) : orig.toUpperCase();
}

function statusBadge(status?: string | null) {
  const vv = s(status).toLowerCase();
  const base =
    'inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]';
  if (vv.includes('done') || vv.includes('completed') || vv.includes('success') || vv.includes('выполн')) {
    return cx(base, 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200');
  }
  if (vv.includes('reject') || vv.includes('cancel') || vv.includes('fail') || vv.includes('ошиб')) {
    return cx(base, 'border-rose-500/30 bg-rose-500/10 text-rose-200');
  }
  if (vv.includes('progress') || vv.includes('pending') || vv.includes('hold') || vv.includes('check')) {
    return cx(base, 'border-amber-500/30 bg-amber-500/10 text-amber-200');
  }
  return cx(base, 'border-slate-700 bg-slate-900/60 text-slate-300');
}

type Tab = 'overview' | 'txns' | 'transfers';

const ClientAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const [sites, setSites] = useState<CcpSite[]>([]);
  const [siteId, setSiteId] = useState<string>('');
  const [search, setSearch] = useState('');

  const [loadingList, setLoadingList] = useState(false);
  const [clients, setClients] = useState<CcpClient[]>([]);
  const [selected, setSelected] = useState<CcpClient | null>(null);

  const [txns, setTxns] = useState<CcpTxn[]>([]);
  const [transfers, setTransfers] = useState<CcpTransfer[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [tab, setTab] = useState<Tab>('overview');

  const [editing, setEditing] = useState(false);
  const [eur, setEur] = useState('');
  const [usd, setUsd] = useState('');
  const [accEurNumber, setAccEurNumber] = useState('');
  const [accUsdNumber, setAccUsdNumber] = useState('');
  const [ibanEur, setIbanEur] = useState('');
  const [ibanUsd, setIbanUsd] = useState('');
  const [saving, setSaving] = useState(false);

  const detailsReqRef = useRef(0);
  const fullReqRef = useRef(0);

  // wpUserId -> label (чтобы “WP#3” заменялось на имя/email когда возможно)
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

  const loadList = async () => {
    try {
      setLoadingList(true);
      const res = await ccpApi.clients({
        siteId: siteId || undefined,
        search: search || undefined,
        page: 1,
        per: 80,
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

      const [t1, t2] = await Promise.all([
        ccpApi.txns({ siteId: c.siteId, wpUserId: c.wpUserId, page: 1, per: 200 } as any),
        ccpApi.transfers({ siteId: c.siteId, wpUserId: c.wpUserId, page: 1, per: 200 } as any),
      ]);

      if (reqId !== detailsReqRef.current) return;

      setTxns(pickItems<CcpTxn>(t1));
      setTransfers(pickItems<CcpTransfer>(t2));
    } catch {
      if (reqId !== detailsReqRef.current) return;
      setTxns([]);
      setTransfers([]);
    } finally {
      if (reqId !== detailsReqRef.current) return;
      setLoadingDetails(false);
    }
  };

  // ✅ ДОЗАГРУЗКА ПОЛНОГО КЛИЕНТА (на случай если лист отдаёт урезанные поля)
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

  // при смене selected — подгрузить full + сбросить edit
  useEffect(() => {
    if (!selected?.id) return;
    setEditing(false);
    loadFullClient(String((selected as any).id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // когда selected обновился — заполнить форму + загрузить активность
  useEffect(() => {
    if (!selected) return;

    // ✅ У тебя в API поля клиента такие: balanceEur/balanceUsd + accountEur/accountUsd + ibanEur/ibanUsd
    setEur(String((selected as any).balanceEur ?? '0'));
    setUsd(String((selected as any).balanceUsd ?? '0'));

    // ✅ ВАЖНО: “СЧЁТ” = accountEur/accountUsd (не accEurNumber)
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

  const saveClient = async () => {
    if (!selected) return;

    try {
      setSaving(true);

      // ✅ DTO СТРОГО под твой UpdateCcpClientDto
      const dto = {
        meta: {
          // NEW
          ccp_acc_eur_balance: toNumberMoney(eur),
          ccp_acc_usd_balance: toNumberMoney(usd),
          ccp_acc_eur_number: s(accEurNumber),
          ccp_acc_usd_number: s(accUsdNumber),

          // если нужно
          ccp_iban_eur: s(ibanEur) || undefined,
          ccp_iban_usd: s(ibanUsd) || undefined,

          // LEGACY (оставляем для совместимости)
          ccp_balance_eur: toNumberMoney(eur),
          ccp_balance_usd: toNumberMoney(usd),
        },
      };

      const updated = await ccpApi.updateClient(selected.id, dto);

      // после сохранения — перезагрузим full (чтобы точно увидеть, что WP вернул)
      const full = await ccpApi.client(updated.id);

      setSelected(full);
      setClients((prev) => prev.map((x) => (x.id === full.id ? full : x)));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const refreshAll = async () => {
    await loadList();
    if (selected) await loadDetails(selected);
  };

  return (
    <MainLayout>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('crm.clientAccounts.title')}</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">{t('crm.clientAccounts.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            className="rounded-2xl !bg-slate-900 px-4 py-2 text-xs font-semibold !text-white shadow-sm hover:!bg-slate-800"
          >
            {t('crm.clientAccounts.refresh')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 h-auto min-h-0 lg:h-[calc(100vh-220px)] lg:min-h-[560px]">
        {/* LEFT */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-3 rounded-3xl border border-slate-800 bg-slate-950/60 overflow-hidden flex flex-col max-h-[70vh] lg:max-h-none">
          <div className="p-4 border-b border-slate-800">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {t('crm.clientAccounts.sitesLabel')}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <select
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
              >
                {sites.map((ss) => (
                  <option key={ss.id} value={ss.id}>
                    {(ss as any).siteHost || (ss as any).siteUrl}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {t('crm.clientAccounts.searchLabel')}
              </div>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                placeholder={t('crm.clientAccounts.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingList && (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 animate-pulse">
                    <div className="h-3 w-2/3 bg-slate-800 rounded" />
                    <div className="mt-2 h-3 w-1/2 bg-slate-800 rounded" />
                  </div>
                ))}
              </div>
            )}

            {!loadingList && clients.length === 0 && (
              <div className="p-6 text-sm text-slate-500">{t('crm.clientAccounts.clientsEmpty')}</div>
            )}

            {!loadingList && clients.length > 0 && (
              <div className="p-3 space-y-2">
                {clients.map((c) => {
                  const active = selected?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className={cx(
                        'w-full text-left rounded-2xl border p-3 transition-colors',
                        active ? 'border-sky-500/40 bg-sky-500/10' : 'border-slate-800 bg-slate-950/40 hover:bg-slate-900/60'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={cx('text-sm font-semibold truncate', active ? 'text-slate-50' : 'text-slate-200')}>
                            {(c as any).name || (c as any).email}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 truncate">{(c as any).email}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-[11px] text-slate-400">WP</div>
                          <div className="text-xs font-semibold text-slate-200">#{(c as any).wpUserId}</div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">EUR</div>
                          <div className="text-sm font-semibold text-slate-100">{fmtMoney((c as any).balanceEur)}</div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">USD</div>
                          <div className="text-sm font-semibold text-slate-100">{fmtMoney((c as any).balanceUsd)}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 rounded-3xl border border-slate-800 bg-slate-950/60 overflow-hidden flex flex-col max-h-[70vh] lg:max-h-none">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
              {t('crm.clientAccounts.selectClient')}
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
                <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-slate-50 truncate">
                      {(selected as any).name || (selected as any).email}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {(selected as any).email} · {t('crm.clientAccounts.wpUser', { id: (selected as any).wpUserId })} · {siteName}
                      <span className="mx-2 text-slate-700">•</span>
                      {t('crm.clientAccounts.localId', { id: shortId((selected as any).id) })}
                      <span className="mx-2 text-slate-700">•</span>
                      <Link
                        to={`/app/client-accounts/${(selected as any).id}`}
                        className="text-slate-300 underline underline-offset-2 hover:text-white"
                      >
                        {t('crm.clientAccounts.openPage')}
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadDetails(selected)}
                      className="rounded-2xl !bg-slate-900 px-4 py-2 text-xs font-semibold !text-white hover:!bg-slate-800"
                    >
                      {t('crm.clientAccounts.refreshActivity')}
                    </button>

                    {!editing ? (
                      <button
                        onClick={() => setEditing(true)}
                        className="rounded-2xl !bg-slate-900 px-4 py-2 text-xs font-semibold !text-white hover:!bg-slate-800"
                      >
                        {t('crm.clientAccounts.edit')}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditing(false)}
                          className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900"
                        >
                          {t('crm.clientAccounts.cancel')}
                        </button>
                        <button
                          disabled={saving}
                          onClick={saveClient}
                          className="rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:opacity-90"
                        >
                          {saving ? t('crm.clientAccounts.saving') : t('crm.clientAccounts.save')}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="px-5 pb-4 flex items-center gap-2">
                  {(['overview', 'txns', 'transfers'] as Tab[]).map((tabKey) => (
                    <button
                      key={tabKey}
                      onClick={() => setTab(tabKey)}
                      className={cx(
                        'px-4 py-2 text-xs rounded-2xl border font-semibold',
                        tab === tabKey
                          ? 'bg-sky-500/10 border-sky-500/40 text-slate-50'
                          : 'border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-900/50'
                      )}
                    >
                      {tabKey === 'overview' && t('crm.clientAccounts.tabs.overview')}
                      {tabKey === 'txns' && t('crm.clientAccounts.tabs.txns', { count: txns.length })}
                      {tabKey === 'transfers' && t('crm.clientAccounts.tabs.transfers', { count: transfers.length })}
                    </button>
                  ))}

                  {loadingDetails && <div className="ml-auto text-xs text-slate-500">{t('crm.clientAccounts.loading')}</div>}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {tab === 'overview' && (
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 xl:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* EUR */}
                      <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                              {t('crm.clientAccounts.accounts.eur')}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-50">{fmtMoney(eur)} EUR</div>
                            <div className="mt-2 text-xs text-slate-400">
                              {t('crm.clientAccounts.accounts.spent')}: {fmtMoney(totals.eurSpent)} EUR
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-right">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                              {t('crm.clientAccounts.accounts.accountLabel')}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-200">{accEurNumber || '—'}</div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                            {t('crm.clientAccounts.accounts.balance')}
                          </div>
                          {editing ? (
                            <input
                              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                              value={eur}
                              onChange={(e) => setEur(e.target.value)}
                            />
                          ) : (
                            <div className="mt-2 text-sm text-slate-300">{fmtMoney(eur)}</div>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                              {t('crm.clientAccounts.accounts.accountNumber')}
                            </div>
                            {editing ? (
                              <input
                                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                                value={accEurNumber}
                                onChange={(e) => setAccEurNumber(e.target.value)}
                                placeholder={t('crm.clientAccounts.accounts.eurNumberPlaceholder')}
                              />
                            ) : (
                              <div className="mt-2 text-sm text-slate-200 break-words">{accEurNumber || '—'}</div>
                            )}
                          </div>

                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                              {t('crm.clientAccounts.accounts.iban')}
                            </div>
                            {editing ? (
                              <input
                                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                                value={ibanEur}
                                onChange={(e) => setIbanEur(e.target.value)}
                                placeholder={t('crm.clientAccounts.accounts.ibanPlaceholder')}
                              />
                            ) : (
                              <div className="mt-2 text-sm text-slate-200 break-words">{ibanEur || '—'}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* USD */}
                      <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                              {t('crm.clientAccounts.accounts.usd')}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-50">{fmtMoney(usd)} USD</div>
                            <div className="mt-2 text-xs text-slate-400">
                              {t('crm.clientAccounts.accounts.spent')}: {fmtMoney(totals.usdSpent)} USD
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-right">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                              {t('crm.clientAccounts.accounts.accountLabel')}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-200">{accUsdNumber || '—'}</div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                            {t('crm.clientAccounts.accounts.balance')}
                          </div>
                          {editing ? (
                            <input
                              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                              value={usd}
                              onChange={(e) => setUsd(e.target.value)}
                            />
                          ) : (
                            <div className="mt-2 text-sm text-slate-300">{fmtMoney(usd)}</div>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                              {t('crm.clientAccounts.accounts.accountNumber')}
                            </div>
                            {editing ? (
                              <input
                                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                                value={accUsdNumber}
                                onChange={(e) => setAccUsdNumber(e.target.value)}
                                placeholder={t('crm.clientAccounts.accounts.usdNumberPlaceholder')}
                              />
                            ) : (
                              <div className="mt-2 text-sm text-slate-200 break-words">{accUsdNumber || '—'}</div>
                            )}
                          </div>

                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                              {t('crm.clientAccounts.accounts.iban')}
                            </div>
                            {editing ? (
                              <input
                                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                                value={ibanUsd}
                                onChange={(e) => setIbanUsd(e.target.value)}
                                placeholder={t('crm.clientAccounts.accounts.ibanPlaceholder')}
                              />
                            ) : (
                              <div className="mt-2 text-sm text-slate-200 break-words">{ibanUsd || '—'}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-12 xl:col-span-5 space-y-4">
                      <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                          {t('crm.clientAccounts.quickStats')}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                              {t('crm.clientAccounts.txnsLabel')}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-50">{txns.length}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                              {t('crm.clientAccounts.transfersLabel')}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-50">{transfers.length}</div>
                          </div>
                        </div>

                        <div className="mt-4 text-sm text-slate-400">
                          {t('crm.clientAccounts.lastUpdated')}{' '}
                          <span className="text-slate-200">{fmtDate((selected as any).updatedAt)}</span>
                        </div>
                      </div>

                      
                    </div>
                  </div>
                )}

                {tab === 'txns' && (
                  <div className="space-y-3">
                    {txns.map((t: any) => (
                      <div key={t.id} className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-50 truncate">
                              {t.title || t('crm.clientAccounts.operationTitle', { id: t.wpPostId })}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {t('crm.clientAccounts.wpPostMeta', { id: t.wpPostId, date: fmtDate(t.date) })} ·{' '}
                              <span className={statusBadge(t.ccpStatus || t.status)}>
                                {humanStatus(t.ccpStatus || t.status, t)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-300">EUR: {fmtMoney(t.spendEur)}</div>
                            <div className="text-xs text-slate-300">USD: {fmtMoney(t.spendUsd)}</div>
                          </div>
                        </div>

                        {t.desc && (
                          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300 whitespace-pre-wrap">
                            {t.desc}
                          </div>
                        )}
                      </div>
                    ))}
                    {txns.length === 0 && <div className="text-sm text-slate-500">{t('crm.clientAccounts.txnsEmpty')}</div>}
                  </div>
                )}

                {tab === 'transfers' && (
                  <div className="space-y-3">
                    {transfers.map((tr: any) => {
                      const selectedWpId = Number((selected as any).wpUserId);

                      const fromId = tr.fromUserId ?? null;
                      const toId = tr.toUserId ?? null;

                      const fromLabel = fromId ? getUserLabel(fromId) : '—';
                      const toLabel = toId ? getUserLabel(toId) : '—';

                      // ✅ “получение/отправление” относительно выбранного клиента
                      let direction = t('crm.common.empty');
                      if (Number.isFinite(selectedWpId)) {
                        if (fromId === selectedWpId) direction = t('crm.clientAccounts.direction.sent');
                        else if (toId === selectedWpId) direction = t('crm.clientAccounts.direction.received');
                      }

                      const fromCur = s(tr.fromCurrency || tr.currency);
                      const toCur = s(tr.toCurrency || tr.currency);

                      const amount = tr.amount ?? '';
                      const rate = tr.rate ?? '';
                      const credited = tr.credited ?? '';

                      return (
                        <div key={tr.id} className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-50 truncate">
                                {tr.title || t('crm.clientAccounts.transferTitle', { id: tr.wpPostId })}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {t('crm.clientAccounts.wpPostMeta', { id: tr.wpPostId, date: fmtDate(tr.date) })} ·{' '}
                                <span className={statusBadge(tr.ccpStatus || tr.status)}>
                                  {humanStatus(tr.ccpStatus || tr.status, t)}
                                </span>
                              </div>

                              <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                    {t('crm.clientAccounts.direction.label')}
                                  </div>
                                  <div className="mt-2 text-sm font-semibold text-slate-50">{direction}</div>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 md:col-span-2">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                    {t('crm.clientAccounts.fromTo')}
                                  </div>
                                  <div className="mt-2 text-sm text-slate-200">
                                    {fromLabel} → {toLabel}
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                    {t('crm.clientAccounts.fromCurrency')}
                                  </div>
                                  <div className="mt-2 text-sm font-semibold text-slate-50">{fromCur || '—'}</div>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                    {t('crm.clientAccounts.toCurrency')}
                                  </div>
                                  <div className="mt-2 text-sm font-semibold text-slate-50">{toCur || '—'}</div>
                                </div>
                              </div>

                              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                    {t('crm.clientAccounts.amount')}
                                  </div>
                                  <div className="mt-2 text-sm font-semibold text-slate-50">
                                    {fmtMoney(amount)} {fromCur || '—'}
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                    {t('crm.clientAccounts.rate')}
                                  </div>
                                  <div className="mt-2 text-sm font-semibold text-slate-50">{rate ? fmtMoney(rate) : '—'}</div>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                    {t('crm.clientAccounts.credited')}
                                  </div>
                                  <div className="mt-2 text-sm font-semibold text-slate-50">
                                    {credited ? `${fmtMoney(credited)} ${toCur || '—'}` : '—'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="text-right text-xs text-slate-300">
                              {t('crm.clientAccounts.localId', { id: shortId(tr.id) })}
                            </div>
                          </div>

                          {tr.note && (
                            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300 whitespace-pre-wrap">
                              {tr.note}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {transfers.length === 0 && (
                      <div className="text-sm text-slate-500">{t('crm.clientAccounts.transfersEmpty')}</div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ClientAccountsPage;
