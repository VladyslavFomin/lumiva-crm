/**
 * Настройки → «Структура CRM»: из чего состоят карточки лида, проекта и сделки, есть ли у проектов
 * бюджет (без бюджета аналитика проектов строится по задачам) и этапы воронки сделок.
 * Сохраняется сразу по переключателю (tenants.crmLayout, владелец компании).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  DEAL_BLOCKS,
  DEFAULT_CRM_LAYOUT,
  fetchCrmLayout,
  LEAD_BLOCKS,
  PROJECT_BLOCKS,
  saveCrmLayout,
  type CrmLayout,
} from '../../api/crmLayout';
import { setCrmLayoutCache } from '../../hooks/useCrmLayout';
import { useTenantComponents } from '../../hooks/useTenantComponents';
import { blockAvailable, entityAvailable } from '../../hooks/crmBlockAvailability';
import {
  createProjectStatus,
  deleteProjectStatus,
  fetchProjectStatuses,
  reorderProjectStatuses,
  updateProjectStatus,
  type ProjectStatusDefinition,
} from '../../api/project-statuses';
import './crm-structure.css';

type Entity = 'lead' | 'project' | 'deal';

const P = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  coin: 'M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6',
  building: 'M4 21V5l8-2v18M12 9h8v12M8 8h.01M8 12h.01M8 16h.01M16 13h.01M16 17h.01',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7.5M22 20a7 7 0 0 0-4-6.3',
  folder: 'M3 6h6l2 2h10v11H3z',
  handshake: 'M3 12l4-4 5 3 5-3 4 4-9 7z',
  cart: 'M3 4h2l2.4 11h11L21 8H7M10 20h.01M17 20h.01',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
  tag: 'M3 12V4h8l10 10-8 8z M7 8h.01',
  note: 'M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h6',
  chat: 'M4 5h16v11H8l-4 4z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  comment: 'M21 12a8 8 0 0 1-12 7L4 20l1.5-4A8 8 0 1 1 21 12Z',
  clock: 'M12 7v5l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  check: 'M4 12l5 5L20 6',
  meet: 'M4 7h11v10H4zM15 10l5-3v10l-5-3',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  file: 'M6 3h9l4 4v14H6zM14 3v5h5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  bars: 'M5 20V10M12 20V4M19 20v-7',
  utm: 'M4 4h16v16H4zM9 9h6v6H9z',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  plus: 'M12 5v14M5 12h14',
};
const Ic: React.FC<{ d: string; s?: number }> = ({ d, s = 15 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const BLOCK_ICON: Record<string, string> = {
  contact: P.user, amount: P.coin, company: P.building, contacts: P.users, projects: P.folder, deals: P.handshake,
  sales: P.cart, bookings: P.calendar, customFields: P.sliders, utm: P.utm, notes: P.note, chat: P.chat, calls: P.phone,
  comments: P.comment, history: P.clock, ai: P.spark, tasks: P.check, meetings: P.meet, budget: P.coin, progress: P.bars,
  links: P.link, tags: P.tag, files: P.file, watchers: P.eye,
};

/** Группы блоков по сущностям (порядок — как в карточке). */
const GROUPS: Record<Entity, Array<{ key: string; blocks: string[] }>> = {
  lead: [
    { key: 'main', blocks: ['contact', 'amount', 'customFields', 'utm', 'notes'] },
    { key: 'links', blocks: ['company', 'contacts', 'projects', 'deals', 'sales', 'bookings'] },
    { key: 'comms', blocks: ['chat', 'calls', 'comments', 'history'] },
    { key: 'work', blocks: ['ai', 'tasks', 'meetings'] },
  ],
  project: [
    { key: 'main', blocks: ['progress', 'tags', 'customFields', 'notes'] },
    { key: 'links', blocks: ['links', 'watchers'] },
    { key: 'work', blocks: ['tasks', 'files', 'comments', 'history'] },
  ],
  deal: [
    { key: 'main', blocks: ['progress', 'tags', 'customFields', 'notes'] },
    { key: 'links', blocks: ['links', 'watchers'] },
    { key: 'work', blocks: ['tasks', 'files', 'comments', 'history'] },
  ],
};

