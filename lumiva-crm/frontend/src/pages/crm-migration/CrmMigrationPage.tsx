// src/pages/crm-migration/CrmMigrationPage.tsx — «Переезд в Lumiva»: amoCRM / Битрикс24 / Excel
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchMigrationConnections,
  fetchMigrationRun,
  fetchMigrationRuns,
  previewMigration,
  previewMigrationFile,
  startMigration,
  startMigrationFile,
  type FilePreview,
  type FileTarget,
  type LeadStatusKey,
  type MigrationPreview,
  type MigrationRun,
  type MigrationSourceKey,
  type SourceInput,
} from '../../api/crmMigration';

type Source = MigrationSourceKey | 'file';
const STATUSES: LeadStatusKey[] = ['new', 'in_progress', 'waiting', 'won', 'lost'];
const ENTITY_ORDER = ['companies', 'contacts', 'deals', 'leads'];
const FILE_TARGETS: FileTarget[] = ['contacts', 'companies', 'leads'];

const card = 'rounded-[14px] border border-[#e7e7e7] bg-white';
const btnDark =
  'inline-flex items-center justify-center px-3.5 py-[8px] rounded-lg text-[12.5px] font-medium text-white bg-[#222] hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
const btnLight =
  'inline-flex items-center justify-center px-3 py-[7px] border border-[#e7e7e7] rounded-lg text-[12.5px] font-medium text-[#222] bg-white hover:border-[#222] disabled:opacity-40 transition-colors';
const input =
  'w-full border border-[#e7e7e7] rounded-lg bg-white px-3 py-2 text-[13px] text-[#222] outline-none focus:border-[#222] placeholder:text-[#aaa]';
const select =
  'border border-[#e7e7e7] rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] text-[#222] outline-none focus:border-[#222] max-w-full';

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <section className={`${card} p-5`}>
    <div className="flex items-center gap-2.5 mb-3">
      <span className="w-6 h-6 rounded-full bg-[#222] text-white text-[11px] font-semibold flex items-center justify-center shrink-0">{n}</span>
      <h2 className="text-[15px] font-semibold text-[#222] tracking-tight">{title}</h2>
    </div>
    {children}
  </section>
);

