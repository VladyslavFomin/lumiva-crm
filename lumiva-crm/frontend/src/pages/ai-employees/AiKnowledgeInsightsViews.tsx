import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  deleteAiKnowledge,
  fetchAiInsights,
  fetchAiKnowledge,
  saveAiKnowledge,
  type AiInsights,
  type AiKnowledgeItem,
} from '../../api/aiEmployees';
import './ai-employees.css';

const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/* ================================================================== Knowledge base */

type Draft = { id?: string; title: string; content: string; tags: string; alwaysOn: boolean; enabled: boolean };
const EMPTY: Draft = { title: '', content: '', tags: '', alwaysOn: false, enabled: true };

export function KnowledgeView() {
  const { t } = useTranslation();
  const [items, setItems] = useState<AiKnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setItems((await fetchAiKnowledge()).items);
    } catch (e: any) {
      setError(e?.message || t('crm.aiEmployees.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((i) => `${i.title} ${i.content} ${(i.tags || []).join(' ')}`.toLowerCase().includes(s)) : items;
  }, [items, q]);

  const save = async () => {
    if (!draft || !draft.title.trim() || !draft.content.trim()) return;
    setBusy(true);
    setError('');
    try {
      await saveAiKnowledge({
        id: draft.id,
        title: draft.title.trim(),
        content: draft.content,
        tags: draft.tags.split(',').map((x) => x.trim()).filter(Boolean),
        alwaysOn: draft.alwaysOn,
        enabled: draft.enabled,
      });
      setDraft(null);
      await load();
    } catch (e: any) {
      setError(e?.message || t('crm.aiEmployees.errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: AiKnowledgeItem) => {
    if (!window.confirm(t('crm.aiEmployees.knowledge.confirmDelete', { title: item.title }))) return;
    await deleteAiKnowledge(item.id).catch(() => undefined);
    await load();
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '').slice(0, 20000);
      setDraft((d) => ({ ...(d ?? EMPTY), content: text, title: d?.title || file.name.replace(/\.[^.]+$/, '') }));
    };
    reader.readAsText(file);
  };

  return (
    <MainLayout>
      <div className="ai-emp">
        <div className="ai-hero" style={{ marginBottom: 20 }}>
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.aiEmployees.badge.workforce')}
            </div>
            <h1>{t('crm.aiEmployees.knowledge.title')}</h1>
            <p className="sub">{t('crm.aiEmployees.knowledge.subtitle')}</p>
          </div>
          <div className="ai-hero-actions">
            <input className="ai-input" style={{ width: 240 }} placeholder={t('crm.aiEmployees.knowledge.search')} value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="aib" onClick={() => setDraft({ ...EMPTY })}>
              + {t('crm.aiEmployees.knowledge.add')}
            </button>
          </div>
        </div>

        {error ? <div className="ai-panel" style={{ padding: 14, marginBottom: 16, color: '#9a1f31', fontSize: 13 }}>{error}</div> : null}

        {draft ? (
          <div className="ai-form-card">
            <div className="fct">{draft.id ? t('crm.aiEmployees.knowledge.edit') : t('crm.aiEmployees.knowledge.add')}</div>
            <div className="ai-field">
              <label className="ai-label">{t('crm.aiEmployees.knowledge.fieldTitle')}</label>
              <input className="ai-input" value={draft.title} maxLength={255} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="ai-field">
              <label className="ai-label">{t('crm.aiEmployees.knowledge.fieldContent')}</label>
              <textarea className="ai-textarea" style={{ minHeight: 180 }} maxLength={20000} value={draft.content} placeholder={t('crm.aiEmployees.knowledge.contentPlaceholder')} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
              <div className="ai-hint">
                <label style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                  {t('crm.aiEmployees.knowledge.loadFile')}
                  <input type="file" accept=".txt,.md,.csv,.json,text/plain" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
                </label>
              </div>
            </div>
            <div className="ai-field">
              <label className="ai-label">{t('crm.aiEmployees.knowledge.fieldTags')}</label>
              <input className="ai-input" value={draft.tags} placeholder="цены, заезд, отмена" onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
            </div>
            <div className="ai-perm" style={{ padding: '10px 0' }}>
              <div className="pb">
                <div className="pn">{t('crm.aiEmployees.knowledge.alwaysOn')}</div>
                <div className="pd">{t('crm.aiEmployees.knowledge.alwaysOnHint')}</div>
              </div>
              <button type="button" className={cn('ai-toggle', draft.alwaysOn ? 'on' : 'off')} onClick={() => setDraft({ ...draft, alwaysOn: !draft.alwaysOn })} />
            </div>
            <div className="ai-perm" style={{ padding: '10px 0' }}>
              <div className="pb">
                <div className="pn">{t('crm.aiEmployees.knowledge.enabled')}</div>
              </div>
              <button type="button" className={cn('ai-toggle', draft.enabled ? 'on' : 'off')} onClick={() => setDraft({ ...draft, enabled: !draft.enabled })} />
            </div>
            <div className="ai-create-foot">
              <button className="aib ghost" onClick={() => setDraft(null)}>
                {t('crm.common.cancel')}
              </button>
              <div className="spacer" />
              <button className="aib" disabled={busy || !draft.title.trim() || !draft.content.trim()} onClick={save}>
                {t('crm.common.save')}
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('crm.aiEmployees.choose.loading')}</div>
        ) : shown.length === 0 ? (
          <div className="ai-empty">
            <div className="et">{t('crm.aiEmployees.knowledge.emptyTitle')}</div>
            <div className="ed">{t('crm.aiEmployees.knowledge.emptyHint')}</div>
          </div>
        ) : (
          <div className="ai-roster">
            {shown.map((it) => (
              <div key={it.id} className="ai-card" style={{ cursor: 'default', opacity: it.enabled ? 1 : 0.55 }}>
                <div className="nm">
                  {it.title}
                  {it.alwaysOn ? <span className="ai-auto">{t('crm.aiEmployees.knowledge.alwaysOnBadge')}</span> : null}
                </div>
                <div className="desc" style={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden' }}>
                  {it.content.slice(0, 260)}
                  {it.content.length > 260 ? '…' : ''}
                </div>
                {it.tags?.length ? (
                  <div className="rf" style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                    {it.tags.map((tg) => (
                      <span key={tg} className="ai-auto">{tg}</span>
                    ))}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="aib ghost sm" onClick={() => setDraft({ id: it.id, title: it.title, content: it.content, tags: (it.tags || []).join(', '), alwaysOn: it.alwaysOn, enabled: it.enabled })}>
                    {t('crm.aiEmployees.profile.edit')}
                  </button>
                  <button className="aib danger sm" onClick={() => remove(it)}>
                    {t('crm.aiEmployees.profile.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

/* ================================================================== Benefit report */

function fmtHours(min: number, t: (k: string) => string): string {
  if (min < 60) return `${min} ${t('crm.aiEmployees.insights.unitMin')}`;
  const h = min / 60;
  return `${h >= 10 ? Math.round(h) : h.toFixed(1)} ${t('crm.aiEmployees.insights.unitHour')}`;
}

export function InsightsView() {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AiInsights | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    fetchAiInsights(days)
      .then((r) => alive && setData(r))
      .catch((e: any) => alive && setError(e?.message || t('crm.aiEmployees.errors.generic')));
    return () => {
      alive = false;
    };
  }, [days, t]);

  const tiles = data
    ? [
        { k: 'hours', v: `≈ ${fmtHours(data.totals.minutesSaved, t)}`, l: t('crm.aiEmployees.insights.hoursSaved') },
        { k: 'records', v: data.totals.recordsHandled, l: t('crm.aiEmployees.insights.records') },
        { k: 'events', v: data.totals.eventRuns, l: t('crm.aiEmployees.insights.events') },
        { k: 'actions', v: data.totals.actionsExecuted, l: t('crm.aiEmployees.insights.actions') },
        { k: 'msgs', v: data.totals.clientMessages, l: t('crm.aiEmployees.insights.messages') },
        { k: 'esc', v: data.totals.escalations, l: t('crm.aiEmployees.insights.escalations') },
      ]
    : [];

  return (
    <MainLayout>
      <div className="ai-emp">
        <div className="ai-hero" style={{ marginBottom: 20 }}>
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.aiEmployees.badge.workforce')}
            </div>
            <h1>{t('crm.aiEmployees.insights.title')}</h1>
            <p className="sub">{t('crm.aiEmployees.insights.subtitle')}</p>
          </div>
          <div className="ai-hero-actions">
            {[7, 30, 90].map((d) => (
              <button key={d} className={cn('aib sm', days !== d && 'ghost')} onClick={() => setDays(d)}>
                {t('crm.aiEmployees.insights.days', { count: d })}
              </button>
            ))}
          </div>
        </div>

        {error ? <div className="ai-panel" style={{ padding: 14, color: '#9a1f31', fontSize: 13 }}>{error}</div> : null}
        {!data && !error ? <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('crm.aiEmployees.choose.loading')}</div> : null}

        {data ? (
          <>
            <div className="ai-kpis">
              {tiles.map((x) => (
                <div key={x.k} className="ai-kpi">
                  <div className="l">{x.l}</div>
                  <div className="v">{x.v}</div>
                </div>
              ))}
            </div>
            <p className="ai-hint" style={{ marginTop: -10, marginBottom: 20 }}>{t('crm.aiEmployees.insights.estimateNote')}</p>

            <div className="ai-panel" style={{ marginBottom: 16 }}>
              <div className="ai-panel-head">
                <div className="pt">{t('crm.aiEmployees.insights.byEmployee')}</div>
              </div>
              <div className="ai-panel-body flush" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--fg-3)' }}>
                      {['employee', 'events', 'actions', 'messages', 'escalations', 'approval', 'saved'].map((c) => (
                        <th key={c} style={{ padding: '10px 14px', fontWeight: 500 }}>{t(`crm.aiEmployees.insights.cols.${c}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.agents.map((a) => (
                      <tr key={a.agentId} style={{ borderTop: '1px solid var(--line-3)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{a.name}</td>
                        <td style={{ padding: '10px 14px' }}>{a.eventRuns}</td>
                        <td style={{ padding: '10px 14px' }}>{a.actionsExecuted}</td>
                        <td style={{ padding: '10px 14px' }}>{a.clientMessages}</td>
                        <td style={{ padding: '10px 14px' }}>{a.escalations}</td>
                        <td style={{ padding: '10px 14px' }}>{a.approvalRate == null ? '—' : `${a.approvalRate}%`}</td>
                        <td style={{ padding: '10px 14px' }}>≈ {fmtHours(a.minutesSaved, t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="ai-panel">
              <div className="ai-panel-head">
                <div className="pt">{t('crm.aiEmployees.insights.lessons')}</div>
              </div>
              <div className="ai-panel-body">
                <p className="ai-hint" style={{ marginTop: 0 }}>{t('crm.aiEmployees.insights.lessonsHint')}</p>
                {data.lessons.length === 0 ? (
                  <div className="ai-hint">{t('crm.aiEmployees.insights.noLessons')}</div>
                ) : (
                  data.lessons.map((l, i) => (
                    <div key={i} className="ai-info-row" style={{ alignItems: 'flex-start' }}>
                      <span className="k" style={{ minWidth: 110 }}>{l.agentName}</span>
                      <span className="v" style={{ textAlign: 'left', flex: 1 }}>
                        {l.title}
                        {l.reason ? <span style={{ color: 'var(--fg-3)' }}> — {l.reason}</span> : null}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </MainLayout>
  );
}
