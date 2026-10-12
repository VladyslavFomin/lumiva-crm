import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { aiOfficeApi, type OfficeDepartment, type OfficeImpact, type OfficePost } from '../../api/aiOffice';
import { fetchAutomations, updateAutomation, type Automation } from '../../api/automations';
import { getTriggerLabel } from '../automations/automationLabels';
import { fmtEur, useNotify } from './officeShared';

const sum = (o: Record<string, number>, keys: string[]) => keys.reduce((s, k) => s + (o[k] ?? 0), 0);

/** «Польза отдела»: что реально сделано за период — по выполненным действиям агентов. */
export function DeptImpact({ deptId }: { deptId: string }) {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [x, setX] = useState<OfficeImpact | null>(null);
  const [showFormula, setShowFormula] = useState(false);
  useEffect(() => {
    aiOfficeApi.impact(deptId, days).then(setX).catch(() => setX(null));
  }, [deptId, days]);
  if (!x) return null;
  const a = x.actions;
  const messages = sum(a, ['send_email', 'send_telegram', 'send_whatsapp']);
  const hours = x.savedMinutes / 60;
  const fr = x.firstResponse;
  const tiles: Array<[string, string, string?]> = [
    [t('aiOffice.impact.leads'), String(x.leadsHandled)],
    [
      t('aiOffice.impact.firstResponse'),
      fr.medianMinutes == null ? '—' : fr.medianMinutes < 1 ? t('aiOffice.impact.lt1min') : t('aiOffice.impact.minutes', { n: Math.round(fr.medianMinutes) }),
      fr.newLeads ? t('aiOffice.impact.firstResponseSub', { answered: fr.answered, total: fr.newLeads, within5: fr.within5 }) : t('aiOffice.impact.noNewLeads'),
    ],
    [t('aiOffice.impact.messages'), String(messages), a.send_bulk_email ? t('aiOffice.impact.bulk', { n: a.send_bulk_email }) : undefined],
    [t('aiOffice.impact.meetings'), String(a.create_meeting ?? 0)],
    [t('aiOffice.impact.won'), String(x.wonAfterTouch), t('aiOffice.impact.wonSub')],
    [t('aiOffice.impact.managerTasks'), String(sum(a, ['create_task']))],
    [t('aiOffice.impact.docs'), String(sum(a, ['brain_write', 'create_report']))],
    [t('aiOffice.impact.tasksDone'), String(x.tasks.done), x.tasks.failed ? t('aiOffice.impact.failed', { n: x.tasks.failed }) : undefined],
  ];
  return (
    <div className="ofp-card">
      <div className="ofp-card-h">
        <h2>{t('aiOffice.impact.title')} <small>{t('aiOffice.impact.realOnly')}</small></h2>
        <div className="ofp-seg">
          {[7, 30, 90].map((n) => (
            <button key={n} className={days === n ? 'on' : ''} onClick={() => setDays(n)}>{t('aiOffice.impact.days', { n })}</button>
          ))}
        </div>
      </div>
      <div className="imp-grid">
        {tiles.map(([k, v, sub]) => (
          <div key={k}>
            <span className="ofp-k">{k}</span>
            <b className="ofp-big">{v}</b>
            {sub && <em>{sub}</em>}
          </div>
        ))}
      </div>
      <div className="imp-foot">
        <div>
          <span className="ofp-k">{t('aiOffice.impact.saved')}</span>
          <b>{t('aiOffice.impact.hours', { n: hours < 10 ? hours.toFixed(1) : Math.round(hours) })}</b>
          <button className="imp-how" onClick={() => setShowFormula(!showFormula)}>{t('aiOffice.impact.how')}</button>
        </div>
        <div>
          <span className="ofp-k">{t('aiOffice.impact.cost')}</span>
          <b>{fmtEur(x.spendCents)}</b>
          {hours > 0 && <em>{t('aiOffice.impact.perHour', { v: fmtEur(Math.round(x.spendCents / hours)) })}</em>}
        </div>
      </div>
      {showFormula && (
        <div className="imp-formula">
          {t('aiOffice.impact.formula')}{' '}
          {Object.entries(a).map(([k, n]) => `${t(`aiOffice.actType.${k}`, k)}: ${n} × ${x.minutesPerAction[k]} ${t('aiOffice.impact.min')}`).join(' · ') || '—'}
        </div>
      )}
    </div>
  );
}

