import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchContact, updateContact, createContact, Contact } from '../../api/contacts';
import { fetchCompanies, Company } from '../../api/companies';
import { fetchStaff, Staff } from '../../api/staff';
import { COUNTRIES, RECORD_STATUSES } from '../../utils/refData';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker, LinkPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string }> = ({ label }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>;
};

/** Full contact form (create when opened without an `id`, edit otherwise) — every field the website's contact card saves (name, position, contact info, company link, location,
 *  status, assignees, tags, passport). Custom fields keep their own inline editor on the detail screen. */
export const ContactEditScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { id } = (useRoute<any>().params ?? {}) as { id?: string };
  const isNew = !id;
  const { t } = useLanguage();
  const { colors } = useTheme();

  const [original, setOriginal] = useState<Contact | null>(null);
  const [f, setF] = useState({ firstName: '', lastName: '', position: '', email: '', phone: '', country: '', city: '', address: '', tags: '', passport: '' });
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [status, setStatus] = useState('active');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([isNew ? Promise.resolve(null) : fetchContact(id!), fetchCompanies().catch(() => [] as Company[]), fetchStaff().catch(() => [] as Staff[])])
      .then(([c, co, sf]) => {
        setCompanies(co); setStaff(sf);
        if (!c) return; // create mode: empty form
        setOriginal(c);
        setF({
          firstName: c.firstName, lastName: c.lastName, position: c.position || '', email: c.email || '', phone: c.phone || '',
          country: c.country || '', city: c.city || '', address: c.address || '', tags: c.tags.join(', '),
          passport: c.customFields?.passport ? String(c.customFields.passport) : '',
        });
        setCompanyId(c.companyId);
        setStatus(c.status || 'active');
        setAssigneeIds(c.assignedUserIds);
      })
      .catch(() => { showToast(t('contactEdit.loadError'), { variant: 'error' }); navigation.goBack(); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const countryOptions = useMemo(() => {
    const opts = COUNTRIES.map((c) => ({ key: c.code, label: c.name }));
    // A stored country that isn't in the preset list stays selectable.
    return f.country && !opts.some((o) => o.key === f.country) ? [...opts, { key: f.country, label: f.country }] : opts;
  }, [f.country]);

  const missing = !f.firstName.trim() && !f.lastName.trim() ? [t('contactEdit.missing.name')] : [];

  const submit = async () => {
    if (!isNew && !original) return;
    setSaving(true);
    try {
      const primary = staff.find((s) => s.id === assigneeIds[0]);
      const body = {
        position: f.position.trim() || null,
        email: f.email.trim() || null,
        phone: f.phone.trim() || null,
        companyId,
        country: f.country || null,
        city: f.city.trim() || null,
        address: f.address.trim() || null,
        status,
        tags: f.tags.split(',').map((x) => x.trim()).filter(Boolean),
        assignedUserIds: assigneeIds,
        assignedUserId: assigneeIds[0] || null,
        assignedTo: primary ? (primary.fullName || primary.email) : null,
        // Same as the website: passport lives in customFields next to the tenant's custom fields.
        customFields: { ...(original?.customFields || {}), passport: f.passport.trim() },
      };
      if (isNew) {
        // The API wants a first name; when only a last name was typed it becomes the first one (the website derives fullName the same way).
        await createContact({ ...body, firstName: f.firstName.trim() || f.lastName.trim(), lastName: f.firstName.trim() ? f.lastName.trim() || null : null });
        showToast(t('contactCreate.created'), { variant: 'success' });
      } else {
        await updateContact({ id: id!, ...body, firstName: f.firstName.trim() || null, lastName: f.lastName.trim() || null });
        showToast(t('contactEdit.saved'), { variant: 'success' });
      }
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || t(isNew ? 'contactCreate.createError' : 'contactEdit.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.ink} /></View>;

  return (
    <EntityFormShell
      title={t(isNew ? 'contactCreate.title' : 'contactEdit.title')} kicker={t('more.item.contacts')} sub={original?.fullName || ''}
      missing={missing} entityLabel={t('contactEdit.entityLabel')} saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label={t('contactCreate.field.firstName')} value={f.firstName} onChangeText={set('firstName')} />
        <EntityField label={t('contactCreate.field.lastName')} value={f.lastName} onChangeText={set('lastName')} />
        <EntityField label={t('contactCreate.field.position')} value={f.position} onChangeText={set('position')} />
        <LinkPicker label={t('contactEdit.field.company')} value={companyId} options={companies.map((c) => ({ id: c.id, label: c.name, sub: c.website }))} onChange={setCompanyId} />
      </FieldCard>

      <FieldCard icon="call-outline" title={t('contactEdit.section.contacts')}>
        <EntityField label={t('contactCreate.field.phone')} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <EntityField label={t('contactCreate.field.email')} value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      </FieldCard>

      <FieldCard icon="location-outline" title={t('contactEdit.section.location')}>
        <PickLabel label={t('contactEdit.field.country')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={countryOptions} value={f.country} onChange={(v: string) => set('country')(v === f.country ? '' : v)} />
        </View>
        <EntityField label={t('contactCreate.field.city')} value={f.city} onChangeText={set('city')} />
        <EntityField label={t('contactEdit.field.address')} value={f.address} onChangeText={set('address')} />
      </FieldCard>

      <FieldCard icon="flag-outline" title={t('contactEdit.section.classification')}>
        <PickLabel label={t('contactEdit.field.status')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={RECORD_STATUSES.map((s) => ({ key: s, label: t(`recordStatus.${s}`) }))} value={status} onChange={setStatus} />
        </View>
        <PickLabel label={t('contactEdit.field.assignees')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={staff.map((s) => ({ key: s.id, label: s.fullName }))} value={assigneeIds} onChange={setAssigneeIds} multi />
        </View>
        <EntityField label={t('contactEdit.field.tags')} value={f.tags} onChangeText={set('tags')} help={t('contactEdit.field.tagsHelp')} />
        <EntityField label={t('contactEdit.field.passport')} value={f.passport} onChangeText={set('passport')} />
      </FieldCard>
    </EntityFormShell>
  );
};
