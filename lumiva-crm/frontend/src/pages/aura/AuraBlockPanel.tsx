import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuraBlockLayout, AuraCustomWidget, AuraPeriod, AuraSourceKey, AuraWidgetResult } from '../../api/aura';
import { AU_PERIODS, AU_SOURCES, AU_SPANS, AU_SWATCHES, AU_VIEWS, AU_WIDGET, AU_WIDGET_NEEDS, AU_WIDGETS, auDefaultSpan, auIsDeco, type AuWidgetType } from './auraModel';
import { AU_I, AuIc } from './auraShared';
import { AuraCustomBuilder } from './AuraCustomBuilder';
import { AU_SOURCE_COMPONENT, UnlockButton, type AuAccess } from './AuraUnlock';

/* Редактор блоков Aura: настройки одного блока (вид / данные) и каталог для добавления.
   Живёт снаружи масштабированного превью — поэтому текст и кнопки нормального размера. */

/** Схематичная иконка вида — чтобы каталог и «Показать как» читались без слов. */
export function TypeGlyph({ type }: { type: string }) {
  const p: Record<string, React.ReactNode> = {
    kpi: <path d="M4 16h3l3-5 3 3 4-7 3 4" />,
    kpi_line: <path d="M4 17c3 0 4-6 7-6s4 4 9-3" />,
    kpi_ticks: <path d="M5 18v-4M8 18v-7M11 18v-3M14 18v-9M17 18v-5M20 18v-11" />,
    kpi_bare: <path d="M6 8h4v10M14 8h4l-4 10" />,
    kpi_ring: <circle cx="12" cy="12" r="7" strokeDasharray="30 14" />,
    line: <path d="M3 17l5-6 4 3 5-7 4 4" />,
    area: <path d="M3 18l5-6 4 3 5-7 4 4v6z" fill="currentColor" fillOpacity=".25" />,
    columns: <path d="M6 19V11M10 19V6M14 19v-9M18 19v-5" />,
    stacked: <path d="M5 19v-6M5 13v-4M10 19v-8M10 11V6M15 19v-5M15 14v-4M19 19v-9" />,
    multi: (
      <>
        <path d="M3 16l5-5 4 3 5-6 4 3" />
        <path d="M3 19l6-3 4 1 5-4 3 1" opacity=".5" />
      </>
    ),
    donut: <circle cx="12" cy="12" r="7" strokeDasharray="30 14" />,
    pie: <path d="M12 4a8 8 0 1 0 8 8h-8z M14 3v7h7a7 7 0 0 0-7-7z" />,
    funnel: <path d="M4 5h16l-6 7v6l-4 2v-8z" />,
    table: <path d="M4 6h16M4 12h16M4 18h16M10 6v12" />,
    bar: <path d="M4 7h12M4 12h16M4 17h8" />,
    col: <path d="M6 19V11M10 19V6M14 19v-9M18 19v-5" />,
    col2: <path d="M5 19v-8M8 19v-4M13 19V7M16 19v-5" />,
    heat: <path d="M4 5h4v4H4zM10 5h4v4h-4zM16 5h4v4h-4zM4 11h4v4H4zM10 11h4v4h-4zM16 11h4v4h-4z" />,
    cal: <path d="M4 5h3v3H4zM9 5h3v3H9zM14 5h3v3h-3zM4 10h3v3H4zM9 10h3v3H9zM14 10h3v3h-3zM4 15h3v3H4zM9 15h3v3H9z" />,
    list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
    stream: <path d="M4 6h16M4 12h10M4 18h13" />,
    goal: <circle cx="12" cy="12" r="7" strokeDasharray="34 10" />,
    gauge: <path d="M4 17a8 8 0 0 1 16 0M12 17l4-5" />,
    segbar: <path d="M3 12h6M11 12h5M18 12h3" strokeWidth="4" />,
    forecast: <path d="M3 18l6-5 4 2 3-3M16 12l5-5" />,
    hero: <path d="M4 8h10M4 12h7M15 14h5v4h-5z" />,
    check: <path d="M4 7l2 2 3-3M4 14l2 2 3-3M12 8h8M12 15h8" />,
    status: <path d="M5 7h.01M5 12h.01M5 17h.01M9 7h10M9 12h10M9 17h10" />,
    split: <path d="M3 12h9M14 12h7M13 8v8" />,
    note: <path d="M5 4h10l4 4v12H5zM8 11h8M8 15h6" />,
    section: <path d="M4 8h16M4 13h10M4 17h6" strokeWidth="2.4" />,
    custom: <path d="M4 7h7M4 12h11M4 17h5M17 15v6M14 18h6" />,
  };
  return (
    <svg className="au-glyph" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p[type] || p.kpi}
    </svg>
  );
}

