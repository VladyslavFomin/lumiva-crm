import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchCustomObjects, type CustomObject } from '../../api/customObjects';
import { fetchEmailAccounts, type EmailAccount } from '../../api/email';
import {
  expandAiInstructions,
  type AiEmailInboxAccess,
  type AiEmployeeRoleKey,
  type AiTableAccess,
  type AiTriggerConfig,
  type AiTriggerScope,
} from '../../api/aiEmployees';

const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export const AI_INSTRUCTIONS_MAX = 8000;

/** Зеркало AI_TRIGGER_CATALOG из backend (ai-employee-triggers.ts). ai.assigned здесь нет — он не переключается. */
export const TRIGGER_GROUPS: Array<{ group: string; events: string[] }> = [
  { group: 'leads', events: ['lead.created', 'lead.status_changed', 'lead.assigned'] },
  { group: 'sales', events: ['sale.created', 'sale.status_changed'] },
  { group: 'projects', events: ['project.created', 'project.status_changed'] },
  { group: 'tasks', events: ['task.created', 'task.status_changed'] },
  { group: 'clients', events: ['contact.created', 'company.created'] },
  { group: 'messages', events: ['telegram.message_received', 'email.received'] },
  {
    group: 'bookings',
    events: [
      'booking.reservation_created',
      'booking.reservation_status_changed',
      'hotel.reservation_created',
      'hotel.reservation_status_changed',
    ],
  },
  {
    group: 'workspace',
    events: ['custom_object.record_created', 'custom_object.record_updated', 'custom_object.status_changed'],
  },
];

/** События, у которых есть смысл выбирать «все записи / только где я ответственный». */
const SCOPEABLE = new Set([
  'lead.status_changed',
  'lead.assigned',
  'project.status_changed',
  'task.status_changed',
  'telegram.message_received',
  'email.received',
  'custom_object.record_updated',
  'custom_object.status_changed',
]);

const DEFAULT_SCOPE: Record<string, AiTriggerScope> = {
  'lead.status_changed': 'mine',
  'project.status_changed': 'mine',
  'task.status_changed': 'mine',
  'telegram.message_received': 'mine',
  'email.received': 'mine',
  'custom_object.record_updated': 'mine',
  'custom_object.status_changed': 'mine',
};

const eventKey = (event: string) => event.replace(/\./g, '_');

/* ---------------------------------------------------------------- instructions */

export type ExpandInstructionsContext = {
  role: AiEmployeeRoleKey;
  agentId?: string;
  name?: string;
  department?: string;
  jobTitle?: string;
  language?: string;
  tone?: string;
};

export function InstructionsEditor({
  value,
  onChange,
  expandContext,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Когда передан — показывает «✦ Расширить с помощью ИИ»: короткий черновик становится полноценной инструкцией. */
  expandContext?: ExpandInstructionsContext;
}) {
  const { t } = useTranslation();
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState('');

  const expand = async () => {
    if (!expandContext) return;
    setExpanding(true);
    setError('');
    try {
      const res = await expandAiInstructions({ ...expandContext, draft: value });
      onChange(res.text);
    } catch (e: any) {
      setError(e?.message || t('crm.aiEmployees.errors.generic'));
    } finally {
      setExpanding(false);
    }
  };

  return (
    <div className="ai-form-card">
      <div className="fct" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        {t('crm.aiEmployees.config.instructionsTitle')}
        {expandContext ? (
          <button type="button" className="aib ghost sm" disabled={expanding} onClick={expand}>
            {expanding ? t('crm.aiEmployees.config.expanding') : `✦ ${t('crm.aiEmployees.config.expandWithAi')}`}
          </button>
        ) : null}
      </div>
      <div className="fcd">{t('crm.aiEmployees.config.instructionsHint')}</div>
      <textarea
        className="ai-textarea"
        style={{ minHeight: 160 }}
        maxLength={AI_INSTRUCTIONS_MAX}
        value={value}
        placeholder={t('crm.aiEmployees.config.instructionsPlaceholder')}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="ai-hint" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: error ? '#9a1f31' : undefined }}>
          {error || (expandContext ? t('crm.aiEmployees.config.expandHint') : '')}
        </span>
        <span>
          {value.length} / {AI_INSTRUCTIONS_MAX}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- triggers */

