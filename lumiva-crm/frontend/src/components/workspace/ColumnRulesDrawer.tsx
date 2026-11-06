import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { DateInput } from '../ui/DateInput';
import {
  readWorkspaceFieldRules,
  setCustomObjectFieldRules,
  type CustomObjectField,
  type WorkspaceColumnRule,
  type WorkspaceRuleAction,
  type WorkspaceRuleCheckOp,
  type WorkspaceRuleConditionOp,
} from '../../api/customObjects';
import { WsFieldTypeIcon } from './WorkspaceFieldTypePicker';
import './ColumnRules.css';

type Props = {
  objectId: string;
  field: CustomObjectField;
  /** Все видимые пользователю колонки таблицы (для «Если …» и «Потом …»). */
  fields: CustomObjectField[];
  onClose: () => void;
  onSaved: (field: CustomObjectField) => void;
};

const OPTION_TYPES = new Set(['select', 'status', 'multiselect']);
const NO_VALUE_COND: WorkspaceRuleConditionOp[] = ['empty', 'not_empty'];
const uid = () => Math.random().toString(36).slice(2, 10);

/** Какие условия «Если» имеют смысл для типа колонки. */
function conditionOpsFor(type: string): WorkspaceRuleConditionOp[] {
  if (OPTION_TYPES.has(type) || type === 'boolean') return ['is', 'is_not', 'empty', 'not_empty'];
  if (type === 'number' || type === 'date' || type === 'datetime')
    return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'empty', 'not_empty'];
  return ['is', 'is_not', 'contains', 'empty', 'not_empty'];
}

/** Проверки «должно быть …» для типа колонки. */
function checkOpsFor(type: string): WorkspaceRuleCheckOp[] {
  if (OPTION_TYPES.has(type)) return ['not_empty', 'eq', 'neq', 'one_of'];
  if (type === 'boolean') return ['not_empty', 'eq'];
  if (type === 'number' || type === 'date' || type === 'datetime')
    return ['not_empty', 'eq', 'neq', 'lte', 'gt', 'gte', 'lt', 'between'];
  return ['not_empty', 'eq', 'neq'];
}

const canSetType = (type: string) => type !== 'ai' && type !== 'file';

/** Значение одного варианта: select/boolean — выпадающий список, дата — DateInput, иначе поле. */
const ValueInput: React.FC<{
  field: CustomObjectField | undefined;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ field, value, onChange, placeholder }) => {
  const { t } = useTranslation();
  if (field && OPTION_TYPES.has(field.type)) {
    return (
      <select className="cr-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('crm.columnRules.pickValue')}</option>
        {(field.options || []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label || o.value}
          </option>
        ))}
      </select>
    );
  }
  if (field?.type === 'boolean') {
    return (
      <select className="cr-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('crm.columnRules.pickValue')}</option>
        <option value="true">{t('crm.columnRules.yes')}</option>
        <option value="false">{t('crm.columnRules.no')}</option>
      </select>
    );
  }
  if (field?.type === 'date' || field?.type === 'datetime') {
    return <DateInput value={value || null} onChange={onChange} className="cr-input" />;
  }
  return (
    <input
      className="cr-input"
      type={field?.type === 'number' ? 'number' : 'text'}
      value={value}
      placeholder={placeholder ?? t('crm.columnRules.valuePlaceholder')}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

/** Несколько вариантов: чипы с крестиком + выпадающий список оставшихся (как в макете). */
const MultiValueInput: React.FC<{
  field: CustomObjectField | undefined;
  values: string[];
  onChange: (v: string[]) => void;
}> = ({ field, values, onChange }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const opts = field && OPTION_TYPES.has(field.type) ? field.options || [] : null;
  const labelOf = (v: string) => opts?.find((o) => o.value === v)?.label || v;
  const add = (v: string) => {
    const x = v.trim();
    if (x && !values.includes(x)) onChange([...values, x]);
  };
  return (
    <div className="cr-chips">
      {values.map((v) => (
        <span key={v} className="cr-chip">
          {labelOf(v)}
          <button type="button" aria-label={t('crm.columnRules.remove')} onClick={() => onChange(values.filter((x) => x !== v))}>
            ×
          </button>
        </span>
      ))}
      {opts ? (
        <select
          className="cr-chips-pick"
          value=""
          onChange={(e) => {
            add(e.target.value);
          }}
        >
          <option value="">{values.length ? '+' : t('crm.columnRules.pickValues')}</option>
          {opts
            .filter((o) => !values.includes(o.value))
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label || o.value}
              </option>
            ))}
        </select>
      ) : field?.type === 'boolean' ? (
        <select className="cr-chips-pick" value="" onChange={(e) => add(e.target.value)}>
          <option value="">{t('crm.columnRules.pickValues')}</option>
          {['true', 'false']
            .filter((v) => !values.includes(v))
            .map((v) => (
              <option key={v} value={v}>
                {v === 'true' ? t('crm.columnRules.yes') : t('crm.columnRules.no')}
              </option>
            ))}
        </select>
      ) : (
        <input
          className="cr-chips-pick"
          value={draft}
          placeholder={values.length ? '' : t('crm.columnRules.typeAndEnter')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
              setDraft('');
            }
          }}
          onBlur={() => {
            if (draft.trim()) {
              add(draft);
              setDraft('');
            }
          }}
        />
      )}
    </div>
  );
};

