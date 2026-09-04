// src/pages/products/ProductFieldTypesPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { ProductsSubnav } from './ProductsSubnav';
import {
  fetchProductFieldDefs,
  fetchProductFieldGroups,
  createProductFieldDef,
  updateProductFieldDef,
  deleteProductFieldDef,
  type ProductFieldDef,
  type ProductFieldType,
} from '../../api/products';
import './products-design.css';

const FIELD_TYPES: ProductFieldType[] = [
  'text', 'textarea', 'number', 'date', 'datetime', 'boolean',
  'select', 'multiselect', 'radio', 'url', 'media', 'gallery',
  'wysiwyg', 'colorpicker', 'relation', 'repeater',
];
const OPTIONS_TYPES: ProductFieldType[] = ['select', 'multiselect', 'radio'];

const TYPE_ICON: Record<ProductFieldType, React.ReactNode> = {
  text: <><path d="M5 5h14" /><path d="M12 5v14" /><path d="M9 19h6" /></>,
  textarea: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" /></>,
  number: <><path d="M5 9h14" /><path d="M5 15h14" /><path d="M10 3L7 21" /><path d="M17 3l-3 18" /></>,
  date: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></>,
  datetime: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2" /></>,
  boolean: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12l3 3 5-6" /></>,
  select: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><circle cx="3.5" cy="6" r="1" fill="currentColor" /><circle cx="3.5" cy="12" r="1" fill="currentColor" /><circle cx="3.5" cy="18" r="1" fill="currentColor" /></>,
  multiselect: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12l3 3 5-6" /></>,
  radio: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" fill="currentColor" /></>,
  url: <><path d="M10 13a5 5 0 007.07 0l2-2a5 5 0 00-7.07-7.07l-1 1" /><path d="M14 11a5 5 0 00-7.07 0l-2 2a5 5 0 007.07 7.07l1-1" /></>,
  media: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 15l-5-5-6 6" /></>,
  gallery: <><rect x="3" y="4" width="14" height="12" rx="2" /><rect x="7" y="8" width="14" height="12" rx="2" /></>,
  wysiwyg: <><path d="M4 6h16" /><path d="M4 12h10" /><path d="M4 18h7" /><path d="M17 15l3 3-3 3" /></>,
  colorpicker: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 000 18c1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 005-5c0-4.4-4-8-9-8z" /></>,
  relation: <><circle cx="7" cy="7" r="3" /><circle cx="17" cy="17" r="3" /><path d="M9.5 9.5l5 5" /></>,
  repeater: <><rect x="4" y="4" width="16" height="5" rx="1.5" /><rect x="4" y="11" width="16" height="5" rx="1.5" /><rect x="4" y="18" width="10" height="2" rx="1" /></>,
};