export function TriggersEditor({
  triggers,
  onChange,
}: {
  triggers: AiTriggerConfig[];
  onChange: (next: AiTriggerConfig[]) => void;
}) {
  const { t } = useTranslation();
  const byEvent = new Map(triggers.map((tr) => [tr.event, tr]));

  const patch = (event: string, change: Partial<AiTriggerConfig>) => {
    const current: AiTriggerConfig = byEvent.get(event) ?? {
      event,
      enabled: false,
      scope: DEFAULT_SCOPE[event] ?? 'all',
      prompt: '',
    };
    const next = { ...current, ...change };
    onChange([...triggers.filter((x) => x.event !== event), next]);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="ai-panel">
        <div className="ai-panel-body" style={{ fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.55 }}>
          <b style={{ color: 'var(--ink)' }}>{t('crm.aiEmployees.triggers.title')}.</b> {t('crm.aiEmployees.triggers.hint')}
          <div style={{ marginTop: 8, color: 'var(--fg-3)' }}>{t('crm.aiEmployees.triggers.assignedNote')}</div>
        </div>
      </div>
      {TRIGGER_GROUPS.map((g) => (
        <div key={g.group} className="ai-panel">
          <div className="ai-panel-head">
            <div className="pt">{t(`crm.aiEmployees.triggers.groups.${g.group}`)}</div>
          </div>
          <div className="ai-panel-body flush">
            {g.events.map((event) => {
              const tr = byEvent.get(event);
              const on = Boolean(tr?.enabled);
              const scope = tr?.scope ?? DEFAULT_SCOPE[event] ?? 'all';
              return (
                <div key={event} className="ai-trig">
                  <div className="ai-perm" style={{ borderBottom: 0 }}>
                    <div className="pb">
                      <div className="pn">{t(`crm.aiEmployees.triggers.events.${eventKey(event)}.title`, { defaultValue: event })}</div>
                      <div className="pd">{t(`crm.aiEmployees.triggers.events.${eventKey(event)}.hint`, { defaultValue: '' })}</div>
                    </div>
                    <button
                      type="button"
                      className={cn('ai-toggle', on ? 'on' : 'off')}
                      onClick={() => patch(event, { enabled: !on })}
                    />
                  </div>
                  {on ? (
                    <div className="ai-trig-body">
                      {SCOPEABLE.has(event) ? (
                        <div className="ai-field" style={{ marginBottom: 10 }}>
                          <label className="ai-label">{t('crm.aiEmployees.triggers.scopeLabel')}</label>
                          <select
                            className="ai-select"
                            value={scope}
                            onChange={(e) => patch(event, { scope: e.target.value as AiTriggerScope })}
                          >
                            <option value="all">{t('crm.aiEmployees.triggers.scope.all')}</option>
                            <option value="mine">{t('crm.aiEmployees.triggers.scope.mine')}</option>
                          </select>
                        </div>
                      ) : null}
                      <label className="ai-label">{t('crm.aiEmployees.triggers.promptLabel')}</label>
                      <textarea
                        className="ai-textarea"
                        style={{ minHeight: 64 }}
                        maxLength={2000}
                        value={tr?.prompt ?? ''}
                        placeholder={t('crm.aiEmployees.triggers.promptPlaceholder')}
                        onChange={(e) => patch(event, { prompt: e.target.value })}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- table access */

export function TableAccessEditor({
  value,
  onChange,
}: {
  value: AiTableAccess;
  onChange: (next: AiTableAccess) => void;
}) {
  const { t } = useTranslation();
  const [objects, setObjects] = useState<CustomObject[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchCustomObjects()
      .then((rows) => {
        if (alive) setObjects(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (alive) {
          setObjects([]);
          setFailed(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const levelOf = (id: string): 'none' | 'read' | 'write' => value.tables.find((x) => x.objectId === id)?.access ?? 'none';
  const setLevel = (id: string, level: 'none' | 'read' | 'write') => {
    const rest = value.tables.filter((x) => x.objectId !== id);
    onChange({ ...value, tables: level === 'none' ? rest : [...rest, { objectId: id, access: level }] });
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-head">
        <div className="pt">{t('crm.aiEmployees.tableAccess.title')}</div>
      </div>
      <p className="ai-hint" style={{ margin: 0, padding: '12px 18px 0', fontSize: 12.5 }}>
        {t('crm.aiEmployees.tableAccess.hint')}
      </p>
      <div style={{ padding: '12px 18px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['selected', 'all'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={cn('aib sm', value.mode !== mode && 'ghost')}
            onClick={() => onChange({ ...value, mode })}
          >
            {t(`crm.aiEmployees.tableAccess.mode.${mode}`)}
          </button>
        ))}
      </div>
      {value.mode === 'all' ? (
        <p className="ai-hint" style={{ margin: 0, padding: '0 18px 14px', fontSize: 12.5, color: '#7a4a09' }}>
          {t('crm.aiEmployees.tableAccess.allWarning')}
        </p>
      ) : (
        <div className="ai-panel-body flush ai-perm-grid">
          {objects === null ? (
            <div className="ai-hint" style={{ padding: '14px 18px' }}>
              {t('crm.aiEmployees.tableAccess.loading')}
            </div>
          ) : objects.length === 0 ? (
            <div className="ai-hint" style={{ padding: '14px 18px' }}>
              {failed ? t('crm.aiEmployees.tableAccess.loadFailed') : t('crm.aiEmployees.tableAccess.empty')}
            </div>
          ) : (
            objects.map((o) => (
              <div className="ai-perm" key={o.id}>
                <div className="pb">
                  <div className="pn">{o.name}</div>
                  {o.description ? <div className="pd">{o.description}</div> : null}
                </div>
                <select
                  className="ai-select"
                  style={{ width: 170, flexShrink: 0 }}
                  value={levelOf(o.id)}
                  onChange={(e) => setLevel(o.id, e.target.value as 'none' | 'read' | 'write')}
                >
                  <option value="none">{t('crm.aiEmployees.tableAccess.level.none')}</option>
                  <option value="read">{t('crm.aiEmployees.tableAccess.level.read')}</option>
                  <option value="write">{t('crm.aiEmployees.tableAccess.level.write')}</option>
                </select>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- email inbox access */

/**
 * По умолчанию пусто — ИИ не читает ни один ящик, пока владелец явно не отметит конкретный
 * аккаунт. Отдельно от общего триггера email.received: галочка тут — это "какие ящики вообще
 * видны", сам триггер (в TriggersEditor, группа "messages") — "реагировать ли на входящие
 * автоматически". Оба должны быть включены, иначе события не будет.
 */
export function EmailInboxAccessEditor({
  value,
  onChange,
}: {
  value: AiEmailInboxAccess;
  onChange: (next: AiEmailInboxAccess) => void;
}) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<EmailAccount[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchEmailAccounts()
      .then((rows) => {
        if (alive) setAccounts(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (alive) {
          setAccounts([]);
          setFailed(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (id: string) => {
    const has = value.accountIds.includes(id);
    onChange({ accountIds: has ? value.accountIds.filter((x) => x !== id) : [...value.accountIds, id] });
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-head">
        <div className="pt">{t('crm.aiEmployees.emailInboxAccess.title')}</div>
      </div>
      <p className="ai-hint" style={{ margin: 0, padding: '12px 18px 0', fontSize: 12.5 }}>
        {t('crm.aiEmployees.emailInboxAccess.hint')}
      </p>
      <div className="ai-panel-body flush ai-perm-grid">
        {accounts === null ? (
          <div className="ai-hint" style={{ padding: '14px 18px' }}>
            {t('crm.aiEmployees.emailInboxAccess.loading')}
          </div>
        ) : accounts.length === 0 ? (
          <div className="ai-hint" style={{ padding: '14px 18px' }}>
            {failed ? t('crm.aiEmployees.emailInboxAccess.loadFailed') : t('crm.aiEmployees.emailInboxAccess.empty')}
          </div>
        ) : (
          accounts.map((a) => (
            <div className="ai-perm" key={a.id}>
              <div className="pb">
                <div className="pn">{a.name || a.email}</div>
                {a.name ? <div className="pd">{a.email}</div> : null}
              </div>
              <button
                type="button"
                className={cn('ai-toggle', value.accountIds.includes(a.id) ? 'on' : 'off')}
                onClick={() => toggle(a.id)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- client dialogue */

export function ClientDialogueEditor({
  value,
  onChange,
  lockNote,
}: {
  value: 'approval' | 'auto';
  onChange: (v: 'approval' | 'auto') => void;
  /** Уровень автономии сейчас сам решает за этот переключатель — показать почему и заблокировать. */
  lockNote?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="ai-panel">
      <div className="ai-panel-head">
        <div className="pt">{t('crm.aiEmployees.dialogue.title')}</div>
      </div>
      <p className="ai-hint" style={{ margin: 0, padding: '12px 18px 0', fontSize: 12.5 }}>
        {t('crm.aiEmployees.dialogue.hint')}
      </p>
      {lockNote ? (
        <p className="ai-hint" style={{ margin: 0, padding: '8px 18px 0', fontSize: 12.5, color: '#7a4a09' }}>
          ⓘ {lockNote}
        </p>
      ) : null}
      <div className="ai-autonomy" style={{ padding: 18, ...(lockNote ? { opacity: 0.45, pointerEvents: 'none' } : null) }}>
        {(['approval', 'auto'] as const).map((mode) => (
          <button key={mode} type="button" className={cn('ai-autonomy-opt', value === mode && 'on')} onClick={() => onChange(mode)}>
            <div className="an">{t(`crm.aiEmployees.dialogue.${mode}.title`)}</div>
            <div className="ad">{t(`crm.aiEmployees.dialogue.${mode}.hint`)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- SLA + daily plan */

export function ControlEditor({
  sla,
  dailyPlan,
  onSla,
  onDailyPlan,
  onCheckSla,
  onRunPlan,
}: {
  sla: { enabled: boolean; minutes: number };
  dailyPlan: { enabled: boolean; time: string };
  onSla: (v: { enabled: boolean; minutes: number }) => void;
  onDailyPlan: (v: { enabled: boolean; time: string }) => void;
  onCheckSla?: () => void;
  onRunPlan?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3.5">
      <div className="ai-panel">
        <div className="ai-panel-head">
          <div className="pt">{t('crm.aiEmployees.sla.title')}</div>
        </div>
        <div className="ai-perm" style={{ borderBottom: 0 }}>
          <div className="pb">
            <div className="pn">{t('crm.aiEmployees.sla.enable')}</div>
            <div className="pd">{t('crm.aiEmployees.sla.hint')}</div>
          </div>
          <button type="button" className={cn('ai-toggle', sla.enabled ? 'on' : 'off')} onClick={() => onSla({ ...sla, enabled: !sla.enabled })} />
        </div>
        {sla.enabled ? (
          <div className="ai-trig-body" style={{ paddingLeft: 18 }}>
            <label className="ai-label">{t('crm.aiEmployees.sla.minutes')}</label>
            <input
              className="ai-input"
              type="number"
              min={5}
              max={1440}
              style={{ maxWidth: 160 }}
              value={sla.minutes}
              onChange={(e) => onSla({ ...sla, minutes: Number(e.target.value) || 30 })}
            />
            {onCheckSla ? (
              <div style={{ marginTop: 10 }}>
                <button type="button" className="aib ghost sm" onClick={onCheckSla}>
                  {t('crm.aiEmployees.sla.checkNow')}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="ai-panel">
        <div className="ai-panel-head">
          <div className="pt">{t('crm.aiEmployees.dailyPlan.title')}</div>
        </div>
        <div className="ai-perm" style={{ borderBottom: 0 }}>
          <div className="pb">
            <div className="pn">{t('crm.aiEmployees.dailyPlan.enable')}</div>
            <div className="pd">{t('crm.aiEmployees.dailyPlan.hint')}</div>
          </div>
          <button type="button" className={cn('ai-toggle', dailyPlan.enabled ? 'on' : 'off')} onClick={() => onDailyPlan({ ...dailyPlan, enabled: !dailyPlan.enabled })} />
        </div>
        {dailyPlan.enabled ? (
          <div className="ai-trig-body" style={{ paddingLeft: 18 }}>
            <label className="ai-label">{t('crm.aiEmployees.dailyPlan.time')}</label>
            <input className="ai-input" type="time" style={{ maxWidth: 160 }} value={dailyPlan.time} onChange={(e) => onDailyPlan({ ...dailyPlan, time: e.target.value })} />
            {onRunPlan ? (
              <div style={{ marginTop: 10 }}>
                <button type="button" className="aib ghost sm" onClick={onRunPlan}>
                  {t('crm.aiEmployees.dailyPlan.runNow')}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
