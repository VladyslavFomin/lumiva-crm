import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from '../HotelIcons';
import { CountrySelect } from '../CountrySelect';
import { createPartner, HOTEL_PARTNER_TYPES, type HotelAgency } from '../../../api/hotels';
import { emptyPartner, type PartnerDraft } from './PartnerForm';

/** Быстрое добавление партнёра прямо из формы брони: главное (название, тип, страна, комиссия),
 *  остальное — в карточке партнёра (/hotels/partners/:id). */
export const QuickPartnerDialog: React.FC<{ initialName?: string; onClose: () => void; onCreated: (a: HotelAgency) => void }> = ({ initialName = '', onClose, onCreated }) => {
  const { t } = useTranslation();
  const p = (k: string) => t(`crm.hotels.partners.${k}`);
  const { showAlert } = useAlertModal();
  const [draft, setDraft] = useState<PartnerDraft>({ ...emptyPartner(), name: initialName });
  const [saving, setSaving] = useState(false);
  const set = (patch: PartnerDraft) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    if (!draft.name?.trim()) {
      showAlert(p('form.nameRequired'), { variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      onCreated(await createPartner({ ...draft, name: draft.name.trim() }));
    } catch (e) {
      showAlert((e as Error).message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back qp-back" onClick={onClose} />
      <div className="bk-modal narrow qp-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="bk-modal-head">
          <h3>{p('newTitle')}</h3>
          <button type="button" onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          <label>{p('form.name')} *</label>
          <input autoFocus value={draft.name || ''} placeholder={p('form.namePh')} onChange={(e) => set({ name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} />
          <div className="bk-row2">
            <div>
              <label>{p('form.type')}</label>
              <select value={draft.type || 'tour_operator'} onChange={(e) => set({ type: e.target.value as HotelAgency['type'] })}>
                {HOTEL_PARTNER_TYPES.map((x) => <option key={x} value={x}>{t(`crm.hotels.partners.types.${x}`)}</option>)}
              </select>
            </div>
            <div>
              <label>{p('form.commission')}</label>
              <input type="number" min={0} max={100} step="0.5" value={draft.commissionPct ?? ''} onChange={(e) => set({ commissionPct: e.target.value })} />
            </div>
          </div>
          <label>{p('form.country')}</label>
          <CountrySelect value={draft.countryCode} onChange={(c) => set({ countryCode: c })} />
          <div className="htl-sub" style={{ marginTop: 10 }}>{p('quickHint')}</div>
        </div>
        <div className="bk-modal-foot">
          <button type="button" className="btn" onClick={onClose}>{t('crm.hotels.common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}><Ic d={HTL_ICON.check} size={14} />{p('create')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
