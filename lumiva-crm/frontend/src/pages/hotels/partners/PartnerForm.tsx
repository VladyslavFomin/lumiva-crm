import React from 'react';
import { useTranslation } from 'react-i18next';
import { HOTEL_PARTNER_TYPES, type HotelAgency } from '../../../api/hotels';
import { CountrySelect } from '../CountrySelect';

export type PartnerDraft = Partial<HotelAgency>;

export const emptyPartner = (): PartnerDraft => ({
  name: '',
  type: 'tour_operator',
  status: 'active',
  countryCode: null,
  commissionPct: '0',
  paymentTerms: 'prepayment',
  paymentDays: 0,
});

const F: React.FC<{ label: string; children: React.ReactNode; span?: number; required?: boolean }> = ({ label, children, span = 1, required }) => (
  <div className="htl-f" style={{ gridColumn: `span ${span}` }}>
    <label>
      {label}
      {required && ' *'}
    </label>
    {children}
  </div>
);

/** Поля карточки партнёра — общие для окна создания и вкладки «Профиль». */
export const PartnerForm: React.FC<{ value: PartnerDraft; onChange: (v: PartnerDraft) => void; columns?: 2 | 3 | 4 }> = ({ value: v, onChange, columns = 2 }) => {
  const { t } = useTranslation();
  const p = (key: string) => t(`crm.hotels.partners.form.${key}`);
  const set = (patch: PartnerDraft) => onChange({ ...v, ...patch });
  const txt = (k: keyof HotelAgency) => ({
    value: (v[k] as string | null | undefined) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set({ [k]: e.target.value } as PartnerDraft),
  });
  return (
    <div className="htl-form" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      <div className="htl-form-sec" style={{ gridColumn: `span ${columns}` }}>{p('secMain')}</div>
      <F label={p('name')} span={columns >= 3 ? 2 : columns} required>
        <input {...txt('name')} placeholder={p('namePh')} />
      </F>
      <F label={p('type')}>
        <select value={v.type || 'tour_operator'} onChange={(e) => set({ type: e.target.value as HotelAgency['type'] })}>
          {HOTEL_PARTNER_TYPES.map((x) => (
            <option key={x} value={x}>{t(`crm.hotels.partners.types.${x}`)}</option>
          ))}
        </select>
      </F>
      <F label={p('code')}>
        <input {...txt('code')} placeholder="TUI-DE" />
      </F>
      <F label={p('country')}>
        <CountrySelect value={v.countryCode} onChange={(c) => set({ countryCode: c })} />
      </F>
      <F label={p('city')}>
        <input {...txt('city')} />
      </F>

      <div className="htl-form-sec" style={{ gridColumn: `span ${columns}` }}>{p('secTerms')}</div>
      <F label={p('commission')}>
        <input type="number" min={0} max={100} step="0.5" {...txt('commissionPct')} />
      </F>
      <F label={p('currency')}>
        <input {...txt('currency')} placeholder="EUR" maxLength={3} style={{ textTransform: 'uppercase' }} />
      </F>
      <F label={p('paymentTerms')}>
        <select value={v.paymentTerms || 'prepayment'} onChange={(e) => set({ paymentTerms: e.target.value as HotelAgency['paymentTerms'] })}>
          {(['prepayment', 'on_arrival', 'postpayment'] as const).map((x) => (
            <option key={x} value={x}>{t(`crm.hotels.partners.terms.${x}`)}</option>
          ))}
        </select>
      </F>
      {v.paymentTerms === 'postpayment' && (
        <F label={p('paymentDays')}>
          <input type="number" min={0} max={365} value={v.paymentDays ?? 0} onChange={(e) => set({ paymentDays: Number(e.target.value) })} />
        </F>
      )}
      <F label={p('creditLimit')}>
        <input type="number" min={0} {...txt('creditLimit')} />
      </F>

      <div className="htl-form-sec" style={{ gridColumn: `span ${columns}` }}>{p('secContacts')}</div>
      <F label={p('contactName')}>
        <input {...txt('contactName')} />
      </F>
      <F label={p('email')}>
        <input type="email" {...txt('email')} />
      </F>
      <F label={p('phone')}>
        <input {...txt('phone')} />
      </F>
      <F label={p('website')}>
        <input {...txt('website')} placeholder="https://" />
      </F>

      <div className="htl-form-sec" style={{ gridColumn: `span ${columns}` }}>{p('secLegal')}</div>
      <F label={p('legalName')} span={columns >= 3 ? 2 : 1}>
        <input {...txt('legalName')} />
      </F>
      <F label={p('taxId')}>
        <input {...txt('taxId')} />
      </F>
      <F label={p('address')} span={columns}>
        <textarea rows={2} {...txt('address')} />
      </F>
      <F label={p('notes')} span={columns}>
        <textarea rows={3} {...txt('notes')} />
      </F>
    </div>
  );
};
