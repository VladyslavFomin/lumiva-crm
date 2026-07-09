import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { ccpApi, type CcpClient, type CcpSite, type CcpTransfer, type CcpTxn } from '../../api/ccp';

function cx(...c: Array<string | false | undefined | null>) {
  return c.filter(Boolean).join(' ');
}
function s(value: unknown) {
  return String(value ?? '').trim();
}
function fmtMoney(value: unknown) {
  const n = Number(s(value).replace(/\s+/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return s(value) || '0';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(value: unknown) {
  const raw = s(value);
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: '2-digit' });
}
function pickItems<T>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res.items)) return res.items as T[];
  if (Array.isArray(res.data?.items)) return res.data.items as T[];
  return [];
}
function initials(name: string) {
  return (name || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p: string) => p[0]).join('').toUpperCase();
}

/* Extract recipient name from WP comment like "Перевод средств пользователю Имя Фамилия" */
function recipientFromComment(comment: string | null | undefined): string | null {
  if (!comment) return null;
  const m = comment.match(/пользователю\s+(.+)/i);
  if (m) return m[1].trim();
  if (/transfer to user/i.test(comment)) return null; // generic, not useful
  return null;
}
function humanStatus(value: unknown) {
  const v = s(value).toLowerCase();
  if (!v) return '—';
  if (['done', 'completed', 'success', 'accepted'].includes(v) || /выполн|опубл|publish/.test(v)) return 'Выполнено';
  if (['pending', 'in_progress', 'in progress', 'processing'].includes(v) || /ожида|чернов|draft/.test(v)) return 'В процессе';
  if (['rejected', 'cancelled', 'canceled', 'failed', 'error'].includes(v) || /ошиб|reject|cancel|fail/.test(v)) return 'Ошибка';
  return s(value);
}
function operationTitle(row: any, fallback: string) {
  const type = s(row.type || row.transactionType || row.meta?.transactionType || row.meta?.transactionTypeId);
  const title = s(row.title);
  if (title && !/^\d+$/.test(title.trim())) return title;
  if (type === 'manual_adjustment' || type === '3') return 'Финансовая операция';
  if (type && !/^\d+$/.test(type.trim())) return type.replace(/_/g, ' ');
  return fallback;
}
function isTransferTxn(txn: any) {
  const category = s(txn.meta?.financialCategory).toLowerCase();
  const type = s(txn.type || txn.title).toLowerCase();
  return category === 'transfer' || type === 'transfer' || String(txn.meta?.transactionTypeId || '') === '4';
}
function clientSearchLabel(client: CcpClient) {
  const parts = [s(client.name), s(client.email)].filter(Boolean);
  return parts.length ? parts.join(' · ') : `WP#${client.wpUserId}`;
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
const StatusBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  const kind = statusKind(status);
  const { wrap, dot } = BADGE_STYLE[kind];
  return (
    <span className={cx('inline-flex items-center gap-[5px] rounded-full border px-[9px] py-[3px] text-[11px] font-medium', wrap)}>
      <span className={cx('w-[5px] h-[5px] rounded-full flex-shrink-0', dot)} />
      {humanStatus(status)}
    </span>
  );
};

