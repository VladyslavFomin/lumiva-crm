import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createContact } from '../../api/contacts';
import { fetchCompanies, Company } from '../../api/companies';
import { fetchStaff, Staff } from '../../api/staff';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string; marginTop?: number }> = ({ label, marginTop }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6, marginTop }}>{label}</Text>;
};

export const ContactCreateScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [position, setPosition] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCompanies().then(setCompanies).catch(() => {});
    fetchStaff().then(setStaff).catch(() => {});
  }, []);

  const missing = [
    ...(!firstName.trim() ? ['имя'] : []),
    ...(!phone.trim() && !email.trim() ? ['телефон или e-mail'] : []),
    ...(!ownerId ? ['ответственный'] : []),
  ];

  const submit = async () => {
    setSaving(true);
    try {
      const owner = staff.find((s) => s.id === ownerId);
      await createContact({
        firstName: firstName.trim(),
        lastName: lastName || null,
        position: position || null,
        companyId: companyId || null,
        phone: phone || null,
        email: email || null,
        city: city || null,
        assignedTo: owner?.fullName || null,
      });
      showToast('Контакт создан', { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Не удалось создать контакт', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityFormShell
      title="Новый контакт" kicker="Контакты" sub="Контакт можно привязать к компании"
      missing={missing} entityLabel="контакт" saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label="Имя" required value={firstName} onChangeText={setFirstName} placeholder="Selin" />
        <EntityField label="Фамилия" value={lastName} onChangeText={setLastName} placeholder="Aydın" />
        <EntityField label="Должность" value={position} onChangeText={setPosition} placeholder="Директор по закупкам" />
        <PickLabel label="Компания" />
        <ChipPicker
          options={[{ key: '', label: 'Без компании' }, ...companies.map((c) => ({ key: c.id, label: c.name }))]}
          value={companyId}
          onChange={setCompanyId}
        />
      </FieldCard>

      <FieldCard icon="call-outline" title="Связь">
        <EntityField label="Телефон" required={!email} value={phone} onChangeText={setPhone} placeholder="+90 5__ ___ __ __" keyboardType="phone-pad" />
        <EntityField label="E-mail" required={!phone} value={email} onChangeText={setEmail} placeholder="name@company.com" keyboardType="email-address" autoCapitalize="none" />
        <EntityField label="Город" value={city} onChangeText={setCity} placeholder="İstanbul" />
        <PickLabel label="Ответственный" />
        <ChipPicker options={staff.map((s) => ({ key: s.id, label: s.fullName }))} value={ownerId} onChange={setOwnerId} />
      </FieldCard>
    </EntityFormShell>
  );
};
