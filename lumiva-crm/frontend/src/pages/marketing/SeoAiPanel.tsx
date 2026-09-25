/**
 * «ИИ-ассистент» на странице SEO: сотрудник-ИИ, который раз в неделю разбирает назначенный сайт
 * (Search Console + PageSpeed + проверка страниц), даёт оценку и рекомендации и шлёт отчёт на почту.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import {
  deleteSeoAiReport,
  emailSeoAiReport,
  fetchSeoAiAccess,
  type SeoAiAccess,
  fetchSeoAiAgent,
  fetchSeoAiReport,
  fetchSeoAiReports,
  runSeoAi,
  updateSeoAiAgent,
  type SeoAiAgent,
  type SeoAiQueryRow,
  type SeoAiReport,
  type SeoAiReportSummary,
  type SeoAiTotals,
} from '../../api/seo';
import { ApiError } from '../../api/client';
import { fetchProjects } from '../../api/projects';
import { fetchStaff } from '../../api/staff';
import { getLocale } from '../../i18n/utils';
import { cl, Ic } from '../contacts/CrmListShared';

const TONE = { good: '#1f8a5e', ok: '#c08319', poor: '#cc2f47' } as const;
const tone = (v: number) => TONE[v >= 80 ? 'good' : v >= 50 ? 'ok' : 'poor'];
const STAGES = ['gsc', 'crawl', 'psi', 'ai'] as const;
const LANGS = ['ru', 'en', 'tr'] as const;
type Section = 'recs' | 'queries' | 'pages' | 'speed';

const I = {
  spark: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </>
  ),
  play: <path d="M7 5l12 7-12 7z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
    </>
  ),
  ext: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </>
  ),
  check: <path d="M5 12l4 4 10-10" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  chev: <path d="M6 9l6 6 6-6" />,
};

const ScoreRing: React.FC<{ value: number; size?: number }> = ({ value, size = 84 }) => {
  const stroke = 7;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const col = tone(value);
  return (
    <div className="seo-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (Math.min(100, Math.max(0, value)) / 100) * c}
        />
      </svg>
      <div className="num" style={{ color: col, fontSize: size > 70 ? 26 : 16 }}>
        {value}
      </div>
    </div>
  );
};

const splitList = (s: string) =>
  s
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);

const hostOf = (u: string | null | undefined) => (u || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const pathOf = (u: string) => {
  try {
    const p = new URL(u);
    return p.pathname === '/' ? p.hostname : p.pathname + p.search;
  } catch {
    return u;
  }
};

function listTimezones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (fn) return fn('timeZone');
  } catch {
    /* старый браузер */
  }
  return ['Europe/Istanbul', 'Europe/Moscow', 'Europe/Kyiv', 'Europe/Berlin', 'Europe/London', 'Asia/Dubai', 'America/New_York', 'UTC'];
}

type Draft = {
  pages: string;
  keywords: string;
  recipients: string;
  weekday: number;
  hour: number;
  timezone: string;
  language: string;
  focus: string;
  tasksEnabled: boolean;
  /** '' — проект «SEO · сайт» создаётся автоматически */
  taskProjectId: string;
  taskAssigneeId: string;
  alertsEnabled: boolean;
};

const toDraft = (a: SeoAiAgent): Draft => ({
  pages: (a.pages || []).join('\n'),
  keywords: (a.keywords || []).join('\n'),
  recipients: (a.recipients || []).join(', '),
  weekday: a.weekday,
  hour: a.hour,
  timezone: a.timezone,
  language: a.language,
  focus: a.focus || '',
  tasksEnabled: a.tasksEnabled !== false,
  taskProjectId: a.taskProjectId || '',
  taskAssigneeId: a.taskAssigneeId || '',
  alertsEnabled: a.alertsEnabled !== false,
});

/**
 * Вкладка «ИИ-ассистент»: открыта только при активном ИИ-сотруднике «SEO-менеджер» (занимает место
 * из лимита ИИ-сотрудников тарифа); иначе — экран «нанять / активировать».
 */
