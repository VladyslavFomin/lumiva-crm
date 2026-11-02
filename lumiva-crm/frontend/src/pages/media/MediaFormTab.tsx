// src/pages/media/MediaFormTab.tsx — «Форма скачивания» (порт FormTab из media-crm.jsx, сохраняется на сервер)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { ensureLanguageLoaded } from '../../i18n';
import { fetchMediaSettings, updateMediaSettings, type MediaFieldType, type MediaFormField, type MediaLang, type MediaSettings } from '../../api/media';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, MIC, Sw, cx } from './mediaUi';

const TYPES: MediaFieldType[] = ['text', 'email', 'tel', 'select', 'textarea', 'check'];

export const MediaFormTab: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [s, setS] = useState<MediaSettings | null>(null);
  const [fields, setFields] = useState<MediaFormField[]>([]);
  const [title, setTitle] = useState('');
  const [titles, setTitles] = useState<Partial<Record<MediaLang, string>>>({});
  const [edLang, setEdLang] = useState<MediaLang>('ru');
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [leadStatus, setLeadStatus] = useState('new');
  const [assignee, setAssignee] = useState('');
  const [tags, setTags] = useState('');
  const [reask, setReask] = useState(30);
  const [dedupe, setDedupe] = useState<'merge' | 'new'>('merge');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const s0Loaded = useRef(false);
  const [pvReady, setPvReady] = useState(0);
  useEffect(() => { void ensureLanguageLoaded(edLang).then(() => setPvReady((x) => x + 1)); }, [edLang]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pvT = useMemo(() => i18n.getFixedT(edLang), [edLang, pvReady]);

  const apply = (r: MediaSettings) => {
    setS(r);
    setFields(r.formFields);
    setTitle(r.formTitle);
    setTitles(r.formTitles || {});
    setEdLang((l) => (r.baseLang && !s0Loaded.current ? r.baseLang : l));
    s0Loaded.current = true;
    setLeadStatus(r.leadStatus);
    setAssignee(r.assigneeStaffId ?? '');
    setTags((r.contactTags || []).join(', '));
    setReask(r.reaskDays);
    setDedupe(r.dedupe);
    setDirty(false);
  };

  useEffect(() => {
    fetchMediaSettings().then(apply).catch((e: any) => showAlert(e?.message || String(e), { variant: 'error' }));
    fetchStaff().then((l) => setStaff(l.filter((x) => x.isActive))).catch(() => undefined);
  }, [showAlert]);

  const touch = () => { setDirty(true); setSavedAt(false); };
  const upd = (id: string, patch: Partial<MediaFormField>) => {
    touch();
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch, ...(patch.on === false ? { req: false } : {}) } : f)));
  };
  const mv = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= fields.length) return;
    const n = [...fields];
    [n[i], n[j]] = [n[j], n[i]];
    setFields(n);
    touch();
  };
  const add = () => {
    setFields((fs) => [...fs, { id: `c${Date.now().toString(36)}`, label: t('crm.media.newField'), type: 'text', ph: '', on: true, req: false }]);
    touch();
  };
  const remove = (id: string) => { setFields((fs) => fs.filter((f) => f.id !== id)); touch(); };

  const save = async () => {
    setSaving(true);
    try {
      const r = await updateMediaSettings({
        formTitle: title,
        formTitles: titles,
        formFields: fields,
        leadStatus,
        assigneeStaffId: assignee || null,
        contactTags: tags.split(',').map((x) => x.trim()).filter(Boolean),
        reaskDays: reask,
        dedupe,
      });
      apply(r);
      setSavedAt(true);
    } catch (e: any) {
      showAlert(e?.message || String(e), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!s) return <div className="md-skel" style={{ height: 420 }} />;
  // тексты на выбранном языке: ручной перевод → стандартная подпись на этом языке → как написано
  const base = s.baseLang || 'ru';
  const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, ' ');
  const auto = (text: string | undefined, l: MediaLang) => {
    if (!text) return text || '';
    const hit = (s.dict || []).find((d) => norm(d.ru) === norm(text) || norm(d.en) === norm(text) || norm(d.tr) === norm(text));
    return hit ? hit[l] : text;
  };
  const eff = (f: MediaFormField) => {
    const o = f.l10n?.[edLang] || {};
    return {
      ...f,
      label: o.label?.trim() ? o.label : auto(f.label, edLang),
      ph: o.ph ? o.ph : auto(f.ph, edLang),
      options: o.options?.length ? o.options : (f.options || []).map((x) => auto(x, edLang)),
    };
  };
  const setText = (f: MediaFormField, key: 'label' | 'ph' | 'options', value: string | string[]) => {
    const cur = f.l10n?.[edLang] || {};
    const patch: Partial<MediaFormField> = { l10n: { ...(f.l10n || {}), [edLang]: { ...cur, [key]: value } } };
    if (edLang === base) (patch as any)[key] = value;
    upd(f.id, patch);
  };
  const effTitle = titles[edLang]?.trim() ? titles[edLang]! : auto(title, edLang);
  const setTitleText = (v: string) => {
    setTitles((x) => ({ ...x, [edLang]: v }));
    if (edLang === base) setTitle(v);
    touch();
  };
  const live = fields.filter((f) => f.on).map(eff);
  const BUILTIN = ['name', 'email', 'phone', 'company', 'role', 'purpose', 'consent'];

  return (
    <div className="mf-grid2" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div className="md-card">
          <div className="md-card-head">
            <div><h3><Ic d={MIC.form} size={15} />{t('crm.media.formFields')}</h3><div className="sub">{t('crm.media.formFieldsSub')}</div></div>
            <button type="button" className="btn btn-sm" onClick={add}><Ic d={MIC.plus} size={12} />{t('crm.media.field')}</button>
          </div>
          <div className="md-bar">
            <span className="mf-lbl">{t('crm.media.textsLang')}</span>
            <div className="md-seg">
              {(['ru', 'en', 'tr'] as MediaLang[]).map((l) => (
                <button type="button" key={l} className={cx(edLang === l && 'on')} onClick={() => setEdLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
            <span className="mf-slug" style={{ flex: 1, minWidth: 200 }}>{t('crm.media.textsLangHint')}</span>
          </div>
          <div className="mf-fh">
            <span />
            <span>{t('crm.media.colField')}</span>
            <span>{t('crm.media.colType')}</span>
            <span>{t('crm.media.colInCrm')}</span>
            <span>{t('crm.media.colShow')}</span>
            <span>{t('crm.media.colRequired')}</span>
            <span />
          </div>
          {fields.map((f, i) => (
            <React.Fragment key={f.id}>
              <div
                className={cx('mf-fr', !f.on && 'off')}
                draggable
                onDragStart={() => { dragIdx.current = i; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const from = dragIdx.current;
                  dragIdx.current = null;
                  if (from === null || from === i) return;
                  const n = [...fields];
                  const [x] = n.splice(from, 1);
                  n.splice(i, 0, x);
                  setFields(n);
                  touch();
                }}
              >
                <span className="dr"><Ic d={MIC.drag} size={13} /></span>
                <input className="md-in" value={eff(f).label} onChange={(e) => setText(f, 'label', e.target.value)} aria-label={t('crm.media.colField')} />
                <select className="md-sel" value={f.type} disabled={f.lock || BUILTIN.includes(f.id)} onChange={(e) => upd(f.id, { type: e.target.value as MediaFieldType })}>
                  {TYPES.map((k) => <option key={k} value={k}>{t(`crm.media.type_${k}`)}</option>)}
                </select>
                <span className="mf-map">{t(`crm.media.map_${BUILTIN.includes(f.id) ? f.id : 'custom'}`)}</span>
                <Sw on={f.on} set={(v) => upd(f.id, { on: v })} dis={f.lock} label={t('crm.media.colShow')} />
                <Sw on={f.req} set={(v) => upd(f.id, { req: v })} dis={f.lock || !f.on} label={t('crm.media.colRequired')} />
                <span className="mf-mv">
                  <button type="button" onClick={() => mv(i, -1)} aria-label="up"><Ic d={MIC.up} size={11} /></button>
                  {!BUILTIN.includes(f.id) ? (
                    <button type="button" onClick={() => remove(f.id)} aria-label={t('crm.media.delete')}><Ic d={MIC.x} size={11} /></button>
                  ) : null}
                  <button type="button" onClick={() => mv(i, 1)} aria-label="down"><Ic d={MIC.down} size={11} /></button>
                </span>
              </div>
              {f.type === 'select' && f.on && (
                <div className="mf-fr" style={{ paddingTop: 0 }}>
                  <span />
                  <input
                    className="md-in opts"
                    value={eff(f).options.join(', ')}
                    placeholder={t('crm.media.optionsPh')}
                    onChange={(e) => setText(f, 'options', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))}
                  />
                </div>
              )}
              {(f.type === 'text' || f.type === 'email' || f.type === 'tel' || f.type === 'textarea') && f.on && !BUILTIN.includes(f.id) && (
                <div className="mf-fr" style={{ paddingTop: 0 }}>
                  <span />
                  <input className="md-in opts" value={eff(f).ph || ''} placeholder={t('crm.media.placeholderPh')} onChange={(e) => setText(f, 'ph', e.target.value)} />
                </div>
              )}
            </React.Fragment>
          ))}
          <div className="md-foot">
            <span>{t('crm.media.fieldsSummary', { n: live.length, r: live.filter((f) => f.req).length })}</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-sm" onClick={() => { setFields(s.defaults.formFields); setTitle(s.defaults.formTitle); setTitles({}); touch(); }}>{t('crm.media.reset')}</button>
              <button type="button" className="btn btn-sm btn-primary" disabled={saving || (!dirty && !savedAt)} onClick={() => void save()}>
                <Ic d={MIC.check} size={12} />{savedAt && !dirty ? t('crm.media.saved') : t('crm.media.save')}
              </button>
            </span>
          </div>
        </div>

        <div className="md-card">
          <div className="md-card-head">
            <div><h3><Ic d={MIC.users} size={15} />{t('crm.media.whereLeadGoes')}</h3><div className="sub">{t('crm.media.whereLeadGoesSub')}</div></div>
          </div>
          <div className="md-body">
            <div className="md-fields2">
              <div className="md-f">
                <label>{t('crm.media.leadStatus')}</label>
                <select className="md-sel" value={leadStatus} onChange={(e) => { setLeadStatus(e.target.value); touch(); }}>
                  {['new', 'in_progress', 'waiting'].map((x) => <option key={x} value={x}>{t(`crm.media.leadStatus_${x}`)}</option>)}
                </select>
              </div>
              <div className="md-f">
                <label>{t('crm.media.assignee')}</label>
                <select className="md-sel" value={assignee} onChange={(e) => { setAssignee(e.target.value); touch(); }}>
                  <option value="">{t('crm.media.assigneeNone')}</option>
                  {staff.map((x) => <option key={x.id} value={x.id}>{x.fullName || x.email}</option>)}
                </select>
              </div>
              <div className="md-f">
                <label>{t('crm.media.contactTags')}</label>
                <input className="md-in" value={tags} onChange={(e) => { setTags(e.target.value); touch(); }} placeholder="media, press" />
              </div>
              <div className="md-f">
                <label>{t('crm.media.reask')}</label>
                <select className="md-sel" value={reask} onChange={(e) => { setReask(Number(e.target.value)); touch(); }}>
                  {[0, 1, 7, 30, 90, 365].map((d) => <option key={d} value={d}>{d === 0 ? t('crm.media.reaskEvery') : t('crm.media.reaskDays', { count: d })}</option>)}
                </select>
              </div>
              <div className="md-f">
                <label>{t('crm.media.dedupe')}</label>
                <select className="md-sel" value={dedupe} onChange={(e) => { setDedupe(e.target.value as 'merge' | 'new'); touch(); }}>
                  <option value="merge">{t('crm.media.dedupeMerge')}</option>
                  <option value="new">{t('crm.media.dedupeNew')}</option>
                </select>
              </div>
            </div>
            <div className="md-note plain">
              <Ic d={MIC.users} size={14} />
              <span>{t('crm.media.leadNote')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="md-card mf-pv">
        <div className="md-card-head">
          <div><h3><Ic d={MIC.eye} size={15} />{t('crm.media.clientView')}</h3><div className="sub">{t('crm.media.clientViewSub')}</div></div>
        </div>
        <div className="mf-pv-stage">
          <div className="mf-pv-box">
            <div className="k">{pvT('publicPages.media.filesN', { count: 3 })} · 24,6 MB</div>
            <input className="mf-pv-t" value={effTitle} onChange={(e) => setTitleText(e.target.value)} aria-label={t('crm.media.formTitle')} />
            {live.map((f) =>
              f.type === 'check' ? (
                <label key={f.id} className="ck"><span className="b" />{f.label}{f.req && ' *'}</label>
              ) : (
                <div key={f.id} className="fld">
                  <span>{f.label}{f.req && ' *'}</span>
                  <div className="in">{f.type === 'select' ? `${(f.options || ['—'])[0]} ▾` : f.ph || ''}</div>
                </div>
              ),
            )}
            <div className="go">{pvT('publicPages.media.download')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
