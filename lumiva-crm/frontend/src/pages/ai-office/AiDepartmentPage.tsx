import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { aiOfficeApi, type OfficeConnector, type OfficeDepartment, type OfficeEvent, type OfficeTask } from '../../api/aiOffice';
import { RoomScene, useAmbientLife, type Bubble, type MapDept, type WalkerSpec } from './officeMap';
import { ISSUE_COLOR, IssueFix, OfficeLogo, OfficeShell, agentPhrases, fmtEur, useAgo, useNotify } from './officeShared';
import { TaskDrawer } from './TaskDrawer';
import { DeptImpact, DeptPosts, DeptScenarios } from './DeptImpact';

/** Когда руководитель снова поставит задачи из цели. */
function nextPlan(last: string, everyHours: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  const ms = new Date(last).getTime() + everyHours * 3_600_000 - Date.now();
  if (ms <= 60_000) return t('aiOffice.dept.inMoment');
  const h = Math.floor(ms / 3_600_000), m = Math.round((ms % 3_600_000) / 60_000);
  return h ? t('aiOffice.dept.inHM', { h, m }) : t('aiOffice.dept.inM', { m });
}

const ofx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

/** Куда ведёт результат действия агента. */
function artifactHref(a: OfficeTask['artifacts'][number]): string | null {
  if (a.url) return a.url;
  const id = a.targetId;
  if (!id) return null;
  switch (a.targetType) {
    case 'lead':
      return `/leads/${id}`;
    case 'project':
      return `/projects/${id}`;
    case 'contact':
      return `/contacts/${id}`;
    case 'company':
      return `/companies/${id}`;
    case 'sale':
    case 'sales':
      return `/sales/${id}`;
    default:
      return null;
  }
}