export const SeoAiSection: React.FC<{ site: string | null }> = ({ site }) => {
  const { t } = useTranslation();
  const g = (key: string, opts?: Record<string, unknown>) => t(`crm.marketingSeo.ai.gate.${key}`, opts) as string;
  const [access, setAccess] = useState<SeoAiAccess | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSeoAiAccess()
      .then((a) => alive && setAccess(a))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return <div className="seo-note err"><span className="sp">{t('crm.marketingSeo.ai.errors.load')}</span></div>;
  if (!access) return <div className="seo-skel" style={{ height: 220 }} aria-busy="true" />;
  if (access.allowed && access.employee) return <SeoAiPanel site={site} employee={access.employee} />;

  const emp = access.employee;
  const free = access.limit == null ? null : Math.max(0, access.limit - access.used);
  const statusLabel = emp ? (i18n_exists(t, `crm.marketingSeo.ai.gate.status.${emp.status}`) ? g(`status.${emp.status}`) : emp.status) : '';
  // отключённый сотрудник не занимает место — чтобы включить его снова, место должно быть свободно
  const needsSlot = !emp || emp.status === 'disabled';
  const blocked = needsSlot && !access.canHire;

  return (
    <div className="sai">
      <div className="seo-card sai-gate">
        <div className="sai-ava lg">
          <Ic d={I.spark} size={26} sw={1.7} />
        </div>
        <h2>{g('title')}</h2>
        <p className="sai-gate-sub">{g('sub')}</p>
        <ul className="sai-gate-fn">
          {(t('crm.aiEmployees.roleCatalog.seo_manager.functions', { returnObjects: true }) as unknown as string[]).map((f) => (
            <li key={f}>
              <Ic d={I.check} size={12} sw={2.2} /> {f}
            </li>
          ))}
        </ul>
        {emp && <div className="seo-note warn sai-gate-note"><span className="sp">{g('inactive', { name: emp.name, status: statusLabel })}</span></div>}
        {!access.planAllowed ? (
          <div className="seo-note warn sai-gate-note"><span className="sp">{g('planLocked')}</span></div>
        ) : blocked ? (
          <div className="seo-note warn sai-gate-note">
            <span className="sp">{emp ? g('disabledNoSlots', { name: emp.name, used: access.used, limit: access.limit }) : g('noSlots', { used: access.used, limit: access.limit })}</span>
          </div>
        ) : null}
        <div className="sai-gate-act">
          {emp ? (
            <Link className="btn btn-primary" to={`/ai-employees/${emp.id}`}>
              {g('open')}
            </Link>
          ) : (
            access.planAllowed &&
            !blocked && (
              <Link className="btn btn-primary" to="/ai-employees/new?role=seo_manager">
                <Ic d={I.play} size={12} />
                {g('hire')}
              </Link>
            )
          )}
          <Link className="btn" to="/ai-employees">
            {g('allEmployees')}
          </Link>
          {(!access.planAllowed || blocked) && (
            <Link className="btn" to="/billing">
              {g('upgrade')}
            </Link>
          )}
        </div>
        {access.planAllowed && needsSlot && (
          <div className="sai-muted sai-gate-slots">{free == null ? g('slotsUnlimited') : g('slots', { free, limit: access.limit })}</div>
        )}
      </div>
    </div>
  );
};

const i18n_exists = (t: (k: string) => unknown, key: string) => t(key) !== key;

type SeoAiEmployee = NonNullable<SeoAiAccess['employee']>;

