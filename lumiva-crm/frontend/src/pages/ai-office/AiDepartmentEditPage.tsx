import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  aiOfficeApi,
  type BrainFile,
  type DepartmentInput,
  type OfficeCatalog,
  type OfficeConnector,
  type OfficeDepartment,
  type OfficeKpiKey,
  type OfficeLevel,
  type OfficePermCategory,
  type OfficePlan,
  type OfficeTemplate,
} from '../../api/aiOffice';
import { createAutomation, fetchAutomations, type Automation } from '../../api/automations';
import { getTriggerLabel } from '../automations/automationLabels';
import { fetchAiEmployees, type AiAgent } from '../../api/aiEmployees';
import { RoomScene, type MapDept } from './officeMap';
import { OfficeLogo, OfficeShell, fmtEur, useNotify } from './officeShared';

/** В переводах переменные автоматизаций пишутся как [[lead.name]] (i18next съел бы {{…}}). */
const vars = (s: string) => s.replace(/\[\[([^\]]+)\]\]/g, '{{$1}}');
const edx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');
const SECTIONS = ['base', 'prompt', 'agents', 'conns', 'brain', 'perms', 'safety', 'auto', 'engine'] as const;
type Section = (typeof SECTIONS)[number];

type FormAgent = { id?: string; title: string; isLead: boolean; prompt: string; open: boolean };
type Form = {
  name: string;
  color: string;
  mission: string;
  systemPrompt: string;
  rules: string[];
  permissions: Record<OfficePermCategory, OfficeLevel>;
  connectors: string[];
  engine: { mode: 'platform' | 'byok'; connectionId?: string | null };
  monthlyBudgetCents: number;
  parallelLimit: number;
  safety: { dailySends: number; minHoursPerClient: number; stopList: string[]; allowAdChanges?: boolean; autoPurchaseOrders?: boolean; autoKbReplies?: boolean; autoBookingMessages?: boolean; autoPosting?: boolean };
  curatorAgentId: string | null;
  workHours: '24/7' | 'weekdays' | 'on_demand';
  timezone: string;
  kpis: OfficeKpiKey[];
  proactiveEveryHours: number;
  language: 'ru' | 'en' | 'tr';
  agents: FormAgent[];
};

/** Рекомендуемые автоматизации к шаблонам отделов: событие CRM → задача отделу. */
const RECOMMENDED: Record<string, Array<{ key: string; trigger: string; titleKey: string; detailsKey: string; priority?: number }>> = {
  sales: [
    { key: 'qualify', trigger: 'lead.created', titleKey: 'qualifyTitle', detailsKey: 'qualifyDetails', priority: 1 },
    { key: 'followup', trigger: 'lead.stale', titleKey: 'followupTitle', detailsKey: 'followupDetails' },
  ],
  finance: [{ key: 'payment', trigger: 'sale.status_changed', titleKey: 'paymentTitle', detailsKey: 'paymentDetails' }],
  stock: [{ key: 'stock', trigger: 'product.stock_low', titleKey: 'stockTitle', detailsKey: 'stockDetails', priority: 1 }],
  ops: [{ key: 'failed', trigger: 'ai_office.task_failed', titleKey: 'failedTitle', detailsKey: 'failedDetails' }],
  marketing: [{ key: 'newlead', trigger: 'lead.created', titleKey: 'sourceTitle', detailsKey: 'sourceDetails', priority: 3 }],
  dev: [{ key: 'help', trigger: 'ai_office.help_needed', titleKey: 'helpTitle', detailsKey: 'helpDetails' }],
  content: [{ key: 'done', trigger: 'ai_office.task_done', titleKey: 'contentTitle', detailsKey: 'contentDetails', priority: 3 }],
};

function fromDept(d: OfficeDepartment): Form {
  return {
    name: d.name,
    color: d.color,
    mission: d.mission,
    systemPrompt: d.systemPrompt,
    rules: d.rules,
    permissions: d.permissions,
    connectors: d.connectors,
    engine: d.engine,
    monthlyBudgetCents: d.monthlyBudgetCents,
    parallelLimit: d.parallelLimit,
    safety: d.safety ?? { dailySends: 50, minHoursPerClient: 48, stopList: [] },
    curatorAgentId: d.curatorAgentId ?? null,
    workHours: d.workHours,
    timezone: d.timezone,
    kpis: d.kpis,
    proactiveEveryHours: d.proactiveEveryHours,
    language: d.language ?? 'en',
    agents: d.agents.map((a) => ({ id: a.id, title: a.title, isLead: a.isLead, prompt: a.prompt, open: false })),
  };
}

