import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { CountrySelect, CountryTag } from '../CountrySelect';
import { PartnerForm, emptyPartner, type PartnerDraft } from './PartnerForm';
import { addTypicalPartners, createPartner, fetchPartners, HOTEL_PARTNER_TYPES, type HotelPartnerWithStats } from '../../../api/hotels';
import { money } from './partnerUtils';
import '../hotels-design.css';

export const HotelPartnersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`crm.hotels.partners.${k}`, o);
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [list, setList] = useState<HotelPartnerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('all');
  const [country, setCountry] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<PartnerDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetchPartners()
      .then(setList)
      .catch((e) => showAlert(e.message || p('loadError'), { variant: 'error' }))
      .finally(() => setLoading(false));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter(
      (x) =>
        (showArchived || x.status === 'active') &&
        (type === 'all' || x.type === type) &&
        (!country || x.countryCode === country) &&
        (!s || [x.name, x.code, x.city, x.contactName, x.email].some((f) => f && f.toLowerCase().includes(s))),
    );
  }, [list, q, type, country, showArchived]);

  const activeCount = list.filter((x) => x.status === 'active').length;
  const totals = list.reduce(
    (a, x) => ({ contracts: a.contracts + x.stats.activeContracts, gross: a.gross + x.stats.gross, net: a.net + x.stats.net, commission: a.commission + x.stats.commission }),
    { contracts: 0, gross: 0, net: 0, commission: 0 },
  );
  const lang = i18n.language;

  const save = async () => {
    if (!draft?.name?.trim()) {
      showAlert(p('form.nameRequired'), { variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const created = await createPartner(draft);
      setDraft(null);
      navigate(`/hotels/partners/${created.id}`);
    } catch (e) {
      showAlert((e as Error).message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <PageHelpButton topic="hotels" />
      <div className="px-scope">
        <HotelsSubnav active="partners" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{p('kicker', { count: activeCount })}</div>
            <h1>{p('title')}</h1>
            <p className="sub">{p('subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <button
              className="btn"
              onClick={() =>
                addTypicalPartners()
                  .then(() => load())
                  .then(() => showAlert(p('typicalAdded'), { variant: 'success' }))
                  .catch((e) => showAlert(e.message, { variant: 'error' }))
              }
            >
              {p('addTypical')}
            </button>
            <button className="btn btn-primary" onClick={() => setDraft(emptyPartner())}>
              <Ic d={HTL_ICON.plus} size={14} />{p('new')}
            </button>
          </div>
        </div>

        <div className="htl-kpis">
          <div className="htl-kpi"><div className="l">{p('kpi.active')}</div><div className="v">{activeCount}</div></div>
          <div className="htl-kpi"><div className="l">{p('kpi.contracts')}</div><div className="v">{totals.contracts}</div></div>
          <div className="htl-kpi"><div className="l">{p('kpi.gross')}</div><div className="v">{money(totals.gross, null, lang)}</div></div>
          <div className="htl-kpi"><div className="l">{p('kpi.commission')}</div><div className="v">{money(totals.commission, null, lang)}</div><div className="d">{p('kpi.net', { v: money(totals.net, null, lang) })}</div></div>
        </div>

        <div className="htl-toolbar">
          <div className="bk-search" style={{ flex: 1, maxWidth: 300 }}>
            <Ic d={HTL_ICON.search} size={14} />
            <input placeholder={p('search')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div style={{ width: 220 }}>
            <CountrySelect value={country} onChange={setCountry} placeholder={p('allCountries')} />
          </div>
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {['all', ...HOTEL_PARTNER_TYPES].map((k) => (
              <div key={k} className={`bk-sv-tab${type === k ? ' active' : ''}`} onClick={() => setType(k)}>
                {k === 'all' ? p('allTypes') : t(`crm.hotels.partners.types.${k}`)}
              </div>
            ))}
          </div>
          <label className="htl-check">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            {p('showArchived')}
          </label>
        </div>

        {!loading && list.length === 0 ? (
          <div className="htl-empty">
            <h4>{p('emptyTitle')}</h4>
            <p>{p('emptyBody')}</p>
            <button className="btn btn-primary" onClick={() => setDraft(emptyPartner())}><Ic d={HTL_ICON.plus} size={14} />{p('new')}</button>
          </div>
        ) : (
          <div className="bk-table-wrap">
            <table className="bk-table htl-click-rows">
              <thead>
                <tr>
                  <th>{p('col.partner')}</th>
                  <th>{p('col.type')}</th>
                  <th>{p('col.country')}</th>
                  <th>{p('col.commission')}</th>
                  <th>{p('col.terms')}</th>
                  <th>{p('col.contracts')}</th>
                  <th>{p('col.bookings')}</th>
                  <th>{p('col.gross')}</th>
                  <th>{p('col.net')}</th>
                  <th>{p('col.last')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((x) => (
                  <tr key={x.id} onClick={() => navigate(`/hotels/partners/${x.id}`)} className={x.status === 'archived' ? 'muted' : undefined}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{x.name}</div>
                      <div className="htl-sub">{[x.code, x.city, x.status === 'archived' ? p('archived') : null].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td><span className="bk-badge draft">{t(`crm.hotels.partners.types.${x.type}`)}</span></td>
                    <td><CountryTag code={x.countryCode} /></td>
                    <td className="mono">{Number(x.commissionPct) ? `${Number(x.commissionPct)}%` : '—'}</td>
                    <td>{t(`crm.hotels.partners.terms.${x.paymentTerms}`)}{x.paymentTerms === 'postpayment' && x.paymentDays ? ` · ${x.paymentDays} ${p('days')}` : ''}</td>
                    <td className="mono">{x.stats.activeContracts || '—'}</td>
                    <td className="mono">{x.stats.bookings || '—'}{x.stats.cancelled ? <span className="htl-sub"> / −{x.stats.cancelled}</span> : null}</td>
                    <td className="mono">{x.stats.gross ? money(x.stats.gross, x.currency, lang) : '—'}</td>
                    <td className="mono">{x.stats.net ? money(x.stats.net, x.currency, lang) : '—'}</td>
                    <td className="htl-sub">{x.stats.lastBookingAt ? new Date(x.stats.lastBookingAt).toLocaleDateString(lang) : '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={10} className="htl-sub" style={{ textAlign: 'center', padding: 24 }}>{p('noMatch')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {draft && (
        <div className="px-scope">
          <div className="lv-backdrop htl-sheet-back" onClick={() => setDraft(null)} />
          <div className="lv-sheet-right htl-sheet">
            <div className="htl-sheet-head">
              <h3>{p('newTitle')}</h3>
              <button onClick={() => setDraft(null)}><Ic d={HTL_ICON.x} size={16} /></button>
            </div>
            <div className="htl-sheet-body">
              <PartnerForm value={draft} onChange={setDraft} />
            </div>
            <div className="htl-sheet-foot">
              <button className="btn" onClick={() => setDraft(null)}>{t('crm.hotels.common.cancel')}</button>
              <button className="btn btn-primary" disabled={saving} onClick={save}><Ic d={HTL_ICON.check} size={14} />{p('create')}</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
