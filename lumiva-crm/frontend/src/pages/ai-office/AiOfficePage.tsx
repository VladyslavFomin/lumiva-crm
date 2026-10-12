import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { aiOfficeApi, type OfficeConnector, type OfficeDepartment, type OfficeEvent, type OfficeIssue, type OfficeTask } from '../../api/aiOffice';
import { OF_WORLD, OfficeMap, Packets, slotCenter, useAmbientLife, type Bubble, type MapDept, type MapIssue, type PacketItem, type WalkerSpec } from './officeMap';
import { ISSUE_COLOR, IssueFix, OfficeLogo, agentPhrases, fmtEur, taskOrder, useAgo, useNotify, useOfficeLive } from './officeShared';
import { TaskDrawer } from './TaskDrawer';

const ofx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');
const SLOTS: Array<[number, number]> = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
/** Реплики над столами — из этих событий журнала. */
const BUBBLE_KINDS = new Set(['task_started', 'tool', 'brain_read', 'approval_needed', 'done', 'issue', 'brain_write', 'handoff', 'retry', 'tool_failed', 'planned']);

function Clock() {
  const [t, setT] = useState(new Date());
  const { i18n } = useTranslation();
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="of-clock">{t.toLocaleTimeString(i18n.language)}</span>;
}

function useViewport(ref: React.RefObject<HTMLDivElement | null>) {
  const [v, setV] = useState({ x: 0, y: 0, k: 0.7 });
  const drag = useRef<{ sx: number; sy: number; x: number; y: number; moved: boolean } | null>(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { width: w, height: h } = el.getBoundingClientRect();
    const k = Math.max(0.22, Math.min(1.1, Math.min(w / OF_WORLD.W, h / (OF_WORLD.H + 40)) * 0.98));
    setV({ k, x: (w - OF_WORLD.W * k) / 2, y: (h - OF_WORLD.H * k) / 2 + 18 * k });
  }, [ref]);
  useEffect(() => {
    fit();
    const ro = new ResizeObserver(fit);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [fit, ref]);
  const zoom = (f: number, cx?: number, cy?: number) =>
    setV((o) => {
      const r = ref.current!.getBoundingClientRect();
      const px = cx ?? r.width / 2, py = cy ?? r.height / 2;
      const k = Math.max(0.2, Math.min(2.4, o.k * f));
      return { k, x: px - ((px - o.x) * k) / o.k, y: py - ((py - o.y) * k) / o.k };
    });
  const handlers = {
    onWheel: (e: React.WheelEvent) => {
      const r = ref.current!.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
    },
    onPointerDown: (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button,a,.of-card')) return;
      drag.current = { sx: e.clientX, sy: e.clientY, x: v.x, y: v.y, moved: false };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (d.moved) setV((o) => ({ ...o, x: d.x + dx, y: d.y + dy }));
    },
    onPointerUp: () => setTimeout(() => (drag.current = null), 0),
    onPointerLeave: () => (drag.current = null),
    onClickCapture: (e: React.MouseEvent) => {
      if (drag.current?.moved) e.stopPropagation();
    },
  };
  return { v, zoom, fit, handlers };
}

function kpiValue(key: string, value: number) {
  return key === 'spend_month' ? fmtEur(value) : String(value);
}

