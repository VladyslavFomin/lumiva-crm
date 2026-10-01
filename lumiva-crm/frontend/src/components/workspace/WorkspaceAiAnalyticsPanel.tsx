import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  analyzeWorkspaceTable,
  fetchCustomObject,
  type WorkspaceAiAnalytics,
} from '../../api/customObjects';
import { fetchAiAssignableRoster, type AiAssignableRosterItem } from '../../api/aiEmployees';
import { aiColumnErrorMessage } from '../../pages/workspace/workspaceAiErrors';

/**
 * "Проанализировать таблицу" — по требованию, результат кэшируется на бэкенде в
 * CustomObject.meta.aiAnalytics (см. AiEmployeesService.analyzeWorkspaceTable), поэтому при
 * повторном заходе на страницу виден последний расчёт без нового запроса к модели.
 */
export function WorkspaceAiAnalyticsPanel({ objectId }: { objectId: string }) {
  const { t, i18n } = useTranslation();
  const [roster, setRoster] = useState<AiAssignableRosterItem[] | null>(null);
  const [agentId, setAgentId] = useState('');
  const [question, setQuestion] = useState('');
  const [cached, setCached] = useState<WorkspaceAiAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  // Свёрнута по умолчанию — панель не должна перетягивать внимание с блоков аналитики.
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ws_ai_panel_expanded') === '1';
    } catch {
      return false;
    }
  });
  const toggleExpanded = () =>
    setExpanded((prev) => {
      try {
        localStorage.setItem('ws_ai_panel_expanded', prev ? '0' : '1');
      } catch {
        // ignore
      }
      return !prev;
    });
  const openReport = () =>
    window.dispatchEvent(new CustomEvent('lumiva:analytics-report', { detail: { objectId } }));

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchCustomObject(objectId).catch(() => null),
      fetchAiAssignableRoster(objectId).catch(() => []),
    ]).then(([obj, list]) => {
      if (!alive) return;
      const meta = (obj?.meta || {}) as Record<string, unknown>;
      const a = meta.aiAnalytics as WorkspaceAiAnalytics | undefined;
      if (a?.text) {
        setCached(a);
        setAgentId(a.agentId);
      }
      setRoster(list);
      if (!agentId && list.length === 1) setAgentId(list[0].id);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectId]);

  const run = async () => {
    if (!agentId) return;
    setBusy(true);
    setError('');
    try {
      const res = await analyzeWorkspaceTable(objectId, agentId, question);
      if (res.ok && res.text) {
        const agent = (roster || []).find((a) => a.id === agentId);
        setCached({
          agentId,
          agentName: agent?.name || '',
          text: res.text,
          question: question.trim() || null,
          computedAt: res.computedAt || new Date().toISOString(),
        });
        setOpen(true);
      } else {
        setError(aiColumnErrorMessage(t, res.error, 'crm.workspace.analytics.aiError'));
      }
    } catch {
      setError(aiColumnErrorMessage(t, null, 'crm.workspace.analytics.aiError'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        aria-expanded={expanded}
      >
        <span aria-hidden style={{ color: '#7c3aed' }}>✦</span>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{t('crm.workspace.analytics.aiTitle')}</span>
        {cached ? (
          <span className="truncate text-xs text-neutral-500">
            · {t('crm.workspace.analytics.aiLastReport', {
              date: new Date(cached.computedAt).toLocaleString(i18n.language, {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              }),
            })}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:border-neutral-300"
        onClick={openReport}
      >
        ✉ {t('crm.workspace.report.button')}
      </button>
      <button
        type="button"
        className="inline-flex items-center rounded-lg px-2 py-1 text-xs text-neutral-600 hover:bg-white/70"
        onClick={toggleExpanded}
      >
        {expanded ? t('crm.workspace.analytics.aiPanelCollapse') : t('crm.workspace.analytics.aiPanelExpand')}
        <span aria-hidden style={{ marginLeft: 4, display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
    </div>
  );

  if (!expanded) {
    return (
      <div className="ws-ai-config" style={{ marginBottom: 16, paddingTop: 10, paddingBottom: 10 }}>
        {header}
      </div>
    );
  }

  return (
    <div className="ws-ai-config" style={{ marginBottom: 16 }}>
      {header}
      <div className="ws-f2" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="ws-field" style={{ flex: '1 1 220px' }}>
          <label>{t('crm.workspace.table.aiColumnAgent')}</label>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="ws-input">
            <option value="">{t('crm.workspace.table.aiColumnAgentPick')}</option>
            {(roster || []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.roleShortTitle}
              </option>
            ))}
          </select>
        </div>
        <div className="ws-field" style={{ flex: '2 1 320px' }}>
          <label>{t('crm.workspace.analytics.aiQuestion')}</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('crm.workspace.analytics.aiQuestionPlaceholder')}
            className="ws-input"
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={!agentId || busy} onClick={() => void run()}>
          {busy ? t('crm.workspace.analytics.aiRunning') : t('crm.workspace.analytics.aiRun')}
        </button>
        {cached ? (
          <button type="button" className="tb-icon-btn" onClick={() => setOpen((v) => !v)}>
            {open ? t('crm.workspace.analytics.aiCollapse') : t('crm.workspace.analytics.aiExpand')}
          </button>
        ) : null}
        {(roster || []).length === 0 ? (
          <span className="ws-note">{t('crm.workspace.analytics.aiNoAgents')}</span>
        ) : null}
      </div>
      {error ? <p className="ws-note" style={{ color: '#9c2338' }}>{error}</p> : null}
      {cached && open ? (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 whitespace-pre-line" style={{ lineHeight: 1.55 }}>
          {cached.text}
          <div className="ws-note" style={{ marginTop: 8 }}>
            {t('crm.workspace.analytics.aiComputedBy', {
              name: cached.agentName,
              date: new Date(cached.computedAt).toLocaleString(i18n.language),
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
