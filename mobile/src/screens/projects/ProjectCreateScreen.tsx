import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createProject, ProjectStatus } from '../../api/projects';
import { fetchProjectStatusDefs, ProjectStatusDef } from '../../api/projectSettings';
import { fetchLeads, Lead } from '../../api/leads';
import { fetchCompanies, Company } from '../../api/companies';
import { fetchContacts, Contact } from '../../api/contacts';
import { fetchStaff, Staff } from '../../api/staff';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker, LinkPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string; marginTop?: number }> = ({ label, marginTop }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6, marginTop }}>{label}</Text>;
};

export const ProjectCreateScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const { codes } = useCurrencyMode();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [statuses, setStatuses] = useState<ProjectStatusDef[]>([]);
  const [status, setStatus] = useState<string>('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProjectStatusDefs().then((defs) => { setStatuses(defs); if (defs[0]) setStatus(defs[0].value); }).catch(() => {});
    fetchStaff().then(setStaff).catch(() => {});
    fetchLeads().then(setLeads).catch(() => {});
    fetchCompanies().then(setCompanies).catch(() => {});
    fetchContacts().then(setContacts).catch(() => {});
  }, []);

  useEffect(() => { if (codes[0]) setCurrency(codes[0]); }, [codes]);

  const missing = [
    ...(!name.trim() ? [t('projectCreate.missing.name')] : []),
    ...(!ownerIds.length ? [t('projectCreate.missing.owner')] : []),
    ...(!amount ? [t('projectCreate.missing.amount')] : []),
  ];

  const submit = async () => {
    setSaving(true);
    try {
      const ownerName = staff.find((s) => s.id === ownerIds[0])?.fullName;
      await createProject({
        name: name.trim(),
        amount: amount || '0',
        currency,
        status: status as ProjectStatus,
        category: category || undefined,
        tags: tags.trim() || undefined,
        ownerName,
        ownerUserIds: ownerIds,
        leadId: leadId || undefined,
        companyId: companyId || undefined,
        contactId: contactId || undefined,
        description: description.trim() || undefined,
      });
      showToast(t('projectCreate.created'), { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || t('projectCreate.createError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityFormShell
      title={t('projectCreate.title')} kicker={t('tabs.projects')} sub={t('projectCreate.subHint')}
      missing={missing} entityLabel={t('projectCreate.entityLabel')} saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label={t('projectCreate.field.name')} required value={name} onChangeText={setName} placeholder={t('projectCreate.field.namePlaceholder')} />
        <EntityField label={t('projectEdit.field.description')} value={description} onChangeText={setDescription} multiline />
        <EntityField label={t('projectCreate.field.amount')} required value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" />
        <PickLabel label={t('projectCreate.field.currency')} />
        <ChipPicker options={codes.map((c) => ({ key: c, label: c }))} value={currency} onChange={setCurrency} />
      </FieldCard>

      <FieldCard icon="flag-outline" title={t('projectCreate.section.classification')}>
        <PickLabel label={t('projectCreate.field.status')} />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker options={statuses.map((s) => ({ key: s.value, label: s.value }))} value={status} onChange={setStatus} />
        </View>
        <EntityField label={t('projectCreate.field.category')} value={category} onChangeText={setCategory} placeholder={t('projectCreate.field.categoryPlaceholder')} />
        <EntityField label={t('projectCreate.field.tags')} value={tags} onChangeText={setTags} placeholder={t('projectCreate.field.tagsPlaceholder')} help={t('projectCreate.field.tagsHelp')} />
      </FieldCard>

      <FieldCard icon="people-outline" title={t('projectCreate.section.team')}>
        <PickLabel label={t('projectCreate.field.owner')} />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker options={staff.map((s) => ({ key: s.id, label: s.fullName }))} value={ownerIds} onChange={setOwnerIds} multi />
        </View>
      </FieldCard>

      <FieldCard icon="link-outline" title={t('projectEdit.section.links')}>
        <LinkPicker label={t('projectCreate.field.fromLead')} value={leadId} options={leads.map((l) => ({ id: l.id, label: l.name || l.email || l.phone || l.id, sub: l.email || l.phone }))} onChange={setLeadId} />
        <LinkPicker label={t('projectEdit.field.company')} value={companyId} options={companies.map((c) => ({ id: c.id, label: c.name, sub: c.website }))} onChange={setCompanyId} />
        <LinkPicker label={t('projectEdit.field.contact')} value={contactId} options={contacts.map((c) => ({ id: c.id, label: c.fullName, sub: c.email || c.phone }))} onChange={setContactId} />
      </FieldCard>
    </EntityFormShell>
  );
};