const Icon: React.FC<{ d: React.ReactNode; size?: number }> = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const ChevDown = () => <Icon d={<path d="M6 9l6 6 6-6" />} size={14} />;
const ChevRight = () => <Icon d={<path d="M9 6l6 6-6 6" />} size={13} />;
const PlusIcon = () => <Icon d={<><path d="M12 5v14" /><path d="M5 12h14" /></>} size={13} />;
const TrashIcon = () => <Icon d={<><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" /></>} size={13} />;
const UploadIcon = () => <Icon d={<><path d="M12 21V9" /><path d="M7 14l5-5 5 5" /><path d="M4 3h16" /></>} size={14} />;

type FieldGroupBucket = { name: string | null; label: string; fields: ProductFieldDef[] };

const Toggle: React.FC<{ on: boolean; onClick: () => void }> = ({ on, onClick }) => (
  <button type="button" className={`px-toggle${on ? ' on' : ''}`} onClick={onClick} />
);

/* ---------- expandable field row with inline editing ---------- */
const FieldRow: React.FC<{
  field: ProductFieldDef;
  isOpen: boolean;
  onToggle: () => void;
  onSaved: () => void;
  onDelete: () => void;
}> = ({ field, isOpen, onToggle, onSaved, onDelete }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [options, setOptions] = useState(field.options || []);

  useEffect(() => setOptions(field.options || []), [field.options]);

  const patch = async (dto: Partial<Parameters<typeof updateProductFieldDef>[1]>) => {
    try {
      await updateProductFieldDef(field.id, dto);
      onSaved();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.fieldTypes.errors.saveFailed'), { variant: 'error' });
    }
  };

  const saveOptions = (next: Array<{ value: string; label: string }>) => {
    setOptions(next);
    patch({ options: next });
  };

  return (
    <div className={`px-field-row${isOpen ? ' open' : ''}`}>
      <div className="px-field-row-head" onClick={onToggle}>
        <span className="chev"><ChevRight /></span>
        <span className={`px-field-type-badge ${field.type}`}>{t(`crm.products.fieldTypes.types.${field.type}`)}</span>
        <span className="fname">
          {field.label}
          <em className="fkey">{field.key}</em>
        </span>
        <span className="px-field-row-spacer" />
        {field.required && (
          <span
            style={{
              fontFamily: 'var(--ff-mono)', fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: '#7a4a09', background: '#fbf2dc', border: '1px solid #f0d9a8', padding: '2px 6px', borderRadius: 5,
            }}
          >
            {t('crm.products.fieldTypes.table.required')}
          </span>
        )}
        <div className="px-field-row-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[#9a1f31] hover:bg-[#fbecef] disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title={t('crm.products.form.actions.delete') || ''} onClick={onDelete}>
            <TrashIcon />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="px-field-detail">
          <div className="px-fd-row">
            <div>
              <div className="fdl">{t('crm.products.fieldTypes.modal.labelField')}</div>
              <div className="fdd">{t('crm.products.fieldTypes.subtitle')}</div>
            </div>
            <div className="fdv">
              <input
                className="ai-input"
                defaultValue={field.label}
                onBlur={(e) => e.target.value.trim() && e.target.value !== field.label && patch({ label: e.target.value.trim() })}
              />
            </div>
          </div>
          <div className="px-fd-row">
            <div>
              <div className="fdl">{t('crm.products.fieldTypes.modal.typeField')}</div>
            </div>
            <div className="fdv">
              <select
                className="ai-select"
                defaultValue={field.type}
                onChange={(e) => patch({ type: e.target.value as ProductFieldType })}
              >
                {FIELD_TYPES.map((ty) => (
                  <option key={ty} value={ty}>{t(`crm.products.fieldTypes.types.${ty}`)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="px-fd-row">
            <div>
              <div className="fdl">{t('crm.products.fieldTypes.modal.requiredField')}</div>
            </div>
            <div className="fdv"><Toggle on={field.required} onClick={() => patch({ required: !field.required })} /></div>
          </div>
          <div className="px-fd-row">
            <div>
              <div className="fdl">{t('crm.products.fieldTypes.showInFiltersField')}</div>
              <div className="fdd">{t('crm.products.fieldTypes.showInFiltersHint')}</div>
            </div>
            <div className="fdv"><Toggle on={field.showInFilters} onClick={() => patch({ showInFilters: !field.showInFilters })} /></div>
          </div>
          <div className="px-fd-row">
            <div>
              <div className="fdl">{t('crm.products.fieldTypes.modal.showInList')}</div>
            </div>
            <div className="fdv"><Toggle on={field.showInList} onClick={() => patch({ showInList: !field.showInList })} /></div>
          </div>
          <div className="px-fd-row">
            <div>
              <div className="fdl">{t('crm.products.fieldTypes.modal.showInQuickEdit')}</div>
            </div>
            <div className="fdv"><Toggle on={field.showInQuickEdit} onClick={() => patch({ showInQuickEdit: !field.showInQuickEdit })} /></div>
          </div>
          <div className="px-fd-row">
            <div>
              <div className="fdl">{t('crm.products.fieldTypes.modal.descriptionField')}</div>
            </div>
            <div className="fdv">
              <input
                className="ai-input"
                defaultValue={field.description || ''}
                onBlur={(e) => e.target.value !== (field.description || '') && patch({ description: e.target.value })}
              />
            </div>
          </div>
          <div className="px-fd-row">
            <div>
              <div className="fdl">{t('crm.products.fieldTypes.modal.widthField')}</div>
            </div>
            <div className="fdv">
              <select className="ai-select" defaultValue={field.width} onChange={(e) => patch({ width: e.target.value })}>
                <option value="25">25%</option>
                <option value="50">50%</option>
                <option value="75">75%</option>
                <option value="100">100%</option>
              </select>
            </div>
          </div>

          {OPTIONS_TYPES.includes(field.type) && (
            <div className="px-fd-row">
              <div>
                <div className="fdl">{t('crm.products.fieldTypes.modal.optionsField')}</div>
              </div>
              <div className="fdv">
                <div className="px-opt-list">
                  {options.map((o, i) => (
                    <div className="px-opt-row" key={i}>
                      <input
                        defaultValue={o.label}
                        placeholder={t('crm.products.fieldTypes.modal.optionLabel') || ''}
                        onBlur={(e) => {
                          const next = options.map((x, idx) => (idx === i ? { ...x, label: e.target.value, value: x.value || e.target.value } : x));
                          saveOptions(next);
                        }}
                      />
                      <div className="px-opt-row-actions">
                        <button type="button" className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-[#9a1f31] hover:bg-[#fbecef] disabled:opacity-40 disabled:cursor-not-allowed transition-colors" onClick={() => saveOptions(options.filter((_, idx) => idx !== i))}>
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="px-opt-add"
                  onClick={() => saveOptions([...options, { value: `option-${options.length + 1}`, label: t('crm.products.fieldTypes.modal.optionLabel') || 'Option' }])}
                >
                  <PlusIcon />
                  {t('crm.products.fieldTypes.modal.addOption')}
                </button>
              </div>
            </div>
          )}

          {field.type === 'relation' && (
            <div className="px-fd-row">
              <div>
                <div className="fdl">{t('crm.products.fieldTypes.relationMultiple')}</div>
              </div>
              <div className="fdv">
                <Toggle
                  on={Boolean((field.settings as any)?.multiple)}
                  onClick={() => patch({ settings: { ...(field.settings || {}), multiple: !(field.settings as any)?.multiple } })}
                />
              </div>
            </div>
          )}

          {field.type === 'colorpicker' && (
            <div className="px-fd-row">
              <div>
                <div className="fdl">{t('crm.products.fieldTypes.colorPalette')}</div>
              </div>
              <div className="fdv">
                <ColorPaletteEditor
                  palette={Array.isArray((field.settings as any)?.palette) ? (field.settings as any).palette : []}
                  onChange={(palette) => patch({ settings: { ...(field.settings || {}), palette } })}
                />
              </div>
            </div>
          )}

          {field.type === 'repeater' && (
            <div className="px-fd-row">
              <div>
                <div className="fdl">{t('crm.products.fieldTypes.repeaterColumns')}</div>
              </div>
              <div className="fdv">
                <RepeaterSubFieldsEditor
                  subFields={Array.isArray((field.settings as any)?.subFields) ? (field.settings as any).subFields : []}
                  onChange={(subFields) => patch({ settings: { ...(field.settings || {}), subFields } })}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ColorPaletteEditor: React.FC<{ palette: string[]; onChange: (p: string[]) => void }> = ({ palette, onChange }) => {
  const { t } = useTranslation();
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {palette.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="color" value={c} onChange={(e) => onChange(palette.map((x, idx) => (idx === i ? e.target.value : x)))} style={{ width: 26, height: 26, border: 0, padding: 0, cursor: 'pointer' }} />
            <button type="button" onClick={() => onChange(palette.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="px-opt-add" onClick={() => onChange([...palette, '#222222'])}>
        <PlusIcon />
        {t('crm.products.fieldTypes.modal.addOption')}
      </button>
    </div>
  );
};

const RepeaterSubFieldsEditor: React.FC<{
  subFields: Array<{ key: string; label: string; type: 'text' | 'number' }>;
  onChange: (s: Array<{ key: string; label: string; type: 'text' | 'number' }>) => void;
}> = ({ subFields, onChange }) => {
  const { t } = useTranslation();
  return (
    <div>
      <div className="px-opt-list">
        {subFields.map((sf, i) => (
          <div className="px-opt-row" key={i}>
            <input
              defaultValue={sf.label}
              placeholder={t('crm.products.fieldTypes.modal.optionLabel') || ''}
              onBlur={(e) => {
                const label = e.target.value;
                const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || sf.key || `col_${i}`;
                onChange(subFields.map((x, idx) => (idx === i ? { ...x, label, key } : x)));
              }}
            />
            <select
              defaultValue={sf.type}
              onChange={(e) => onChange(subFields.map((x, idx) => (idx === i ? { ...x, type: e.target.value as 'text' | 'number' } : x)))}
              style={{ border: '1px solid var(--line-2)', borderRadius: 6, fontSize: 12 }}
            >
              <option value="text">{t('crm.products.fieldTypes.types.text')}</option>
              <option value="number">{t('crm.products.fieldTypes.types.number')}</option>
            </select>
            <div className="px-opt-row-actions">
              <button type="button" className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-[#9a1f31] hover:bg-[#fbecef] disabled:opacity-40 disabled:cursor-not-allowed transition-colors" onClick={() => onChange(subFields.filter((_, idx) => idx !== i))}>
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="px-opt-add"
        onClick={() => onChange([...subFields, { key: `col_${subFields.length + 1}`, label: '', type: 'text' }])}
      >
        <PlusIcon />
        {t('crm.products.fieldTypes.modal.addOption')}
      </button>
    </div>
  );
};

/* ---------- field group accordion ---------- */
const FieldGroupSection: React.FC<{
  bucket: FieldGroupBucket;
  openField: string | null;
  setOpenField: (id: string | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSaved: () => void;
  onDeleteField: (id: string) => void;
  onAddField: () => void;
}> = ({ bucket, openField, setOpenField, collapsed, onToggleCollapse, onSaved, onDeleteField, onAddField }) => {
  const { t } = useTranslation();
  return (
    <div className="px-fgroup">
      <div className={`px-fgroup-head${collapsed ? ' collapsed' : ''}`} onClick={onToggleCollapse}>
        <span className="chev"><ChevDown /></span>
        <span className="t">{bucket.label}</span>
        <span className="cnt">{bucket.fields.length}</span>
        <button type="button" className="px-fgroup-add" onClick={(e) => { e.stopPropagation(); onAddField(); }} title={t('crm.products.fieldTypes.addButton') || ''}>
          <PlusIcon />
        </button>
      </div>
      {!collapsed && (
        <div className="px-fgroup-body">
          {bucket.fields.map((f) => (
            <FieldRow
              key={f.id}
              field={f}
              isOpen={openField === f.id}
              onToggle={() => setOpenField(openField === f.id ? null : f.id)}
              onSaved={onSaved}
              onDelete={() => onDeleteField(f.id)}
            />
          ))}
          <button type="button" className="px-add-field" onClick={onAddField}>
            <PlusIcon />
            {t('crm.products.fieldTypes.addFieldToGroup', { name: bucket.label })}
          </button>
        </div>
      )}
    </div>
  );
};

/* ---------- add-field modal ---------- */
const AddFieldModal: React.FC<{
  existingGroups: string[];
  defaultGroup: string | null;
  onClose: () => void;
  onCreated: () => void;
}> = ({ existingGroups, defaultGroup, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [label, setLabel] = useState('');
  const [type, setType] = useState<ProductFieldType>('text');
  const [groupChoice, setGroupChoice] = useState<string>(defaultGroup || existingGroups[0] || '__new__');
  const [newGroupName, setNewGroupName] = useState(defaultGroup && !existingGroups.includes(defaultGroup) ? defaultGroup : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      const group = groupChoice === '__new__' ? newGroupName.trim() || undefined : groupChoice;
      await createProductFieldDef({ label: label.trim(), type, group });
      onCreated();
      onClose();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.fieldTypes.errors.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pr-cat-modal-back" onClick={onClose}>
      <div className="pr-cat-modal" style={{ width: 'min(480px, calc(100vw - 32px))' }} onClick={(e) => e.stopPropagation()}>
        <h3>{t('crm.products.fieldTypes.addButton')}</h3>
        <div className="ai-field">
          <label className="ai-label">{t('crm.products.fieldTypes.modal.labelField')}</label>
          <input className="ai-input" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        </div>
        <div className="ai-field">
          <label className="ai-label">{t('crm.products.fieldTypes.groupLabel')}</label>
          <select className="ai-select" value={groupChoice} onChange={(e) => setGroupChoice(e.target.value)}>
            {existingGroups.map((g) => <option key={g} value={g}>{g}</option>)}
            <option value="__new__">{t('crm.products.fieldTypes.newGroupOption')}</option>
          </select>
          {groupChoice === '__new__' && (
            <input
              className="ai-input"
              style={{ marginTop: 8 }}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={t('crm.products.fieldTypes.newGroupPlaceholder') || ''}
            />
          )}
        </div>
        <div className="ai-label" style={{ marginBottom: 8 }}>{t('crm.products.fieldTypes.typePickerTitle')}</div>
        <div className="px-type-picker" style={{ padding: 0, marginBottom: 6 }}>
          {FIELD_TYPES.map((ty) => (
            <div key={ty} className={`px-type-opt${type === ty ? ' active' : ''}`} onClick={() => setType(ty)}>
              <span className="ic"><Icon d={TYPE_ICON[ty]} size={17} /></span>
              <span className="n">{t(`crm.products.fieldTypes.types.${ty}`)}</span>
            </div>
          ))}
        </div>
        <div className="pr-cat-modal-foot">
          <button type="button" className="aib ghost" onClick={onClose}>{t('crm.products.fieldTypes.modal.cancel')}</button>
          <button type="button" className="aib" onClick={handleSave} disabled={saving || !label.trim()}>
            {t('crm.products.fieldTypes.addButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- live preview panel ---------- */
const PreviewPanel: React.FC<{ fields: ProductFieldDef[] }> = ({ fields }) => {
  const { t } = useTranslation();
  return (
    <div className="px-preview">
      <div className="px-preview-head">
        <div className="t">{t('crm.products.fieldTypes.previewTitle')}</div>
        <div className="d">{t('crm.products.fieldTypes.previewSubtitle')}</div>
      </div>
      <div className="px-preview-body">
        {!fields.length && <div className="px-preview-empty">{t('crm.products.fieldTypes.previewEmpty')}</div>}
        {fields.map((f) => (
          <div className="px-preview-field" key={f.id}>
            <div className="pl">{f.label}<span className="pk">{f.key}</span></div>
            {f.type === 'boolean' ? (
              <div className="pv chk"><span className="px-toggle" /> <span style={{ fontSize: 11.5 }}>{t('crm.products.fieldTypes.modal.requiredField')}</span></div>
            ) : f.type === 'select' || f.type === 'radio' ? (
              <div className="pv">{f.options?.[0]?.label || '—'} <span style={{ color: 'var(--fg-4)' }}>▾</span></div>
            ) : f.type === 'multiselect' ? (
              <div className="pv">{(f.options || []).map((o) => o.label).join(', ') || '—'}</div>
            ) : f.type === 'media' || f.type === 'gallery' ? (
              <div className="pv" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><UploadIcon /> {t('crm.products.form.customFields.title')}</div>
            ) : f.type === 'date' ? (
              <div className="pv">дд.мм.гггг</div>
            ) : f.type === 'datetime' ? (
              <div className="pv">дд.мм.гггг чч:мм</div>
            ) : f.type === 'number' ? (
              <div className="pv">0</div>
            ) : (
              <div className="pv">…</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ProductFieldTypesPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();

  const [fields, setFields] = useState<ProductFieldDef[]>([]);
  const [existingGroups, setExistingGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [openField, setOpenField] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [addModal, setAddModal] = useState<{ group: string | null } | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchProductFieldDefs(), fetchProductFieldGroups()])
      .then(([f, g]) => {
        setFields(f);
        setExistingGroups(g);
      })
      .catch((e) => showAlert(e.message || t('crm.products.fieldTypes.errors.loadFailed'), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const ungroupedLabel = t('crm.products.fieldTypes.ungroupedLabel');
  const buckets: FieldGroupBucket[] = useMemo(() => {
    const map = new Map<string | null, ProductFieldDef[]>();
    for (const f of fields) {
      const key = f.group || null;
      const arr = map.get(key) || [];
      arr.push(f);
      map.set(key, arr);
    }
    const orderedGroupNames = [...existingGroups].sort();
    const result: FieldGroupBucket[] = [];
    for (const name of orderedGroupNames) {
      if (map.has(name)) result.push({ name, label: name, fields: map.get(name)! });
    }
    if (map.has(null)) result.push({ name: null, label: ungroupedLabel, fields: map.get(null)! });
    return result;
  }, [fields, existingGroups, ungroupedLabel]);

  const totalFields = fields.length;
  const requiredCount = fields.filter((f) => f.required).length;
  const dataTypeCount = new Set(fields.map((f) => f.type)).size;

  const toggleCollapse = (id: string) =>
    setCollapsed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const handleDeleteField = async (id: string) => {
    const ok = await showConfirm(t('crm.products.fieldTypes.deleteConfirm'), {
      title: t('crm.confirmModal.deleteTitle', { defaultValue: 'Удаление' }),
      confirmLabel: t('crm.confirmModal.deleteLabel', { defaultValue: 'Удалить' }),
      cancelLabel: t('crm.confirmModal.cancel', { defaultValue: 'Отмена' }),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProductFieldDef(id);
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.fieldTypes.errors.saveFailed'), { variant: 'error' });
    }
  };

  return (
    <MainLayout>
      <PageHelpButton topic="productAttributes" />
      <div className="px-scope">
        <div className="px-head">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.products.list.title')}</div>
            <h1>{t('crm.products.fieldTypes.title')}</h1>
            <p className="sub">{t('crm.products.fieldTypes.subtitle')}</p>
          </div>
          <div className="px-head-actions">
            <button type="button" className="aib" onClick={() => setAddModal({ group: null })}>
              <PlusIcon />
              {t('crm.products.fieldTypes.addButton')}
            </button>
          </div>
        </div>

        <ProductsSubnav active="fields" />

        <div className="px-kpis">
          <div className="px-kpi">
            <div className="l">{t('crm.products.fieldTypes.kpis.groups')}</div>
            <div className="v">{buckets.length}</div>
            <div className="d">{t('crm.products.fieldTypes.kpis.groupsHint')}</div>
          </div>
          <div className="px-kpi">
            <div className="l">{t('crm.products.fieldTypes.kpis.total')}</div>
            <div className="v">{totalFields}</div>
            <div className="d">{t('crm.products.fieldTypes.kpis.totalHint')}</div>
          </div>
          <div className="px-kpi">
            <div className="l">{t('crm.products.fieldTypes.kpis.required')}</div>
            <div className="v">{requiredCount}</div>
            <div className="d warn">{t('crm.products.fieldTypes.kpis.requiredHint')}</div>
          </div>
          <div className="px-kpi">
            <div className="l">{t('crm.products.fieldTypes.kpis.types')}</div>
            <div className="v">{dataTypeCount}</div>
            <div className="d">{t('crm.products.fieldTypes.kpis.typesHint')}</div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.common.loading')}</div>
        ) : (
          <div className="px-fields-wrap">
            <div className="px-fields-main">
              {!buckets.length && (
                <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.products.fieldTypes.empty')}</div>
              )}
              {buckets.map((bucket) => (
                <FieldGroupSection
                  key={bucket.name || '__ungrouped__'}
                  bucket={bucket}
                  openField={openField}
                  setOpenField={setOpenField}
                  collapsed={collapsed.includes(bucket.name || '__ungrouped__')}
                  onToggleCollapse={() => toggleCollapse(bucket.name || '__ungrouped__')}
                  onSaved={load}
                  onDeleteField={handleDeleteField}
                  onAddField={() => setAddModal({ group: bucket.name })}
                />
              ))}
              <button type="button" className="px-add-field" onClick={() => setAddModal({ group: null })} style={{ padding: 14 }}>
                <PlusIcon />
                {t('crm.products.fieldTypes.newGroupButton')}
              </button>
            </div>
            <PreviewPanel fields={fields.filter((f) => f.isActive)} />
          </div>
        )}

        {addModal && (
          <AddFieldModal
            existingGroups={existingGroups}
            defaultGroup={addModal.group}
            onClose={() => setAddModal(null)}
            onCreated={load}
          />
        )}
      </div>
    </MainLayout>
  );
};