const FieldSelect: React.FC<{
  fields: CustomObjectField[];
  value: string;
  onChange: (key: string) => void;
  filter?: (f: CustomObjectField) => boolean;
}> = ({ fields, value, onChange, filter }) => {
  const { t } = useTranslation();
  const list = filter ? fields.filter(filter) : fields;
  const current = fields.find((f) => f.key === value);
  return (
    <span className="cr-field-select">
      {current && <WsFieldTypeIcon typeKey={current.type} />}
      <select className="cr-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {!current && <option value="">{t('crm.columnRules.pickColumn')}</option>}
        {list.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
    </span>
  );
};

/** «Потом …»: «заполнить значением», «очистить» или «должно быть …» одним выпадающим списком. */
type ActionMode = 'set' | 'clear' | `check:${WorkspaceRuleCheckOp}`;
const actionMode = (a: WorkspaceRuleAction): ActionMode => (a.kind === 'check' ? `check:${a.op}` : a.kind);

const CheckValue: React.FC<{
  field: CustomObjectField | undefined;
  op: WorkspaceRuleCheckOp;
  p: { value?: string; values?: string[]; min?: string; max?: string };
  onChange: (p: { value?: string; values?: string[]; min?: string; max?: string }) => void;
}> = ({ field, op, p, onChange }) => {
  const { t } = useTranslation();
  if (op === 'not_empty') return <span className="cr-input cr-input-muted">{t('crm.columnRules.noValueNeeded')}</span>;
  if (op === 'one_of') return <MultiValueInput field={field} values={p.values || []} onChange={(values) => onChange({ ...p, values })} />;
  if (op === 'between')
    return (
      <span className="cr-range">
        <ValueInput field={field} value={p.min ?? ''} onChange={(min) => onChange({ ...p, min })} placeholder={t('crm.columnRules.min')} />
        <span>—</span>
        <ValueInput field={field} value={p.max ?? ''} onChange={(max) => onChange({ ...p, max })} placeholder={t('crm.columnRules.max')} />
      </span>
    );
  return <ValueInput field={field} value={p.value ?? ''} onChange={(value) => onChange({ ...p, value })} />;
};

export const ColumnRulesDrawer: React.FC<Props> = ({ objectId, field, fields, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<WorkspaceColumnRule[]>(() => readWorkspaceFieldRules(field));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initial = useRef(JSON.stringify(readWorkspaceFieldRules(field)));
  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const usable = useMemo(() => fields.filter((f) => f.isActive !== false), [fields]);
  const firstOther = usable.find((f) => f.key !== field.key && canSetType(f.type)) ?? usable[0];

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const condLabel = (op: WorkspaceRuleConditionOp) => t(`crm.columnRules.cond.${op}`);
  const checkLabel = (op: WorkspaceRuleCheckOp) => t(`crm.columnRules.check.${op}`);

  const update = (id: string, fn: (r: WorkspaceColumnRule) => WorkspaceColumnRule) =>
    setRules((prev) => prev.map((r) => (r.id === id ? fn(r) : r)));

  const addCondition = () =>
    setRules((prev) => [
      ...prev,
      {
        id: uid(),
        type: 'condition',
        when: { fieldKey: field.key, op: conditionOpsFor(field.type)[0], values: [] },
        then: [{ fieldKey: firstOther?.key ?? field.key, kind: 'set', value: '' }],
      },
    ]);
  const addValidation = () =>
    setRules((prev) => [...prev, { id: uid(), type: 'validation', op: checkOpsFor(field.type)[0] }]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await setCustomObjectFieldRules(objectId, field.id, rules);
      onSaved(saved);
      onClose();
    } catch (e: any) {
      setError(e?.message || t('crm.columnRules.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const dirty = JSON.stringify(rules) !== initial.current;

  return createPortal(
    <div className="cr-back lv-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="cr-drawer lv-sheet-right" role="dialog" aria-label={t('crm.columnRules.title')}>
        <header className="cr-head">
          <div>
            <div className="cr-kicker">{t('crm.columnRules.kicker')}</div>
            <h3 className="cr-title">{t('crm.columnRules.titleFor', { label: field.label })}</h3>
            <p className="cr-sub">{t('crm.columnRules.subtitle')}</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t('crm.columnRules.close')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="cr-body">
          {!rules.length && (
            <div className="cr-empty">
              <b>{t('crm.columnRules.emptyTitle')}</b>
              <span>{t('crm.columnRules.emptyText')}</span>
            </div>
          )}

          {rules.map((rule, idx) => {
            if (rule.type === 'validation') {
              return (
                <section key={rule.id} className={`cr-card${rule.enabled === false ? ' off' : ''}`}>
                  <div className="cr-card-head">
                    <span className="cr-card-kicker">
                      {idx + 1} · {t('crm.columnRules.validationKicker')}
                    </span>
                    <RuleTools
                      enabled={rule.enabled !== false}
                      onToggle={() => update(rule.id, (r) => ({ ...r, enabled: r.enabled === false }))}
                      onDelete={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                    />
                  </div>
                  <div className="cr-line">
                    <span className="cr-word">{t('crm.columnRules.valueOf', { label: field.label })}</span>
                  </div>
                  <div className="cr-grid">
                    <select
                      className="cr-input"
                      value={rule.op}
                      onChange={(e) => update(rule.id, (r) => ({ ...(r as any), op: e.target.value as WorkspaceRuleCheckOp }))}
                    >
                      {checkOpsFor(field.type).map((op) => (
                        <option key={op} value={op}>
                          {checkLabel(op)}
                        </option>
                      ))}
                    </select>
                    <CheckValue
                      field={field}
                      op={rule.op}
                      p={rule}
                      onChange={(p) => update(rule.id, (r) => ({ ...(r as any), ...p }))}
                    />
                  </div>
                </section>
              );
            }
            const whenField = byKey.get(rule.when.fieldKey);
            const ops = conditionOpsFor(whenField?.type ?? 'text');
            const multi = rule.when.op === 'is' || rule.when.op === 'is_not';
            return (
              <section key={rule.id} className={`cr-card${rule.enabled === false ? ' off' : ''}`}>
                <div className="cr-card-head">
                  <span className="cr-card-kicker">
                    {idx + 1} · {t('crm.columnRules.conditionKicker')}
                  </span>
                  <RuleTools
                    enabled={rule.enabled !== false}
                    onToggle={() => update(rule.id, (r) => ({ ...r, enabled: r.enabled === false }))}
                    onDelete={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                  />
                </div>
                <div className="cr-line">
                  <span className="cr-word">{t('crm.columnRules.if')}</span>
                  <FieldSelect
                    fields={usable}
                    value={rule.when.fieldKey}
                    onChange={(fieldKey) =>
                      update(rule.id, (r) => {
                        const nf = byKey.get(fieldKey);
                        return { ...(r as any), when: { fieldKey, op: conditionOpsFor(nf?.type ?? 'text')[0], values: [] } };
                      })
                    }
                  />
                </div>
                <div className="cr-grid">
                  <select
                    className="cr-input"
                    value={rule.when.op}
                    onChange={(e) =>
                      update(rule.id, (r) => ({ ...(r as any), when: { ...(r as any).when, op: e.target.value } }))
                    }
                  >
                    {ops.map((op) => (
                      <option key={op} value={op}>
                        {condLabel(op)}
                      </option>
                    ))}
                  </select>
                  {NO_VALUE_COND.includes(rule.when.op) ? (
                    <span className="cr-input cr-input-muted">{t('crm.columnRules.noValueNeeded')}</span>
                  ) : multi ? (
                    <MultiValueInput
                      field={whenField}
                      values={rule.when.values || (rule.when.value ? [rule.when.value] : [])}
                      onChange={(values) =>
                        update(rule.id, (r) => ({ ...(r as any), when: { ...(r as any).when, values, value: undefined } }))
                      }
                    />
                  ) : (
                    <ValueInput
                      field={whenField}
                      value={rule.when.value ?? ''}
                      onChange={(value) =>
                        update(rule.id, (r) => ({ ...(r as any), when: { ...(r as any).when, value, values: undefined } }))
                      }
                    />
                  )}
                </div>

                {rule.then.map((a, ai) => {
                  const target = byKey.get(a.fieldKey);
                  const checks = checkOpsFor(target?.type ?? 'text');
                  const mode = actionMode(a);
                  const setAction = (na: WorkspaceRuleAction) =>
                    update(rule.id, (r) => ({
                      ...(r as any),
                      then: (r as any).then.map((x: WorkspaceRuleAction, i: number) => (i === ai ? na : x)),
                    }));
                  return (
                    <div key={ai} className="cr-then">
                      <span className="cr-word">{ai === 0 ? t('crm.columnRules.then') : t('crm.columnRules.and')}</span>
                      <FieldSelect
                        fields={usable}
                        value={a.fieldKey}
                        onChange={(fieldKey) => setAction({ fieldKey, kind: 'set', value: '' })}
                      />
                      <select
                        className="cr-input"
                        value={mode}
                        onChange={(e) => {
                          const m = e.target.value as ActionMode;
                          if (m === 'set') setAction({ fieldKey: a.fieldKey, kind: 'set', value: '' });
                          else if (m === 'clear') setAction({ fieldKey: a.fieldKey, kind: 'clear' });
                          else setAction({ fieldKey: a.fieldKey, kind: 'check', op: m.slice(6) as WorkspaceRuleCheckOp });
                        }}
                      >
                        {target && canSetType(target.type) && (
                          <optgroup label={t('crm.columnRules.groupFill')}>
                            <option value="set">{t('crm.columnRules.actionSet')}</option>
                            <option value="clear">{t('crm.columnRules.actionClear')}</option>
                          </optgroup>
                        )}
                        <optgroup label={t('crm.columnRules.groupMustBe')}>
                          {checks.map((op) => (
                            <option key={op} value={`check:${op}`}>
                              {checkLabel(op)}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      {a.kind === 'set' ? (
                        target?.type === 'multiselect' ? (
                          <MultiValueInput
                            field={target}
                            values={Array.isArray(a.value) ? (a.value as string[]) : a.value ? [String(a.value)] : []}
                            onChange={(value) => setAction({ ...a, value })}
                          />
                        ) : (
                          <ValueInput field={target} value={String(a.value ?? '')} onChange={(value) => setAction({ ...a, value })} />
                        )
                      ) : a.kind === 'clear' ? (
                        <span className="cr-input cr-input-muted">{t('crm.columnRules.noValueNeeded')}</span>
                      ) : (
                        <CheckValue field={target} op={a.op} p={a} onChange={(p) => setAction({ ...a, ...p })} />
                      )}
                      <button
                        type="button"
                        className="btn-icon"
                        aria-label={t('crm.columnRules.remove')}
                        disabled={rule.then.length <= 1}
                        onClick={() =>
                          update(rule.id, (r) => ({
                            ...(r as any),
                            then: (r as any).then.filter((_: unknown, i: number) => i !== ai),
                          }))
                        }
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="cr-add-action"
                  onClick={() =>
                    update(rule.id, (r) => ({
                      ...(r as any),
                      then: [...(r as any).then, { fieldKey: firstOther?.key ?? field.key, kind: 'set', value: '' }],
                    }))
                  }
                >
                  + {t('crm.columnRules.addAction')}
                </button>
              </section>
            );
          })}

          <div className="cr-add-row">
            <button type="button" className="btn-secondary" onClick={addCondition}>
              + {t('crm.columnRules.addCondition')}
            </button>
            <button type="button" className="btn-secondary" onClick={addValidation}>
              + {t('crm.columnRules.addValidation')}
            </button>
          </div>
          <div className="cr-help">
            <p>{t('crm.columnRules.helpFill')}</p>
            <p>{t('crm.columnRules.helpCheck')}</p>
          </div>
        </div>

        <footer className="cr-foot">
          {error && <span className="cr-error">{error}</span>}
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t('crm.columnRules.cancel')}
          </button>
          <button type="button" className="btn-primary" disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? t('crm.columnRules.saving') : t('crm.columnRules.save')}
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
};

const RuleTools: React.FC<{ enabled: boolean; onToggle: () => void; onDelete: () => void }> = ({ enabled, onToggle, onDelete }) => {
  const { t } = useTranslation();
  return (
    <span className="cr-tools">
      <label className="cr-switch" title={enabled ? t('crm.columnRules.enabled') : t('crm.columnRules.disabled')}>
        <input type="checkbox" className="lv-native" checked={enabled} onChange={onToggle} />
        <i />
      </label>
      <button type="button" className="btn-icon-danger btn-icon" onClick={onDelete} aria-label={t('crm.columnRules.deleteRule')}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
        </svg>
      </button>
    </span>
  );
};
