import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { ccpApi, type CcpClient, type CcpSite } from '../../api/ccp';
import { useAlertModal } from '../../contexts/AlertModalContext';

function cx(...c: Array<string | false | undefined | null>) {
  return c.filter(Boolean).join(' ');
}
function normalizeUrl(value: string) {
  const raw = value.trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}
function initials(name: string) {
  const parts = name.trim().split(/[\s._-]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
function fmtNum(v: number | string | null | undefined) {
  return Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pickItems<T>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.items)) return res.items;
  if (Array.isArray(res.data)) return res.data;
  return [];
}

type SiteForm = { siteUrl: string; wpRestBase: string; wpToken: string; isActive: boolean };
const emptyForm: SiteForm = { siteUrl: '', wpRestBase: '', wpToken: '', isActive: true };

type SiteStat = { clientCount: number; investedEur: number; investedUsd: number };

export default function ClientAccountSitesPage() {
  const { showConfirm } = useAlertModal();
  const [sites, setSites]       = useState<CcpSite[]>([]);
  const [clients, setClients]   = useState<CcpClient[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [message, setMessage]   = useState('');
  const [search, setSearch]     = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [createForm, setCreateForm]   = useState<SiteForm>(emptyForm);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editForm, setEditForm]       = useState<SiteForm>(emptyForm);
  const [copiedId, setCopiedId]       = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [sitesRes, clientsRes] = await Promise.allSettled([
        ccpApi.sites(),
        ccpApi.clients({ per: 1000 }),
      ]);
      setSites(sitesRes.status === 'fulfilled' ? (sitesRes.value || []) : []);
      setClients(clientsRes.status === 'fulfilled' ? pickItems<CcpClient>(clientsRes.value) : []);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const siteStats = useMemo<Map<string, SiteStat>>(() => {
    const map = new Map<string, SiteStat>();
    for (const s of sites) map.set(s.id, { clientCount: 0, investedEur: 0, investedUsd: 0 });
    for (const c of clients) {
      const st = map.get(c.siteId);
      if (st) {
        st.clientCount++;
        st.investedEur += Number(c.balanceEur || 0);
        st.investedUsd += Number(c.balanceUsd || 0);
      }
    }
    return map;
  }, [sites, clients]);

  // Sum only clients that belong to registered sites (matches what site cards show)
  const totalClients = useMemo(() => { let t = 0; for (const s of siteStats.values()) t += s.clientCount; return t; }, [siteStats]);
  const totalEur     = useMemo(() => { let t = 0; for (const s of siteStats.values()) t += s.investedEur; return t; }, [siteStats]);
  const totalUsd     = useMemo(() => { let t = 0; for (const s of siteStats.values()) t += s.investedUsd; return t; }, [siteStats]);

  const sortedSites = useMemo(
    () => [...sites].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
    [sites],
  );
  const filteredSites = useMemo(
    () => !search ? sortedSites : sortedSites.filter(s =>
      (s.siteHost || s.siteUrl || '').toLowerCase().includes(search.toLowerCase())
    ),
    [sortedSites, search],
  );

  const startEdit = (site: CcpSite) => {
    setEditingId(site.id);
    setShowAddForm(false);
    setEditForm({ siteUrl: site.siteUrl || '', wpRestBase: site.wpRestBase || '', wpToken: '', isActive: site.isActive !== false });
  };

  const saveCreate = async () => {
    const siteUrl = normalizeUrl(createForm.siteUrl);
    if (!siteUrl) { setError('Укажите URL сайта'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      const site = await ccpApi.addSite({ siteUrl });
      const wpRestBase = createForm.wpRestBase.trim();
      const wpToken    = createForm.wpToken.trim();
      if (wpRestBase || wpToken) {
        await ccpApi.updateSite(site.id, { wpRestBase: wpRestBase || undefined, wpToken: wpToken || undefined });
      }
      setCreateForm(emptyForm);
      setShowAddForm(false);
      setMessage('Сайт добавлен');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Не удалось добавить сайт');
    } finally { setSaving(false); }
  };

  const saveEdit = async (siteId: string) => {
    const siteUrl = normalizeUrl(editForm.siteUrl);
    if (!siteUrl) { setError('Укажите URL сайта'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      await ccpApi.updateSite(siteId, {
        siteUrl,
        wpRestBase: editForm.wpRestBase.trim() || null,
        wpToken:    editForm.wpToken.trim() || null,
        isActive:   editForm.isActive,
      });
      setEditingId(null);
      setMessage('Сайт обновлён');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Не удалось обновить сайт');
    } finally { setSaving(false); }
  };

  const deleteSite = async (site: CcpSite) => {
    const label = site.siteHost || site.siteUrl || site.id;
    const ok = await showConfirm(`Удалить сайт «${label}»? Данные клиентов не удалятся.`, {
      title: 'Удаление',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await ccpApi.deleteSite(site.id);
      setMessage('Сайт удалён');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Не удалось удалить сайт');
    } finally { setSaving(false); }
  };

  const copyId = async (id: string) => {
    try { await navigator.clipboard.writeText(id); } catch {}
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const activeSites  = sites.filter(s => s.isActive !== false);
  const offlineSites = sites.filter(s => s.isActive === false);

  const kpiCells = [
    {
      icon: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 010 18"/><path d="M12 3a14 14 0 000 18"/></>,
      label: 'Сайтов',
      value: sites.length,
      sub: `${activeSites.length} активных · ${offlineSites.length} офлайн`,
    },
    {
      icon: <><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 3-5.5 6-5.5s6 2.5 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M15 14.5c2.5 0 5 1.5 5 4"/></>,
      label: 'Клиентов всего',
      value: totalClients,
      sub: 'по всем сайтам',
    },
    {
      icon: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14" r="1.4" fill="currentColor"/></>,
      label: 'Инвестировано EUR',
      value: <>{fmtNum(totalEur)}<span className="text-[16px] font-normal text-[#999] ml-1">EUR</span></>,
      sub: 'суммарно по счетам',
    },
    {
      icon: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14" r="1.4" fill="currentColor"/></>,
      label: 'Инвестировано USD',
      value: <>{fmtNum(totalUsd)}<span className="text-[16px] font-normal text-[#999] ml-1">USD</span></>,
      sub: 'суммарно по счетам',
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between pb-5 border-b border-[#e7e7e7]">
          <div>
            <div className="cd-mono text-[10px] font-medium tracking-[0.18em] uppercase text-[#888] mb-1">
              Client accounts
            </div>
            <h1 className="cd-display text-[22px] font-semibold tracking-[-0.02em] text-[#222]">
              Сайты счетов
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Link
              to="/client-accounts"
              className="h-8 px-3 flex items-center rounded-[8px] border border-[#e7e7e7] bg-white cd-mono text-[11px] font-medium text-[#555] hover:bg-[#fafafa] transition-colors"
            >
              ← Счета
            </Link>
            <button
              type="button"
              onClick={load}
              className="h-8 px-3 flex items-center gap-1.5 rounded-[8px] border border-[#e7e7e7] bg-white cd-mono text-[11px] font-medium text-[#555] hover:bg-[#fafafa] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 4v5h-5"/>
              </svg>
              Обновить
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
              className={cx(
                'h-8 px-3 flex items-center gap-1.5 rounded-[8px] cd-mono text-[11px] font-semibold transition-colors',
                showAddForm
                  ? 'bg-[#fafafa] border border-[#e7e7e7] text-[#222]'
                  : 'bg-[#222] text-white hover:bg-[#1a1a1a]',
              )}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14"/><path d="M5 12h14"/>
              </svg>
              Подключить сайт
            </button>
          </div>
        </div>

        {/* ── KPI strip ────────────────────────────────────────────────── */}
        <div className="bg-white border border-[#e7e7e7] rounded-[12px] grid grid-cols-4 overflow-hidden">
          {kpiCells.map((cell, i) => (
            <div key={i} className={cx('px-5 py-4', i < 3 && 'border-r border-[#e7e7e7]')}>
              <div className="flex items-center gap-1.5 cd-mono text-[10px] font-medium tracking-[0.12em] uppercase text-[#888]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  {cell.icon}
                </svg>
                {cell.label}
              </div>
              <div className="cd-display text-[26px] font-semibold tracking-[-0.025em] text-[#222] leading-none mt-3">
                {cell.value}
              </div>
              <div className="cd-mono text-[11px] text-[#b5b5b5] mt-1.5">{cell.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Notifications ────────────────────────────────────────────── */}
        {error   && <div className="rounded-[10px] border border-[#f5c5cd] bg-[#fbecef] px-4 py-3 text-sm text-[#9a1f31]">{error}</div>}
        {message && <div className="rounded-[10px] border border-[#c5e3d2] bg-[#eaf4ee] px-4 py-3 text-sm text-[#175c3d]">{message}</div>}

        {/* ── Add site form ─────────────────────────────────────────────── */}
        {showAddForm && (
          <div className="bg-white border border-[#e7e7e7] rounded-[12px] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-[14px] text-[#222] tracking-[-0.01em]">Подключить новый сайт</div>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-[#b5b5b5] hover:text-[#222]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12"/><path d="M6 18L18 6"/></svg>
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <input
                className="h-9 rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 text-sm text-[#222] outline-none focus:border-[#222] focus:bg-white transition-colors"
                placeholder="https://example.com"
                value={createForm.siteUrl}
                onChange={e => setCreateForm(p => ({ ...p, siteUrl: e.target.value }))}
              />
              <input
                className="h-9 rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 text-sm text-[#222] outline-none focus:border-[#222] focus:bg-white transition-colors"
                placeholder="REST base, напр. /api/v1/crm"
                value={createForm.wpRestBase}
                onChange={e => setCreateForm(p => ({ ...p, wpRestBase: e.target.value }))}
              />
              <input
                className="h-9 rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 text-sm text-[#222] outline-none focus:border-[#222] focus:bg-white transition-colors"
                placeholder="Site REST token"
                value={createForm.wpToken}
                onChange={e => setCreateForm(p => ({ ...p, wpToken: e.target.value }))}
              />
              <button
                type="button"
                disabled={saving}
                onClick={saveCreate}
                className="h-9 px-4 rounded-[8px] bg-[#222] text-white cd-mono text-[11px] font-semibold hover:bg-[#1a1a1a] disabled:opacity-50 whitespace-nowrap transition-colors"
              >
                Добавить
              </button>
            </div>
            <p className="mt-3 text-[11px] text-[#888] leading-5">
              REST base и token можно заполнить позже — сайт добавится в список сразу.
            </p>
          </div>
        )}

        {/* ── Toolbar ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-[280px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b5b5b5]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>
            </svg>
            <input
              className="w-full h-9 pl-8 pr-3 rounded-[8px] border border-[#e7e7e7] bg-white text-sm text-[#222] placeholder-[#b5b5b5] outline-none focus:border-[#222] transition-colors"
              placeholder="Найти сайт по хосту…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex-1" />
          <span className="cd-mono text-[11px] text-[#888] tracking-[0.06em]">
            {loading ? '…' : `${filteredSites.length} САЙТОВ`}
          </span>
        </div>

        {/* ── Loading ──────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-sm text-[#888]">Загрузка…</div>
        )}

        {/* ── Site grid ────────────────────────────────────────────────── */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSites.map(site => {
              const stats = siteStats.get(site.id) || { clientCount: 0, investedEur: 0, investedUsd: 0 };
              const isOnline = site.isActive !== false;
              const editing  = editingId === site.id;
              const host     = site.siteHost || (site.siteUrl || '').replace(/^https?:\/\//, '');

              return (
                <div key={site.id} className="bg-white border border-[#e7e7e7] rounded-[12px] overflow-hidden flex flex-col">
                  {/* Card header */}
                  <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-[8px] bg-[#1f1f1f] text-white flex items-center justify-center flex-shrink-0 cd-mono text-[11px] font-bold tracking-tight">
                        {initials(host || 'S')}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[13.5px] text-[#222] truncate tracking-[-0.01em]">{host}</div>
                        <div className="flex items-center gap-1 cd-mono text-[10.5px] text-[#888] truncate mt-[1px]">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 010 18"/><path d="M12 3a14 14 0 000 18"/>
                          </svg>
                          {(site.siteUrl || '').replace(/^https?:\/\//, '')}
                        </div>
                      </div>
                    </div>
                    <span className={cx(
                      'flex items-center gap-1.5 px-[9px] py-[3px] rounded-full cd-mono text-[10px] font-medium border flex-shrink-0',
                      isOnline
                        ? 'border-[#c5e3d2] bg-[#eaf4ee] text-[#175c3d]'
                        : 'border-[#e7e7e7] bg-[#f5f5f5] text-[#888]',
                    )}>
                      <span className={cx('w-[5px] h-[5px] rounded-full', isOnline ? 'bg-[#1f8a5e]' : 'bg-[#ccc]')} />
                      {isOnline ? 'Онлайн' : 'Офлайн'}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 border-t border-[#f0f0f0] px-4 py-3 gap-2">
                    {[
                      { label: 'Клиентов', value: String(stats.clientCount), mono: false },
                      { label: 'REST API', value: site.wpRestBase ? 'v1 ✓' : '—', mono: true },
                      { label: 'EUR', value: fmtNum(stats.investedEur), mono: true },
                      { label: 'USD', value: fmtNum(stats.investedUsd), mono: true },
                    ].map(({ label, value, mono }) => (
                      <div key={label}>
                        <div className="cd-mono text-[9.5px] font-medium tracking-[0.08em] uppercase text-[#aaa]">{label}</div>
                        <div className={cx(
                          'text-[13px] font-semibold text-[#222] mt-1 truncate',
                          mono ? 'cd-mono' : '',
                        )}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-2 px-4 py-3 border-t border-[#f0f0f0] mt-auto">
                    <div className="flex items-center gap-1.5 cd-mono text-[10px] text-[#888] flex-1 min-w-0">
                      <span className="truncate font-mono text-[10.5px] text-[#aaa] tracking-tight">
                        {site.id.length > 16 ? `${site.id.slice(0, 8)}…${site.id.slice(-4)}` : site.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyId(site.id)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] border border-[#e7e7e7] text-[9.5px] hover:bg-[#fafafa] transition-colors flex-shrink-0"
                      >
                        {copiedId === site.id ? '✓' : 'copy'}
                      </button>
                    </div>
                    {!editing && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(site)}
                          className="h-7 px-2.5 rounded-[7px] border border-[#e7e7e7] cd-mono text-[10px] font-medium text-[#555] hover:bg-[#fafafa] transition-colors"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => deleteSite(site)}
                          className="h-7 px-2.5 rounded-[7px] border border-[#f0c8cf] cd-mono text-[10px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] disabled:opacity-50 transition-colors"
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Edit form (inline) */}
                  {editing && (
                    <div className="border-t border-[#e7e7e7] bg-[#fafafa] p-4">
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <label className="cd-mono text-[10px] font-medium text-[#888] uppercase tracking-[0.08em]">
                          URL сайта
                          <input
                            className="mt-1.5 block w-full h-8 rounded-[7px] border border-[#e7e7e7] bg-white px-3 text-sm text-[#222] outline-none focus:border-[#222] transition-colors"
                            value={editForm.siteUrl}
                            onChange={e => setEditForm(p => ({ ...p, siteUrl: e.target.value }))}
                          />
                        </label>
                        <label className="cd-mono text-[10px] font-medium text-[#888] uppercase tracking-[0.08em]">
                          REST base
                          <input
                            className="mt-1.5 block w-full h-8 rounded-[7px] border border-[#e7e7e7] bg-white px-3 text-sm text-[#222] outline-none focus:border-[#222] transition-colors"
                            value={editForm.wpRestBase}
                            onChange={e => setEditForm(p => ({ ...p, wpRestBase: e.target.value }))}
                          />
                        </label>
                        <label className="cd-mono text-[10px] font-medium text-[#888] uppercase tracking-[0.08em]">
                          Новый token
                          <input
                            className="mt-1.5 block w-full h-8 rounded-[7px] border border-[#e7e7e7] bg-white px-3 text-sm text-[#222] outline-none focus:border-[#222] transition-colors"
                            placeholder={site.wpToken ? 'Уже задан — введите новый для замены' : 'Site REST token'}
                            value={editForm.wpToken}
                            onChange={e => setEditForm(p => ({ ...p, wpToken: e.target.value }))}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-sm text-[#555] mt-2">
                          <input
                            type="checkbox"
                            checked={editForm.isActive}
                            onChange={e => setEditForm(p => ({ ...p, isActive: e.target.checked }))}
                            className="rounded"
                          />
                          Активен
                        </label>
                      </div>
                      <div className="flex justify-end gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="h-8 px-3 rounded-[7px] border border-[#e7e7e7] bg-white cd-mono text-[10px] font-medium text-[#555] hover:bg-[#fafafa] transition-colors"
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => saveEdit(site.id)}
                          className="h-8 px-3 rounded-[7px] bg-[#222] text-white cd-mono text-[10px] font-semibold hover:bg-[#1a1a1a] disabled:opacity-50 transition-colors"
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add site card */}
            <button
              type="button"
              onClick={() => { setShowAddForm(true); setEditingId(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex flex-col items-center justify-center gap-3 min-h-[180px] rounded-[12px] border-2 border-dashed border-[#e7e7e7] text-[#aaa] hover:border-[#222] hover:text-[#222] hover:bg-[#fafafa] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#f0f0f0] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14"/><path d="M5 12h14"/>
                </svg>
              </div>
              <div>
                <div className="font-semibold text-[13px] tracking-[-0.01em]">Подключить сайт</div>
                <div className="cd-mono text-[10px] mt-0.5">WordPress + плагин CCP</div>
              </div>
            </button>
          </div>
        )}

        {!loading && filteredSites.length === 0 && !showAddForm && (
          <div className="py-16 text-center text-sm text-[#888]">
            {search ? `Сайты по запросу «${search}» не найдены` : 'Пока нет подключённых сайтов'}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