function DeptCard({ d, sel, onPick, issue, onColor }: { d: OfficeDepartment; sel: boolean; onPick: (id: string) => void; issue: OfficeIssue | null; onColor: (id: string, c: string) => void }) {
  const { t } = useTranslation();
  const live = d.live;
  const [cx, cy] = slotCenter(d.slot), W = OF_WORLD;
  const L = Math.hypot(cx - W.cx, cy - W.cy) || 1, dx = (cx - W.cx) / L, dy = (cy - W.cy) / L;
  const tt = 1 / (Math.abs(dx) / W.a + Math.abs(dy) / W.b), t2 = Math.min(Math.abs(dx) > 0.01 ? 80 / Math.abs(dx) : 1e9, Math.abs(dy) > 0.01 ? 70 / Math.abs(dy) : 1e9);
  const x = cx + dx * (tt + t2 + 14), y = cy + dy * (tt + t2 + 14) - 16;
  const ic = issue ? ISSUE_COLOR[issue.kind] : null;
  return (
    <div
      className={ofx('of-card', sel && 'sel', issue && 'alert', d.status !== 'active' && 'paused')}
      style={{ left: x - 100, top: y - 70, ['--dc' as any]: d.color, ['--ic' as any]: ic }}
      onClick={() => onPick(d.id)}
    >
      {issue ? (
        <div className="of-card-al">⚠ {t(`aiOffice.issueKind.${issue.kind}`)}: {issue.title}</div>
      ) : d.status !== 'active' ? (
        <div className="of-card-pz">⏸ {t(`aiOffice.paused.${d.pausedReason || 'manual'}`)}</div>
      ) : null}
      <div className="of-card-h">
        <i style={{ background: d.color }} />
        <span className="nm">{d.name}</span>
        <span className="eng" title={t(`aiOffice.engine.${d.engine.mode}`)}>{d.engine.mode === 'byok' ? '{ }' : 'AI'}</span>
      </div>
      <div className="of-card-n">
        <b>{d.agents.length}</b>
        <span>{t('aiOffice.office.agents', { count: d.agents.length })}</span>
      </div>
      <div className="of-card-s">
        {(live?.kpis ?? []).map((k) => (
          <div key={k.key}>
            <span>{t(`aiOffice.kpi.${k.key}`)}</span>
            <b>{kpiValue(k.key, k.value)}</b>
          </div>
        ))}
      </div>
      <div className="of-card-f">
        <span>{t('aiOffice.office.doing')} <b>{live?.doing ?? 0}</b></span>
        <span>{t('aiOffice.office.next')} <b>{(live?.next ?? 0) + (live?.waiting ?? 0)}</b></span>
        <span>{t('aiOffice.office.done')} <b>{live?.doneToday ?? 0}</b></span>
      </div>
      {sel && (
        <div className="of-card-col" onClick={(e) => e.stopPropagation()}>
          {['#e9a5a0', '#f0b98a', '#ecc982', '#d9c3a1', '#c9d68f', '#9fd3c0', '#8cc9d6', '#a9c7e6', '#b5c2ea', '#c8b7e6'].map((c) => (
            <button key={c} className={d.color === c ? 'on' : ''} style={{ background: c }} title={t('aiOffice.office.roomColor')} aria-label={t('aiOffice.office.roomColor')} onClick={() => onColor(d.id, c)} />
          ))}
        </div>
      )}
      {sel && (
        <Link className="of-card-go" to={`/ai-office/departments/${d.id}`} onClick={(e) => e.stopPropagation()}>
          {t('aiOffice.office.openDept')} →
        </Link>
      )}
    </div>
  );
}

function EmptyCard({ slot, plan }: { slot: [number, number]; plan: { capacity: number; used: number; included: number; extraActive: number; extraPriceEur: number } }) {
  const { t } = useTranslation();
  const [x, y] = slotCenter(slot);
  const free = plan.capacity - plan.used;
  return (
    <Link className="of-empty" to="/ai-office/departments/new" style={{ left: x - 92, top: y - 46 }}>
      <span className="pl">+</span>
      <b>{t('aiOffice.office.newDept')}</b>
      <span>
        {free > 0
          ? t('aiOffice.office.freeSlots', { count: free })
          : t('aiOffice.office.slotPrice', { included: plan.included, extra: plan.extraActive, price: plan.extraPriceEur })}
      </span>
    </Link>
  );
}

