import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchLead, updateLead, Lead, LeadStatusCode } from '../../api/leads';
import { fetchCompanies, Company } from '../../api/companies';
import { fetchContacts, Contact } from '../../api/contacts';
import { fetchStaff, Staff } from '../../api/staff';
import { COUNTRIES } from '../../utils/refData';
import { formatMoney } from '../../utils/money';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useAccess } from '../../context/AccessContext';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker, LinkPicker } from '../../components/mg';

const STATUSES: LeadStatusCode[] = ['new', 'in_progress', 'waiting', 'won', 'lost'];

const PickLabel: React.FC<{ label: string }> = ({ label }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>;
};

/** Full lead edit form — every field the website's lead card saves: contact details, country, source + the five UTM tags, amount (permission-gated),
 *  status, assignees, and the company / contact links. */
export const LeadEditScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { id } = useRoute<any>().params as { id: string };
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { codes } = useCurrencyMode();
  const canEditAmount = useAccess().can('leads_edit_amount');

  const [original, setOriginal] = useState<Lead | null>(null);
  const [f, setF] = useState({ name: '', phone: '', email: '', country: '', source: '', amount: '', utmSource: '', utmMedium: '', utmCampaign: '', utmContent: '', utmTerm: '' });
  const [currency, setCurrency] = useState('EUR');
  const [status, setStatus] = useState<LeadStatusCode>('new');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([fetchLead(id), fetchCompanies().catch(() => [] as Company[]), fetchContacts().catch(() => [] as Contact[]), fetchStaff().catch(() => [] as Staff[])])
      .then(([l, co, ct, sf]) => {
        setOriginal(l);
        setF({
          name: l.name, phone: l.phone, email: l.email, country: l.country, source: l.source || '', amount: l.amount ? String(l.amount) : '',
          utmSource: l.utm.source, utmMedium: l.utm.medium, utmCampaign: l.utm.campaign, utmContent: l.utm.content, utmTerm: l.utm.term,
        });
        setCurrency(l.currency); setStatus(l.status); setAssigneeIds(l.assignedUserIds); setCompanyId(l.companyId); setContactId(l.contactId);
        setCompanies(co); setContacts(ct); setStaff(sf);
      })
      .catch(() => { showToast(t('leadDetail.loadError'), { variant: 'error' }); navigation.goBack(); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const countryOptions = useMemo(() => {
    const opts = COUNTRIES.map((c) => ({ key: c.code, label: c.name }));
    return f.country && !opts.some((o) => o.key === f.country) ? [...opts, { key: f.country, label: f.country }] : opts;
  }, [f.country]);
  const currencyOptions = useMemo(() => (codes.includes(currency) ? codes : [...codes, currency]).map((c) => ({ key: c, label: c })), [codes, currency]);

  const missing = [
    ...(!f.name.trim() ? [t('leadCreate.missing.name')] : []),
    ...(!f.phone.trim() && !f.email.trim() ? [t('leadCreate.missing.phoneOrEmail')] : []),
    ...(f.amount.trim() !== '' && !Number.isFinite(Number(f.amount.replace(',', '.'))) ? [t('leadCreate.field.amount')] : []),
  ];

  const submit = async () => {
    if (!original) return;
    setSaving(true);
    try {
      const names = staff.filter((s) => assigneeIds.includes(s.id)).map((s) => s.fullName);
      const orNull = (v: string) => v.trim() || null;
      await updateLead({
        id,
        name: f.name.trim(),
        phone: orNull(f.phone),
        email: orNull(f.email),
        country: f.country || null,
        source: orNull(f.source),
        utmSource: orNull(f.utmSource), utmMedium: orNull(f.utmMedium), utmCampaign: orNull(f.utmCampaign),
        utmContent: orNull(f.utmContent), utmTerm: orNull(f.utmTerm),
        status,
        companyId, contactId,
        assignedUserIds: assigneeIds,
        assignedUserId: assigneeIds[0] || null,
        assignedToList: names,
        assignedTo: names.join(', ') || null,
        // Amount has its own permission (website + backend): sending it without the right would 403 the whole save.
        ...(canEditAmount ? { amount: (f.amount.trim() === '' ? 0 : Number(f.amount.replace(',', '.'))).toFixed(2), currency } : {}),
      });
      showToast(t('leadEdit.saved'), { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || t('leadEdit.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.ink} /></View>;

  return (
    <EntityFormShell
      title={t('leadEdit.title')} kicker={t('tabs.leads')} sub={original?.name || ''}
      missing={missing} entityLabel={t('leadCreate.entityLabel')} saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label={t('leadCreate.field.name')} required value={f.name} onChangeText={set('name')} />
        <EntityField label={t('leadCreate.field.phone')} required={!f.email} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <EntityField label={t('leadCreate.field.email')} required={!f.phone} value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
        <PickLabel label={t('contactEdit.field.country')} />
        <ChipPicker options={countryOptions} value={f.country} onChange={(v: string) => set('country')(v === f.country ? '' : v)} />
      </FieldCard>

      <FieldCard icon="cash-outline" title={t('leadCreate.section.amount')}>
        {canEditAmount ? (
          <>
            <EntityField label={t('leadCreate.field.amount')} value={f.amount} onChangeText={set('amount')} placeholder="0" keyboardType="numeric" />
            <PickLabel label={t('leadCreate.field.currency')} />
            <ChipPicker options={currencyOptions} value={currency} onChange={setCurrency} />
          </>
        ) : (
          <EntityField label={t('leadCreate.field.amount')} value={formatMoney(original?.amount ?? 0, original?.currency)} editable={false} help={t('common.noPermissionAmount')} onChangeText={() => {}} />
        )}
      </FieldCard>

      <FieldCard icon="podium-outline" title={t('leadCreate.section.statusSource')}>
        <PickLabel label={t('leadCreate.field.status')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={STATUSES.map((s) => ({ key: s, label: t(`leadStatus.${s}`) }))} value={status} onChange={(v: LeadStatusCode) => setStatus(v)} />
        </View>
        <EntityField label={t('leadCreate.field.source')} value={f.source} onChangeText={set('source')} />
      </FieldCard>

      <FieldCard icon="pricetag-outline" title="UTM">
        <EntityField label="utm_source" value={f.utmSource} onChangeText={set('utmSource')} autoCapitalize="none" />
        <EntityField label="utm_medium" value={f.utmMedium} onChangeText={set('utmMedium')} autoCapitalize="none" />
        <EntityField label="utm_campaign" value={f.utmCampaign} onChangeText={set('utmCampaign')} autoCapitalize="none" />
        <EntityField label="utm_content" value={f.utmContent} onChangeText={set('utmContent')} autoCapitalize="none" />
        <EntityField label="utm_term" value={f.utmTerm} onChangeText={set('utmTerm')} autoCapitalize="none" />
      </FieldCard>

      <FieldCard icon="people-outline" title={t('leadCreate.section.owners')}>
        <PickLabel label={t('contactEdit.field.assignees')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={staff.map((s) => ({ key: s.id, label: s.fullName }))} value={assigneeIds} onChange={setAssigneeIds} multi />
        </View>
        <LinkPicker label={t('projectEdit.field.company')} value={companyId} options={companies.map((c) => ({ id: c.id, label: c.name, sub: c.website }))} onChange={setCompanyId} />
        <LinkPicker label={t('projectEdit.field.contact')} value={contactId} options={contacts.map((c) => ({ id: c.id, label: c.fullName, sub: c.email || c.phone }))} onChange={setContactId} />
      </FieldCard>
    </EntityFormShell>
  );
};