const lockedOf = (acc: AuAccess, key: string): string[] => {
  const m = AU_WIDGET.get(key);
  if (!m) return [];
  const srcs = [...(m.source !== 'extra' ? [m.source as AuraSourceKey] : []), ...(AU_WIDGET_NEEDS[key] || [])];
  return [...new Set(srcs.filter((s) => acc.lockedSources.has(s)).map((s) => AU_SOURCE_COMPONENT[s]))];
};

/* ---------- каталог блоков ---------- */

function Catalog({
  current,
  used,
  sources,
  onPick,
  autoFocus,
  access,
  extras,
}: {
  current?: string;
  used: string[];
  sources: AuraSourceKey[];
  onPick: (key: string) => void;
  autoFocus?: boolean;
  access: AuAccess;
  extras?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [src, setSrc] = useState<AuraSourceKey | 'extra' | 'rec' | 'all'>('rec');
  const name = (k: string) => t(`crm.aura.w.${k}`);
  // «Рекомендуем» — доступное, чего ещё нет, из разделов, которые уже есть на дашборде
  const rec = useMemo(
    () => AU_WIDGETS.filter((w) => !used.includes(w.key) && !lockedOf(access, w.key).length && (w.source === 'extra' || sources.includes(w.source as AuraSourceKey))).slice(0, 10),
    [used, sources, access],
  );
  const ql = q.trim().toLowerCase();
  const list = ql
    ? AU_WIDGETS.filter((w) => (name(w.key) + ' ' + (w.source === 'extra' ? 'aura' : t(`crm.aura.src.${w.source}.name`))).toLowerCase().includes(ql))
    : src === 'rec'
      ? rec
      : src === 'all'
        ? AU_WIDGETS
        : AU_WIDGETS.filter((w) => w.source === src);
  return (
    <div className="au-cat">
      <div className="au-cat-search">
        <AuIc d={AU_I.search} size={14} />
        <input value={q} autoFocus={autoFocus} onChange={(e) => setQ(e.target.value)} placeholder={t('crm.aura.block.search')} />
      </div>
      {!ql && (
        <div className="au-cat-chips">
          {(['rec', 'all', ...AU_SOURCES, 'extra'] as const).map((k) => (
            <button type="button" key={k} className={(src === k ? 'on' : '') + (k !== 'rec' && k !== 'all' && k !== 'extra' && access.lockedSources.has(k) ? ' locked' : '')} onClick={() => setSrc(k)}>
              {k === 'rec' ? t('crm.aura.block.rec') : k === 'all' ? t('crm.aura.tplCat.all') : k === 'extra' ? t('crm.aura.block.extra') : t(`crm.aura.src.${k}.name`)}
            </button>
          ))}
        </div>
      )}
      <div className="au-cat-list">
        {!ql && src === 'rec' && extras}
        {list.map((w) => {
          const isCur = w.key === current;
          const taken = !isCur && used.includes(w.key);
          const locked = lockedOf(access, w.key);
          if (locked.length)
            return (
              <div key={w.key} className="au-cat-i locked">
                <TypeGlyph type={w.type} />
                <span>
                  <b>{name(w.key)}</b>
                  <em>{t('crm.aura.unlock.needs', { list: locked.map((c) => t(`crm.aura.comp.${c}`)).join(', ') })}</em>
                </span>
                <UnlockButton components={locked} compact />
              </div>
            );
          return (
            <button type="button" key={w.key} className={'au-cat-i' + (isCur ? ' cur' : '')} disabled={taken || isCur} onClick={() => onPick(w.key)}>
              <TypeGlyph type={w.type} />
              <span>
                <b>{name(w.key)}</b>
                <em>
                  {w.source === 'extra' ? t('crm.aura.block.extra') : t(`crm.aura.src.${w.source}.name`)} · {t(`crm.aura.type.${w.type}`)}
                </em>
              </span>
              {isCur ? <i className="au-cat-tag">{t('crm.aura.block.current')}</i> : taken ? <i className="au-cat-tag">{t('crm.aura.block.taken')}</i> : <AuIc d={AU_I.plus} size={14} />}
            </button>
          );
        })}
        {!list.length && <div className="au-cat-empty">{t('crm.aura.block.nothing')}</div>}
      </div>
    </div>
  );
}

/* ---------- панель ---------- */

export type BlockPanelProps = {
  mode: 'block' | 'add' | 'custom';
  blockKey: string | null;
  widgets: string[];
  sources: AuraSourceKey[];
  layout: Record<string, AuraBlockLayout>;
  custom: AuraCustomWidget[];
  res?: AuraWidgetResult;
  access: AuAccess;
  dashPeriod: AuraPeriod;
  onClose: () => void;
  onLayout: (key: string, patch: Partial<AuraBlockLayout> | null) => void;
  onReplace: (key: string, next: string) => void;
  onAdd: (key: string) => void;
  onAddDeco: (kind: 'note' | 'section') => void;
  onCustom: () => void;
  onSaveCustom: (c: AuraCustomWidget) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, dir: -1 | 1) => void;
};