function TaskRow({ task, dept, onApprove, onReject, busy, onOpen }: { task: OfficeTask; dept?: OfficeDepartment; onApprove: (id: string) => void; onReject: (id: string) => void; busy: boolean; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const ago = useAgo();
  const flash = Date.now() - new Date(task.updatedAt).getTime() < 5000;
  const pc =
    task.status === 'done' ? '✓' : task.status === 'waiting' ? '!' : task.status === 'blocked' ? '⏸' : task.status === 'failed' || task.status === 'rejected' ? '✕' : task.status === 'foreign' ? '↷' : task.status === 'backlog' ? '—' : task.progress + '%';
  return (
    <div className={ofx('of-task', task.status, flash && 'flash')} onClick={() => onOpen(task.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(task.id)}>
      <div className="of-task-top">
        <span className={ofx('of-pc', task.status)}>{pc}</span>
        <span className="tt">{task.title}</span>
        <span className="ago">{ago(task.updatedAt)}</span>
      </div>
      <div className="of-task-meta">
        <i style={{ background: dept?.color }} />
        {task.agentTitle ? `${task.agentTitle} · ` : ''}
        {dept?.name}
      </div>
      {task.status === 'progress' && (
        <div className="of-prog">
          <i style={{ width: task.progress + '%' }} />
        </div>
      )}
      {task.status === 'waiting' && (
        <div className="of-wait">
          <span>{t('aiOffice.office.waitingApproval', { count: task.pendingActionIds.length })} · <u>{t('aiOffice.office.seeWhat')}</u></span>
          <span className="acts" onClick={(e) => e.stopPropagation()}>
            <button className="ghost" disabled={busy} onClick={() => onReject(task.id)}>{t('aiOffice.common.reject')}</button>
            <button disabled={busy} onClick={() => onApprove(task.id)}>{t('aiOffice.common.approve')}</button>
          </span>
        </div>
      )}
      {task.status === 'failed' && task.error && <div className="of-wait" style={{ color: 'var(--of-err)' }}><span>{task.error.slice(0, 140)}</span></div>}
    </div>
  );
}

function SidePanel({ depts, tasks, issues, sel, setSel, brainFiles, lastEvent, onTaskCreated, onTaskChanged, onOpen }: {
  depts: OfficeDepartment[];
  tasks: OfficeTask[];
  issues: OfficeIssue[];
  sel: string | null;
  setSel: (id: string | null) => void;
  brainFiles: number;
  lastEvent: OfficeEvent | null;
  onTaskCreated: (t: OfficeTask) => void;
  onTaskChanged: (t: OfficeTask) => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [f, setF] = useState<'all' | 'backlog' | 'progress' | 'waiting' | 'done'>('all');
  const [txt, setTxt] = useState('');
  const [to, setTo] = useState<string>(sel || depts[0]?.id || '');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const notify = useNotify();
  useEffect(() => {
    if (sel) setTo(sel);
    else if (!to && depts[0]) setTo(depts[0].id);
  }, [sel, depts, to]);
  const deptOf = (id: string) => depts.find((d) => d.id === id);
  const scoped = sel ? tasks.filter((x) => x.departmentId === sel) : tasks;
  const group = (st: string) => (st === 'backlog' ? ['backlog', 'blocked'] : st === 'done' ? ['done', 'failed', 'rejected', 'foreign'] : [st]);
  const cnt = (k: string) => (k === 'all' ? scoped.length : scoped.filter((x) => group(k).includes(x.status)).length);
  const list = (f === 'all' ? [...scoped] : scoped.filter((x) => group(f).includes(x.status))).sort(taskOrder);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txt.trim() || !to) return;
    setSaving(true);
    try {
      const task = await aiOfficeApi.createTask({ departmentId: to, title: txt.trim() });
      onTaskCreated(task);
      setTxt('');
    } catch (err) {
      notify.error(err);
    } finally {
      setSaving(false);
    }
  };
  const decide = async (id: string, ok: boolean) => {
    setBusy(id);
    try {
      if (ok) {
        const r = await aiOfficeApi.approve(id);
        onTaskChanged(r.task);
        if (r.errors.length) notify.error(r.errors.join('; '));
      } else {
        onTaskChanged(await aiOfficeApi.reject(id));
      }
    } catch (err) {
      notify.error(err);
    } finally {
      setBusy(null);
    }
  };
  const sd = sel ? deptOf(sel) : null;
  const visibleIssues = sel ? issues.filter((i) => i.departmentId === sel) : issues;
  return (
    <aside className="of-panel">
      <form className="of-add" onSubmit={add}>
        <label className="of-add-d">
          <i style={{ background: deptOf(to)?.color }} />
          <select value={to} onChange={(e) => setTo(e.target.value)} aria-label={t('aiOffice.office.department')}>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={deptOf(to) ? t('aiOffice.office.taskFor', { name: deptOf(to)!.name }) : t('aiOffice.office.noDepts')} disabled={!depts.length} />
        <button type="submit" disabled={saving || !txt.trim() || !depts.length}>{t('aiOffice.common.add')}</button>
      </form>
      <div className="of-brain">
        <svg viewBox="0 0 80 50" className="mini">
          {Array.from({ length: 12 }, (_, i) => (
            <circle key={i} className="of-node" style={{ animationDelay: i * 0.3 + 's' }} cx={8 + ((i * 37) % 64)} cy={6 + ((i * 23) % 38)} r={i % 4 ? 1.6 : 2.6} fill="#2f8f7a" />
          ))}
        </svg>
        <div>
          <div className="t">
            {t('aiOffice.brain.title')} <b>{brainFiles}</b> <span>{t('aiOffice.brain.files', { count: brainFiles })}</span>{' '}
            <Link to="/ai-office/brain" style={{ marginLeft: 6 }}>{t('aiOffice.common.open')} →</Link>
          </div>
          <div className="s">
            {lastEvent
              ? `${lastEvent.agentTitle ?? ''}${lastEvent.toAgentTitle ? ' → ' + lastEvent.toAgentTitle : ''}${lastEvent.agentTitle ? ': ' : ''}«${lastEvent.text}» · ${deptOf(lastEvent.departmentId ?? '')?.name ?? ''}`
              : t('aiOffice.brain.hint')}
          </div>
        </div>
      </div>
      {visibleIssues.length > 0 && (
        <div className="of-help">
          <div className="of-help-h">
            <span>{t('aiOffice.office.needHelp')}</span>
            <b>{visibleIssues.length}</b>
          </div>
          {visibleIssues.map((i) => (
            <div key={i.id} className="of-iss">
              <span className="k" style={{ background: ISSUE_COLOR[i.kind] }} />
              <div className="m">
                <b>{i.title}</b>
                <span>{deptOf(i.departmentId)?.name}</span>
              </div>
              <IssueFix className="fx" issue={i} />
            </div>
          ))}
        </div>
      )}
      <div className="of-ts-h">
        <h2>{t('aiOffice.office.taskStatus')}</h2>
        {sd ? (
          <button className="of-scope" onClick={() => setSel(null)}>
            <i style={{ background: sd.color }} />
            {sd.name} ✕
          </button>
        ) : (
          <span className="of-scope">{t('aiOffice.office.wholeOffice')}</span>
        )}
      </div>
      <div className="of-chips">
        {(['all', 'backlog', 'progress', 'waiting', 'done'] as const).map((k) => (
          <button key={k} className={ofx(f === k && 'on', k === 'waiting' && cnt('waiting') > 0 && 'warn')} onClick={() => setF(k)}>
            {t(`aiOffice.status.${k}`)} <b>{cnt(k)}</b>
          </button>
        ))}
      </div>
      <div className="of-tasks">
        {list.map((task) => (
          <TaskRow key={task.id} task={task} dept={deptOf(task.departmentId)} busy={busy === task.id} onOpen={onOpen} onApprove={(id) => decide(id, true)} onReject={(id) => decide(id, false)} />
        ))}
        {list.length === 0 && <div className="of-none">{t('aiOffice.common.empty')}</div>}
      </div>
    </aside>
  );
}

/** Провода от иконок «Подключено» к комнатам отделов, которые этим сервисом пользуются. */
function ConnWires({ rootRef, vpRef, iconRefs, v, hl, sel, depts, connectors, cards }: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  vpRef: React.RefObject<HTMLDivElement | null>;
  iconRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  v: { x: number; y: number; k: number };
  hl: string | null;
  sel: string | null;
  depts: OfficeDepartment[];
  connectors: OfficeConnector[];
  cards: boolean;
}) {
  const [g, setG] = useState<{ w: number; h: number; vp: number[]; band: number[] | null; icons: Record<string, [number, number]>; holes: number[][] } | null>(null);
  const measure = useCallback(() => {
    const root = rootRef.current, vpEl = vpRef.current;
    if (!root || !vpEl) return;
    const R0 = root.getBoundingClientRect(), V = vpEl.getBoundingClientRect();
    const row = root.querySelector('.of-conn .row'), RW = row?.getBoundingClientRect();
    const icons: Record<string, [number, number]> = {};
    connectors.forEach((c) => {
      const el = iconRefs.current[c.key];
      if (!el) return;
      const b = el.getBoundingClientRect();
      if (!RW || b.right > RW.right + 1 || b.left < RW.left - 1) return;
      icons[c.key] = [b.left + b.width / 2 - R0.left, b.bottom - R0.top - 2];
    });
    // карточки отделов: провода уходят «за» карточку — вырезаем их прямоугольники из слоя проводов
    const holes = [...root.querySelectorAll('.of-world .of-card')].map((el) => {
      const b = el.getBoundingClientRect();
      return [b.left - R0.left - 3, b.top - R0.top - 3, b.width + 6, b.height + 6];
    });
    setG({ w: R0.width, h: R0.height, vp: [V.left - R0.left, V.top - R0.top, V.width, V.height], band: RW ? [RW.left - R0.left, RW.bottom - R0.top - 4, RW.width] : null, icons, holes });
  }, [rootRef, vpRef, iconRefs, connectors]);
  useEffect(() => {
    measure();
    // карточка выбранного отдела меняет высоту (палитра цветов) — перемеряем после отрисовки
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [v.x, v.y, v.k, measure, depts.length, sel, cards]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (rootRef.current) ro.observe(rootRef.current);
    window.addEventListener('resize', measure);
    const tm = setTimeout(measure, 400);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      clearTimeout(tm);
    };
  }, [measure, rootRef]);
  if (!g) return null;
  const items: PacketItem[] = [];
  const focus = hl || sel;
  depts.forEach((d, di) => {
    const [wx, wy] = slotCenter(d.slot), rx = g.vp[0] + v.x + wx * v.k, ry = g.vp[1] + v.y + wy * v.k;
    d.connectors.forEach((cid, k) => {
      const s = g.icons[cid];
      const cn = connectors.find((c) => c.key === cid);
      if (!s || !cn) return;
      const dy = Math.max(60, ry - s[1]);
      const path = `M${s[0].toFixed(1)},${s[1].toFixed(1)} C${s[0].toFixed(1)},${(s[1] + dy * 0.45).toFixed(1)} ${rx.toFixed(1)},${(ry - dy * 0.5).toFixed(1)} ${rx.toFixed(1)},${ry.toFixed(1)}`;
      const on = !focus || focus === cid || focus === d.id, hi = !!focus && on;
      const working = (d.live?.doing ?? 0) > 0;
      // подключённый сервис активного отдела «дышит» всегда; когда отдел работает — поток быстрее
      const dur = (3.4 + ((di * 7 + k * 3) % 9) * 0.45) * (working ? 1 : 2.4);
      const moving = cn.status === 'ok' && d.status === 'active';
      const c = cn.status === 'ok' ? cn.color : '#b8b2a7';
      items.push({ k: d.id + cid, d: path, c, w: hi ? 1.6 : 1, on, hi, draw: true, dur, off: ((k * 1.3 + di * 0.7) / dur) % 1, r: 3, moving });
      if (k % 2 === 0) items.push({ k: d.id + cid + 'r', d: path, c, on, dur: dur * 1.3, off: ((k * 2.1) / dur) % 1, rev: true, r: 2.3, moving });
    });
  });
  return (
    <svg className="of-wires" width={g.w} height={g.h}>
      <defs>
        <clipPath id="ofWireClip">
          <rect x={g.vp[0]} y={g.vp[1]} width={g.vp[2]} height={g.vp[3]} />
          {g.band && <rect x={g.band[0] - 4} y={g.band[1]} width={g.band[2] + 8} height={Math.max(0, g.vp[1] - g.band[1])} />}
        </clipPath>
        <mask id="ofWireMask" maskUnits="userSpaceOnUse" x="0" y="0" width={g.w} height={g.h}>
          <rect width={g.w} height={g.h} fill="#fff" />
          {g.holes.map((h, i) => (
            <rect key={i} x={h[0]} y={h[1]} width={h[2]} height={h[3]} rx="12" fill="#000" />
          ))}
        </mask>
      </defs>
      <g clipPath="url(#ofWireClip)" mask="url(#ofWireMask)">
        <Packets items={items} />
      </g>
    </svg>
  );
}

