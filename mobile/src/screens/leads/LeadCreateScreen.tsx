import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList } from './LeadsStack';
import { createLead, LeadStatusCode } from '../../api/leads';
import { fetchCompanies, Company } from '../../api/companies';
import { fetchStaff, Staff } from '../../api/staff';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string; marginTop?: number }> = ({ label, marginTop }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6, marginTop }}>{label}</Text>;
};

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadCreate'>;

const STATUS_OPTIONS: { key: LeadStatusCode; label: string }[] = [
  { key: 'new', label: 'Новый' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'waiting', label: 'Ожидает' },
  { key: 'won', label: 'Выиграно' },
  { key: 'lost', label: 'Проиграно' },
];

export const LeadCreateScreen: React.FC<Props> = ({ navigation }) => {
  const { codes } = useCurrencyMode();
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
    ...(!name.trim() ? ['название'] : []),
    ...(!phone.trim() && !email.trim() ? ['телефон или e-mail'] : []),
    ...(!owners.length ? ['ответственный'] : []),
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
        assignedToList: owners,
      });
      showToast('Лид создан', { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Не удалось создать лид', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityFormShell
      title="Новый лид" kicker="Лиды" sub="Обязательное отмечено звёздочкой"
      missing={missing} entityLabel="лид" saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label="Название лида" required value={name} onChangeText={setName} placeholder="Vetra Yapı — ремонт кровли" help="что нужно клиенту — так лид виден в списке" />
        <EntityField label="Телефон" required={!email} value={phone} onChangeText={setPhone} placeholder="+90 5__ ___ __ __" keyboardType="phone-pad" />
        <EntityField label="E-mail" required={!phone} value={email} onChangeText={setEmail} placeholder="satis@company.com" keyboardType="email-address" autoCapitalize="none" />
      </FieldCard>

      <FieldCard icon="cash-outline" title="Сумма и валюта">
        <EntityField label="Сумма лида" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" help="хранится в валюте записи, не пересчитывается" />
        <PickLabel label="Валюта" />
        <ChipPicker options={codes.map((c) => ({ key: c, label: c }))} value={currency} onChange={setCurrency} />
      </FieldCard>

      <FieldCard icon="podium-outline" title="Статус и источник">
        <PickLabel label="Статус" />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        </View>
        <EntityField label="Источник" value={source} onChangeText={setSource} placeholder="online-chat, ads, seo…" />
        <PickLabel label="Компания" marginTop={spacing.xs} />
        <ChipPicker
          options={[{ key: '', label: 'Без компании' }, ...companies.map((c) => ({ key: c.id, label: c.name }))]}
          value={companyId}
          onChange={setCompanyId}
        />
      </FieldCard>

      <FieldCard icon="people-outline" title="Ответственные">
        <PickLabel label="Кто ведёт лида" />
        <ChipPicker
          options={staff.map((s) => ({ key: s.fullName, label: s.fullName }))}
          value={owners}
          onChange={setOwners}
          multi
        />
      </FieldCard>
    </EntityFormShell>
  );
};
