import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchProject, fetchProjects, updateProject, updateProjectStatus, Project } from '../../api/projects';
import { fetchProjectStatusDefs, fetchProjectTagDefs, ProjectStatusDef, ProjectTagDef } from '../../api/projectSettings';
import { fetchLeads, Lead } from '../../api/leads';
import { fetchCompanies, Company } from '../../api/companies';
import { fetchContacts, Contact } from '../../api/contacts';
import { fetchStaff, Staff } from '../../api/staff';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useAccess } from '../../context/AccessContext';
import { formatMoney } from '../../utils/money';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker, LinkPicker, LinkMultiPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string }> = ({ label }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>;
};

/** Full edit form for a project — every field the website's project card lets you change (name, description, amount + currency,
 *  status, category, tags, owners, and the lead / company / contact links). Custom fields keep their own inline editor on the detail screen. */
export const ProjectEditScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { id } = useRoute<any>().params as { id: string };
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { codes } = useCurrencyMode();
  // Same rules as the website (and the backend, which 403s the whole update otherwise): amount and owners have their own permissions.
  const { can } = useAccess();
  const canEditAmount = can('projects_edit_amount');
  const canEditOwner = can('projects_edit_owner');

  const [original, setOriginal] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [relatedIds, setRelatedIds] = useState<string[]>([]);
  const [briefName, setBriefName] = useState('');
  const [briefUrl, setBriefUrl] = useState('');
  const [allProjects, setAllProjects] = useState<Project[]>([]);

  const [statuses, setStatuses] = useState<ProjectStatusDef[]>([]);
  const [tagDefs, setTagDefs] = useState<ProjectTagDef[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchProject(id),
      fetchProjectStatusDefs().catch(() => [] as ProjectStatusDef[]),
      fetchProjectTagDefs().catch(() => [] as ProjectTagDef[]),
      fetchStaff().catch(() => [] as Staff[]),
      fetchLeads().catch(() => [] as Lead[]),
      fetchCompanies().catch(() => [] as Company[]),
      fetchContacts().catch(() => [] as Contact[]),
      fetchProjects().then((r) => r.items).catch(() => [] as Project[]),
    ]).then(([p, st, tg, sf, ld, co, ct, pr]) => {
      setOriginal(p);
      setName(p.name);
      setDescription(p.description || '');
      setAmount(p.amount ? String(p.amount) : '');
      setCurrency(p.currency || 'EUR');
      setStatus(p.status);
      setCategory(p.category || '');
      setTags(p.tags);
      setOwnerIds(p.ownerUserIds);
      setLeadId(p.leadId);
      setCompanyId(p.companyId);
      setContactId(p.contactId);
      setRelatedIds(p.relatedProjectIds); setBriefName(p.briefFileName || ''); setBriefUrl(p.briefFileUrl || '');
      setAllProjects(pr.filter((x) => x.id !== p.id));
      setStatuses(st); setTagDefs(tg); setStaff(sf); setLeads(ld); setCompanies(co); setContacts(ct);
    }).catch(() => {
      showToast(t('projectDetail.loadError'), { variant: 'error' });
      navigation.goBack();
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // A project can carry a tag/currency that is no longer in the tenant's lists — keep it selectable instead of silently dropping it.
  const tagOptions = useMemo(() => {
    const known = tagDefs.map((d) => d.value);
    return [...known, ...tags.filter((x) => !known.includes(x))].map((v) => ({ key: v, label: v }));
  }, [tagDefs, tags]);
  const currencyOptions = useMemo(() => (codes.includes(currency) ? codes : [...codes, currency]).map((c) => ({ key: c, label: c })), [codes, currency]);
  const statusOptions = useMemo(() => {
    const known = statuses.map((s) => s.value);
    return (status && !known.includes(status) ? [...known, status] : known).map((v) => ({ key: v, label: v }));
  }, [statuses, status]);

  const missing = [
    ...(!name.trim() ? [t('projectCreate.missing.name')] : []),
    ...(amount.trim() !== '' && !Number.isFinite(Number(amount.replace(',', '.'))) ? [t('projectCreate.missing.amount')] : []),
  ];

  const submit = async () => {
    if (!original) return;
    setSaving(true);
    try {
      const amountNum = amount.trim() === '' ? 0 : Number(amount.replace(',', '.'));
      await updateProject({
        id,
        name: name.trim(),
        description: description.trim(),
        ...(canEditAmount ? { amount: amountNum.toFixed(2), currency } : {}),
        category: category.trim(),
        tags: tags.join(','),
        ...(canEditOwner ? { ownerUserIds: ownerIds, ownerName: staff.filter((s) => ownerIds.includes(s.id)).map((s) => s.fullName).join(', ') || undefined } : {}),
        leadId,
        companyId,
        contactId,
        relatedProjectIds: relatedIds,
        briefFileName: briefName.trim() || null,
        briefFileUrl: briefUrl.trim() || null,
      });
      // Status has its own endpoint: it validates against the tenant's statuses and logs a real `status_change` history entry.
      if (status && status !== original.status) await updateProjectStatus(id, status as Project['status']);
      showToast(t('projectEdit.saved'), { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || t('projectEdit.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.ink} /></View>;
  }

  return (
    <EntityFormShell
      title={t('projectEdit.title')} kicker={t('tabs.projects')} sub={original?.name || ''}
      missing={missing} entityLabel={t('projectCreate.entityLabel')} saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label={t('projectCreate.field.name')} required value={name} onChangeText={setName} />
        <EntityField label={t('projectEdit.field.description')} value={description} onChangeText={setDescription} multiline />
        {canEditAmount ? (
          <>
            <EntityField label={t('projectCreate.field.amount')} value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" />
            <PickLabel label={t('projectCreate.field.currency')} />
            <ChipPicker options={currencyOptions} value={currency} onChange={setCurrency} />
          </>
        ) : (
          <EntityField label={t('projectCreate.field.amount')} value={formatMoney(original?.amount ?? 0, original?.currency)} editable={false} help={t('common.noPermissionAmount')} onChangeText={() => {}} />
        )}
      </FieldCard>

      <FieldCard icon="flag-outline" title={t('projectCreate.section.classification')}>
        <PickLabel label={t('projectCreate.field.status')} />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker options={statusOptions} value={status} onChange={setStatus} />
        </View>
        <EntityField label={t('projectCreate.field.category')} value={category} onChangeText={setCategory} placeholder={t('projectCreate.field.categoryPlaceholder')} />
        {tagOptions.length > 0 && (
          <>
            <PickLabel label={t('projectCreate.field.tags')} />
            <ChipPicker options={tagOptions} value={tags} onChange={setTags} multi />
          </>
        )}
      </FieldCard>

      <FieldCard icon="people-outline" title={t('projectCreate.section.team')}>
        <PickLabel label={t('projectCreate.field.owner')} />
        <View style={{ marginBottom: spacing.md, opacity: canEditOwner ? 1 : 0.5 }} pointerEvents={canEditOwner ? 'auto' : 'none'}>
          <ChipPicker options={staff.map((s) => ({ key: s.id, label: s.fullName }))} value={ownerIds} onChange={setOwnerIds} multi />
        </View>
      </FieldCard>

      <FieldCard icon="link-outline" title={t('projectEdit.section.links')}>
        <LinkPicker label={t('projectEdit.field.lead')} value={leadId} options={leads.map((l) => ({ id: l.id, label: l.name || l.email || l.phone || l.id, sub: l.email || l.phone }))} onChange={setLeadId} />
        <LinkPicker label={t('projectEdit.field.company')} value={companyId} options={companies.map((c) => ({ id: c.id, label: c.name, sub: c.website }))} onChange={setCompanyId} />
        <LinkPicker label={t('projectEdit.field.contact')} value={contactId} options={contacts.map((c) => ({ id: c.id, label: c.fullName, sub: c.email || c.phone }))} onChange={setContactId} />
        <LinkMultiPicker label={t('projectEdit.field.related')} value={relatedIds} options={allProjects.map((x) => ({ id: x.id, label: x.name, sub: x.status }))} onChange={setRelatedIds} />
      </FieldCard>

      <FieldCard icon="document-attach-outline" title={t('projectEdit.section.brief')}>
        <EntityField label={t('projectEdit.field.briefName')} value={briefName} onChangeText={setBriefName} />
        <EntityField label={t('projectEdit.field.briefUrl')} value={briefUrl} onChangeText={setBriefUrl} autoCapitalize="none" placeholder="https://…" />
      </FieldCard>
    </EntityFormShell>
  );
};