/** site — ресурс, выбранный переключателем «Ресурс» в шапке страницы SEO. */
const SeoAiPanel: React.FC<{ site: string | null; employee: SeoAiEmployee }> = ({ site, employee }) => {
  const { t, i18n } = useTranslation();
  const locale = getLocale(i18n.language);
  const [searchParams, setSearchParams] = useSearchParams();
  const k = (key: string, opts?: Record<string, unknown>) => t(`crm.marketingSeo.ai.${key}`, opts) as string;

  const [agent, setAgent] = useState<SeoAiAgent | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reports, setReports] = useState<SeoAiReportSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('report'));
  const [report, setReport] = useState<SeoAiReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailOnRun, setEmailOnRun] = useState(false);
  const [section, setSection] = useState<Section>('recs');
  const [openRec, setOpenRec] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const timezones = useMemo(listTimezones, []);
  // списки для настроек задач: проекты и сотрудники (раздел «Сотрудники»)
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    fetchProjects()
      .then((r) => setProjects(r.items.map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => setProjects([]));
    fetchStaff()
      .then((list) => setStaff(list.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.fullName || u.email }))))
      .catch(() => setStaff([]));
  }, []);

  const errText = useCallback(
    (e: unknown, fallback: string) => {
      const code = e instanceof ApiError ? e.code : undefined;
      if (code && i18n.exists(`crm.marketingSeo.ai.errors.${code}`)) return k(`errors.${code}`);
      return e instanceof Error && e.message ? e.message : fallback;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language],
  );

  const reportError = (r: SeoAiReportSummary) => {
    const code = r.error || '';
    return i18n.exists(`crm.marketingSeo.ai.errors.${code}`) ? k(`errors.${code}`) : k('errors.generic', { msg: code || '—' });
  };

  const fmtDate = (iso: string | null | undefined, withWeekday = false) =>
    iso
      ? new Date(iso).toLocaleString(locale, {
          ...(withWeekday ? { weekday: 'short' as const } : {}),
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';
  const nf = (n: number | null | undefined, d = 0) =>
    n == null ? '—' : n.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
  const weekdayName = (d: number) => new Date(Date.UTC(2024, 0, 7 + d, 12)).toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' });

  // ---- загрузка
  useEffect(() => {
    let alive = true;
    // ресурс ещё не выбран — показываем подсказку, не дёргая API
    if (!site) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [a, list] = await Promise.all([fetchSeoAiAgent(site), fetchSeoAiReports(site)]);
        if (!alive) return;
        setAgent(a);
        setDraft(toDraft(a));
        setReports(list);
        setSelectedId((cur) => (cur && list.some((r) => r.id === cur) ? cur : list[0]?.id ?? null));
      } catch (e) {
        if (alive) setError(errText(e, k('errors.load')));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = reports.find((r) => r.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId || !selected || selected.status !== 'done') {
      setReport(null);
      return;
    }
    if (report?.id === selectedId) return;
    let alive = true;
    fetchSeoAiReport(selectedId)
      .then((r) => alive && (setReport(r), setOpenRec(0)))
      .catch((e) => alive && setError(errText(e, k('errors.load'))));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.status]);

  // прогон идёт в фоне на сервере — опрашиваем список, пока он не завершится
  const anyRunning = reports.some((r) => r.status === 'running');
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    if (!anyRunning) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const list = await fetchSeoAiReports(site);
        setReports(list);
        if (!list.some((r) => r.status === 'running')) fetchSeoAiAgent(site).then(setAgent).catch(() => undefined);
      } catch {
        /* следующая попытка */
      }
    }, 3000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [anyRunning]);

  const selectReport = (id: string) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set('report', id);
    setSearchParams(next, { replace: true });
  };

  // ---- действия
  const save = async (extra?: Partial<SeoAiAgent>) => {
    if (!draft) return null;
    setSaving(true);
    setError(null);
    try {
      const next = await updateSeoAiAgent(site, {
        pages: splitList(draft.pages),
        keywords: splitList(draft.keywords),
        recipients: splitList(draft.recipients),
        weekday: draft.weekday,
        hour: draft.hour,
        timezone: draft.timezone,
        language: draft.language,
        focus: draft.focus.trim() || null,
        tasksEnabled: draft.tasksEnabled,
        taskProjectId: draft.taskProjectId || null,
        taskAssigneeId: draft.taskAssigneeId || null,
        alertsEnabled: draft.alertsEnabled,
        ...extra,
      });
      setAgent(next);
      setDraft(toDraft(next));
      return next;
    } catch (e) {
      setError(errText(e, k('errors.save')));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    if (await save()) setStatus(k('settings.saved'));
  };

  const toggleEnabled = async () => {
    if (!agent) return;
    const next = await save({ enabled: !agent.enabled });
    if (next) setStatus(next.enabled ? k('enabledNow', { date: fmtDate(next.nextRunAt, true) }) : k('disabledNow'));
  };

  const run = async () => {
    setStarting(true);
    setError(null);
    setStatus(null);
    try {
      // несохранённые правки настроек должны попасть в этот же прогон
      if (dirty && !(await save())) return;
      const r = await runSeoAi(site, emailOnRun);
      setReports((list) => [r, ...list.filter((x) => x.id !== r.id)]);
      selectReport(r.id);
    } catch (e) {
      setError(errText(e, k('errors.run')));
    } finally {
      setStarting(false);
    }
  };

  const sendEmail = async () => {
    if (!report) return;
    setSending(true);
    setError(null);
    try {
      const res = await emailSeoAiReport(report.id);
      setReports((list) => list.map((r) => (r.id === report.id ? { ...r, emailedTo: res.emailedTo } : r)));
      setStatus(k('report.sent', { list: (agent?.recipients || []).join(', ') }));
    } catch (e) {
      setError(errText(e, k('errors.email')));
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(k('report.confirmDelete'))) return;
    try {
      await deleteSeoAiReport(id);
      const rest = reports.filter((r) => r.id !== id);
      setReports(rest);
      if (selectedId === id) setSelectedId(rest[0]?.id ?? null);
    } catch (e) {
      setError(errText(e, k('errors.delete')));
    }
  };

  const dirty = !!(agent && draft && JSON.stringify(toDraft(agent)) !== JSON.stringify(draft));

  if (loading) {
    return (
      <div aria-busy="true">
        <div className="seo-skel" style={{ height: 120, marginBottom: 16 }} />
        <div className="seo-skel" style={{ height: 360 }} />
      </div>
    );
  }

  const facts = report?.facts || null;
  const body = report?.report || null;
  const running = selected?.status === 'running' ? selected : null;
  const stageIdx = running ? STAGES.indexOf((running.stage || '') as (typeof STAGES)[number]) : -1;

  // ---- рендер секций отчёта
  const kpiCell = (label: string, cur: SeoAiTotals, prev: SeoAiTotals, key: keyof SeoAiTotals, d: number, lowerBetter = false) => {
    const pct = prev[key] ? ((cur[key] - prev[key]) / prev[key]) * 100 : null;
    const good = pct == null ? null : lowerBetter ? pct < 0 : pct > 0;
    return (
      <div className="sai-kpi" key={`${label}-${key}`}>
        <div className="l">{label}</div>
        <div className="v">
          {nf(cur[key], d)}
          {key === 'ctr' ? '%' : ''}
        </div>
        {pct != null && isFinite(pct) && Math.abs(pct) >= 0.5 ? (
          <span className={cl('seo-d', good ? 'up' : 'dn')}>
            {pct > 0 ? '↑' : '↓'} {nf(Math.abs(pct), 1)}%
          </span>
        ) : (
          <span className="seo-d flat">{k('report.flat')}</span>
        )}
      </div>
    );
  };

  const queryTable = (rows: SeoAiQueryRow[], opts: { change?: boolean } = {}) =>
    rows.length ? (
      <div className="sai-table-wrap">
        <table className="sai-table">
          <thead>
            <tr>
              <th>{k('q.cols.query')}</th>
              <th className="n">{k('q.cols.clicks')}</th>
              <th className="n">{k('q.cols.impr')}</th>
              <th className="n">{k('q.cols.ctr')}</th>
              <th className="n">{k('q.cols.pos')}</th>
              {opts.change && <th className="n">{k('q.cols.change')}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.query}>
                <td className="q">{r.query}</td>
                <td className="n">{nf(r.clicks)}</td>
                <td className="n">{nf(r.impressions)}</td>
                <td className="n">{nf(r.ctr, 1)}%</td>
                <td className="n">{nf(r.position, 1)}</td>
                {opts.change && (
                  <td className="n">
                    <span className={cl('seo-d', (r.change || 0) > 0 ? 'up' : 'dn')}>
                      {(r.change || 0) > 0 ? '↑' : '↓'} {nf(Math.abs(r.change || 0), 1)}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="sai-muted">{k('q.empty')}</div>
    );

  const taskStatus = (st: string) => (i18n.exists(`crm.marketingSeo.ai.tasks.status.${st}`) ? k(`tasks.status.${st}`) : st);
  const renderRecs = () =>
    body && (
      <>
        {((body.tasks?.length ?? 0) > 0 || (body.alerts?.length ?? 0) > 0) && (
          <div className="sai-did">
            <h4>{k('tasks.title', { name: employee.name })}</h4>
            <ul>
              {(body.alerts || []).map((a) => (
                <li key={a.key} className="alert">
                  <span className="sai-prio high">{k('tasks.alert')}</span>
                  {k(`alerts.codes.${a.code}`, { url: a.url ? pathOf(a.url) : '', keyword: a.keyword, from: a.from, to: a.to ?? '—', pct: Math.abs(a.pct || 0) })}
                </li>
              ))}
              {(body.tasks || []).map((tk, i) =>
                tk.status === 'skipped' ? (
                  <li key={`s${i}`} className="skip">
                    {k(`tasks.skipped.${tk.reason || 'blocked'}`, { name: employee.name })}
                  </li>
                ) : (
                  <li key={tk.actionId || i}>
                    <span className={cl('sai-tstat', tk.status)}>{taskStatus(tk.status)}</span>
                    <span className="t">{tk.title}</span>
                    {tk.status === 'pending' ? (
                      <Link to="/ai-employees/approvals" className="seo-link">{k('tasks.approve')}</Link>
                    ) : tk.projectId ? (
                      <Link to={`/projects/${tk.projectId}`} className="seo-link">{k('tasks.open')}</Link>
                    ) : null}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
        {(body.wins.length > 0 || body.risks.length > 0) && (
          <div className="sai-two">
            <div className="sai-box good">
              <h4>{k('report.wins')}</h4>
              <ul>{body.wins.length ? body.wins.map((w, i) => <li key={i}>{w}</li>) : <li className="sai-muted">—</li>}</ul>
            </div>
            <div className="sai-box bad">
              <h4>{k('report.risks')}</h4>
              <ul>{body.risks.length ? body.risks.map((w, i) => <li key={i}>{w}</li>) : <li className="sai-muted">—</li>}</ul>
            </div>
          </div>
        )}
        <div className="sai-recs">
          {body.recommendations.map((r, i) => (
            <div key={i} className={cl('sai-rec', openRec === i && 'open')}>
              <button type="button" className="sai-rec-h" onClick={() => setOpenRec(openRec === i ? null : i)} aria-expanded={openRec === i}>
                <span className={cl('sai-prio', r.priority)}>{k(`prio.${r.priority}`)}</span>
                <span className="t">{r.title}</span>
                <span className="sai-chip">{k(`area.${r.area}`)}</span>
                <Ic d={I.chev} size={14} sw={2} className="cv" />
              </button>
              {openRec === i && (
                <div className="sai-rec-b">
                  {r.why && (
                    <p>
                      <b>{k('report.why')}</b> {r.why}
                    </p>
                  )}
                  {r.how && (
                    <p className="how">
                      <b>{k('report.how')}</b> {r.how}
                    </p>
                  )}
                  <div className="meta">
                    {r.page && (
                      <a href={r.page} target="_blank" rel="noopener noreferrer" className="seo-link">
                        {pathOf(r.page)} <Ic d={I.ext} size={11} />
                      </a>
                    )}
                    <span>{k('report.effort', { v: k(`effort.${r.effort}`) })}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {body.contentIdeas.length > 0 && (
          <>
            <h4 className="sai-h4">{k('report.ideas')}</h4>
            <div className="sai-ideas">
              {body.contentIdeas.map((c, i) => (
                <div key={i} className="sai-idea">
                  <div className="t">{c.title}</div>
                  {c.targetQuery && <div className="sai-chip">{c.targetQuery}</div>}
                  {c.why && <div className="d">{c.why}</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </>
    );

  const renderQueries = () => {
    const g = facts?.gsc;
    return (
      <>
        {body && body.keywordOpportunities.length > 0 && (
          <>
            <h4 className="sai-h4">{k('q.opportunities')}</h4>
            <div className="sai-ops">
              {body.keywordOpportunities.map((o, i) => (
                <div key={i} className="sai-op">
                  <div className="h">
                    <b>{o.query}</b>
                    <span className="sai-muted">
                      {o.position != null && k('q.posShort', { n: nf(o.position, 1) })}
                      {o.impressions != null && ` · ${k('q.imprShort', { n: nf(o.impressions) })}`}
                    </span>
                  </div>
                  <div className="d">{o.action}</div>
                </div>
              ))}
            </div>
          </>
        )}
        {!g ? (
          <div className="seo-note warn">
            <span className="sp">{k(`report.noGsc.${facts?.gscNote || 'notConnected'}`)}</span>
          </div>
        ) : (
          <>
            {g.trackedKeywords.length > 0 && (
              <>
                <h4 className="sai-h4">{k('q.tracked')}</h4>
                <div className="sai-table-wrap">
                  <table className="sai-table">
                    <thead>
                      <tr>
                        <th>{k('q.cols.query')}</th>
                        <th className="n">{k('q.cols.pos')}</th>
                        <th className="n">{k('q.cols.change')}</th>
                        <th className="n">{k('q.cols.clicks')}</th>
                        <th className="n">{k('q.cols.impr')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.trackedKeywords.map((kw) => {
                        const ch = kw.position != null && kw.prevPosition != null ? kw.prevPosition - kw.position : null;
                        return (
                          <tr key={kw.keyword}>
                            <td className="q">
                              {kw.keyword}
                              {kw.matchedQuery && kw.matchedQuery.toLowerCase() !== kw.keyword && <small> → {kw.matchedQuery}</small>}
                            </td>
                            <td className="n">{kw.position != null ? nf(kw.position, 1) : <span className="sai-muted">{k('q.notRanking')}</span>}</td>
                            <td className="n">
                              {ch != null && Math.abs(ch) >= 0.1 ? (
                                <span className={cl('seo-d', ch > 0 ? 'up' : 'dn')}>
                                  {ch > 0 ? '↑' : '↓'} {nf(Math.abs(ch), 1)}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="n">{nf(kw.clicks)}</td>
                            <td className="n">{nf(kw.impressions)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <h4 className="sai-h4">{k('q.striking')}</h4>
            <p className="sai-hint">{k('q.strikingHint')}</p>
            {queryTable(g.strikingDistance)}
            <h4 className="sai-h4">{k('q.lowCtr')}</h4>
            <p className="sai-hint">{k('q.lowCtrHint')}</p>
            {queryTable(g.lowCtr)}
            <h4 className="sai-h4">{k('q.movers')}</h4>
            {queryTable(g.movers, { change: true })}
            <h4 className="sai-h4">{k('q.top')}</h4>
            {queryTable(g.topQueries)}
            {g.newQueries.length > 0 && (
              <>
                <h4 className="sai-h4">{k('q.newQ')}</h4>
                {queryTable(g.newQueries)}
              </>
            )}
          </>
        )}
      </>
    );
  };

  const renderPages = () => {
    if (!facts) return null;
    const s = facts.site;
    const notesFor = (url: string) =>
      body?.pageNotes.find((p) => p.url.replace(/\/$/, '') === url.replace(/\/$/, '')) || null;
    return (
      <>
        <div className="sai-site">
          <span className={cl('sai-flag', s.https ? 'ok' : 'bad')}>{s.https ? '✓' : '✕'} HTTPS</span>
          <span className={cl('sai-flag', s.robotsTxt.found && !s.robotsTxt.disallowAll ? 'ok' : 'bad')}>
            {s.robotsTxt.found && !s.robotsTxt.disallowAll ? '✓' : '✕'} robots.txt
            {s.robotsTxt.disallowAll ? ` — ${k('pages.disallowAll')}` : !s.robotsTxt.found ? ` — ${k('pages.missing')}` : ''}
          </span>
          <span className={cl('sai-flag', s.sitemap.found ? 'ok' : 'bad')}>
            {s.sitemap.found ? '✓' : '✕'} sitemap.xml
            {s.sitemap.found ? ` — ${k('pages.urls', { n: s.sitemap.urlCount })}` : ` — ${k('pages.missing')}`}
          </span>
          <span className="sai-flag">
            {k('pages.techScore')}: <b style={{ color: tone(facts.techScore) }}>{facts.techScore}</b>
          </span>
        </div>
        <div className="sai-pages">
          {facts.pages.map((p) => {
            const n = notesFor(p.url);
            return (
              <div key={p.url} className="sai-page">
                <div className="h">
                  <a href={p.finalUrl || p.url} target="_blank" rel="noopener noreferrer" className="u">
                    {pathOf(p.url)}
                  </a>
                  <span className="sai-chip">{k(`pages.source.${p.source}`)}</span>
                  <span className="sp" />
                  {p.status != null && <span className={cl('sai-muted', p.status >= 400 && 'bad')}>HTTP {p.status}</span>}
                  {p.ms != null && <span className="sai-muted">{nf(p.ms / 1000, 1)} {k('pages.sec')}</span>}
                  {p.status != null && p.status < 400 && <span className="sai-muted">{k('pages.words', { n: p.wordCount })}</span>}
                  {n && <span className="sai-pscore" style={{ color: tone(n.score), borderColor: tone(n.score) }}>{n.score}</span>}
                </div>
                {p.title && <div className="ti">{p.title}</div>}
                {p.issues.length > 0 ? (
                  <div className="sai-issues">
                    {p.issues.map((iss, i) => (
                      <span key={i} className={cl('sai-issue', iss.severity)}>
                        {i18n.exists(`crm.marketingSeo.ai.issues.${iss.code}`) ? k(`issues.${iss.code}`, { n: p.imagesNoAlt }) : iss.code}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="sai-issues">
                    <span className="sai-issue ok">{k('pages.noIssues')}</span>
                  </div>
                )}
                {n && n.notes.length > 0 && (
                  <ul className="notes">
                    {n.notes.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderSpeed = () => {
    if (!facts) return null;
    const m = facts.psi.mobile;
    const d = facts.psi.desktop;
    return (
      <>
        {m || d ? (
          <div className="sai-psi">
            {([
              ['mobile', m],
              ['desktop', d],
            ] as const).map(([key, p]) =>
              p ? (
                <div key={key} className="sai-psi-col">
                  <h4>{t(`crm.marketingSeo.ui.psi.${key}`)}</h4>
                  <div className="rings">
                    {(['performance', 'accessibility', 'bestPractices', 'seo'] as const).map((g) => (
                      <div key={g} className="r">
                        <ScoreRing value={p[g]} size={54} />
                        <span>{t(`crm.marketingSeo.ui.psi.gauges.${g}`)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="sai-muted">
                    LCP {nf(p.lcp, 1)} {t('crm.marketingSeo.ui.psi.unitS')} · CLS {nf(p.cls, 2)} · TBT {nf(p.tbt)} {t('crm.marketingSeo.ui.psi.unitMs')}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        ) : (
          <div className="sai-muted" style={{ marginBottom: 12 }}>
            {k('speed.noPsi')}
          </div>
        )}
        <h4 className="sai-h4">{k('speed.audits')}</h4>
        {facts.psi.audits.length ? (
          <div className="sai-audits">
            {facts.psi.audits.map((a) => (
              <div key={a.id} className="sai-audit">
                <i style={{ background: a.score < 0.5 ? TONE.poor : TONE.ok }} />
                <span className="t">{a.title.replace(/`/g, '')}</span>
                <span className="sai-chip">{a.category === 'best-practices' ? t('crm.marketingSeo.ui.psi.gauges.bestPractices') : a.category === 'seo' ? 'SEO' : t('crm.marketingSeo.ui.psi.gauges.performance')}</span>
                {a.displayValue && <span className="sai-muted">{a.displayValue}</span>}
                {a.savingsMs != null && a.savingsMs >= 100 && <span className="sai-muted">{k('speed.savings', { s: nf(a.savingsMs / 1000, 1) })}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="sai-muted">{k('speed.noAudits')}</div>
        )}
      </>
    );
  };

  return (
    <div className="sai">
      {error && (
        <div className="seo-note err" role="alert">
          <span className="sp">{error}</span>
          <button type="button" className="x" onClick={() => setError(null)} aria-label="×">
            ×
          </button>
        </div>
      )}
      {status && !error && (
        <div className="seo-note ok" role="status">
          <span className="sp">{status}</span>
          <button type="button" className="x" onClick={() => setStatus(null)} aria-label="×">
            ×
          </button>
        </div>
      )}

      {/* карточка сотрудника */}
      <div className="sai-hero">
        <Link className="sai-ava" to={`/ai-employees/${employee.id}`} title={employee.name}>
          {employee.avatarUrl && /^(https?:|\/)/.test(employee.avatarUrl) ? (
            <img src={employee.avatarUrl} alt="" />
          ) : (
            <Ic d={I.spark} size={22} sw={1.7} />
          )}
        </Link>
        <div className="sai-hero-main">
          <div className="sai-hero-t">
            <h2>{employee.name}</h2>
            <span className="sai-chip">{t('crm.marketingSeo.ai.gate.role')}</span>
            <span className={cl('seo-conn', agent?.enabled && 'ok')}>
              <span className="dot" />
              {agent?.enabled ? k('statusOn') : k('statusOff')}
            </span>
          </div>
          <div className="sai-hero-sub">{k('sub')}</div>
          <div className="sai-hero-meta">
            {agent?.siteUrl ? (
              <span>
                {k('watching')} <b>{hostOf(agent.siteUrl)}</b>
              </span>
            ) : (
              <span className="bad">{k('noSiteShort')}</span>
            )}
            {agent?.enabled && agent.nextRunAt && (
              <span>
                <Ic d={I.clock} size={12} /> {k('nextRun', { date: fmtDate(agent.nextRunAt, true) })}
              </span>
            )}
            {agent && agent.activeAlerts.length > 0 && (
              <span className="bad">⚠ {k('alerts.active', { count: agent.activeAlerts.length })}</span>
            )}
            {agent?.enabled && agent.recipients.length > 0 && (
              <span>
                <Ic d={I.mail} size={12} /> {agent.recipients.join(', ')}
              </span>
            )}
          </div>
        </div>
        <div className="sai-hero-actions">
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void run()} disabled={starting || !!running || !agent?.siteUrl}>
            <Ic d={I.play} size={12} />
            {running || starting ? k('running') : k('run')}
          </button>
          <label className="sai-check">
            <input type="checkbox" checked={emailOnRun} onChange={(e) => setEmailOnRun(e.target.checked)} />
            {k('runEmail')}
          </label>
          <button type="button" className="btn btn-sm" onClick={() => void toggleEnabled()} disabled={saving}>
            {agent?.enabled ? k('disable') : k('enable')}
          </button>
        </div>
      </div>

      <div className="sai-cols">
        {/* отчёт */}
        <div className="seo-card sai-report">
          {!selected ? (
            <div className="seo-empty">{agent?.siteUrl ? k('empty') : k('noSite')}</div>
          ) : running ? (
            <div className="sai-progress">
              <div className="sai-spin" aria-hidden="true" />
              <h3>{k('progressTitle', { site: hostOf(running.siteUrl) })}</h3>
              <ol>
                {STAGES.map((s, i) => (
                  <li key={s} className={cl(i < stageIdx && 'done', i === stageIdx && 'cur')}>
                    <span className="b">{i < stageIdx ? <Ic d={I.check} size={11} sw={2.4} /> : i + 1}</span>
                    {k(`stages.${s}`)}
                  </li>
                ))}
              </ol>
              <p className="sai-muted">{k('progressHint')}</p>
            </div>
          ) : selected.status === 'failed' ? (
            <div className="seo-empty">
              <div className="seo-note err" style={{ textAlign: 'left' }}>
                <span className="sp">{reportError(selected)}</span>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => void run()} disabled={starting}>
                {k('retry')}
              </button>
            </div>
          ) : !report || !facts || !body ? (
            <div style={{ padding: 18 }}>
              <div className="seo-skel" style={{ height: 90, marginBottom: 12 }} />
              <div className="seo-skel" style={{ height: 240 }} />
            </div>
          ) : (
            <>
              <div className="sai-rh">
                <ScoreRing value={report.score ?? body.score} />
                <div className="sai-rh-main">
                  <div className="k">
                    {k('report.score')} · {hostOf(report.siteUrl)}
                  </div>
                  <p className="sum">{body.summary}</p>
                  <div className="sai-muted">
                    {k('report.generated', { date: fmtDate(report.finishedAt || report.createdAt) })} · {k(`report.trigger.${report.trigger}`)}
                    {body.model && ` · ${body.model}`}
                    {report.emailedTo.length > 0 && ` · ${k('report.emailed', { list: report.emailedTo.join(', ') })}`}
                  </div>
                </div>
                <div className="sai-rh-act">
                  <button type="button" className="btn btn-sm" onClick={() => void sendEmail()} disabled={sending || !(agent?.recipients.length)}>
                    <Ic d={I.mail} size={13} />
                    {sending ? k('report.sending') : k('report.email')}
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => void remove(report.id)} aria-label={k('report.delete')} title={k('report.delete')}>
                    <Ic d={I.trash} size={13} />
                  </button>
                </div>
              </div>

              {facts.gsc && (
                <div className="sai-kpis">
                  <div className="sai-kpi-group">
                    <div className="gl">{k('report.kpiWeek')}</div>
                    <div className="row">
                      {kpiCell(k('q.cols.clicks'), facts.gsc.week, facts.gsc.prevWeek, 'clicks', 0)}
                      {kpiCell(k('q.cols.impr'), facts.gsc.week, facts.gsc.prevWeek, 'impressions', 0)}
                      {kpiCell(k('q.cols.ctr'), facts.gsc.week, facts.gsc.prevWeek, 'ctr', 2)}
                      {kpiCell(k('q.cols.pos'), facts.gsc.week, facts.gsc.prevWeek, 'position', 1, true)}
                    </div>
                  </div>
                  <div className="sai-kpi-group">
                    <div className="gl">{k('report.kpiMonth')}</div>
                    <div className="row">
                      {kpiCell(k('q.cols.clicks'), facts.gsc.month, facts.gsc.prevMonth, 'clicks', 0)}
                      {kpiCell(k('q.cols.impr'), facts.gsc.month, facts.gsc.prevMonth, 'impressions', 0)}
                      {kpiCell(k('q.cols.ctr'), facts.gsc.month, facts.gsc.prevMonth, 'ctr', 2)}
                      {kpiCell(k('q.cols.pos'), facts.gsc.month, facts.gsc.prevMonth, 'position', 1, true)}
                    </div>
                  </div>
                </div>
              )}

              {body.nextWeekFocus.length > 0 && (
                <div className="sai-focus">
                  <div className="gl">{k('report.focus')}</div>
                  <ol>
                    {body.nextWeekFocus.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="sai-tabs">
                <div className="seo-seg">
                  {(['recs', 'queries', 'pages', 'speed'] as const).map((s) => (
                    <button key={s} type="button" className={cl(section === s && 'active')} onClick={() => setSection(s)}>
                      {k(`sections.${s}`)}
                      {s === 'recs' && <em>{body.recommendations.length}</em>}
                      {s === 'pages' && <em>{facts.pages.length}</em>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sai-sec">
                {section === 'recs' && renderRecs()}
                {section === 'queries' && renderQueries()}
                {section === 'pages' && renderPages()}
                {section === 'speed' && renderSpeed()}
              </div>
            </>
          )}
        </div>

        {/* настройки + история */}
        <div className="sai-side">
          {draft && (
            <div className="seo-card">
              <div className="seo-card-head">
                <h3>{k('settings.title')}</h3>
                {dirty && <span className="meta">{k('settings.unsaved')}</span>}
              </div>
              <div className="seo-field">
                <span className="l">{k('settings.site')}</span>
                <div className="sai-site-ro">{hostOf(agent?.siteUrl) || '—'}</div>
                <div className="seo-hint">{k('settings.siteHint')}</div>
              </div>
              <div className="seo-field">
                <label className="l" htmlFor="sai-kw">
                  {k('settings.keywords')}
                </label>
                <textarea id="sai-kw" className="seo-input sai-ta" rows={3} value={draft.keywords} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} placeholder={k('settings.keywordsPh')} />
                <div className="seo-hint">{k('settings.keywordsHint')}</div>
              </div>
              <div className="seo-field">
                <label className="l" htmlFor="sai-pages">
                  {k('settings.pages')}
                </label>
                <textarea id="sai-pages" className="seo-input sai-ta" rows={3} value={draft.pages} onChange={(e) => setDraft({ ...draft, pages: e.target.value })} placeholder="https://example.com/services" />
                <div className="seo-hint">{k('settings.pagesHint')}</div>
              </div>
              <div className="seo-field">
                <label className="l" htmlFor="sai-focus">
                  {k('settings.focus')}
                </label>
                <textarea id="sai-focus" className="seo-input sai-ta" rows={3} value={draft.focus} onChange={(e) => setDraft({ ...draft, focus: e.target.value })} placeholder={k('settings.focusPh')} />
              </div>
              <div className="seo-field">
                <label className="l" htmlFor="sai-to">
                  {k('settings.recipients')}
                </label>
                <input id="sai-to" className="seo-input" value={draft.recipients} onChange={(e) => setDraft({ ...draft, recipients: e.target.value })} placeholder="name@company.com" inputMode="email" autoCapitalize="off" />
              </div>
              <div className="seo-field">
                <span className="l">{k('settings.schedule')}</span>
                <div className="sai-grid">
                  <select className="seo-input" value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })} aria-label={k('settings.weekday')}>
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <option key={d} value={d}>
                        {weekdayName(d)}
                      </option>
                    ))}
                  </select>
                  <select className="seo-input" value={draft.hour} onChange={(e) => setDraft({ ...draft, hour: Number(e.target.value) })} aria-label={k('settings.hour')}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                  <select className="seo-input" value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} aria-label={k('settings.timezone')}>
                    {(timezones.includes(draft.timezone) ? timezones : [draft.timezone, ...timezones]).map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                  <select className="seo-input" value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value })} aria-label={k('settings.language')}>
                    {LANGS.map((l) => (
                      <option key={l} value={l}>
                        {k(`settings.langs.${l}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="seo-field">
                <span className="l">{k('tasks.settingsTitle')}</span>
                <label className="sai-check">
                  <input type="checkbox" checked={draft.tasksEnabled} onChange={(e) => setDraft({ ...draft, tasksEnabled: e.target.checked })} />
                  {k('tasks.enable')}
                </label>
                {draft.tasksEnabled && (
                  <div className="sai-grid" style={{ marginTop: 8 }}>
                    <select className="seo-input" value={draft.taskProjectId} onChange={(e) => setDraft({ ...draft, taskProjectId: e.target.value })} aria-label={k('tasks.project')}>
                      <option value="">{k('tasks.projectAuto', { site: hostOf(agent?.siteUrl) })}</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select className="seo-input" value={draft.taskAssigneeId} onChange={(e) => setDraft({ ...draft, taskAssigneeId: e.target.value })} aria-label={k('tasks.assignee')}>
                      <option value="">{k('tasks.noAssignee')}</option>
                      {staff.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <label className="sai-check" style={{ marginTop: 10 }}>
                  <input type="checkbox" checked={draft.alertsEnabled} onChange={(e) => setDraft({ ...draft, alertsEnabled: e.target.checked })} />
                  {k('alerts.enable')}
                </label>
                <div className="seo-hint">
                  {employee.autonomyMode === 'suggest' ? (
                    <>
                      {k('tasks.suggestMode', { name: employee.name })}{' '}
                      <Link to={`/ai-employees/${employee.id}`} className="seo-link">{k('tasks.changeMode')}</Link>
                    </>
                  ) : employee.autonomyMode === 'assisted' ? (
                    k('tasks.assistedMode')
                  ) : (
                    k('tasks.autoMode')
                  )}{' '}
                  {k('alerts.hint')}
                </div>
              </div>
              <div className="seo-field">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => void saveSettings()} disabled={saving || !dirty}>
                  {saving ? k('settings.saving') : k('settings.save')}
                </button>
              </div>
            </div>
          )}

          <div className="seo-card">
            <div className="seo-card-head">
              <h3>{k('history.title')}</h3>
              {reports.length > 0 && <span className="meta">{reports.length}</span>}
            </div>
            {reports.length === 0 ? (
              <div className="seo-empty">{k('history.empty')}</div>
            ) : (
              <div className="sai-hist">
                {reports.map((r) => (
                  <button key={r.id} type="button" className={cl('sai-hist-row', r.id === selectedId && 'on')} onClick={() => selectReport(r.id)}>
                    {r.status === 'done' && r.score != null ? (
                      <span className="sc" style={{ color: tone(r.score), borderColor: tone(r.score) }}>
                        {r.score}
                      </span>
                    ) : (
                      <span className={cl('sc', r.status)}>{r.status === 'running' ? '…' : '!'}</span>
                    )}
                    <span className="m">
                      <b>{fmtDate(r.createdAt)}</b>
                      <small>
                        {hostOf(r.siteUrl)} · {k(`report.trigger.${r.trigger}`)}
                        {r.emailedTo.length > 0 && ' · ✉'}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