function fromTemplate(tp: OfficeTemplate | null, lead: string, base?: Partial<Form>): Form {
  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  })();
  return {
    name: tp?.name ?? base?.name ?? '',
    color: tp?.color ?? base?.color ?? '#e6b3cf',
    mission: tp?.mission ?? '',
    systemPrompt: '',
    rules: tp?.rules ?? ['no_client_send_without_approval', 'write_brain_notes'],
    permissions: tp?.permissions ?? ({ crm: 'read', finance: 'off', tasks: 'appr', msg: 'off', ads: 'read', content: 'off', stock: 'off', code: 'off' } as Form['permissions']),
    connectors: tp?.connectors ?? ['crm'],
    engine: { mode: 'platform' },
    monthlyBudgetCents: 15000,
    parallelLimit: 3,
    safety: { dailySends: 50, minHoursPerClient: 48, stopList: [] },
    curatorAgentId: null,
    workHours: '24/7',
    timezone: tz,
    kpis: tp?.kpis ?? ['tasks_done_today', 'tasks_waiting'],
    proactiveEveryHours: 6,
    language: base?.language ?? 'ru',
    agents: tp?.agents.map((a) => ({ title: a.title, isLead: a.isLead, prompt: a.prompt, open: false })) ?? [{ title: lead, isLead: true, prompt: '', open: false }],
  };
}