/** «Работает автоматически»: сценарии отдела (автоматизации) с включением/выключением. */
export function DeptScenarios({ deptId, dept }: { deptId: string; dept?: OfficeDepartment }) {
  const { t } = useTranslation();
  const notify = useNotify();
  const [list, setList] = useState<Automation[] | null>(null);
  useEffect(() => {
    fetchAutomations()
      .then((all) => setList(all.filter((x) => (x.actions || []).some((ac) => ac.type === 'ai_office_task' && ac.config?.departmentId === deptId))))
      .catch(() => setList([]));
  }, [deptId]);
  const [programs, setPrograms] = useState(dept?.programs);
  useEffect(() => setPrograms(dept?.programs), [dept?.programs]);
  type ProgKey = keyof NonNullable<OfficeDepartment['programs']>;
  const toggleProgram = async (key: ProgKey) => {
    if (!programs) return;
    const next = { ...programs, [key]: { ...programs[key], enabled: !programs[key]?.enabled } };
    setPrograms(next);
    try {
      const u = await aiOfficeApi.updateDepartment(deptId, { programs: { [key]: next[key] } as any });
      if (u.programs) setPrograms(u.programs);
    } catch (e) {
      setPrograms(programs);
      notify.error(e);
    }
  };
  // встроенные программы отдела по шаблону: [ключ, заголовок, подсказка]
  const progs: Array<[ProgKey, string, string]> = !programs
    ? []
    : ({
        sales: [
          ['followup', t('aiOffice.prog.followup', { days: programs.followup.days.join('-') }), t('aiOffice.prog.followupHint', { lose: programs.followup.loseAfterDays })],
          ['reactivation', t('aiOffice.prog.react'), t('aiOffice.prog.reactHint', { days: programs.reactivation.afterDays, n: programs.reactivation.perWeek })],
        ],
        finance: [
          ['debtReminders', t('aiOffice.prog.debts', { days: programs.debtReminders.days.join('-') }), t('aiOffice.prog.debtsHint')],
          ['financeWeekly', t('aiOffice.prog.finWeek'), t('aiOffice.prog.finWeekHint')],
          ['reconcile', t('aiOffice.prog.reconcile'), t('aiOffice.prog.reconcileHint')],
        ],
        marketing: [
          ['adsWatch', t('aiOffice.prog.watch'), t('aiOffice.prog.watchHint', { days: programs.adsWatch.days })],
          ['budgetReview', t('aiOffice.prog.budget'), t('aiOffice.prog.budgetHint')],
        ],
        stock: [['stockWatch', t('aiOffice.prog.stock'), t('aiOffice.prog.stockHint')]],
        dev: [['prReview', t('aiOffice.prog.pr'), t('aiOffice.prog.prHint')]],
        reception: [
          ['bookingReminders', t('aiOffice.prog.remind'), t('aiOffice.prog.remindHint')],
          ['confirmations', t('aiOffice.prog.confirm'), t('aiOffice.prog.confirmHint')],
          ['noShows', t('aiOffice.prog.noshow'), t('aiOffice.prog.noshowHint')],
          ['reviewRequests', t('aiOffice.prog.review'), t('aiOffice.prog.reviewHint')],
        ],
        support: [['supportSla', t('aiOffice.prog.sla', { h: programs.supportSla.hours }), t('aiOffice.prog.slaHint', { h: programs.supportSla.hours })]],
      } as Record<string, Array<[ProgKey, string, string]>>)[dept?.templateKey ?? ''] ?? [];
  if (!list) return null;
  const toggle = async (x: Automation) => {
    try {
      const u = await updateAutomation(x.id, { isActive: !x.isActive });
      setList((l) => (l ?? []).map((y) => (y.id === x.id ? { ...y, isActive: u.isActive } : y)));
    } catch (e) {
      notify.error(e);
    }
  };
  return (
    <div className="ofp-card">
      <div className="ofp-card-h">
        <h2>{t('aiOffice.scen.title')} <small>{list.filter((x) => x.isActive).length + progs.filter(([k]) => programs?.[k]?.enabled).length}</small></h2>
        <Link className="ofp-btn" to="/automations/new">{t('aiOffice.scen.add')}</Link>
      </div>
      <div className="ed-auto">
        {progs.map(([key, label, hint]) => (
          <div key={key}>
            <span>
              {label}
              <em>{hint}</em>
            </span>
            <button className={`ofp-sw${programs?.[key]?.enabled ? ' on' : ''}`} onClick={() => toggleProgram(key)} aria-label={label} />
          </div>
        ))}
        {list.map((x) => (
          <div key={x.id}>
            <span>
              {x.name}
              <em>
                {t('aiOffice.auto.when')}: {getTriggerLabel(x.triggerEvent, t)}
                {x.executionCount ? ` · ${t('aiOffice.scen.runs', { n: x.executionCount })}` : ''}
              </em>
            </span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link className="ofp-btn" to={`/automations/${x.id}`}>{t('aiOffice.scen.edit')}</Link>
              <button className={`ofp-sw${x.isActive ? ' on' : ''}`} onClick={() => toggle(x)} aria-label={x.isActive ? t('aiOffice.scen.off') : t('aiOffice.scen.on')} />
            </span>
          </div>
        ))}
        {list.length === 0 && <div><span>{t('aiOffice.scen.none')}</span></div>}
      </div>
    </div>
  );
}

