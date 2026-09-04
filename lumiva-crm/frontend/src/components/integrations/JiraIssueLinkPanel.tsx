import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createAndLinkJiraIssue,
  fetchIntegrations,
  fetchJiraProjects,
  fetchLinkedJiraIssue,
  type IntegrationConnectionDto,
  type JiraLinkedIssue,
  type JiraLinkEntityType,
} from '../../api/integrations';

type Props = {
  entityType: JiraLinkEntityType;
  entityId: string | undefined | null;
  /** Предзаполняет тему задачи (например, имя лида или название сделки) */
  defaultSummary?: string;
};

const statusColor = (status: string | null): string => {
  const s = (status || '').toLowerCase();
  if (s.includes('done') || s.includes('готов') || s.includes('closed') || s.includes('resolved')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (s.includes('progress') || s.includes('работ') || s.includes('review')) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

/** Карточка привязанной задачи Jira на карточке лида/сделки/проекта — либо кнопка создать её. */
export const JiraIssueLinkPanel: React.FC<Props> = ({ entityType, entityId, defaultSummary }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState<JiraLinkedIssue | null>(null);
  const [connections, setConnections] = useState<IntegrationConnectionDto[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [connectionId, setConnectionId] = useState('');
  const [projects, setProjects] = useState<Array<{ id: string; key: string; name: string }>>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsErr, setProjectsErr] = useState<string | null>(null);
  const [projectKey, setProjectKey] = useState('');
  const [summary, setSummary] = useState(defaultSummary || '');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchLinkedJiraIssue(entityType, entityId).catch(() => null),
      fetchIntegrations().catch(() => []),
    ])
      .then(([issue, conns]) => {
        if (cancelled) return;
        setLinked(issue);
        setConnections(
          (conns || []).filter(
            (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'jira' && c.isEnabled,
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  useEffect(() => {
    if (!formOpen || !connectionId) return;
    let cancelled = false;
    setProjectsLoading(true);
    setProjectsErr(null);
    fetchJiraProjects(connectionId)
      .then((list) => {
        if (cancelled) return;
        setProjects(list);
        if (list.length && !projectKey) setProjectKey(list[0].key);
      })
      .catch((e) => {
        if (!cancelled) setProjectsErr(e instanceof Error ? e.message : 'Error');
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen, connectionId]);

  const openForm = () => {
    setErr(null);
    setSummary(defaultSummary || '');
    setDescription('');
    setProjectKey('');
    setProjects([]);
    if (connections.length === 1) setConnectionId(connections[0].id);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!entityId) return;
    if (!connectionId) {
      setErr(t('crm.jiraLink.selectConnection'));
      return;
    }
    if (!projectKey.trim()) {
      setErr(t('crm.jiraLink.selectProject'));
      return;
    }
    if (!summary.trim()) {
      setErr(t('crm.jiraLink.summaryRequired'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const issue = await createAndLinkJiraIssue(entityType, entityId, {
        connectionId,
        projectKey: projectKey.trim(),
        summary: summary.trim(),
        description: description.trim() || undefined,
      });
      setLinked(issue);
      setFormOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('crm.jiraLink.createError'));
    } finally {
      setBusy(false);
    }
  };

  if (!entityId || loading) return null;
  if (!linked && connections.length === 0) return null;

  if (linked) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 rounded-md bg-[#0052CC] px-1.5 py-0.5 text-[10px] font-bold text-white">
              Jira
            </span>
            <a
              href={linked.url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-xs font-semibold text-[#0052CC] hover:underline"
            >
              {linked.key} ↗
            </a>
          </div>
          {linked.status && (
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor(linked.status)}`}
            >
              {linked.status}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      {!formOpen ? (
        <button
          type="button"
          onClick={openForm}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[11px] font-medium text-slate-600 hover:border-[#0052CC] hover:text-[#0052CC]"
        >
          + {t('crm.jiraLink.createButton')}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-900">{t('crm.jiraLink.formTitle')}</div>
          {connections.length > 1 && (
            <select
              value={connectionId}
              onChange={(e) => {
                setConnectionId(e.target.value);
                setProjectKey('');
                setProjects([]);
              }}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white"
            >
              <option value="">{t('crm.jiraLink.selectConnectionPlaceholder')}</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {connectionId && (
            <select
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
              disabled={projectsLoading}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white disabled:opacity-60"
            >
              <option value="">
                {projectsLoading ? '…' : t('crm.jiraLink.selectProjectPlaceholder')}
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.key}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          )}
          {projectsErr && <p className="text-[10px] text-rose-600">{projectsErr}</p>}
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={t('crm.jiraLink.summaryPlaceholder')}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('crm.jiraLink.descriptionPlaceholder')}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          />
          {err && <p className="text-[10px] text-rose-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              disabled={busy}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
            >
              {t('crm.common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="rounded-full bg-[#0052CC] px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? t('crm.jiraLink.creating') : t('crm.jiraLink.createSubmit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