export function AiDepartmentPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const notify = useNotify();
  const ago = useAgo();
  const night = false;
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [ask, setAsk] = useState('');
  const [asking, setAsking] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [dept, setDept] = useState<OfficeDepartment | null>(null);
  const [all, setAll] = useState<OfficeDepartment[]>([]);
  const [tasks, setTasks] = useState<OfficeTask[]>([]);
  const [events, setEvents] = useState<OfficeEvent[]>([]);
  const [connectors, setConnectors] = useState<OfficeConnector[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [bubble, setBubble] = useState<Bubble>(null);
  const [walkers, setWalkers] = useState<WalkerSpec[]>([]);
  const [notFound, setNotFound] = useState(false);
  const seen = useRef(new Set<string>());

  const load = useCallback(
    async (first = false) => {
      if (!id) return;
      try {
        const [d, ts, ev] = await Promise.all([
          aiOfficeApi.department(id),
          aiOfficeApi.tasks({ departmentId: id, limit: 150 }),
          aiOfficeApi.events({ departmentId: id, limit: 60 }),
        ]);
        setDept(d);
        setTasks(ts);
        // новые события → реплика над столом / «прогулка» руководителя к исполнителю
        const fresh = ev.filter((e) => !seen.current.has(e.id));
        ev.forEach((e) => seen.current.add(e.id));
        setEvents(ev);
        if (!first) {
          [...fresh].reverse().forEach((e, i) => {
            if (e.kind === 'handoff_internal' && e.agentId && e.toAgentId) {
              setWalkers((w) => [...w, { key: e.id, deptId: id, fromAgentId: e.agentId!, toAgentId: e.toAgentId!, text: e.text }]);
            } else if (e.agentId) {
              setTimeout(() => {
                setBubble({ agentId: e.agentId!, text: e.text });
                setTimeout(() => setBubble((b) => (b?.text === e.text ? null : b)), 3000);
              }, i * 900);
            }
          });
        }
      } catch (e: any) {
        if (e?.status === 404) setNotFound(true);
        else if (first) notify.error(e);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  useEffect(() => {
    seen.current = new Set();
    setDept(null);
    setNotFound(false);
    void load(true);
    aiOfficeApi.departments().then(setAll).catch(() => undefined);
    aiOfficeApi.connectors().then(setConnectors).catch(() => undefined);
    const tm = window.setInterval(() => !document.hidden && void load(), 4000);
    return () => window.clearInterval(tm);
  }, [id, load]);

  const mapDept: MapDept | null = useMemo(() => {
    if (!dept) return null;
    const busyIds = new Set(tasks.filter((x) => x.status === 'progress').map((x) => x.agentId));
    return {
      id: dept.id,
      name: dept.name,
      color: dept.color,
      slot: dept.slot,
      active: dept.status === 'active',
      agents: dept.agents.map((a) => ({ id: a.id, title: a.title, isLead: a.isLead, busy: busyIds.has(a.id) })),
    };
  }, [dept, tasks]);

  const ambient = useAmbientLife(mapDept ? [mapDept] : [], (_d, agentId) => {
    const ph = agentPhrases(t, tasks, events, agentId, !!dept?.agents.find((a) => a.id === agentId)?.isLead);
    return ph[Math.floor(Math.random() * ph.length)] ?? null;
  }, 3200);

  if (notFound) {
    return (
      <OfficeShell title={t('aiOffice.dept.notFound')}>
        <Link className="ofp-btn pri" to="/ai-office">{t('aiOffice.dept.toOffice')}</Link>
      </OfficeShell>
    );
  }
  if (!dept || !mapDept) {
    return (
      <OfficeShell title={t('aiOffice.common.loading')}>
        <div className="of-none">{t('aiOffice.common.loading')}</div>
      </OfficeShell>
    );
  }

  const by = (st: string[]) => tasks.filter((x) => st.includes(x.status));
  const doing = by(['progress', 'backlog']);
  const waiting = by(['waiting', 'blocked']);
  const done = by(['done', 'failed', 'rejected', 'foreign']).slice(0, 40);
  const live = dept.live;
  const on = dept.status === 'active';
  const issue = dept.issues?.[0];

  const toggle = async () => {
    try {
      setDept(on ? await aiOfficeApi.pause(dept.id) : await aiOfficeApi.resume(dept.id));
    } catch (e) {
      notify.error(e);
    }
  };
  const decide = async (tid: string, ok: boolean) => {
    setBusy(tid);
    try {
      if (ok) {
        const r = await aiOfficeApi.approve(tid);
        if (r.errors.length) notify.error(r.errors.join('; '));
      } else {
        await aiOfficeApi.reject(tid);
      }
      await load();
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(null);
    }
  };
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      notify.error(e);
    }
  };
  const stateText = (s?: string) => t(`aiOffice.agentState.${s || 'idle'}`);
  const connOf = (k: string) => connectors.find((c) => c.key === k);

  return (
    <OfficeShell
      title={dept.name}
      sub={t('aiOffice.dept.sub', { count: dept.agents.length, engine: t(`aiOffice.engine.${dept.engine.mode}`) })}
      right={
        <>
          <button className={ofx('ofp-btn', on ? 'ok' : 'warn')} onClick={toggle} title={on ? t('aiOffice.dept.pauseHint') : ''}>
            <span className="ofp-dot" style={{ background: on ? 'var(--of-ok)' : 'var(--of-warn)' }} />
            {on ? t('aiOffice.dept.working') : t(`aiOffice.paused.${dept.pausedReason || 'manual'}`)}
          </button>
          <Link className="ofp-btn" to={`/ai-office/departments/${dept.id}/edit`}>{t('aiOffice.dept.configure')}</Link>
          <Link className="ofp-btn pri" to="/ai-office">{t('aiOffice.dept.toOffice')}</Link>
        </>
      }
    >
      <div className="odp-tabs">
        {all.map((x) => (
          <button key={x.id} className={x.id === dept.id ? 'on' : ''} onClick={() => navigate(`/ai-office/departments/${x.id}`)}>
            <i style={{ background: x.color }} />
            {x.name}
          </button>
        ))}
        <Link to="/ai-office/departments/new" className="add">+ {t('aiOffice.dept.addDept')}</Link>
      </div>

      {dept.curator && (
        <div className="ofp-card odp-cur">
          <div className="av">{dept.curator.name.slice(0, 1).toUpperCase()}</div>
          <div className="m">
            <span className="ofp-k">{t('aiOffice.curator.title')}</span>
            <b>
              <Link to={`/ai-employees/${dept.curator.id}`}>{dept.curator.name}</Link>
              {dept.curator.status !== 'active' && <em className="warn"> · {t('aiOffice.curator.pausedLong')}</em>}
            </b>
            <span>{t('aiOffice.curator.decides')}</span>
          </div>
          <div className="st">
            <div><b>{dept.curator.week.approved}</b><span>{t('aiOffice.curator.approved')}</span></div>
            <div><b>{dept.curator.week.revised}</b><span>{t('aiOffice.curator.revised')}</span></div>
            <div><b>{dept.curator.week.escalated}</b><span>{t('aiOffice.curator.escalated')}</span></div>
          </div>
        </div>
      )}

      {(dept.issues?.length ?? 0) > 0 && (
        <div className="ofp-card odp-iss">
          {dept.issues!.map((i) => (
            <div key={i.id} className="odp-is" style={{ ['--ic' as any]: ISSUE_COLOR[i.kind] }}>
              <span className="ofp-tag" style={{ color: ISSUE_COLOR[i.kind], borderColor: ISSUE_COLOR[i.kind] }}><i />{t(`aiOffice.issueKind.${i.kind}`)}</span>
              <div className="m">
                <b>{i.title}</b>
                <span>{dept.agents.find((a) => a.id === i.agentId)?.title ?? ''} · {ago(i.createdAt)}{i.detail ? ` — ${i.detail}` : ''}</span>
              </div>
              <div className="acts">
                <button className="ofp-btn" onClick={() => act(() => aiOfficeApi.resolveIssue(i.id))}>{t('aiOffice.dept.resolved')}</button>
                <IssueFix className="ofp-btn pri" issue={i} onDone={() => void load()} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="odp-hero">
        <div className={ofx('ofp-card odp-room', night && 'night')} style={{ ['--dc' as any]: dept.color }}>
          <div className="odp-room-tag">
            <span className={ofx('ofp-tag live', on ? 'ok' : 'warn')}><i />{on ? t('aiOffice.dept.live') : t('aiOffice.dept.pausedShort')}</span>
          </div>
          <div className={ofx('odp-room-v', !on && 'paused')}>
            <RoomScene
              d={mapDept}
              night={night}
              bubble={bubble ?? ambient.bubbles[dept.id] ?? null}
              walkers={[...walkers, ...ambient.walkers]}
              onWalkerDone={(k) => (k.startsWith('amb-') ? ambient.done(k) : setWalkers((w) => w.filter((x) => x.key !== k)))}
              issue={issue ? { kind: issue.kind, agentId: issue.agentId, label: t(`aiOffice.issueKind.${issue.kind}`).toLowerCase(), color: ISSUE_COLOR[issue.kind] } : undefined}
            />
          </div>
        </div>
        <div className="odp-side">
          <div className="odp-kpis">
            <div>
              <span className="ofp-k">{t('aiOffice.dept.kInWork')}</span>
              <b className="ofp-big">{live?.doing ?? 0}</b>
            </div>
            <div className={ofx((live?.waiting ?? 0) > 0 && 'warn')}>
              <span className="ofp-k">{t('aiOffice.dept.kWaiting')}</span>
              <b className="ofp-big">{live?.waiting ?? 0}</b>
            </div>
            <div>
              <span className="ofp-k">{t('aiOffice.dept.kDoneToday')}</span>
              <b className="ofp-big">{live?.doneToday ?? 0}</b>
            </div>
            <div>
              <span className="ofp-k">{t('aiOffice.dept.kSpend', { limit: fmtEur(dept.monthlyBudgetCents) })}</span>
              <b className="ofp-big">{fmtEur(live?.spendMonthCents ?? 0)}</b>
            </div>
          </div>
          <div className="ofp-card ofp-card-b odp-mission">
            <span className="ofp-k">{t('aiOffice.dept.mission')}</span>
            <p>{dept.mission || t('aiOffice.dept.noMission')}</p>
            <div className="odp-conns">
              {dept.connectors.map((k) => {
                const c = connOf(k);
                return c ? (
                  <span key={k} className="ofp-tag" title={t(`aiOffice.connStatus.${c.status}`)}>
                    <OfficeLogo c={c} size={18} off={c.status !== 'ok'} />
                    {c.name}
                  </span>
                ) : null;
              })}
              <span className="ofp-tag">{t(`aiOffice.engine.${dept.engine.mode}`)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="odp-hero">
        <div className="ofp-card ofp-card-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="ofp-k">{t('aiOffice.dept.askTitle')}</span>
          <form
            className="odp-ask"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!ask.trim()) return;
              setAsking(true);
              try {
                const task = await aiOfficeApi.createTask({ departmentId: dept.id, title: ask.trim() });
                setAsk('');
                setOpenTask(task.id);
                await load();
              } catch (err) {
                notify.error(err);
              } finally {
                setAsking(false);
              }
            }}
          >
            <input className="ofp-in" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={t('aiOffice.dept.askPh')} />
            <button className="ofp-btn pri" disabled={asking || !ask.trim()}>{t('aiOffice.dept.askBtn')}</button>
          </form>
          <em className="ofp-k" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12, fontStyle: 'normal' }}>{t('aiOffice.dept.askHint')}</em>
        </div>
        <div className="ofp-card ofp-card-b odp-plan">
          <div className="m">
            <span className="ofp-k">{t('aiOffice.dept.planTitle')}</span>
            <b>
              {dept.workHours === 'on_demand'
                ? t('aiOffice.dept.planOnDemand')
                : !dept.mission.trim()
                  ? t('aiOffice.dept.planNoGoal')
                  : dept.lastPlannedAt
                    ? t('aiOffice.dept.planNext', { when: nextPlan(dept.lastPlannedAt, dept.proactiveEveryHours, t) })
                    : t('aiOffice.dept.planSoon')}
            </b>
            <span>{dept.lastPlannedAt ? t('aiOffice.dept.planLast', { ago: ago(dept.lastPlannedAt) }) : t('aiOffice.dept.planNever')}</span>
          </div>
          <button
            className="ofp-btn"
            disabled={planning || !dept.mission.trim() || !on}
            onClick={async () => {
              setPlanning(true);
              try {
                const r = await aiOfficeApi.planNow(dept.id);
                notify.success(r.created ? t('aiOffice.dept.planned', { count: r.created }) : t('aiOffice.dept.plannedNone'));
                await load();
              } catch (err) {
                notify.error(err);
              } finally {
                setPlanning(false);
              }
            }}
          >
            {planning ? t('aiOffice.dept.planning') : t('aiOffice.dept.planNow')}
          </button>
        </div>
      </div>

      <DeptImpact deptId={dept.id} />
      <DeptScenarios deptId={dept.id} dept={dept} />
      <DeptPosts deptId={dept.id} dept={dept} />

      <div className="ofp-card">
        <div className="ofp-card-h">
          <h2>{t('aiOffice.dept.staff')} <small>{dept.agents.length}</small></h2>
          <Link className="ofp-btn" to={`/ai-office/departments/${dept.id}/edit#agents`}>+ {t('aiOffice.dept.agent')}</Link>
        </div>
        <div className="odp-agents">
          {dept.agents.map((a) => {
            const working = on && a.state !== 'idle' && a.state !== 'paused';
            return (
              <div key={a.id} className="odp-ag">
                <span className={ofx('odp-ava', working && a.state !== 'waiting' && 'typing')} style={{ background: dept.color }}>{a.title[0]}</span>
                <div className="m">
                  <b>{a.isLead && '★ '}{a.title}</b>
                  <span className={ofx('st', working && 'on')}>{on ? stateText(a.state) : t('aiOffice.dept.pausedShort')}</span>
                  <em>{a.currentTask ? a.currentTask.title : t('aiOffice.dept.free')}</em>
                </div>
                <span className="n"><b>{a.doneToday ?? 0}</b>{t('aiOffice.dept.today')}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="odp-cols">
        <div className="ofp-card">
          <div className="ofp-card-h"><h2>{t('aiOffice.dept.colDoing')} <small>{doing.length}</small></h2></div>
          <div className="odp-list">
            {doing.map((x) => (
              <div key={x.id} className="odp-t" onClick={() => setOpenTask(x.id)}>
                <div className="top">
                  <b>{x.title}</b>
                  <span className="pc">{x.status === 'backlog' ? t('aiOffice.status.backlog') : x.progress + '%'}</span>
                </div>
                <div className="meta">
                  {x.agentTitle ?? t('aiOffice.dept.unassigned')}
                  {x.status === 'progress' && <> · <span className="step">{t(`aiOffice.step.${x.step}`)}…</span></>}
                  {x.source !== 'manual' && <> · {t(`aiOffice.source.${x.source}`)}</>}
                </div>
                {x.status === 'progress' && <div className="ofp-prog"><i style={{ width: x.progress + '%' }} /></div>}
                {x.status === 'backlog' && (
                  <div className="odp-acts" onClick={(e) => e.stopPropagation()}>
                    <button className="ofp-btn" onClick={() => act(() => aiOfficeApi.cancel(x.id))}>{t('aiOffice.dept.cancel')}</button>
                  </div>
                )}
              </div>
            ))}
            {doing.length === 0 && <div className="of-none">{t('aiOffice.dept.nothingDoing')}</div>}
          </div>
        </div>
        <div className="ofp-card">
          <div className="ofp-card-h"><h2>{t('aiOffice.dept.colWaiting')} <small>{waiting.length}</small></h2></div>
          <div className="odp-list">
            {waiting.map((x) => (
              <div key={x.id} className="odp-t wait" onClick={() => setOpenTask(x.id)}>
                <div className="top"><b>{x.title}</b></div>
                {x.status === 'waiting' ? (
                  <>
                    <div className="arts">
                      {x.artifacts.filter((a) => a.status === 'pending').map((a) => (
                        <span key={a.actionId}>{x.agentTitle ?? ''} → {a.title}</span>
                      ))}
                    </div>
                    {x.resultSummary && <div className="sum">{x.resultSummary}</div>}
                    <div className="odp-acts" onClick={(e) => e.stopPropagation()}>
                      <button className="ofp-btn pri" onClick={() => setOpenTask(x.id)}>{t('aiOffice.dept.review')}</button>
                      <button className="ofp-btn ok" disabled={busy === x.id} onClick={() => decide(x.id, true)}>{t('aiOffice.common.approve')}</button>
                      <button className="ofp-btn" disabled={busy === x.id} onClick={() => decide(x.id, false)}>{t('aiOffice.common.reject')}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="meta">{t('aiOffice.dept.blocked')}</div>
                    <div className="odp-acts" onClick={(e) => e.stopPropagation()}>
                      <button className="ofp-btn" onClick={() => act(() => aiOfficeApi.retry(x.id))}>{t('aiOffice.dept.retry')}</button>
                      <button className="ofp-btn" onClick={() => act(() => aiOfficeApi.cancel(x.id))}>{t('aiOffice.dept.cancel')}</button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {waiting.length === 0 && <div className="of-none">{t('aiOffice.dept.allApproved')}</div>}
          </div>
        </div>
        <div className="ofp-card">
          <div className="ofp-card-h"><h2>{t('aiOffice.dept.colDone')} <small>{done.length}</small></h2></div>
          <div className="odp-list">
            {done.map((x) => (
              <div key={x.id} className="odp-t done" onClick={() => setOpenTask(x.id)}>
                <div className="top">
                  <b>{x.title}</b>
                  <span className="at">{ago(x.finishedAt ?? x.updatedAt)}</span>
                </div>
                <div className="meta">
                  {x.agentTitle ?? ''}
                  {x.status === 'rejected' && <> · <span style={{ color: 'var(--of-warn)' }}>{t('aiOffice.dept.rejectedByYou')}</span></>}
                  {x.status === 'failed' && <> · <span style={{ color: 'var(--of-err)' }}>{x.error?.slice(0, 160)}</span></>}
                  {x.status === 'foreign' && <> · <span style={{ color: 'var(--of-fg2)' }}>{t('aiOffice.taskStatus.foreign')}</span></>}
                  {x.costCents > 0 && <> · {fmtEur(x.costCents)}</>}
                </div>
                {x.resultSummary && (x.status === 'done' || x.status === 'foreign') && <div className="sum">{x.resultSummary}</div>}
                {x.artifacts.length > 0 && (
                  <div className="arts" onClick={(e) => e.stopPropagation()}>
                    {x.artifacts.map((a, k) => {
                      const href = artifactHref(a);
                      const label = `${a.title ?? a.actionType}${a.status === 'rejected' ? ` — ${t('aiOffice.dept.rejectedByYou')}` : a.status === 'failed' ? ` — ${t('aiOffice.dept.failed')}` : ''}`;
                      return href ? (
                        href.startsWith('http') ? <a key={k} href={href} target="_blank" rel="noreferrer">{label} ↗</a> : <Link key={k} to={href}>{label} ↗</Link>
                      ) : (
                        <span key={k} className={a.status === 'failed' ? 'x' : undefined}>{label}</span>
                      );
                    })}
                  </div>
                )}
                {x.status === 'failed' && (
                  <div className="odp-acts" onClick={(e) => e.stopPropagation()}><button className="ofp-btn" onClick={() => act(() => aiOfficeApi.retry(x.id))}>{t('aiOffice.dept.retry')}</button></div>
                )}
              </div>
            ))}
            {done.length === 0 && <div className="of-none">{t('aiOffice.common.empty')}</div>}
          </div>
        </div>
      </div>

      <div className="ofp-card">
        <div className="ofp-card-h">
          <h2>{t('aiOffice.dept.journal')} <small>{t('aiOffice.dept.realtime')}</small></h2>
          <span className={ofx('ofp-tag live', on ? 'ok' : 'warn')}><i />{t(`aiOffice.engine.${dept.engine.mode}`)}</span>
        </div>
        <div className="ofp-card-b">
          <div className="ofp-term" style={{ minHeight: 240 }}>
            {[...events].reverse().slice(-40).map((r) => (
              <div className="r" key={r.id}>
                <span className="tm">{new Date(r.createdAt).toLocaleTimeString(i18n.language)}</span>
                {r.agentTitle && <span className="who">{r.agentTitle}</span>}
                {r.tool && <span className="fn">{r.tool}()</span>}
                <span className={r.level === 'error' ? 'er' : r.level === 'warn' ? 'wn' : 'ok'}>{r.text}</span>
              </div>
            ))}
            <div className="r cur"><span className="tm">{on ? '' : t('aiOffice.dept.pausedJournal')}</span></div>
          </div>
        </div>
      </div>
      {openTask && <TaskDrawer taskId={openTask} dept={dept} onClose={() => setOpenTask(null)} onChanged={() => void load()} />}
    </OfficeShell>
  );
}

export default AiDepartmentPage;