export function AiDepartmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotify();
  const night = false;
  const [catalog, setCatalog] = useState<OfficeCatalog | null>(null);
  const [templates, setTemplates] = useState<OfficeTemplate[]>([]);
  const [connectors, setConnectors] = useState<OfficeConnector[]>([]);
  const [engines, setEngines] = useState<Awaited<ReturnType<typeof aiOfficeApi.engines>> | null>(null);
  const [plan, setPlan] = useState<OfficePlan | null>(null);
  const [dept, setDept] = useState<OfficeDepartment | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [tpl, setTpl] = useState('');
  const [sec, setSec] = useState<Section>('base');
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<BrainFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [autoBusy, setAutoBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [employees, setEmployees] = useState<AiAgent[]>([]);

  useEffect(() => {
    Promise.all([aiOfficeApi.catalog(), aiOfficeApi.templates(i18n.language), aiOfficeApi.connectors(), aiOfficeApi.engines(), aiOfficeApi.plan()])
      .then(([c, tps, cn, en, pl]) => {
        setCatalog(c);
        setTemplates(tps);
        setConnectors(cn);
        setEngines(en);
        setPlan(pl);
      })
      .catch((e) => notify.error(e));
    fetchAutomations().then(setAutomations).catch(() => undefined);
    fetchAiEmployees().then((r) => setEmployees(r.items)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isNew) {
      const q = new URLSearchParams(location.search).get('template') || '';
      setTpl(q);
      const ui = (i18n.language || 'ru').slice(0, 2);
      setForm({ ...fromTemplate(null, t('aiOffice.edit.defaultLead')), language: ui === 'en' || ui === 'tr' ? ui : 'ru' });
      return;
    }
    aiOfficeApi
      .department(id!)
      .then((d) => {
        setDept(d);
        setForm(fromDept(d));
      })
      .catch((e) => notify.error(e));
    aiOfficeApi.brainFiles().then((fs) => setFiles(fs)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  // шаблон из ?template= — когда шаблоны загрузились
  useEffect(() => {
    if (isNew && tpl && templates.length && form && !form.name) applyTpl(tpl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  useEffect(() => {
    const h = location.hash.slice(1);
    if (h && form) setTimeout(() => document.getElementById(h)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!form]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((o) => (o ? { ...o, [k]: v } : o));
  const setAg = (i: number, patch: Partial<FormAgent>) => setForm((o) => (o ? { ...o, agents: o.agents.map((a, j) => (j === i ? { ...a, ...patch } : a)) } : o));
  const applyTpl = (key: string) => {
    setTpl(key);
    const tp = templates.find((x) => x.key === key) ?? null;
    setForm((o) => fromTemplate(tp, t('aiOffice.edit.defaultLead'), o ?? undefined));
  };
  const go = (s: Section) => {
    setSec(s);
    document.getElementById(s)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // подсветка раздела, который сейчас на экране (прокручивается не окно, а область контента CRM)
  const navRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    let box: HTMLElement | null = nav.parentElement;
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    const scroller: HTMLElement | Window = box ?? window;
    const onScroll = () => {
      const line = nav.getBoundingClientRect().bottom + 24;
      let cur: Section = SECTIONS[0];
      for (const s of SECTIONS) {
        const el = document.getElementById(s);
        if (el && el.getBoundingClientRect().top <= line) cur = s;
      }
      setSec(cur);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [!!form && !!catalog]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxAgents = catalog?.maxAgents ?? 8;
  const needSlot = isNew && !!plan && plan.used >= plan.capacity;
  const full = isNew && !!plan && plan.used >= plan.maxDepartments;

  const preview: MapDept | null = useMemo(
    () =>
      form
        ? {
            id: 'preview',
            name: form.name,
            color: form.color,
            slot: [-1, -1],
            active: true,
            agents: form.agents.map((a, i) => ({ id: a.id ?? `new-${i}`, title: a.title || '…', isLead: a.isLead, busy: false })),
          }
        : null,
    [form],
  );

  if (!form || !catalog) {
    return (
      <OfficeShell title={isNew ? t('aiOffice.edit.newTitle') : t('aiOffice.common.loading')}>
        <div className="of-none">{t('aiOffice.common.loading')}</div>
      </OfficeShell>
    );
  }

  const body = (): DepartmentInput => ({
    templateKey: isNew ? tpl || null : undefined,
    name: form.name.trim(),
    color: form.color,
    mission: form.mission,
    systemPrompt: form.systemPrompt,
    rules: form.rules,
    permissions: form.permissions,
    connectors: form.connectors,
    engine: form.engine,
    monthlyBudgetCents: form.monthlyBudgetCents,
    parallelLimit: form.parallelLimit,
    safety: form.safety,
    curatorAgentId: form.curatorAgentId,
    workHours: form.workHours,
    timezone: form.timezone,
    kpis: form.kpis,
    proactiveEveryHours: form.proactiveEveryHours,
    language: form.language,
    agents: form.agents.filter((a) => a.title.trim()).map((a) => ({ id: a.id, title: a.title.trim(), isLead: a.isLead, prompt: a.prompt })),
  });

  const save = async () => {
    if (!form.name.trim()) {
      notify.error(t('aiOffice.edit.nameRequired'));
      go('base');
      return;
    }
    setSaving(true);
    try {
      const saved = isNew ? await aiOfficeApi.createDepartment(body()) : await aiOfficeApi.updateDepartment(id!, body());
      // файлы, выбранные до создания отдела, — в его папку «Мозга»
      for (const f of pendingFiles) {
        await aiOfficeApi.brainUpload(f, saved.id).catch((e) => notify.error(e));
      }
      setPendingFiles([]);
      notify.success(isNew ? t('aiOffice.edit.created') : t('aiOffice.edit.saved'));
      if (isNew) navigate(`/ai-office/departments/${saved.id}`);
      else {
        setDept(saved);
        setForm(fromDept(saved));
      }
    } catch (e) {
      notify.error(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!dept) return;
    const ok = await notify.confirm(t('aiOffice.edit.deleteConfirm', { name: dept.name }), { danger: true, confirmLabel: t('aiOffice.edit.delete') });
    if (!ok) return;
    try {
      await aiOfficeApi.deleteDepartment(dept.id);
      navigate('/ai-office');
    } catch (e) {
      notify.error(e);
    }
  };

  const uploadNow = async (list: FileList | null) => {
    if (!list?.length) return;
    if (isNew || !dept) {
      setPendingFiles((p) => [...p, ...Array.from(list)]);
      return;
    }
    for (const f of Array.from(list)) {
      try {
        const row = await aiOfficeApi.brainUpload(f, dept.id);
        setFiles((fs) => [row, ...fs]);
      } catch (e) {
        notify.error(e);
      }
    }
  };

  const deptAutomations = dept
    ? automations.filter((a) => (a.actions || []).some((x: any) => x.type === 'ai_office_task' && x.config?.departmentId === dept.id))
    : [];
  const addRecommended = async (r: (typeof RECOMMENDED)[string][number]) => {
    if (!dept) return;
    setAutoBusy(r.key);
    try {
      const a = await createAutomation({
        name: `${dept.name}: ${t(`aiOffice.auto.${r.titleKey}`).replace(/\[\[[^\]]+\]\]/g, '…')}`,
        description: t('aiOffice.auto.createdFrom'),
        triggerEvent: r.trigger as any,
        actions: [{ type: 'ai_office_task', config: { departmentId: dept.id, title: vars(t(`aiOffice.auto.${r.titleKey}`)), details: vars(t(`aiOffice.auto.${r.detailsKey}`)), priority: r.priority ?? 2 } }] as any,
        isActive: true,
      } as any);
      setAutomations((as) => [a, ...as]);
      notify.success(t('aiOffice.auto.added'));
    } catch (e) {
      notify.error(e);
    } finally {
      setAutoBusy(null);
    }
  };

  const deptFiles = files.filter((f) => (dept ? f.folder === dept.id || f.scope.includes('all') || f.scope.includes(dept.id) : f.scope.includes('all')));
  const connByKey = (k: string) => connectors.find((c) => c.key === k);
  const recommended = RECOMMENDED[dept?.templateKey ?? tpl] ?? [];

  return (
    <OfficeShell
      title={isNew ? t('aiOffice.edit.newTitle') : t('aiOffice.edit.editTitle', { name: dept?.name ?? '' })}
      sub={isNew ? t('aiOffice.edit.newSub') : t('aiOffice.edit.editSub')}
      plan={plan?.plan}
      right={
        <>
          {!isNew && dept && <Link className="ofp-btn" to={`/ai-office/departments/${dept.id}`}>{t('aiOffice.edit.toDept')}</Link>}
          <button className="ofp-btn pri" onClick={save} disabled={saving || needSlot || full}>
            {saving ? t('aiOffice.common.saving') : isNew ? t('aiOffice.edit.create') : t('aiOffice.common.save')}
          </button>
        </>
      }
    >
      <div className="ed-nav" ref={navRef}>
        {SECTIONS.map((s, i) => (
          <button key={s} className={sec === s ? 'on' : ''} onClick={() => go(s)}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            {t(`aiOffice.edit.sec.${s}`)}
          </button>
        ))}
      </div>
      <div className="ed-grid">
        <div className="ed-form">
          {/* 01 основное */}
          <section id="base" className="ofp-card">
            <div className="ofp-card-h"><h2>{t('aiOffice.edit.sec.base')}</h2></div>
            <div className="ofp-card-b ed-rows">
              {isNew && (
                <label className="ofp-lbl">
                  <span>{t('aiOffice.edit.template')}</span>
                  <select className="ofp-sel" value={tpl} onChange={(e) => applyTpl(e.target.value)}>
                    <option value="">{t('aiOffice.edit.emptyDept')}</option>
                    {templates.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
                  </select>
                  <em>{t('aiOffice.edit.templateHint')}</em>
                </label>
              )}
              <label className="ofp-lbl">
                <span>{t('aiOffice.edit.name')}</span>
                <input className="ofp-in" value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} placeholder={t('aiOffice.edit.namePh')} />
              </label>
              <label className="ofp-lbl">
                <span>{t('aiOffice.curator.label')}</span>
                <select className="ofp-sel" value={form.curatorAgentId ?? ''} onChange={(e) => set('curatorAgentId', e.target.value || null)}>
                  <option value="">{t('aiOffice.curator.none')}</option>
                  {employees.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.roleShortTitle || a.roleTitle ? ` — ${a.roleShortTitle || a.roleTitle}` : ''}{a.status !== 'active' ? ` (${t('aiOffice.curator.paused')})` : ''}</option>
                  ))}
                </select>
                <em>{form.curatorAgentId ? t('aiOffice.curator.hintOn') : employees.length ? t('aiOffice.curator.hintOff') : t('aiOffice.curator.hintNoEmployees')}</em>
              </label>
              <div className="ofp-lbl">
                <span>{t('aiOffice.edit.language')}</span>
                <div className="ofp-seg" style={{ alignSelf: 'flex-start' }}>
                  {(['ru', 'en', 'tr'] as const).map((l) => (
                    <button key={l} className={form.language === l ? 'on' : ''} onClick={() => set('language', l)}>{t(`aiOffice.lang.${l}`)}</button>
                  ))}
                </div>
                <em>{t('aiOffice.edit.languageHint')}</em>
              </div>
              <div className="ofp-lbl">
                <span>{t('aiOffice.edit.color')}</span>
                <div className="ed-sw">
                  {catalog.colors.map((c) => (
                    <button key={c} className={form.color === c ? 'on' : ''} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />
                  ))}
                  <label className={edx('ed-sw-own', !catalog.colors.includes(form.color) && 'on')} title={t('aiOffice.edit.ownColor')} style={{ background: catalog.colors.includes(form.color) ? undefined : form.color }}>
                    <input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} />+
                  </label>
                </div>
                <em>{t('aiOffice.edit.colorHint')}</em>
              </div>
            </div>
          </section>

          {/* 02 задача и промт */}
          <section id="prompt" className="ofp-card">
            <div className="ofp-card-h"><h2>{t('aiOffice.edit.sec.prompt')}</h2></div>
            <div className="ofp-card-b ed-rows">
              <label className="ofp-lbl">
                <span>{t('aiOffice.edit.mission')}</span>
                <textarea className="ofp-ta" style={{ fontFamily: 'var(--of-sans)', fontSize: 14, minHeight: 80 }} value={form.mission} maxLength={4000} onChange={(e) => set('mission', e.target.value)} placeholder={t('aiOffice.edit.missionPh')} />
                <em>{t('aiOffice.edit.missionHint')}</em>
              </label>
              <label className="ofp-lbl">
                <span>{t('aiOffice.edit.systemPrompt')}</span>
                <textarea className="ofp-ta" value={form.systemPrompt} maxLength={12000} onChange={(e) => set('systemPrompt', e.target.value)} placeholder={t('aiOffice.edit.systemPromptPh')} />
                <em>{t('aiOffice.edit.systemPromptHint')}</em>
              </label>
              <div className="ofp-lbl">
                <span>{t('aiOffice.edit.rules')}</span>
                <div className="ed-rules">
                  {catalog.rules.map((r) => {
                    const on = form.rules.includes(r);
                    return (
                      <button key={r} className={on ? 'on' : ''} onClick={() => set('rules', on ? form.rules.filter((x) => x !== r) : [...form.rules, r])}>
                        <span className={edx('ofp-sw', on && 'on')} />
                        <span>
                          {t(`aiOffice.rules.${r}`)}
                          <em>{t(`aiOffice.rules.${r}_hint`)}</em>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 03 сотрудники */}
          <section id="agents" className="ofp-card">
            <div className="ofp-card-h">
              <h2>{t('aiOffice.dept.staff')} <small>{form.agents.length} / {maxAgents}</small></h2>
              <button className="ofp-btn" disabled={form.agents.length >= maxAgents} onClick={() => set('agents', [...form.agents, { title: t('aiOffice.edit.newAgent'), isLead: false, prompt: '', open: true }])}>+ {t('aiOffice.dept.agent')}</button>
            </div>
            <div className="ed-agents">
              {form.agents.map((a, i) => (
                <div key={a.id ?? `n${i}`} className="ed-ag">
                  <div className="row">
                    <span className="odp-ava" style={{ background: form.color, width: 30, height: 30, fontSize: 15 }}>{a.title[0] || '?'}</span>
                    <input className="ofp-in" value={a.title} maxLength={120} onChange={(e) => setAg(i, { title: e.target.value })} />
                    <button className={edx('ed-star', a.isLead && 'on')} title={t('aiOffice.edit.lead')} onClick={() => set('agents', form.agents.map((x, j) => ({ ...x, isLead: j === i })))}>★</button>
                    <button className="ofp-btn" onClick={() => setAg(i, { open: !a.open })}>{t('aiOffice.edit.prompt')}</button>
                    <button className="ed-x" title={t('aiOffice.edit.removeAgent')} disabled={form.agents.length <= 1} onClick={() => set('agents', form.agents.filter((_, j) => j !== i))}>✕</button>
                  </div>
                  {a.open && <textarea className="ofp-ta" style={{ minHeight: 70 }} maxLength={6000} placeholder={t('aiOffice.edit.agentPromptPh', { role: a.title })} value={a.prompt} onChange={(e) => setAg(i, { prompt: e.target.value })} />}
                </div>
              ))}
            </div>
          </section>

          {/* 04 коннекторы */}
          <section id="conns" className="ofp-card">
            <div className="ofp-card-h">
              <h2>{t('aiOffice.edit.sec.conns')} <small>{form.connectors.length}</small></h2>
              <Link className="ofp-btn" to="/ai-office/connect">{t('aiOffice.edit.connectNew')}</Link>
            </div>
            <div className="ed-conns">
              {connectors.map((c) => {
                const on = form.connectors.includes(c.key);
                return (
                  <button key={c.key} className={edx('ed-c', on && 'on')} onClick={() => set('connectors', on ? form.connectors.filter((x) => x !== c.key) : [...form.connectors, c.key])}>
                    <OfficeLogo c={c} size={28} off={!on} />
                    <b>
                      {c.name}
                      <small>{t(`aiOffice.connStatus.${c.status}`)}</small>
                    </b>
                    <span className={edx('ofp-sw', on && 'on')} />
                  </button>
                );
              })}
            </div>
          </section>

          {/* 05 знания */}
          <section id="brain" className="ofp-card">
            <div className="ofp-card-h">
              <h2>{t('aiOffice.edit.sec.brain')}</h2>
              <Link className="ofp-btn" to={`/ai-office/brain?folder=${isNew ? 'common' : dept?.id}`}>{t('aiOffice.edit.openBrain')}</Link>
            </div>
            <div className="ofp-card-b ed-rows">
              <div className="ed-kn">
                {deptFiles.slice(0, 20).map((f) => (
                  <span key={f.id} className="ofp-tag">
                    <i style={{ background: f.indexStatus === 'ready' ? 'var(--of-ok)' : f.indexStatus === 'failed' ? 'var(--of-err)' : 'var(--of-warn)' }} />
                    {f.name}
                    <em>{f.folder === 'common' ? t('aiOffice.brain.common') : dept?.name}</em>
                  </span>
                ))}
                {pendingFiles.map((f) => (
                  <span key={f.name} className="ofp-tag ok"><i />{f.name}<em>{t('aiOffice.edit.afterCreate')}</em></span>
                ))}
                {deptFiles.length === 0 && pendingFiles.length === 0 && <span className="ofp-k">{t('aiOffice.edit.noFiles')}</span>}
              </div>
              <label className="ed-up">
                <input ref={fileInput} type="file" multiple hidden accept=".md,.txt,.pdf,.csv,.xlsx,.xls,.docx,.png,.jpg,.jpeg,.webp" onChange={(e) => { void uploadNow(e.target.files); e.target.value = ''; }} />
                {t('aiOffice.edit.dropFiles')}
              </label>
              <em className="ofp-k" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>{t('aiOffice.edit.brainHint')}</em>
            </div>
          </section>

          {/* 06 права */}
          <section id="perms" className="ofp-card">
            <div className="ofp-card-h">
              <h2>{t('aiOffice.edit.sec.perms')}</h2>
              <span className="ofp-k">{t('aiOffice.edit.permsHint')}</span>
            </div>
            <div className="ed-perms">
              {catalog.categories.map((c) => (
                <div key={c.key} className="ed-p">
                  <b>
                    {t(`aiOffice.perm.${c.key}`)}
                    <small>{t(`aiOffice.perm.${c.key}_hint`)}</small>
                  </b>
                  <div className="ofp-seg">
                    {(['off', 'read', 'draft', 'appr', 'auto'] as OfficeLevel[]).map((lv) => (
                      <button
                        key={lv}
                        disabled={!c.levels.includes(lv)}
                        title={!c.levels.includes(lv) ? t('aiOffice.edit.levelUnavailable') : t(`aiOffice.level.${lv}_hint`)}
                        className={form.permissions[c.key] === lv ? 'on' : ''}
                        onClick={() => set('permissions', { ...form.permissions, [c.key]: lv })}
                      >
                        {t(`aiOffice.level.${lv}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* защита клиентов */}
          <section id="safety" className="ofp-card">
            <div className="ofp-card-h"><h2>{t('aiOffice.edit.sec.safety')}</h2></div>
            <div className="ofp-card-b ed-rows">
              <em className="ofp-k" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12.5, fontStyle: 'normal' }}>{t('aiOffice.safety.hint')}</em>
              <div className="ed-two">
                <label className="ofp-lbl">
                  <span>{t('aiOffice.safety.daily')}</span>
                  <input className="ofp-in" type="number" min={0} max={5000} value={form.safety.dailySends} onChange={(e) => set('safety', { ...form.safety, dailySends: Math.max(0, Math.min(5000, Number(e.target.value) || 0)) })} />
                  <em>{t('aiOffice.safety.dailyHint')}</em>
                </label>
                <label className="ofp-lbl">
                  <span>{t('aiOffice.safety.freq')}</span>
                  <input className="ofp-in" type="number" min={0} max={720} value={form.safety.minHoursPerClient} onChange={(e) => set('safety', { ...form.safety, minHoursPerClient: Math.max(0, Math.min(720, Number(e.target.value) || 0)) })} />
                  <em>{t('aiOffice.safety.freqHint')}</em>
                </label>
              </div>
              <label className="ofp-lbl">
                <span>{t('aiOffice.safety.stop')}</span>
                <textarea
                  className="ofp-ta"
                  rows={3}
                  value={form.safety.stopList.join('\n')}
                  placeholder={t('aiOffice.safety.stopPh')}
                  onChange={(e) => set('safety', { ...form.safety, stopList: e.target.value.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean) })}
                />
                <em>{t('aiOffice.safety.stopHint')}</em>
              </label>
              {(
                [
                  ['allowAdChanges', 'ads', ['marketing']],
                  ['autoPurchaseOrders', 'autoOrders', ['stock']],
                  ['autoKbReplies', 'autoKb', ['support']],
                  ['autoBookingMessages', 'autoBooking', ['reception']],
                  ['autoPosting', 'autoPosting', ['content']],
                ] as const
              )
                // у отдела из шаблона — только его переключатели, у своего отдела — все
                .filter(([, , tpls]) => !(dept?.templateKey ?? tpl) || (tpls as readonly string[]).includes(dept?.templateKey ?? tpl))
                .map(([key, label]) => (
                  <label key={key} className="ofp-lbl" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <input type="checkbox" checked={!!form.safety[key]} onChange={(e) => set('safety', { ...form.safety, [key]: e.target.checked })} style={{ marginTop: 3 }} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <b style={{ fontWeight: 600 }}>{t(`aiOffice.safety.${label}`)}</b>
                      <em>{t(`aiOffice.safety.${label}Hint`)}</em>
                    </span>
                  </label>
                ))}
            </div>
          </section>

          {/* 07 автоматизации */}
          <section id="auto" className="ofp-card">
            <div className="ofp-card-h">
              <h2>{t('aiOffice.edit.sec.auto')} <small>{deptAutomations.length}</small></h2>
              <Link className="ofp-btn" to="/automations/new">{t('aiOffice.auto.builder')}</Link>
            </div>
            <div className="ed-auto">
              {isNew && <div><span>{t('aiOffice.auto.afterCreate')}</span></div>}
              {deptAutomations.map((a) => (
                <div key={a.id}>
                  <span>
                    {a.name}
                    <em>{t('aiOffice.auto.when')}: {getTriggerLabel(a.triggerEvent, t)}{a.isActive ? '' : ` · ${t('aiOffice.auto.off')}`}</em>
                  </span>
                  <Link className="ofp-btn" to={`/automations/${a.id}`}>{t('aiOffice.common.open')}</Link>
                </div>
              ))}
              {!isNew &&
                recommended
                  .filter((r) => !deptAutomations.some((a) => a.triggerEvent === r.trigger))
                  .map((r) => (
                    <div key={r.key}>
                      <span>
                        {t(`aiOffice.auto.${r.titleKey}`).replace(/\[\[[^\]]+\]\]/g, '…')}
                        <em>{t('aiOffice.auto.recommended')} · {t('aiOffice.auto.when')}: {getTriggerLabel(r.trigger, t)}</em>
                      </span>
                      <button className="ofp-btn" disabled={autoBusy === r.key} onClick={() => addRecommended(r)}>+ {t('aiOffice.common.add')}</button>
                    </div>
                  ))}
              {!isNew && deptAutomations.length === 0 && recommended.length === 0 && <div><span>{t('aiOffice.auto.none')}</span></div>}
            </div>
          </section>

          {/* 08 движок и бюджет */}
          <section id="engine" className="ofp-card">
            <div className="ofp-card-h"><h2>{t('aiOffice.edit.sec.engine')}</h2></div>
            <div className="ofp-card-b ed-rows">
              <div className="ed-eng">
                <button className={form.engine.mode === 'platform' ? 'on' : ''} onClick={() => set('engine', { mode: 'platform' })}>
                  <b>{t('aiOffice.engine.platform')}</b>
                  <em>{t('aiOffice.engine.platformHint')}</em>
                </button>
                {(engines?.byok ?? []).map((k) => (
                  <button key={k.connectionId} className={form.engine.mode === 'byok' && form.engine.connectionId === k.connectionId ? 'on' : ''} onClick={() => set('engine', { mode: 'byok', connectionId: k.connectionId })}>
                    <b>{k.label}</b>
                    <em>{k.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} · …{k.keyTail}{k.model ? ` · ${k.model}` : ''}</em>
                  </button>
                ))}
                {(engines?.byok ?? []).length === 0 && (
                  <button disabled>
                    <b>{t('aiOffice.engine.byok')}</b>
                    <em>{t('aiOffice.engine.byokOnRequest')}</em>
                  </button>
                )}
              </div>
              <label className="ofp-lbl">
                <span>{t('aiOffice.edit.budget', { v: fmtEur(form.monthlyBudgetCents) })}</span>
                <input type="range" min={500} max={100000} step={500} value={form.monthlyBudgetCents} onChange={(e) => set('monthlyBudgetCents', Number(e.target.value))} />
                <em>{t('aiOffice.edit.budgetHint')}</em>
              </label>
              <div className="ed-two">
                <label className="ofp-lbl">
                  <span>{t('aiOffice.edit.parallel')}</span>
                  <input className="ofp-in" type="number" min={1} max={12} value={form.parallelLimit} onChange={(e) => set('parallelLimit', Math.max(1, Math.min(12, Number(e.target.value) || 1)))} />
                </label>
                <div className="ofp-lbl">
                  <span>{t('aiOffice.edit.hours')}</span>
                  <div className="ofp-seg">
                    {(['24/7', 'weekdays', 'on_demand'] as const).map((h) => (
                      <button key={h} className={form.workHours === h ? 'on' : ''} onClick={() => set('workHours', h)}>{t(`aiOffice.hours.${h === '24/7' ? 'always' : h}`)}</button>
                    ))}
                  </div>
                  <em>{t(`aiOffice.hours.${form.workHours === '24/7' ? 'always' : form.workHours}_hint`)}</em>
                </div>
              </div>
              <div className="ed-two">
                <label className="ofp-lbl">
                  <span>{t('aiOffice.edit.planEvery')}</span>
                  <input className="ofp-in" type="number" min={1} max={168} value={form.proactiveEveryHours} onChange={(e) => set('proactiveEveryHours', Math.max(1, Math.min(168, Number(e.target.value) || 6)))} />
                </label>
                <label className="ofp-lbl">
                  <span>{t('aiOffice.edit.timezone')}</span>
                  <input className="ofp-in" value={form.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="Europe/Istanbul" />
                </label>
              </div>
              <div className="ofp-lbl">
                <span>{t('aiOffice.edit.kpis')}</span>
                <div className="br-scopes">
                  {catalog.kpis.map((k) => {
                    const on = form.kpis.includes(k);
                    return (
                      <button key={k} className={on ? 'on' : ''} onClick={() => set('kpis', on ? form.kpis.filter((x) => x !== k) : [...form.kpis, k].slice(-2))}>
                        <i style={{ background: 'var(--of-ink)' }} />
                        {t(`aiOffice.kpi.${k}`)}
                      </button>
                    );
                  })}
                </div>
                <em>{t('aiOffice.edit.kpisHint')}</em>
              </div>
            </div>
          </section>

          {!isNew && (
            <div className="ofp-card ofp-card-b" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--of-fg2)' }}>{t('aiOffice.edit.deleteHint')}</span>
              <button className="ofp-btn danger" onClick={remove}>{t('aiOffice.edit.delete')}</button>
            </div>
          )}
        </div>

        <aside className="ed-prev">
          <div className="ofp-card" style={{ overflow: 'hidden' }}>
            <div className="ofp-card-h">
              <h2>{t('aiOffice.edit.room')}</h2>
              <span className="ofp-tag live ok"><i />{t('aiOffice.edit.preview')}</span>
            </div>
            <div className={edx('ed-room', night && 'night')} style={{ background: `radial-gradient(circle at 50% 60%, ${form.color}33, transparent 70%)` }}>
              {preview && <RoomScene d={preview} night={night} />}
            </div>
            <div className="ed-sum">
              <div><span className="ofp-k">{t('aiOffice.dept.staff')}</span><b>{form.agents.length}</b></div>
              <div><span className="ofp-k">{t('aiOffice.edit.sec.conns')}</span><b>{form.connectors.length}</b></div>
              <div><span className="ofp-k">{t('aiOffice.edit.limit')}</span><b>{Math.round(form.monthlyBudgetCents / 100)} €</b></div>
            </div>
          </div>
          {isNew && plan && (
            <div className={edx('ofp-card ofp-card-b ed-bill', needSlot && 'need')}>
              <span className="ofp-k">{t('aiOffice.edit.payment')}</span>
              <p>{t('aiOffice.edit.slotText', { n: plan.used + 1, plan: t(`aiOffice.plans.${plan.plan}`, plan.plan), included: plan.included, extra: plan.extraActive })}</p>
              {full ? (
                <div className="pl-note warn">{t('aiOffice.edit.officeFull')}</div>
              ) : needSlot ? (
                <>
                  <div className="ed-price"><b>+{plan.extraPriceEur} €</b><span>{t('aiOffice.edit.perMonth')}</span></div>
                  <Link className="ofp-btn pri" style={{ marginTop: 12 }} to="/ai-office/plan?add=1">{t('aiOffice.edit.buySlot')}</Link>
                </>
              ) : (
                <div className="ed-price"><b>0 €</b><span>{t('aiOffice.edit.freeSlot')}</span></div>
              )}
              <Link to="/ai-office/plan" className="ed-link">{t('aiOffice.edit.planLink')} →</Link>
            </div>
          )}
          {form.connectors.some((k) => connByKey(k) && connByKey(k)!.status !== 'ok') && (
            <div className="ofp-card ofp-card-b">
              <span className="ofp-k">{t('aiOffice.edit.connWarn')}</span>
              <div className="odp-conns" style={{ marginTop: 8 }}>
                {form.connectors.filter((k) => connByKey(k)?.status !== 'ok').map((k) => (
                  <span key={k} className="ofp-tag warn">{connByKey(k)?.name ?? k} · {t(`aiOffice.connStatus.${connByKey(k)?.status ?? 'off'}`)}</span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </OfficeShell>
  );
}

export default AiDepartmentEditPage;
