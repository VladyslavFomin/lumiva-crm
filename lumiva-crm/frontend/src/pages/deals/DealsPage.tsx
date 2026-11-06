/**
 * «Сделки»: воронка (канбан по этапам с перетаскиванием) и таблица. Сделка — запись движка
 * проектов с kind = 'deal' (задачи, файлы, комментарии, история — в карточке /deals/:id),
 * но с акцентом на сумме и этапе: Лид · Компания · Сделка · Сумма · Статус.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { PageHero } from '../../components/ui/PageHero';
import { LottieIcon } from '../../components/LottieIcon';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { changeProjectStatus, fetchProjects, type Project } from '../../api/projects';
import { fetchLeadsList, type Lead } from '../../api/leads';
import { fetchCompanies, type Company } from '../../api/companies';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { useProjectStatuses } from '../projects/useProjectStatuses';
import './deals.css';

type View = 'board' | 'table';

const fmtMoney = (n: number, cur: string, locale: string) => {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n).toLocaleString(locale)} ${cur}`;
  }
};

/** Суммы по валютам («12 500 € · 3 000 $») — валюты не складываем между собой. */
const sumsByCurrency = (list: Project[]) => {
  const m = new Map<string, number>();
  for (const d of list) m.set(d.currency || 'EUR', (m.get(d.currency || 'EUR') || 0) + (Number(d.amount) || 0));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

export const DealsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.deals.${key}`, o) as string;
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'table' ? 'table' : 'board';
  const { statuses, loading: stLoading } = useProjectStatuses('deal');
  const [deals, setDeals] = useState<Project[] | null>(null);
  const [leads, setLeads] = useState<Record<string, Lead>>({});
  const [companies, setCompanies] = useState<Record<string, Company>>({});
  const [staff, setStaff] = useState<Record<string, StaffUser>>({});
  const [q, setQ] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const locale = i18n.language === 'tr' ? 'tr-TR' : i18n.language === 'en' ? 'en-US' : 'ru-RU';

  useEffect(() => {
    let alive = true;
    fetchProjects({ kind: 'deal', limit: 1000 })
      .then((r) => alive && setDeals(r.items))
      .catch((e) => {
        if (!alive) return;
        setDeals([]);
        showAlert(e?.message || k('loadError'), { variant: 'error' });
      });
    fetchLeadsList()
      .then((list) => alive && setLeads(Object.fromEntries(list.map((l) => [l.id, l]))))
      .catch(() => undefined);
    fetchCompanies({ limit: 1000 })
      .then((r) => alive && setCompanies(Object.fromEntries((r.items || []).map((c) => [c.id, c]))))
      .catch(() => undefined);
    fetchStaff()
      .then((list) => alive && setStaff(Object.fromEntries(list.map((s) => [s.id, s]))))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!deals) return [];
    if (!needle) return deals;
    return deals.filter((d) => {
      const lead = d.leadId ? leads[d.leadId] : null;
      const comp = d.companyId ? companies[d.companyId] : null;
      return `${d.name} ${lead?.name ?? ''} ${comp?.name ?? ''}`.toLowerCase().includes(needle);
    });
  }, [deals, q, leads, companies]);

  const outcomeOf = (status: string) => statuses.find((s) => s.value === status)?.outcome ?? null;
  const open = filtered.filter((d) => !outcomeOf(d.status));
  const won = filtered.filter((d) => outcomeOf(d.status) === 'won');
  const lost = filtered.filter((d) => outcomeOf(d.status) === 'lost');
  const winRate = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null;

  const moveTo = async (deal: Project, status: string) => {
    if (deal.status === status) return;
    const prev = deals;
    setDeals((cur) => (cur || []).map((d) => (d.id === deal.id ? { ...d, status: status as any } : d)));
    try {
      await changeProjectStatus(deal.id, status as any);
    } catch (e: any) {
      setDeals(prev);
      showAlert(e?.message || k('moveError'), { variant: 'error' });
    }
  };

  const ownerName = (d: Project) => {
    const id = d.ownerUserIds?.[0] || d.ownerUserId;
    return (id && staff[id]?.fullName) || d.owner || '';
  };
  const initials = (n: string) =>
    n
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join('');

  const SumLine = ({ list }: { list: Project[] }) => {
    const sums = sumsByCurrency(list);
    if (!sums.length) return <span className="dl-sum muted">—</span>;
    return (
      <span className="dl-sum">
        {sums.slice(0, 2).map(([cur, n]) => fmtMoney(n, cur, locale)).join(' · ')}
        {sums.length > 2 ? ` +${sums.length - 2}` : ''}
      </span>
    );
  };

  const loading = deals === null || stLoading;

  return (
    <MainLayout>
      <div className="dl-page">
        <PageHero
          kicker={k('kicker')}
          title={k('title')}
          subtitle={k('subtitle')}
          actions={
            <>
              <div className="dl-seg" role="tablist">
                {(['board', 'table'] as View[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={view === v}
                    className={view === v ? 'on' : ''}
                    onClick={() => setParams((p) => {
                      const n = new URLSearchParams(p);
                      if (v === 'board') n.delete('view');
                      else n.set('view', v);
                      return n;
                    }, { replace: true })}
                  >
                    {k(`view.${v}`)}
                  </button>
                ))}
              </div>
              <button type="button" className="btn-primary" onClick={() => navigate('/deals/new')}>
                + {k('new')}
              </button>
            </>
          }
        />

        <div className="dl-kpis">
          <div className="dl-kpi">
            <div className="l">{k('kpi.open')}</div>
            <div className="v">{loading ? '…' : open.length}</div>
            <div className="s"><SumLine list={open} /></div>
          </div>
          <div className="dl-kpi">
            <div className="l">{k('kpi.won')}</div>
            <div className="v">{loading ? '…' : won.length}</div>
            <div className="s"><SumLine list={won} /></div>
          </div>
          <div className="dl-kpi">
            <div className="l">{k('kpi.lost')}</div>
            <div className="v">{loading ? '…' : lost.length}</div>
            <div className="s"><SumLine list={lost} /></div>
          </div>
          <div className="dl-kpi">
            <div className="l">{k('kpi.winRate')}</div>
            <div className="v">{loading || winRate === null ? '—' : `${winRate}%`}</div>
            <div className="s">{k('kpi.winRateHint')}</div>
          </div>
        </div>

        <div className="dl-toolbar">
          <input className="dl-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={k('search')} />
          <span className="dl-count">{k('count', { count: filtered.length })}</span>
        </div>

        {loading ? (
          <div className="dl-empty">…</div>
        ) : !deals?.length ? (
          <div className="dl-empty">
            <LottieIcon name="empty-pulse" size={72} />
            <b>{k('emptyTitle')}</b>
            <span>{k('emptyText')}</span>
            <button type="button" className="btn-primary" onClick={() => navigate('/deals/new')}>
              + {k('new')}
            </button>
          </div>
        ) : view === 'board' ? (
          <div className="dl-board">
            {statuses.map((st) => {
              const col = filtered.filter((d) => d.status === st.value);
              return (
                <section
                  key={st.id}
                  className={`dl-col${overStage === st.value ? ' over' : ''}${st.outcome ? ` out-${st.outcome}` : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverStage(st.value);
                  }}
                  onDragLeave={() => setOverStage((cur) => (cur === st.value ? null : cur))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOverStage(null);
                    const d = (deals || []).find((x) => x.id === dragId);
                    if (d) void moveTo(d, st.value);
                    setDragId(null);
                  }}
                >
                  <header className="dl-col-hd">
                    <span className="dot" style={{ background: st.color }} />
                    <b>{st.value}</b>
                    <span className="n">{col.length}</span>
                  </header>
                  <div className="dl-col-sum">
                    <SumLine list={col} />
                  </div>
                  <div className="dl-cards lv-stagger">
                    {col.map((d) => {
                      const lead = d.leadId ? leads[d.leadId] : null;
                      const comp = d.companyId ? companies[d.companyId] : null;
                      const owner = ownerName(d);
                      const done = d.tasks?.filter((x) => x.status === 'Готово').length ?? 0;
                      const total = d.tasks?.length ?? 0;
                      return (
                        <article
                          key={d.id}
                          className={`dl-card${dragId === d.id ? ' dragging' : ''}`}
                          draggable
                          onDragStart={() => setDragId(d.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverStage(null);
                          }}
                          onClick={() => navigate(`/deals/${d.id}`)}
                        >
                          <div className="dl-card-amt">{fmtMoney(Number(d.amount) || 0, d.currency, locale)}</div>
                          <div className="dl-card-nm">{d.name || k('untitled')}</div>
                          {lead || comp ? (
                            <div className="dl-card-meta">
                              {comp ? <span>{comp.name}</span> : null}
                              {lead ? <span>{lead.name}</span> : null}
                            </div>
                          ) : null}
                          <div className="dl-card-ft">
                            {total ? (
                              <span className="dl-tasks">
                                {done}/{total}
                              </span>
                            ) : (
                              <span />
                            )}
                            {owner ? (
                              <span className="dl-av" title={owner}>
                                {initials(owner)}
                              </span>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                    {!col.length ? <div className="dl-col-empty">{k('dropHere')}</div> : null}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="dl-table-wrap">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>{k('col.name')}</th>
                  <th>{k('col.lead')}</th>
                  <th>{k('col.company')}</th>
                  <th>{k('col.stage')}</th>
                  <th className="r">{k('col.amount')}</th>
                  <th>{k('col.owner')}</th>
                  <th>{k('col.created')}</th>
                </tr>
              </thead>
              <tbody className="lv-stagger">
                {filtered.map((d) => {
                  const st = statuses.find((s) => s.value === d.status);
                  return (
                    <tr key={d.id} onClick={() => navigate(`/deals/${d.id}`)}>
                      <td className="nm">{d.name || k('untitled')}</td>
                      <td>{d.leadId ? leads[d.leadId]?.name ?? '—' : '—'}</td>
                      <td>{d.companyId ? companies[d.companyId]?.name ?? '—' : '—'}</td>
                      <td>
                        <span className="dl-pill" style={{ borderColor: st?.color, color: st?.color }}>
                          <i style={{ background: st?.color }} />
                          {d.status}
                        </span>
                      </td>
                      <td className="r mono">{fmtMoney(Number(d.amount) || 0, d.currency, locale)}</td>
                      <td>{ownerName(d) || '—'}</td>
                      <td className="mono mut">{String(d.createdAt || '').split(',')[0]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default DealsPage;