export function AiOfficePage() {
  const { t } = useTranslation();
  const notify = useNotify();
  const rootRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<Record<string, HTMLElement | null>>({});
  const vp = useRef<HTMLDivElement>(null);
  const { v, zoom, fit, handlers } = useViewport(vp);
  const [sel, setSel] = useState<string | null>(null);
  const [hl, setHl] = useState<string | null>(null);
  const night = false;
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [cards, setCards] = useState(true);
  const [connectors, setConnectors] = useState<OfficeConnector[]>([]);
  const [bubbles, setBubbles] = useState<Record<string, Bubble>>({});
  const [walkers, setWalkers] = useState<WalkerSpec[]>([]);

  const onEvents = useCallback((events: OfficeEvent[]) => {
    // от старых к новым: реплики и «прогулки» в порядке, в котором всё происходило
    [...events].reverse().forEach((e, i) => {
      if (!e.departmentId || !e.agentId) return;
      if (e.kind === 'handoff_internal' && e.toAgentId) {
        setWalkers((ws) => (ws.length >= 4 ? ws : [...ws, { key: e.id, deptId: e.departmentId!, fromAgentId: e.agentId!, toAgentId: e.toAgentId!, text: e.text }]));
        return;
      }
      if (!BUBBLE_KINDS.has(e.kind)) return;
      setTimeout(() => {
        setBubbles((b) => ({ ...b, [e.departmentId!]: { agentId: e.agentId!, text: e.text } }));
        setTimeout(() => setBubbles((b) => (b[e.departmentId!]?.agentId === e.agentId && b[e.departmentId!]?.text === e.text ? { ...b, [e.departmentId!]: null } : b)), 3200);
      }, i * 900);
    });
  }, []);
  const { data, setData, error, reload } = useOfficeLive(onEvents);

  useEffect(() => {
    aiOfficeApi.connectors().then(setConnectors).catch(() => undefined);
    const id = setInterval(() => aiOfficeApi.connectors().then(setConnectors).catch(() => undefined), 60_000);
    return () => clearInterval(id);
  }, []);

  const depts = data?.departments ?? [];
  const mapDepts: MapDept[] = useMemo(
    () =>
      depts.map((d) => {
        const busy = new Set((data?.tasks ?? []).filter((x) => x.departmentId === d.id && x.status === 'progress' && x.agentId).map((x) => x.agentId));
        return {
          id: d.id,
          name: d.name,
          color: d.color,
          slot: d.slot,
          active: d.status === 'active',
          agents: d.agents.map((a) => ({ id: a.id, title: a.title, isLead: a.isLead, busy: busy.has(a.id) })),
        };
      }),
    [depts, data?.tasks],
  );
  const ambient = useAmbientLife(mapDepts, (deptId, agentId) => {
    const d = mapDepts.find((x) => x.id === deptId);
    const ph = agentPhrases(t, data?.tasks ?? [], data?.events ?? [], agentId, !!d?.agents.find((a) => a.id === agentId)?.isLead);
    return ph[Math.floor(Math.random() * ph.length)] ?? null;
  });
  const issueMap: Record<string, MapIssue> = useMemo(() => {
    const m: Record<string, MapIssue> = {};
    [...(data?.issues ?? [])].reverse().forEach((i) => {
      m[i.departmentId] = { kind: i.kind, agentId: i.agentId, label: t(`aiOffice.issueKind.${i.kind}`).toLowerCase(), color: ISSUE_COLOR[i.kind] };
    });
    return m;
  }, [data?.issues, t]);
  const firstIssue = (id: string) => (data?.issues ?? []).find((i) => i.departmentId === id) ?? null;
  const taken = new Set(depts.map((d) => d.slot.join(',')));
  const emptySlots = SLOTS.filter((s) => !taken.has(s.join(',')));
  const usedConns = new Set(depts.flatMap((d) => d.connectors));
  const shownConns = connectors.filter((c) => c.key === 'crm' || c.status !== 'off' || usedConns.has(c.key));
  const totalAgents = depts.reduce((s, d) => s + d.agents.length, 0);
  const inWork = (data?.tasks ?? []).filter((x) => x.status === 'progress').length;
  const pick = (id: string) => setSel((s) => (s === id ? null : id));
  const recolor = async (id: string, c: string) => {
    setData((prev) => (prev ? { ...prev, departments: prev.departments.map((d) => (d.id === id ? { ...d, color: c } : d)) } : prev));
    try {
      await aiOfficeApi.updateDepartment(id, { color: c });
    } catch (e) {
      notify.error(e);
      void reload();
    }
  };
  const upsertTask = (task: OfficeTask) =>
    setData((prev) => (prev ? { ...prev, tasks: [task, ...prev.tasks.filter((x) => x.id !== task.id)].sort(taskOrder) } : prev));
  const byokCount = depts.filter((d) => d.engine.mode === 'byok').length;

  if (data && !data.plan.available) {
    return (
      <MainLayout>
        <div className="ofp">
          <div className="of-lock ofp-card">
            <div className="kicker"><span className="dot" />{t('aiOffice.common.kicker')}</div>
            <h2>{t('aiOffice.lock.title')}</h2>
            <p>{t('aiOffice.lock.text')}</p>
            <Link className="ofp-btn pri" to="/billing">{t('aiOffice.lock.cta')}</Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout fullBleed>
      <div className="of" ref={rootRef}>
        <header className="of-top">
          <div className="of-head">
            <div>
              <div className="kicker">
                <span className="dot" />
                {t('aiOffice.common.kicker')}
                {data ? ` · ${t(`aiOffice.plans.${data.plan.plan}`, data.plan.plan)}` : ''}
              </div>
              <h1>{t('aiOffice.office.title')}</h1>
              <div className="sub">{t('aiOffice.office.sub')}</div>
            </div>
            <div className="of-head-r">
              <Link className="btn-o" to="/ai-office/connect">{t('aiOffice.nav.connect')}</Link>
              <Link className="btn-o" to="/ai-office/brain">{t('aiOffice.brain.title')}</Link>
              <Link className="btn-o pri" to="/ai-office/departments/new">+ {t('aiOffice.office.newDept')}</Link>
            </div>
          </div>
          <div className="of-strip">
            <div className="of-conn">
              <span className="lab"><i className="ok" />{t('aiOffice.office.connected')}</span>
              <div className="row">
                {shownConns.map((c) => (
                  <button
                    key={c.key}
                    ref={(el) => { iconRefs.current[c.key] = el; }}
                    className={ofx('of-cbtn', hl === c.key && 'on', !usedConns.has(c.key) && c.key !== 'crm' && 'idle', (c.status === 'expired' || c.status === 'error') && 'bad')}
                    title={`${c.name} · ${t(`aiOffice.connStatus.${c.status}`)}`}
                    onMouseEnter={() => setHl(c.key)}
                    onMouseLeave={() => setHl(null)}
                    onClick={() => setHl(hl === c.key ? null : c.key)}
                  >
                    <OfficeLogo c={c} size={26} off={c.status === 'off'} />
                  </button>
                ))}
                <Link className="of-cbtn plus" to="/ai-office/connect" title={t('aiOffice.connect.connect')}>+</Link>
              </div>
            </div>
            <div className="of-sp" />
            <div className="of-eng">
              <span className="lab"><i className="ok" />{t('aiOffice.office.runsOn')}</span>
              <span className="of-e">{byokCount ? t('aiOffice.office.enginesMixed', { n: byokCount }) : t('aiOffice.engine.platform')}</span>
            </div>
            <Clock />
          </div>
        </header>

        {error && !data && <div className="ofp-err" style={{ margin: 16 }}>{error}</div>}
        <ConnWires rootRef={rootRef} vpRef={vp} iconRefs={iconRefs} v={v} hl={hl} sel={sel} depts={depts} connectors={shownConns} cards={cards} />
        <div className="of-body">
          <div className={ofx('of-vp', night && 'night')} ref={vp} {...handlers}>
            <div className="of-world" style={{ transform: `translate(${v.x}px,${v.y}px) scale(${v.k})`, width: OF_WORLD.W, height: OF_WORLD.H }}>
              <OfficeMap
                depts={mapDepts}
                emptySlots={emptySlots}
                night={night}
                sel={sel}
                onPick={pick}
                hl={hl}
                brainLabel={t('aiOffice.brain.mapLabel', { count: data?.brainFiles ?? 0 })}
                bubbles={{ ...ambient.bubbles, ...Object.fromEntries(Object.entries(bubbles).filter(([, v]) => v)) }}
                walkers={[...walkers, ...ambient.walkers]}
                onWalkerDone={(k) => (k.startsWith('amb-') ? ambient.done(k) : setWalkers((ws) => ws.filter((w) => w.key !== k)))}
                issues={issueMap}
              />
              {cards && depts.map((d) => <DeptCard key={d.id} d={d} sel={sel === d.id} onPick={pick} issue={firstIssue(d.id)} onColor={recolor} />)}
              {cards && data && emptySlots.length > 0 && <EmptyCard slot={emptySlots[0]} plan={data.plan} />}
            </div>
            <div className="of-legend">
              <b>{depts.length}</b> {t('aiOffice.office.legendDepts', { count: depts.length })} · <b>{totalAgents}</b> {t('aiOffice.office.agents', { count: totalAgents })} · <b>{inWork}</b> {t('aiOffice.office.legendInWork')}
            </div>
            <div className="of-tools">
              <button className={ofx('of-tg', cards && 'on')} onClick={() => setCards(!cards)}>{t('aiOffice.office.cards')}</button>
            </div>
            <div className="of-zoom">
              <button onClick={() => zoom(1.2)} title={t('aiOffice.office.zoomIn')}>+</button>
              <button onClick={() => zoom(1 / 1.2)} title={t('aiOffice.office.zoomOut')}>−</button>
              <button onClick={fit} title={t('aiOffice.office.zoomFit')}>⌂</button>
            </div>
          </div>
          <SidePanel
            depts={depts}
            tasks={data?.tasks ?? []}
            issues={data?.issues ?? []}
            sel={sel}
            setSel={setSel}
            brainFiles={data?.brainFiles ?? 0}
            lastEvent={(data?.events ?? []).find((e) => e.agentId) ?? null}
            onTaskCreated={upsertTask}
            onTaskChanged={upsertTask}
            onOpen={setOpenTask}
          />
        </div>
      </div>
      {openTask && (
        <TaskDrawer
          taskId={openTask}
          dept={depts.find((d) => d.id === (data?.tasks ?? []).find((x) => x.id === openTask)?.departmentId)}
          onClose={() => setOpenTask(null)}
          onChanged={upsertTask}
        />
      )}
    </MainLayout>
  );
}

export default AiOfficePage;
