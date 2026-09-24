import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchCompany, updateCompany, createCompany, Company } from '../../api/companies';
import { fetchStaff, Staff } from '../../api/staff';
import { COUNTRIES, RECORD_STATUSES, COMPANY_SIZES, COMPANY_TYPES } from '../../utils/refData';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string }> = ({ label }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>;
};

/** Full company form (create when opened without an `id`, edit otherwise) — every field the website's company card saves (identity, legal name/tax id, description, contact info,
 *  location, industry, size, stage, status, assignees, tags). Legal requisites and custom fields keep their own editors. */
export const CompanyEditScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { id } = (useRoute<any>().params ?? {}) as { id?: string };
  const isNew = !id;
  const { t } = useLanguage();
  const { colors } = useTheme();

  const [original, setOriginal] = useState<Company | null>(null);
  const [f, setF] = useState({ name: '', legalName: '', taxId: '', description: '', website: '', email: '', phone: '', country: '', city: '', address: '', industry: '', tags: '' });
  const [size, setSize] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('active');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([isNew ? Promise.resolve(null) : fetchCompany(id!), fetchStaff().catch(() => [] as Staff[])])
      .then(([c, sf]) => {
        setStaff(sf);
        if (!c) return; // create mode: empty form
        setOriginal(c);
        setF({
          name: c.name, legalName: c.legalName || '', taxId: c.taxId || '', description: c.description || '', website: c.website || '',
          email: c.email || '', phone: c.phone || '', country: c.country || '', city: c.city || '', address: c.address || '',
          industry: c.industry || '', tags: c.tags.join(', '),
        });
        setSize(c.size || ''); setType(c.type || ''); setStatus(c.status || 'active'); setAssigneeIds(c.assignedUserIds);
      })
      .catch(() => { showToast(t('companyEdit.loadError'), { variant: 'error' }); navigation.goBack(); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const countryOptions = useMemo(() => {
    const opts = COUNTRIES.map((c) => ({ key: c.code, label: c.name }));
    return f.country && !opts.some((o) => o.key === f.country) ? [...opts, { key: f.country, label: f.country }] : opts;
  }, [f.country]);
  const sizeOptions = useMemo(() => (size && !(COMPANY_SIZES as readonly string[]).includes(size) ? [...COMPANY_SIZES, size] : [...COMPANY_SIZES]).map((s) => ({ key: s, label: s })), [size]);

  const missing = !f.name.trim() ? [t('companyCreate.field.name')] : [];

  const submit = async () => {
    if (!isNew && !original) return;
    setSaving(true);
    try {
      const primary = staff.find((s) => s.id === assigneeIds[0]);
      const body = {
        name: f.name.trim(),
        legalName: f.legalName.trim() || null,
        taxId: f.taxId.trim() || null,
        description: f.description.trim() || null,
        website: f.website.trim() || null,
        email: f.email.trim() || null,
        phone: f.phone.trim() || null,
        country: f.country || null,
        city: f.city.trim() || null,
        address: f.address.trim() || null,
        industry: f.industry.trim() || null,
        size: size || null,
        type: type || null,
        status,
        tags: f.tags.split(',').map((x) => x.trim()).filter(Boolean),
        assignedUserIds: assigneeIds,
        assignedUserId: assigneeIds[0] || null,
        assignedTo: primary ? (primary.fullName || primary.email) : null,
      };
      if (isNew) await createCompany(body);
      else await updateCompany({ id: id!, ...body });
      showToast(t(isNew ? 'companyCreate.created' : 'companyEdit.saved'), { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || t(isNew ? 'companyCreate.createError' : 'companyEdit.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.ink} /></View>;

  return (
    <EntityFormShell
      title={t(isNew ? 'companyCreate.title' : 'companyEdit.title')} kicker={t('more.item.companies')} sub={original?.name || ''}
      missing={missing} entityLabel={t('companyEdit.entityLabel')} saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label={t('companyCreate.field.name')} required value={f.name} onChangeText={set('name')} />
        <EntityField label={t('companyEdit.field.legalName')} value={f.legalName} onChangeText={set('legalName')} />
        <EntityField label={t('companyEdit.field.taxId')} value={f.taxId} onChangeText={set('taxId')} />
        <EntityField label={t('companyEdit.field.description')} value={f.description} onChangeText={set('description')} multiline />
        <EntityField label={t('companyEdit.field.industry')} value={f.industry} onChangeText={set('industry')} />
      </FieldCard>

      <FieldCard icon="call-outline" title={t('contactEdit.section.contacts')}>
        <EntityField label={t('companyCreate.field.website')} value={f.website} onChangeText={set('website')} keyboardType="default" autoCapitalize="none" />
        <EntityField label={t('contactCreate.field.email')} value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
        <EntityField label={t('contactCreate.field.phone')} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      </FieldCard>

      <FieldCard icon="location-outline" title={t('contactEdit.section.location')}>
        <PickLabel label={t('contactEdit.field.country')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={countryOptions} value={f.country} onChange={(v: string) => set('country')(v === f.country ? '' : v)} />
        </View>
        <EntityField label={t('companyCreate.field.city')} value={f.city} onChangeText={set('city')} />
        <EntityField label={t('contactEdit.field.address')} value={f.address} onChangeText={set('address')} />
      </FieldCard>

      <FieldCard icon="flag-outline" title={t('contactEdit.section.classification')}>
        <PickLabel label={t('companyEdit.field.type')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={COMPANY_TYPES.map((s) => ({ key: s, label: t(`companyType.${s}`) }))} value={type} onChange={(v: string) => setType(v === type ? '' : v)} />
        </View>
        <PickLabel label={t('companyEdit.field.size')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={sizeOptions} value={size} onChange={(v: string) => setSize(v === size ? '' : v)} />
        </View>
        <PickLabel label={t('contactEdit.field.status')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={RECORD_STATUSES.map((s) => ({ key: s, label: t(`recordStatus.${s}`) }))} value={status} onChange={setStatus} />
        </View>
        <PickLabel label={t('contactEdit.field.assignees')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={staff.map((s) => ({ key: s.id, label: s.fullName }))} value={assigneeIds} onChange={setAssigneeIds} multi />
        </View>
        <EntityField label={t('contactEdit.field.tags')} value={f.tags} onChangeText={set('tags')} help={t('contactEdit.field.tagsHelp')} />
      </FieldCard>
    </EntityFormShell>
  );
};