const CURRENCY_OPTIONS = ['USD', 'EUR'];
const STATUS_OPTIONS = [
  { value: 'accepted', label: 'Accepted' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

type OperationRow = {
  id: string;
  kind: 'txn' | 'transfer';
  date: string | null;
  clientId: number | null;
  fromId: number | null;
  toId: number | null;
  title: string;
  amount: string;
  currency: string;
  rate?: string | null;
  credited?: string | null;
  status?: string | null;
  source: any;
  editable?: boolean;
  siteHost?: string;
};

/* WP creates 2 ccp_transfers per transfer (one per participant side).
   Sender's record has comment "пользователю X" (keep).
   Recipient's record has comment "от пользователя" (drop when paired with a sender's record). */
function deduplicateTransferRows(rows: OperationRow[]): OperationRow[] {
  const groups = new Map<string, OperationRow[]>();
  for (const r of rows) {
    const day = (r.date || '').slice(0, 10);
    // Normalize amount to integer cents to avoid "37200" vs "37200.00" mismatches
    const amtKey = String(Math.round(Number(r.amount) * 100));
    const key = `${amtKey}|${r.currency}|${day}|${r.siteHost ?? ''}`;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }

  const skipIds = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;

    // Case 1: some records have both fromId + toId in DB — they subsume partial records
    const complete = group.filter(r => r.fromId && r.toId);
    if (complete.length > 0) {
      for (const p of group.filter(r => !r.fromId || !r.toId)) {
        const pId = p.fromId || p.toId;
        if (complete.some(c => c.fromId === pId || c.toId === pId)) {
          skipIds.add(p.id);
        }
      }
      continue;
    }

    // Case 2: all partial — identify sender's view vs recipient's view by comment
    const comment = (r: OperationRow) => String((r.source as any)?.meta?.comment || '');
    const senderViews   = group.filter(r => /пользователю\s+\S/i.test(comment(r)));
    const recipientViews = group.filter(r => /от пользователя/i.test(comment(r)));

    if (senderViews.length > 0 && recipientViews.length > 0) {
      const toDrop = Math.min(senderViews.length, recipientViews.length);
      for (let i = 0; i < toDrop; i++) skipIds.add(recipientViews[i].id);
    }
  }

  return rows.filter(r => !skipIds.has(r.id));
}

export default function ClientFinancialOperationsPage() {
  const [sites, setSites] = useState<CcpSite[]>([]);
  const [siteId, setSiteId] = useState('');
  const [clients, setClients] = useState<CcpClient[]>([]);
  const [txns, setTxns] = useState<CcpTxn[]>([]);
  const [transfers, setTransfers] = useState<CcpTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingRow, setEditingRow] = useState<OperationRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'txn' | 'transfer'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
    ccpApi.sites()
      .then((res) => {
        if (!alive) return;
        setSites(res || []);
        if (res?.[0]?.id) setSiteId(res[0].id);
      })
      .catch((e: any) => setError(e?.message || 'Не удалось загрузить сайты'));
    return () => { alive = false; };
  }, []);

  const load = async () => {
    if (!siteId) return;
    setLoading(true);
    setError('');
    try {
      const [clientsRes, txnsRes, transfersRes] = await Promise.allSettled([
        ccpApi.clients({ siteId, page: 1, per: 500, fresh: 1 }),
        ccpApi.txns({ siteId, page: 1, per: 200, fresh: 1 }),
        ccpApi.transfers({ siteId, page: 1, per: 200, fresh: 1 }),
      ]);
      setClients(clientsRes.status === 'fulfilled' ? pickItems<CcpClient>(clientsRes.value) : []);
      setTxns(txnsRes.status === 'fulfilled' ? pickItems<CcpTxn>(txnsRes.value) : []);
      setTransfers(transfersRes.status === 'fulfilled' ? pickItems<CcpTransfer>(transfersRes.value) : []);
      if (txnsRes.status === 'rejected' && transfersRes.status === 'rejected') {
        setError('Не удалось загрузить операции и переводы');
      }
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить финансовые операции');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [siteId]);

  const siteHostMap = useMemo(() => {
    const m = new Map<string, string>();
    sites.forEach((site) => m.set(site.id, (site as any).siteHost || (site as any).siteUrl || site.id));
    return m;
  }, [sites]);

  const clientByWpId = useMemo(() => {
    const map = new Map<number, CcpClient>();
    clients.forEach((client: any) => {
      const id = Number(client.wpUserId);
      if (Number.isFinite(id) && id > 0) map.set(id, client);
    });
    return map;
  }, [clients]);

  /* Short display name only */
  const userLabelShort = (id: number | null) => {
    if (!id) return '—';
    const client: any = clientByWpId.get(id);
    return client ? (client.name || client.email) : `WP#${id}`;
  };

  /* Full label for edit modal */
  const userLabel = (id: number | null) => {
    if (!id) return '—';
    const client: any = clientByWpId.get(id);
    return client ? `${client.name || client.email} · WP#${id}` : `WP#${id}`;
  };

  const allRows = useMemo<OperationRow[]>(() => {
    /* WP creates 3 records per transfer: 1 Transfer post + 2 Txn posts (debit/credit).
       The Transfer post is canonical — show only it, drop all transfer-type txns. */
    const regularTxns = txns.filter((txn: any) => !isTransferTxn(txn));

    const txnRows = regularTxns
      .map((txn: any): OperationRow => {
        const usd = Number(txn.spendUsd || 0);
        const currency = Math.abs(usd) > 0 ? 'USD' : 'EUR';
        const amount = currency === 'USD' ? txn.spendUsd : txn.spendEur;
        return {
          id: txn.id,
          kind: 'txn',
          date: txn.date || txn.createdAt || null,
          clientId: Number(txn.wpUserId) || null,
          fromId: Number(txn.wpUserId) || null,
          toId: null,
          title: operationTitle(txn, `Операция #${txn.wpPostId}`),
          amount: s(amount || 0),
          currency,
          status: txn.ccpStatus || txn.status,
          source: txn,
          editable: true,
          siteHost: siteHostMap.get(String(txn.siteId || siteId)),
        };
      });

    const transferRows = transfers.flatMap((transfer: any): OperationRow[] => {
      /* ── FIX: resolve from/to without same-user fallback ── */
      const fromId = Number(
        transfer.fromUserId ??
        transfer.fromWpUserId ??
        transfer.fromExternalUserId ??
        transfer.senderWpUserId ??
        transfer.meta?.ccp_tr_from_user ??
        0
      ) || null;
      const toId = Number(
        transfer.toUserId ??
        transfer.toWpUserId ??
        transfer.toExternalUserId ??
        transfer.recipientWpUserId ??
        transfer.meta?.ccp_tr_to_user ??
        0
      ) || null;
      const participantId = Number(transfer.wpUserId ?? transfer.externalUserId ?? 0) || null;

      const resolvedFromId = fromId || participantId;
      /* Don't fall back toId to participantId — that would make sender = recipient */
      const resolvedToId = toId !== resolvedFromId ? toId : null;

      const isSelfTransfer = !!resolvedFromId && !!resolvedToId && resolvedFromId === resolvedToId;
      const isFinancialTransfer = s(transfer.meta?.financialCategory).toLowerCase() === 'transfer';
      if (isSelfTransfer && isFinancialTransfer) return [];

      return [{
        id: transfer.id,
        kind: 'transfer',
        date: transfer.date || transfer.createdAt || null,
        clientId: resolvedFromId || resolvedToId,
        fromId: resolvedFromId,
        toId: resolvedToId,
        title: operationTitle(transfer, `Перевод #${transfer.wpPostId}`),
        amount: s(transfer.amount || transfer.meta?.ccp_tr_amount || 0),
        currency: s(transfer.fromCurrency || transfer.meta?.ccp_tr_from_cur || transfer.currency || '—'),
        rate: transfer.rate || transfer.meta?.ccp_tr_rate,
        credited: transfer.credited || transfer.meta?.ccp_tr_credited,
        status: transfer.ccpStatus || transfer.meta?.ccp_tr_status || transfer.status,
        source: transfer,
        editable: true,
        siteHost: siteHostMap.get(String(transfer.siteId || siteId)),
      }];
    });

    return [...txnRows, ...deduplicateTransferRows(transferRows)].sort((a, b) => {
      const at = Date.parse(a.date || '') || 0;
      const bt = Date.parse(b.date || '') || 0;
      return bt - at;
    });
  }, [txns, transfers, siteHostMap, siteId]);

  const rows = useMemo(() => {
    return allRows.filter((row) => {
      if (typeFilter !== 'all') {
        if (typeFilter === 'txn' && row.kind !== 'txn') return false;
        if (typeFilter === 'transfer' && row.kind === 'txn') return false;
      }
      if (search) {
        const needle = search.toLowerCase();
        const haystack = (
          row.title + ' ' +
          userLabelShort(row.fromId) + ' ' +
          userLabelShort(row.toId)
        ).toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [allRows, typeFilter, search, clientByWpId]);

  const kpi = useMemo(() => {
    let eurTotal = 0, usdTotal = 0, txnCount = 0, trCount = 0, inProgress = 0;
    allRows.forEach((row) => {
      if (row.kind === 'txn') {
        txnCount++;
        if (row.currency === 'EUR') eurTotal += Number(row.amount || 0);
        if (row.currency === 'USD') usdTotal += Number(row.amount || 0);
        const st = statusKind(row.status);
        if (st === 'progress') inProgress++;
      } else {
        trCount++;
      }
    });
    return { eurTotal, usdTotal, txnCount, trCount, inProgress };
  }, [allRows]);

  const counts = useMemo(() => ({
    all: allRows.length,
    txn: allRows.filter((r) => r.kind === 'txn').length,
    transfer: allRows.filter((r) => r.kind !== 'txn').length,
  }), [allRows]);

  const saveRow = async (patch: any) => {
    if (!editingRow) return;
    setSaving(true);
    try {
      if (editingRow.kind === 'txn') {
        await ccpApi.updateTxn(editingRow.source.siteId, editingRow.source.wpPostId, {
          title: patch.title,
          status: editingRow.source.status || 'publish',
          meta: {
            ccp_user_id: Number(editingRow.source.wpUserId || 0),
            ccp_spend_eur: Number(patch.spendEur || 0),
            ccp_spend_usd: Number(patch.spendUsd || 0),
            ccp_date: patch.date,
            ccp_desc: patch.desc,
            ccp_status: patch.status,
          },
        });
      } else {
        await ccpApi.updateTransfer(editingRow.source.siteId, editingRow.source.wpPostId, {
          title: patch.title,
          status: editingRow.source.status || 'publish',
          meta: {
            ccp_tr_amount: Number(patch.amount || 0),
            ccp_tr_from_cur: patch.currency || 'USD',
            ccp_tr_to_cur: patch.toCurrency || patch.currency || 'USD',
            ccp_tr_rate: Number(patch.rate || 1),
            ccp_tr_desc: patch.desc,
            ccp_tr_from_user: Number(patch.fromId || 0),
            ccp_tr_to_user: Number(patch.toId || 0),
            ccp_tr_date: patch.date,
            ccp_tr_note: patch.note,
            ccp_tr_status: patch.status,
          },
        });
      }
      setEditingRow(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const currentSiteHost = siteHostMap.get(siteId) || '';

  return (
    <MainLayout>
      {/* ── Page header ── */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-[6px] h-[6px] rounded-full bg-[#222]" />
            <span className="cd-mono text-[10px] font-medium tracking-[0.18em] uppercase text-[#888]">
              CCP · Финансы
            </span>
          </div>
          <h1 className="cd-display text-[22px] font-semibold tracking-[-0.02em] text-[#222]">
            Финансовые операции
          </h1>
          <p className="mt-0.5 text-[13px] text-[#888]">
            Все списания, пополнения и переводы по клиентским кабинетам — в одной ленте
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/client-accounts"
            className="rounded-[8px] border border-[#e7e7e7] bg-white px-3.5 py-2 text-[12px] font-medium text-[#444] hover:border-[#ccc] hover:bg-[#fafafa] transition-colors"
          >
            Счета клиентов
          </Link>
          <button
            onClick={load}
            className="rounded-[8px] border border-[#222] bg-[#222] px-3.5 py-2 text-[12px] font-medium text-white hover:bg-[#111] transition-colors"
          >
            Обновить
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-[10px] border border-[#f0c8cf] bg-[#fbecef] px-4 py-3 text-[13px] text-[#9a1f31]">{error}</div>
      )}

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-4 mb-4 rounded-[12px] border border-[#e7e7e7] bg-white overflow-hidden">
        {[
          {
            icon: <path d="M3 17l6-6 4 4 8-9"/>,
            label: 'Оборот EUR',
            value: fmtMoney(kpi.eurTotal),
            sym: 'EUR',
            sub: 'за последние 30 дней',
          },
          {
            icon: <path d="M3 17l6-6 4 4 8-9"/>,
            label: 'Оборот USD',
            value: fmtMoney(kpi.usdTotal),
            sym: 'USD',
            sub: 'за последние 30 дней',
          },
          {
            icon: <><path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
            label: 'Операций',
            value: String(kpi.txnCount),
            sym: '',
            sub: `${kpi.inProgress} в процессе`,
          },
          {
            icon: <><path d="M7 4v13M7 4L4 7M7 4l3 3"/><path d="M17 20V7M17 20l3-3M17 20l-3-3"/></>,
            label: 'Переводов',
            value: String(kpi.trCount),
            sym: '',
            sub: 'между счетами клиентов',
          },
        ].map((cell, i) => (
          <div key={i} className={cx('px-5 py-4', i < 3 && 'border-r border-[#e7e7e7]')}>
            <div className="flex items-center gap-1.5 cd-mono text-[10px] font-medium tracking-[0.12em] uppercase text-[#888]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#b5b5b5]">{cell.icon}</svg>
              {cell.label}
            </div>
            <div className="cd-display text-[26px] font-semibold tracking-[-0.025em] text-[#222] leading-none mt-3">
              {cell.value}
              {cell.sym && <span className="text-[14px] text-[#888] font-medium ml-[4px]">{cell.sym}</span>}
            </div>
            <div className="text-[11.5px] text-[#555] mt-2">{cell.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="mb-3.5 flex items-center gap-3 flex-wrap">
        {/* Segment */}
        <div className="flex items-center bg-[#f5f5f5] border border-[#e7e7e7] rounded-[8px] p-[2px]">
          {([['all', 'Все', counts.all], ['txn', 'Операции', counts.txn], ['transfer', 'Переводы', counts.transfer]] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key as any)}
              className={cx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12.5px] transition-all',
                typeFilter === key
                  ? 'bg-white text-[#222] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  : 'text-[#888] hover:text-[#555]'
              )}
            >
              {label}
              <span className={cx('cd-mono text-[10px]', typeFilter === key ? 'text-[#888]' : 'text-[#b5b5b5]')}>{count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b5b5b5]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>
          <input
            className="w-[200px] rounded-[8px] border border-[#e7e7e7] bg-white pl-8 pr-3 py-[7px] text-[12.5px] text-[#222] outline-none focus:border-[#222] placeholder-[#b5b5b5] transition-colors"
            placeholder="Операция или клиент"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Site selector */}
        <div className="flex items-center gap-2 text-[12.5px] text-[#555]">
          <span className="text-[#b5b5b5]">Сайт:</span>
          <select
            className="rounded-[8px] border border-[#e7e7e7] bg-white px-3 py-[7px] text-[12.5px] text-[#222] outline-none focus:border-[#222] transition-colors appearance-none"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>{(site as any).siteHost || (site as any).siteUrl}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-[12px] text-[#888]">
          {loading ? 'Загрузка…' : `Показано ${rows.length} из ${allRows.length}`}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-[12px] border border-[#e7e7e7] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
            <thead className="bg-[#fafafa]">
              <tr>
                <th className="cd-mono px-4 py-3 text-[10px] font-medium tracking-[0.1em] uppercase text-[#888] border-b border-[#f0f0f0] whitespace-nowrap">Операция</th>
                <th className="cd-mono px-4 py-3 text-[10px] font-medium tracking-[0.1em] uppercase text-[#888] border-b border-[#f0f0f0]">Клиент</th>
                <th className="cd-mono px-4 py-3 text-[10px] font-medium tracking-[0.1em] uppercase text-[#888] border-b border-[#f0f0f0]">Тип</th>
                <th className="cd-mono px-4 py-3 text-[10px] font-medium tracking-[0.1em] uppercase text-[#888] border-b border-[#f0f0f0]">Статус</th>
                <th className="cd-mono px-4 py-3 text-[10px] font-medium tracking-[0.1em] uppercase text-[#888] border-b border-[#f0f0f0] text-right">Сумма</th>
                <th className="cd-mono px-4 py-3 text-[10px] font-medium tracking-[0.1em] uppercase text-[#888] border-b border-[#f0f0f0] text-right">Дата</th>
                <th className="px-4 py-3 border-b border-[#f0f0f0] w-[1%]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isTransfer = row.kind === 'transfer';
                const clientName = userLabelShort(row.fromId || row.clientId);
                const toName = isTransfer
                  ? (row.toId && row.toId !== row.fromId
                      ? userLabelShort(row.toId)
                      : recipientFromComment((row.source as any)?.meta?.comment))
                  : null;
                return (
                  <tr key={`${row.kind}-${row.id}`} className="border-t border-[#f0f0f0] hover:bg-[#fafafa] transition-colors">
                    {/* Операция */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-[11px]">
                        <div className={cx(
                          'w-[30px] h-[30px] rounded-[8px] flex items-center justify-center flex-shrink-0',
                          isTransfer
                            ? 'bg-[#222] text-white'
                            : 'bg-[#fafafa] border border-[#e7e7e7] text-[#555]'
                        )}>
                          {isTransfer ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 4v13M7 4L4 7M7 4l3 3"/><path d="M17 20V7M17 20l3-3M17 20l-3-3"/></svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#222] truncate tracking-[-0.01em] max-w-[220px]">{row.title}</div>
                          <div className="cd-mono text-[11px] text-[#888] mt-[1px]">
                            #{(row.source as any).wpPostId}
                            {row.siteHost && <> · {row.siteHost}</>}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Клиент */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-[7px]">
                        <div className="w-6 h-6 rounded-full bg-[#f0f0f0] border border-[#e7e7e7] flex items-center justify-center flex-shrink-0 cd-mono text-[9.5px] font-semibold text-[#555]">
                          {initials(clientName)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12.5px] text-[#222] truncate">{clientName}</div>
                          {toName && (
                            <div className="text-[11px] text-[#888] truncate">→ {toName}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Тип */}
                    <td className="px-4 py-3">
                      <span className={cx(
                        'inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-[6px] cd-mono text-[10px] font-semibold tracking-[0.06em] uppercase border',
                        isTransfer
                          ? 'border-[#222] bg-[#222] text-white'
                          : 'border-[#e7e7e7] bg-white text-[#555]'
                      )}>
                        <span className={cx('w-[5px] h-[5px] rounded-full flex-shrink-0', isTransfer ? 'bg-white' : 'bg-[#888]')} />
                        {isTransfer ? 'Перевод' : 'Операция'}
                      </span>
                    </td>

                    {/* Статус */}
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>

                    {/* Сумма */}
                    <td className="px-4 py-3 text-right">
                      {isTransfer ? (
                        <div className="cd-mono text-[13px] font-semibold text-[#222]">
                          <span className="text-[10px] text-[#888] font-medium mr-[3px]">{row.currency}</span>
                          {fmtMoney(row.amount)}
                        </div>
                      ) : Number(row.amount) > 0 ? (
                        <div className="cd-mono text-[13px] font-semibold text-[#222]">
                          <span className="text-[10px] text-[#888] font-medium mr-[3px]">{row.currency}</span>
                          {fmtMoney(row.amount)}
                        </div>
                      ) : (
                        <span className="cd-mono text-[13px] text-[#1f8a5e] font-semibold">+ пополнение</span>
                      )}
                    </td>

                    {/* Дата */}
                    <td className="px-4 py-3 text-right">
                      <span className="cd-mono text-[11.5px] text-[#555] whitespace-nowrap">{fmtDate(row.date)}</span>
                    </td>

                    {/* Действия */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditingRow(row)}
                        className="rounded-[7px] border border-[#e7e7e7] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#555] hover:border-[#ccc] hover:bg-[#fafafa] whitespace-nowrap transition-colors"
                      >
                        Редактировать
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#888]">
                    Финансовые операции не найдены.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#fafafa] border-t border-[#e7e7e7] text-[12px] text-[#555]">
          <span>
            Показано <span className="cd-mono font-medium text-[#222]">{rows.length}</span> из{' '}
            <span className="cd-mono font-medium text-[#222]">{allRows.length}</span> операций
          </span>
          <span className="text-[#888]">
            {currentSiteHost && <><span className="cd-mono text-[#555]">{currentSiteHost}</span></>}
          </span>
        </div>
      </div>

      {editingRow && (
        <OperationEditModal
          row={editingRow}
          clients={clients}
          busy={saving}
          onClose={() => setEditingRow(null)}
          onSave={saveRow}
        />
      )}
    </MainLayout>
  );
}

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
      <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
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

/* ── Edit field ────────────────────────────────────────────────────────── */
const EditField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
}> = ({ label, value, onChange, textarea }) => (
  <div>
    <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-1.5">{label}</div>
    {textarea ? (
      <textarea
        className="min-h-[90px] w-full rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[13px] text-[#222] outline-none focus:border-[#222] placeholder-[#b5b5b5] transition-colors resize-none"
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

/* ── Edit select ───────────────────────────────────────────────────────── */
const EditSelect: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}> = ({ label, value, onChange, options }) => (
  <div>
    <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-1.5">{label}</div>
    <select
      className="w-full rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[13px] text-[#222] outline-none focus:border-[#222] transition-colors appearance-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

/* ── Client search field ───────────────────────────────────────────────── */
const ClientSearchField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  clients: CcpClient[];
}> = ({ label, value, onChange, clients }) => {
  const listId = useMemo(() => `clients-${label.replace(/\s+/g, '-').toLowerCase()}`, [label]);
  const options = useMemo(() => clients.map((client) => ({
    id: String(client.wpUserId),
    label: clientSearchLabel(client),
  })), [clients]);
  const selected = options.find((o) => o.id === value);
  const [query, setQuery] = useState(selected?.label || '');

  useEffect(() => {
    const next = options.find((o) => o.id === value);
    setQuery(next?.label || '');
  }, [options, value]);

  const commit = (raw: string, exactOnly = false) => {
    const needle = raw.trim().toLowerCase();
    if (!needle) return;
    const exact = options.find((o) => o.label.toLowerCase() === needle);
    if (exact) { onChange(exact.id); setQuery(exact.label); return; }
    if (exactOnly) return;
    const partial = options.find((o) => o.label.toLowerCase().includes(needle));
    if (partial) { onChange(partial.id); setQuery(partial.label); }
  };

  return (
    <div>
      <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-1.5">{label}</div>
      <input
        list={listId}
        className="w-full rounded-[8px] border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[13px] text-[#222] outline-none focus:border-[#222] placeholder-[#b5b5b5] transition-colors"
        value={query}
        onChange={(e) => { setQuery(e.target.value); commit(e.target.value, true); }}
        onBlur={() => commit(query)}
        placeholder="Начните вводить имя или email"
      />
      <datalist id={listId}>
        {options.map((o) => <option key={o.id} value={o.label} />)}
      </datalist>
      <div className="mt-1 text-[11px] text-[#888]">
        {value ? `Выбран: ${selected?.label || 'клиент не найден'}` : 'Выберите клиента из списка'}
      </div>
    </div>
  );
};

/* ── Operation edit modal ──────────────────────────────────────────────── */
const OperationEditModal: React.FC<{
  row: OperationRow;
  clients: CcpClient[];
  busy: boolean;
  onClose: () => void;
  onSave: (patch: any) => void;
}> = ({ row, clients, busy, onClose, onSave }) => {
  const isTransferLike = row.kind === 'transfer';
  const [title, setTitle] = useState(row.title);
  const [date, setDate] = useState(String(row.date || ''));
  const [status, setStatus] = useState(String(row.status || 'accepted').toLowerCase());
  const [amount, setAmount] = useState(String(row.amount || '0'));
  const [currency, setCurrency] = useState(
    CURRENCY_OPTIONS.includes(String(row.currency || '').toUpperCase()) ? String(row.currency || 'USD').toUpperCase() : 'USD'
  );
  const [rate, setRate] = useState(String(row.rate || '1'));
  const [toCurrency, setToCurrency] = useState(
    CURRENCY_OPTIONS.includes(String((row.source as any).toCurrency || row.currency || '').toUpperCase())
      ? String((row.source as any).toCurrency || row.currency || 'USD').toUpperCase()
      : 'USD'
  );
  const [spendEur, setSpendEur] = useState(String((row.source as any).spendEur ?? '0'));
  const [spendUsd, setSpendUsd] = useState(String((row.source as any).spendUsd ?? '0'));
  const [fromId, setFromId] = useState(String(row.fromId || ''));
  const [toId, setToId] = useState(String(row.toId || ''));
  const [desc, setDesc] = useState(String((row.source as any).desc || ''));
  const [note, setNote] = useState(String((row.source as any).note || ''));
  const credited = String((Number(amount || 0) || 0) * (Number(rate || 1) || 1));
  const statusOptions = STATUS_OPTIONS.some((o) => o.value === status)
    ? STATUS_OPTIONS
    : [{ value: status, label: humanStatus(status) }, ...STATUS_OPTIONS];

  return (
    <ModalShell
      title={`Редактировать ${isTransferLike ? 'перевод' : 'операцию'}`}
      busy={busy}
      onClose={onClose}
      onSave={() => onSave({ title, date, status, amount, currency, toCurrency, rate, credited, spendEur, spendUsd, fromId, toId, desc, note })}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <EditField label="Название" value={title} onChange={setTitle} />
        <EditSelect label="Статус" value={status} onChange={setStatus} options={statusOptions} />
        <EditField label="Дата" value={date} onChange={setDate} />
        {isTransferLike ? (
          <>
            <ClientSearchField label="Отправитель" value={fromId} onChange={setFromId} clients={clients} />
            <ClientSearchField label="Получатель" value={toId} onChange={setToId} clients={clients} />
            <EditField label="Сумма" value={amount} onChange={setAmount} />
            <EditSelect label="Валюта списания" value={currency} onChange={setCurrency} options={CURRENCY_OPTIONS.map((v) => ({ value: v, label: v }))} />
            <EditSelect label="Валюта зачисления" value={toCurrency} onChange={setToCurrency} options={CURRENCY_OPTIONS.map((v) => ({ value: v, label: v }))} />
            <EditField label="Курс" value={rate} onChange={setRate} />
            <div className="md:col-span-2"><EditField label="Описание" value={desc} onChange={setDesc} textarea /></div>
            <div className="md:col-span-2"><EditField label="Примечание" value={note} onChange={setNote} textarea /></div>
          </>
        ) : (
          <>
            <EditField label="EUR" value={spendEur} onChange={setSpendEur} />
            <EditField label="USD" value={spendUsd} onChange={setSpendUsd} />
            <div className="md:col-span-2"><EditField label="Описание / назначение" value={desc} onChange={setDesc} textarea /></div>
          </>
        )}
      </div>
    </ModalShell>
  );
};