const RunProgress: React.FC<{ run: MigrationRun }> = ({ run }) => {
  const { t } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`crm.migration.${k}`, o);
  const keys = Object.keys(run.counters || {}).sort((a, b) => ENTITY_ORDER.indexOf(a) - ENTITY_ORDER.indexOf(b));
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {run.status === 'running' && <span className="inline-block w-2 h-2 rounded-full bg-[#dc8a00] animate-pulse" />}
        {run.status === 'done' && <span className="inline-block w-2 h-2 rounded-full bg-[#1f8a5e]" />}
        {run.status === 'failed' && <span className="inline-block w-2 h-2 rounded-full bg-[#d92d20]" />}
        <span className="text-[13px] font-medium text-[#222]">
          {run.status === 'running'
            ? run.stage
              ? m('progress.runningStage', { stage: m(`entity.${run.stage}`) })
              : m('progress.running')
            : run.status === 'done'
              ? m('progress.done')
              : m('progress.failed')}
        </span>
      </div>
      {keys.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] min-w-[420px]">
            <thead>
              <tr className="text-left text-[#888] font-mono text-[10px] uppercase tracking-[0.08em]">
                <th className="py-1.5 pr-3 font-medium" />
                <th className="py-1.5 pr-3 font-medium">{m('counter.created')}</th>
                <th className="py-1.5 pr-3 font-medium">{m('counter.updated')}</th>
                <th className="py-1.5 pr-3 font-medium">{m('counter.skipped')}</th>
                <th className="py-1.5 font-medium">{m('counter.failed')}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const c = run.counters[k];
                return (
                  <tr key={k} className="border-t border-[#f0f0f0]">
                    <td className="py-1.5 pr-3 font-medium text-[#222]">{m(`entity.${k}`)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{c.created}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{c.updated}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-[#888]">{c.skipped}</td>
                    <td className={`py-1.5 tabular-nums ${c.failed ? 'text-[#b42318]' : 'text-[#888]'}`}>{c.failed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {run.error && <div className="mt-3 text-[12.5px] text-[#b42318] break-words">{run.error}</div>}
      {run.warnings?.length > 0 && (
        <details className="mt-3 text-[12px] text-[#555]">
          <summary className="cursor-pointer text-[#222] font-medium">{m('progress.warnings', { count: run.warnings.length })}</summary>
          <ul className="mt-1.5 space-y-1 list-disc pl-5">
            {run.warnings.map((w, i) => (
              <li key={i} className="break-words">{w}</li>
            ))}
          </ul>
        </details>
      )}
      {run.status === 'done' && (
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link to="/leads" className={btnLight}>{m('open.leads')}</Link>
          <Link to="/contacts" className={btnLight}>{m('open.contacts')}</Link>
          <Link to="/companies" className={btnLight}>{m('open.companies')}</Link>
        </div>
      )}
    </div>
  );
};

/** Опрос запуска, пока он идёт. */
function useRun(initial: MigrationRun | null, onFinish?: () => void) {
  const [run, setRun] = useState<MigrationRun | null>(initial);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  useEffect(() => setRun(initial), [initial]);
  useEffect(() => {
    if (!run || run.status !== 'running') return;
    const id = window.setTimeout(async () => {
      try {
        const next = await fetchMigrationRun(run.id);
        setRun(next);
        if (next.status !== 'running') finishRef.current?.();
      } catch {
        /* следующая попытка через тик */
      }
    }, 2000);
    return () => window.clearTimeout(id);
  }, [run]);
  return run;
}

const CrmSourceWizard: React.FC<{ source: MigrationSourceKey; onStarted: (r: MigrationRun) => void }> = ({ source, onStarted }) => {
  const { t } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`crm.migration.${k}`, o);
  const [connections, setConnections] = useState<Array<{ id: string; name: string; source: MigrationSourceKey }>>([]);
  const [connectionId, setConnectionId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [include, setInclude] = useState({ companies: true, contacts: true, deals: true, leads: true });
  const [statusMap, setStatusMap] = useState<Record<string, LeadStatusKey>>({});
  const [merge, setMerge] = useState(true);

  useEffect(() => {
    fetchMigrationConnections()
      .then((list) => setConnections(list.filter((c) => c.source === source)))
      .catch(() => setConnections([]));
  }, [source]);

  const sourceInput = (): SourceInput =>
    connectionId
      ? { source, connectionId }
      : source === 'amocrm'
        ? { source, baseUrl: baseUrl.trim(), token: token.trim() }
        : { source, webhookUrl: webhookUrl.trim() };

  const canCheck = connectionId || (source === 'amocrm' ? baseUrl.trim() && token.trim() : webhookUrl.trim());

  const check = async () => {
    setBusy(true);
    setErr('');
    setPreview(null);
    try {
      const p = await previewMigration(sourceInput());
      setPreview(p);
      setStatusMap(Object.fromEntries(p.stages.map((s) => [s.key, s.suggested])));
    } catch (e) {
      setErr((e as Error)?.message || m('errors.connect'));
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    setErr('');
    try {
      onStarted(await startMigration({ ...sourceInput(), include: { ...include, leads: include.leads && !!preview?.hasLeadsEntity }, statusMap, mergeExisting: merge }));
    } catch (e) {
      setErr((e as Error)?.message || m('errors.start'));
      setBusy(false);
    }
  };

  const pipelines = useMemo(() => {
    const g = new Map<string, MigrationPreview['stages']>();
    for (const s of preview?.stages || []) g.set(s.pipeline, [...(g.get(s.pipeline) || []), s]);
    return [...g.entries()];
  }, [preview]);

  const entities = (['companies', 'contacts', 'deals', ...(preview?.hasLeadsEntity ? ['leads'] : [])] as Array<keyof typeof include>);

  return (
    <div className="flex flex-col gap-4">
      <Step n={1} title={m(`connect.title.${source}`)}>
        {connections.length > 0 && (
          <label className="block mb-3">
            <span className="block text-[12px] text-[#555] mb-1">{m('connect.existing')}</span>
            <select className={select} value={connectionId} onChange={(e) => { setConnectionId(e.target.value); setPreview(null); }}>
              <option value="">{m('connect.manual')}</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
        {!connectionId &&
          (source === 'amocrm' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="block text-[12px] text-[#555] mb-1">{m('connect.amoUrl')}</span>
                <input className={input} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://company.amocrm.ru" />
              </label>
              <label className="block">
                <span className="block text-[12px] text-[#555] mb-1">{m('connect.amoToken')}</span>
                <input className={input} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
              </label>
              <p className="sm:col-span-2 text-[11.5px] text-[#888] leading-relaxed">{m('connect.amoHelp')}</p>
            </div>
          ) : (
            <div>
              <label className="block">
                <span className="block text-[12px] text-[#555] mb-1">{m('connect.b24Url')}</span>
                <input className={input} value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://company.bitrix24.ru/rest/1/xxxxxxxx/" />
              </label>
              <p className="mt-2 text-[11.5px] text-[#888] leading-relaxed">{m('connect.b24Help')}</p>
            </div>
          ))}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button type="button" className={btnDark} disabled={!canCheck || busy} onClick={() => void check()}>
            {busy && !preview ? m('connect.checking') : m('connect.check')}
          </button>
          {err && !preview && <span className="text-[12.5px] text-[#b42318] break-words">{err}</span>}
        </div>
      </Step>

      {preview && (
        <Step n={2} title={m('preview.title', { name: preview.account.name })}>
          <div className="grid gap-2 sm:grid-cols-2 mb-4">
            {entities.map((k) => (
              <label key={k} className="flex items-center gap-2.5 text-[13px] text-[#222] cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-[#222]" checked={include[k]} onChange={(e) => setInclude((s) => ({ ...s, [k]: e.target.checked }))} />
                <span>
                  {m(`entity.${k}`)}
                  {typeof preview.counts[k] === 'number' && <span className="text-[#888]"> · {preview.counts[k]}</span>}
                </span>
              </label>
            ))}
          </div>

          <div className="rounded-lg bg-[#fafafa] border border-[#f0f0f0] px-3 py-2.5 text-[12px] text-[#555] mb-4">
            {preview.users.total
              ? m('preview.users', { matched: preview.users.matched, total: preview.users.total })
              : m('preview.usersUnknown')}
            {preview.users.unmatched.length > 0 && (
              <div className="mt-1 text-[#888]">{m('preview.usersHint', { names: preview.users.unmatched.slice(0, 8).join(', ') })}</div>
            )}
          </div>

          {(include.deals || include.leads) && pipelines.length > 0 && (
            <div className="mb-4">
              <div className="text-[13px] font-medium text-[#222] mb-1">{m('preview.stagesTitle')}</div>
              <p className="text-[11.5px] text-[#888] mb-2">{m('preview.stagesHint')}</p>
              <div className="flex flex-col gap-3">
                {pipelines.map(([pipeline, stages]) => (
                  <div key={pipeline} className="border border-[#f0f0f0] rounded-lg">
                    <div className="px-3 py-2 text-[11px] font-mono uppercase tracking-[0.08em] text-[#888] border-b border-[#f0f0f0]">{pipeline}</div>
                    <div className="divide-y divide-[#f5f5f5]">
                      {stages.map((s) => (
                        <div key={s.key} className="flex items-center justify-between gap-3 px-3 py-1.5">
                          <span className="text-[12.5px] text-[#222] min-w-0 truncate">{s.name}</span>
                          <select
                            className={select}
                            value={statusMap[s.key] || s.suggested}
                            onChange={(e) => setStatusMap((mm) => ({ ...mm, [s.key]: e.target.value as LeadStatusKey }))}
                          >
                            {STATUSES.map((st) => (
                              <option key={st} value={st}>{m(`status.${st}`)}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-start gap-2.5 text-[12.5px] text-[#222] cursor-pointer mb-4">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#222]" checked={merge} onChange={(e) => setMerge(e.target.checked)} />
            <span>
              {m('preview.merge')}
              <span className="block text-[11.5px] text-[#888]">{m('preview.mergeHint')}</span>
            </span>
          </label>
          <p className="text-[11.5px] text-[#888] mb-4">{m('preview.quietNote')}</p>

          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" className={btnDark} disabled={busy || !entities.some((k) => include[k])} onClick={() => void start()}>
              {m('preview.start')}
            </button>
            {err && <span className="text-[12.5px] text-[#b42318] break-words">{err}</span>}
          </div>
        </Step>
      )}
    </div>
  );
};

const FileWizard: React.FC<{ onStarted: (r: MigrationRun) => void }> = ({ onStarted }) => {
  const { t } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`crm.migration.${k}`, o);
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<FileTarget>('contacts');
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [merge, setMerge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const pick = async (f: File | null | undefined) => {
    if (!f) return;
    setFile(f);
    setErr('');
    setPreview(null);
    setBusy(true);
    try {
      const p = await previewMigrationFile(f);
      setPreview(p);
      setMapping(p.suggested[target]);
    } catch (e) {
      setErr((e as Error)?.message || m('errors.file'));
    } finally {
      setBusy(false);
    }
  };

  const changeTarget = (tg: FileTarget) => {
    setTarget(tg);
    if (preview) setMapping(preview.suggested[tg]);
  };

  const start = async () => {
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      onStarted(await startMigrationFile(file, target, mapping, merge));
    } catch (e) {
      setErr((e as Error)?.message || m('errors.start'));
      setBusy(false);
    }
  };

  const mapped = Object.values(mapping).filter((v) => v && v !== 'skip').length;

  return (
    <div className="flex flex-col gap-4">
      <Step n={1} title={m('file.title')}>
        <div className="flex flex-wrap gap-2 mb-3" role="radiogroup">
          {FILE_TARGETS.map((tg) => (
            <button
              key={tg}
              type="button"
              role="radio"
              aria-checked={target === tg}
              onClick={() => changeTarget(tg)}
              className={`px-3 py-1.5 rounded-lg border text-[12.5px] font-medium transition-colors ${
                target === tg ? 'border-[#222] bg-[#222] text-white' : 'border-[#e7e7e7] bg-white text-[#222] hover:border-[#222]'
              }`}
            >
              {m(`entity.${tg}`)}
            </button>
          ))}
        </div>
        <label className={`${btnLight} cursor-pointer`}>
          <input type="file" hidden accept=".xlsx,.csv,text/csv" onChange={(e) => void pick(e.target.files?.[0])} />
          {file ? m('file.change') : m('file.choose')}
        </label>
        {file && <span className="ml-3 text-[12.5px] text-[#555]">{file.name}</span>}
        <p className="mt-2 text-[11.5px] text-[#888]">{m('file.help')}</p>
        {busy && !preview && <p className="mt-2 text-[12px] text-[#888]">{m('file.reading')}</p>}
        {err && !preview && <p className="mt-2 text-[12.5px] text-[#b42318] break-words">{err}</p>}
      </Step>

      {preview && (
        <Step n={2} title={m('file.mapTitle', { count: preview.totalRows })}>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[12.5px] min-w-[480px]">
              <thead>
                <tr className="text-left text-[#888] font-mono text-[10px] uppercase tracking-[0.08em]">
                  <th className="py-1.5 px-1 font-medium">{m('file.column')}</th>
                  <th className="py-1.5 px-1 font-medium">{m('file.example')}</th>
                  <th className="py-1.5 px-1 font-medium">{m('file.field')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.columns.map((col, ci) => (
                  <tr key={col} className="border-t border-[#f0f0f0] align-middle">
                    <td className="py-1.5 px-1 font-medium text-[#222] break-words max-w-[180px]">{col}</td>
                    <td className="py-1.5 px-1 text-[#888] truncate max-w-[220px]">{preview.sample.map((r) => r[ci]).find((v) => v) || '—'}</td>
                    <td className="py-1.5 px-1">
                      <select className={select} value={mapping[col] || 'skip'} onChange={(e) => setMapping((mm) => ({ ...mm, [col]: e.target.value }))}>
                        <option value="skip">{m('file.skip')}</option>
                        {preview.fields[target].map((f) => (
                          <option key={f} value={f} disabled={f !== mapping[col] && Object.values(mapping).includes(f)}>
                            {m(`field.${f}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="flex items-start gap-2.5 text-[12.5px] text-[#222] cursor-pointer mt-4 mb-4">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#222]" checked={merge} onChange={(e) => setMerge(e.target.checked)} />
            <span>
              {m('file.merge')}
              <span className="block text-[11.5px] text-[#888]">{m(`file.mergeHint.${target}`)}</span>
            </span>
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" className={btnDark} disabled={busy || !mapped} onClick={() => void start()}>
              {m('file.start', { count: preview.totalRows })}
            </button>
            {err && <span className="text-[12.5px] text-[#b42318] break-words">{err}</span>}
          </div>
        </Step>
      )}
    </div>
  );
};

const CrmMigrationPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`crm.migration.${k}`, o);
  const [params, setParams] = useSearchParams();
  const fromQuery = params.get('source');
  const [source, setSource] = useState<Source | null>(fromQuery === 'amocrm' || fromQuery === 'bitrix24' || fromQuery === 'file' ? fromQuery : null);
  const [history, setHistory] = useState<MigrationRun[]>([]);
  const [active, setActive] = useState<MigrationRun | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetchMigrationRuns();
      setHistory(r.runs);
      const running = r.runs.find((x) => x.status === 'running');
      if (running) setActive((cur) => cur ?? running);
    } catch {
      setHistory([]);
    }
  }, []);
  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const run = useRun(active, () => void loadHistory());

  const choose = (s: Source) => {
    setSource(s);
    setActive(null);
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set('source', s);
      return n;
    }, { replace: true });
  };

  const SOURCES: Array<{ key: Source; mark: string; bg: string }> = [
    { key: 'amocrm', mark: 'am', bg: '#2a5bd7' },
    { key: 'bitrix24', mark: 'B24', bg: '#2fc7f7' },
    { key: 'file', mark: 'XLS', bg: '#1f8a5e' },
  ];
  const dateFmt = (iso: string) => new Date(iso).toLocaleString(i18n.language || 'ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <MainLayout>
      <div>
        <div className="pb-5 border-b border-[#e7e7e7] mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#222]" />
            <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-[#888]">{m('eyebrow')}</span>
          </div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#222] leading-tight">{m('title')}</h1>
          <p className="text-[13px] text-[#888] mt-1.5 max-w-[600px] leading-[1.45]">{m('subtitle')}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mb-5">
          {SOURCES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => choose(s.key)}
              aria-pressed={source === s.key}
              className={`${card} text-left px-4 py-3.5 flex items-center gap-3 transition-all ${
                source === s.key ? 'border-[#222] shadow-[0_0_0_1px_#222]' : 'hover:border-[#bbb]'
              }`}
            >
              <span className="w-10 h-10 rounded-[10px] text-white font-bold text-[12px] flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                {s.mark}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-[#222]">{m(`source.${s.key}.name`)}</span>
                <span className="block text-[11.5px] text-[#888] leading-snug">{m(`source.${s.key}.hint`)}</span>
              </span>
            </button>
          ))}
        </div>

        {run ? (
          <section className={`${card} p-5 mb-5`}>
            <RunProgress run={run} />
            {run.status !== 'running' && (
              <button type="button" className={`${btnLight} mt-4`} onClick={() => setActive(null)}>
                {m('progress.again')}
              </button>
            )}
          </section>
        ) : source === 'file' ? (
          <FileWizard onStarted={setActive} />
        ) : source ? (
          <CrmSourceWizard key={source} source={source} onStarted={setActive} />
        ) : null}

        {history.length > 0 && (
          <div className="mt-7">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#888] font-medium whitespace-nowrap">{m('history')}</span>
              <div className="flex-1 h-px bg-[#f0f0f0]" />
            </div>
            <div className="flex flex-col gap-2">
              {history.map((h) => {
                const created = Object.values(h.counters || {}).reduce((n, c) => n + c.created, 0);
                const updated = Object.values(h.counters || {}).reduce((n, c) => n + c.updated, 0);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setActive(h)}
                    className={`${card} px-4 py-2.5 flex items-center gap-3 text-left hover:border-[#bbb] transition-colors`}
                  >
                    <span className="text-[12.5px] font-medium text-[#222] w-[110px] shrink-0">{m(`source.${h.source}.name`)}</span>
                    <span className="text-[12px] text-[#888] flex-1 min-w-0 truncate">
                      {dateFmt(h.startedAt)} · {m('historyLine', { created, updated })}
                    </span>
                    <span className={`text-[11.5px] font-medium ${h.status === 'done' ? 'text-[#1f8a5e]' : h.status === 'failed' ? 'text-[#b42318]' : 'text-[#9a5b00]'}`}>
                      {m(`runStatus.${h.status}`, { defaultValue: h.status })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default CrmMigrationPage;