function Head({ glyph, title, sub, onClose }: { glyph?: string; title: string; sub?: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="au-bpanel-h">
      <div className="au-bpanel-ht">
        {glyph && <TypeGlyph type={glyph} />}
        <div>
          <b>{title}</b>
          {sub && <span>{sub}</span>}
        </div>
      </div>
      <button type="button" className="app-topbar-btn" onClick={onClose} aria-label={t('crm.aura.close')}>
        <AuIc d={AU_I.x} size={15} />
      </button>
    </div>
  );
}

export function AuraBlockPanel(p: BlockPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'look' | 'data'>('look');
  useEffect(() => {
    // Escape закрывает только верхнее окно: если открыто «Разблокировать» — сначала его
    const h = (e: KeyboardEvent) => e.key === 'Escape' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA' && !document.querySelector('.au-unlock') && p.onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [p]);
  useEffect(() => setTab('look'), [p.blockKey]);

  if (p.mode === 'custom') {
    return (
      <aside className="au-bpanel lv-sheet-right" aria-label={t('crm.aura.cb.title')}>
        <Head glyph="custom" title={t('crm.aura.cb.title')} sub={t('crm.aura.cb.sub')} onClose={p.onClose} />
        <div className="au-bpanel-b">
          <AuraCustomBuilder onSave={p.onSaveCustom} onCancel={p.onClose} />
        </div>
      </aside>
    );
  }

  if (p.mode === 'add' || !p.blockKey) {
    const extras = (
      <div className="au-cat-extra">
        <button type="button" className="au-cat-i au-cat-hl" onClick={p.onCustom}>
          <TypeGlyph type="custom" />
          <span>
            <b>{t('crm.aura.cb.title')}</b>
            <em>{t('crm.aura.cb.teaser')}</em>
          </span>
          <AuIc d={AU_I.plus} size={14} />
        </button>
        <button type="button" className="au-cat-i" onClick={() => p.onAddDeco('section')}>
          <TypeGlyph type="section" />
          <span>
            <b>{t('crm.aura.note.section')}</b>
            <em>{t('crm.aura.note.sectionSub')}</em>
          </span>
          <AuIc d={AU_I.plus} size={14} />
        </button>
        <button type="button" className="au-cat-i" onClick={() => p.onAddDeco('note')}>
          <TypeGlyph type="note" />
          <span>
            <b>{t('crm.aura.note.note')}</b>
            <em>{t('crm.aura.note.noteSub')}</em>
          </span>
          <AuIc d={AU_I.plus} size={14} />
        </button>
        <div className="au-cat-sep">{t('crm.aura.block.metrics')}</div>
      </div>
    );
    return (
      <aside className="au-bpanel lv-sheet-right" aria-label={t('crm.aura.block.addTitle')}>
        <Head title={t('crm.aura.block.addTitle')} sub={t('crm.aura.block.addSub')} onClose={p.onClose} />
        <Catalog used={p.widgets} sources={p.sources} onPick={p.onAdd} autoFocus access={p.access} extras={extras} />
      </aside>
    );
  }

  const key = p.blockKey;
  const meta = AU_WIDGET.get(key);
  const custom = p.custom.find((c) => c.id === key);
  const deco = auIsDeco(key);
  const type = (deco ? (key.startsWith('n_') ? 'note' : 'section') : meta?.type || (custom?.viz as AuWidgetType) || 'kpi') as AuWidgetType;
  const b = p.layout[key] || {};
  const defTitle = deco ? t(`crm.aura.note.${type === 'note' ? 'note' : 'section'}`) : custom ? custom.title : t(`crm.aura.w.${key}`);
  const idx = p.widgets.indexOf(key);
  const r = p.res && !('error' in p.res) ? p.res : null;
  // «Показать как»: кольцо прогресса для KPI — только если есть проценты или задана цель
  const views = (AU_VIEWS[type] || []).filter((v) => v !== 'kpi_ring' || (r && r.type === 'kpi' && (r.format === 'pct' || !!b.target)));
  const curView = b.viz && views.includes(b.viz) ? b.viz : views[0];
  const listy = ['donut', 'pie', 'bar', 'segbar', 'table', 'columns', 'funnel', 'stream'].includes(curView || type) && type !== 'line' && type !== 'multi' && type !== 'col2';
  const isKpi = type === 'kpi' || (type === 'line' && curView === 'kpi');
  const hasPrev = ['kpi', 'line'].includes(type);
  const periodic = !deco && meta?.source !== 'extra' ? true : ['activity', 'stream', 'alerts', 'compare'].includes(key);

  const look = (
    <div className="au-bpanel-b">
      {deco ? (
        <label className="au-bfield">
          <span>{type === 'note' ? t('crm.aura.note.text') : t('crm.aura.note.heading')}</span>
          <textarea
            className="au-btext"
            rows={type === 'note' ? 7 : 3}
            autoFocus={!b.text}
            maxLength={2000}
            value={b.text || ''}
            placeholder={type === 'note' ? t('crm.aura.note.notePh') : t('crm.aura.note.sectionPh')}
            onChange={(e) => p.onLayout(key, { text: e.target.value || undefined })}
          />
          <em className="au-bhint">{type === 'note' ? t('crm.aura.note.markup') : t('crm.aura.note.sectionHint')}</em>
        </label>
      ) : (
        <label className="au-bfield">
          <span>{t('crm.aura.block.title')}</span>
          <div className="au-binput">
            <input value={b.title || ''} placeholder={defTitle} maxLength={80} onChange={(e) => p.onLayout(key, { title: e.target.value || undefined })} />
            {b.title && (
              <button type="button" onClick={() => p.onLayout(key, { title: undefined })} title={t('crm.aura.block.reset')}>
                <AuIc d={AU_I.x} size={12} />
              </button>
            )}
          </div>
        </label>
      )}

      {views.length > 1 && (
        <div className="au-bfield">
          <span>{t('crm.aura.block.showAs')}</span>
          <div className="au-views">
            {views.map((v, i) => (
              <button type="button" key={v} className={curView === v ? 'on' : ''} onClick={() => p.onLayout(key, { viz: i === 0 ? undefined : v })}>
                <TypeGlyph type={v} />
                {t(`crm.aura.viz.${v}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {!deco && periodic && (
        <div className="au-bfield">
          <span>{t('crm.aura.block.period')}</span>
          <div className="au-bseg au-bseg-wrap">
            <button type="button" className={!b.period ? 'on' : ''} onClick={() => p.onLayout(key, { period: undefined })}>
              {t('crm.aura.block.periodDash')}
            </button>
            {AU_PERIODS.map((pr) => (
              <button type="button" key={pr} className={b.period === pr ? 'on' : ''} onClick={() => p.onLayout(key, { period: pr === p.dashPeriod ? undefined : pr })}>
                {t(`crm.aura.period.${pr}`)}
              </button>
            ))}
          </div>
          <em className="au-bhint">{b.period ? t('crm.aura.block.periodOwn') : t('crm.aura.block.periodHint')}</em>
        </div>
      )}

      {isKpi && (
        <label className="au-bfield">
          <span>{t('crm.aura.block.target')}</span>
          <div className="au-binput">
            <input
              type="number"
              min={0}
              step="any"
              value={b.target ?? ''}
              placeholder={t('crm.aura.block.targetPh')}
              onChange={(e) => {
                const n = Number(e.target.value);
                p.onLayout(key, { target: e.target.value === '' || !(n > 0) ? undefined : n });
              }}
            />
          </div>
          <em className="au-bhint">{t('crm.aura.block.targetHint')}</em>
        </label>
      )}

      {listy && (
        <div className="au-bfield">
          <span>{t('crm.aura.block.rows')}</span>
          <div className="au-bseg">
            {[undefined, 3, 5, 8, 10].map((n) => (
              <button type="button" key={n ?? 0} className={b.limit === n ? 'on' : ''} onClick={() => p.onLayout(key, { limit: n })}>
                {n ? t('crm.aura.block.top', { n }) : t('crm.aura.block.all')}
              </button>
            ))}
          </div>
          {curView !== 'table' && type !== 'stream' && (
            <div className="au-bseg">
              {([undefined, 'desc', 'asc'] as const).map((so) => (
                <button type="button" key={so || 'n'} className={b.sort === so ? 'on' : ''} onClick={() => p.onLayout(key, { sort: so })}>
                  {t(`crm.aura.block.sort.${so || 'native'}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {hasPrev && (
        <label className="au-check">
          <input type="checkbox" checked={b.prev !== false} onChange={(e) => p.onLayout(key, { prev: e.target.checked ? undefined : false })} />
          {t('crm.aura.block.comparePrev')}
        </label>
      )}

      {type !== 'section' && (
        <div className="au-bfield">
          <span>{t('crm.aura.block.width')}</span>
          <div className="au-bseg">
            <button type="button" className={!b.span ? 'on' : ''} onClick={() => p.onLayout(key, { span: undefined })}>
              {t('crm.aura.block.auto')}
            </button>
            {AU_SPANS.map((sp) => (
              <button type="button" key={sp} className={b.span === sp ? 'on' : ''} onClick={() => p.onLayout(key, { span: sp })} title={t(`crm.aura.block.span.${sp}`)}>
                <i className="au-span-ico" style={{ ['--w' as string]: `${(sp / 12) * 100}%` } as React.CSSProperties} />
              </button>
            ))}
          </div>
          <em className="au-bhint">{b.span ? t(`crm.aura.block.span.${b.span}`) : t('crm.aura.block.autoHint', { name: t(`crm.aura.block.span.${auDefaultSpan(type)}`) })}</em>
        </div>
      )}

      <div className="au-bfield">
        <span>{t('crm.aura.block.color')}</span>
        <div className="au-swatches">
          <button type="button" className={'au-sw au-sw-theme' + (!b.color ? ' on' : '')} onClick={() => p.onLayout(key, { color: undefined, fill: undefined })} title={t('crm.aura.block.themeColor')}>
            <AuIc d={AU_I.aura} size={12} />
          </button>
          {AU_SWATCHES.map((c) => (
            <button type="button" key={c} className={'au-sw' + (b.color === c ? ' on' : '')} style={{ background: c }} onClick={() => p.onLayout(key, { color: c })} aria-label={c} />
          ))}
          <label className={'au-sw au-sw-custom' + (b.color && !AU_SWATCHES.includes(b.color) ? ' on' : '')} title={t('crm.aura.block.customColor')} style={b.color && !AU_SWATCHES.includes(b.color) ? { background: b.color } : undefined}>
            <input type="color" value={b.color && b.color.startsWith('#') && b.color.length === 7 ? b.color : '#6366f1'} onChange={(e) => p.onLayout(key, { color: e.target.value })} />
          </label>
        </div>
      </div>

      {type !== 'section' && (
        <div className="au-bfield">
          <span>{t('crm.aura.block.fill')}</span>
          <div className="au-fills">
            {([undefined, 'tint', 'solid'] as const).map((fl) => (
              <button
                type="button"
                key={fl || 'none'}
                disabled={!b.color && !!fl}
                className={'au-fill au-fill-' + (fl || 'none') + ((b.fill || undefined) === fl ? ' on' : '')}
                style={{ ['--c' as string]: b.color || 'var(--accent, #6366f1)' } as React.CSSProperties}
                onClick={() => p.onLayout(key, { fill: fl })}
              >
                <i />
                {t(`crm.aura.block.fillOpt.${fl || 'none'}`)}
              </button>
            ))}
          </div>
          {!b.color && <em className="au-bhint">{t('crm.aura.block.fillHint')}</em>}
        </div>
      )}

      <div className="au-bfield">
        <span>{t('crm.aura.block.position')}</span>
        <div className="au-bseg">
          <button type="button" disabled={idx <= 0} onClick={() => p.onMove(key, -1)}>
            ← {t('crm.aura.block.earlier')}
          </button>
          <button type="button" disabled={idx >= p.widgets.length - 1} onClick={() => p.onMove(key, 1)}>
            {t('crm.aura.block.later')} →
          </button>
        </div>
        <em className="au-bhint">{t('crm.aura.block.dragHint')}</em>
      </div>
    </div>
  );

  return (
    <aside className="au-bpanel lv-sheet-right" aria-label={t('crm.aura.block.settings')}>
      <Head
        glyph={type}
        title={(deco ? (b.text || '').split('\n')[0] : b.title) || defTitle}
        sub={deco ? t('crm.aura.note.decoSub') : custom ? t('crm.aura.cb.title') : meta?.source === 'extra' ? t('crm.aura.block.extra') : meta ? t(`crm.aura.src.${meta.source}.name`) : ''}
        onClose={p.onClose}
      />
      {!deco && (
        <div className="au-bpanel-tabs">
          {(['look', 'data'] as const).map((k) => (
            <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {t(`crm.aura.block.tab.${k}`)}
            </button>
          ))}
        </div>
      )}
      {deco || tab === 'look' ? (
        look
      ) : custom ? (
        <div className="au-bpanel-b">
          <AuraCustomBuilder key={custom.id} initial={custom} onSave={p.onSaveCustom} />
        </div>
      ) : (
        <div className="au-bpanel-b au-bpanel-cat">
          <p className="au-bhint">{t('crm.aura.block.replaceHint')}</p>
          <Catalog current={key} used={p.widgets} sources={p.sources} onPick={(next) => p.onReplace(key, next)} access={p.access} />
        </div>
      )}
      <div className="au-bpanel-f">
        <button type="button" className="btn btn-sm au-danger" disabled={p.widgets.length <= 1} onClick={() => p.onRemove(key)}>
          <AuIc d={AU_I.trash} size={13} />
          {t('crm.aura.block.remove')}
        </button>
        {Object.keys(b).some((k) => k !== 'text') && (
          <button type="button" className="btn btn-sm" onClick={() => p.onLayout(key, b.text ? { span: undefined, color: undefined, fill: undefined, title: undefined, viz: undefined, period: undefined, target: undefined, limit: undefined, sort: undefined, prev: undefined } : null)}>
            {t('crm.aura.block.resetAll')}
          </button>
        )}
      </div>
    </aside>
  );
}