/** Автопостинг: посты одобренных контент-планов — что и когда выйдет, что вышло; запланированный можно отменить. */
export function DeptPosts({ deptId, dept }: { deptId: string; dept?: OfficeDepartment }) {
  const { t, i18n } = useTranslation();
  const notify = useNotify();
  const [list, setList] = useState<OfficePost[] | null>(null);
  useEffect(() => {
    aiOfficeApi.posts(deptId).then(setList).catch(() => setList([]));
  }, [deptId]);
  if (!list || (!list.length && !dept?.safety?.autoPosting)) return null;
  const cancel = async (p: OfficePost) => {
    if (!(await notify.confirm(t('aiOffice.posts.cancelConfirm'), { title: t('aiOffice.posts.cancel'), confirmLabel: t('aiOffice.posts.cancel') }))) return;
    try {
      await aiOfficeApi.cancelPost(p.id);
      setList((l) => (l ?? []).map((x) => (x.id === p.id ? { ...x, status: 'cancelled' } : x)));
    } catch (e) {
      notify.error(e);
    }
  };
  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const scheduled = list.filter((p) => p.status === 'scheduled').length;
  return (
    <div className="ofp-card">
      <div className="ofp-card-h">
        <h2>
          {t('aiOffice.posts.title')} <small>{scheduled}</small>
        </h2>
      </div>
      <div className="ed-auto">
        {!dept?.safety?.autoPosting && <div><span><em>{t('aiOffice.posts.off')}</em></span></div>}
        {list.length === 0 && <div><span>{t('aiOffice.posts.none')}</span></div>}
        {list.map((p) => (
          <div key={p.id}>
            <span>
              {p.text.length > 160 ? `${p.text.slice(0, 160)}…` : p.text}
              <em>
                {when(p.publishAt)} · {p.channel} · {t(`aiOffice.posts.st.${p.status}`)}
                {p.error ? ` — ${p.error}` : ''}
              </em>
            </span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {p.url && (
                <a className="ofp-btn" href={p.url} target="_blank" rel="noreferrer">
                  {t('aiOffice.posts.open')} ↗
                </a>
              )}
              {p.status === 'scheduled' && (
                <button className="ofp-btn" onClick={() => cancel(p)}>
                  {t('aiOffice.posts.cancel')}
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
