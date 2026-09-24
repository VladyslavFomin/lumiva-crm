import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList } from './LeadsStack';
import { createLead, LeadStatusCode } from '../../api/leads';
import { fetchCompanies, Company } from '../../api/companies';
import { fetchStaff, Staff } from '../../api/staff';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string; marginTop?: number }> = ({ label, marginTop }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6, marginTop }}>{label}</Text>;
};

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadCreate'>;

export const LeadCreateScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useLanguage();
  const { codes } = useCurrencyMode();
  const STATUS_OPTIONS: { key: LeadStatusCode; label: string }[] = [
    { key: 'new', label: t('leadCreate.status.new') },
    { key: 'in_progress', label: t('leadCreate.status.in_progress') },
    { key: 'waiting', label: t('leadCreate.status.waiting') },
    { key: 'won', label: t('leadCreate.status.won') },
    { key: 'lost', label: t('leadCreate.status.lost') },
  ];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [status, setStatus] = useState<LeadStatusCode>('new');
  const [source, setSource] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [owners, setOwners] = useState<string[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCompanies().then(setCompanies).catch(() => {});
    fetchStaff().then(setStaff).catch(() => {});
  }, []);

  useEffect(() => { if (codes[0]) setCurrency(codes[0]); }, [codes]);

  const missing = [
    ...(!name.trim() ? [t('leadCreate.missing.name')] : []),
    ...(!phone.trim() && !email.trim() ? [t('leadCreate.missing.phoneOrEmail')] : []),
    ...(!owners.length ? [t('leadCreate.missing.owner')] : []),
  ];

  const submit = async () => {
    setSaving(true);
    try {
      await createLead({
        name: name.trim(),
        phone: phone || null,
        email: email || null,
        source: source || null,
        status,
        amount: amount || undefined,
        currency,
        companyId: companyId || null,
        // Both representations, like the website: ids drive record visibility/permissions, names are what lists display.
        assignedUserIds: owners,
        assignedUserId: owners[0] || null,
        assignedToList: staff.filter((x) => owners.includes(x.id)).map((x) => x.fullName),
        assignedTo: staff.filter((x) => owners.includes(x.id)).map((x) => x.fullName).join(', ') || null,
      });
      showToast(t('leadCreate.created'), { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || t('leadCreate.createError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityFormShell
      title={t('leadCreate.title')} kicker={t('tabs.leads')} sub={t('leadCreate.subHint')}
      missing={missing} entityLabel={t('leadCreate.entityLabel')} saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label={t('leadCreate.field.name')} required value={name} onChangeText={setName} placeholder={t('leadCreate.field.namePlaceholder')} help={t('leadCreate.field.nameHelp')} />
        <EntityField label={t('leadCreate.field.phone')} required={!email} value={phone} onChangeText={setPhone} placeholder="+90 5__ ___ __ __" keyboardType="phone-pad" />
        <EntityField label={t('leadCreate.field.email')} required={!phone} value={email} onChangeText={setEmail} placeholder="satis@company.com" keyboardType="email-address" autoCapitalize="none" />
      </FieldCard>

      <FieldCard icon="cash-outline" title={t('leadCreate.section.amount')}>
        <EntityField label={t('leadCreate.field.amount')} value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" help={t('leadCreate.field.amountHelp')} />
        <PickLabel label={t('leadCreate.field.currency')} />
        <ChipPicker options={codes.map((c) => ({ key: c, label: c }))} value={currency} onChange={setCurrency} />
      </FieldCard>

      <FieldCard icon="podium-outline" title={t('leadCreate.section.statusSource')}>
        <PickLabel label={t('leadCreate.field.status')} />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        </View>
        <EntityField label={t('leadCreate.field.source')} value={source} onChangeText={setSource} placeholder={t('leadCreate.field.sourcePlaceholder')} />
        <PickLabel label={t('leadCreate.field.company')} marginTop={spacing.xs} />
        <ChipPicker
          options={[{ key: '', label: t('leadCreate.field.noCompany') }, ...companies.map((c) => ({ key: c.id, label: c.name }))]}
          value={companyId}
          onChange={setCompanyId}
        />
      </FieldCard>

      <FieldCard icon="people-outline" title={t('leadCreate.section.owners')}>
        <PickLabel label={t('leadCreate.field.owner')} />
        <ChipPicker
          options={staff.map((s) => ({ key: s.id, label: s.fullName }))}
          value={owners}
          onChange={setOwners}
          multi
        />
      </FieldCard>
    </EntityFormShell>
  );
};