export const CrmStructureTab: React.FC<{ isOwner: boolean }> = ({ isOwner }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.settings.structure.${key}`, o) as string;
  const { showAlert } = useAlertModal();
  const { isEnabled, loaded: compLoaded } = useTenantComponents();
  const [layout, setLayout] = useState<CrmLayout>(DEFAULT_CRM_LAYOUT);
  const [loaded, setLoaded] = useState(false);
  const [entity, setEntity] = useState<Entity>('lead');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetchCrmLayout()
      .then((l) => setLayout(l))
      .catch((e) => showAlert(e?.message || k('loadError'), { variant: 'error' }))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // показываем только то, что включено у компании в pl1: модуль выключен — нет ни вкладки, ни тумблера
  const avail = (e: Entity, b: string) => blockAvailable(e, b, isEnabled);
  const keysOf = (e: Entity): string[] =>
    [...(e === 'lead' ? LEAD_BLOCKS : e === 'project' ? PROJECT_BLOCKS : DEAL_BLOCKS)].filter((b) => avail(e, b));
  const countOn = (e: Entity) => keysOf(e).filter((b) => (layout[e] as Record<string, boolean>)[b] !== false).length;

  const toggle = async (e: Entity, block: string, on: boolean) => {
    if (!isOwner) return;
    const prev = layout;
    const next = { ...layout, [e]: { ...(layout[e] as Record<string, boolean>), [block]: on } } as CrmLayout;
    setLayout(next);
    try {
      const saved = await saveCrmLayout({ [e]: { [block]: on } } as any);
      setLayout(saved);
      setCrmLayoutCache(saved);
      setSavedAt(Date.now());
    } catch (err: any) {
      setLayout(prev);
      showAlert(err?.message || k('saveError'), { variant: 'error' });
    }
  };

  const entities = (
    [
      { id: 'lead', icon: P.user },
      { id: 'project', icon: P.folder },
      { id: 'deal', icon: P.handshake },
    ] as Array<{ id: Entity; icon: string }>
  ).filter((x) => entityAvailable(x.id, isEnabled));

  // выбранную сущность выключили в pl1 — переключаемся на первую доступную
  useEffect(() => {
    if (!compLoaded || !entities.length) return;
    if (!entities.some((x) => x.id === entity)) setEntity(entities[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compLoaded, entities.map((x) => x.id).join(',')]);

  if (!compLoaded || !loaded) return <div className="cs-loading">…</div>;
  if (!entities.length) return <div className="cs-note">{k('noEntities')}</div>;

  const cur = layout[entity] as Record<string, boolean>;
  const budgetOn = layout.project.budget !== false;

  return (
    <div className="cs-wrap">
      <aside className="cs-nav">
        {entities.map((x) => (
          <button key={x.id} type="button" className={`cs-ent${entity === x.id ? ' on' : ''}`} onClick={() => setEntity(x.id)}>
            <span className="cs-ent-ic">
              <Ic d={x.icon} s={17} />
            </span>
            <span className="cs-ent-tx">
              <b>{k(`entity.${x.id}`)}</b>
              <small>{loaded ? k('blocksOn', { on: countOn(x.id), total: keysOf(x.id).length }) : '…'}</small>
            </span>
          </button>
        ))}
        <p className="cs-nav-hint">{k('navHint')}</p>
        {savedAt ? <div className="cs-saved" key={savedAt}><Ic d={P.check} s={13} /> {k('saved')}</div> : null}
      </aside>

      <section className="cs-main">
        <div className="cs-main-hd">
          <div>
            <div className="cs-kicker">{k('kicker')}</div>
            <h2>{k(`title.${entity}`)}</h2>
            <p>{k(`sub.${entity}`)}</p>
          </div>
        </div>

        {entity === 'project' ? (
          <div className={`cs-budget${budgetOn ? ' on' : ''}`}>
            <span className="cs-budget-ic">
              <Ic d={P.coin} s={18} />
            </span>
            <div className="cs-budget-tx">
              <b>{k('budget.title')}</b>
              <span>{budgetOn ? k('budget.on') : k('budget.off')}</span>
            </div>
            <Switch on={budgetOn} disabled={!isOwner} onChange={(v) => void toggle('project', 'budget', v)} label={k('budget.title')} />
          </div>
        ) : null}

        <div className="cs-cols">
          <div className="cs-groups">
            {GROUPS[entity]
              .map((g) => ({ ...g, blocks: g.blocks.filter((b) => avail(entity, b)) }))
              .filter((g) => g.blocks.length > 0)
              .map((g) => (
              <div key={g.key} className="cs-group">
                <div className="cs-group-hd">{k(`group.${g.key}`)}</div>
                {g.blocks.map((b) => {
                  const on = cur[b] !== false;
                  return (
                    <div key={b} className={`cs-row${on ? '' : ' off'}`}>
                      <span className="cs-row-ic">
                        <Ic d={BLOCK_ICON[b] || P.note} />
                      </span>
                      <span className="cs-row-tx">
                        <b>{k(`block.${entity}.${b}`)}</b>
                        <small>{k(`blockHint.${entity}.${b}`)}</small>
                      </span>
                      <Switch on={on} disabled={!isOwner} onChange={(v) => void toggle(entity, b, v)} label={k(`block.${entity}.${b}`)} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <CardPreview entity={entity} layout={layout} k={k} avail={avail} />
        </div>

        {entity === 'deal' ? <DealStages isOwner={isOwner} k={k} /> : null}
      </section>
    </div>
  );
};

const Switch: React.FC<{ on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }> = ({ on, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    className={`cs-switch${on ? ' on' : ''}`}
    onClick={() => onChange(!on)}
  >
    <i />
  </button>
);

/** Схема карточки: что увидит команда (выключенное просто исчезает). */
const CardPreview: React.FC<{
  entity: Entity;
  layout: CrmLayout;
  k: (key: string, o?: Record<string, unknown>) => string;
  avail: (e: Entity, b: string) => boolean;
}> = ({ entity, layout, k, avail }) => {
  const on = (b: string) => (layout[entity] as Record<string, boolean>)[b] !== false && avail(entity, b);
  const leadLinks = ['company', 'contacts', 'projects', 'deals', 'sales', 'bookings'].filter(on);
  const Chip = ({ b }: { b: string }) => (
    <span className="cs-pv-chip">
      <Ic d={BLOCK_ICON[b] || P.note} s={11} />
      {k(`block.${entity}.${b}`)}
    </span>
  );
  return (
    <div className="cs-pv" aria-hidden>
      <div className="cs-pv-kicker">{k('preview')}</div>
      <div className="cs-pv-card">
        <div className="cs-pv-head">
          <span className="cs-pv-av" />
          <span className="cs-pv-lines">
            <i style={{ width: '62%' }} />
            <i style={{ width: '38%' }} />
          </span>
          <span className="cs-pv-status" />
        </div>
        {entity === 'lead' ? (
          <div className="cs-pv-grid">
            <div className="cs-pv-col">
              {['contact', 'amount'].filter(on).map((b) => <Chip key={b} b={b} />)}
              {leadLinks.length ? (
                <div className="cs-pv-box">
                  {leadLinks.map((b) => (
                    <Chip key={b} b={b} />
                  ))}
                </div>
              ) : null}
              {['customFields', 'utm', 'notes'].filter(on).map((b) => <Chip key={b} b={b} />)}
            </div>
            <div className="cs-pv-col wide">
              <div className="cs-pv-tabs">
                {['chat', 'calls', 'comments', 'history'].filter(on).map((b) => (
                  <span key={b}>{k(`block.lead.${b}`)}</span>
                ))}
              </div>
              <div className="cs-pv-area" />
            </div>
            <div className="cs-pv-col">
              {['ai', 'tasks', 'meetings'].filter(on).map((b) => <Chip key={b} b={b} />)}
            </div>
          </div>
        ) : (
          <>
            <div className="cs-pv-strip">
              {entity === 'deal' || layout.project.budget !== false ? (
                <span className="cs-pv-metric strong">
                  <small>{k(entity === 'deal' ? 'pv.amount' : 'pv.budget')}</small>
                  <i className="cs-pv-sk" />
                </span>
              ) : null}
              {on('progress') ? (
                <span className="cs-pv-metric">
                  <small>{k('pv.progress')}</small>
                  <i className="cs-pv-sk" />
                </span>
              ) : null}
              {entity === 'deal' ? (
                <span className="cs-pv-metric">
                  <small>{k('pv.stage')}</small>
                  <i className="cs-pv-sk" />
                </span>
              ) : null}
            </div>
            <div className="cs-pv-tabs">
              <span>{k('pv.props')}</span>
              {['tasks', 'comments', 'history'].filter(on).map((b) => (
                <span key={b}>{k(`block.${entity}.${b}`)}</span>
              ))}
            </div>
            <div className="cs-pv-box">
              {['links', 'tags', 'customFields', 'notes', 'files', 'watchers'].filter(on).map((b) => (
                <Chip key={b} b={b} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/** Этапы воронки сделок: название, цвет, смысл (выигрыш/проигрыш), порядок. */
const DealStages: React.FC<{ isOwner: boolean; k: (key: string, o?: Record<string, unknown>) => string }> = ({ isOwner, k }) => {
  const { showAlert } = useAlertModal();
  const [rows, setRows] = useState<ProjectStatusDefinition[]>([]);
  const [newName, setNewName] = useState('');
  const load = () =>
    fetchProjectStatuses('deal')
      .then((r) => setRows([...r].sort((a, b) => a.order - b.order)))
      .catch((e) => showAlert(e?.message || k('loadError'), { variant: 'error' }));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e: any) {
      showAlert(e?.message || k('saveError'), { variant: 'error' });
    }
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const ids = rows.map((r) => r.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void run(() => reorderProjectStatuses(ids, 'deal'));
  };
  return (
    <div className="cs-stages">
      <div className="cs-group-hd">{k('stages.title')}</div>
      <p className="cs-stages-hint">{k('stages.hint')}</p>
      <div className="cs-funnel">
        {rows.map((r, i) => (
          <div key={r.id} className="cs-stage">
            <span className="cs-stage-n">{String(i + 1).padStart(2, '0')}</span>
            <input
              type="color"
              className="cs-color"
              value={r.color}
              disabled={!isOwner}
              onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, color: e.target.value } : x)))}
              onBlur={(e) => void run(() => updateProjectStatus(r.id, { color: e.target.value }))}
              aria-label={k('stages.color')}
            />
            <input
              className="cs-stage-name"
              defaultValue={r.value}
              disabled={!isOwner}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== r.value) void run(() => updateProjectStatus(r.id, { value: v }));
              }}
            />
            <select
              className="cs-stage-out"
              value={r.outcome || ''}
              disabled={!isOwner || r.isBuiltIn}
              title={r.isBuiltIn ? k('stages.builtIn') : undefined}
              onChange={(e) => void run(() => updateProjectStatus(r.id, { outcome: e.target.value as any }))}
            >
              <option value="">{k('stages.open')}</option>
              <option value="won">{k('stages.won')}</option>
              <option value="lost">{k('stages.lost')}</option>
            </select>
            <span className="cs-stage-tools">
              <button type="button" className="btn-icon" disabled={!isOwner || i === 0} onClick={() => move(i, -1)} aria-label={k('stages.up')}>
                <Ic d={P.up} s={13} />
              </button>
              <button type="button" className="btn-icon" disabled={!isOwner || i === rows.length - 1} onClick={() => move(i, 1)} aria-label={k('stages.down')}>
                <Ic d={P.down} s={13} />
              </button>
              <button
                type="button"
                className="btn-icon btn-icon-danger"
                disabled={!isOwner || r.isBuiltIn}
                title={r.isBuiltIn ? k('stages.builtIn') : undefined}
                onClick={() => void run(() => deleteProjectStatus(r.id))}
                aria-label={k('stages.delete')}
              >
                <Ic d={P.trash} s={13} />
              </button>
            </span>
          </div>
        ))}
      </div>
      {isOwner ? (
        <form
          className="cs-stage-add"
          onSubmit={(e) => {
            e.preventDefault();
            const v = newName.trim();
            if (!v) return;
            void run(() => createProjectStatus({ value: v, color: '#777777' }, 'deal')).then(() => setNewName(''));
          }}
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={k('stages.newPlaceholder')} />
          <button type="submit" className="btn-secondary">
            <Ic d={P.plus} s={13} /> {k('stages.add')}
          </button>
        </form>
      ) : null}
    </div>
  );
};
